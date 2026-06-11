import { useEffect, useState, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { C, sharedStyles } from '../styles/shared.js';

const s = {
  ...sharedStyles,
  itemHeader: { ...sharedStyles.itemHeader, alignItems: 'center' },
  itemType: { fontSize: '15px', fontWeight: '600', color: C.textDark, textTransform: 'capitalize' },
  itemDate: { fontSize: '12px', color: C.textLight },
  
  itemPreviewCollapsed: { 
    fontSize: '14px', 
    color: C.textMid, 
    margin: 0, 
    lineHeight: '1.5',
    display: '-webkit-box',
    WebkitLineClamp: 5, 
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  
  fullScreenModal: {
    position: 'fixed', inset: 0, backgroundColor: C.background || '#F7F9FC',
    zIndex: 9999, display: 'flex', flexDirection: 'column', overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', padding: '16px', backgroundColor: C.white,
    borderBottom: `1px solid ${C.divider || '#eee'}`, position: 'sticky', top: 0, zIndex: 10,
  },
  backButton: {
    background: 'none', border: 'none', color: C.primary, fontSize: '16px',
    fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0',
  },
  modalContent: {
    padding: '20px', backgroundColor: C.white, margin: '16px', borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)', fontSize: '15px', lineHeight: '1.6', color: C.textDark,
  },
  
  calendarButton: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    width: '100%', padding: '14px', marginTop: '20px', borderRadius: '8px',
    backgroundColor: C.primary, color: C.white, fontSize: '16px', fontWeight: '600',
    border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,102,204,0.3)',
  },

  // --- NEW: Action Sheet Styles ---
  actionSheetOverlay: {
    position: 'fixed', inset: 0, zIndex: 10, borderRadius: '12px'
  },
  actionSheet: {
    position: 'absolute', bottom: '100%', left: 0, right: 0, 
    backgroundColor: C.white, borderRadius: '12px', padding: '8px',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', marginBottom: '10px',
    zIndex: 11, border: `1px solid ${C.divider || '#eee'}`,
  },
  actionSheetBtn: {
    width: '100%', padding: '14px', backgroundColor: 'transparent',
    border: 'none', fontSize: '16px', fontWeight: '500', color: C.textDark,
    textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px'
  },
  // --------------------------------

  empty: { textAlign: 'center', color: C.textLight, fontSize: '15px', marginTop: '40px' },
  loading: { textAlign: 'center', color: C.primary, fontSize: '15px', marginTop: '40px' },
  itemPressable: { 
    ...sharedStyles.item, cursor: 'pointer', userSelect: 'none', 
    WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
  },
  controlsBar: { display: 'flex', gap: '10px', marginBottom: '16px', padding: '0 16px' },
  searchInput: { 
    flex: 1, padding: '10px 14px', borderRadius: '8px', border: `1px solid ${C.divider || '#eee'}`, 
    fontSize: '15px', backgroundColor: C.white, color: C.textDark, outline: 'none'
  },
  sortButton: { 
    padding: '0 16px', borderRadius: '8px', border: 'none', 
    backgroundColor: C.primary, color: C.white, fontWeight: '600', cursor: 'pointer'
  },
  contextMenuOverlay: { position: 'fixed', inset: 0, zIndex: 99 },
  contextMenu: {
    position: 'fixed', backgroundColor: C.white, borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: '8px 0', zIndex: 100, minWidth: '160px',
  },
  contextMenuItem: {
    padding: '12px 20px', color: '#D32F2F', fontSize: '15px',
    fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
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
  const [contextMenu, setContextMenu] = useState(null);
  const [expandedMsg, setExpandedMsg] = useState(null);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  
  const pressTimer = useRef(null);
  const isLongPress = useRef(false);

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
      if (expandedMsg?.id === id) setExpandedMsg(null); 
    } catch (err) {
      console.error("Failed to delete message:", err);
      alert("Failed to delete. Please try again.");
    }
  };

  const handlePointerDown = (e, id) => {
    isLongPress.current = false; 
    const x = e.clientX;
    const y = e.clientY;

    pressTimer.current = setTimeout(() => {
      isLongPress.current = true; 
      const safeX = Math.min(x, window.innerWidth - 180); 
      setContextMenu({ id, x: safeX, y });
    }, 800); 
  };

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleClick = (msg) => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    setExpandedMsg(msg);
  };

  // --- NEW: Calendar Logic ---
  const getEventDetails = (msg) => {
    const text = msg.summary_text || '';
    const extract = (key) => {
      const match = text.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`, 'i'));
      return match ? match[1].trim() : 'Not specified';
    };

    const dateStr = extract('Date');
    const timeStr = extract('Time');
    const title = `NHS: ${extract('Clinician/Department')}`;
    const locationStr = extract('Location');

    let startDate = new Date();
    if (dateStr !== 'Not specified') {
      const timeStringToParse = timeStr !== 'Not specified' ? timeStr : '09:00'; 
      const parsedDate = new Date(`${dateStr} ${timeStringToParse}`);
      if (!isNaN(parsedDate.getTime())) startDate = parsedDate;
    }
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); 

    return { title, startDate, endDate, locationStr };
  };

  const handleAppleCalendar = (msg) => {
    const { title, startDate, endDate, locationStr } = getEventDetails(msg);
    const formatICS = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');

    const icsContent = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      `DTSTART:${formatICS(startDate)}`, `DTEND:${formatICS(endDate)}`,
      `SUMMARY:${title}`, `LOCATION:${locationStr}`,
      `DESCRIPTION:Appointment details extracted from NHS Scan.`,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nhs-appointment.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setShowCalendarMenu(false); 
  };

  const handleGoogleCalendar = (msg) => {
    const { title, startDate, endDate, locationStr } = getEventDetails(msg);
    const formatToUTC = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');

    const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    const params = new URLSearchParams({
      text: title,
      dates: `${formatToUTC(startDate)}/${formatToUTC(endDate)}`,
      details: 'Appointment details extracted from NHS Scan. Please verify against your original letter.',
      location: locationStr !== 'Not specified' ? locationStr : ''
    });

    window.open(`${baseUrl}&${params.toString()}`, '_blank');
    setShowCalendarMenu(false); 
  };
  // ---------------------------

  const CustomLink = ({ href, children }) => (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      style={{
        color: C.primary, fontWeight: '600', textDecoration: 'none', 
        display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px'
      }}
      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} 
    >
      <span>📍</span><span style={{ textDecoration: 'underline' }}>{children}</span>
    </a>
  );

  if (loading) return <p style={s.loading}>Loading messages…</p>;

  return (
    <div style={s.container}>
      <p style={s.sectionTitle}>Communications</p>
      
      {expandedMsg && (
        <div style={s.fullScreenModal}>
          <div style={s.modalHeader}>
            <button style={s.backButton} onClick={() => setExpandedMsg(null)}>
              <span>←</span> Back
            </button>
            <span style={{ marginLeft: 'auto', fontWeight: '600', color: C.textDark }}>
              {(expandedMsg.scan_type ?? 'scan').replace(/_/g, ' ')}
            </span>
          </div>
          <div style={s.modalContent}>
            <ReactMarkdown components={{ a: CustomLink }}>
              {expandedMsg.summary_text}
            </ReactMarkdown>
            
            {/* --- NEW: Calendar Action Sheet Container --- */}
            <div style={{ position: 'relative', marginTop: '20px' }}>
              {showCalendarMenu && (
                <>
                  <div style={s.actionSheetOverlay} onClick={() => setShowCalendarMenu(false)} />
                  <div style={s.actionSheet}>
                    <button style={s.actionSheetBtn} onClick={() => handleAppleCalendar(expandedMsg)}>
                      <span style={{ fontSize: '20px' }}>🍎</span> Apple Calendar
                    </button>
                    <div style={{ height: '1px', backgroundColor: '#eee', margin: '4px 0' }} />
                    <button style={s.actionSheetBtn} onClick={() => handleGoogleCalendar(expandedMsg)}>
                      <span style={{ fontSize: '20px' }}>🔵</span> Google Calendar
                    </button>
                  </div>
                </>
              )}
              <button 
                style={{ ...s.calendarButton, marginTop: 0 }}
                onClick={() => setShowCalendarMenu(!showCalendarMenu)}
              >
                <span style={{ fontSize: '20px' }}>📅</span> Add to Calendar
              </button>
            </div>
            {/* ------------------------------------------- */}
            
          </div>
        </div>
      )}

      {contextMenu && (
        <>
          <div style={s.contextMenuOverlay} onPointerDown={() => setContextMenu(null)} />
          <div style={{ ...s.contextMenu, top: contextMenu.y, left: contextMenu.x }}>
            <div 
              style={s.contextMenuItem} 
              onClick={() => {
                const idToDelete = contextMenu.id;
                setContextMenu(null);
                handleDelete(idToDelete);
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
            type="text" placeholder="Search date, type, or keyword..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={s.searchInput}
          />
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            style={s.sortButton} aria-label="Toggle sort order"
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
                key={msg.id} style={s.itemPressable}
                onPointerDown={(e) => handlePointerDown(e, msg.id)}
                onPointerUp={cancelPress} onPointerLeave={cancelPress}
                onPointerCancel={cancelPress} onTouchMove={cancelPress}
                onClick={() => handleClick(msg)}
              >
                <div style={s.itemHeader}>
                  <span style={s.itemType}>{(msg.scan_type ?? 'scan').replace(/_/g, ' ')}</span>
                  <span style={s.itemDate}>{formatDate(msg.created_at)}</span>
                </div>
                
                {msg.summary_text ? (
                  <div style={s.itemPreviewCollapsed}>
                    <ReactMarkdown components={{ a: () => null }}>
                      {msg.summary_text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div style={s.itemPreviewCollapsed}>
                    <p style={{ margin: 0 }}>Processing…</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}