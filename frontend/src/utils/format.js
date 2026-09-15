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

// What a result says about its own size, for the line under an answer.
//
// Three shapes, because three things can be true. Under the cap the count is
// the whole story. At the cap the reader needs to know what is missing, and a
// bare "may be incomplete" does not tell them whether they are looking at most
// of the answer or a sliver of it. When the total could not be counted - a
// wide query timing out is the usual reason - saying so is better than a
// number nobody checked.
export function describeRowCount({ rowCount, truncated, totalRows }) {
  const rows = `${formatNumber(rowCount)} ${rowCount === 1 ? 'row' : 'rows'}`
  if (!truncated) return rows
  if (totalRows) return `first ${formatNumber(rowCount)} of ${formatNumber(totalRows)} rows`
  return `${rows} - cut off at the row limit, so the answer may be incomplete`
}

export function formatDate(isoDate) {
  if (!isoDate) return '-'
  return isoDate
}

// The same ISO date written for a reader: "12 Mar 2026" rather than
// "2026-03-12". Parsed by hand instead of through Date(), because
// new Date('2026-03-12') is read as midnight UTC and comes back as the
// eleventh for anyone west of Greenwich.
const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function formatDay(isoDate) {
  if (!isoDate) return '-'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate))
  if (!match) return String(isoDate)
  const [, year, month, day] = match
  const name = monthNames[Number(month) - 1]
  if (!name) return String(isoDate)
  return `${Number(day)} ${name} ${year}`
}

// Whole days from today to an ISO date, negative once the date is behind us.
// Both sides are taken at UTC midnight so the answer never moves with the
// clock, and a browser in another timezone counts the same days.
export function daysUntil(isoDate) {
  if (!isoDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate))
  if (!match) return null
  const [, year, month, day] = match
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day))
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

// The two or three letters standing in for a person where there is no photo to
// show. Keycloak usernames arrive in several shapes - "ybasaga", "yigit.han",
// "Yigit Han" - so the split covers the separators all of them use.
export function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return parts[0][0] + parts[1][0]
}

// An ISO timestamp written for a reader: "15 Sep 2026, 14:32". Used where the
// page was printing the raw string the backend sent, which is accurate and
// unreadable. The value itself is untouched - only how it is shown.
//
// Parsed by hand for the same reason formatDay is: the date part of an
// ISO string must not be shifted by the reader's timezone. A timestamp that
// carries a zone offset is handed to Date() instead, because there the offset
// is the point.
export function formatDateTime(isoValue) {
  if (!isoValue) return '-'
  const text = String(isoValue)
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(text)
  if (!match) return text

  const [, year, month, day, hour, minute] = match
  const name = monthNames[Number(month) - 1]
  if (!name) return text

  if (/(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) {
      const local = monthNames[parsed.getMonth()]
      const hours = String(parsed.getHours()).padStart(2, '0')
      const minutes = String(parsed.getMinutes()).padStart(2, '0')
      return `${parsed.getDate()} ${local} ${parsed.getFullYear()}, ${hours}:${minutes}`
    }
  }

  return `${Number(day)} ${name} ${year}, ${hour}:${minute}`
}
