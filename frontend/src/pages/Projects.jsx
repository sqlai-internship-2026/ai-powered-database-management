import { Outlet, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import { ChevronRightIcon } from '../components/icons'
import { useApiData } from '../utils/api'
import { formatCurrency, formatDay } from '../utils/format'

// The name is what anybody is looking for, so it leads and carries the
// description under it. The id is still in the table - a row somebody has to
// quote to the database needs it - but it is the last column rather than the
// first: nobody scans a programme list by primary key.
const columns = [
  {
    key: 'name',
    header: 'Project',
    className: 'cell-text',
    render: (project) => (
      <div className="cell-stack">
        <span className="cell-primary">{project.name}</span>
        {project.description ? (
          <span className="cell-sub">{project.description}</span>
        ) : null}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    searchable: false,
    render: (project) => <StatusBadge status={project.status} />,
  },
  {
    key: 'budget',
    header: 'Budget',
    align: 'right',
    searchable: false,
    render: (project) => formatCurrency(project.budget),
  },
  {
    key: 'start_date',
    header: 'Start',
    searchable: false,
    render: (project) => formatDay(project.start_date),
  },
  {
    key: 'end_date',
    header: 'End',
    searchable: false,
    render: (project) => formatDay(project.end_date),
  },
  { key: 'id', header: 'ID', align: 'right', searchable: false },
  // The row itself opens the project, from the mouse and from Enter or Space.
  // The chevron only says that it can; a button of its own inside a row that
  // is already the control would be a second Tab stop doing the same thing.
  {
    key: 'open',
    header: <span className="visually-hidden">Details</span>,
    sortable: false,
    searchable: false,
    className: 'cell-open',
    render: () => (
      <span className="row-open-hint" aria-hidden="true">
        <ChevronRightIcon size={16} />
      </span>
    ),
  },
]

const filters = [{ key: 'status', label: 'Status', allLabel: 'All statuses' }]

export default function Projects() {
  const { data: projects, loading, error } = useApiData('/api/projects', [])
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        eyebrow="Management data"
        title="Projects"
        description="Every programme on the books, with its budget, its schedule and where it currently stands. Open one to see its team, products and investments."
      />
      <DataTable
        columns={columns}
        rows={projects}
        loading={loading}
        error={error}
        searchable
        searchPlaceholder="Search project name"
        searchLabel="Search projects by name"
        filters={filters}
        noun="projects"
        initialSort={{ key: 'start_date', direction: 'desc' }}
        emptyTitle="No projects yet"
        emptyMessage="The projects table has no rows."
        onRowClick={(project) =>
          navigate(`/projects/${project.id}`, { state: { fromList: true } })
        }
      />

      {/* The project detail panel, when the address names a project. */}
      <Outlet />
    </>
  )
}
