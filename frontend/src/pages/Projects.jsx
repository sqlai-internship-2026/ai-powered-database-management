import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import { mockProjects } from '../data/mockProjects'
import { formatCurrency } from '../utils/format'

const columns = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  {
    key: 'status',
    header: 'Status',
    render: (project) => <StatusBadge status={project.status} />,
  },
  {
    key: 'budget',
    header: 'Budget',
    render: (project) => formatCurrency(project.budget),
  },
  { key: 'start_date', header: 'Start Date' },
  { key: 'end_date', header: 'End Date' },
]

export default function Projects() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Active and completed programs. Mock data for now."
      />
      <DataTable columns={columns} rows={mockProjects} />
    </>
  )
}
