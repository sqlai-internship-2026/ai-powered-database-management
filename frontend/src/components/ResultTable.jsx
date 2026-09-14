import { useEffect, useState } from 'react'

// Renders whatever columns a generated query happened to return. Nothing here
// knows the schema: the backend sends the column names it read off the cursor,
// so a question nobody anticipated still draws a correct header.
//
// Shared by the assistant and the ask report, which show the same rows in
// different surroundings.
//
// Long results are paged here in the browser, over the rows the backend has
// already sent. Paging is a display concern rather than a second query, and
// keeping it here is what makes it safe: an OFFSET back to the database would
// depend on the generated SQL carrying an ORDER BY, and without one Postgres
// is free to order the second read differently - the same row on two pages,
// another on none, and no way for a reader to tell.

const PAGE_SIZE = 50

export function formatCell(value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') return value.toLocaleString('en-US')
  return String(value)
}

export default function ResultTable({ columns, rows, emptyMessage }) {
  const [page, setPage] = useState(0)

  // A refreshed card fetches new rows, and page seven of the old result says
  // nothing about the new one.
  useEffect(() => setPage(0), [rows])

  if (rows.length === 0) {
    return (
      <p className="chart-empty">
        {emptyMessage ??
          'The query ran and returned no rows. That is an answer too - nothing in the data matches the question.'}
      </p>
    )
  }

  const pageCount = Math.ceil(rows.length / PAGE_SIZE)
  // Clamped rather than trusted: the effect above resets on the next render,
  // and one frame of an out-of-range slice would draw an empty table.
  const current = Math.min(page, pageCount - 1)
  const first = current * PAGE_SIZE
  const shown = pageCount > 1 ? rows.slice(first, first + PAGE_SIZE) : rows

  return (
    <>
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
            {shown.map((row, index) => (
              <tr key={first + index}>
                {columns.map((column) => (
                  <td key={column}>{formatCell(row[column])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Absent entirely below one page: "1 of 1" under a three row answer is
          furniture, not information. */}
      {pageCount > 1 ? (
        <div className="table-pager">
          <span className="table-pager-range">
            {`${(first + 1).toLocaleString('en-US')}-${Math.min(
              first + PAGE_SIZE,
              rows.length,
            ).toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')}`}
          </span>
          <div className="table-pager-controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Previous page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              ←
            </button>
            <span className="table-pager-page">
              {current + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Next page"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              →
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
