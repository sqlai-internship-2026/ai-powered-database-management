// Shared display helpers. The database stores plain numbers and ISO dates;
// formatting stays in the frontend.
//
// Everything here follows the chosen language: "1,250,000 TRY" in English is
// "₺1.250.000" in Turkish, and "12 Mar 2026" is "12 Mar 2026" in both but
// built from a different list of month names. The language is read from the
// i18n module on every call rather than captured once, because a formatter
// created at import time would keep the language the page happened to open in.
import { currentLanguage, currentLocale, translateNow } from '../i18n'

// One set of Intl formatters per locale, built the first time that locale is
// asked for. Intl.NumberFormat is expensive enough that building one per call
// would show on a table of several hundred figures.
const cache = new Map()

function formatters() {
  const locale = currentLocale()
  let entry = cache.get(locale)
  if (!entry) {
    entry = {
      currency: new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'TRY',
        maximumFractionDigits: 0,
      }),
      number: new Intl.NumberFormat(locale),
      decimal: new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    }
    cache.set(locale, entry)
  }
  return entry
}

// What a shortened amount is called. English writes the unit after the figure
// and the currency after that; Turkish uses the same order with its own
// abbreviations, so both read as "<figure> <unit> <currency>".
const COMPACT_UNITS = {
  en: { billion: 'B TRY', million: 'M TRY', thousand: 'K TRY' },
  tr: { billion: 'Mr TL', million: 'Mn TL', thousand: 'B TL' },
}

function compactUnit(size) {
  return (COMPACT_UNITS[currentLanguage()] || COMPACT_UNITS.en)[size]
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '-'
  return formatters().currency.format(amount)
}

// Budgets run from tens of thousands to hundreds of millions, so the unit is
// chosen per value instead of forcing everything into millions.
export function formatCompactCurrency(amount) {
  if (amount === null || amount === undefined) return '-'
  const { number, decimal } = formatters()
  const absolute = Math.abs(amount)
  if (absolute >= 1_000_000_000) {
    return `${decimal.format(amount / 1_000_000_000)} ${compactUnit('billion')}`
  }
  if (absolute >= 1_000_000) {
    const millions = amount / 1_000_000
    const text =
      absolute >= 100_000_000
        ? number.format(Math.round(millions))
        : decimal.format(millions)
    return `${text} ${compactUnit('million')}`
  }
  if (absolute >= 1_000) {
    return `${number.format(Math.round(amount / 1_000))} ${compactUnit('thousand')}`
  }
  return formatCurrency(amount)
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '-'
  return formatters().number.format(value)
}

export function formatPercent(value, fractionDigits = 1) {
  if (value === null || value === undefined) return '-'
  const { number, decimal } = formatters()
  const text =
    fractionDigits === 0 ? number.format(Math.round(value)) : decimal.format(value)
  return `${text}%`
}

// A figure with the unit it is counted in: "24 days", "24 gün". Turkish takes
// no plural suffix after a number, so the plural form is only ever reached in
// English.
export function formatCount(value, one, many) {
  const word = currentLanguage() === 'tr' ? one : value === 1 ? one : many || `${one}s`
  return `${formatNumber(value)} ${translateNow(word)}`
}

// Negative values mean the end date is already behind us.
export function formatMonths(value) {
  if (value === null || value === undefined) return '-'
  if (value < 0) {
    return translateNow('{count} mo overdue', {
      count: formatNumber(Math.abs(value)),
    })
  }
  return translateNow('{count} mo', { count: formatNumber(value) })
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
  const rows =
    currentLanguage() === 'tr' || rowCount !== 1
      ? translateNow('{count} rows', { count: formatNumber(rowCount) })
      : translateNow('{count} row', { count: formatNumber(rowCount) })
  if (!truncated) return rows
  if (totalRows) {
    return translateNow('first {count} of {total} rows', {
      count: formatNumber(rowCount),
      total: formatNumber(totalRows),
    })
  }
  return translateNow(
    '{rows} - cut off at the row limit, so the answer may be incomplete',
    { rows },
  )
}

export function formatDate(isoDate) {
  if (!isoDate) return '-'
  return isoDate
}

// The same ISO date written for a reader: "12 Mar 2026" rather than
// "2026-03-12". Parsed by hand instead of through Date(), because
// new Date('2026-03-12') is read as midnight UTC and comes back as the
// eleventh for anyone west of Greenwich.
const MONTH_NAMES = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
}

function monthNames() {
  return MONTH_NAMES[currentLanguage()] || MONTH_NAMES.en
}

export function formatDay(isoDate) {
  if (!isoDate) return '-'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate))
  if (!match) return String(isoDate)
  const [, year, month, day] = match
  const name = monthNames()[Number(month) - 1]
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

  const names = monthNames()
  const [, year, month, day, hour, minute] = match
  const name = names[Number(month) - 1]
  if (!name) return text

  if (/(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) {
      const local = names[parsed.getMonth()]
      const hours = String(parsed.getHours()).padStart(2, '0')
      const minutes = String(parsed.getMinutes()).padStart(2, '0')
      return `${parsed.getDate()} ${local} ${parsed.getFullYear()}, ${hours}:${minutes}`
    }
  }

  return `${Number(day)} ${name} ${year}, ${hour}:${minute}`
}
