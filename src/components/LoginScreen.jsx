import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { C } from '../styles/shared.js';

const s = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '100svh', backgroundColor: C.bg || '#F7F9FC', padding: '20px'
  },
  card: {
    backgroundColor: C.white, padding: '32px', borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: '400px'
  },
  title: { margin: '0 0 8px', fontSize: '24px', fontWeight: '700', color: C.textDark, textAlign: 'center' },
  subtitle: { margin: '0 0 24px', fontSize: '15px', color: C.textMid, textAlign: 'center' },
  input: {
    width: '100%', padding: '12px 16px', marginBottom: '16px', borderRadius: '8px',
    border: `1px solid ${C.border || '#eee'}`, fontSize: '15px', boxSizing: 'border-box'
  },
  button: {
    width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
    backgroundColor: C.primary, color: C.white, fontSize: '16px', fontWeight: '600', cursor: 'pointer',
    transition: 'background-color 0.2s', marginBottom: '12px'
  },
  toggleText: { textAlign: 'center', fontSize: '14px', color: C.textMid, cursor: 'pointer', marginTop: '16px' },
  error: { color: '#D32F2F', fontSize: '14px', textAlign: 'center', marginBottom: '16px', fontWeight: '500' }
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isSignUp) {
        // Create account
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Success! Check your email for a confirmation link, or log right in if auto-confirm is enabled.');
      } else {
        // Log in
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <p style={s.title}>NHS Connect</p>
        <p style={s.subtitle}>{isSignUp ? 'Create a secure account' : 'Log in to view your records'}</p>

        <form onSubmit={handleAuth}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={s.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={s.input}
            required
          />
          
          {errorMsg && <p style={s.error}>{errorMsg}</p>}

          <button type="submit" style={s.button} disabled={loading}>
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
          </button>
        </form>

        <p style={s.toggleText} onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </p>
      </div>
    </div>
  );
}