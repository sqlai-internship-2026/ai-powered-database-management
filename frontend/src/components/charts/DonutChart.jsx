import { useState } from 'react'

// Shares of a total, for the questions that ask how something divides rather
// than which one is biggest. The backend only offers this shape when the
// numbers actually add up to something - never for an average or a rate - so
// the ring always stands for a real total.
//
// This is the one chart in the application that needs more than one colour: a
// donut separates its slices by hue, not by length. The ramp is a single blue
// running dark to light, ordered largest slice first, so the shades stay
// distinguishable to a colour-blind reader and the ordering itself carries as
// much information as the colour does. The legend prints the value and the
// percentage beside every label, so nothing is reachable by colour alone.
const MAX_SLICES = 8

// A ring drawn with stroke-dasharray on a circle: the radius sets the
// circumference, and every slice is a dash of the right length rotated into
// place. No arc maths, no path strings, and the browser antialiases the joins.
const RADIUS = 60
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function DonutChart({
  data,
  formatValue = (value) => value,
  emptyMessage = 'Nothing to chart for this selection.',
}) {
  const [hovered, setHovered] = useState(null)

  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>
  }

  const slices = data.slice(0, MAX_SLICES)
  const total = slices.reduce((sum, row) => sum + (row.value || 0), 0)

  if (total <= 0) {
    return <p className="chart-empty">Every value is zero, so there is no total to divide.</p>
  }

  let offset = 0
  const drawn = slices.map((row, index) => {
    const share = (row.value || 0) / total
    const slice = {
      ...row,
      share,
      // Where this slice starts, as a length along the ring.
      offset,
      length: share * CIRCUMFERENCE,
      tone: index + 1,
    }
    offset += slice.length
    return slice
  })

  const active = drawn.find((slice) => slice.label === hovered)

  return (
    <div className="donut-chart">
      <div className="donut-ring">
        <svg viewBox="0 0 160 160" role="img" aria-label="Share of the total">
          {drawn.map((slice) => (
            <circle
              key={slice.label}
              className={
                hovered && hovered !== slice.label
                  ? `donut-slice donut-tone-${slice.tone} dimmed`
                  : `donut-slice donut-tone-${slice.tone}`
              }
              cx="80"
              cy="80"
              r={RADIUS}
              strokeDasharray={`${slice.length} ${CIRCUMFERENCE - slice.length}`}
              strokeDashoffset={-slice.offset}
              onMouseEnter={() => setHovered(slice.label)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {/* The middle of a donut is the only place a total can go without
            competing with a slice for attention. */}
        <div className="donut-centre">
          <span className="donut-centre-value">
            {formatValue(active ? active.value : total)}
          </span>
          <span className="donut-centre-label">
            {active ? active.label : 'Total'}
          </span>
        </div>
      </div>

      <ul className="donut-legend">
        {drawn.map((slice) => (
          <li
            key={slice.label}
            className={hovered === slice.label ? 'donut-legend-row active' : 'donut-legend-row'}
            onMouseEnter={() => setHovered(slice.label)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(slice.label)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
          >
            <span className={`donut-swatch donut-tone-${slice.tone}`} />
            <span className="donut-legend-label" title={slice.label}>
              {slice.label}
            </span>
            <span className="donut-legend-value">{formatValue(slice.value)}</span>
            <span className="donut-legend-share">
              {(slice.share * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>

      {data.length > MAX_SLICES ? (
        <p className="donut-note">
          Showing the first {MAX_SLICES} of {data.length} rows. The rest are in the
          table.
        </p>
      ) : null}
    </div>
  )
}
