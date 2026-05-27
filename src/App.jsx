import { useEffect, useState } from 'react';

export default function App() {
  // Navigation & UI State
  const [currentView, setCurrentView] = useState('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data State (Starts empty, gets filled by Flask)
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  // Fetch data from Flask API when the component loads
  useEffect(() => {
    const fetchNHSData = async () => {
      try {
        // Fetch all three endpoints simultaneously
        const [patientRes, apptRes, presRes] = await Promise.all([
          fetch('http://127.0.0.1:5000/api/patient'),
          fetch('http://127.0.0.1:5000/api/appointments'),
          fetch('http://127.0.0.1:5000/api/prescriptions')
        ]);

        // Convert responses to JSON
        const patientData = await patientRes.json();
        const apptData = await apptRes.json();
        const presData = await presRes.json();

        // Update React state with the new database data
        setPatient(patientData);
        setAppointments(apptData);
        setPrescriptions(presData);
      } catch (error) {
        console.error("Error connecting to Flask API:", error);
        alert("Failed to fetch data. Is your Flask server running?");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNHSData();
  }, []);

  const handleScanClick = () => {
    setIsScanning(true);
    setTimeout(() => {
      alert("Document scanned successfully! (Mock data uploaded to patient file)");
      setIsScanning(false);
    }, 2000);
  };

  // Show a loading screen while waiting for the Flask API
  if (isLoading) {
    return (
      <div style={{ ...styles.appContainer, justifyContent: 'center', alignItems: 'center' }}>
        <h2 style={{ color: '#005EB8' }}>Connecting to NHS Database...</h2>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.nhsLogo}>NHS</div>
          <h1 style={styles.appTitle}>MyHealth Tracker</h1>
        </div>
      </header>

      <main style={styles.mainContent}>
        {currentView !== 'dashboard' && (
          <button style={styles.backButton} onClick={() => setCurrentView('dashboard')}>
            ← Back to Dashboard
          </button>
        )}

        {/* --- VIEW 1: DASHBOARD --- */}
        {currentView === 'dashboard' && (
          <div>
            <div style={styles.welcomeBanner}>
              <h2>Welcome back, {patient?.name}</h2>
              <p>NHS Number: {patient?.nhs_number}</p>
            </div>

            <div style={styles.gridContainer}>
              <button
                style={{ ...styles.card, ...styles.scanCard }}
                onClick={handleScanClick}
                disabled={isScanning}
              >
                <span style={styles.cardIcon}>📷</span>
                <h3>{isScanning ? "Scanning Document..." : "Scan Documents"}</h3>
                <p>Upload letters, test results, or IDs directly to your record.</p>
              </button>

              <button style={styles.card} onClick={() => setCurrentView('appointments')}>
                <span style={styles.cardIcon}>📅</span>
                <h3>View Appointments</h3>
                <p>Check timings, locations, and manage upcoming medical visits.</p>
              </button>

              <button style={styles.card} onClick={() => setCurrentView('prescriptions')}>
                <span style={styles.cardIcon}>💊</span>
                <h3>View Prescriptions</h3>
                <p>Track your current medications and request repeat supplies.</p>
              </button>
            </div>
          </div>
        )}

        {/* --- VIEW 2: APPOINTMENTS PAGE --- */}
        {currentView === 'appointments' && (
          <div>
            <h2 style={styles.sectionTitle}>Your NHS Appointments</h2>
            <div style={styles.listContainer}>
              {appointments.map(app => (
                <div key={app.id} style={styles.listItem}>
                  <div style={styles.listHeader}>
                    <strong style={styles.itemTitle}>{app.clinic}</strong>
                    <span style={app.status === 'Upcoming' ? styles.badgeActive : styles.badgeInactive}>
                      {app.status}
                    </span>
                  </div>
                  <p style={styles.itemDetail}><strong>Clinician:</strong> {app.doctor}</p>
                  <p style={styles.itemDetail}><strong>When:</strong> {app.date} at {app.time}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- VIEW 3: PRESCRIPTIONS PAGE --- */}
        {currentView === 'prescriptions' && (
          <div>
            <h2 style={styles.sectionTitle}>Current Prescriptions</h2>
            <div style={styles.listContainer}>
              {prescriptions.map(med => (
                <div key={med.id} style={styles.listItem}>
                  <div style={styles.listHeader}>
                    <strong style={styles.itemTitle}>{med.name} ({med.dosage})</strong>
                    <span style={styles.badgeActive}>{med.status}</span>
                  </div>
                  <p style={styles.itemDetail}><strong>Instructions:</strong> {med.frequency}</p>
                  <p style={styles.itemDetail}><strong>Repeat Refills Remaining:</strong> {med.repeatsLeft}</p>
                  <button
                    style={styles.actionButton}
                    disabled={med.repeatsLeft === 0}
                    onClick={() => alert(`Repeat request submitted for ${med.name}`)}
                  >
                    {med.repeatsLeft > 0 ? "Request Repeat Supply" : "Refills Unavailable"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <p>© 2026 NHS Digital Prototype. Fetching live from Flask API.</p>
      </footer>
    </div>
  );
}

// Keeping the exact same styling object as before
const styles = {
  appContainer: { fontFamily: '"Helvetica Neue", Arial, sans-serif', color: '#212B32', backgroundColor: '#F0F4F5', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: { backgroundColor: '#005EB8', color: '#FFFFFF', padding: '15px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  headerContent: { maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '15px' },
  nhsLogo: { backgroundColor: '#FFFFFF', color: '#005EB8', fontWeight: 'bold', fontSize: '22px', padding: '2px 10px', borderRadius: '2px' },
  appTitle: { fontSize: '20px', margin: 0, fontWeight: '400' },
  mainContent: { maxWidth: '1000px', width: '100%', margin: '30px auto', padding: '0 20px', flex: 1, boxSizing: 'border-box' },
  welcomeBanner: { backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '4px', marginBottom: '25px', borderBottom: '4px solid #005EB8', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' },
  card: { backgroundColor: '#FFFFFF', border: '1px solid #E8EDF2', borderRadius: '4px', padding: '25px', textAlign: 'left', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  scanCard: { borderLeft: '5px solid #007F3B' },
  cardIcon: { fontSize: '32px', display: 'block', marginBottom: '10px' },
  backButton: { background: 'none', border: 'none', color: '#005EB8', cursor: 'pointer', fontSize: '16px', marginBottom: '20px', padding: 0, textDecoration: 'underline' },
  sectionTitle: { color: '#005EB8', borderBottom: '2px solid #D8DDE0', paddingBottom: '10px', marginBottom: '20px' },
  listContainer: { display: 'flex', flexDirection: 'column', gap: '15px' },
  listItem: { backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: '4px solid #005EB8' },
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  itemTitle: { fontSize: '18px', color: '#212B32' },
  itemDetail: { margin: '5px 0', color: '#4C5862' },
  badgeActive: { backgroundColor: '#E6F3EB', color: '#007F3B', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
  badgeInactive: { backgroundColor: '#F0F4F5', color: '#4C5862', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
  actionButton: { marginTop: '12px', backgroundColor: '#005EB8', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  footer: { textAlign: 'center', padding: '20px', backgroundColor: '#E8EDF2', fontSize: '14px', color: '#4C5862', marginTop: 'auto' }
};