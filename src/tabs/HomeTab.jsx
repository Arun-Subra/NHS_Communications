import { C, sharedStyles } from '../styles/shared.js';

const s = {
  ...sharedStyles,
  list: { ...sharedStyles.list, marginBottom: '24px' },
  itemHeader: { ...sharedStyles.itemHeader, alignItems: 'flex-start' },
  banner: {
    backgroundColor: C.white,
    padding: '18px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    borderBottom: `4px solid ${C.primary}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  bannerName: { margin: '0 0 4px', fontSize: '20px', fontWeight: '600', color: C.textDark },
  bannerNhs: { margin: 0, fontSize: '14px', color: C.textMid },
  itemTitle: { fontSize: '16px', fontWeight: '600', color: C.textDark, margin: 0 },
  itemDetail: { fontSize: '14px', color: C.textMid, margin: '3px 0' },
  badgeGreen: { backgroundColor: C.badgeGreenBg, color: C.green, padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  badgeGray: { backgroundColor: C.badgeGrayBg, color: C.textMid, padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
};

export default function HomeTab({ patient, appointments, prescriptions, logEvent }) {
  const handleRepeatRequest = async (med) => {
    await logEvent('request_repeat_supply', { medication: med.name, dosage: med.dosage });
  };

  return (
    <div style={s.container}>
      <div style={s.banner}>
        <p style={s.bannerName}>Welcome back, {patient?.name}</p>
        <p style={s.bannerNhs}>NHS Number: {patient?.nhs_number}</p>
      </div>

      <p style={s.sectionTitle}>Appointments</p>
      <div style={s.list}>
        {appointments.map(app => (
          <div key={app.id} style={s.item}>
            <div style={s.itemHeader}>
              <strong style={s.itemTitle}>{app.clinic}</strong>
              <span style={app.status === 'Upcoming' ? s.badgeGreen : s.badgeGray}>{app.status}</span>
            </div>
            <p style={s.itemDetail}><strong>Clinician:</strong> {app.doctor}</p>
            <p style={s.itemDetail}><strong>When:</strong> {app.date} at {app.time}</p>
          </div>
        ))}
      </div>

      <p style={s.sectionTitle}>Prescriptions</p>
      <div style={s.list}>
        {prescriptions.map(med => (
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
                backgroundColor: med.repeatsLeft > 0 ? C.primary : C.border,
                color: med.repeatsLeft > 0 ? C.white : C.textMid,
                cursor: med.repeatsLeft > 0 ? 'pointer' : 'not-allowed',
              }}
              disabled={med.repeatsLeft === 0}
              onClick={() => handleRepeatRequest(med)}
            >
              {med.repeatsLeft > 0 ? 'Request Repeat Supply' : 'Refills Unavailable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
