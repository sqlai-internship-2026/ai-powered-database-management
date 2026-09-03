import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { mockEmployees } from '../data/mockEmployees'

const columns = [
  { key: 'id', header: 'ID' },
  { key: 'first_name', header: 'First Name' },
  { key: 'last_name', header: 'Last Name' },
  { key: 'department_name', header: 'Department' },
  { key: 'job_title', header: 'Job Title' },
  { key: 'hire_date', header: 'Hire Date' },
]

export default function Employees() {
  return (
    <>
      <PageHeader
        title="Employees"
        description="Employee directory. Mock data for now."
      />
      <DataTable columns={columns} rows={mockEmployees} />
    </>
  )
}
