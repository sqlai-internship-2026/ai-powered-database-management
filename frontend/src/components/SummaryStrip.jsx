// A line of totals above a list, for the two screens where the question
// "how much of this is there altogether?" is asked of the table as a whole.
//
// Deliberately not a row of stat cards: these are the sum of the rows directly
// underneath them, not figures in their own right, and four large cards above
// a table would outweigh the thing they are describing.
export default function SummaryStrip({ items }) {
  return (
    <div className="summary-strip">
      {items.map((item) => (
        <div className="summary-item" key={item.label}>
          <div className="summary-label">{item.label}</div>
          <div className="summary-value">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
