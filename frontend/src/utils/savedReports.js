// Reports a person built out of their own questions, kept in the browser.
//
// localStorage rather than a table, because saving a report would otherwise be
// the first thing in this application that writes to the database: a migration,
// a POST endpoint, a role that can do more than SELECT, and a decision about
// who may edit whose report. None of that is worth taking on for a convenience
// that a single reader gets the whole value of. The cost is stated plainly in
// the UI: a saved report lives in this browser and is not shared.
//
// What is stored is the definition, never the data - the question, the SQL and
// how the reader chose to draw it. Rows are fetched again on open, so a report
// shows today's figures rather than the ones that happened to be on screen the
// afternoon it was saved.

const KEY = 'sqlai.reports.v1'

// Every read is wrapped: storage throws outright in a browser set to block site
// data, and a report that cannot be saved must not take the page down with it.
function read() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(reports) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(reports))
    return true
  } catch {
    // Quota, private browsing, or storage switched off. The caller says so.
    return false
  }
}

export function newId() {
  // randomUUID needs a secure context, which localhost counts as - but a
  // deployment reached over plain http would not, and an id is not worth a
  // crash.
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function listReports() {
  return read().sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
}

export function loadReport(id) {
  return read().find((report) => report.id === id) || null
}

// Only the parts that define the report. Rows, summaries and the row count are
// left behind on purpose: they are results, and results are fetched again.
function definitionOf(card) {
  return {
    id: card.id,
    title: card.title,
    question: card.question,
    sql: card.sql,
    type: card.type,
    valueColumn: card.valueColumn,
  }
}

export function saveReport({ id, title, description, cards }) {
  const reports = read()
  const saved = {
    id: id || newId(),
    title: title?.trim() || 'Untitled report',
    description: description?.trim() || '',
    cards: cards.map(definitionOf),
    savedAt: new Date().toISOString(),
  }

  const index = reports.findIndex((report) => report.id === saved.id)
  if (index >= 0) {
    reports[index] = saved
  } else {
    reports.push(saved)
  }

  return write(reports) ? saved : null
}

export function deleteReport(id) {
  return write(read().filter((report) => report.id !== id))
}

// Whether anything can be saved at all, so the UI can say so once rather than
// failing at the moment somebody clicks Save.
export function storageAvailable() {
  try {
    const probe = `${KEY}.probe`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}
