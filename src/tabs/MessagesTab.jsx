import { useEffect, useState } from 'react';
import { C, sharedStyles } from '../styles/shared.js';
import ReactMarkdown from 'react-markdown';

const s = {
  ...sharedStyles,
  itemHeader: { ...sharedStyles.itemHeader, alignItems: 'center' },
  itemType: { fontSize: '15px', fontWeight: '600', color: C.textDark, textTransform: 'capitalize' },
  itemDate: { fontSize: '12px', color: C.textLight },
  itemPreview: { fontSize: '14px', color: C.textMid, margin: 0, lineHeight: '1.4' },  empty: { textAlign: 'center', color: C.textLight, fontSize: '15px', marginTop: '40px' },
  loading: { textAlign: 'center', color: C.primary, fontSize: '15px', marginTop: '40px' },
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={s.loading}>Loading messages…</p>;

  return (
    <div style={s.container}>
      <p style={s.sectionTitle}>Communications</p>
      {messages.length === 0
        ? <p style={s.empty}>No communications yet. Scan a document to upload one.</p>
        : (
          <div style={s.list}>
            {messages.map(msg => (
              <div key={msg.id} style={s.item}>
                <div style={s.itemHeader}>
                  <span style={s.itemType}>{(msg.scan_type ?? 'scan').replace(/_/g, ' ')}</span>
                  <span style={s.itemDate}>{formatDate(msg.created_at)}</span>
                </div>
                <div style={s.itemPreview}>
                  {msg.summary_text ? (
                    <ReactMarkdown>{msg.summary_text}</ReactMarkdown>
                  ) : (
                    <p style={{ margin: 0 }}>Processing…</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
