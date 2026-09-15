import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Assistant from '../components/Assistant'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import {
  ActivityIcon,
  AlertIcon,
  ArrowRightIcon,
  BudgetIcon,
  CheckCircleIcon,
  ClockIcon,
  DepartmentsIcon,
  EmployeesIcon,
  GaugeIcon,
  InvestmentsIcon,
  ProductsIcon,
  SparkIcon,
} from '../components/icons'
import { useApiData } from '../utils/api'
import {
  daysUntil,
  formatCompactCurrency,
  formatCurrency,
  formatDay,
  formatNumber,
  formatPercent,
} from '../utils/format'

// A project whose end date is this close is worth looking at before it turns
// into a project whose end date has passed. One quarter is the horizon a
// programme review works to.
const ATTENTION_HORIZON_DAYS = 90

// The order the statuses are drawn in. Anything the database returns that is
// not on this list still appears, after these - the list decides the order, it
// does not decide what exists.
const STATUS_ORDER = ['Active', 'Planning', 'On Hold', 'Completed']

const recentProjectColumns = [
  {
    key: 'name',
    header: 'Project',
    className: 'cell-text',
    sortable: false,
    render: (project) => <span className="cell-primary">{project.name}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: false,
    render: (project) => <StatusBadge status={project.status} />,
  },
  {
    key: 'budget',
    header: 'Budget',
    align: 'right',
    sortable: false,
    render: (project) => formatCurrency(project.budget),
  },
  {
    key: 'start_date',
    header: 'Start',
    align: 'right',
    sortable: false,
    render: (project) => formatDay(project.start_date),
  },
]

function KpiSkeleton({ count }) {
  return (
    <div className="kpi-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton skeleton-card" key={index} />
      ))}
    </div>
  )
}

export default function Dashboard() {
  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
  } = useApiData('/api/dashboard')
  const {
    data: projects,
    loading: projectsLoading,
    error: projectsError,
  } = useApiData('/api/projects', [])

  // Newest programmes first; a missing start date sorts to the bottom.
  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
        .slice(0, 5),
    [projects],
  )

  // How the portfolio is spread across statuses, counted from the same rows
  // the Projects screen lists, so the two can never disagree.
  const distribution = useMemo(() => {
    const counts = new Map()
    projects.forEach((project) => {
      const status = project.status || 'Unknown'
      counts.set(status, (counts.get(status) || 0) + 1)
    })
    const entries = [...counts.entries()].sort((a, b) => {
      const left = STATUS_ORDER.indexOf(a[0])
      const right = STATUS_ORDER.indexOf(b[0])
      if (left === -1 && right === -1) return b[1] - a[1]
      if (left === -1) return 1
      if (right === -1) return -1
      return left - right
    })
    const total = projects.length
    return entries.map(([status, count]) => ({
      status,
      count,
      share: total > 0 ? (count / total) * 100 : 0,
    }))
  }, [projects])

  // Active programmes that are already past their end date, or will reach it
  // within the quarter. Nothing here is predicted: it is the end date in the
  // row, compared with today.
  const attention = useMemo(() => {
    const rows = projects
      .filter((project) => project.status === 'Active' && project.end_date)
      .map((project) => ({ project, days: daysUntil(project.end_date) }))
      .filter((entry) => entry.days !== null && entry.days <= ATTENTION_HORIZON_DAYS)
      .sort((a, b) => a.days - b.days)

    return {
      rows,
      overdue: rows.filter((entry) => entry.days < 0).length,
      soon: rows.filter((entry) => entry.days >= 0).length,
    }
  }, [projects])

  // A share of a budget that is zero, missing or still loading is not zero
  // percent - it is unknown, and printing 0% would be an answer nobody
  // checked. The meter turns colour only past the point where the spend has
  // caught up with the budget, and the number beside it says so either way.
  const budget = stats?.total_project_budget
  const invested = stats?.total_investment_amount
  const utilization =
    typeof budget === 'number' && budget > 0 && typeof invested === 'number'
      ? (invested / budget) * 100
      : null
  const utilizationTone =
    utilization === null || utilization < 85
      ? ''
      : utilization <= 100
        ? ' is-warning'
        : ' is-critical'

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="The company at a glance, read live from the database: what is committed, what has been spent and what needs attention."
        actions={
          <Link className="button button-primary" to="/reports/ask">
            <SparkIcon size={16} />
            Ask your data
          </Link>
        }
      />

      {statsError ? (
        <div className="notice notice-danger">Could not load the summary: {statsError}</div>
      ) : null}

      {statsLoading ? (
        <KpiSkeleton count={4} />
      ) : (
        <div className="kpi-grid">
          <StatCard
            emphasis
            tone="primary"
            icon={<BudgetIcon size={18} />}
            label="Total Project Budget"
            value={formatCompactCurrency(stats?.total_project_budget)}
            hint={`Committed across ${formatNumber(stats?.total_projects)} projects`}
          />
          <StatCard
            emphasis
            tone="primary"
            icon={<InvestmentsIcon size={18} />}
            label="Total Investments"
            value={formatCompactCurrency(stats?.total_investment_amount)}
            hint="Recorded against projects to date"
          />
          <StatCard
            emphasis
            tone="success"
            icon={<ActivityIcon size={18} />}
            label="Active Projects"
            value={formatNumber(stats?.active_projects)}
            hint={`Currently in execution, of ${formatNumber(stats?.total_projects)}`}
          />
          <StatCard
            emphasis
            tone={utilization !== null && utilization > 100 ? 'warning' : 'primary'}
            icon={<GaugeIcon size={18} />}
            label="Budget Utilization"
            value={utilization === null ? '-' : formatPercent(utilization)}
            hint={
              utilization === null
                ? 'Needs a budget and recorded investments'
                : 'Investments as a share of budget'
            }
          >
            {utilization === null ? null : (
              <div className="kpi-meter">
                <div className="kpi-meter-track">
                  <div
                    className={`kpi-meter-fill${utilizationTone}`}
                    style={{ width: `${Math.min(100, Math.max(0, utilization))}%` }}
                  />
                </div>
              </div>
            )}
          </StatCard>
        </div>
      )}

      {statsLoading ? (
        <KpiSkeleton count={3} />
      ) : (
        <div className="kpi-grid kpi-grid-secondary">
          <StatCard
            icon={<EmployeesIcon size={18} />}
            label="Employees"
            value={formatNumber(stats?.total_employees)}
            hint="On the payroll"
          />
          <StatCard
            icon={<DepartmentsIcon size={18} />}
            label="Departments"
            value={formatNumber(stats?.total_departments)}
            hint="Organizational units"
          />
          <StatCard
            icon={<ProductsIcon size={18} />}
            label="Products"
            value={formatNumber(stats?.total_products)}
            hint="Products and subsystems in the catalog"
          />
        </div>
      )}

      <div className="dash-columns">
        <section className="panel">
          <div className="panel-head">
            <div className="panel-heading">
              <h2 className="panel-title">Portfolio by status</h2>
              <p className="panel-description">
                Where the {formatNumber(projects.length)} recorded projects stand today.
              </p>
            </div>
          </div>
          <div className="panel-body">
            {projectsLoading ? (
              <div className="dist-list" aria-hidden="true">
                {Array.from({ length: 4 }, (_, index) => (
                  <div className="skeleton skeleton-line" key={index} />
                ))}
              </div>
            ) : distribution.length === 0 ? (
              <p className="panel-note">No projects have been recorded yet.</p>
            ) : (
              <div className="dist-list">
                {distribution.map((entry) => (
                  <div className="dist-row" key={entry.status}>
                    <div className="dist-head">
                      <span className="dist-label">{entry.status}</span>
                      <span className="dist-value">
                        <strong>{formatNumber(entry.count)}</strong>{' '}
                        {formatPercent(entry.share, 0)}
                      </span>
                    </div>
                    <div className="dist-track">
                      <div
                        className="dist-fill"
                        style={{ width: `${entry.share}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div className="panel-heading">
              <h2 className="panel-title">Needs attention</h2>
              <p className="panel-description">
                Active projects past their end date or due within {ATTENTION_HORIZON_DAYS} days.
              </p>
            </div>
          </div>
          <div className="panel-body">
            {projectsLoading ? (
              <div className="dist-list" aria-hidden="true">
                {Array.from({ length: 3 }, (_, index) => (
                  <div className="skeleton skeleton-line" key={index} />
                ))}
              </div>
            ) : projectsError ? (
              <p className="panel-note">Could not load the projects: {projectsError}</p>
            ) : attention.rows.length === 0 ? (
              <div className="state-block">
                <span className="state-icon">
                  <CheckCircleIcon size={20} />
                </span>
                <p className="state-title">Nothing is overdue</p>
                <p className="state-text">
                  No active project has passed its end date or reaches it within the next{' '}
                  {ATTENTION_HORIZON_DAYS} days.
                </p>
              </div>
            ) : (
              <>
                <p className="panel-note attention-summary">
                  {formatNumber(attention.overdue)} overdue,{' '}
                  {formatNumber(attention.soon)} due soon
                </p>
                <div className="attention-list">
                  {attention.rows.slice(0, 5).map(({ project, days }) => {
                    const overdue = days < 0
                    return (
                      <div className="attention-row" key={project.id}>
                        <span
                          className={
                            overdue ? 'attention-icon is-overdue' : 'attention-icon'
                          }
                          aria-hidden="true"
                        >
                          {overdue ? <AlertIcon size={16} /> : <ClockIcon size={16} />}
                        </span>
                        <div className="attention-text">
                          <div className="attention-name" title={project.name}>
                            {project.name}
                          </div>
                          <div
                            className={
                              overdue ? 'attention-meta is-overdue' : 'attention-meta'
                            }
                          >
                            {overdue
                              ? `Overdue by ${formatNumber(Math.abs(days))} days`
                              : days === 0
                                ? 'Ends today'
                                : `Ends in ${formatNumber(days)} days`}{' '}
                            - {formatDay(project.end_date)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {attention.rows.length > 5 ? (
                  <p className="panel-note attention-more">
                    {formatNumber(attention.rows.length - 5)} more not shown.{' '}
                    <Link to="/projects">See all projects</Link>
                  </p>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div className="panel-heading">
            <h2 className="panel-title">Latest projects</h2>
            <p className="panel-description">The five most recently started programmes.</p>
          </div>
          <Link className="panel-link" to="/projects">
            View all projects
            <ArrowRightIcon size={15} />
          </Link>
        </div>
        <DataTable
          plain
          columns={recentProjectColumns}
          rows={recentProjects}
          loading={projectsLoading}
          error={projectsError}
          pageSize={5}
          emptyTitle="No projects yet"
          emptyMessage="The projects table has no rows."
        />
      </section>

      <Assistant />
    </>
  )
}
