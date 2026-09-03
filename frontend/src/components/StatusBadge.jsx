const badgeClasses = {
  Active: 'badge badge-active',
  Planning: 'badge badge-planning',
  Completed: 'badge badge-completed',
  'On Hold': 'badge badge-on-hold',
}

export default function StatusBadge({ status }) {
  return <span className={badgeClasses[status] || 'badge'}>{status}</span>
}
