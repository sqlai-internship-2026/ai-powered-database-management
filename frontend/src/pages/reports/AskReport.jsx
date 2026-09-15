import { useMemo, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import QueryResultCard from '../../components/QueryResultCard'
import StateBlock from '../../components/StateBlock'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  RefreshIcon,
  SaveIcon,
  SparkIcon,
  TrashIcon,
} from '../../components/icons'
import { apiPost, useApiData } from '../../utils/api'
import {
  deleteReport,
  listReports,
  loadReport,
  newId,
  reportSignature,
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
// The screen is three places rather than one scroll: the question box, the
// result that just came back, and the report being built out of the ones worth
// keeping. They were a single column before, which read as one long flow and
// left no answer to "which of these is mine and which is the report's?".
//
// What is kept is the query, not the rows. Reopening a report runs each card's
// SQL again through /api/reports/run, so the figures are today's - and no model
// is involved, which is what makes reopening instant and free. The question is
// stored beside the SQL only so the card can still say what was asked.

const emptyReport = { id: null, title: '', description: '' }
const EMPTY_SIGNATURE = reportSignature({ title: '', description: '', cards: [] })

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
  // The report as it stood the last time it was written to storage. Everything
  // "unsaved changes" means is a comparison against this.
  const [savedSignature, setSavedSignature] = useState(EMPTY_SIGNATURE)
  const [confirm, setConfirm] = useState(null)

  // Checked once. A browser that refuses storage will refuse it all afternoon,
  // and the answer belongs next to the Save button rather than behind it.
  const canStore = useMemo(() => storageAvailable(), [])

  const hasCards = cards.length > 0
  // Not "are there cards?", which is what this used to be: a report opened from
  // storage and left alone had cards and nothing to save, and a saved report
  // whose title or card order had since been changed had cards and something
  // to save. Both looked identical. The signature covers the title, the
  // description, the order of the cards and how each one is drawn.
  const signature = reportSignature({
    title: report.title,
    description: report.description,
    cards,
  })
  const unsaved = signature !== savedSignature

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

  async function ask(asked) {
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

  // A result that has not been kept is one question away from being gone, and
  // it used to go without a word. Asking again while one is on screen now says
  // so first, and the safe answer is the one the dialog opens on.
  function requestAsk(text) {
    const asked = (text ?? question).trim()
    if (asked.length < 3 || asking) return

    if (pending) {
      setConfirm({
        title: 'Replace the result on screen?',
        description:
          'This result has not been added to the report yet. Asking another question replaces it, and getting it back means asking again.',
        confirmLabel: 'Replace it',
        cancelLabel: 'Keep it',
        onConfirm: () => {
          setConfirm(null)
          ask(asked)
        },
      })
      return
    }

    ask(asked)
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
      // The card keeps the SQL it was saved with. The endpoint echoes back the
      // form it actually ran - the same query, normalised - and letting that
      // overwrite the stored text would rewrite the card's definition on every
      // refresh, which is exactly what "unsaved changes" is watching for.
      const { sql: _ran, ...rows } = result
      patchCard(card.id, { ...rows, loading: false, error: null })
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
    setSavedSignature(reportSignature(stored))
    setPending(null)
    setStatus(null)
    // In parallel: a report holds a handful of cards, and each one is a single
    // indexed read against a five second timeout.
    opened.forEach(runCard)
  }

  // Opening another report throws away whatever is on screen, so it asks the
  // same way asking a new question does.
  function requestOpen(id) {
    if (!id) return
    if (unsaved && hasCards) {
      setConfirm({
        title: 'Open another report?',
        description:
          'The report on screen has changes that have not been saved. Opening another one discards them.',
        confirmLabel: 'Discard and open',
        cancelLabel: 'Stay here',
        onConfirm: () => {
          setConfirm(null)
          openReport(id)
        },
      })
      return
    }
    openReport(id)
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
    setSavedSignature(reportSignature(stored))
    setStatus(`Saved "${stored.title}" in this browser.`)
  }

  function discard(id) {
    deleteReport(id)
    setSaved(listReports())
    if (report.id === id) {
      setReport((current) => ({ ...current, id: null }))
      // Nothing in storage matches what is on screen any more, so nothing on
      // screen is saved.
      setSavedSignature(null)
    }
    setStatus('The saved copy was deleted. What is on screen is still here.')
  }

  function startOver() {
    setReport(emptyReport)
    setCards([])
    setPending(null)
    setSavedSignature(EMPTY_SIGNATURE)
    setStatus(null)
  }

  function requestDelete() {
    const entry = saved.find((item) => item.id === report.id)
    setConfirm({
      title: 'Delete this saved report?',
      description: `"${entry?.title || report.title || 'Untitled report'}" will be removed from this browser. The cards stay on screen, but the saved copy cannot be recovered.`,
      confirmLabel: 'Delete it',
      cancelLabel: 'Keep it',
      onConfirm: () => {
        setConfirm(null)
        discard(report.id)
      },
    })
  }

  function requestClear() {
    setConfirm({
      title: 'Clear this report?',
      description: unsaved
        ? 'Every card on screen is removed and the title is cleared. These changes have not been saved, so they cannot be brought back.'
        : 'Every card on screen is removed and the title is cleared. The saved copy stays in this browser and can be opened again.',
      confirmLabel: 'Clear it',
      cancelLabel: 'Keep it',
      onConfirm: () => {
        setConfirm(null)
        startOver()
      },
    })
  }

  function requestRemoveCard(card) {
    setConfirm({
      title: 'Remove this card?',
      description: `"${card.title || 'Untitled card'}" is taken out of the report. The question and its query go with it.`,
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      onConfirm: () => {
        setConfirm(null)
        setCards((current) => current.filter((entry) => entry.id !== card.id))
      },
    })
  }

  return (
    <>
      {/* 1. The question. Everything else on this screen comes out of it. */}
      <section className="card ask-panel" aria-labelledby="ask-heading">
        <h2 className="section-title" id="ask-heading">
          Ask your data
        </h2>
        <p className="section-description">
          One question at a time, in English. The query is written for you, run
          against the database read-only, and shown with the SQL behind it.
        </p>

        <form
          className="ask-form"
          onSubmit={(event) => {
            event.preventDefault()
            requestAsk()
          }}
        >
          <label className="field">
            <span className="visually-hidden">Ask a question about the data</span>
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
            <SparkIcon size={15} />
            {asking ? 'Asking...' : 'Ask'}
          </button>
        </form>

        {examples?.questions?.length ? (
          <div className="ask-examples">
            <span className="field-label" id="ask-examples-label">
              Try one of these
            </span>
            <div className="suggestion-chips" aria-labelledby="ask-examples-label">
              {examples.questions.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="suggestion-chip"
                  disabled={asking}
                  onClick={() => {
                    setQuestion(example)
                    requestAsk(example)
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
          answer is drawn that way when the result supports it.
        </p>
      </section>

      {error ? <div className="notice ask-error">{error}</div> : null}

      {/* 2. The answer, on its own until it is kept, so asking three questions
             in a row does not fill a report with two of them by accident. */}
      {asking ? (
        <section className="preview-section" aria-labelledby="preview-heading">
          <div className="section-head">
            <h2 className="section-title" id="preview-heading">
              Result preview
            </h2>
          </div>
          <div className="card">
            <StateBlock variant="loading" title="Writing the query and running it" />
          </div>
        </section>
      ) : pending ? (
        <section className="preview-section" aria-labelledby="preview-heading">
          <div className="section-head">
            <div>
              <h2 className="section-title" id="preview-heading">
                Result preview
              </h2>
              <p className="section-description">
                Not part of the report yet - keep it, or ask something else.
              </p>
            </div>
            <span className="badge badge-on-hold">
              <span className="badge-dot" aria-hidden="true" />
              Not added
            </span>
          </div>
          <QueryResultCard
            card={pending}
            onTypeChange={(type) => setPending({ ...pending, type })}
            onValueChange={(valueColumn) => setPending({ ...pending, valueColumn })}
            actions={
              <button
                type="button"
                className="button button-primary"
                onClick={addPending}
              >
                <PlusIcon size={15} />
                Add to report
              </button>
            }
          />
        </section>
      ) : null}

      {/* 3. The report itself: a document with a title, not a list of answers. */}
      <section className="report-builder" aria-labelledby="builder-heading">
        <h2 className="visually-hidden" id="builder-heading">
          Report builder
        </h2>

        <header className="builder-head">
          <div className="builder-titles">
            <span className="builder-eyebrow">Report</span>
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

          {hasCards ? (
            <span
              className={unsaved ? 'badge badge-on-hold' : 'badge badge-active'}
              role="status"
            >
              <span className="badge-dot" aria-hidden="true" />
              {unsaved ? 'Unsaved changes' : 'Saved in this browser'}
            </span>
          ) : null}
        </header>

        {/* One toolbar rather than a row of buttons that grew: what opens a
            report on the left, what happens to this one on the right, and the
            two that throw something away kept apart from the rest. */}
        <div className="builder-toolbar">
          <div className="builder-toolbar-group">
            {saved.length > 0 ? (
              <label className="field">
                <span className="field-label">Open a saved report</span>
                <select
                  value={report.id || ''}
                  onChange={(event) => requestOpen(event.target.value)}
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
          </div>

          <div className="builder-toolbar-group builder-toolbar-actions">
            <button
              type="button"
              className="button"
              disabled={!hasCards}
              onClick={refreshAll}
            >
              <RefreshIcon size={15} />
              Refresh
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!hasCards || !canStore}
              onClick={() => persist(false)}
            >
              <SaveIcon size={15} />
              {report.id ? 'Save' : 'Save report'}
            </button>
            {report.id ? (
              <button
                type="button"
                className="button"
                disabled={!canStore}
                onClick={() => persist(true)}
              >
                Save as new
              </button>
            ) : null}

            {report.id || hasCards ? (
              <span className="toolbar-divider" aria-hidden="true" />
            ) : null}

            {report.id ? (
              <button type="button" className="button button-danger" onClick={requestDelete}>
                <TrashIcon size={15} />
                Delete
              </button>
            ) : null}
            {hasCards ? (
              <button type="button" className="button button-danger" onClick={requestClear}>
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <p className="builder-status" role="status" aria-live="polite">
          {status}
        </p>

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
          <div className="card">
            <StateBlock
              title="No cards yet"
              text="Ask a question above, then keep the answers worth keeping - they become a report you can name, save and print."
            />
          </div>
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
                      aria-label={`Move "${card.title}" up`}
                      disabled={index === 0}
                      onClick={() => moveCard(card.id, -1)}
                    >
                      <ChevronUpIcon size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move "${card.title}" down`}
                      disabled={index === cards.length - 1}
                      onClick={() => moveCard(card.id, 1)}
                    >
                      <ChevronDownIcon size={14} />
                    </button>
                    <button
                      type="button"
                      className="button button-sm"
                      disabled={card.loading}
                      onClick={() => runCard(card)}
                    >
                      <RefreshIcon size={14} />
                      {card.loading ? 'Running...' : 'Refresh'}
                    </button>
                    <button
                      type="button"
                      className="button button-sm button-danger"
                      onClick={() => requestRemoveCard(card)}
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

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        cancelLabel={confirm?.cancelLabel}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
