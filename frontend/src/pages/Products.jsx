import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useApiData } from '../utils/api'
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
  const { data: products, loading, error } = useApiData('/api/products', [])

  return (
    <>
      <PageHeader
        title="Products"
        description="Product and subsystem catalog."
      />
      <DataTable
        columns={columns}
        rows={products}
        loading={loading}
        error={error}
      />
    </>
  )
}
