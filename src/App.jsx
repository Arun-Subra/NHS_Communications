import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:5000'
  : 'https://YOUR_BACKEND_URL.onrender.com';

const PLACEHOLDER_SCAN_TEXT = `Your appointment is a
- blood test
Taking place on
- 13/12/2005
- Saturday 13th December 2025
At time
- 12:05pm.`;

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState(null);

  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    const fetchNHSData = async () => {
      try {
        const [patientRes, apptRes, presRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/patient`),
          fetch(`${API_BASE_URL}/api/appointments`),
          fetch(`${API_BASE_URL}/api/prescriptions`)
        ]);

        setPatient(await patientRes.json());
        setAppointments(await apptRes.json());
        setPrescriptions(await presRes.json());
      } catch (error) {
        console.error("Error connecting to Flask API:", error);
        alert("Failed to fetch data. Is your Flask server running?");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNHSData();
  }, []);

  const logEvent = (eventType, metadata = null) =>
    fetch(`${API_BASE_URL}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, metadata })
    }).catch(err => console.error('Event log failed:', err));

  const handleScanClick = async () => {
    setIsScanning(true);
    try {
      await fetch(`${API_BASE_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nhs_number: patient?.nhs_number,
          raw_text: PLACEHOLDER_SCAN_TEXT,
          scan_type: 'appointment_letter'
        })
      });
      alert("Document scanned successfully! (Uploaded to patient file)");
    } catch (err) {
      console.error('Scan upload failed:', err);
      alert("Scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleViewAppointments = async () => {
    await logEvent('view_appointments');
    setCurrentView('appointments');
  };

  const handleViewPrescriptions = async () => {
    await logEvent('view_prescriptions');
    setCurrentView('prescriptions');
  };

  const handleBackToDashboard = async () => {
    await logEvent('back_to_dashboard', { from: currentView });
    setCurrentView('dashboard');
  };

  const handleRepeatRequest = async (med) => {
    await logEvent('request_repeat_supply', { medication: med.name, dosage: med.dosage });
    alert(`Repeat request submitted for ${med.name}`);
  };

  if (isLoading) {
    return (
      <div style={{ ...styles.appContainer, justifyContent: 'center', alignItems: 'center' }}>
        <h2 style={{ color: '#005EB8' }}>Connecting to NHS Database...</h2>
      </div>
    );
  }

  const getCardStyle = (cardName) => ({
    ...styles.card,
    borderTop: hoveredCard === cardName ? '5px solid #007F3B' : '5px solid transparent',
    transform: hoveredCard === cardName ? 'translateY(-2px)' : 'translateY(0)',
    boxShadow: hoveredCard === cardName ? '0 6px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)'
  });

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
          <button style={styles.backButton} onClick={handleBackToDashboard}>
            ← Back to Dashboard
          </button>
        )}

        {currentView === 'dashboard' && (
          <div>
            <div style={styles.welcomeBanner}>
              <h2>Welcome back, {patient?.name}</h2>
              <p>NHS Number: {patient?.nhs_number}</p>
            </div>

            <div style={styles.gridContainer}>
              <button
                style={getCardStyle('scan')}
                onMouseEnter={() => setHoveredCard('scan')}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={handleScanClick}
                disabled={isScanning}
              >
                <span style={styles.cardIcon}>📷</span>
                <span style={styles.iconLabel}>Scan Document</span>
                <h3 style={styles.cardHeading}>{isScanning ? "Scanning Document..." : "Scan Documents"}</h3>
                <p style={styles.cardText}>Upload letters, test results, or IDs directly to your record.</p>
              </button>

              <button
                style={getCardStyle('appointments')}
                onMouseEnter={() => setHoveredCard('appointments')}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={handleViewAppointments}
              >
                <span style={styles.cardIcon}>📅</span>
                <span style={styles.iconLabel}>View Appointments</span>
                <h3 style={styles.cardHeading}>View Appointments</h3>
                <p style={styles.cardText}>Check timings, locations, and manage upcoming medical visits.</p>
              </button>

              <button
                style={getCardStyle('prescriptions')}
                onMouseEnter={() => setHoveredCard('prescriptions')}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={handleViewPrescriptions}
              >
                <span style={styles.cardIcon}>💊</span>
                <span style={styles.iconLabel}>View Prescriptions</span>
                <h3 style={styles.cardHeading}>View Prescriptions</h3>
                <p style={styles.cardText}>Track your current medications and request repeat supplies.</p>
              </button>
            </div>
          </div>
        )}

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
                    onClick={() => handleRepeatRequest(med)}
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
        <p>DRP15 WebApp Prototype. Fetching live from Flask API.</p>
      </footer>
    </div>
  );
}

const styles = {
  appContainer: { fontFamily: '"Helvetica Neue", Arial, sans-serif', color: '#212B32', backgroundColor: '#F0F4F5', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: { backgroundColor: '#005EB8', color: '#FFFFFF', padding: '15px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  headerContent: { maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '15px' },
  nhsLogo: { backgroundColor: '#FFFFFF', color: '#005EB8', fontWeight: 'bold', fontSize: '22px', padding: '2px 10px', borderRadius: '2px' },
  appTitle: { fontSize: '20px', margin: 0, fontWeight: '400' },
  mainContent: { maxWidth: '1000px', width: '100%', margin: '30px auto', padding: '0 20px', flex: 1, boxSizing: 'border-box' },
  welcomeBanner: { backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '4px', marginBottom: '25px', borderBottom: '4px solid #005EB8', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' },
  card: {
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E8EDF2',
    borderLeft: '1px solid #E8EDF2',
    borderRight: '1px solid #E8EDF2',
    borderRadius: '8px',
    padding: '30px 20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center'
  },
  cardIcon: { fontSize: '44px', display: 'block', marginBottom: '4px' },
  iconLabel: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#005EB8', fontWeight: 'bold', marginBottom: '16px' },
  cardHeading: { margin: '0 0 8px 0', fontSize: '20px', color: '#212B32' },
  cardText: { margin: 0, fontSize: '14px', color: '#4C5862', lineHeight: '1.4' },
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
