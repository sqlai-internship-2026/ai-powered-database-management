// Shared display helpers. The database stores plain numbers and ISO dates;
// formatting stays in the frontend.
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('en-US')

const decimalFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '-'
  return currencyFormatter.format(amount)
}

// Budgets run from tens of thousands to hundreds of millions, so the unit is
// chosen per value instead of forcing everything into millions.
export function formatCompactCurrency(amount) {
  if (amount === null || amount === undefined) return '-'
  const absolute = Math.abs(amount)
  if (absolute >= 1_000_000_000) {
    return `${decimalFormatter.format(amount / 1_000_000_000)}B TRY`
  }
  if (absolute >= 1_000_000) {
    const millions = amount / 1_000_000
    const text =
      absolute >= 100_000_000
        ? numberFormatter.format(Math.round(millions))
        : decimalFormatter.format(millions)
    return `${text}M TRY`
  }
  if (absolute >= 1_000) {
    return `${numberFormatter.format(Math.round(amount / 1_000))}K TRY`
  }
  return formatCurrency(amount)
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '-'
  return numberFormatter.format(value)
}

export function formatPercent(value, fractionDigits = 1) {
  if (value === null || value === undefined) return '-'
  const text =
    fractionDigits === 0
      ? numberFormatter.format(Math.round(value))
      : decimalFormatter.format(value)
  return `${text}%`
}

// Negative values mean the end date is already behind us.
export function formatMonths(value) {
  if (value === null || value === undefined) return '-'
  if (value < 0) return `${numberFormatter.format(Math.abs(value))} mo overdue`
  return `${numberFormatter.format(value)} mo`
}

export function formatDate(isoDate) {
  if (!isoDate) return '-'
  return isoDate
}
