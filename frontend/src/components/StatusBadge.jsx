import { useT } from '../i18n'

// The stored value, and the modifier every control that shows that status
// uses. Exported because the report filter chips are the same four statuses
// and have to be the same four colours - a chip in one green and a badge in
// another would read as two different things.
export const statusModifier = {
  Active: 'active',
  Planning: 'planning',
  Completed: 'completed',
  'On Hold': 'on-hold',
}

// The dot repeats the status the word already gives; it is there to be picked
// out while scanning a column, never to carry the meaning on its own.
// The class is picked from the stored value and the word is translated from
// it, so a status keeps its colour in both languages.
export default function StatusBadge({ status }) {
  const t = useT()

  return (
    <span
      className={
        statusModifier[status] ? `badge badge-${statusModifier[status]}` : 'badge'
      }
    >
      <span className="badge-dot" aria-hidden="true" />
      {t(status)}
    </span>
  )
}
