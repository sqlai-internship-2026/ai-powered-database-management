import { useOutletContext } from 'react-router-dom'
import StatCard from '../../components/StatCard'
import ReportCard from '../../components/ReportCard'
import ReportBody from '../../components/ReportBody'
import StateBlock from '../../components/StateBlock'
import BarChart from '../../components/charts/BarChart'
import ColumnChart from '../../components/charts/ColumnChart'
import Meter from '../../components/charts/Meter'
import {
  BudgetIcon,
  ClockIcon,
  DepartmentsIcon,
  EmployeesIcon,
  InboxIcon,
} from '../../components/icons'
import { buildQuery, useApiData } from '../../utils/api'
import { useT } from '../../i18n'
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
} from '../../utils/format'

const departmentColumns = [
  { key: 'name', header: 'Department' },
  { key: 'headcount', header: 'Headcount', align: 'right' },
  {
    key: 'average_salary',
    header: 'Average salary',
    align: 'right',
    value: (row) => formatCurrency(row.average_salary),
  },
  {
    key: 'total_salary',
    header: 'Payroll',
    align: 'right',
    value: (row) => formatCurrency(row.total_salary),
  },
]

const hireColumns = [
  { key: 'year', header: 'Year' },
  { key: 'count', header: 'Hires', align: 'right' },
]

const titleColumns = [
  { key: 'label', header: 'Job title' },
  { key: 'count', header: 'People', align: 'right' },
  {
    key: 'average_salary',
    header: 'Average salary',
    align: 'right',
    value: (row) => formatCurrency(row.average_salary),
  },
]

const allocationColumns = [
  { key: 'employee', header: 'Employee' },
  { key: 'job_title', header: 'Job title' },
  { key: 'department_name', header: 'Department' },
  { key: 'project_count', header: 'Programs', align: 'right' },
  { key: 'roles', header: 'Roles' },
]

export default function WorkforceReport() {
  const { filters } = useOutletContext()
  const t = useT()
  const query = buildQuery({ department_id: filters.departmentId })
  const { data, loading, error } = useApiData(`/api/reports/workforce${query}`)

  if (error) {
    return (
      <div className="card">
        <StateBlock
          variant="error"
          title={t('Could not load the workforce report')}
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
          title={t('Building the workforce report')}
          lines={6}
        />
      </div>
    )
  }

  const { summary, departments, hires_by_year: hires, allocation, job_titles: titles } = data
  const staffedDepartments = departments.filter((row) => row.headcount > 0)
  const maxPrograms = Math.max(...allocation.map((row) => row.project_count), 1)

  return (
    <ReportBody loading={loading}>
      <div className="stat-grid">
        <StatCard
          tone="primary"
          label={t('Headcount')}
          value={formatNumber(summary.headcount)}
          hint={t('{count} staffed departments', {
            count: formatNumber(summary.department_count),
          })}
          icon={<EmployeesIcon size={17} />}
        />
        <StatCard
          label={t('Annual Payroll')}
          value={formatCompactCurrency(summary.total_salary)}
          hint={t('Sum of recorded salaries')}
          icon={<BudgetIcon size={17} />}
        />
        <StatCard
          label={t('Average Salary')}
          value={formatCurrency(summary.average_salary)}
          icon={<DepartmentsIcon size={17} />}
        />
        <StatCard
          label={t('Average Tenure')}
          value={t('{count} yrs', {
            count: formatNumber(summary.average_tenure_years),
          })}
          hint={t('Since hire date')}
          icon={<ClockIcon size={17} />}
        />
        <StatCard
          label={t('Not On A Program')}
          value={formatNumber(summary.unassigned_count)}
          hint={t('No project assignment')}
          icon={<InboxIcon size={17} />}
          tone={summary.unassigned_count > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="report-grid">
        <ReportCard
          title={t('Headcount by department')}
          description={t('Where the people are.')}
          columns={departmentColumns}
          rows={staffedDepartments}
          csvName="headcount-by-department"
          loading={loading}
        >
          <BarChart
            data={staffedDepartments.map((row) => ({
              label: row.name,
              value: row.headcount,
              hint: t('{amount} average', {
                amount: formatCurrency(row.average_salary),
              }),
            }))}
            formatValue={formatNumber}
          />
        </ReportCard>

        <ReportCard
          title={t('Hires by year')}
          description={t('When the current workforce joined.')}
          columns={hireColumns}
          rows={hires}
          csvName="hires-by-year"
          loading={loading}
        >
          <ColumnChart
            data={hires.map((row) => ({
              label: String(row.year),
              value: row.count,
            }))}
            formatValue={formatNumber}
            formatTick={(value) => formatNumber(Math.round(value))}
          />
        </ReportCard>
      </div>

      <ReportCard
        title={t('Payroll by department')}
        description={t('Total recorded salary per department.')}
        columns={departmentColumns}
        rows={staffedDepartments}
        csvName="payroll-by-department"
        loading={loading}
      >
        <BarChart
          data={staffedDepartments.map((row) => ({
            label: row.name,
            value: row.total_salary,
            hint: t('{count} people', { count: formatNumber(row.headcount) }),
          }))}
          formatValue={formatCompactCurrency}
        />
      </ReportCard>

      <ReportCard
        title={t('Program allocation')}
        description={t(
          'How many programs each person is committed to, most loaded first.',
        )}
        columns={allocationColumns}
        rows={allocation}
        csvName="program-allocation"
        loading={loading}
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t('Employee')}</th>
                <th>{t('Job title')}</th>
                <th>{t('Department')}</th>
                <th className="meter-column">{t('Programs')}</th>
                <th>{t('Roles')}</th>
              </tr>
            </thead>
            <tbody>
              {allocation.map((row) => (
                <tr key={row.id}>
                  <td>{row.employee}</td>
                  <td>{row.job_title}</td>
                  <td>{row.department_name}</td>
                  <td className="meter-column">
                    <Meter
                      percent={(row.project_count / maxPrograms) * 100}
                      state="normal"
                      display={formatNumber(row.project_count)}
                    />
                  </td>
                  <td className="cell-wrap">{row.roles || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCard>

      <ReportCard
        title={t('Job titles')}
        description={t('Headcount and average salary per title.')}
        columns={titleColumns}
        rows={titles}
        csvName="job-titles"
        loading={loading}
      >
        <BarChart
          data={titles.map((row) => ({
            label: row.label,
            value: row.count,
            hint: t('{amount} average', {
              amount: formatCurrency(row.average_salary),
            }),
          }))}
          formatValue={formatNumber}
        />
      </ReportCard>
    </ReportBody>
  )
}
