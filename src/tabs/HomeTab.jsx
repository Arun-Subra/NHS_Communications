import { useCallback, useMemo, useState } from 'react';
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

  quickActions: {
    display: 'flex',
    gap: '10px',
    marginBottom: '24px',
  },
  actionCard: {
    flex: 1,
    backgroundColor: C.white,
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    border: `1px solid ${C.divider || '#eee'}`,
  },
  actionIcon: { fontSize: '24px', marginBottom: '4px' },
  actionText: { margin: 0, fontSize: '13px', fontWeight: '600', color: C.primary },

  itemTitle: { fontSize: '16px', fontWeight: '600', color: C.textDark, margin: 0 },
  itemDetail: { fontSize: '14px', color: C.textMid, margin: '3px 0' },

  badgeGreen: {
    backgroundColor: C.badgeGreenBg || '#E8F5E9',
    color: C.green || '#2E7D32',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  badgeGray: {
    backgroundColor: C.badgeGrayBg || '#F5F5F5',
    color: C.textMid,
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },

  btnSecondary: {
    ...sharedStyles.btnBase,
    backgroundColor: 'transparent',
    color: C.primary,
    border: `1px solid ${C.primary}`,
    marginTop: '10px',
    padding: '8px',
  },
};

function formatICSUTC(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeICS(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function parseAppointmentDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const safeTime = timeStr || '09:00';
  const parsed = new Date(`${dateStr} ${safeTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function HomeTab({
  patient,
  appointments = [],
  prescriptions = [],
  logEvent,
  onNavigate,
}) {
  const [requestingId, setRequestingId] = useState(null);
  const [completedRequests, setCompletedRequests] = useState(() => new Set());

  const safeAppointments = useMemo(
    () => (Array.isArray(appointments) ? appointments : []),
    [appointments]
  );
  const safePrescriptions = useMemo(
    () => (Array.isArray(prescriptions) ? prescriptions : []),
    [prescriptions]
  );

  const handleRepeatRequest = useCallback(
    async (med) => {
      if (!med?.id) return;
      if (requestingId === med.id) return; // prevent double click race

      setRequestingId(med.id);
      try {
        if (typeof logEvent === 'function') {
          await logEvent('request_repeat_supply', {
            medication: med.name,
            dosage: med.dosage,
          });
        }

        // Optional UX delay so "Sending..." is visible
        await new Promise(resolve => setTimeout(resolve, 600));

        setCompletedRequests(prev => {
          const next = new Set(prev);
          next.add(med.id);
          return next;
        });
      } catch (err) {
        console.error('Failed to request repeat', err);
        alert('Failed to send request. Please try again.');
      } finally {
        setRequestingId(null);
      }
    },
    [logEvent, requestingId]
  );

  const handleAddToCalendar = useCallback((app) => {
    const parsedStart = parseAppointmentDate(app?.date, app?.time);
    const startDate = parsedStart ?? new Date();
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const clinic = app?.clinic || 'NHS Appointment';
    const doctor = app?.doctor || 'Not specified';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NHS App//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatICSUTC(startDate)}`,
      `DTEND:${formatICSUTC(endDate)}`,
      `SUMMARY:${escapeICS(`NHS Appt: ${clinic}`)}`,
      `LOCATION:${escapeICS(doctor)}`,
      `DESCRIPTION:${escapeICS(`Upcoming appointment with ${doctor} at ${clinic}.`)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `nhs-appt-${app?.id ?? 'appointment'}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div style={s.container}>
      <div style={s.banner}>
        <p style={s.bannerName}>Welcome back, {patient?.name || 'Patient'}</p>
        <p style={s.bannerNhs}>NHS Number: {patient?.nhs_number || 'Not available'}</p>
      </div>

      <div style={s.quickActions}>
        <div style={s.actionCard} onClick={() => onNavigate?.('photo')}>
          <div style={s.actionIcon}>📷</div>
          <p style={s.actionText}>Scan Letter</p>
        </div>
        <div style={s.actionCard} onClick={() => onNavigate?.('messages')}>
          <div style={s.actionIcon}>✉️</div>
          <p style={s.actionText}>View Summaries</p>
        </div>
      </div>

      <p style={s.sectionTitle}>Appointments</p>
      <div style={s.list}>
        {safeAppointments.length === 0 ? (
          <p style={{ color: C.textMid, fontSize: '14px' }}>No upcoming appointments.</p>
        ) : (
          safeAppointments.map(app => (
            <div key={app.id} style={s.item}>
              <div style={s.itemHeader}>
                <strong style={s.itemTitle}>{app.clinic}</strong>
                <span style={app.status === 'Upcoming' ? s.badgeGreen : s.badgeGray}>
                  {app.status}
                </span>
              </div>
              <p style={s.itemDetail}>
                <strong>Clinician:</strong> {app.doctor}
              </p>
              <p style={s.itemDetail}>
                <strong>When:</strong> {app.date} at {app.time}
              </p>

              {app.status === 'Upcoming' && (
                <button style={s.btnSecondary} onClick={() => handleAddToCalendar(app)}>
                  📅 Add to Calendar
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <p style={s.sectionTitle}>Prescriptions</p>
      <div style={s.list}>
        {safePrescriptions.map(med => {
          const isRequested = completedRequests.has(med.id);
          const isLoading = requestingId === med.id;

          let btnBg = C.primary;
          let btnText = 'Request Repeat Supply';
          let btnDisabled = false;

          if ((med.repeatsLeft ?? 0) === 0) {
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
                <strong style={s.itemTitle}>
                  {med.name} ({med.dosage})
                </strong>
                <span style={s.badgeGreen}>{med.status}</span>
              </div>

              <p style={s.itemDetail}>
                <strong>Instructions:</strong> {med.frequency}
              </p>
              <p style={s.itemDetail}>
                <strong>Repeats remaining:</strong> {med.repeatsLeft}
              </p>

              <button
                style={{
                  ...s.btnBase,
                  backgroundColor: btnBg,
                  color: btnBg === C.border ? C.textMid : C.white,
                  cursor: btnDisabled ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s ease',
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