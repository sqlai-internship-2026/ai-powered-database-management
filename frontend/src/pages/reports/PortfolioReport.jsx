import { useOutletContext } from 'react-router-dom'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import ReportCard from '../../components/ReportCard'
import ReportBody from '../../components/ReportBody'
import StateBlock from '../../components/StateBlock'
import BarChart from '../../components/charts/BarChart'
import Meter from '../../components/charts/Meter'
import {
  AlertIcon,
  ClockIcon,
  ProductsIcon,
  ProjectsIcon,
  BudgetIcon,
} from '../../components/icons'
import { buildQuery, useApiData } from '../../utils/api'
import { useT } from '../../i18n'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDay,
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
  { key: 'start_date', header: 'Start', value: (row) => formatDay(row.start_date) },
  { key: 'end_date', header: 'End', value: (row) => formatDay(row.end_date) },
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
  const t = useT()
  const query = buildQuery({ status: filters.statuses })
  const { data, loading, error } = useApiData(`/api/reports/portfolio${query}`)

  if (error) {
    return (
      <div className="card">
        <StateBlock
          variant="error"
          title={t('Could not load the portfolio report')}
          text={error}
        />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="card">
        <StateBlock
          variant="loading"
          title={t('Building the portfolio report')}
          lines={6}
        />
      </div>
    )
  }

  const {
    summary,
    schedule,
    product_usage: usage,
    by_category: byCategory,
    top_products: topProducts,
  } = data

  return (
    <ReportBody loading={loading}>
      <div className="stat-grid">
        <StatCard
          label={t('Programs')}
          value={formatNumber(summary.project_count)}
          hint={t('{count} months average duration', {
            count: formatNumber(summary.average_duration_months),
          })}
          icon={<ProjectsIcon size={17} />}
          tone="primary"
        />
        <StatCard
          label={t('Hardware Cost')}
          value={formatCompactCurrency(summary.hardware_cost)}
          hint={t('{count} units across the portfolio', {
            count: formatNumber(summary.unit_count),
          })}
          icon={<BudgetIcon size={17} />}
        />
        <StatCard
          label={t('Catalog Items')}
          value={formatNumber(summary.catalog_size)}
          hint={t('Products and subsystems')}
          icon={<ProductsIcon size={17} />}
        />
        <StatCard
          label={t('Ending Within A Year')}
          value={formatNumber(summary.ending_soon_count)}
          hint={t('Active programs closing in 12 months')}
          icon={<ClockIcon size={17} />}
          tone={summary.ending_soon_count > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label={t('Past End Date')}
          value={formatNumber(summary.overdue_count)}
          hint={t('Still Active or On Hold')}
          icon={<AlertIcon size={17} />}
          tone={summary.overdue_count > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <ReportCard
        title={t('Schedule position')}
        description={t(
          'Where each program sits between its start and end date, soonest deadline first.',
        )}
        columns={scheduleColumns}
        rows={schedule}
        csvName="program-schedule"
        loading={loading}
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t('Program')}</th>
                <th>{t('Status')}</th>
                <th>{t('Start')}</th>
                <th>{t('End')}</th>
                <th className="align-right">{t('Remaining')}</th>
                <th className="meter-column">{t('Time elapsed')}</th>
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
                    <td>{formatDay(project.start_date)}</td>
                    <td>{formatDay(project.end_date)}</td>
                    <td className="align-right">
                      {formatMonths(project.months_remaining)}
                    </td>
                    <td className="meter-column">
                      <Meter
                        percent={project.time_elapsed_percent}
                        state={overdue ? 'critical' : 'normal'}
                        note={overdue ? t('Past end date') : null}
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
          title={t('Hardware cost by category')}
          description={t(
            'Unit cost multiplied by the quantity each program consumes.',
          )}
          columns={categoryColumns}
          rows={byCategory}
          csvName="hardware-cost-by-category"
          loading={loading}
        >
          <BarChart
            data={byCategory.map((row) => ({
              // A product category is a label rather than a name.
              label: t(row.label),
              value: row.amount,
              hint: t('{count} units', { count: formatNumber(row.unit_count) }),
            }))}
            formatValue={formatCompactCurrency}
          />
        </ReportCard>

        <ReportCard
          title={t('Hardware cost by program')}
          description={t(
            'Material cost only - a program budget also covers labour, test and certification.',
          )}
          columns={usageColumns}
          rows={usage}
          csvName="hardware-cost-by-program"
          loading={loading}
        >
          <BarChart
            data={usage.map((row) => ({
              label: row.name,
              value: row.hardware_cost,
              hint: t('{percent} of budget', {
                percent: formatPercent(row.percent_of_budget),
              }),
            }))}
            formatValue={formatCompactCurrency}
          />
        </ReportCard>
      </div>

      <ReportCard
        title={t('Product consumption')}
        description={t('Which catalog items the portfolio actually draws on.')}
        columns={productColumns}
        rows={topProducts}
        csvName="product-consumption"
        loading={loading}
      >
        <BarChart
          data={topProducts.map((row) => ({
            label: row.name,
            value: row.amount,
            hint: t('{units} units on {programs} programs', {
              units: formatNumber(row.unit_count),
              programs: formatNumber(row.project_count),
            }),
          }))}
          formatValue={formatCompactCurrency}
        />
      </ReportCard>
    </ReportBody>
  )
}
