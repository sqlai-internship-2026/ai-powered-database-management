import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import DetailDrawer from '../components/DetailDrawer'
import StateBlock from '../components/StateBlock'
import StatusBadge from '../components/StatusBadge'
import { meterState } from '../components/charts/Meter'
import { ChevronRightIcon, ClockIcon } from '../components/icons'
import { apiGet } from '../utils/api'
import {
  daysUntil,
  formatCompactCurrency,
  formatCurrency,
  formatDay,
  formatNumber,
  formatPercent,
} from '../utils/format'

// One project in a panel over the Projects list, opened by URL.
//
// The panel is a route (/projects/:projectId) rather than a piece of state on
// the list: a project can be linked to, the back button closes it, and the list
// underneath keeps its search, filters and page because it never unmounts.
// Everything shown is read from GET /api/projects/:id, and nothing here writes.

const TITLE_ID = 'project-detail-title'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'team', label: 'Team' },
  { id: 'products', label: 'Products' },
  { id: 'investments', label: 'Investments' },
]

// Anything that is not a whole number cannot be a project id, so it is
// answered as "not found" without asking the backend.
const ID_PATTERN = /^\d+$/

function plural(count, one, many = `${one}s`) {
  return `${formatNumber(count)} ${count === 1 ? one : many}`
}

// Whole calendar months between two ISO dates, counted the way the Portfolio
// report counts them: a month is complete once its day has come round again.
function monthsBetween(startIso, endIso) {
  const start = /^(\d{4})-(\d{2})-(\d{2})/.exec(startIso || '')
  const end = /^(\d{4})-(\d{2})-(\d{2})/.exec(endIso || '')
  if (!start || !end) return null
  const [startYear, startMonth, startDay] = start.slice(1).map(Number)
  const [endYear, endMonth, endDay] = end.slice(1).map(Number)
  const months =
    (endYear - startYear) * 12 + (endMonth - startMonth) - (endDay < startDay ? 1 : 0)
  return months >= 0 ? months : null
}

// Where today falls against the schedule, from the dates alone. A project still
// running after its end date says so in words; nothing is inferred beyond that.
function describeTimeline(project) {
  const toStart = daysUntil(project.start_date)
  const toEnd = daysUntil(project.end_date)

  if (toStart !== null && toStart > 0) {
    return { text: `Starts in ${plural(toStart, 'day')}` }
  }
  if (toEnd === null) return null
  if (toEnd === 0) return { text: 'Ends today' }
  if (toEnd > 0) return { text: `${plural(toEnd, 'day')} until the end date` }
  if (project.status === 'Completed') {
    return { text: `Ended ${plural(-toEnd, 'day')} ago` }
  }
  return { text: `${plural(-toEnd, 'day')} past the end date`, late: true }
}

function budgetPosition(summary) {
  if (summary.budget === null) return { text: 'Budget not available' }
  if (summary.over_budget) {
    return {
      text: `Over budget by ${formatCompactCurrency(-summary.remaining)}`,
      tone: 'over',
    }
  }
  if (summary.budget === 0) return { text: 'Budget is zero' }
  if (meterState(summary.utilization) === 'warning') {
    return { text: 'Within budget, close to its limit', tone: 'near' }
  }
  return { text: 'Within budget' }
}

// Loads one project. Only a result for the id and the attempt on screen is ever
// shown: the previous project's rows must not flash up while the next one
// loads, and a retry shows the skeleton again instead of the error it replaces.
function useProjectDetail(projectId) {
  const valid = ID_PATTERN.test(projectId || '')
  const [result, setResult] = useState({ id: null, attempt: -1 })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!valid) return undefined
    let active = true

    apiGet(`/api/projects/${projectId}`)
      .then((data) => {
        if (active) setResult({ id: projectId, attempt, data })
      })
      .catch((error) => {
        if (active) setResult({ id: projectId, attempt, error })
      })

    return () => {
      active = false
    }
  }, [projectId, attempt, valid])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  if (!valid) return { phase: 'missing', retry }
  if (result.id !== projectId || result.attempt !== attempt) {
    return { phase: 'loading', retry }
  }
  if (result.error) {
    // 404 is a fact about the id. Anything else - the backend down, a session
    // that ran out - is a failure worth trying again.
    return {
      phase: result.error.status === 404 ? 'missing' : 'error',
      message: result.error.message,
      retry,
    }
  }
  return { phase: 'ready', data: result.data, retry }
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const detail = useProjectDetail(projectId)
  const [section, setSection] = useState('overview')

  // Another project opens on its overview, not on the tab the last one was
  // left on.
  useEffect(() => {
    setSection('overview')
  }, [projectId])

  const openedFromList = Boolean(location.state?.fromList)

  // Opened from the list, closing is the same as Back, so the history does not
  // collect a /projects entry for every project looked at. Opened from a link,
  // there is no list entry to go back to, so the list replaces the panel.
  const close = useCallback(() => {
    if (openedFromList) navigate(-1)
    else navigate('/projects', { replace: true })
  }, [navigate, openedFromList])

  return (
    <DetailDrawer
      titleId={TITLE_ID}
      closeLabel="Close project details"
      onClose={close}
      header={<DrawerHeader detail={detail} />}
    >
      <DrawerBody
        detail={detail}
        projectId={projectId}
        section={section}
        onSection={setSection}
        onClose={close}
      />
    </DetailDrawer>
  )
}

function DrawerHeader({ detail }) {
  if (detail.phase === 'loading') {
    return (
      <div className="detail-head-skeleton" aria-busy="true">
        <h2 id={TITLE_ID} className="visually-hidden">
          Loading project
        </h2>
        <div className="skeleton skeleton-line detail-skeleton-title" />
        <div className="skeleton skeleton-line" style={{ width: '82%' }} />
        <div className="skeleton skeleton-line" style={{ width: '36%' }} />
      </div>
    )
  }

  if (detail.phase !== 'ready') {
    return (
      <>
        <span className="page-eyebrow">Project</span>
        <h2 id={TITLE_ID} className="detail-title">
          {detail.phase === 'missing' ? 'Project not found' : 'Project could not be loaded'}
        </h2>
      </>
    )
  }

  const { project } = detail.data
  return (
    <>
      <span className="page-eyebrow">Project</span>
      <div className="detail-title-row">
        <h2 id={TITLE_ID} className="detail-title">
          {project.name}
        </h2>
        {project.status ? <StatusBadge status={project.status} /> : null}
      </div>
      {project.description ? (
        <p className="detail-description">{project.description}</p>
      ) : null}
      {project.start_date || project.end_date ? (
        <p className="detail-dates">
          <ClockIcon size={14} />
          <span>
            {formatDay(project.start_date)} – {formatDay(project.end_date)}
          </span>
        </p>
      ) : null}
    </>
  )
}

function DrawerBody({ detail, projectId, section, onSection, onClose }) {
  if (detail.phase === 'loading') {
    return (
      <>
        <div className="detail-figures-skeleton" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton" />
          ))}
        </div>
        <StateBlock variant="loading" title="Loading project details" lines={6} />
      </>
    )
  }

  if (detail.phase === 'missing') {
    return (
      <StateBlock
        variant="error"
        title={`No project has the ID ${projectId}`}
        text="It may have been removed, or the link may be mistyped. The project list is still behind this panel."
        actions={
          <button type="button" className="button" onClick={onClose}>
            Back to projects
          </button>
        }
      />
    )
  }

  if (detail.phase === 'error') {
    return (
      <StateBlock
        variant="error"
        title="The project details did not load"
        text={detail.message}
        actions={
          <div className="detail-state-actions">
            <button type="button" className="button button-primary" onClick={detail.retry}>
              Try again
            </button>
            <button type="button" className="button" onClick={onClose}>
              Close
            </button>
          </div>
        }
      />
    )
  }

  const { data } = detail
  return (
    <>
      <BudgetFigures summary={data.financial_summary} />
      <SectionTabs value={section} onChange={onSection} />
      <div
        role="tabpanel"
        id={`project-panel-${section}`}
        aria-labelledby={`project-tab-${section}`}
        className="detail-panel"
        tabIndex={0}
      >
        {section === 'overview' ? <Overview data={data} onSection={onSection} /> : null}
        {section === 'team' ? <TeamTable team={data.team} /> : null}
        {section === 'products' ? <ProductsTable products={data.products} /> : null}
        {section === 'investments' ? (
          <InvestmentsTable investments={data.investments} />
        ) : null}
      </div>
    </>
  )
}

/* ---------- Budget figures ---------- */

function Figure({ label, value, exact, note, over = false }) {
  return (
    <div className="detail-figure">
      <dt>{label}</dt>
      <dd
        className={over ? 'detail-figure-value is-over' : 'detail-figure-value'}
        title={exact === null || exact === undefined ? undefined : formatCurrency(exact)}
      >
        {value}
      </dd>
      {note ? <dd className="detail-figure-note">{note}</dd> : null}
    </div>
  )
}

// Compact figures, with the exact amount on hover: four numbers in the hundreds
// of millions do not fit a 720px panel written out in full.
//
// A budget that is not recorded is unknown, so every figure that depends on it
// is a dash, with the reason under the budget - never 0, never 0%, and never
// "Over budget". A budget of zero is a real figure: it is shown, and anything
// invested against it is over.
function BudgetFigures({ summary }) {
  const known = summary.budget !== null
  const hasBudget = known && summary.budget > 0
  const state = hasBudget ? meterState(summary.utilization) : 'unknown'
  const over = summary.over_budget

  let note = null
  if (over) note = { text: 'Over budget', className: 'detail-figure-note is-over' }
  else if (state === 'warning') note = { text: 'Near limit', className: 'detail-figure-note is-near' }
  else if (known && !hasBudget) note = { text: 'Budget is zero', className: 'detail-figure-note' }

  const fillClass =
    state === 'critical'
      ? 'kpi-meter-fill is-critical'
      : state === 'warning'
        ? 'kpi-meter-fill is-warning'
        : 'kpi-meter-fill'

  return (
    <dl className="detail-figures" aria-label="Budget position">
      <Figure
        label="Budget"
        value={known ? formatCompactCurrency(summary.budget) : '—'}
        exact={summary.budget}
        note={known ? null : 'Budget not available'}
      />
      <Figure
        label="Total invested"
        value={formatCompactCurrency(summary.total_invested)}
        exact={summary.total_invested}
        note={plural(summary.investment_count, 'record')}
      />
      <Figure
        label="Remaining"
        value={summary.remaining === null ? '—' : formatCompactCurrency(summary.remaining)}
        exact={summary.remaining}
        over={over}
      />
      <div className="detail-figure">
        <dt>Utilization</dt>
        {/* No budget above zero means no share of one: a dash, never 0%. */}
        <dd className="detail-figure-value">
          {hasBudget ? formatPercent(summary.utilization) : '—'}
        </dd>
        {hasBudget ? (
          <dd className="detail-figure-meter" aria-hidden="true">
            <div className="kpi-meter-track">
              <div
                className={fillClass}
                style={{ width: `${Math.min(100, Math.max(0, summary.utilization))}%` }}
              />
            </div>
          </dd>
        ) : null}
        {note ? <dd className={note.className}>{note.text}</dd> : null}
      </div>
    </dl>
  )
}

/* ---------- Tabs ---------- */

// Real tabs rather than the segmented control's pressed buttons: these switch
// what the panel below shows, so they carry tab and tabpanel roles and move with
// the arrow keys, the way a screen reader user expects tabs to.
function SectionTabs({ value, onChange }) {
  const refs = useRef({})

  function onKeyDown(event, index) {
    let next = null
    if (event.key === 'ArrowRight') next = (index + 1) % SECTIONS.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + SECTIONS.length) % SECTIONS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = SECTIONS.length - 1
    if (next === null) return

    event.preventDefault()
    const target = SECTIONS[next].id
    onChange(target)
    refs.current[target]?.focus()
  }

  return (
    <div className="segmented detail-tabs" role="tablist" aria-label="Project sections">
      {SECTIONS.map((entry, index) => {
        const selected = entry.id === value
        return (
          <button
            key={entry.id}
            ref={(node) => {
              refs.current[entry.id] = node
            }}
            type="button"
            role="tab"
            id={`project-tab-${entry.id}`}
            aria-selected={selected}
            aria-controls={`project-panel-${entry.id}`}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'segment is-selected' : 'segment'}
            onClick={() => onChange(entry.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {entry.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Overview ---------- */

function Overview({ data, onSection }) {
  const { project, counts, team, products, investments } = data
  const departments = new Set(team.map((person) => person.department_name).filter(Boolean)).size
  const categories = new Set(products.map((product) => product.category).filter(Boolean)).size
  const latest = investments.find((row) => row.investment_date)?.investment_date
  const months = monthsBetween(project.start_date, project.end_date)
  const timeline = describeTimeline(project)
  const position = budgetPosition(data.financial_summary)

  // The relation rows open their tab. Focus follows to the tab, because the
  // button that was pressed disappears with the overview.
  function open(target) {
    onSection(target)
    window.requestAnimationFrame(() => {
      document.getElementById(`project-tab-${target}`)?.focus()
    })
  }

  return (
    <div className="detail-overview">
      {project.description ? (
        <section className="detail-section">
          <h3 className="detail-section-title">About</h3>
          <p className="detail-prose">{project.description}</p>
        </section>
      ) : null}

      <section className="detail-section">
        <h3 className="detail-section-title">Schedule and budget</h3>
        <dl className="detail-facts">
          <div>
            <dt>Duration</dt>
            <dd>{months === null ? 'Dates not recorded' : plural(months, 'month')}</dd>
          </div>
          {timeline ? (
            <div>
              <dt>Timeline</dt>
              <dd className={timeline.late ? 'is-late' : undefined}>{timeline.text}</dd>
            </div>
          ) : null}
          <div>
            <dt>Budget position</dt>
            <dd className={position.tone ? `is-${position.tone}` : undefined}>{position.text}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <h3 className="detail-section-title">Linked records</h3>
        <ul className="detail-relations">
          <Relation
            label="Team"
            summary={`${plural(counts.team_members, 'person', 'people')}${
              departments ? ` from ${plural(departments, 'department')}` : ''
            }`}
            path="project_employees → employees"
            onOpen={() => open('team')}
          />
          <Relation
            label="Products"
            summary={`${plural(counts.products, 'product')}, ${plural(
              counts.product_units,
              'unit',
            )}${categories ? ` in ${plural(categories, 'category', 'categories')}` : ''}`}
            path="project_products → products"
            onOpen={() => open('products')}
          />
          <Relation
            label="Investments"
            summary={`${plural(counts.investments, 'record')}${
              latest ? `, latest ${formatDay(latest)}` : ''
            }`}
            path="investments"
            onOpen={() => open('investments')}
          />
        </ul>
      </section>
    </div>
  )
}

function Relation({ label, summary, path, onOpen }) {
  return (
    <li className="detail-relation">
      <button type="button" className="detail-relation-button" onClick={onOpen}>
        <span className="detail-relation-label">{label}</span>
        <span className="detail-relation-text">
          <span className="detail-relation-summary">{summary}</span>
          <span className="detail-relation-path">{path}</span>
        </span>
        <span className="detail-relation-arrow" aria-hidden="true">
          <ChevronRightIcon size={16} />
        </span>
      </button>
    </li>
  )
}

/* ---------- Relations ---------- */

function TeamTable({ team }) {
  if (team.length === 0) {
    return (
      <StateBlock
        title="No team members assigned"
        text="People appear here once they are assigned to this project."
      />
    )
  }

  return (
    <div className="detail-table-scroll">
      <table className="detail-table">
        <caption className="visually-hidden">Team members</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Role on project</th>
            <th scope="col">Title</th>
            <th scope="col">Department</th>
          </tr>
        </thead>
        <tbody>
          {team.map((person) => (
            <tr key={person.employee_id}>
              <td>
                <div className="cell-stack">
                  <span className="cell-primary">
                    {person.first_name} {person.last_name}
                  </span>
                  {person.email ? <span className="cell-sub">{person.email}</span> : null}
                </div>
              </td>
              <td>{person.role_in_project || '-'}</td>
              <td className="cell-muted">{person.job_title || '-'}</td>
              <td className="cell-muted">{person.department_name || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProductsTable({ products }) {
  if (products.length === 0) {
    return (
      <StateBlock
        title="No products assigned"
        text="Products and subsystems appear here once they are allocated to this project."
      />
    )
  }

  const units = products.reduce((sum, row) => sum + (row.quantity || 0), 0)
  const cost = products.reduce((sum, row) => sum + (row.line_total || 0), 0)

  return (
    <div className="detail-table-scroll">
      <table className="detail-table">
        <caption className="visually-hidden">Products used</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Category</th>
            <th scope="col" className="align-right">
              Qty
            </th>
            <th scope="col" className="align-right">
              Unit cost
            </th>
            <th scope="col" className="align-right">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.product_id}>
              <td className="cell-primary">{product.name}</td>
              <td className="cell-muted">{product.category || '-'}</td>
              <td className="align-right">{formatNumber(product.quantity)}</td>
              <td className="align-right">{formatCurrency(product.unit_cost)}</td>
              <td className="align-right">{formatCurrency(product.line_total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Total</td>
            <td className="align-right">{formatNumber(units)}</td>
            <td />
            <td className="align-right">{formatCurrency(cost)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function InvestmentsTable({ investments }) {
  if (investments.length === 0) {
    return (
      <StateBlock
        title="No investments recorded"
        text="Investments appear here once they are recorded against this project."
      />
    )
  }

  return (
    <div className="detail-table-scroll">
      <table className="detail-table">
        <caption className="visually-hidden">Investments, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Type</th>
            <th scope="col" className="align-right">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {investments.map((investment) => (
            <tr key={investment.investment_id}>
              <td>{formatDay(investment.investment_date)}</td>
              <td>{investment.investment_type || '-'}</td>
              <td className="align-right">{formatCurrency(investment.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
