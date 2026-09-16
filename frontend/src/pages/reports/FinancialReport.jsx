import { useOutletContext } from 'react-router-dom'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import ReportCard from '../../components/ReportCard'
import ReportBody from '../../components/ReportBody'
import StateBlock from '../../components/StateBlock'
import BarChart from '../../components/charts/BarChart'
import ColumnChart from '../../components/charts/ColumnChart'
import Meter, { meterState } from '../../components/charts/Meter'
import {
  AlertIcon,
  BudgetIcon,
  CheckCircleIcon,
  GaugeIcon,
  InvestmentsIcon,
} from '../../components/icons'
import { buildQuery, useApiData } from '../../utils/api'
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '../../utils/format'

const trendColumns = [
  { key: 'year', header: 'Year' },
  {
    key: 'amount',
    header: 'Committed',
    align: 'right',
    value: (row) => formatCurrency(row.amount),
  },
  { key: 'count', header: 'Investments', align: 'right' },
]

const typeColumns = [
  { key: 'label', header: 'Investment type' },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    value: (row) => formatCurrency(row.amount),
  },
  { key: 'count', header: 'Records', align: 'right' },
]

const projectColumns = [
  { key: 'name', header: 'Program' },
  { key: 'status', header: 'Status' },
  {
    key: 'budget',
    header: 'Budget',
    align: 'right',
    value: (row) => formatCurrency(row.budget),
  },
  {
    key: 'invested',
    header: 'Committed',
    align: 'right',
    value: (row) => formatCurrency(row.invested),
  },
  {
    key: 'remaining',
    header: 'Remaining',
    align: 'right',
    value: (row) => formatCurrency(row.remaining),
  },
  {
    key: 'utilization',
    header: 'Utilization',
    align: 'right',
    value: (row) => formatPercent(row.utilization),
  },
]

export default function FinancialReport() {
  const { filters } = useOutletContext()
  const query = buildQuery({
    year_from: filters.yearFrom,
    year_to: filters.yearTo,
    status: filters.statuses,
  })
  const { data, loading, error } = useApiData(`/api/reports/financial${query}`)

  if (error) {
    return (
      <div className="card">
        <StateBlock
          variant="error"
          title="Could not load the financial report"
          text={error}
        />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="card">
        <StateBlock variant="loading" title="Building the financial report" lines={6} />
      </div>
    )
  }

  const { summary, projects, trend, by_type: byType } = data

  return (
    <ReportBody loading={loading}>
      <div className="stat-grid">
        <StatCard
          label="Total Budget"
          value={formatCompactCurrency(summary.total_budget)}
          hint={`${formatNumber(summary.project_count)} programs in scope`}
          icon={<BudgetIcon size={17} />}
          tone="primary"
        />
        <StatCard
          label="Committed"
          value={formatCompactCurrency(summary.total_invested)}
          hint={`${formatNumber(summary.investment_count)} investment records`}
          icon={<InvestmentsIcon size={17} />}
        />
        <StatCard
          label="Budget Utilization"
          value={formatPercent(summary.utilization)}
          hint="Committed against total budget"
          icon={<GaugeIcon size={17} />}
        />
        <StatCard
          label="Uncommitted"
          value={formatCompactCurrency(summary.total_remaining)}
          hint="Budget not yet drawn"
          icon={<CheckCircleIcon size={17} />}
        />
        <StatCard
          label="Over Budget"
          value={formatNumber(summary.over_budget_count)}
          hint="Programs past 100% utilization"
          icon={<AlertIcon size={17} />}
          tone={summary.over_budget_count > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="report-grid">
        <ReportCard
          title="Committed investment by year"
          description="Money committed against the programs in scope, by the year it was recorded."
          columns={trendColumns}
          rows={trend}
          csvName="investment-by-year"
          loading={loading}
        >
          <ColumnChart
            data={trend.map((row) => ({
              label: String(row.year),
              value: row.amount,
              hint: `${formatNumber(row.count)} records`,
            }))}
            formatValue={formatCompactCurrency}
          />
        </ReportCard>

        <ReportCard
          title="Committed investment by type"
          description="What the money was spent on, largest first."
          columns={typeColumns}
          rows={byType}
          csvName="investment-by-type"
          loading={loading}
        >
          <BarChart
            data={byType.map((row) => ({
              label: row.label,
              value: row.amount,
              hint: `${formatNumber(row.count)} records`,
            }))}
            formatValue={formatCompactCurrency}
          />
        </ReportCard>
      </div>

      <ReportCard
        title="Budget against committed spend"
        description="One row per program. The meter fills to 100% of budget; anything past it is over-committed."
        columns={projectColumns}
        rows={projects}
        csvName="program-budget"
        loading={loading}
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Program</th>
                <th>Status</th>
                <th className="align-right">Budget</th>
                <th className="align-right">Committed</th>
                <th className="align-right">Remaining</th>
                <th className="meter-column">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="align-right">{formatCurrency(project.budget)}</td>
                  <td className="align-right">{formatCurrency(project.invested)}</td>
                  <td className="align-right">{formatCurrency(project.remaining)}</td>
                  <td className="meter-column">
                    {/* "Over budget" is the backend's own verdict rather than
                        something read back out of the percentage: a zero budget
                        has no percentage, and the tile above would then count a
                        program whose own row said nothing. "Near limit" is a
                        question about the percentage, so it stays one. */}
                    <Meter
                      percent={project.utilization}
                      state={project.over_budget ? 'critical' : undefined}
                      note={
                        project.over_budget
                          ? 'Over budget'
                          : meterState(project.utilization) === 'warning'
                            ? 'Near limit'
                            : null
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCard>
    </ReportBody>
  )
}
