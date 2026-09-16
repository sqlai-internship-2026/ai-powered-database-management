import { useMemo } from 'react'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import SummaryStrip from '../components/SummaryStrip'
import { useApiData } from '../utils/api'
import { useT } from '../i18n'
import { formatCurrency, formatDay, formatNumber } from '../utils/format'

// A project with no investment attached, and the type of the spend, are both
// words rather than names: they are read in the reader's language.
function ProjectName({ name }) {
  const t = useT()
  return <span className="cell-primary">{name || t('Unassigned')}</span>
}

function TypeName({ type }) {
  const t = useT()
  return type ? t(type) : '-'
}

// Which programme the money went to, what kind of spend it was, how much and
// when. The amount and the date are the two columns anybody sorts by, so both
// carry figures that line up under each other.
const columns = [
  {
    key: 'project_name',
    header: 'Project',
    className: 'cell-text',
    render: (investment) => <ProjectName name={investment.project_name} />,
  },
  {
    key: 'investment_type',
    header: 'Type',
    render: (investment) => <TypeName type={investment.investment_type} />,
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    searchable: false,
    render: (investment) => formatCurrency(investment.amount),
  },
  {
    key: 'investment_date',
    header: 'Date',
    align: 'right',
    searchable: false,
    render: (investment) => formatDay(investment.investment_date),
  },
  { key: 'id', header: 'ID', align: 'right', searchable: false },
]

const filters = [
  { key: 'investment_type', label: 'Type', allLabel: 'All investment types' },
]

export default function Investments() {
  const { data: investments, loading, error } = useApiData('/api/investments', [])
  const t = useT()

  // Summed over the rows already on the screen; no second endpoint, and so no
  // way for the total to disagree with the table under it.
  const totals = useMemo(() => {
    const amount = investments.reduce(
      (sum, investment) => sum + (investment.amount || 0),
      0,
    )
    return { count: investments.length, amount }
  }, [investments])

  return (
    <>
      <PageHeader
        eyebrow={t('Management data')}
        title={t('Investments')}
        description={t(
          'Every investment recorded against a project, with its type, amount and date.',
        )}
      />

      {!loading && !error ? (
        <SummaryStrip
          items={[
            { label: t('Records'), value: formatNumber(totals.count) },
            { label: t('Total amount'), value: formatCurrency(totals.amount) },
          ]}
        />
      ) : null}

      <DataTable
        columns={columns}
        rows={investments}
        loading={loading}
        error={error}
        searchable
        searchPlaceholder="Search project or type"
        searchLabel="Search investments by project or investment type"
        filters={filters}
        noun="investments"
        initialSort={{ key: 'investment_date', direction: 'desc' }}
        emptyTitle="No investments yet"
        emptyMessage="The investments table has no rows."
      />
    </>
  )
}
