// One choice out of two or three, shown as a single control rather than as a
// row of separate buttons: Chart or Table, and the chart types a result can
// honestly be drawn as.
//
// The selected segment is marked three ways over - a raised surface, darker
// ink and aria-pressed - so it survives being read without colour and being
// read by a screen reader.
export default function SegmentedControl({
  label,
  value,
  options,
  onChange,
  size = 'md',
}) {
  return (
    <div
      className={size === 'sm' ? 'segmented segmented-sm' : 'segmented'}
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={selected ? 'segment is-selected' : 'segment'}
            aria-pressed={selected}
            onClick={() => onChange?.(option.value)}
          >
            {option.icon ? (
              <span className="segment-icon" aria-hidden="true">
                {option.icon}
              </span>
            ) : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
