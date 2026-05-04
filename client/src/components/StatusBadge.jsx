export default function StatusBadge({ status }) {
  const map = {
    offen:              { label: 'Offen',             cls: 'badge-offen' },
    rechnung_gestellt:  { label: 'Rechnung gestellt', cls: 'badge-rechnung_gestellt' },
    bezahlt:            { label: 'Bezahlt',           cls: 'badge-bezahlt' },
  }
  const { label, cls } = map[status] || { label: status, cls: 'badge-offen' }
  return <span className={cls}>{label}</span>
}
