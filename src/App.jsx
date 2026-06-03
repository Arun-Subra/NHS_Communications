import { useEffect, useState } from 'react';
import { C } from './styles/shared.js';
import HomeTab from './tabs/HomeTab.jsx';
import PhotoTab from './tabs/PhotoTab.jsx';
import MessagesTab from './tabs/MessagesTab.jsx';

const API_BASE_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, options);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

// ── SVG icons ────────────────────────────────────────────────────────────────

function IconHome({ filled, color }) {
  return filled ? (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={color}>
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ) : (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9" />
      <path d="M9 21V12h6v9" />
      <rect x="3" y="12" width="18" height="9" rx="1" fill="none" />
      <path d="M3 12v9h6v-6h6v6h6V12" />
    </svg>
  );
}

function IconCamera({ filled, color }) {
  return filled ? (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={color}>
      <path d="M9 3L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-3.17L15 3H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
      <circle cx="12" cy="13" r="2.5" fill="white" />
    </svg>
  ) : (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconMail({ filled, color }) {
  return filled ? (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={color}>
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  ) : (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = {
  shell: {
    width: '100%',
    maxWidth: '430px',
    minHeight: '100svh',
    margin: '0 auto',
    backgroundColor: C.bg,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 0 40px rgba(0,0,0,0.18)',
    position: 'relative',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    paddingBottom: '80px',
  },
  navBar: {
    position: 'sticky',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.white,
    borderTop: `1px solid ${C.border}`,
    display: 'flex',
    paddingBottom: '20px',
    paddingTop: '8px',
    zIndex: 10,
  },
  navItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '4px 0',
  },
  navLabel: { fontSize: '11px', fontWeight: '500' },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    color: C.primary,
  },
};

// ── App ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'home', label: 'Home', Icon: IconHome },
  { id: 'photo', label: 'Camera', Icon: IconCamera },
  { id: 'messages', label: 'Communications', Icon: IconMail },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('photo');
  const [isLoading, setIsLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    apiFetch('/api/me')
      .then(data => {
        setPatient(data.patient_info);
        setAppointments(data.appointments);
        setPrescriptions(data.prescriptions);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const logEvent = (eventType, metadata = null) =>
    apiFetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, metadata }),
    }).catch(() => {});

  const tabContent = {
    home: <HomeTab patient={patient} appointments={appointments} prescriptions={prescriptions} logEvent={logEvent} />,
    photo: <PhotoTab patient={patient} apiFetch={apiFetch} />,
    messages: <MessagesTab apiFetch={apiFetch} />,
  };

  return (
    <div style={s.shell}>
      <main style={s.mainContent}>
        {isLoading
          ? <p style={s.loading}>Connecting to NHS Database…</p>
          : tabContent[activeTab]
        }
      </main>

      <nav style={s.navBar}>
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          const color = active ? C.primary : C.textLight;
          return (
            <button
              key={id}
              style={s.navItem}
              onClick={() => setActiveTab(id)}
              aria-label={label}
            >
              <Icon filled={active} color={color} />
              <span style={{ ...s.navLabel, color }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
