// CSV export for the report cards. Kept dependency-free: a Blob plus a
// temporary link is all a browser needs to save a file.

// Excel and Sheets both need the quote-doubling form, and a leading BOM so
// non-ASCII characters survive the round trip.
function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(columns, rows) {
  const header = columns.map((column) => escapeCell(column.header)).join(',')
  const body = rows.map((row) =>
    columns
      .map((column) =>
        escapeCell(column.value ? column.value(row) : row[column.key]),
      )
      .join(','),
  )
  return [header, ...body].join('\r\n')
}

export function downloadCsv(filename, columns, rows) {
  const blob = new Blob(['﻿', toCsv(columns, rows)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
