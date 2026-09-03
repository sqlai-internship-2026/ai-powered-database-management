import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { mockProducts } from '../data/mockProducts'
import { formatCurrency } from '../utils/format'

const columns = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'category', header: 'Category' },
  { key: 'description', header: 'Description' },
  {
    key: 'unit_cost',
    header: 'Unit Cost',
    render: (product) => formatCurrency(product.unit_cost),
  },
]

export default function Products() {
  return (
    <>
      <PageHeader
        title="Products"
        description="Product and subsystem catalog. Mock data for now."
      />
      <DataTable columns={columns} rows={mockProducts} />
    </>
  )
}
