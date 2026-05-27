from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS to allow your React frontend to request data from this API
CORS(app)

# Skeleton Database: In-memory dictionary representing one patient
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

# --- API ENDPOINTS ---

@app.route('/api/patient', methods=['GET'])
def get_patient():
    return jsonify(DATABASE["patient_info"])

@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    return jsonify(DATABASE["appointments"])

@app.route('/api/prescriptions', methods=['GET'])
def get_prescriptions():
    return jsonify(DATABASE["prescriptions"])

if __name__ == '__main__':
    # Runs the server on http://127.0.0.1:5000
    app.run(debug=True, port=5000)