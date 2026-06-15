import os
import sys
import json
import base64
import threading
from functools import wraps
from datetime import datetime, timezone
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

_gcp_credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
_gcp_credentials_json = os.environ.get("GCP_CREDENTIALS_JSON")

if _gcp_credentials_json:
    _credentials_info = json.loads(base64.b64decode(_gcp_credentials_json))
elif _gcp_credentials_path:
    with open(_gcp_credentials_path) as f:
        _credentials_info = json.load(f)
else:
    raise RuntimeError("Neither GCP_CREDENTIALS_JSON nor GOOGLE_APPLICATION_CREDENTIALS is set")

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


# ─── SECURITY DECORATOR ──────────────────────────────────────────────────────

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid token"}), 401
            
        token = auth_header.split(' ')[1]
        
        try:
            # Verify the JWT natively with Supabase
            user_response = supabase.auth.get_user(token)
            user = user_response.user
            if not user:
                return jsonify({"error": "Invalid token"}), 401
                
            # Pass the secure user object into the API route
            return f(user, *args, **kwargs)
        except Exception as e:
            print(f"Auth error: {e}", file=sys.stderr)
            return jsonify({"error": "Unauthorized"}), 401
            
    return decorated_function


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

def classify_document(raw_text):
    prompt = f"""You are an AI document classifier for the NHS. 
Read the following text and determine if it is an 'appointment' letter or a 'prescription'/'medication' document.
Reply with EXACTLY the word 'appointment' or 'prescription' and absolutely nothing else.

Raw text:
{raw_text}"""
    response = _gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    result = response.text.strip().lower()
    
    if 'prescription' in result:
        return 'prescription'
    return 'appointment_letter'

def generate_appointment_summary(raw_text):
    prompt = f"""You are a medical assistant extracting information from an NHS letter.
Read the following text and extract the specific appointment details.

You MUST return the exact Markdown template below. Do not change the formatting or remove the bullet points.
If any details are missing, write "Not specified". Extract any instructions about what the patient needs to do or bring.

**Essential Details:**
* **Clinician/Department:** [Insert here]
* **Date:** [Insert here]
* **Time:** [Insert here]
* **Location:** [Insert here]

**Extra Information:**
* **Directions/Map:** [Generate a Google Maps search link using the extracted location, formatted exactly like this: [View on Map](https://www.google.com/maps/search/?api=1&query=Insert+Location+Here)]
* **What to Bring:** [Insert items to bring here]
* **Important Notes:** [Insert any other crucial instructions here]

Raw text:
{raw_text}"""
    response = _gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return response.text

def generate_prescription_summary(raw_text):
    prompt = f"""You are a medical assistant extracting information from an NHS prescription or medication letter.
Read the following text and extract the specific medication details.

You MUST return the exact Markdown template below. Do not change the formatting or remove the bullet points.
If any details are missing, write "Not specified".

**Medication Details:**
* **Medication Name:** [Insert here]
* **Dosage:** [Insert here]
* **Frequency/Instructions:** [Insert here]

**Extra Information:**
* **Prescribing Clinician:** [Insert here]
* **Date:** [Insert here]
* **Important Notes:** [Insert any warnings or extra instructions here]

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
        detected_type = classify_document(raw_text)
        
        if detected_type == "prescription":
            summary = generate_prescription_summary(raw_text)
        else:
            summary = generate_appointment_summary(raw_text)
            
        supabase.table(TABLE_SCANS)\
            .update({
                "scan_type": detected_type.replace('_', ' '),
                "summary_text": summary, 
                "summary_status": "completed"
            })\
            .eq("id", scan_id)\
            .execute()
        return 1
    except Exception:
        return 0


# ─── ROLE VERIFICATION HELPER ────────────────────────────────────────────────
def verify_access_to_patient(auth_user_id, target_nhs):
    """
    Returns True if the auth_user_id is the patient themselves, 
    OR a carer linked to that specific patient.
    """
    # 1. Are they the patient?
    patient_check = supabase.table(TABLE_PATIENTS).select("nhs_number").eq("auth_user_id", auth_user_id).eq("nhs_number", target_nhs).execute().data
    if patient_check:
        return True
        
    # 2. Are they an authorized carer?
    carer_check = supabase.table("carers").select("id").eq("auth_user_id", auth_user_id).execute().data
    if carer_check:
        link_check = supabase.table("carer_patient_links").select("*").eq("carer_id", carer_check[0]["id"]).eq("patient_nhs_number", target_nhs).execute().data
        if link_check:
            return True
            
    return False


# ─── SECURE API ROUTES ───────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})


@app.route('/api/me', methods=['GET'])
@require_auth
def get_me(user):
    try:
        # 1. Check if the user is a Patient
        patient_record = supabase.table(TABLE_PATIENTS).select("*").eq("auth_user_id", user.id).execute().data
        
        if patient_record:
            nhs = patient_record[0]["nhs_number"]
            appointments = supabase.table(TABLE_APPOINTMENTS).select("*").eq("nhs_number", nhs).execute().data
            prescriptions = supabase.table(TABLE_PRESCRIPTIONS).select("*").eq("nhs_number", nhs).execute().data
            
            for p in prescriptions:
                p["repeatsLeft"] = p.pop("repeats_left", 0)
                
            return jsonify({
                "role": "patient",
                "patient_info": {"name": patient_record[0]["name"], "nhs_number": nhs},
                "appointments": appointments,
                "prescriptions": prescriptions,
                "managed_patients": [] 
            })

        # 2. Check if the user is a Carer
        carer_record = supabase.table("carers").select("*").eq("auth_user_id", user.id).execute().data
        
        if carer_record:
            carer_id = carer_record[0]["id"]
            
            # Find all patients this carer is linked to
            links = supabase.table("carer_patient_links").select("patient_nhs_number").eq("carer_id", carer_id).execute().data
            nhs_numbers = [link["patient_nhs_number"] for link in links]
            
            if not nhs_numbers:
                return jsonify({"role": "carer", "carer_info": carer_record[0], "managed_patients": []})
                
            managed_patients = supabase.table(TABLE_PATIENTS).select("*").in_("nhs_number", nhs_numbers).execute().data
            
            return jsonify({
                "role": "carer",
                "carer_info": carer_record[0],
                "managed_patients": managed_patients, 
            })

        return jsonify({"error": "Profile not completed"}), 404

    except Exception as e:
        print(f"Supabase error in /api/me: {e}", file=sys.stderr)
        return jsonify({"error": "Database unavailable"}), 500


@app.route('/api/scan', methods=['POST'])
@require_auth
def log_scan(user):
    data = request.get_json()
    if data is None or "nhs_number" not in data or "image_data" not in data:
        return jsonify({"error": "Missing required fields"}), 400

    target_nhs = data["nhs_number"]

    try:
        # Role verification
        if not verify_access_to_patient(user.id, target_nhs):
            return jsonify({"error": "Unauthorized to upload for this patient"}), 403

        extracted_text = perform_google_ocr(data["image_data"])

        if not extracted_text.strip():
            return jsonify({"error": "No clear text could be scanned from this image."}), 422

        existing = supabase.table(TABLE_SCANS)\
            .select("id")\
            .eq("nhs_number", target_nhs)\
            .eq("raw_text", extracted_text)\
            .execute()

        if existing.data:
            existing_id = existing.data[0]["id"]
            supabase.table(TABLE_SCANS)\
                .update({"created_at": datetime.now(timezone.utc).isoformat()})\
                .eq("id", existing_id)\
                .execute()
            return jsonify({"status": "ok", "message": "Scan already exists; timestamp updated."})

        result = supabase.table(TABLE_SCANS).insert({
            "nhs_number": target_nhs,
            "raw_text": extracted_text,
            "scan_type": data.get("scan_type", DEFAULT_SCAN_TYPE),
            "summary_status": "pending",
            "uploaded_by_auth_id": user.id  # Tracking exactly who uploaded it
        }).execute()
        
        if result.data:
            threading.Thread(target=_process_single_scan, args=(result.data[0],), daemon=True).start()
            
    except Exception as e:
        print(f"OCR/Database error in /api/scan: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to extract text or save document"}), 500

    return jsonify({"status": "ok", "message": "Scan saved and queued for summary."})


@app.route('/api/process-summaries', methods=['POST'])
@require_auth
def process_pending_summaries(user):
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
@require_auth
def log_event(user):
    data = request.get_json()
    if data is None or not data.get("event_type"):
        return jsonify({"error": "Missing field: event_type"}), 400
    try:
        _insert_record(TABLE_EVENTS, {
            "event_type": data["event_type"],
            "metadata": data.get("metadata"),
            "auth_user_id": user.id
        })
    except Exception:
        return jsonify({"error": "Database error"}), 500
    return jsonify({"status": "ok"})


@app.route('/api/messages', methods=['GET'])
@require_auth
def get_messages(user):
    target_nhs = request.args.get("nhs_number")
    
    try:
        if not target_nhs:
            # Assume a patient is asking for their own records
            patients = supabase.table(TABLE_PATIENTS).select("nhs_number").eq("auth_user_id", user.id).limit(1).execute().data
            if not patients:
                return jsonify({"messages": []})
            target_nhs = patients[0]["nhs_number"]
            
        # Role verification
        if not verify_access_to_patient(user.id, target_nhs):
            return jsonify({"error": "Unauthorized"}), 403
            
        scans = supabase.table(TABLE_SCANS).select("*").eq("nhs_number", target_nhs).order("created_at", desc=True).execute().data
        return jsonify({"messages": scans})
        
    except Exception as e:
        print(f"Supabase error in /api/messages: {e}", file=sys.stderr)
        return jsonify({"error": "Database unavailable"}), 500


@app.route('/api/messages/<msg_id>', methods=['DELETE'])
@require_auth
def delete_message(user, msg_id):
    try:
        # First find the message to see who it belongs to
        msg = supabase.table(TABLE_SCANS).select("nhs_number").eq("id", msg_id).execute().data
        if not msg:
            return jsonify({"error": "Message not found"}), 404
            
        target_nhs = msg[0]["nhs_number"]
        
        # Verify the user has rights to manage this patient's records
        if not verify_access_to_patient(user.id, target_nhs):
            return jsonify({"error": "Unauthorized"}), 403
        
        # Delete the scan
        supabase.table(TABLE_SCANS).delete().eq("id", msg_id).execute()
        return jsonify({"status": "ok", "message": "Deleted successfully"})
        
    except Exception as e:
        print(f"Supabase error in /api/messages/<id>: {e}", file=sys.stderr)
        return jsonify({"error": "Database unavailable"}), 500

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