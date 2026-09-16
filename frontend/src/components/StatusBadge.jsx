import { useT } from '../i18n'

const badgeClasses = {
  Active: 'badge badge-active',
  Planning: 'badge badge-planning',
  Completed: 'badge badge-completed',
  'On Hold': 'badge badge-on-hold',
}

// The dot repeats the status the word already gives; it is there to be picked
// out while scanning a column, never to carry the meaning on its own.
// The class is picked from the stored value and the word is translated from
// it, so a status keeps its colour in both languages.
export default function StatusBadge({ status }) {
  const t = useT()

  return (
    <span className={badgeClasses[status] || 'badge'}>
      <span className="badge-dot" aria-hidden="true" />
      {t(status)}
    </span>
  )
}
