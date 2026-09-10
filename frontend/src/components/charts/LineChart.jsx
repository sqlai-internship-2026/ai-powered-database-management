import { useState } from 'react'

// One series over a time axis, for the runs too long to read as columns. The
// same axis, gridlines and scale factor as ColumnChart, so a report that shows
// both does not appear to change its mind about where zero is.
//
// The line itself is an SVG stretched over the plot box, which is why it
// carries preserveAspectRatio="none" and a non-scaling stroke: the geometry is
// distorted to fit the box, the stroke width is not. Everything a reader can
// point at - the dots, the tooltip, the labels - stays in the DOM at real
// pixel sizes on top of it.
const GRID_STEPS = [1, 0.75, 0.5, 0.25, 0]

// Shared with ColumnChart: the value axis uses the lower part of the plot box
// and leaves a band at the top for the peak label and the tooltip.
const SCALE = 0.82

// A label under every point turns a long series into a wall of digits, so the
// x-axis thins itself out and keeps the first and the last.
function labelStep(count) {
  return Math.max(1, Math.ceil(count / 12))
}

export default function LineChart({
  data,
  formatValue = (value) => value,
  formatTick,
  emptyMessage = 'Nothing to chart for this selection.',
}) {
  const [hovered, setHovered] = useState(null)

  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>
  }

  // A single point has no line to draw, and dividing by zero below would put
  // it at NaN% from the left.
  if (data.length === 1) {
    return (
      <p className="chart-empty">
        {data[0].label}: {formatValue(data[0].value)}
      </p>
    )
  }

  const max = Math.max(...data.map((row) => row.value || 0), 0)
  const tick = formatTick || formatValue
  const step = labelStep(data.length)
  const peakIndex = data.reduce(
    (best, row, index) => ((row.value || 0) > (data[best].value || 0) ? index : best),
    0,
  )

  // Each point sits in the middle of its own slot, the same slots the labels
  // below are laid out in. Stretching the series edge to edge instead would
  // read better as a line and put every label half a slot away from the point
  // it names, which is the one thing a time axis cannot afford.
  const points = data.map((row, index) => ({
    ...row,
    // Percentages rather than pixels, so the chart resizes with its card.
    x: ((index + 0.5) / data.length) * 100,
    y: max > 0 ? ((row.value || 0) / max) * SCALE * 100 : 0,
  }))

  // SVG measures y downwards, the layout measures it upwards from the floor.
  const path = points.map((point) => `${point.x},${100 - point.y}`).join(' ')
  const area = `${points[0].x},100 ${path} ${points[points.length - 1].x},100`

  return (
    <div className="line-chart">
      <div className="column-axis">
        {GRID_STEPS.map((value) => (
          <div
            className="column-axis-tick"
            key={value}
            style={{ bottom: `${value * SCALE * 100}%` }}
          >
            {tick(max * value)}
          </div>
        ))}
      </div>

      <div className="column-plot-wrap">
        <div className="line-plot">
          {GRID_STEPS.map((value) => (
            <div
              className="column-gridline"
              key={value}
              style={{ bottom: `${value * SCALE * 100}%` }}
            />
          ))}

          <svg
            className="line-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon className="line-area" points={area} />
            <polyline
              className="line-stroke"
              points={path}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {points.map((point, index) => {
            const active = hovered === point.label
            const labelled = index === peakIndex || index === points.length - 1
            return (
              <div
                key={point.label}
                className={active ? 'line-point active' : 'line-point'}
                style={{ left: `${point.x}%`, bottom: `${point.y}%` }}
                onMouseEnter={() => setHovered(point.label)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(point.label)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
              >
                <span className="line-dot" />
                {active ? (
                  <div className="column-tooltip line-tooltip">
                    <strong>{point.label}</strong>
                    <span>{formatValue(point.value)}</span>
                    {point.hint ? <span className="muted">{point.hint}</span> : null}
                  </div>
                ) : labelled ? (
                  <div className="line-point-label">{formatValue(point.value)}</div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="column-labels">
          {data.map((row, index) => (
            <div className="column-label" key={row.label}>
              {index % step === 0 || index === data.length - 1 ? row.label : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
