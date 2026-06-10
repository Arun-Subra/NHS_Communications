import { useEffect, useState, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { C, sharedStyles } from '../styles/shared.js';

const s = {
  ...sharedStyles,
  itemHeader: { ...sharedStyles.itemHeader, alignItems: 'center' },
  itemType: { fontSize: '15px', fontWeight: '600', color: C.textDark, textTransform: 'capitalize' },
  itemDate: { fontSize: '12px', color: C.textLight },
  itemPreview: { fontSize: '14px', color: C.textMid, margin: 0, lineHeight: '1.4' },
  empty: { textAlign: 'center', color: C.textLight, fontSize: '15px', marginTop: '40px' },
  loading: { textAlign: 'center', color: C.primary, fontSize: '15px', marginTop: '40px' },
  itemPressable: { 
    ...sharedStyles.item, 
    cursor: 'pointer', 
    userSelect: 'none', 
    WebkitUserSelect: 'none', 
    WebkitTouchCallout: 'none' 
  },
  controlsBar: { 
    display: 'flex', 
    gap: '10px', 
    marginBottom: '16px', 
    padding: '0 16px' 
  },
  searchInput: { 
    flex: 1, 
    padding: '10px 14px', 
    borderRadius: '8px', 
    border: `1px solid ${C.divider || '#eee'}`, 
    fontSize: '15px',
    backgroundColor: C.white,
    color: C.textDark,
    outline: 'none'
  },
  sortButton: { 
    padding: '0 16px', 
    borderRadius: '8px', 
    border: 'none', 
    backgroundColor: C.primary, 
    color: C.white, 
    fontWeight: '600',
    cursor: 'pointer'
  }
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MessagesTab({ apiFetch }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Timer reference for the long press
  const pressTimer = useRef(null);

  useEffect(() => {
    let intervalId;

    const fetchMessages = () => {
      apiFetch('/api/messages')
        .then(data => {
          const msgs = data.messages ?? [];
          setMessages(msgs);
          // Stop polling if we have messages and none are "pending"
          if (msgs.length > 0 && msgs.every(m => m.summary_text)) {
            clearInterval(intervalId);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };

    fetchMessages();
    intervalId = setInterval(fetchMessages, 3000);
    return () => clearInterval(intervalId);
  }, [apiFetch]);

  // --- Filter and Sort Logic ---
  const displayedMessages = useMemo(() => {
    let result = [...messages];

    // 1. Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(msg => {
        const dateStr = formatDate(msg.created_at).toLowerCase();
        const typeStr = (msg.scan_type ?? '').replace(/_/g, ' ').toLowerCase();
        const summaryStr = (msg.summary_text ?? '').toLowerCase();
        
        return dateStr.includes(query) || typeStr.includes(query) || summaryStr.includes(query);
      });
    }

    // 2. Sort by Date
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [messages, searchQuery, sortOrder]);

  // --- Delete functionality ---
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this summary?");
    if (!confirmDelete) return;

    try {
      await apiFetch(`/api/messages/${id}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(msg => msg.id !== id));
    } catch (err) {
      console.error("Failed to delete message:", err);
      alert("Failed to delete. Please try again.");
    }
  };

  // --- Press and Hold logic ---
  const handlePointerDown = (id) => {
    pressTimer.current = setTimeout(() => {
      handleDelete(id);
    }, 800); // 800ms triggers the long press
  };

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  if (loading) return <p style={s.loading}>Loading messages…</p>;

  return (
    <div style={s.container}>
      <p style={s.sectionTitle}>Communications</p>
      
      {/* Search and Sort Bar (Only show if there are any messages at all) */}
      {messages.length > 0 && (
        <div style={s.controlsBar}>
          <input 
            type="text" 
            placeholder="Search date, type, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={s.searchInput}
          />
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            style={s.sortButton}
            aria-label="Toggle sort order"
          >
            {sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
          </button>
        </div>
      )}

      {messages.length === 0
        ? <p style={s.empty}>No communications yet. Scan a document to upload one.</p>
        : displayedMessages.length === 0 
        ? <p style={s.empty}>No results found for "{searchQuery}".</p>
        : (
          <div style={s.list}>
            {displayedMessages.map(msg => (
              <div 
                key={msg.id} 
                style={s.itemPressable}
                onPointerDown={() => handlePointerDown(msg.id)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onTouchMove={cancelPress}
              >
                <div style={s.itemHeader}>
                  <span style={s.itemType}>{(msg.scan_type ?? 'scan').replace(/_/g, ' ')}</span>
                  <span style={s.itemDate}>{formatDate(msg.created_at)}</span>
                </div>
                <div style={s.itemPreview}>
                  {msg.summary_text ? (
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: C.primary,
                              fontWeight: '600',
                              textDecoration: 'none', 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onPointerDown={(e) => e.stopPropagation()} 
                          >
                            <span>📍</span>
                            <span style={{ textDecoration: 'underline' }}>{children}</span>
                          </a>
                        )
                      }}
                    >
                      {msg.summary_text}
                    </ReactMarkdown>
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