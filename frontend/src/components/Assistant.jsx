import { useRef, useState } from 'react'
import PageHeader from './PageHeader'
import ResultTable from './ResultTable'
import { apiPost, useApiData } from '../utils/api'

// Ask a question in English, read the answer in English, check it against the
// table underneath. Sits at the bottom of the dashboard: the figures above are
// the questions somebody thought to ask in advance, and this is where the rest
// of them go.
//
// It looks like a chat and is not one. Earlier answers stay on screen so they
// can be compared, but nothing already on the page is ever sent back: every
// question is answered on its own. "And their salaries?" therefore does not
// work, which is why the empty state offers whole questions rather than an
// inviting blank box.
//
// Newest answer first, directly under the box, older ones pushed down. The
// opposite of a messaging app, and right for a panel at the foot of a long
// page: the answer appears where the question was typed instead of below a
// history that grows every time, and neither the box nor the newest answer
// ever moves.
//
// Three things are shown for every answer, in this order: the sentence, the
// rows, and - folded away - the SQL. The sentence is written by a model reading
// the rows, so it can be wrong in a way the rows cannot; putting the table
// directly under it means a reader never has to take it on trust.

function Answer({ data }) {
  const [showSql, setShowSql] = useState(false)

  return (
    <div className="chat-answer">
      {data.answer ? (
        <p className="chat-summary">{data.answer}</p>
      ) : (
        <p className="chat-summary chat-summary-missing">
          The rows are below. The model was not able to write a summary of them
          this time.
        </p>
      )}

      <ResultTable columns={data.columns} rows={data.rows} />

      <div className="chat-meta">
        <span>
          {data.row_count} {data.row_count === 1 ? 'row' : 'rows'}
          {data.truncated ? ' - cut off at the row limit' : ''}
        </span>
        <button
          type="button"
          className="chat-sql-toggle"
          aria-expanded={showSql}
          onClick={() => setShowSql((shown) => !shown)}
        >
          {showSql ? 'Hide SQL' : 'Show SQL'}
        </button>
      </div>

      {showSql ? (
        <div className="code-block">
          <pre>{data.sql}</pre>
        </div>
      ) : null}
    </div>
  )
}

export default function Assistant() {
  const { data: examples } = useApiData('/api/reports/ask/examples')
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState([])
  // The question being answered right now. Held separately because the box is
  // cleared the moment it is sent, and the pending turn still has to show it.
  const [pending, setPending] = useState(null)
  // Turns are rendered newest first, so a turn's position changes every time
  // another is asked. React needs a key that does not, or the SQL a reader
  // just unfolded would fold itself and open under a different answer.
  const nextId = useRef(0)
  const asking = pending !== null

  async function ask(text) {
    const asked = (text ?? question).trim()
    if (asked.length < 3 || asking) return

    setPending(asked)
    setQuestion('')

    const id = nextId.current++
    try {
      const data = await apiPost('/api/reports/ask', { question: asked })
      setTurns((earlier) => [...earlier, { id, question: asked, data }])
    } catch (err) {
      // A refusal is part of the conversation, not a banner over it: the model
      // explaining that a table does not exist belongs next to the question
      // that asked about it.
      setTurns((earlier) => [
        ...earlier,
        { id, question: asked, error: err.message },
      ])
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="chat">
      <PageHeader
        title="Assistant"
        description="Ask about the data in English. Each question is answered on its own - the assistant does not remember the one before it."
      />

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault()
          ask()
        }}
      >
        <input
          type="text"
          className="ask-input"
          value={question}
          placeholder="Which employees work on the Tactical Radar System project?"
          maxLength={500}
          disabled={asking}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button
          type="submit"
          className="button button-primary"
          disabled={asking || question.trim().length < 3}
        >
          {asking ? 'Asking...' : 'Ask'}
        </button>
      </form>

      {turns.length === 0 && !asking && examples?.questions?.length ? (
        <div className="chat-empty">
          <span className="field-label">Try one of these</span>
          <div className="chat-suggestions">
            {examples.questions.map((example) => (
              <button
                key={example}
                type="button"
                className="filter-button"
                onClick={() => ask(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="chat-thread">
        {asking ? (
          <article className="chat-turn">
            <p className="chat-question">{pending}</p>
            <div className="chat-answer chat-pending">
              Writing the query and running it...
            </div>
          </article>
        ) : null}

        {[...turns].reverse().map((turn) => (
          <article className="chat-turn" key={turn.id}>
            <p className="chat-question">{turn.question}</p>
            {turn.error ? (
              <div className="chat-answer chat-refusal">{turn.error}</div>
            ) : (
              <Answer data={turn.data} />
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
