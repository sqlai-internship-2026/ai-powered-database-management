import { useMemo, useState } from 'react'
import QueryResultCard from '../../components/QueryResultCard'
import { apiPost, useApiData } from '../../utils/api'
import {
  deleteReport,
  listReports,
  loadReport,
  newId,
  saveReport,
  storageAvailable,
} from '../../utils/savedReports'

// Reports somebody builds out of their own questions, rather than out of the
// three the other tabs were written to answer in advance.
//
// The loop is: ask a question, see the rows drawn as whatever shape they turn
// out to be, disagree with that shape if it is wrong, and keep the card. Cards
// accumulate into a report with a title, which can be saved, reopened and
// printed.
//
// What is kept is the query, not the rows. Reopening a report runs each card's
// SQL again through /api/reports/run, so the figures are today's - and no model
// is involved, which is what makes reopening instant and free. The question is
// stored beside the SQL only so the card can still say what was asked.

const emptyReport = { id: null, title: '', description: '' }

export default function AskReport() {
  const { data: examples } = useApiData('/api/reports/ask/examples')

  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  const [asking, setAsking] = useState(false)

  const [report, setReport] = useState(emptyReport)
  const [cards, setCards] = useState([])
  const [saved, setSaved] = useState(() => listReports())
  const [status, setStatus] = useState(null)

  // Checked once. A browser that refuses storage will refuse it all afternoon,
  // and the answer belongs next to the Save button rather than behind it.
  const canStore = useMemo(() => storageAvailable(), [])
  const dirty = cards.length > 0

  function cardFrom(answer, overrides = {}) {
    return {
      id: newId(),
      title: answer.question || 'Result',
      type: answer.chart?.type,
      valueColumn: answer.chart?.value_column,
      ...answer,
      ...overrides,
    }
  }

  async function ask(text) {
    const asked = (text ?? question).trim()
    if (asked.length < 3) return

    setAsking(true)
    setError(null)
    setPending(null)
    setStatus(null)

    try {
      setPending(cardFrom(await apiPost('/api/reports/ask', { question: asked })))
    } catch (err) {
      setError(err.message)
    } finally {
      setAsking(false)
    }
  }

  function patchCard(id, patch) {
    setCards((current) =>
      current.map((card) => (card.id === id ? { ...card, ...patch } : card)),
    )
  }

  function addPending() {
    if (!pending) return
    setCards((current) => [...current, pending])
    setPending(null)
    setQuestion('')
    setStatus(null)
  }

  function moveCard(id, offset) {
    setCards((current) => {
      const index = current.findIndex((card) => card.id === id)
      const target = index + offset
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  // Runs one card's stored SQL again. Used by Refresh and when a report is
  // opened, which is the same operation: a card with a query and no rows yet.
  async function runCard(card) {
    patchCard(card.id, { loading: true, error: null })
    try {
      const result = await apiPost('/api/reports/run', {
        sql: card.sql,
        question: card.question || '',
      })
      patchCard(card.id, { ...result, loading: false, error: null })
    } catch (err) {
      // The card keeps whatever it was showing and says what went wrong, which
      // is more useful than a card that empties itself on a network blip.
      patchCard(card.id, { loading: false, error: err.message })
    }
  }

  function refreshAll() {
    setStatus(null)
    cards.forEach(runCard)
  }

  function openReport(id) {
    const stored = loadReport(id)
    if (!stored) return

    const opened = stored.cards.map((card) => ({
      ...card,
      columns: [],
      rows: [],
      row_count: 0,
      chart: null,
      answer: null,
      loading: true,
    }))

    setReport({ id: stored.id, title: stored.title, description: stored.description })
    setCards(opened)
    setPending(null)
    setStatus(null)
    // In parallel: a report holds a handful of cards, and each one is a single
    // indexed read against a five second timeout.
    opened.forEach(runCard)
  }

  function persist(asNew = false) {
    const stored = saveReport({
      id: asNew ? null : report.id,
      title: report.title,
      description: report.description,
      cards,
    })

    if (!stored) {
      setStatus('This browser would not store the report. Check its site data settings.')
      return
    }

    setReport({ id: stored.id, title: stored.title, description: stored.description })
    setSaved(listReports())
    setStatus(`Saved "${stored.title}" in this browser.`)
  }

  function discard(id) {
    deleteReport(id)
    setSaved(listReports())
    if (report.id === id) setReport({ ...report, id: null })
    setStatus(null)
  }

  function startOver() {
    setReport(emptyReport)
    setCards([])
    setPending(null)
    setStatus(null)
  }

  return (
    <>
      <section className="card">
        <form
          className="ask-form"
          onSubmit={(event) => {
            event.preventDefault()
            ask()
          }}
        >
          <label className="field">
            <span className="field-label">Ask a question about the data</span>
            <input
              type="text"
              className="ask-input"
              value={question}
              placeholder="Total investment per year"
              maxLength={500}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="button button-primary"
            disabled={asking || question.trim().length < 3}
          >
            {asking ? 'Asking...' : 'Ask'}
          </button>
        </form>

        {examples?.questions?.length ? (
          <div className="ask-examples">
            <span className="field-label">Try one of these</span>
            <div className="audit-filters">
              {examples.questions.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="filter-button"
                  onClick={() => {
                    setQuestion(example)
                    ask(example)
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="ask-hint">
          Name a chart in the question - "as a pie chart", "over time" - and the
          answer is drawn that way when the result supports it. Otherwise the
          shape of the result decides, and the buttons on the card overrule it.
        </p>
      </section>

      {error ? <div className="notice ask-error">{error}</div> : null}

      {/* The answer sits on its own until it is kept, so asking three questions
          in a row does not fill a report with two of them by accident. */}
      {pending ? (
        <QueryResultCard
          card={pending}
          onTypeChange={(type) => setPending({ ...pending, type })}
          onValueChange={(valueColumn) => setPending({ ...pending, valueColumn })}
          actions={
            <button type="button" className="button button-primary" onClick={addPending}>
              Add to report
            </button>
          }
        />
      ) : null}

      <section className="report-builder">
        <header className="builder-head">
          <div className="builder-titles">
            <input
              className="builder-title-input"
              value={report.title}
              placeholder="Untitled report"
              maxLength={120}
              aria-label="Report title"
              onChange={(event) => setReport({ ...report, title: event.target.value })}
            />
            <input
              className="builder-description-input"
              value={report.description}
              placeholder="What this report is for"
              maxLength={240}
              aria-label="Report description"
              onChange={(event) =>
                setReport({ ...report, description: event.target.value })
              }
            />
          </div>

          <div className="builder-actions">
            {saved.length > 0 ? (
              <label className="field">
                <span className="field-label">Open a saved report</span>
                <select
                  value={report.id || ''}
                  onChange={(event) => openReport(event.target.value)}
                >
                  <option value="">Select...</option>
                  {saved.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title} ({entry.cards.length})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <button
              type="button"
              className="button"
              disabled={!dirty}
              onClick={refreshAll}
            >
              Refresh
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!dirty || !canStore}
              onClick={() => persist(false)}
            >
              {report.id ? 'Save' : 'Save report'}
            </button>
            {report.id ? (
              <>
                <button
                  type="button"
                  className="button"
                  disabled={!canStore}
                  onClick={() => persist(true)}
                >
                  Save as new
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => discard(report.id)}
                >
                  Delete
                </button>
              </>
            ) : null}
            {dirty ? (
              <button type="button" className="button" onClick={startOver}>
                Clear
              </button>
            ) : null}
          </div>
        </header>

        {status ? <p className="builder-status">{status}</p> : null}

        {!canStore ? (
          <p className="builder-note">
            This browser is not storing site data, so a report can be built and
            printed but not saved.
          </p>
        ) : (
          <p className="builder-note">
            Saved reports live in this browser only. Each card keeps its query,
            not its rows, so opening one shows the figures as they are today.
          </p>
        )}

        {cards.length === 0 ? (
          <p className="chart-empty">
            No cards yet. Ask a question above, then keep the answers worth
            keeping - they become a report you can name, save and print.
          </p>
        ) : (
          <div className="report-body">
            {cards.map((card, index) => (
              <QueryResultCard
                key={card.id}
                card={card}
                onTitleChange={(title) => patchCard(card.id, { title })}
                onTypeChange={(type) => patchCard(card.id, { type })}
                onValueChange={(valueColumn) => patchCard(card.id, { valueColumn })}
                actions={
                  <>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Move card up"
                      disabled={index === 0}
                      onClick={() => moveCard(card.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Move card down"
                      disabled={index === cards.length - 1}
                      onClick={() => moveCard(card.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={card.loading}
                      onClick={() => runCard(card)}
                    >
                      {card.loading ? 'Running...' : 'Refresh'}
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() =>
                        setCards((current) =>
                          current.filter((entry) => entry.id !== card.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
