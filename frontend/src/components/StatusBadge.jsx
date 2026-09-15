const badgeClasses = {
  Active: 'badge badge-active',
  Planning: 'badge badge-planning',
  Completed: 'badge badge-completed',
  'On Hold': 'badge badge-on-hold',
}

// The dot repeats the status the word already gives; it is there to be picked
// out while scanning a column, never to carry the meaning on its own.
export default function StatusBadge({ status }) {
  return (
    <span className={badgeClasses[status] || 'badge'}>
      <span className="badge-dot" aria-hidden="true" />
      {status}
    </span>
  )
}
