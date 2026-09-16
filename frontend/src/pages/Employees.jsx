import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useApiData } from '../utils/api'
import { useT } from '../i18n'
import { formatDay } from '../utils/format'

// One person is one thing, so the two name columns are one column with the
// email under it, and the id is not a column at all - nobody looks somebody up
// by it, and a directory reads better without a number in front of every name.
//
// The endpoint also returns salary. It is deliberately not drawn here: a
// directory anyone signed in can open is the wrong place for it.
const columns = [
  {
    key: 'last_name',
    header: 'Employee',
    sortValue: (employee) => `${employee.last_name} ${employee.first_name}`,
    searchValue: (employee) => `${employee.first_name} ${employee.last_name}`,
    render: (employee) => (
      <div className="cell-stack">
        <span className="cell-primary">
          {employee.first_name} {employee.last_name}
        </span>
        {employee.email ? <span className="cell-sub">{employee.email}</span> : null}
      </div>
    ),
  },
  { key: 'job_title', header: 'Job Title' },
  { key: 'department_name', header: 'Department' },
  {
    key: 'hire_date',
    header: 'Hire Date',
    searchable: false,
    render: (employee) => formatDay(employee.hire_date),
  },
]

const filters = [
  { key: 'department_name', label: 'Department', allLabel: 'All departments' },
]

export default function Employees() {
  const { data: employees, loading, error } = useApiData('/api/employees', [])
  const t = useT()

  return (
    <>
      <PageHeader
        eyebrow={t('Management data')}
        title={t('Employees')}
        description={t(
          'The company directory: who works here, what they do and which department they belong to.',
        )}
      />
      <DataTable
        columns={columns}
        rows={employees}
        loading={loading}
        error={error}
        searchable
        searchPlaceholder="Search name, department or title"
        searchLabel="Search employees by name, department or job title"
        filters={filters}
        noun="employees"
        initialSort={{ key: 'last_name', direction: 'asc' }}
        emptyTitle="No employees yet"
        emptyMessage="The employees table has no rows."
      />
    </>
  )
}
