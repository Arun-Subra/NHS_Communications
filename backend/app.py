import os
import sys
import json
import base64
from concurrent import futures as cf
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from supabase import create_client

from google.cloud import vision
from google.oauth2 import service_account, credentials as oauth2_credentials
from google import genai

# ─── CONFIGURATION & INITIALIZATION ──────────────────────────────────────────

load_dotenv()

TABLE_SCANS = "document_scans"
TABLE_EVENTS = "button_events"
TABLE_PATIENTS = "patients"
TABLE_APPOINTMENTS = "appointments"
TABLE_PRESCRIPTIONS = "prescriptions"
DEFAULT_SCAN_TYPE = "appointment_letter"
MAX_SUMMARY_WORKERS = 5

app = Flask(__name__, static_folder="../dist", static_url_path="/")
CORS(app, origins=["http://localhost:3000", "http://localhost:5173"])

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

_credentials_info = json.loads(base64.b64decode(os.environ["GCP_CREDENTIALS_JSON"]))
if _credentials_info.get("type") == "service_account":
    _gcp_credentials = service_account.Credentials.from_service_account_info(
        _credentials_info,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
elif _credentials_info.get("type") == "authorized_user":
    _gcp_credentials = oauth2_credentials.Credentials(
        token=None,
        refresh_token=_credentials_info["refresh_token"],
        client_id=_credentials_info["client_id"],
        client_secret=_credentials_info["client_secret"],
        token_uri="https://oauth2.googleapis.com/token",
        quota_project_id=_credentials_info.get("quota_project_id"),
    )
else:
    raise ValueError(f"Unsupported GCP credential type: {_credentials_info.get('type')}")

_gemini_client = genai.Client(
    vertexai=True,
    project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
    location=os.environ.get("GOOGLE_CLOUD_LOCATION", "europe-west2"),
    credentials=_gcp_credentials,
)
GEMINI_MODEL = "gemini-2.5-flash"

_vision_client = vision.ImageAnnotatorClient(credentials=_gcp_credentials)

# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

def _insert_record(table, payload):
    supabase.table(table).insert(payload).execute()

def perform_google_ocr(image_base64):
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    image_bytes = base64.b64decode(image_base64)
    image = vision.Image(content=image_bytes)
    response = _vision_client.document_text_detection(image=image)
    if response.error.message:
        raise Exception(f"Google Vision Error: {response.error.message}")
    annotation = response.full_text_annotation
    return annotation.text if annotation else ""

def generate_appointment_summary(raw_text):
    prompt = f"""You are a medical assistant extracting information from an NHS letter.
Read the following text and summarize the specific appointment details.
Return the information clearly formatted with:
- Clinician/Department
- Date
- Time
- Location

If any of these details are missing, write "Not specified".

Raw text:
{raw_text}"""
    response = _gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return response.text

def _process_single_scan(scan):
    raw_text = scan.get("raw_text")
    scan_id = scan.get("id")
    if not raw_text:
        return 0
    try:
        summary = generate_appointment_summary(raw_text)
        supabase.table(TABLE_SCANS)\
            .update({"summary_text": summary, "summary_status": "completed"})\
            .eq("id", scan_id)\
            .execute()
        return 1
    except Exception:
        return 0

# ─── API ROUTES ──────────────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})


@app.route('/api/me', methods=['GET'])
def get_me():
    try:
        patients = supabase.table(TABLE_PATIENTS).select("*").limit(1).execute().data
        if not patients:
            return jsonify({"error": "No patient found"}), 404

        nhs = patients[0]["nhs_number"]
        appointments = supabase.table(TABLE_APPOINTMENTS).select("*").eq("nhs_number", nhs).execute().data
        prescriptions = supabase.table(TABLE_PRESCRIPTIONS).select("*").eq("nhs_number", nhs).execute().data
    except Exception as e:
        print(f"Supabase error in /api/me: {e}", file=sys.stderr)
        return jsonify({"error": "Database unavailable"}), 500

    for p in prescriptions:
        p["repeatsLeft"] = p.pop("repeats_left", 0)

    return jsonify({
        "patient_info": {"name": patients[0]["name"], "nhs_number": nhs},
        "appointments": appointments,
        "prescriptions": prescriptions,
    })


@app.route('/api/scan', methods=['POST'])
def log_scan():
    data = request.get_json()
    if data is None:
        return jsonify({"error": "Request body required"}), 400

    missing = {"nhs_number", "image_data"} - data.keys()
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        extracted_text = perform_google_ocr(data["image_data"])

        if not extracted_text.strip():
            return jsonify({"error": "No clear text could be scanned from this image."}), 422

        _insert_record(TABLE_SCANS, {
            "nhs_number": data["nhs_number"],
            "raw_text": extracted_text,
            "scan_type": data.get("scan_type", DEFAULT_SCAN_TYPE),
            "summary_status": "pending"
        })
    except Exception as e:
        print(f"OCR/Database error in /api/scan: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to extract text or save document"}), 500

    return jsonify({"status": "ok", "message": "Scan saved and queued for summary."})


@app.route('/api/process-summaries', methods=['POST'])
def process_pending_summaries():
    try:
        pending_scans = supabase.table(TABLE_SCANS)\
            .select("*")\
            .eq("summary_status", "pending")\
            .execute().data

        if not pending_scans:
            return jsonify({"message": "No pending summaries to process.", "processed_count": 0})

        with cf.ThreadPoolExecutor(max_workers=MAX_SUMMARY_WORKERS) as executor:
            processed_count = sum(executor.map(_process_single_scan, pending_scans))

        return jsonify({
            "status": "ok",
            "message": f"Successfully processed {processed_count} summaries.",
            "processed_count": processed_count
        })

    except Exception as e:
        print(f"Error processing summaries: {e}", file=sys.stderr)
        return jsonify({"error": f"Failed to process summaries: {str(e)}"}), 500


@app.route('/api/event', methods=['POST'])
def log_event():
    data = request.get_json()
    if data is None:
        return jsonify({"error": "Request body required"}), 400
    if not data.get("event_type"):
        return jsonify({"error": "Missing field: event_type"}), 400
    try:
        _insert_record(TABLE_EVENTS, {
            "event_type": data["event_type"],
            "metadata": data.get("metadata"),
        })
    except Exception:
        return jsonify({"error": "Database error"}), 500
    return jsonify({"status": "ok"})


@app.route('/api/messages', methods=['GET'])
def get_messages():
    try:
        scans = supabase.table(TABLE_SCANS).select("*").order("created_at", desc=True).execute().data
    except Exception as e:
        print(f"Supabase error in /api/messages: {e}", file=sys.stderr)
        return jsonify({"error": "Database unavailable"}), 500
    return jsonify({"messages": scans})


# ─── STATIC FILE SERVING ─────────────────────────────────────────────────────

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static = app.static_folder
    if not static or not os.path.isdir(static):
        return jsonify({"error": "Not found"}), 404
    if path and os.path.exists(os.path.join(static, path)):
        return send_from_directory(static, path)
    return send_from_directory(static, 'index.html')


if __name__ == '__main__':
    app.run(debug=True, port=8000)
