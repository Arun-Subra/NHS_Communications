import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { C } from './styles/shared.js';

import HomeTab from './tabs/HomeTab.jsx';
import PhotoTab from './tabs/PhotoTab.jsx';
import MessagesTab from './tabs/MessagesTab.jsx';
import LoginScreen from './components/LoginScreen.jsx';

import { supabase } from './supabaseClient.js';

const API_BASE_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '';

export async function apiFetch(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return {};
  return res.json();
}

// ---------------- ICONS ----------------

function IconHome({ filled, color }) {
  return filled ? (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={color}>
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ) : (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
      <path d="M3 12L12 3l9 9" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconCamera({ filled, color }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="1.8">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8c0-1 1-2 2-2h4l2-3h6l2 3h4c1 0 2 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconMail({ filled, color }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="1.8">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  );
}

const s = {
  shell: {
    width: '100%', maxWidth: '430px', minHeight: '100svh', margin: '0 auto',
    backgroundColor: C.bg, display: 'flex', flexDirection: 'column',
    boxShadow: '0 0 40px rgba(0,0,0,.18)', position: 'relative',
  },
  topBar: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    padding: '10px 12px 6px', backgroundColor: C.white, borderBottom: `1px solid ${C.border}`, zIndex: 5,
  },
  mainContent: {
    flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column'
  },
  mainContentScrollable: {
    overflowY: 'auto', paddingBottom: '80px',
  },
  mainContentPhoto: {
    overflow: 'hidden', paddingBottom: 0,
  },
  navBar: {
    position: 'sticky', bottom: 0, backgroundColor: C.white, display: 'flex',
    borderTop: `1px solid ${C.border}`, paddingBottom: '20px', paddingTop: '8px',
  },
  navItem: {
    flex: 1, border: 'none', background: 'none', display: 'flex',
    flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
  },
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', color: C.primary,
  },
  logoutBtn: {
    border: 'none', background: 'none', color: C.primary, fontWeight: '600', cursor: 'pointer', padding: '6px 8px',
  },
};

const TABS = [
  { id: 'home', label: 'Home', Icon: IconHome },
  { id: 'photo', label: 'Camera', Icon: IconCamera },
  { id: 'messages', label: 'Communications', Icon: IconMail },
];

// ---------------- MAIN APP ----------------

function MainApp() {
  const [activeTab, setActiveTab] = useState('photo');
  const [loading, setLoading] = useState(true);

  // 1. Create a reference to the main scroll container
  const mainRef = useRef(null);

  // 2. Automatically scroll to the top whenever the activeTab changes
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const [role, setRole] = useState(null);

  const [patient, setPatient] = useState(null);
  const [managedPatients, setManagedPatients] = useState([]);
  const [selectedPatientNhs, setSelectedPatientNhs] = useState('');

  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  const logout = useCallback(() => supabase.auth.signOut(), []);

  const selectedPatient = useMemo(
    () => managedPatients.find(p => p.nhs_number === selectedPatientNhs) || null,
    [managedPatients, selectedPatientNhs]
  );

  const currentPatient = role === 'carer' ? selectedPatient : patient;

  const loadOwnPatientData = useCallback(async () => {
    const data = await apiFetch('/api/me');
    setRole(data.role);

    if (data.role === 'patient') {
      setPatient(data.patient_info ?? null);
      setAppointments(data.appointments ?? []);
      setPrescriptions(data.prescriptions ?? []);
      setManagedPatients([]);
      setSelectedPatientNhs('');
      return;
    }

    if (data.role === 'carer') {
      const list = data.managed_patients ?? [];
      setManagedPatients(list);
      const firstNhs = list[0]?.nhs_number ?? '';
      setSelectedPatientNhs(firstNhs);
      setAppointments([]);
      setPrescriptions([]);
      setPatient(null);
      return;
    }

    setPatient(null);
    setManagedPatients([]);
    setSelectedPatientNhs('');
    setAppointments([]);
    setPrescriptions([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadOwnPatientData();
      } catch (err) {
        if (!cancelled) console.error('Failed to load /api/me:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadOwnPatientData]);

  useEffect(() => {
    if (role !== 'carer') return;
    if (!selectedPatientNhs) {
      setAppointments([]);
      setPrescriptions([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch(`/api/patient-overview?nhs_number=${encodeURIComponent(selectedPatientNhs)}`);
        if (cancelled) return;
        setAppointments(data.appointments ?? []);
        setPrescriptions(data.prescriptions ?? []);
      } catch (err) {
        console.warn('Could not load /api/patient-overview, using safe fallback:', err);
        if (!cancelled) {
          setAppointments([]);
          setPrescriptions([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [role, selectedPatientNhs]);

  const handleLogEvent = useCallback(async (eventType, metadata) => {
    try {
      await apiFetch('/api/event', {
        method: 'POST',
        body: JSON.stringify({ event_type: eventType, metadata }),
      });
    } catch (e) {
      console.warn('logEvent failed:', e);
    }
  }, []);

  if (loading) {
    return <p style={s.loading}>Connecting securely…</p>;
  }

  return (
    <div style={s.shell}>
      <div style={s.topBar}>
        <button style={s.logoutBtn} onClick={logout}>
          Log out
        </button>
      </div>

      {role === 'carer' && (
        <div style={{ padding: '12px', background: C.white }}>
          <select
            style={{ width: '100%', padding: '10px', borderRadius: '8px' }}
            value={selectedPatientNhs}
            onChange={(e) => setSelectedPatientNhs(e.target.value)}
          >
            {managedPatients.length === 0 ? (
              <option value="">No linked patients</option>
            ) : (
              managedPatients.map(p => (
                <option key={p.nhs_number} value={p.nhs_number}>
                  {p.name}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      <main
        ref={mainRef}
        style={{
          ...s.mainContent,
          ...(activeTab === 'photo' ? s.mainContentPhoto : s.mainContentScrollable),
        }}
      >
        {activeTab === 'home' && (
          <HomeTab
            patient={currentPatient}
            appointments={appointments}
            prescriptions={prescriptions}
            onNavigate={setActiveTab}
            logEvent={handleLogEvent}
          />
        )}

        {/* The camera unmounts completely when hidden to release the hardware */}
        {activeTab === 'photo' && (
          <PhotoTab
            patient={currentPatient}
            apiFetch={apiFetch}
            onNavigate={setActiveTab}
          />
        )}

        {/* CRITICAL FIX: Keep-Alive 
          MessagesTab is ALWAYS mounted, just visually hidden when not in use.
          This prevents the initial loading screen and allows the Realtime 
          websocket to catch your new uploads instantly in the background!
        */}
        <div 
          style={{ 
            display: activeTab === 'messages' ? 'flex' : 'none',
            flex: 1,
            flexDirection: 'column',
            minHeight: 0
          }}
        >
          <MessagesTab
            apiFetch={apiFetch}
            activePatientNhs={currentPatient?.nhs_number}
          />
        </div>
      </main>

      <nav style={s.navBar}>
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} style={s.navItem} onClick={() => setActiveTab(id)}>
              <Icon filled={active} color={active ? C.primary : C.textLight} />
              <span style={{ fontSize: '11px', color: active ? C.primary : C.textLight }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ---------------- AUTH ROUTER ----------------

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setSession(session));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (checking) return <p style={s.loading}>Securing connection…</p>;
  if (!session) return <LoginScreen />;

  return <MainApp />;
}