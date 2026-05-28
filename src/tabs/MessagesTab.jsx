import { useEffect, useState } from 'react';

const s = {
  container: { padding: '20px 16px 0', overflowY: 'auto' },
  sectionTitle: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#0066CC',
    borderBottom: '2px solid #D4D9DE',
    paddingBottom: '8px',
    marginBottom: '12px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  item: {
    backgroundColor: '#FFFFFF',
    padding: '14px 16px',
    borderRadius: '6px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    borderLeft: '4px solid #0066CC',
  },
  itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  itemType: { fontSize: '15px', fontWeight: '600', color: '#1F2D38', textTransform: 'capitalize' },
  itemDate: { fontSize: '12px', color: '#6B7785' },
  itemPreview: { fontSize: '14px', color: '#4A5660', margin: 0, whiteSpace: 'pre-line', lineHeight: '1.4' },
  empty: { textAlign: 'center', color: '#6B7785', fontSize: '15px', marginTop: '40px' },
  loading: { textAlign: 'center', color: '#0066CC', fontSize: '15px', marginTop: '40px' },
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MessagesTab({ apiFetch }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/messages')
      .then(data => setMessages(data.messages ?? []))
      .catch(err => console.error('Failed to load messages:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={s.loading}>Loading messages…</p>;

  return (
    <div style={s.container}>
      <p style={s.sectionTitle}>Messages</p>
      {messages.length === 0
        ? <p style={s.empty}>No messages yet. Tap the camera to send one.</p>
        : (
          <div style={s.list}>
            {messages.map(msg => (
              <div key={msg.id} style={s.item}>
                <div style={s.itemHeader}>
                  <span style={s.itemType}>{(msg.scan_type ?? 'scan').replace(/_/g, ' ')}</span>
                  <span style={s.itemDate}>{formatDate(msg.created_at)}</span>
                </div>
                <p style={s.itemPreview}>{msg.raw_text}</p>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
