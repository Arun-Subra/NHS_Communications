import os
import sys
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from supabase import create_client

load_dotenv()

TABLE_SCANS = "document_scans"
TABLE_EVENTS = "button_events"
TABLE_PATIENTS = "patients"
TABLE_APPOINTMENTS = "appointments"
TABLE_PRESCRIPTIONS = "prescriptions"
DEFAULT_SCAN_TYPE = "appointment_letter"

app = Flask(__name__, static_folder="../dist", static_url_path="/")
CORS(app, origins=["http://localhost:3000", "http://localhost:5173"])

supabase = create_client(os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_KEY"])


def _insert_record(table, payload):
    supabase.table(table).insert(payload).execute()


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
    missing = {"nhs_number", "raw_text"} - data.keys()
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
    try:
        _insert_record(TABLE_SCANS, {
            "nhs_number": data["nhs_number"],
            "raw_text": data["raw_text"],
            "scan_type": data.get("scan_type", DEFAULT_SCAN_TYPE),
        })
    except Exception:
        return jsonify({"error": "Database error"}), 500
    return jsonify({"status": "ok"})


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
    # Tsuru ignores this block and uses Gunicorn via the Procfile,
    # but it's kept here for local development.
    app.run(debug=True, port=8000)
