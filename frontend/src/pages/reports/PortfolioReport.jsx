import { useOutletContext } from 'react-router-dom'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import ReportCard from '../../components/ReportCard'
import BarChart from '../../components/charts/BarChart'
import Meter from '../../components/charts/Meter'
import { buildQuery, useApiData } from '../../utils/api'
import {
  formatCompactCurrency,
  formatCurrency,
  formatMonths,
  formatNumber,
  formatPercent,
} from '../../utils/format'

const categoryColumns = [
  { key: 'label', header: 'Category' },
  { key: 'product_count', header: 'Catalog items', align: 'right' },
  { key: 'unit_count', header: 'Units on programs', align: 'right' },
  {
    key: 'amount',
    header: 'Hardware cost',
    align: 'right',
    value: (row) => formatCurrency(row.amount),
  },
]

const scheduleColumns = [
  { key: 'name', header: 'Program' },
  { key: 'status', header: 'Status' },
  { key: 'start_date', header: 'Start' },
  { key: 'end_date', header: 'End' },
  { key: 'duration_months', header: 'Duration (months)', align: 'right' },
  {
    key: 'months_remaining',
    header: 'Remaining',
    align: 'right',
    value: (row) => formatMonths(row.months_remaining),
  },
  {
    key: 'time_elapsed_percent',
    header: 'Elapsed',
    align: 'right',
    value: (row) => formatPercent(row.time_elapsed_percent),
  },
]

const usageColumns = [
  { key: 'name', header: 'Program' },
  { key: 'product_count', header: 'Distinct products', align: 'right' },
  { key: 'unit_count', header: 'Units', align: 'right' },
  {
    key: 'hardware_cost',
    header: 'Hardware cost',
    align: 'right',
    value: (row) => formatCurrency(row.hardware_cost),
  },
  {
    key: 'percent_of_budget',
    header: 'Share of budget',
    align: 'right',
    value: (row) => formatPercent(row.percent_of_budget),
  },
]

const productColumns = [
  { key: 'name', header: 'Product' },
  { key: 'category', header: 'Category' },
  {
    key: 'unit_cost',
    header: 'Unit cost',
    align: 'right',
    value: (row) => formatCurrency(row.unit_cost),
  },
  { key: 'unit_count', header: 'Units', align: 'right' },
  { key: 'project_count', header: 'Programs', align: 'right' },
  {
    key: 'amount',
    header: 'Total cost',
    align: 'right',
    value: (row) => formatCurrency(row.amount),
  },
]

export default function PortfolioReport() {
  const { filters } = useOutletContext()
  const query = buildQuery({ status: filters.statuses })
  const { data, loading, error } = useApiData(`/api/reports/portfolio${query}`)

  if (error) {
    return <div className="card placeholder">Could not load the report: {error}</div>
  }
  if (!data) {
    return <div className="card placeholder">Building the portfolio report...</div>
  }

  const {
    summary,
    schedule,
    product_usage: usage,
    by_category: byCategory,
    top_products: topProducts,
  } = data

  return (
    <div className={loading ? 'report-body is-refetching' : 'report-body'}>
      <div className="stat-grid">
        <StatCard
          label="Programs"
          value={formatNumber(summary.project_count)}
          hint={`${formatNumber(summary.average_duration_months)} months average duration`}
        />
        <StatCard
          label="Hardware Cost"
          value={formatCompactCurrency(summary.hardware_cost)}
          hint={`${formatNumber(summary.unit_count)} units across the portfolio`}
        />
        <StatCard
          label="Catalog Items"
          value={formatNumber(summary.catalog_size)}
          hint="Products and subsystems"
        />
        <StatCard
          label="Ending Within A Year"
          value={formatNumber(summary.ending_soon_count)}
          hint="Active programs closing in 12 months"
        />
        <StatCard
          label="Past End Date"
          value={formatNumber(summary.overdue_count)}
          hint="Still Active or On Hold"
        />
      </div>

      <ReportCard
        title="Schedule position"
        description="Where each program sits between its start and end date, soonest deadline first."
        columns={scheduleColumns}
        rows={schedule}
        csvName="program-schedule"
        loading={loading}
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Program</th>
                <th>Status</th>
                <th>Start</th>
                <th>End</th>
                <th className="align-right">Remaining</th>
                <th className="meter-column">Time elapsed</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((project) => {
                const overdue =
                  ['Active', 'On Hold'].includes(project.status) &&
                  (project.months_remaining || 0) < 0
                return (
                  <tr key={project.id}>
                    <td>{project.name}</td>
                    <td>
                      <StatusBadge status={project.status} />
                    </td>
                    <td>{project.start_date}</td>
                    <td>{project.end_date}</td>
                    <td className="align-right">
                      {formatMonths(project.months_remaining)}
                    </td>
                    <td className="meter-column">
                      <Meter
                        percent={project.time_elapsed_percent}
                        state={overdue ? 'critical' : 'normal'}
                        note={overdue ? 'Past end date' : null}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ReportCard>

      <div className="report-grid">
        <ReportCard
          title="Hardware cost by category"
          description="Unit cost multiplied by the quantity each program consumes."
          columns={categoryColumns}
          rows={byCategory}
          csvName="hardware-cost-by-category"
          loading={loading}
        >
          <BarChart
            data={byCategory.map((row) => ({
              label: row.label,
              value: row.amount,
              hint: `${formatNumber(row.unit_count)} units`,
            }))}
            formatValue={formatCompactCurrency}
          />
        </ReportCard>

        <ReportCard
          title="Hardware cost by program"
          description="Material cost only - a program budget also covers labour, test and certification."
          columns={usageColumns}
          rows={usage}
          csvName="hardware-cost-by-program"
          loading={loading}
        >
          <BarChart
            data={usage.map((row) => ({
              label: row.name,
              value: row.hardware_cost,
              hint: `${formatPercent(row.percent_of_budget)} of budget`,
            }))}
            formatValue={formatCompactCurrency}
          />
        </ReportCard>
      </div>

      <ReportCard
        title="Product consumption"
        description="Which catalog items the portfolio actually draws on."
        columns={productColumns}
        rows={topProducts}
        csvName="product-consumption"
        loading={loading}
      >
        <BarChart
          data={topProducts.map((row) => ({
            label: row.name,
            value: row.amount,
            hint: `${formatNumber(row.unit_count)} units on ${formatNumber(row.project_count)} programs`,
          }))}
          formatValue={formatCompactCurrency}
        />
      </ReportCard>
    </div>
  )
}
