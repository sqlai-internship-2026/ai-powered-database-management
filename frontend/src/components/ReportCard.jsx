import { useState } from 'react'
import { downloadCsv } from '../utils/csv'

// Wraps one chart. Every chart gets a table twin behind the Table toggle and a
// CSV button, so no value is reachable only by hovering a mark.
//
// columns: [{ key, header, value?, align? }] - the same shape feeds the table
// view and the CSV export.
export default function ReportCard({
  title,
  description,
  columns,
  rows,
  csvName,
  loading = false,
  children,
}) {
  const [view, setView] = useState('chart')
  const hasRows = rows && rows.length > 0

  return (
    <section className={loading ? 'card report-card is-loading' : 'card report-card'}>
      <header className="report-card-head">
        <div>
          <h3 className="report-card-title">{title}</h3>
          {description ? (
            <p className="report-card-description">{description}</p>
          ) : null}
        </div>
        <div className="report-card-actions">
          <div className="view-switch" role="group" aria-label={`${title} view`}>
            <button
              type="button"
              className={view === 'chart' ? 'filter-button active' : 'filter-button'}
              onClick={() => setView('chart')}
            >
              Chart
            </button>
            <button
              type="button"
              className={view === 'table' ? 'filter-button active' : 'filter-button'}
              onClick={() => setView('table')}
            >
              Table
            </button>
          </div>
          <button
            type="button"
            className="button"
            disabled={!hasRows}
            onClick={() => downloadCsv(csvName || title, columns, rows)}
          >
            CSV
          </button>
        </div>
      </header>

      <div className="report-card-body">
        {view === 'chart' ? (
          children
        ) : !hasRows ? (
          <p className="chart-empty">Nothing to show for this selection.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={column.align === 'right' ? 'align-right' : undefined}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id ?? row.label ?? index}>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={column.align === 'right' ? 'align-right' : undefined}
                      >
                        {column.value ? column.value(row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
