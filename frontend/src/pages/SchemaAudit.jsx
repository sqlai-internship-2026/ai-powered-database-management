import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { useApiData } from '../utils/api'
import { formatNumber } from '../utils/format'

const severityFilters = [
  { key: 'all', label: 'All' },
  { key: 'error', label: 'Errors' },
  { key: 'warning', label: 'Warnings' },
  { key: 'info', label: 'Info' },
]

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

function FindingCard({ finding }) {
  return (
    <article className={`card finding severity-${finding.severity}`}>
      <div className="finding-top">
        <span className={`badge badge-${finding.severity}`}>
          {finding.severity}
        </span>
        <span className="finding-rule">
          {finding.rule_id} · {finding.rule_name}
        </span>
        {finding.confidence === 'heuristic' ? (
          <span className="chip">Heuristic</span>
        ) : null}
      </div>

      <h3 className="finding-message">{finding.message}</h3>
      <code className="finding-target">{finding.target}</code>
      <p className="finding-rationale">{finding.rationale}</p>

      {finding.remediations.length > 0 ? (
        <div className="remediation-list">
          <div className="remediation-heading">Suggested fixes</div>
          {finding.remediations.map((remediation) => (
            <Remediation key={remediation.label} remediation={remediation} />
          ))}
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

export default function SchemaAudit() {
  const { data: report, loading, error } = useApiData('/api/schema-audit')
  const [severity, setSeverity] = useState('all')
  const [showRules, setShowRules] = useState(false)

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
        would suggest - nothing is applied to the database. Review each one
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
            />
          ))}
        </div>
      )}

      <p className="audit-footer">Generated at {report.generated_at}</p>
    </>
  )
}
