// A bullet meter for a table cell: the track is the reference (100% of budget,
// or the full schedule), the fill is where the row actually stands.
//
// The three states are a status encoding, so the colour never carries the
// meaning on its own - the percentage is always printed next to the bar, and
// anything past 100% also gets a word.
export function meterState(percent) {
  if (percent === null || percent === undefined) return 'unknown'
  if (percent > 100) return 'critical'
  if (percent >= 90) return 'warning'
  return 'normal'
}

// Pass state="normal" for a bar that only shows relative size (headcount,
// project load) - the threshold colours mean "over the reference" and would be
// misleading on a scale that has no limit to cross.
export default function Meter({ percent, note, state: forcedState, display }) {
  const state = forcedState || meterState(percent)
  const filled = Math.max(0, Math.min(percent || 0, 100))

  return (
    <div className="meter">
      <div className="meter-track">
        <div className={`meter-fill meter-${state}`} style={{ width: `${filled}%` }} />
        {state === 'critical' ? <span className="meter-overflow" /> : null}
      </div>
      <span className="meter-value">
        {display ?? (percent === null || percent === undefined ? '-' : `${percent}%`)}
      </span>
      {note ? <span className={`meter-note meter-note-${state}`}>{note}</span> : null}
    </div>
  )
}
