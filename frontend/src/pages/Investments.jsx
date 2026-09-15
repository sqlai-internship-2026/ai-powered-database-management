import { useMemo } from 'react'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import SummaryStrip from '../components/SummaryStrip'
import { useApiData } from '../utils/api'
import { formatCurrency, formatDay, formatNumber } from '../utils/format'

// Which programme the money went to, what kind of spend it was, how much and
// when. The amount and the date are the two columns anybody sorts by, so both
// carry figures that line up under each other.
const columns = [
  {
    key: 'project_name',
    header: 'Project',
    className: 'cell-text',
    render: (investment) => (
      <span className="cell-primary">{investment.project_name || 'Unassigned'}</span>
    ),
  },
  { key: 'investment_type', header: 'Type' },
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
        eyebrow="Management data"
        title="Investments"
        description="Every investment recorded against a project, with its type, amount and date."
      />

      {!loading && !error ? (
        <SummaryStrip
          items={[
            { label: 'Records', value: formatNumber(totals.count) },
            { label: 'Total amount', value: formatCurrency(totals.amount) },
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
