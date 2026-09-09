import { useState } from 'react'
import ResultTable from '../../components/ResultTable'
import { apiPost, useApiData } from '../../utils/api'
import { downloadCsv } from '../../utils/csv'

// Asking a question in English and getting rows back. The screen shows the
// generated SQL above the result on purpose: the query is the only way for a
// reader to judge whether the answer means what they asked for, and hiding it
// would turn a checkable number into a claim.
//
// The result table is the same one the assistant draws, so a question asked
// in either place renders identically.

export default function AskReport() {
  const { data: examples } = useApiData('/api/reports/ask/examples')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [error, setError] = useState(null)
  const [asking, setAsking] = useState(false)
  const [copied, setCopied] = useState(false)

  async function ask(text) {
    const asked = (text ?? question).trim()
    if (asked.length < 3) return

    setAsking(true)
    setError(null)
    setAnswer(null)

    try {
      setAnswer(await apiPost('/api/reports/ask', { question: asked }))
    } catch (err) {
      setError(err.message)
    } finally {
      setAsking(false)
    }
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(answer.sql)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be blocked; the query is selectable anyway.
    }
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
              placeholder="Which projects are on hold?"
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
      </section>

      {error ? <div className="notice ask-error">{error}</div> : null}

      {answer ? (
        <section className="card">
          <header className="report-card-head">
            <div>
              <h3 className="report-card-title">{answer.question}</h3>
              <p className="report-card-description">
                {answer.row_count} {answer.row_count === 1 ? 'row' : 'rows'}
                {answer.truncated
                  ? ' - cut off at the row limit, so the answer may be incomplete'
                  : ''}
              </p>
            </div>
            <div className="report-card-actions">
              <button
                type="button"
                className="button"
                disabled={answer.rows.length === 0}
                onClick={() =>
                  downloadCsv(
                    'answer',
                    answer.columns.map((column) => ({
                      key: column,
                      header: column,
                    })),
                    answer.rows,
                  )
                }
              >
                CSV
              </button>
            </div>
          </header>

          {answer.answer ? (
            <p className="chat-summary">{answer.answer}</p>
          ) : null}

          <div className="code-block">
            <button type="button" className="copy-button" onClick={copySql}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <pre>{answer.sql}</pre>
          </div>

          <div className="report-card-body">
            <ResultTable columns={answer.columns} rows={answer.rows} />
          </div>
        </section>
      ) : null}
    </>
  )
}
