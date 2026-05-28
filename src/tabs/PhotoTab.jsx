import { useState } from 'react';

const PLACEHOLDER_SCAN_TEXT = `Your appointment is a
- blood test
Taking place on
- 13/12/2005
- Saturday 13th December 2025
At time
- 12:05pm.`;

const s = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
  },
  hint: { fontSize: '15px', color: '#4A5660', margin: 0 },
  shutterOuter: {
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    border: '4px solid #FFFFFF',
    boxShadow: '0 0 0 3px #0066CC, 0 4px 16px rgba(0,102,204,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: 'transparent',
    padding: 0,
    transition: 'transform 0.1s ease',
  },
  shutterInner: {
    width: '68px',
    height: '68px',
    borderRadius: '50%',
    backgroundColor: '#0066CC',
  },
  shutterInnerActive: {
    width: '68px',
    height: '68px',
    borderRadius: '50%',
    backgroundColor: '#004499',
  },
  feedback: { fontSize: '14px', fontWeight: '600', color: '#008A50', height: '20px' },
};

export default function PhotoTab({ patient, apiFetch }) {
  const [status, setStatus] = useState('idle');

  if (!patient) {
    return (
      <div style={s.container}>
        <p style={s.hint}>Not connected to NHS database</p>
      </div>
    );
  }

  const handleShutter = async () => {
    if (status === 'sending') return;
    setStatus('sending');
    try {
      await apiFetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nhs_number: patient?.nhs_number,
          raw_text: PLACEHOLDER_SCAN_TEXT,
          scan_type: 'appointment_letter',
        }),
      });
      setStatus('sent');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const feedbackText = status === 'sending' ? 'Sending…'
    : status === 'sent' ? 'Sent!'
    : status === 'error' ? 'Failed — try again'
    : '';

  return (
    <div style={s.container}>
      <p style={s.hint}>Tap to send a document scan</p>
      <button
        style={{ ...s.shutterOuter, transform: status === 'sending' ? 'scale(0.95)' : 'scale(1)' }}
        onClick={handleShutter}
        disabled={status === 'sending'}
        aria-label="Send scan"
      >
        <div style={status === 'sending' ? s.shutterInnerActive : s.shutterInner} />
      </button>
      <p style={{ ...s.feedback, color: status === 'error' ? '#C0392B' : '#008A50' }}>
        {feedbackText}
      </p>
    </div>
  );
}
