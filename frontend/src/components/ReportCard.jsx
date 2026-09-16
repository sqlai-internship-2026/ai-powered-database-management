import { useId, useState } from 'react'
import SegmentedControl from './SegmentedControl'
import StateBlock from './StateBlock'
import { ChartIcon, DownloadIcon, TableIcon } from './icons'
import { downloadCsv } from '../utils/csv'
import { useT } from '../i18n'

// Wraps one chart. Every chart gets a table twin behind the Table toggle and a
// CSV button, so no value is reachable only by hovering a mark.
//
// columns: [{ key, header, value?, align? }] - the same shape feeds the table
// view and the CSV export.
//
// wide marks the cards that are a table rather than a chart: they keep the full
// width of the page instead of sitting in the two-column grid, where a six
// column table would be a scrollbar.
const VIEWS = ['chart', 'table']

const VIEW_ICONS = {
  chart: <ChartIcon size={14} />,
  table: <TableIcon size={14} />,
}

const VIEW_LABELS = { chart: 'Chart', table: 'Table' }

export default function ReportCard({
  title,
  description,
  columns,
  rows,
  csvName,
  loading = false,
  children,
}) {
  const t = useT()
  const [view, setView] = useState('chart')
  const headingId = useId()
  const viewOptions = VIEWS.map((value) => ({
    value,
    label: t(VIEW_LABELS[value]),
    icon: VIEW_ICONS[value],
  }))
  const hasRows = rows && rows.length > 0

  return (
    <section
      className={loading ? 'card report-card is-loading' : 'card report-card'}
      aria-labelledby={headingId}
    >
      <header className="report-card-head">
        <div className="report-card-heading">
          <h3 className="report-card-title" id={headingId}>
            {title}
          </h3>
          {description ? (
            <p className="report-card-description">{description}</p>
          ) : null}
        </div>
        <div className="report-card-actions">
          <SegmentedControl
            label={t('{title} view', { title })}
            value={view}
            options={viewOptions}
            onChange={setView}
            size="sm"
          />
          {/* Says what it does rather than naming a file format and leaving the
              reader to guess whether it downloads, copies or prints. */}
          <button
            type="button"
            className="button button-sm"
            disabled={!hasRows}
            title={t('Download the rows behind "{title}" as a CSV file', { title })}
            onClick={() =>
              downloadCsv(
                csvName || title,
                // The export carries the headings the reader can see.
                columns.map((column) => ({ ...column, header: t(column.header) })),
                rows,
              )
            }
          >
            <DownloadIcon size={14} />
            {t('Download CSV')}
          </button>
        </div>
      </header>

      <div className="report-card-body">
        {view === 'chart' ? (
          children
        ) : !hasRows ? (
          <StateBlock
            title={t('Nothing to show')}
            text={t(
              'No rows match the filters above. Widen them, or clear them, to see this report.',
            )}
          />
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
                      {t(column.header)}
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
