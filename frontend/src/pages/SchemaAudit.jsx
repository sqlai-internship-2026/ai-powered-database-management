import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import StateBlock from '../components/StateBlock'
import {
  AlertIcon,
  CheckIcon,
  CopyIcon,
  InfoIcon,
  LockIcon,
  SchemaIcon,
  SearchIcon,
  SparkIcon,
} from '../components/icons'
import { apiPost, useApiData } from '../utils/api'
import { formatDateTime, formatNumber } from '../utils/format'

const severityFilters = [
  { key: 'all', label: 'All' },
  { key: 'error', label: 'Errors' },
  { key: 'warning', label: 'Warnings' },
  { key: 'info', label: 'Info' },
]

// Rules write relationships the way the catalog does. An arrow reads as one on
// screen; the two characters read as code.
function readable(text) {
  return text.replace(/ -> /g, ' → ')
}

// The audit returns statements as text on purpose, so the only thing the page
// can do with them is hand them to the user.
function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be blocked; the statement is selectable anyway.
    }
  }

  return (
    <>
      <button
        type="button"
        className="copy-button"
        onClick={copy}
        aria-label={label || 'Copy this statement'}
      >
        {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      {/* The button changing its own label is invisible to anyone not looking
          at it, so the same fact is announced. */}
      <span className="visually-hidden" role="status" aria-live="polite">
        {copied ? 'Copied to the clipboard' : ''}
      </span>
    </>
  )
}

function Remediation({ remediation }) {
  return (
    <div className="remediation">
      <div className="remediation-head">
        <span className="remediation-label">{remediation.label}</span>
        {remediation.recommended ? (
          <span className="chip chip-recommended">Recommended</span>
        ) : null}
        <span className={`chip chip-risk-${remediation.risk}`}>
          {remediation.risk} risk
        </span>
        {remediation.requires_decision ? (
          <span className="chip chip-decision">Your call</span>
        ) : null}
      </div>
      {remediation.note ? (
        <p className="remediation-note">{remediation.note}</p>
      ) : null}
      {remediation.ddl ? (
        <div className="code-block">
          <CopyButton
            text={remediation.ddl}
            label={`Copy the statement for ${remediation.label}`}
          />
          <pre>{remediation.ddl}</pre>
        </div>
      ) : null}
    </div>
  )
}

// What the model wrote about one finding. Set apart rather than set large: it
// is the least verifiable thing on the card and must never be mistaken for the
// audit's own words.
//
// A failure here is reported and nothing else changes. The statements beside
// it were written by the audit and need no model, so an unreachable endpoint
// costs the reader a paragraph rather than the answer.
function Explanation({ state, onRetry }) {
  if (!state || state.loading) {
    // A skeleton rather than a sentence in italics: it says the paragraph is
    // on its way and holds roughly the room it will take, so the column does
    // not jump when it lands.
    return (
      <div className="explanation-pending" aria-busy="true">
        <div className="skeleton skeleton-line" style={{ width: '96%' }} />
        <div className="skeleton skeleton-line" style={{ width: '88%' }} />
        <div className="skeleton skeleton-line" style={{ width: '72%' }} />
        <span className="visually-hidden">Asking the model to explain this</span>
      </div>
    )
  }

  if (state.error) {
    // Worth offering, because most of these are temporary: the free tier
    // refusing a burst, a request that timed out, a connection that dropped.
    // Nothing about the finding has changed, so the same press may well work.
    return (
      <div className="explanation-error">
        <p className="explanation-error-text">
          Could not explain this one: {state.error}
        </p>
        <button type="button" className="explanation-retry" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      <p className="explanation">{state.text}</p>
      <p className="explanation-meta">
        Written by {state.generator}. The statements beside it come from the
        audit, not from the model.
      </p>
    </>
  )
}

// Closed, a finding is one line: what kind of problem it is and where. The
// rule name is the heading because it is the only part written for a person -
// the message names the constraint and the clause, which is the detail you
// want once you have decided to look, not the thing you scan thirteen of.
function FindingCard({ finding, explanation, expanded, onToggle, onRetry }) {
  const fixes = finding.remediations

  return (
    <article
      className={`card finding severity-${finding.severity} ${
        expanded ? 'is-open' : ''
      }`}
    >
      <button
        type="button"
        className="finding-head"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className={`badge badge-${finding.severity}`}>
          <span className="badge-dot" aria-hidden="true" />
          {finding.severity}
        </span>

        <span className="finding-head-text">
          <span className="finding-title">{finding.rule_name}</span>
          <span className="finding-where">
            <code className="finding-target">{finding.target}</code>
            <span className="finding-message">{readable(finding.message)}</span>
          </span>
        </span>

        <span className="finding-head-meta">
          {finding.confidence === 'heuristic' ? (
            <span className="chip">Heuristic</span>
          ) : null}
          <span className="finding-fix-count">
            {fixes.length} {fixes.length === 1 ? 'fix' : 'fixes'}
          </span>
          <span className="finding-toggle">{expanded ? 'Close' : 'Explain'}</span>
        </span>
      </button>

      {expanded ? (
        <div className="finding-body">
          <p className="finding-object">
            {finding.rule_id} · <code>{finding.target}</code>
          </p>

          <div className="finding-columns">
            {/* The two columns do not come from the same place, and the source
                is printed on each of them: one is a model writing prose about
                a finding, the other is the audit's own statement. A reader
                deciding whether to run a piece of DDL has to be able to tell
                them apart at a glance. */}
            <section className="finding-column">
              <h4 className="finding-column-heading">
                <SparkIcon size={13} />
                What this means
                <span className="source-tag source-tag-model">Written by a model</span>
              </h4>
              <Explanation state={explanation} onRetry={onRetry} />
            </section>

            <section className="finding-column finding-column-fixes">
              <h4 className="finding-column-heading">
                <SchemaIcon size={13} />
                How to fix it
                <span className="source-tag">From the audit</span>
              </h4>
              {fixes.length === 0 ? (
                <p className="explanation-meta">
                  The audit has no statement to suggest for this one.
                </p>
              ) : (
                <div className="remediation-list">
                  {fixes.map((remediation) => (
                    <Remediation
                      key={remediation.label}
                      remediation={remediation}
                    />
                  ))}
                </div>
              )}
              <p className="finding-apply-note">
                Nothing here runs by itself. Copy a statement, read it, and run
                it where you would run any other migration.
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function RuleCatalog({ onClose }) {
  const { data: rules, loading, error } = useApiData('/api/schema-audit/rules', [])

  return (
    <section className="panel rule-catalog" aria-labelledby="rule-catalog-heading">
      <div className="panel-head">
        <div className="panel-heading">
          <h2 className="panel-title" id="rule-catalog-heading">
            Rule catalog
          </h2>
          <p className="panel-description">
            Every check the audit runs, and what each one looks for.
          </p>
        </div>
        <button type="button" className="button button-sm" onClick={onClose}>
          Hide rules
        </button>
      </div>

      {loading ? (
        <StateBlock variant="loading" title="Loading rules" lines={5} />
      ) : error ? (
        <StateBlock variant="error" title="Could not load the rules" text={error} />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Rule</th>
                <th>Name</th>
                <th>Severity</th>
                <th>Category</th>
                <th>Checks for</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.id}</td>
                  <td>{rule.name}</td>
                  <td>
                    <span className={`badge badge-${rule.severity}`}>
                      <span className="badge-dot" aria-hidden="true" />
                      {rule.severity}
                    </span>
                  </td>
                  <td>{rule.category}</td>
                  <td className="cell-wrap">{rule.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// The three fields that identify one finding, which are also the three the
// backend matches against its own audit before anything reaches the model. The
// message is part of it because one rule can report the same object twice for
// different reasons.
function findingKey(finding) {
  return `${finding.rule_id}|${finding.target}|${finding.message}`
}

export default function SchemaAudit() {
  const { data: report, loading, error } = useApiData('/api/schema-audit')
  const [severity, setSeverity] = useState('all')
  const [search, setSearch] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [open, setOpen] = useState({})
  // Held by the page rather than by each card, so closing a finding and
  // opening it again does not throw away a paragraph that took ten seconds to
  // arrive, and neither does switching the severity filter.
  const [explanations, setExplanations] = useState({})

  // Over the findings already on the page. The audit is one request that reads
  // the whole catalog; narrowing it is a question about what is on screen, not
  // a reason to run it again.
  const findings = useMemo(() => {
    const all = report?.findings || []
    const term = search.trim().toLowerCase()
    return all.filter((finding) => {
      if (severity !== 'all' && finding.severity !== severity) return false
      if (!term) return true
      return (
        finding.rule_name.toLowerCase().includes(term) ||
        finding.target.toLowerCase().includes(term) ||
        finding.message.toLowerCase().includes(term) ||
        finding.rule_id.toLowerCase().includes(term)
      )
    })
  }, [report, severity, search])

  function setExplanation(key, state) {
    setExplanations((current) => ({ ...current, [key]: state }))
  }

  async function requestExplanation(finding) {
    const key = findingKey(finding)
    setExplanation(key, { loading: true })

    try {
      const result = await apiPost('/api/schema-audit/explain', {
        rule_id: finding.rule_id,
        target: finding.target,
        message: finding.message,
      })
      setExplanation(key, {
        text: result.explanation,
        generator: result.generator,
      })
    } catch (err) {
      setExplanation(key, { error: err.message })
    }
  }

  // Opening a finding shows its statements immediately - those come from the
  // audit and need no model - and asks for the explanation to fill in beside
  // them.
  //
  // A paragraph that arrived is asked for once and kept: the backend remembers
  // what it wrote, so a second request would redraw the same text. A failure is
  // not kept in that sense - it is not an answer, and most of them are
  // temporary - so reopening a finding that failed tries again rather than
  // redisplaying the error.
  function toggle(finding) {
    const key = findingKey(finding)
    const isOpen = Boolean(open[key])
    setOpen((current) => ({ ...current, [key]: !isOpen }))

    const state = explanations[key]
    if (isOpen || state?.text || state?.loading) return
    requestExplanation(finding)
  }

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Database" title="Schema Audit" />
        <div className="card">
          <StateBlock variant="loading" title="Analysing the schema" lines={6} />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Database" title="Schema Audit" />
        <div className="card">
          <StateBlock
            variant="error"
            title="Could not run the audit"
            text={error}
          />
        </div>
      </>
    )
  }

  const total = report.findings.length
  const narrowed = severity !== 'all' || search.trim() !== ''

  return (
    <>
      <PageHeader
        eyebrow="Database"
        title="Schema Audit"
        description={`Structural review of the "${report.schema}" schema against ${report.scanned.rules} rules.`}
      />

      {/* Visible, and no larger than it needs to be: one line saying the audit
          reads and never writes. */}
      <p className="audit-readonly">
        <LockIcon size={15} />
        <span>
          <strong>Read-only.</strong> The audit reads the catalog and writes out
          the statements it would suggest - nothing is applied to the database,
          here or anywhere else. Review every statement before you run it.
        </span>
      </p>

      <div className="stat-grid audit-summary">
        <StatCard
          label="Findings"
          value={formatNumber(report.summary.total)}
          hint={`${report.scanned.tables} tables, ${report.scanned.foreign_keys} foreign keys, ${report.scanned.indexes} indexes`}
          icon={<SchemaIcon size={17} />}
          tone="primary"
          emphasis
        />
        <StatCard
          label="Errors"
          value={formatNumber(report.summary.error)}
          hint="Break integrity or block work"
          icon={<AlertIcon size={17} />}
          tone={report.summary.error > 0 ? 'danger' : 'neutral'}
        />
        <StatCard
          label="Warnings"
          value={formatNumber(report.summary.warning)}
          hint="Worth fixing deliberately"
          icon={<AlertIcon size={17} />}
          tone={report.summary.warning > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Info"
          value={formatNumber(report.summary.info)}
          hint="Consistency and documentation"
          icon={<InfoIcon size={17} />}
        />
      </div>

      <div className="audit-toolbar">
        <div className="audit-toolbar-controls">
          <div className="field">
            <span className="field-label" id="audit-severity-label">
              Severity
            </span>
            <div className="filter-chips" aria-labelledby="audit-severity-label">
              {severityFilters.map((filter) => {
                const on = severity === filter.key
                return (
                  <button
                    key={filter.key}
                    type="button"
                    className={on ? 'filter-chip is-on' : 'filter-chip'}
                    aria-pressed={on}
                    onClick={() => setSeverity(filter.key)}
                  >
                    {filter.label}
                    <span className="filter-chip-count">
                      {filter.key === 'all'
                        ? report.summary.total
                        : report.summary[filter.key]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <label className="field search-field">
            <span className="field-label">Search findings</span>
            <span className="search-control">
              <span className="search-icon">
                <SearchIcon size={15} />
              </span>
              <input
                type="search"
                className="input"
                value={search}
                placeholder="Rule, table, column or message"
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
          </label>
        </div>

        <div className="audit-toolbar-meta">
          {/* What is on the screen right now, in words - a filtered audit that
              only printed its own length would read as a cleaner schema. */}
          <span className="audit-count" role="status" aria-live="polite">
            {narrowed ? (
              <>
                <strong>{formatNumber(findings.length)}</strong> of {formatNumber(total)}{' '}
                findings
              </>
            ) : (
              <>
                <strong>{formatNumber(total)}</strong>{' '}
                {total === 1 ? 'finding' : 'findings'}
              </>
            )}
          </span>
          <button
            type="button"
            className="button button-sm"
            aria-expanded={showRules}
            onClick={() => setShowRules((visible) => !visible)}
          >
            {showRules ? 'Hide rules' : 'Show rules'}
          </button>
        </div>
      </div>

      {showRules ? <RuleCatalog onClose={() => setShowRules(false)} /> : null}

      {findings.length === 0 ? (
        <div className="card">
          <StateBlock
            title={narrowed ? 'No findings match' : 'Nothing to report'}
            text={
              narrowed
                ? 'Nothing at this severity matches the current search.'
                : 'The audit ran and found nothing against these rules.'
            }
            actions={
              narrowed ? (
                <button
                  type="button"
                  className="button button-sm"
                  onClick={() => {
                    setSeverity('all')
                    setSearch('')
                  }}
                >
                  Clear search and filters
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="finding-list">
          {findings.map((finding, index) => (
            <FindingCard
              key={`${finding.rule_id}-${finding.target}-${index}`}
              finding={finding}
              explanation={explanations[findingKey(finding)]}
              expanded={Boolean(open[findingKey(finding)])}
              onToggle={() => toggle(finding)}
              onRetry={() => requestExplanation(finding)}
            />
          ))}
        </div>
      )}

      <p className="audit-footer">Generated at {formatDateTime(report.generated_at)}</p>
    </>
  )
}
