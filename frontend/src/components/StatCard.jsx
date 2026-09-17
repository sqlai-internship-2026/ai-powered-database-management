// A single figure with the words that make it mean something.
//
// The report and audit screens call it with a label, a value and sometimes a
// hint, which is all it ever took. The dashboard passes two more: an icon, so
// a row of figures can be scanned by subject rather than read in order, and
// emphasis, which is what lets the four figures a programme review opens with
// be visibly larger than the three counts underneath them. Neither changes
// anything for a caller that leaves them out.
//
// tone is the state the figure is in, and it is spent carefully: an edge in
// the state's ink and the number in it, on the cards that earned it. A row
// where every card is coloured says nothing, so "primary" and "neutral" stay
// plain and only warning, danger, success and info take a colour.
//
// onClick turns the card into a filter for whatever it counts. It becomes a
// real button then - reachable by keyboard, and announcing through aria-pressed
// whether its filter is the one currently applied.
export default function StatCard({
  label,
  value,
  hint,
  icon = null,
  tone = 'neutral',
  emphasis = false,
  children = null,
  onClick = null,
  active = false,
}) {
  const classes = ['card', 'stat-card']
  if (emphasis) classes.push('stat-card-lead')
  if (tone !== 'neutral') classes.push(`stat-card-${tone}`)
  if (onClick) classes.push('stat-card-action')
  if (active) classes.push('is-on')

  const iconClass = tone === 'neutral' ? 'stat-icon' : `stat-icon stat-icon-${tone}`

  const body = (
    <>
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
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={classes.join(' ')}
        onClick={onClick}
        aria-pressed={active}
      >
        {body}
      </button>
    )
  }

  return <div className={classes.join(' ')}>{body}</div>
}
