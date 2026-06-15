import { useCallback, useEffect, useMemo, useState } from 'react';
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
    position: 'fixed',
    inset: 0,
    backgroundColor: C.background || '#F7F9FC',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: C.white,
    borderBottom: `1px solid ${C.divider || '#eee'}`,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: C.primary,
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 0',
  },

  deleteButtonHeader: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    marginLeft: 'auto',
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalContent: {
    padding: '20px',
    backgroundColor: C.white,
    margin: '16px',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    fontSize: '15px',
    lineHeight: '1.6',
    color: C.textDark,
  },

  calendarButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px',
    marginTop: '20px',
    borderRadius: '8px',
    backgroundColor: C.primary,
    color: C.white,
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,102,204,0.3)',
  },

  actionSheetOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10,
    borderRadius: '12px',
  },
  actionSheet: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: C.white,
    borderRadius: '12px',
    padding: '8px',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
    marginBottom: '10px',
    zIndex: 11,
    border: `1px solid ${C.divider || '#eee'}`,
  },
  actionSheetBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '16px',
    fontWeight: '500',
    color: C.textDark,
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  empty: { textAlign: 'center', color: C.textLight, fontSize: '15px', marginTop: '40px' },
  loading: { textAlign: 'center', color: C.primary, fontSize: '15px', marginTop: '40px' },
  itemPressable: { ...sharedStyles.item, cursor: 'pointer' },
  controlsBar: { display: 'flex', gap: '10px', marginBottom: '16px', padding: '0 16px' },
  searchInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${C.divider || '#eee'}`,
    fontSize: '15px',
    backgroundColor: C.white,
    color: C.textDark,
    outline: 'none',
  },
  sortButton: {
    padding: '0 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: C.primary,
    color: C.white,
    fontWeight: '600',
    cursor: 'pointer',
  },
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatICSUTC(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeICS(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function parseDateTime(dateStr, timeStr) {
  if (!dateStr || dateStr === 'Not specified') return null;
  const fallbackTime = !timeStr || timeStr === 'Not specified' ? '09:00' : timeStr;
  const parsed = new Date(`${dateStr} ${fallbackTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function MessagesTab({ activePatientNhs, apiFetch }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [expandedMsg, setExpandedMsg] = useState(null);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);

  // Reset view state when switching patient
  useEffect(() => {
    setExpandedMsg(null);
    setShowCalendarMenu(false);
    setSearchQuery('');
    setSortOrder('desc');
  }, [activePatientNhs]);

  const fetchMessages = useCallback(() => {
    if (!activePatientNhs) return Promise.resolve();
    setLoading(true);
    return apiFetch(`/api/messages?nhs_number=${encodeURIComponent(activePatientNhs)}`)
      .then(data => setMessages(Array.isArray(data?.messages) ? data.messages : []))
      .catch(err => {
        console.error('Fetch error:', err);
        setMessages([]);
      })
      .finally(() => setLoading(false));
  }, [activePatientNhs, apiFetch]);

  useEffect(() => {
    if (!activePatientNhs) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let intervalId;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') return;
      fetchMessages();
    };

    tick(); // initial fetch
    intervalId = setInterval(tick, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [activePatientNhs, fetchMessages]);

  const displayedMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const result = [...messages].filter(msg => {
      if (!query) return true;
      const dateStr = formatDate(msg.created_at).toLowerCase();
      const typeStr = (msg.scan_type ?? '').replace(/_/g, ' ').toLowerCase();
      const summaryStr = (msg.summary_text ?? '').toLowerCase();
      return dateStr.includes(query) || typeStr.includes(query) || summaryStr.includes(query);
    });

    result.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime() || 0;
      const bTime = new Date(b.created_at).getTime() || 0;
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
    });

    return result;
  }, [messages, searchQuery, sortOrder]);

  const handleDelete = useCallback(async (id) => {
    const confirmDelete = window.confirm('Are you sure you wish to delete this entry?');
    if (!confirmDelete) return;

    try {
      await apiFetch(`/api/messages/${id}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(msg => msg.id !== id));
      setExpandedMsg(prev => (prev?.id === id ? null : prev));
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert('Failed to delete. Please try again.');
    }
  }, [apiFetch]);

  const getEventDetails = useCallback((msg) => {
    const text = msg?.summary_text || '';
    const extract = (key) => {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\*\\*${escapedKey}:\\*\\*\\s*([^\\n\\r]+)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : 'Not specified';
    };

    const dateStr = extract('Date');
    const timeStr = extract('Time');
    const clinician = extract('Clinician/Department');
    const locationStr = extract('Location');

    const parsedStart = parseDateTime(dateStr, timeStr);
    const startDate = parsedStart ?? new Date();
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    return {
      title: `NHS: ${clinician}`,
      startDate,
      endDate,
      locationStr,
    };
  }, []);

  const handleAppleCalendar = useCallback((msg) => {
    const { title, startDate, endDate, locationStr } = getEventDetails(msg);

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NHS Scan App//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatICSUTC(startDate)}`,
      `DTEND:${formatICSUTC(endDate)}`,
      `SUMMARY:${escapeICS(title)}`,
      `LOCATION:${escapeICS(locationStr)}`,
      `DESCRIPTION:${escapeICS('Appointment details extracted from NHS Scan. Please verify against the original letter.')}`,
      'END:VEVENT',
      'END:VCALENDAR',
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
  }, [getEventDetails]);

  const handleGoogleCalendar = useCallback((msg) => {
    const { title, startDate, endDate, locationStr } = getEventDetails(msg);

    const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    const params = new URLSearchParams({
      text: title,
      dates: `${formatICSUTC(startDate)}/${formatICSUTC(endDate)}`,
      details: 'Appointment details extracted from NHS Scan. Please verify against your original letter.',
      location: locationStr !== 'Not specified' ? locationStr : '',
    });

    window.open(`${baseUrl}&${params.toString()}`, '_blank', 'noopener,noreferrer');
    setShowCalendarMenu(false);
  }, [getEventDetails]);

  const renderEssentialOnly = useCallback((fullMarkdownText) => {
    if (!fullMarkdownText) return '';
    const sections = fullMarkdownText.split(/\*\*Extra Information:\*\*/i);
    return sections[0].trim();
  }, []);

  const CustomLink = ({ href, children }) => (
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
        gap: '4px',
        marginTop: '8px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span>📍</span>
      <span style={{ textDecoration: 'underline' }}>{children}</span>
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

            <span style={{ marginLeft: '16px', fontWeight: '600', color: C.textDark }}>
              {(expandedMsg.scan_type ?? 'scan').replace(/_/g, ' ')}
            </span>

            <button
              style={s.deleteButtonHeader}
              onClick={() => handleDelete(expandedMsg.id)}
              aria-label="Delete entry"
            >
              🗑️
            </button>
          </div>

          <div style={s.modalContent}>
            <ReactMarkdown components={{ a: CustomLink }}>
              {expandedMsg.summary_text}
            </ReactMarkdown>

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
                onClick={() => setShowCalendarMenu(v => !v)}
              >
                <span style={{ fontSize: '20px' }}>📅</span> Add to Calendar
              </button>
            </div>
          </div>
        </div>
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
            onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
            style={s.sortButton}
            aria-label="Toggle sort order"
          >
            {sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
          </button>
        </div>
      )}

      {messages.length === 0 ? (
        <p style={s.empty}>
          {activePatientNhs
            ? 'No communications yet for this patient. Scan a document to upload one.'
            : 'No patient selected.'}
        </p>
      ) : displayedMessages.length === 0 ? (
        <p style={s.empty}>
          {activePatientNhs ? 'No communications found for this patient.' : 'No patient selected.'}
        </p>
      ) : (
        <div style={s.list}>
          {displayedMessages.map(msg => (
            <div key={msg.id} style={s.itemPressable} onClick={() => setExpandedMsg(msg)}>
              <div style={s.itemHeader}>
                <span style={s.itemType}>{(msg.scan_type ?? 'scan').replace(/_/g, ' ')}</span>
                <span style={s.itemDate}>{formatDate(msg.created_at)}</span>
              </div>

              {msg.summary_text ? (
                <div style={s.itemPreviewCollapsed}>
                  <ReactMarkdown components={{ a: () => null }}>
                    {renderEssentialOnly(msg.summary_text)}
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
      )}
    </div>
  );
}