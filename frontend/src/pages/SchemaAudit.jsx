import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { apiPost, useApiData } from '../utils/api'
import { formatNumber } from '../utils/format'

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
function CopyButton({ text }) {
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
    <button type="button" className="copy-button" onClick={copy}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function Remediation({ remediation }) {
  return (
    <div className="remediation">
      <div className="remediation-head">
        <span className="remediation-label">{remediation.label}</span>
        <span className={`chip chip-risk-${remediation.risk}`}>
          {remediation.risk} risk
        </span>
        {remediation.recommended ? (
          <span className="chip chip-recommended">Recommended</span>
        ) : null}
        {remediation.requires_decision ? (
          <span className="chip chip-decision">Your call</span>
        ) : null}
      </div>
      {remediation.note ? (
        <p className="remediation-note">{remediation.note}</p>
      ) : null}
      {remediation.ddl ? (
        <div className="code-block">
          <CopyButton text={remediation.ddl} />
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
    return (
      <p className="explanation explanation-pending">
        Asking the model to explain this...
      </p>
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
          {finding.severity}
        </span>

        <span className="finding-head-text">
          <span className="finding-title">{finding.rule_name}</span>
          <span className="finding-where">{readable(finding.message)}</span>
        </span>

        <span className="finding-head-meta">
          {finding.confidence === 'heuristic' ? (
            <span className="chip">Heuristic</span>
          ) : null}
          <span className="finding-fix-count">
            {fixes.length} {fixes.length === 1 ? 'fix' : 'fixes'}
          </span>
          <span className="finding-toggle">
            {expanded ? 'Close' : 'Explain'}
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="finding-body">
          <p className="finding-object">
            {finding.rule_id} · <code>{finding.target}</code>
          </p>

          <div className="finding-columns">
            <section className="finding-column">
              <h4 className="finding-column-heading">What this means</h4>
              <Explanation state={explanation} onRetry={onRetry} />
            </section>

            <section className="finding-column">
              <h4 className="finding-column-heading">How to fix it</h4>
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
            </section>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function RuleCatalog() {
  const { data: rules, loading, error } = useApiData('/api/schema-audit/rules', [])

  if (loading) return <div className="card placeholder">Loading rules...</div>
  if (error) {
    return <div className="card placeholder">Could not load rules: {error}</div>
  }

  return (
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
  const [showRules, setShowRules] = useState(false)
  const [open, setOpen] = useState({})
  // Held by the page rather than by each card, so closing a finding and
  // opening it again does not throw away a paragraph that took ten seconds to
  // arrive, and neither does switching the severity filter.
  const [explanations, setExplanations] = useState({})

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
        <PageHeader title="Schema Audit" />
        <div className="card placeholder">Analysing the schema...</div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Schema Audit" />
        <div className="card placeholder">Could not run the audit: {error}</div>
      </>
    )
  }

  const findings =
    severity === 'all'
      ? report.findings
      : report.findings.filter((finding) => finding.severity === severity)

  return (
    <>
      <PageHeader
        title="Schema Audit"
        description={`Structural review of the "${report.schema}" schema against ${report.scanned.rules} rules.`}
      />

      <div className="notice">
        Read-only. The audit reads the catalog and writes out the statements it
        would suggest - nothing is applied to the database. Open a finding to
        have it explained and to see what would fix it; review every statement
        before running it.
      </div>

      <div className="stat-grid">
        <StatCard
          label="Findings"
          value={formatNumber(report.summary.total)}
          hint={`${report.scanned.tables} tables, ${report.scanned.foreign_keys} foreign keys, ${report.scanned.indexes} indexes`}
        />
        <StatCard
          label="Errors"
          value={formatNumber(report.summary.error)}
          hint="Break integrity or block work"
        />
        <StatCard
          label="Warnings"
          value={formatNumber(report.summary.warning)}
          hint="Worth fixing deliberately"
        />
        <StatCard
          label="Info"
          value={formatNumber(report.summary.info)}
          hint="Consistency and documentation"
        />
      </div>

      <div className="audit-toolbar">
        <div className="audit-filters">
          {severityFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={
                severity === filter.key
                  ? 'filter-button active'
                  : 'filter-button'
              }
              onClick={() => setSeverity(filter.key)}
            >
              {filter.label}
              {filter.key === 'all'
                ? ` (${report.summary.total})`
                : ` (${report.summary[filter.key]})`}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="button"
          onClick={() => setShowRules((visible) => !visible)}
        >
          {showRules ? 'Hide rules' : 'Show rules'}
        </button>
      </div>

      {showRules ? (
        <div className="rule-catalog">
          <RuleCatalog />
        </div>
      ) : null}

      {findings.length === 0 ? (
        <div className="card placeholder">
          Nothing to report at this severity.
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

      <p className="audit-footer">Generated at {report.generated_at}</p>
    </>
  )
}
