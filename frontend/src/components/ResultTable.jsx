// Renders whatever columns a generated query happened to return. Nothing here
// knows the schema: the backend sends the column names it read off the cursor,
// so a question nobody anticipated still draws a correct header.
//
// Shared by the assistant and the ask report, which show the same rows in
// different surroundings.

function formatCell(value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') return value.toLocaleString('en-US')
  return String(value)
}

export default function ResultTable({ columns, rows, emptyMessage }) {
  if (rows.length === 0) {
    return (
      <p className="chart-empty">
        {emptyMessage ??
          'The query ran and returned no rows. That is an answer too - nothing in the data matches the question.'}
      </p>
    )
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{formatCell(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { formatCell }
