import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useApiData } from '../utils/api'
import { formatNumber } from '../utils/format'

const columns = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'description', header: 'Description' },
  {
    key: 'employee_count',
    header: 'Employee Count',
    render: (department) => formatNumber(department.employee_count),
  },
]

export default function Departments() {
  const { data: departments, loading, error } = useApiData('/api/departments', [])

  return (
    <>
      <PageHeader
        title="Departments"
        description="Organizational units and their headcount."
      />
      <DataTable
        columns={columns}
        rows={departments}
        loading={loading}
        error={error}
      />
    </>
  )
}
