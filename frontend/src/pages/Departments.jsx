import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { mockDepartments } from '../data/mockDepartments'
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
  return (
    <>
      <PageHeader
        title="Departments"
        description="Organizational units. Mock data for now."
      />
      <DataTable columns={columns} rows={mockDepartments} />
    </>
  )
}
