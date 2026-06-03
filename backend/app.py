import os
import sys
import base64
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from supabase import create_client

# Google Cloud Imports
from google.cloud import vision
import vertexai
from vertexai.generative_models import GenerativeModel

# ─── CONFIGURATION & INITIALIZATION ──────────────────────────────────────────

load_dotenv()

TABLE_SCANS = "document_scans"
TABLE_EVENTS = "button_events"
TABLE_PATIENTS = "patients"
TABLE_APPOINTMENTS = "appointments"
TABLE_PRESCRIPTIONS = "prescriptions"
DEFAULT_SCAN_TYPE = "appointment_letter"

app = Flask(__name__, static_folder="../dist", static_url_path="/")
CORS(app, origins=["http://localhost:3000", "http://localhost:5173"])

# Supabase Setup
_supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
if "/rest/" in _supabase_url:
    _supabase_url = _supabase_url[:_supabase_url.index("/rest/")]
supabase = create_client(_supabase_url, os.environ["SUPABASE_KEY"])

# Vertex AI Setup (Safe Enterprise Summarization)
vertexai.init(
    project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
    location=os.environ.get("GOOGLE_CLOUD_LOCATION", "europe-west2"),
)

# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

def _insert_record(table, payload):
    supabase.table(table).insert(payload).execute()

def perform_google_ocr(image_base64):
    """
    Decodes a base64 image and extracts text using Google Cloud Vision API.
    """
    # Strip away frontend data URL prefixes if present
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
        
    image_bytes = base64.b64decode(image_base64)
    
    # Authenticates automatically via GOOGLE_APPLICATION_CREDENTIALS env var
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)
    
    response = client.document_text_detection(image=image)
    
    if response.error.message:
        raise Exception(f"Google Vision Error: {response.error.message}")
        
    annotation = response.full_text_annotation
    return annotation.text if annotation else ""

def generate_appointment_summary(raw_text):
    """
    Passes the raw OCR text to Gemini via Vertex AI for secure extraction.
    """
    model = GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""
    You are a medical assistant extracting information from an NHS letter.
    Read the following text and summarize the specific appointment details. 
    Return the information clearly formatted with:
    - Clinician/Department
    - Date
    - Time
    - Location
    
    If any of these details are missing, write "Not specified".
    
    Raw text:
    {raw_text}
    """
    
    response = model.generate_content(prompt)
    return response.text

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
    """
    Receives base64 image from frontend, runs OCR, and saves raw text to DB.
    """
    data = request.get_json()
    if data is None:
        return jsonify({"error": "Request body required"}), 400
        
    missing = {"nhs_number", "image_data"} - data.keys()
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
        
    try:
        # 1. Extract text from the image
        extracted_text = perform_google_ocr(data["image_data"])
        
        if not extracted_text.strip():
            return jsonify({"error": "No clear text could be scanned from this image."}), 422

        # 2. Save to Supabase and flag it for summarization
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
    """
    Finds pending scans, processes them securely via Vertex AI, and updates DB.
    """
    try:
        pending_scans = supabase.table(TABLE_SCANS)\
            .select("*")\
            .eq("summary_status", "pending")\
            .execute().data 
            
        if not pending_scans:
            return jsonify({"message": "No pending summaries to process.", "processed_count": 0})
            
        processed_count = 0
        
        for scan in pending_scans:
            raw_text = scan.get("raw_text")
            scan_id = scan.get("id")
            
            if not raw_text:
                continue
                
            # Call Vertex AI to summarize the text securely
            summary = generate_appointment_summary(raw_text)
            
            # Update the database record
            supabase.table(TABLE_SCANS)\
                .update({
                    "summary_text": summary,
                    "summary_status": "completed"
                })\
                .eq("id", scan_id)\
                .execute()
                
            processed_count += 1
            
        return jsonify({
            "status": "ok", 
            "message": f"Successfully processed {processed_count} summaries.",
            "processed_count": processed_count
        })
        
    except Exception as e:
        print(f"Error processing summaries: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to process summaries"}), 500


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
    scans = supabase.table(TABLE_SCANS).select("*").order("created_at", desc=True).execute().data
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