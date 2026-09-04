// Minimal table renderer used by every list page.
// columns: [{ key, header, render? }]
export default function DataTable({
  columns,
  rows,
  loading = false,
  error = null,
  emptyMessage = 'No records found.',
}) {
  if (loading) {
    return <div className="card placeholder">Loading records...</div>
  }

  if (error) {
    return <div className="card placeholder">Could not load data: {error}</div>
  }

  if (!rows || rows.length === 0) {
    return <div className="card placeholder">{emptyMessage}</div>
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
