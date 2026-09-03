import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import { dashboardStats } from '../data/dashboardStats'
import { mockProjects } from '../data/mockProjects'
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
} from '../utils/format'

const recentProjectColumns = [
  { key: 'name', header: 'Name' },
  {
    key: 'status',
    header: 'Status',
    render: (project) => <StatusBadge status={project.status} />,
  },
  {
    key: 'budget',
    header: 'Budget',
    render: (project) => formatCurrency(project.budget),
  },
  { key: 'start_date', header: 'Start Date' },
]

export default function Dashboard() {
  const recentProjects = [...mockProjects]
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .slice(0, 5)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Company-wide overview. All figures shown are temporary mock data."
      />

      <div className="notice">
        This environment is not connected to the database yet. Values come from
        local mock data and will be replaced by REST API responses.
      </div>

      <div className="stat-grid">
        <StatCard label="Total Projects" value={formatNumber(dashboardStats.total_projects)} />
        <StatCard
          label="Active Projects"
          value={formatNumber(dashboardStats.active_projects)}
          hint="Currently in execution"
        />
        <StatCard label="Total Employees" value={formatNumber(dashboardStats.total_employees)} />
        <StatCard label="Total Departments" value={formatNumber(dashboardStats.total_departments)} />
        <StatCard label="Total Products" value={formatNumber(dashboardStats.total_products)} />
        <StatCard
          label="Total Investments"
          value={formatCompactCurrency(dashboardStats.total_investment_amount)}
          hint="Sum of recorded investments"
        />
      </div>

      <PageHeader title="Latest Projects" />
      <DataTable columns={recentProjectColumns} rows={recentProjects} />
    </>
  )
}
