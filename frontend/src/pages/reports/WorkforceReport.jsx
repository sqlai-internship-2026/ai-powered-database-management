import { useOutletContext } from 'react-router-dom'
import StatCard from '../../components/StatCard'
import ReportCard from '../../components/ReportCard'
import BarChart from '../../components/charts/BarChart'
import ColumnChart from '../../components/charts/ColumnChart'
import Meter from '../../components/charts/Meter'
import { buildQuery, useApiData } from '../../utils/api'
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
  const query = buildQuery({ department_id: filters.departmentId })
  const { data, loading, error } = useApiData(`/api/reports/workforce${query}`)

  if (error) {
    return <div className="card placeholder">Could not load the report: {error}</div>
  }
  if (!data) {
    return <div className="card placeholder">Building the workforce report...</div>
  }

  const { summary, departments, hires_by_year: hires, allocation, job_titles: titles } = data
  const staffedDepartments = departments.filter((row) => row.headcount > 0)
  const maxPrograms = Math.max(...allocation.map((row) => row.project_count), 1)

  return (
    <div className={loading ? 'report-body is-refetching' : 'report-body'}>
      <div className="stat-grid">
        <StatCard
          label="Headcount"
          value={formatNumber(summary.headcount)}
          hint={`${formatNumber(summary.department_count)} staffed departments`}
        />
        <StatCard
          label="Annual Payroll"
          value={formatCompactCurrency(summary.total_salary)}
          hint="Sum of recorded salaries"
        />
        <StatCard
          label="Average Salary"
          value={formatCurrency(summary.average_salary)}
        />
        <StatCard
          label="Average Tenure"
          value={`${formatNumber(summary.average_tenure_years)} yrs`}
          hint="Since hire date"
        />
        <StatCard
          label="Not On A Program"
          value={formatNumber(summary.unassigned_count)}
          hint="No project assignment"
        />
      </div>

      <div className="report-grid">
        <ReportCard
          title="Headcount by department"
          description="Where the people are."
          columns={departmentColumns}
          rows={staffedDepartments}
          csvName="headcount-by-department"
          loading={loading}
        >
          <BarChart
            data={staffedDepartments.map((row) => ({
              label: row.name,
              value: row.headcount,
              hint: `${formatCurrency(row.average_salary)} average`,
            }))}
            formatValue={formatNumber}
          />
        </ReportCard>

        <ReportCard
          title="Hires by year"
          description="When the current workforce joined."
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
        title="Payroll by department"
        description="Total recorded salary per department."
        columns={departmentColumns}
        rows={staffedDepartments}
        csvName="payroll-by-department"
        loading={loading}
      >
        <BarChart
          data={staffedDepartments.map((row) => ({
            label: row.name,
            value: row.total_salary,
            hint: `${formatNumber(row.headcount)} people`,
          }))}
          formatValue={formatCompactCurrency}
        />
      </ReportCard>

      <ReportCard
        title="Program allocation"
        description="How many programs each person is committed to, most loaded first."
        columns={allocationColumns}
        rows={allocation}
        csvName="program-allocation"
        loading={loading}
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Job title</th>
                <th>Department</th>
                <th className="meter-column">Programs</th>
                <th>Roles</th>
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
        title="Job titles"
        description="Headcount and average salary per title."
        columns={titleColumns}
        rows={titles}
        csvName="job-titles"
        loading={loading}
      >
        <BarChart
          data={titles.map((row) => ({
            label: row.label,
            value: row.count,
            hint: `${formatCurrency(row.average_salary)} average`,
          }))}
          formatValue={formatNumber}
        />
      </ReportCard>
    </div>
  )
}
