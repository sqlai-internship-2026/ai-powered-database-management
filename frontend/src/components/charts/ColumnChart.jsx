import { useState } from 'react'

// Columns over time for one series. Built from flex boxes rather than a scaled
// SVG so the labels never stretch, and the wrapper reserves a band under the
// plot for the x-axis instead of clipping it.
//
// Only two columns are direct-labelled - the tallest and the last - because a
// number over every column is noise; the value axis and the hover tooltip carry
// the rest.
const GRID_STEPS = [1, 0.75, 0.5, 0.25, 0]

// The value axis is mapped into the lower part of the plot box, leaving a band
// at the top for the peak label and the tooltip. Bars and gridlines share the
// factor, so a tick label always sits on the line it belongs to.
const SCALE = 0.82

export default function ColumnChart({
  data,
  formatValue = (value) => value,
  formatTick,
  emptyMessage = 'Nothing to chart for this selection.',
}) {
  const [hovered, setHovered] = useState(null)

  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>
  }

  const max = Math.max(...data.map((row) => row.value || 0), 0)
  const tick = formatTick || formatValue
  const peakIndex = data.reduce(
    (best, row, index) => ((row.value || 0) > (data[best].value || 0) ? index : best),
    0,
  )

  return (
    <div className="column-chart">
      <div className="column-axis">
        {GRID_STEPS.map((step) => (
          <div
            className="column-axis-tick"
            key={step}
            style={{ bottom: `${step * SCALE * 100}%` }}
          >
            {tick(max * step)}
          </div>
        ))}
      </div>

      <div className="column-plot-wrap">
        <div className="column-plot">
          {GRID_STEPS.map((step) => (
            <div
              className="column-gridline"
              key={step}
              style={{ bottom: `${step * SCALE * 100}%` }}
            />
          ))}

          {data.map((row, index) => {
            const height = max > 0 ? ((row.value || 0) / max) * SCALE * 100 : 0
            const active = hovered === row.label
            const labelled = index === peakIndex || index === data.length - 1
            return (
              <div
                key={row.label}
                className={active ? 'column-slot active' : 'column-slot'}
                onMouseEnter={() => setHovered(row.label)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(row.label)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
              >
                {active ? (
                  <div className="column-tooltip" style={{ bottom: `${height}%` }}>
                    <strong>{row.label}</strong>
                    <span>{formatValue(row.value)}</span>
                    {row.hint ? <span className="muted">{row.hint}</span> : null}
                  </div>
                ) : labelled ? (
                  <div className="column-point-label" style={{ bottom: `${height}%` }}>
                    {formatValue(row.value)}
                  </div>
                ) : null}
                <div className="column-bar" style={{ height: `${height}%` }} />
              </div>
            )
          })}
        </div>

        <div className="column-labels">
          {data.map((row) => (
            <div className="column-label" key={row.label}>
              {row.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
