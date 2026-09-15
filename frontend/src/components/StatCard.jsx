// A single figure with the words that make it mean something.
//
// The report and audit screens call it with a label, a value and sometimes a
// hint, which is all it ever took. The dashboard passes two more: an icon, so
// a row of figures can be scanned by subject rather than read in order, and
// emphasis, which is what lets the four figures a programme review opens with
// be visibly larger than the three counts underneath them. Neither changes
// anything for a caller that leaves them out.
export default function StatCard({
  label,
  value,
  hint,
  icon = null,
  tone = 'neutral',
  emphasis = false,
  children = null,
}) {
  const className = emphasis ? 'card stat-card stat-card-lead' : 'card stat-card'
  const iconClass = tone === 'neutral' ? 'stat-icon' : `stat-icon stat-icon-${tone}`

  return (
    <div className={className}>
      <div className="stat-head">
        <div className="stat-label">{label}</div>
        {icon ? (
          <span className={iconClass} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
      {children}
    </div>
  )
}
