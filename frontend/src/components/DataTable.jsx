import { useEffect, useMemo, useState } from 'react'
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  InboxIcon,
  SearchIcon,
} from './icons'
import { useLanguage } from '../i18n'

// The one table behind every list screen.
//
// Searching, filtering, sorting and paging are the same four problems on all
// five of them, so they are solved once here and a screen only says which
// columns it has and which of the four it wants. Everything happens in the
// browser over the rows the endpoint already sent: the lists are small, the
// backend has no paging parameters, and adding a table library to sort a few
// hundred rows would be a dependency bought with nothing.
//
// The simple call it started as still works - columns, rows, loading, error -
// and a screen that passes nothing else gets a plain table with a row count.
//
// columns: [{
//   key,                 // row property, and the column's identity
//   header,
//   render?,             // (row) => node, for anything that is not plain text
//   sortable?,           // default true
//   sortValue?,          // (row) => comparable, when the cell is not the value
//   searchValue?,        // (row) => string, when the cell draws several fields
//   searchable?,         // default true; false keeps a column out of search
//   align?,              // 'right' for figures
//   className?,          // extra class on both the header and the cells
// }]
//
// filters: [{ key, label, allLabel?, options? }] - a select per entry, its
// options taken from the distinct values in the data unless given.
//
// Every word a screen passes in - the headers, the labels, the noun the table
// counts itself in, the two empty-state sentences - is English, and this
// component translates it. A screen says what its columns are, never which
// language they are in.

const DEFAULT_PAGE_SIZE = 15

// Numbers compare as numbers, ISO dates and text compare as text, and anything
// missing sorts last in both directions - an empty end date is not "earliest",
// it is unknown, and burying it under the rows that do have one is the only
// answer that does not mislead.
function compareValues(a, b, locale = 'en') {
  const aMissing = a === null || a === undefined || a === ''
  const bMissing = b === null || b === undefined || b === ''
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), locale)
}

// What a column contributes to the search. A column that draws more than one
// field - an employee's two names, a department's name and its description -
// says so with searchValue, so a reader can search for what they can see.
function cellText(row, column) {
  let value
  if (column.searchValue) value = column.searchValue(row)
  else if (column.sortValue) value = column.sortValue(row)
  else value = row[column.key]
  if (value === null || value === undefined) return ''
  return String(value)
}

function SortIcon({ direction }) {
  return (
    <span className="sort-arrow">
      {direction === 'desc' ? (
        <ChevronDownIcon size={14} />
      ) : (
        <ChevronUpIcon size={14} />
      )}
    </span>
  )
}

export default function DataTable({
  columns,
  rows,
  loading = false,
  error = null,
  emptyMessage,
  emptyTitle,
  searchable = false,
  searchPlaceholder,
  searchLabel,
  filters = [],
  initialSort = null,
  pageSize = DEFAULT_PAGE_SIZE,
  noun = 'records',
  onRowClick = null,
  toolbarExtra = null,
  plain = false,
}) {
  const { language, t } = useLanguage()
  // Thousands separators change with the language as much as month names do.
  const locale = language === 'tr' ? 'tr-TR' : 'en-US'
  const [search, setSearch] = useState('')
  const [filterValues, setFilterValues] = useState({})
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(0)

  const safeRows = useMemo(() => rows || [], [rows])

  // Each select offers what is actually in the data, so a status nobody has
  // used is not on the list and one that appears later needs no code change.
  const filterOptions = useMemo(
    () =>
      filters.map((filter) => ({
        ...filter,
        options:
          filter.options ||
          Array.from(
            new Set(
              safeRows
                .map((row) => row[filter.key])
                .filter((value) => value !== null && value !== undefined && value !== ''),
            ),
          )
            // The value stays what the database holds, because that is what
            // the filter compares a row against; only the label is
            // translated, and the list is ordered by the words on screen.
            .map((value) => ({ value: String(value), label: t(String(value)) }))
            .sort((a, b) => compareValues(a.label, b.label, language)),
      })),
    [filters, safeRows, t, language],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const active = Object.entries(filterValues).filter(([, value]) => value !== '')

    return safeRows.filter((row) => {
      for (const [key, value] of active) {
        if (String(row[key] ?? '') !== value) return false
      }
      if (!term) return true
      return columns.some((column) => {
        if (column.searchable === false) return false
        return cellText(row, column).toLowerCase().includes(term)
      })
    })
  }, [safeRows, columns, search, filterValues])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const column = columns.find((entry) => entry.key === sort.key)
    if (!column) return filtered
    const direction = sort.direction === 'desc' ? -1 : 1
    const read = (row) => (column.sortValue ? column.sortValue(row) : row[column.key])
    // Copied first: sorting the array the filter returned would reorder the
    // caller's rows on the screens that pass their fetched data straight in.
    return [...filtered].sort(
      (a, b) => compareValues(read(a), read(b), language) * direction,
    )
  }, [filtered, columns, sort, language])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  // Clamped rather than trusted: a filter typed on page four leaves the page
  // number pointing past the end for one render.
  const current = Math.min(page, pageCount - 1)
  const first = current * pageSize
  const visible = sorted.slice(first, first + pageSize)

  // A narrowed result is a new result, and page four of the old one says
  // nothing about it.
  useEffect(() => {
    setPage(0)
  }, [search, filterValues, sort])

  function toggleSort(column) {
    setSort((currentSort) => {
      if (!currentSort || currentSort.key !== column.key) {
        // Figures open largest first, because that is the question being asked
        // of a budget or an amount; words open A to Z.
        return { key: column.key, direction: column.align === 'right' ? 'desc' : 'asc' }
      }
      return {
        key: column.key,
        direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
      }
    })
  }

  function clearAll() {
    setSearch('')
    setFilterValues({})
  }

  // A table already inside a titled panel drops its own border and shadow, so
  // the dashboard does not draw two frames around one table.
  const panelClass = plain ? 'data-panel is-plain' : 'data-panel'
  const hasToolbar = searchable || filterOptions.length > 0 || toolbarExtra
  const isNarrowed = search.trim() !== '' || Object.values(filterValues).some((v) => v)

  if (error) {
    return (
      <section className={panelClass}>
        <div className="state-block">
          <span className="state-icon state-icon-danger">
            <AlertIcon size={20} />
          </span>
          <p className="state-title">{t('Could not load the data')}</p>
          <p className="state-text">{error}</p>
        </div>
      </section>
    )
  }

  if (loading) {
    return (
      <section className={panelClass} aria-busy="true">
        <div className="skeleton-rows">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="skeleton skeleton-line"
              style={{ width: index === 0 ? '32%' : `${92 - (index % 4) * 11}%` }}
            />
          ))}
        </div>
        <span className="visually-hidden">{t('Loading records')}</span>
      </section>
    )
  }

  return (
    <section className={panelClass}>
      {hasToolbar ? (
        <div className="data-toolbar">
          <div className="data-toolbar-controls">
            {searchable ? (
              <label className="field search-field">
                <span className="field-label">{t('Search')}</span>
                <span className="search-control">
                  <span className="search-icon">
                    <SearchIcon size={15} />
                  </span>
                  <input
                    type="search"
                    className="input"
                    value={search}
                    placeholder={t(searchPlaceholder || 'Search')}
                    aria-label={t(searchLabel || 'Search records')}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </span>
              </label>
            ) : null}

            {filterOptions.map((filter) => (
              <label className="field" key={filter.key}>
                <span className="field-label">{t(filter.label)}</span>
                <select
                  value={filterValues[filter.key] || ''}
                  onChange={(event) =>
                    setFilterValues((values) => ({
                      ...values,
                      [filter.key]: event.target.value,
                    }))
                  }
                >
                  <option value="">
                    {filter.allLabel
                      ? t(filter.allLabel)
                      : t('All {label}', {
                          label: t(filter.label).toLocaleLowerCase(language),
                        })}
                  </option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            {toolbarExtra}
          </div>

          {/* What is on the screen right now, in words - a filtered table that
              only printed its own length would read as a smaller database. */}
          <div className="data-count">
            {isNarrowed
              ? t('{shown} of {total} {noun}', {
                  shown: sorted.length.toLocaleString(locale),
                  total: safeRows.length.toLocaleString(locale),
                  noun: t(noun),
                })
              : t('{count} {noun}', {
                  count: safeRows.length.toLocaleString(locale),
                  noun: t(noun),
                })}
          </div>
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <div className="state-block">
          <span className="state-icon">
            <InboxIcon size={20} />
          </span>
          {/* Two different nothings. An empty table is a fact about the
              database; an empty search is a fact about the search, and telling
              a reader "no records" when they mistyped a name would send them
              to the wrong place. */}
          {isNarrowed ? (
            <>
              <p className="state-title">
                {t('No matching {noun}', { noun: t(noun) })}
              </p>
              <p className="state-text">
                {t('Nothing here matches the current search and filters.')}
              </p>
              <div className="state-actions">
                <button type="button" className="button button-sm" onClick={clearAll}>
                  {t('Clear search and filters')}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="state-title">{t(emptyTitle || 'Nothing to show')}</p>
              <p className="state-text">{t(emptyMessage || 'No records found.')}</p>
            </>
          )}
        </div>
      ) : (
        <div className="data-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => {
                  const isSorted = sort?.key === column.key
                  const sortable = column.sortable !== false
                  const classes = [
                    column.align === 'right' ? 'align-right' : '',
                    column.className || '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <th
                      key={column.key}
                      className={classes || undefined}
                      scope="col"
                      aria-sort={
                        isSorted
                          ? sort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : sortable
                            ? 'none'
                            : undefined
                      }
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className={isSorted ? 'sort-button is-sorted' : 'sort-button'}
                          onClick={() => toggleSort(column)}
                        >
                          {typeof column.header === 'string'
                            ? t(column.header)
                            : column.header}
                          <SortIcon direction={isSorted ? sort.direction : 'asc'} />
                        </button>
                      ) : (
                        <span className="data-head-static">
                          {typeof column.header === 'string'
                            ? t(column.header)
                            : column.header}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr
                  key={row.id ?? first + index}
                  className={onRowClick ? 'is-clickable' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => {
                    const classes = [
                      column.align === 'right' ? 'align-right' : '',
                      column.className || '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <td key={column.key} className={classes || undefined}>
                        {column.render ? column.render(row) : row[column.key]}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Absent below one page: "1 of 1" under nine rows is furniture. */}
      {pageCount > 1 ? (
        <div className="data-pager">
          <span>
            {t('{from}-{to} of {total}', {
              from: (first + 1).toLocaleString(locale),
              to: Math.min(first + pageSize, sorted.length).toLocaleString(locale),
              total: sorted.length.toLocaleString(locale),
            })}
          </span>
          <div className="data-pager-controls">
            <button
              type="button"
              className="icon-button"
              aria-label={t('Previous page')}
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeftIcon size={16} />
            </button>
            <span className="data-pager-page">
              {current + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label={t('Next page')}
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
