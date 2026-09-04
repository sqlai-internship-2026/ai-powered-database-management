import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useApiData } from '../utils/api'

const columns = [
  { key: 'id', header: 'ID' },
  { key: 'first_name', header: 'First Name' },
  { key: 'last_name', header: 'Last Name' },
  { key: 'department_name', header: 'Department' },
  { key: 'job_title', header: 'Job Title' },
  { key: 'hire_date', header: 'Hire Date' },
]

export default function Employees() {
  const { data: employees, loading, error } = useApiData('/api/employees', [])

  return (
    <>
      <PageHeader title="Employees" description="Employee directory." />
      <DataTable
        columns={columns}
        rows={employees}
        loading={loading}
        error={error}
      />
    </>
  )
}
