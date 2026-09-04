import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useApiData } from '../utils/api'
import { formatCurrency } from '../utils/format'

const columns = [
  { key: 'id', header: 'ID' },
  { key: 'project_name', header: 'Project' },
  { key: 'investment_type', header: 'Investment Type' },
  {
    key: 'amount',
    header: 'Amount',
    render: (investment) => formatCurrency(investment.amount),
  },
  { key: 'investment_date', header: 'Investment Date' },
]

export default function Investments() {
  const { data: investments, loading, error } = useApiData('/api/investments', [])

  return (
    <>
      <PageHeader
        title="Investments"
        description="Investments recorded against projects."
      />
      <DataTable
        columns={columns}
        rows={investments}
        loading={loading}
        error={error}
      />
    </>
  )
}
