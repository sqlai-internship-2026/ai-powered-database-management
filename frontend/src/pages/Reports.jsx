import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useApiData } from '../utils/api'

// The reporting screens live under one menu entry and switch with these tabs,
// so the sidebar stays a list of subjects rather than a list of reports.
const tabs = [
  { to: '/reports', end: true, label: 'Financial', uses: ['years', 'status'] },
  { to: '/reports/workforce', label: 'Workforce', uses: ['department'] },
  { to: '/reports/portfolio', label: 'Portfolio', uses: ['status'] },
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

  const isFiltered =
    (usesYears && (filters.yearFrom || filters.yearTo)) ||
    (usesStatus && filters.statuses.length > 0) ||
    (usesDepartment && filters.departmentId)

  function toggleStatus(status) {
    setFilters((current) => ({
      ...current,
      statuses: current.statuses.includes(status)
        ? current.statuses.filter((value) => value !== status)
        : [...current.statuses, status],
    }))
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Program finance, workforce and portfolio analytics, aggregated in the database."
      />

      <nav className="report-tabs">
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
      </nav>

      {optionsError ? (
        <div className="notice">Could not load the filter options: {optionsError}</div>
      ) : null}

      {/* One filter row above every card it scopes - the cards below never
          carry their own filters. */}
      <div className="report-toolbar">
        <div className="report-filters">
          {usesYears ? (
            <label className="field">
              <span className="field-label">Investment years</span>
              <span className="field-pair">
                <select
                  value={filters.yearFrom}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      yearFrom: event.target.value,
                    }))
                  }
                >
                  <option value="">From</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <span className="field-separator">to</span>
                <select
                  value={filters.yearTo}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      yearTo: event.target.value,
                    }))
                  }
                >
                  <option value="">To</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          ) : null}

          {usesStatus ? (
            <div className="field">
              <span className="field-label">Project status</span>
              <div className="audit-filters">
                {(options?.statuses || []).map((entry) => (
                  <button
                    key={entry.status}
                    type="button"
                    className={
                      filters.statuses.includes(entry.status)
                        ? 'filter-button active'
                        : 'filter-button'
                    }
                    aria-pressed={filters.statuses.includes(entry.status)}
                    onClick={() => toggleStatus(entry.status)}
                  >
                    {entry.status} ({entry.count})
                  </button>
                ))}
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

        <div className="report-toolbar-actions">
          {isFiltered ? (
            <button
              type="button"
              className="button"
              onClick={() => setFilters(emptyFilters)}
            >
              Clear filters
            </button>
          ) : null}
          <button type="button" className="button" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <Outlet context={{ filters }} />
    </>
  )
}
