import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import { useApiData } from '../utils/api'
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
  const { data: projects, loading, error } = useApiData('/api/projects', [])

  return (
    <>
      <PageHeader
        title="Projects"
        description="Active and completed programs."
      />
      <DataTable
        columns={columns}
        rows={projects}
        loading={loading}
        error={error}
      />
    </>
  )
}
