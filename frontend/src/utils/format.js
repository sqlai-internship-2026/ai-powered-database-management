// Shared display helpers. The database stores plain numbers and ISO dates;
// formatting stays in the frontend.
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('en-US')

export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '-'
  return currencyFormatter.format(amount)
}

export function formatCompactCurrency(amount) {
  if (amount === null || amount === undefined) return '-'
  const millions = amount / 1_000_000
  return `${numberFormatter.format(Math.round(millions))}M TRY`
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '-'
  return numberFormatter.format(value)
}

export function formatDate(isoDate) {
  if (!isoDate) return '-'
  return isoDate
}
