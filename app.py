import os
from dotenv import load_dotenv
# Added send_from_directory to serve the React files
from flask import Flask, jsonify, request, send_from_directory 
from flask_cors import CORS
from supabase import create_client

load_dotenv()

# Updated: Tell Flask where to look for the compiled React frontend
app = Flask(__name__, static_folder="dist", static_url_path="/")
CORS(app)

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

DATABASE = {
    "patient_info": {
        "name": "Alex",
        "nhs_number": "485 772 2910"
    },
    "appointments": [
        { "id": 1, "clinic": "GP Consultation", "doctor": "Dr. Sara Jenkins", "date": "Oct 12, 2026", "time": "10:30 AM", "status": "Upcoming" },
        { "id": 2, "clinic": "Cardiology Follow-up", "doctor": "Dr. Alan Turing", "date": "Nov 05, 2026", "time": "2:15 PM", "status": "Upcoming" },
        { "id": 3, "clinic": "Routine Blood Test", "doctor": "Nurse Practitioner Team", "date": "Sep 14, 2025", "time": "09:00 AM", "status": "Completed" }
    ],
    "prescriptions": [
        { "id": 1, "name": "Amoxicillin", "dosage": "500mg", "frequency": "Three times a day", "repeatsLeft": 0, "status": "Active" },
        { "id": 2, "name": "Atorvastatin", "dosage": "20mg", "frequency": "Once daily (evening)", "repeatsLeft": 5, "status": "Active" },
        { "id": 3, "name": "Paracetamol", "dosage": "500mg", "frequency": "As needed (Max 8/day)", "repeatsLeft": 2, "status": "As Required" }
    ]
}

@app.route('/api/patient', methods=['GET'])
def get_patient():
    return jsonify(DATABASE["patient_info"])

@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    return jsonify(DATABASE["appointments"])

@app.route('/api/prescriptions', methods=['GET'])
def get_prescriptions():
    return jsonify(DATABASE["prescriptions"])

@app.route('/api/scan', methods=['POST'])
def log_scan():
    data = request.get_json()
    supabase.table("document_scans").insert({
        "nhs_number": data.get("nhs_number"),
        "raw_text": data.get("raw_text"),
        "scan_type": data.get("scan_type", "appointment_letter")
    }).execute()
    return jsonify({"status": "ok"})

@app.route('/api/event', methods=['POST'])
def log_event():
    data = request.get_json()
    supabase.table("button_events").insert({
        "event_type": data.get("event_type"),
        "metadata": data.get("metadata")
    }).execute()
    return jsonify({"status": "ok"})

# --- NEW: The Catch-All Route for the React Frontend ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # If the user asks for a specific file (like CSS or JS) and it exists, serve it
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    # Otherwise, give them the React index.html and let React handle the routing
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # Tsuru will actually ignore this block and use Gunicorn via the Procfile, 
    # but we can leave this here so you can still run it locally!
    app.run(debug=True, port=5000)