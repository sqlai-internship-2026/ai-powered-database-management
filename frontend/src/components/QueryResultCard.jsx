import { useState } from 'react'
import AutoChart from './charts/AutoChart'
import SegmentedControl from './SegmentedControl'
import { CodeIcon, CopyIcon, DownloadIcon } from './icons'
import { downloadCsv } from '../utils/csv'
import { describeRowCount } from '../utils/format'

// One answered question: its title, the sentence describing it, the chart, the
// query that produced it and the rows behind it.
//
// The same component draws the answer that just came back and every card
// already added to a report. They are the same thing at different ages, and
// keeping one component means a card cannot quietly gain or lose a control by
// being saved.
//
// The card owns no state that matters. Which chart type is showing, and which
// column it is measuring, are held by the page - both have to survive being
// written into a saved report, and state that lives in a component cannot.

const TYPE_LABELS = {
  kpi: 'Figures',
  column: 'Columns',
  line: 'Line',
  bar: 'Bars',
  donut: 'Donut',
  table: 'Table',
}

export default function QueryResultCard({
  card,
  onTypeChange,
  onValueChange,
  onTitleChange,
  actions,
}) {
  const [showSql, setShowSql] = useState(false)
  const [copied, setCopied] = useState(false)

  const chart = card.chart
  const alternatives = chart?.alternatives || ['table']
  const measures = chart?.value_columns || []

  // A saved card carries the type its reader chose, but the result behind it is
  // fetched again and can come back a different shape - a query that returned
  // six periods last month returns thirty this one. When the choice no longer
  // fits, the backend's reading of the new result wins rather than a donut
  // being drawn out of columns that cannot fill one.
  const activeType = alternatives.includes(card.type)
    ? card.type
    : chart?.type || 'table'
  const activeValue = measures.includes(card.valueColumn)
    ? card.valueColumn
    : chart?.value_column

  async function copySql() {
    try {
      await navigator.clipboard.writeText(card.sql)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be blocked; the query is selectable anyway.
    }
  }

  return (
    <section className={card.loading ? 'card report-card is-loading' : 'card report-card'}>
      <header className="report-card-head">
        <div className="card-heading">
          {onTitleChange ? (
            <input
              className="card-title-input"
              value={card.title}
              maxLength={120}
              aria-label="Card title"
              onChange={(event) => onTitleChange(event.target.value)}
            />
          ) : (
            <h3 className="report-card-title">{card.title}</h3>
          )}
          {/* Four things can be true about a result and they are not the same
              thing: how many rows there are, that the row limit cut it off,
              that it is being run again, and why it was drawn the way it was. */}
          <p className="report-card-description">
            <span className="result-count">
              {describeRowCount({
                rowCount: card.row_count,
                truncated: card.truncated,
                totalRows: card.total_rows,
              })}
            </span>
            {card.truncated ? (
              <span className="chip chip-risk-medium">Cut off at the row limit</span>
            ) : null}
            {card.loading ? (
              <span className="chip chip-pending" role="status">
                Running again...
              </span>
            ) : null}
            {chart?.reason ? (
              <span className="result-reason">{chart.reason}</span>
            ) : null}
          </p>
        </div>
        <div className="report-card-actions">{actions}</div>
      </header>

      {card.error ? (
        <div className="notice notice-danger card-inset">{card.error}</div>
      ) : null}

      {card.answer ? <p className="chat-summary">{card.answer}</p> : null}

      {/* Only the types this result can honestly be read as. A shape that
          cannot carry a donut never shows a donut button, rather than showing
          one that draws something misleading. */}
      {alternatives.length > 1 || measures.length > 1 ? (
        <div className="chart-controls">
          {alternatives.length > 1 ? (
            <SegmentedControl
              label="Chart type"
              value={activeType}
              size="sm"
              options={alternatives.map((name) => ({
                value: name,
                label: TYPE_LABELS[name] || name,
              }))}
              onChange={(name) => onTypeChange?.(name)}
            />
          ) : null}

          {/* Several numeric columns and one chart: the reader picks which one
              the marks stand for, rather than the first column always winning. */}
          {measures.length > 1 && activeType !== 'table' && activeType !== 'kpi' ? (
            <label className="field chart-measure">
              <span className="field-label">Measure</span>
              <select
                value={activeValue}
                onChange={(event) => onValueChange?.(event.target.value)}
              >
                {measures.map((column) => (
                  <option key={column} value={column}>
                    {column.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="report-card-body">
        <AutoChart
          spec={chart}
          columns={card.columns}
          rows={card.rows}
          type={activeType}
          valueColumn={activeValue}
        />
      </div>

      {/* Below the answer and set as links: the query and the download are how
          a reader checks or keeps a result, not what the card is for. */}
      <div className="card-footer">
        <button
          type="button"
          className="link-button chat-sql-toggle"
          aria-expanded={showSql}
          onClick={() => setShowSql((current) => !current)}
        >
          <CodeIcon size={14} />
          {showSql ? 'Hide SQL' : 'Show SQL'}
        </button>
        <button
          type="button"
          className="link-button"
          disabled={!card.rows?.length}
          onClick={() =>
            downloadCsv(
              card.title || 'answer',
              card.columns.map((column) => ({ key: column, header: column })),
              card.rows,
            )
          }
        >
          <DownloadIcon size={14} />
          Download CSV
        </button>
      </div>

      {/* Folded away rather than removed. The query is the only way to judge
          whether a number means what the title claims, so it stays one click
          from every card - but a report of six cards is unreadable with six
          queries printed through it. */}
      {showSql ? (
        <div className="code-block">
          <button type="button" className="copy-button" onClick={copySql}>
            {copied ? 'Copied' : <CopyIcon size={13} />}
            {copied ? null : <span className="visually-hidden">Copy the SQL</span>}
          </button>
          <pre>{card.sql}</pre>
          {/* Announced rather than only shown: the button changing its own
              label is invisible to a reader who is not looking at it. */}
          <span className="visually-hidden" role="status" aria-live="polite">
            {copied ? 'SQL copied to the clipboard' : ''}
          </span>
        </div>
      ) : null}
    </section>
  )
}
