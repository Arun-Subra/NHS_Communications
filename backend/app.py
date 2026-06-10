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
  },
  // --- NEW: Context Menu Styles ---
  contextMenuOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 99, // Sits just underneath the menu to catch outside clicks
  },
  contextMenu: {
    position: 'fixed',
    backgroundColor: C.white,
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    padding: '8px 0',
    zIndex: 100, // Highest z-index to sit on top of everything
    minWidth: '160px',
  },
  contextMenuItem: {
    padding: '12px 20px',
    color: '#D32F2F', // A nice danger red
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MessagesTab({ apiFetch }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // --- NEW: State for the floating menu ---
  const [contextMenu, setContextMenu] = useState(null); // Will hold { id, x, y }
  
  const pressTimer = useRef(null);

  useEffect(() => {
    let intervalId;

    const fetchMessages = () => {
      apiFetch('/api/messages')
        .then(data => {
          const msgs = data.messages ?? [];
          setMessages(msgs);
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

  const displayedMessages = useMemo(() => {
    let result = [...messages];

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(msg => {
        const dateStr = formatDate(msg.created_at).toLowerCase();
        const typeStr = (msg.scan_type ?? '').replace(/_/g, ' ').toLowerCase();
        const summaryStr = (msg.summary_text ?? '').toLowerCase();
        return dateStr.includes(query) || typeStr.includes(query) || summaryStr.includes(query);
      });
    }

    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [messages, searchQuery, sortOrder]);

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

  // --- UPDATED: Pass the event (e) to grab the finger's coordinates ---
  const handlePointerDown = (e, id) => {
    // Grab the exact X and Y pixels of the click/tap
    const x = e.clientX;
    const y = e.clientY;

    pressTimer.current = setTimeout(() => {
      // Prevent the menu from rendering off the right edge of the screen
      const safeX = Math.min(x, window.innerWidth - 180); 
      setContextMenu({ id, x: safeX, y });
    }, 800); 
  };

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  if (loading) return <p style={s.loading}>Loading messages…</p>;

  return (
    <div style={s.container}>
      <p style={s.sectionTitle}>Communications</p>
      
      {/* --- NEW: Render the floating Context Menu if it's active --- */}
      {contextMenu && (
        <>
          {/* Invisible overlay that closes the menu if you click outside of it */}
          <div style={s.contextMenuOverlay} onPointerDown={() => setContextMenu(null)} />
          
          {/* The actual floating menu, positioned at the user's finger */}
          <div style={{ ...s.contextMenu, top: contextMenu.y, left: contextMenu.x }}>
            <div 
              style={s.contextMenuItem} 
              onClick={() => {
                const idToDelete = contextMenu.id;
                setContextMenu(null); // Hide menu first
                handleDelete(idToDelete); // Then trigger the confirmation box
              }}
            >
              <span style={{ fontSize: '18px' }}>🗑️</span> Delete Scan
            </div>
          </div>
        </>
      )}

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
                // --- UPDATED: Pass the event (e) here ---
                onPointerDown={(e) => handlePointerDown(e, msg.id)}
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