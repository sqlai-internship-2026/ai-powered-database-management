import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
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
import { useT } from '../i18n'
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
  const t = useT()
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

  // The Assistant and the way into dynamic reports are for roles that may send
  // questions to the model. The backend refuses the rest either way; this only
  // keeps a control off the screen that could not work for them.
  const { can } = useAuth()
  const canAsk = can('ai')

  return (
    <>
      <PageHeader
        eyebrow={t('Overview')}
        title={t('Dashboard')}
        description={t(
          'The company at a glance, read live from the database: what is committed, what has been spent and what needs attention.',
        )}
        actions={
          canAsk ? (
            // Secondary: the Assistant's Ask further down is this page's one
            // primary action.
            <Link className="button" to="/reports/ask">
              <SparkIcon size={16} />
              {t('Ask your data')}
            </Link>
          ) : null
        }
      />

      {statsError ? (
        <div className="notice notice-danger">
          {t('Could not load the summary: {message}', { message: statsError })}
        </div>
      ) : null}

      {statsLoading ? (
        <KpiSkeleton count={4} />
      ) : (
        <div className="kpi-grid">
          <StatCard
            emphasis
            tone="primary"
            icon={<BudgetIcon size={18} />}
            label={t('Total Project Budget')}
            value={formatCompactCurrency(stats?.total_project_budget)}
            hint={t('Committed across {count} projects', {
              count: formatNumber(stats?.total_projects),
            })}
          />
          <StatCard
            emphasis
            icon={<InvestmentsIcon size={18} />}
            label={t('Total Investments')}
            value={formatCompactCurrency(stats?.total_investment_amount)}
            hint={t('Recorded against projects to date')}
          />
          <StatCard
            emphasis
            tone="success"
            icon={<ActivityIcon size={18} />}
            label={t('Active Projects')}
            value={formatNumber(stats?.active_projects)}
            hint={t('Currently in execution, of {count}', {
              count: formatNumber(stats?.total_projects),
            })}
          />
          <StatCard
            emphasis
            tone={
              utilizationTone === ' is-critical'
                ? 'danger'
                : utilizationTone === ' is-warning'
                  ? 'warning'
                  : 'primary'
            }
            icon={<GaugeIcon size={18} />}
            label={t('Budget Utilization')}
            value={utilization === null ? '-' : formatPercent(utilization)}
            hint={
              utilization === null
                ? t('Needs a budget and recorded investments')
                : t('Investments as a share of budget')
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
            label={t('Employees')}
            value={formatNumber(stats?.total_employees)}
            hint={t('On the payroll')}
          />
          <StatCard
            icon={<DepartmentsIcon size={18} />}
            label={t('Departments')}
            value={formatNumber(stats?.total_departments)}
            hint={t('Organizational units')}
          />
          <StatCard
            icon={<ProductsIcon size={18} />}
            label={t('Products')}
            value={formatNumber(stats?.total_products)}
            hint={t('Products and subsystems in the catalog')}
          />
        </div>
      )}

      <div className="dash-columns">
        <section className="panel">
          <div className="panel-head">
            <div className="panel-heading">
              <h2 className="panel-title">{t('Portfolio by status')}</h2>
              <p className="panel-description">
                {t('Where the {count} recorded projects stand today.', {
                  count: formatNumber(projects.length),
                })}
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
              <p className="panel-note">{t('No projects have been recorded yet.')}</p>
            ) : (
              <div className="dist-list">
                {distribution.map((entry) => (
                  <div className="dist-row" key={entry.status}>
                    <div className="dist-head">
                      <span className="dist-label">{t(entry.status)}</span>
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
              <h2 className="panel-title">{t('Needs attention')}</h2>
              <p className="panel-description">
                {t('Active projects past their end date or due within {days} days.', {
                  days: ATTENTION_HORIZON_DAYS,
                })}
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
              <p className="panel-note">
                {t('Could not load the projects: {message}', { message: projectsError })}
              </p>
            ) : attention.rows.length === 0 ? (
              <div className="state-block">
                <span className="state-icon">
                  <CheckCircleIcon size={20} />
                </span>
                <p className="state-title">{t('Nothing is overdue')}</p>
                <p className="state-text">
                  {t(
                    'No active project has passed its end date or reaches it within the next {days} days.',
                    { days: ATTENTION_HORIZON_DAYS },
                  )}
                </p>
              </div>
            ) : (
              <>
                <p className="panel-note attention-summary">
                  {t('{overdue} overdue, {soon} due soon', {
                    overdue: formatNumber(attention.overdue),
                    soon: formatNumber(attention.soon),
                  })}
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
                              ? t('Overdue by {days} days', {
                                  days: formatNumber(Math.abs(days)),
                                })
                              : days === 0
                                ? t('Ends today')
                                : t('Ends in {days} days', {
                                    days: formatNumber(days),
                                  })}{' '}
                            - {formatDay(project.end_date)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {attention.rows.length > 5 ? (
                  <p className="panel-note attention-more">
                    {t('{count} more not shown.', {
                      count: formatNumber(attention.rows.length - 5),
                    })}{' '}
                    <Link to="/projects">{t('See all projects')}</Link>
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
            <h2 className="panel-title">{t('Latest projects')}</h2>
            <p className="panel-description">
              {t('The five most recently started programmes.')}
            </p>
          </div>
          <Link className="panel-link" to="/projects">
            {t('View all projects')}
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

      {canAsk ? <Assistant /> : null}
    </>
  )
}
