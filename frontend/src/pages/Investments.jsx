import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { mockInvestments } from '../data/mockInvestments'
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
  return (
    <>
      <PageHeader
        title="Investments"
        description="Investments recorded against projects. Mock data for now."
      />
      <DataTable columns={columns} rows={mockInvestments} />
    </>
  )
}
