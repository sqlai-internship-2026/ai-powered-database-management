import Assistant from '../components/Assistant'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import { useApiData } from '../utils/api'
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
  const { data: stats, error: statsError } = useApiData('/api/dashboard')
  const {
    data: projects,
    loading: projectsLoading,
    error: projectsError,
  } = useApiData('/api/projects', [])

  // Newest programs first; a missing start date sorts to the bottom.
  const recentProjects = [...projects]
    .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
    .slice(0, 5)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Company-wide overview, read live from the database."
      />

      {statsError && <div className="notice">Could not load summary: {statsError}</div>}

      <div className="stat-grid">
        <StatCard label="Total Projects" value={formatNumber(stats?.total_projects)} />
        <StatCard
          label="Active Projects"
          value={formatNumber(stats?.active_projects)}
          hint="Currently in execution"
        />
        <StatCard label="Total Employees" value={formatNumber(stats?.total_employees)} />
        <StatCard label="Total Departments" value={formatNumber(stats?.total_departments)} />
        <StatCard label="Total Products" value={formatNumber(stats?.total_products)} />
        <StatCard
          label="Total Investments"
          value={formatCompactCurrency(stats?.total_investment_amount)}
          hint="Sum of recorded investments"
        />
      </div>

      <PageHeader title="Latest Projects" />
      <DataTable
        columns={recentProjectColumns}
        rows={recentProjects}
        loading={projectsLoading}
        error={projectsError}
      />

      <Assistant />
    </>
  )
}
