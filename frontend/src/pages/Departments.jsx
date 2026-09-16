import { useMemo } from 'react'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import SummaryStrip from '../components/SummaryStrip'
import { useApiData } from '../utils/api'
import { useT } from '../i18n'
import { formatNumber } from '../utils/format'

// A department is a name and what it is for, so those two are one column with
// the name set above its own description. The headcount is the figure the list
// is usually sorted by, which is why the table opens on it.
const columns = [
  {
    key: 'name',
    header: 'Department',
    className: 'cell-text',
    searchValue: (department) => `${department.name} ${department.description || ''}`,
    render: (department) => (
      <div className="cell-stack">
        <span className="cell-primary">{department.name}</span>
        {department.description ? (
          <span className="cell-sub">{department.description}</span>
        ) : null}
      </div>
    ),
  },
  {
    key: 'employee_count',
    header: 'Employees',
    align: 'right',
    searchable: false,
    render: (department) => formatNumber(department.employee_count),
  },
  { key: 'id', header: 'ID', align: 'right', searchable: false },
]

export default function Departments() {
  const { data: departments, loading, error } = useApiData('/api/departments', [])
  const t = useT()

  // Counted from the rows on the screen rather than asked of a second
  // endpoint, so the totals can never disagree with the table under them.
  const totals = useMemo(() => {
    const employees = departments.reduce(
      (sum, department) => sum + (department.employee_count || 0),
      0,
    )
    return { departments: departments.length, employees }
  }, [departments])

  return (
    <>
      <PageHeader
        eyebrow={t('Management data')}
        title={t('Departments')}
        description={t(
          'Organizational units, what each one is responsible for and how many people it holds.',
        )}
      />

      {!loading && !error ? (
        <SummaryStrip
          items={[
            { label: t('Departments'), value: formatNumber(totals.departments) },
            { label: t('Employees assigned'), value: formatNumber(totals.employees) },
          ]}
        />
      ) : null}

      <DataTable
        columns={columns}
        rows={departments}
        loading={loading}
        error={error}
        searchable
        searchPlaceholder="Search departments"
        searchLabel="Search departments by name or description"
        noun="departments"
        initialSort={{ key: 'employee_count', direction: 'desc' }}
        emptyTitle="No departments yet"
        emptyMessage="The departments table has no rows."
      />
    </>
  )
}
