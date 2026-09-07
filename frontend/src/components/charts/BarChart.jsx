import { useState } from 'react'

// Horizontal bars for one series over nominal categories: the length carries
// the magnitude, so every bar gets the same colour. There is no legend because
// there is nothing to tell apart - the card title names the series.
//
// Values are direct-labelled at the bar end: with a handful of sorted rows the
// chart reads like a table, and the label is what keeps the value reachable
// without hovering.
export default function BarChart({
  data,
  formatValue = (value) => value,
  emptyMessage = 'Nothing to chart for this selection.',
}) {
  const [hovered, setHovered] = useState(null)

  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>
  }

  const max = Math.max(...data.map((row) => row.value || 0), 0)

  return (
    <div className="bar-chart">
      {data.map((row) => {
        const share = max > 0 ? ((row.value || 0) / max) * 100 : 0
        const active = hovered === row.label
        return (
          <div
            key={row.label}
            className={active ? 'bar-row active' : 'bar-row'}
            onMouseEnter={() => setHovered(row.label)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(row.label)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
          >
            <div className="bar-label" title={row.label}>
              {row.label}
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${share}%` }} />
            </div>
            <div className="bar-value">{formatValue(row.value)}</div>
            {row.hint ? <div className="bar-hint">{row.hint}</div> : null}
          </div>
        )
      })}
    </div>
  )
}
