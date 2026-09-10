import BarChart from './BarChart'
import ColumnChart from './ColumnChart'
import DonutChart from './DonutChart'
import LineChart from './LineChart'
import StatCard from '../StatCard'
import ResultTable from '../ResultTable'
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '../../utils/format'

// Draws whatever a generated query returned, following the spec the backend
// worked out from the shape of the result. Nothing here knows the schema, and
// nothing here decides anything: the rules live in backend/reports/chart_spec.py
// so they can be tested without a browser, and this file only maps their names
// onto components.
//
// The reader can override the type, and the parent owns that choice - it has to
// survive being saved into a report - so `type` and `valueColumn` come in as
// props rather than being state here.

// Charts get the compact form: a bar labelled "2.9B TRY" reads at a glance,
// where the full figure would collide with the bar beside it. Tables keep the
// exact number, which is why the two differ.
const CHART_FORMATTERS = {
  currency: formatCompactCurrency,
  percent: (value) => formatPercent(value),
  count: (value) => formatNumber(Math.round(value)),
  number: formatNumber,
  text: (value) => String(value ?? '-'),
}

const FIGURE_FORMATTERS = {
  ...CHART_FORMATTERS,
  currency: formatCurrency,
}

export function chartFormatter(format, compact = true) {
  const table = compact ? CHART_FORMATTERS : FIGURE_FORMATTERS
  return table[format] || formatNumber
}

// A label of null is a real answer - the employees with no department - and
// it needs a word, because an empty axis label looks like a rendering fault.
function labelOf(value) {
  if (value === null || value === undefined || value === '') return 'Not set'
  return String(value)
}

export function chartData(spec, rows, valueColumn) {
  if (!spec || !spec.label_column) return []
  const measure = valueColumn || spec.value_column
  return rows.map((row) => ({
    label: labelOf(row[spec.label_column]),
    value: Number(row[measure] ?? 0),
    hint: spec.hint_column ? labelOf(row[spec.hint_column]) : undefined,
  }))
}

export default function AutoChart({
  spec,
  columns,
  rows,
  type,
  valueColumn,
  emptyMessage,
}) {
  const chosen = type || spec?.type || 'table'
  const measure = valueColumn || spec?.value_column

  if (chosen === 'table' || !spec || !rows) {
    return <ResultTable columns={columns} rows={rows || []} emptyMessage={emptyMessage} />
  }

  if (chosen === 'kpi') {
    // One card per number, so a row of three totals reads as three figures
    // rather than as a table with a single line in it.
    const measures = spec.value_columns?.length ? spec.value_columns : [measure]
    return (
      <div className="stat-grid">
        {measures.map((column) => (
          <StatCard
            key={column}
            label={column.replace(/_/g, ' ')}
            value={chartFormatter(spec.formats?.[column], false)(rows[0]?.[column])}
          />
        ))}
      </div>
    )
  }

  const data = chartData(spec, rows, measure)
  const format = spec.formats?.[measure]
  const formatValue = chartFormatter(format)

  if (chosen === 'donut') {
    return <DonutChart data={data} formatValue={formatValue} />
  }

  if (chosen === 'line') {
    return (
      <LineChart
        data={data}
        formatValue={formatValue}
        formatTick={chartFormatter(format)}
      />
    )
  }

  if (chosen === 'column') {
    return (
      <ColumnChart
        data={data}
        formatValue={formatValue}
        formatTick={chartFormatter(format)}
      />
    )
  }

  return <BarChart data={data} formatValue={formatValue} />
}
