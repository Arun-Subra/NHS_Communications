import { useState } from 'react';
import { C, sharedStyles } from '../styles/shared.js';

const s = {
  ...sharedStyles,
  list: { ...sharedStyles.list, marginBottom: '24px' },
  itemHeader: { ...sharedStyles.itemHeader, alignItems: 'flex-start' },
  banner: {
    backgroundColor: C.white,
    padding: '18px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    borderBottom: `4px solid ${C.primary}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  bannerName: { margin: '0 0 4px', fontSize: '20px', fontWeight: '600', color: C.textDark },
  bannerNhs: { margin: 0, fontSize: '14px', color: C.textMid },
  
  // --- NEW: Quick Actions Styles ---
  quickActions: {
    display: 'flex', gap: '10px', marginBottom: '24px'
  },
  actionCard: {
    flex: 1, backgroundColor: C.white, padding: '12px', borderRadius: '8px',
    textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer',
    border: `1px solid ${C.divider || '#eee'}`
  },
  actionIcon: { fontSize: '24px', marginBottom: '4px' },
  actionText: { margin: 0, fontSize: '13px', fontWeight: '600', color: C.primary },
  // --------------------------------

  itemTitle: { fontSize: '16px', fontWeight: '600', color: C.textDark, margin: 0 },
  itemDetail: { fontSize: '14px', color: C.textMid, margin: '3px 0' },
  badgeGreen: { backgroundColor: C.badgeGreenBg || '#E8F5E9', color: C.green || '#2E7D32', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  badgeGray: { backgroundColor: C.badgeGrayBg || '#F5F5F5', color: C.textMid, padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  
  // --- NEW: Secondary Button Style for Calendar ---
  btnSecondary: {
    ...sharedStyles.btnBase,
    backgroundColor: 'transparent',
    color: C.primary,
    border: `1px solid ${C.primary}`,
    marginTop: '10px',
    padding: '8px',
  }
};

export default function HomeTab({ patient, appointments, prescriptions, logEvent, onNavigate }) {
  // --- NEW: State to track prescription requests ---
  const [requestingId, setRequestingId] = useState(null);
  const [completedRequests, setCompletedRequests] = useState(new Set());

  const handleRepeatRequest = async (med) => {
    setRequestingId(med.id);
    try {
      await logEvent('request_repeat_supply', { medication: med.name, dosage: med.dosage });
      // Simulate a brief network delay so the user sees the loading state
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mark as completed
      setCompletedRequests(prev => new Set(prev).add(med.id));
    } catch (err) {
      console.error("Failed to request repeat", err);
      alert("Failed to send request. Please try again.");
    } finally {
      setRequestingId(null);
    }
  };

  // --- NEW: Calendar Generator for Appointments ---
  const handleAddToCalendar = (app) => {
    // Basic date parsing (assuming app.date is something like "14 Jun 2026")
    const startDate = new Date(`${app.date} ${app.time || '09:00'}`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later

    const formatICS = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${formatICS(startDate)}`,
      `DTEND:${formatICS(endDate)}`,
      `SUMMARY:NHS Appt: ${app.clinic}`,
      `LOCATION:${app.doctor}`,
      `DESCRIPTION:Upcoming appointment with ${app.doctor} at ${app.clinic}.`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nhs-appt-${app.id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={s.container}>
      <div style={s.banner}>
        <p style={s.bannerName}>Welcome back, {patient?.name}</p>
        <p style={s.bannerNhs}>NHS Number: {patient?.nhs_number}</p>
      </div>

      {/* --- NEW: Quick Actions --- */}
      <div style={s.quickActions}>
        <div style={s.actionCard} onClick={() => onNavigate && onNavigate('camera')}>
          <div style={s.actionIcon}>📷</div>
          <p style={s.actionText}>Scan Letter</p>
        </div>
        <div style={s.actionCard} onClick={() => onNavigate && onNavigate('messages')}>
          <div style={s.actionIcon}>✉️</div>
          <p style={s.actionText}>View Summaries</p>
        </div>
      </div>

      <p style={s.sectionTitle}>Appointments</p>
      <div style={s.list}>
        {appointments.length === 0 ? (
          <p style={{ color: C.textMid, fontSize: '14px' }}>No upcoming appointments.</p>
        ) : (
          appointments.map(app => (
            <div key={app.id} style={s.item}>
              <div style={s.itemHeader}>
                <strong style={s.itemTitle}>{app.clinic}</strong>
                <span style={app.status === 'Upcoming' ? s.badgeGreen : s.badgeGray}>{app.status}</span>
              </div>
              <p style={s.itemDetail}><strong>Clinician:</strong> {app.doctor}</p>
              <p style={s.itemDetail}><strong>When:</strong> {app.date} at {app.time}</p>
              
              {/* --- NEW: Calendar Button --- */}
              {app.status === 'Upcoming' && (
                <button 
                  style={s.btnSecondary}
                  onClick={() => handleAddToCalendar(app)}
                >
                  📅 Add to Calendar
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <p style={s.sectionTitle}>Prescriptions</p>
      <div style={s.list}>
        {prescriptions.map(med => {
          const isRequested = completedRequests.has(med.id);
          const isLoading = requestingId === med.id;
          
          // Determine button appearance based on state
          let btnBg = C.primary;
          let btnText = 'Request Repeat Supply';
          let btnDisabled = false;

          if (med.repeatsLeft === 0) {
            btnBg = C.border;
            btnText = 'Refills Unavailable';
            btnDisabled = true;
          } else if (isRequested) {
            btnBg = C.green || '#2E7D32';
            btnText = '✓ Request Sent';
            btnDisabled = true;
          } else if (isLoading) {
            btnBg = C.textMid;
            btnText = 'Sending...';
            btnDisabled = true;
          }

          return (
            <div key={med.id} style={s.item}>
              <div style={s.itemHeader}>
                <strong style={s.itemTitle}>{med.name} ({med.dosage})</strong>
                <span style={s.badgeGreen}>{med.status}</span>
              </div>
              <p style={s.itemDetail}><strong>Instructions:</strong> {med.frequency}</p>
              <p style={s.itemDetail}><strong>Repeats remaining:</strong> {med.repeatsLeft}</p>
              
              <button
                style={{
                  ...s.btnBase,
                  backgroundColor: btnBg,
                  color: btnBg === C.border ? C.textMid : C.white,
                  cursor: btnDisabled ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.3s ease'
                }}
                disabled={btnDisabled}
                onClick={() => handleRepeatRequest(med)}
              >
                {btnText}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}