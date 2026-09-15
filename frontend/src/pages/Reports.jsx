import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { CloseIcon, PrinterIcon, SparkIcon } from '../components/icons'
import { useApiData } from '../utils/api'

// The reporting screens live under one menu entry and switch with these tabs,
// so the sidebar stays a list of subjects rather than a list of reports.
const tabs = [
  { to: '/reports', end: true, label: 'Financial', uses: ['years', 'status'] },
  { to: '/reports/workforce', label: 'Workforce', uses: ['department'] },
  { to: '/reports/portfolio', label: 'Portfolio', uses: ['status'] },
  // Dynamic builds its own query from the question, so the filter row above
  // does not apply to it. The route keeps its original /ask path: it is what
  // the tab still does first, and renaming a route only breaks the links
  // people have already kept.
  { to: '/reports/ask', label: 'Dynamic', uses: [] },
]

const emptyFilters = {
  yearFrom: '',
  yearTo: '',
  statuses: [],
  departmentId: '',
}

export default function Reports() {
  const { pathname } = useLocation()
  const { data: options, error: optionsError } = useApiData('/api/reports/filters')
  const [filters, setFilters] = useState(emptyFilters)

  // Longest matching tab wins, so /reports/workforce does not match /reports.
  const activeTab = useMemo(() => {
    const matches = tabs.filter((tab) =>
      tab.end ? pathname === tab.to : pathname.startsWith(tab.to),
    )
    return matches.sort((a, b) => b.to.length - a.to.length)[0] || tabs[0]
  }, [pathname])

  const years = useMemo(() => {
    const min = options?.years?.min_year
    const max = options?.years?.max_year
    if (!min || !max) return []
    return Array.from({ length: max - min + 1 }, (_, index) => min + index)
  }, [options])

  const usesYears = activeTab.uses.includes('years')
  const usesStatus = activeTab.uses.includes('status')
  const usesDepartment = activeTab.uses.includes('department')
  const hasFilters = usesYears || usesStatus || usesDepartment

  function toggleStatus(status) {
    setFilters((current) => ({
      ...current,
      statuses: current.statuses.includes(status)
        ? current.statuses.filter((value) => value !== status)
        : [...current.statuses, status],
    }))
  }

  function clearOne(patch) {
    setFilters((current) => ({ ...current, ...patch }))
  }

  const departmentName = (options?.departments || []).find(
    (entry) => String(entry.id) === String(filters.departmentId),
  )?.name

  // What is narrowing the report right now, in words. A row of selects reads as
  // "nothing is set" at a glance even when something is; these say what is on,
  // and each one takes itself off again.
  const activeChips = []
  if (usesYears && (filters.yearFrom || filters.yearTo)) {
    const from = filters.yearFrom || 'earliest'
    const to = filters.yearTo || 'latest'
    activeChips.push({
      key: 'years',
      label: `Years: ${from} to ${to}`,
      clear: () => clearOne({ yearFrom: '', yearTo: '' }),
    })
  }
  if (usesStatus) {
    filters.statuses.forEach((status) => {
      activeChips.push({
        key: `status-${status}`,
        label: `Status: ${status}`,
        clear: () => toggleStatus(status),
      })
    })
  }
  if (usesDepartment && filters.departmentId) {
    activeChips.push({
      key: 'department',
      label: `Department: ${departmentName || filters.departmentId}`,
      clear: () => clearOne({ departmentId: '' }),
    })
  }

  // The two selects cannot be put out of order: each one refuses the years that
  // would invert the range, so no report is ever asked for 2026 through 2021.
  const yearFromValue = filters.yearFrom ? Number(filters.yearFrom) : null
  const yearToValue = filters.yearTo ? Number(filters.yearTo) : null

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        description="Program finance, workforce and portfolio analytics, aggregated in the database."
        actions={
          <button type="button" className="button" onClick={() => window.print()}>
            <PrinterIcon size={15} />
            Print report
          </button>
        }
      />

      <nav className="report-tabs" aria-label="Report sections">
        <div className="report-tabs-track">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                isActive ? 'report-tab active' : 'report-tab'
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {optionsError ? (
        <div className="notice notice-danger">
          Could not load the filter options: {optionsError}
        </div>
      ) : null}

      {/* One filter row above every card it scopes - the cards below never
          carry their own filters. */}
      {hasFilters ? (
        <div className="report-toolbar">
          <div className="report-filters">
            {usesYears ? (
              <div className="field">
                <span className="field-label" id="report-year-label">
                  Investment years
                </span>
                <span className="field-pair" aria-labelledby="report-year-label">
                  <select
                    value={filters.yearFrom}
                    aria-label="First investment year"
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        yearFrom: event.target.value,
                      }))
                    }
                  >
                    <option value="">From</option>
                    {years.map((year) => (
                      <option
                        key={year}
                        value={year}
                        disabled={yearToValue !== null && year > yearToValue}
                      >
                        {year}
                      </option>
                    ))}
                  </select>
                  <span className="field-separator">to</span>
                  <select
                    value={filters.yearTo}
                    aria-label="Last investment year"
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        yearTo: event.target.value,
                      }))
                    }
                  >
                    <option value="">To</option>
                    {years.map((year) => (
                      <option
                        key={year}
                        value={year}
                        disabled={yearFromValue !== null && year < yearFromValue}
                      >
                        {year}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
            ) : null}

            {usesStatus ? (
              <div className="field">
                <span className="field-label" id="report-status-label">
                  Project status
                </span>
                <div className="filter-chips" aria-labelledby="report-status-label">
                  {(options?.statuses || []).map((entry) => {
                    const on = filters.statuses.includes(entry.status)
                    return (
                      <button
                        key={entry.status}
                        type="button"
                        className={on ? 'filter-chip is-on' : 'filter-chip'}
                        aria-pressed={on}
                        onClick={() => toggleStatus(entry.status)}
                      >
                        {entry.status}
                        <span className="filter-chip-count">{entry.count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {usesDepartment ? (
              <label className="field">
                <span className="field-label">Department</span>
                <select
                  value={filters.departmentId}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      departmentId: event.target.value,
                    }))
                  }
                >
                  <option value="">All departments</option>
                  {(options?.departments || []).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {/* Shown only once something is actually narrowing the report: a
              Clear button over an unfiltered report is a control with nothing
              to do. */}
          {activeChips.length > 0 ? (
            <div className="report-active-filters">
              <span className="report-active-label">Filtered by</span>
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="active-chip"
                  onClick={chip.clear}
                >
                  {chip.label}
                  <CloseIcon size={12} />
                  <span className="visually-hidden">- remove this filter</span>
                </button>
              ))}
              <button
                type="button"
                className="button button-quiet button-sm"
                onClick={() => setFilters(emptyFilters)}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="report-scope-note">
          <SparkIcon size={15} />
          This tab writes its own query from the question you ask, so the filters
          above the fixed reports do not apply here.
        </p>
      )}

      <Outlet context={{ filters }} />
    </>
  )
}
