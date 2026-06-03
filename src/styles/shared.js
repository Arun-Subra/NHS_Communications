export const C = {
  primary: '#0066CC',
  primaryDark: '#004499',
  green: '#008A50',
  red: '#C0392B',
  textDark: '#1F2D38',
  textMid: '#4A5660',
  textLight: '#6B7785',
  bg: '#F4F6F8',
  white: '#FFFFFF',
  border: '#D4D9DE',
  badgeGreenBg: '#E6F4ED',
  badgeGrayBg: '#EFF2F4',
  overlay: 'rgba(0, 0, 0, 0.45)',
};

export const sharedStyles = {
  container: { padding: '20px 16px 0', overflowY: 'auto' },
  sectionTitle: {
    fontSize: '17px',
    fontWeight: '600',
    color: C.primary,
    borderBottom: `2px solid ${C.border}`,
    paddingBottom: '8px',
    marginBottom: '12px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  item: {
    backgroundColor: C.white,
    padding: '14px 16px',
    borderRadius: '6px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    borderLeft: `4px solid ${C.primary}`,
  },
  itemHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  btnBase: {
    marginTop: '10px',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '14px',
  },
};
