import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useApiData } from '../utils/api'
import { useT } from '../i18n'
import { formatCurrency } from '../utils/format'

// A category is a label rather than a name, so it is read in the reader's
// language while the product's own name is left as the catalogue holds it.
function CategoryName({ category }) {
  const t = useT()
  return category ? t(category) : '-'
}

// The catalogue reads as a name and what the thing is, with the category as
// the axis people slice it by and the unit cost as the figure they compare.
const columns = [
  {
    key: 'name',
    header: 'Product',
    className: 'cell-text',
    searchValue: (product) => `${product.name} ${product.description || ''}`,
    render: (product) => (
      <div className="cell-stack">
        <span className="cell-primary">{product.name}</span>
        {product.description ? (
          <span className="cell-sub">{product.description}</span>
        ) : null}
      </div>
    ),
  },
  {
    key: 'category',
    header: 'Category',
    searchable: false,
    render: (product) => <CategoryName category={product.category} />,
  },
  {
    key: 'unit_cost',
    header: 'Unit Cost',
    align: 'right',
    searchable: false,
    render: (product) => formatCurrency(product.unit_cost),
  },
  { key: 'id', header: 'ID', align: 'right', searchable: false },
]

const filters = [{ key: 'category', label: 'Category', allLabel: 'All categories' }]

export default function Products() {
  const { data: products, loading, error } = useApiData('/api/products', [])
  const t = useT()

  return (
    <>
      <PageHeader
        eyebrow={t('Management data')}
        title={t('Products')}
        description={t('The product and subsystem catalog, by category and unit cost.')}
      />
      <DataTable
        columns={columns}
        rows={products}
        loading={loading}
        error={error}
        searchable
        searchPlaceholder="Search name or description"
        searchLabel="Search products by name or description"
        filters={filters}
        noun="products"
        initialSort={{ key: 'name', direction: 'asc' }}
        emptyTitle="No products yet"
        emptyMessage="The products table has no rows."
      />
    </>
  )
}
