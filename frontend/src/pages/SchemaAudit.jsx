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
import ColumnChart from '../components/charts/ColumnChart'
import { apiPost, useApiData } from '../utils/api'
import { useT } from '../i18n'
import { formatDateTime, formatNumber } from '../utils/format'

// A rule is named for what it checks, which is the right name in the catalog
// and the wrong one on a card: "Undefined ON DELETE behaviour" describes a
// clause, not a problem. The card gets a heading someone can read without
// knowing the rule, and the catalog keeps the technical name beside it.
//
// Keyed by rule name rather than rule id, because R006 reports two different
// things under two names. A name with no entry falls through to itself, so
// adding a rule cannot leave a card without a heading.
const friendlyTitles = {
  'Missing primary key': 'No primary key',
  'Undefined ON DELETE behaviour': 'Delete rule not set',
  'Undefined ON UPDATE behaviour': 'Update rule not set',
  'Isolated table': 'Table stands alone',
  'Circular foreign key chain': 'Tables reference in a loop',
  'Duplicate index': 'Repeated index',
  'Redundant index prefix': 'Index already covered',
  'Foreign key type mismatch': 'Linked columns differ in type',
  'Unindexed foreign key': 'Link has no index',
  'Implied relationship without a foreign key': 'Link is not enforced',
  'Inconsistent type for a shared column name': 'Same name, different types',
}

function friendlyTitle(ruleName) {
  return friendlyTitles[ruleName] || ruleName
}

const severities = ['error', 'warning', 'info']

// How many findings touch each table. A finding can name more than one - a
// loop belongs to every table in it, and a column declared two ways belongs to
// both - so these counts sum to more than the number of findings. That is the
// question being asked: how much of this report is about this table.
function tableBreakdown(findings) {
  const byTable = new Map()
  for (const finding of findings) {
    for (const table of finding.tables || []) {
      let row = byTable.get(table)
      if (!row) {
        row = { table, total: 0, error: 0, warning: 0, info: 0 }
        byTable.set(table, row)
      }
      row.total += 1
      row[finding.severity] += 1
    }
  }
  return [...byTable.values()].sort(
    (a, b) => b.error - a.error || b.total - a.total || a.table.localeCompare(b.table),
  )
}

// Rules write relationships the way the catalog does. An arrow reads as one on
// screen; the two characters read as code.
function readable(text) {
  return text.replace(/ -> /g, ' → ')
}

// The audit returns statements as text on purpose, so the only thing the page
// can do with them is hand them to the user.
function CopyButton({ text, label }) {
  const t = useT()
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
        aria-label={label || t('Copy this statement')}
      >
        {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
        {copied ? t('Copied') : t('Copy')}
      </button>
      {/* The button changing its own label is invisible to anyone not looking
          at it, so the same fact is announced. */}
      <span className="visually-hidden" role="status" aria-live="polite">
        {copied ? t('Copied to the clipboard') : ''}
      </span>
    </>
  )
}

function Remediation({ remediation }) {
  const t = useT()

  return (
    <div className="remediation">
      <div className="remediation-head">
        <span className="remediation-label">{remediation.label}</span>
        {remediation.recommended ? (
          <span className="chip chip-recommended">{t('Recommended')}</span>
        ) : null}
        <span className={`chip chip-risk-${remediation.risk}`}>
          {t('{risk} risk', { risk: t(remediation.risk) })}
        </span>
        {remediation.requires_decision ? (
          <span className="chip chip-decision">{t('Your call')}</span>
        ) : null}
      </div>
      {remediation.note ? (
        <p className="remediation-note">{remediation.note}</p>
      ) : null}
      {remediation.ddl ? (
        <div className="code-block">
          <CopyButton
            text={remediation.ddl}
            label={t('Copy the statement for {label}', {
              label: remediation.label,
            })}
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
  const t = useT()

  if (!state || state.loading) {
    // A skeleton rather than a sentence in italics: it says the paragraph is
    // on its way and holds roughly the room it will take, so the column does
    // not jump when it lands.
    return (
      <div className="explanation-pending" aria-busy="true">
        <div className="skeleton skeleton-line" style={{ width: '96%' }} />
        <div className="skeleton skeleton-line" style={{ width: '88%' }} />
        <div className="skeleton skeleton-line" style={{ width: '72%' }} />
        <span className="visually-hidden">
          {t('Asking the model to explain this')}
        </span>
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
          {t('Could not explain this one: {message}', { message: state.error })}
        </p>
        <button type="button" className="explanation-retry" onClick={onRetry}>
          {t('Try again')}
        </button>
      </div>
    )
  }

  return (
    <>
      <p className="explanation">{state.text}</p>
      <p className="explanation-meta">
        {t(
          'Written by {generator}. The statements beside it come from the audit, not from the model.',
          { generator: state.generator },
        )}
      </p>
    </>
  )
}

// Closed, a finding is one line: what kind of problem it is and where. The
// heading is the plain-language name of the problem because it is the only
// part written for a person - the message names the constraint and the clause,
// which is the detail you want once you have decided to look, not the thing
// you scan thirteen of. The rule that produced it is printed inside, next to
// its id.
function FindingCard({ finding, explanation, expanded, onToggle, onRetry }) {
  const t = useT()
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
          {t(finding.severity)}
        </span>

        <span className="finding-head-text">
          <span className="finding-title">
            {t(friendlyTitle(finding.rule_name))}
          </span>
          <span className="finding-where">
            <code className="finding-target">{finding.target}</code>
            <span className="finding-message">{readable(finding.message)}</span>
          </span>
        </span>

        <span className="finding-head-meta">
          {finding.confidence === 'heuristic' ? (
            <span className="chip">{t('Heuristic')}</span>
          ) : null}
          <span className="finding-fix-count">
            {fixes.length === 1
              ? t('{count} fix', { count: fixes.length })
              : t('{count} fixes', { count: fixes.length })}
          </span>
          <span className="finding-toggle">
            {expanded ? t('Close') : t('Explain')}
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="finding-body">
          <p className="finding-object">
            {finding.rule_id} · {finding.rule_name} · <code>{finding.target}</code>
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
                {t('What this means')}
                <span className="source-tag source-tag-model">
                  {t('Written by a model')}
                </span>
              </h4>
              <Explanation state={explanation} onRetry={onRetry} />
            </section>

            <section className="finding-column finding-column-fixes">
              <h4 className="finding-column-heading">
                <SchemaIcon size={13} />
                {t('How to fix it')}
                <span className="source-tag">{t('From the audit')}</span>
              </h4>
              {fixes.length === 0 ? (
                <p className="explanation-meta">
                  {t('The audit has no statement to suggest for this one.')}
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
                {t(
                  'Nothing here runs by itself. Copy a statement, read it, and run it where you would run any other migration.',
                )}
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </article>
  )
}

// One button opens and closes this, and it is the one that sits directly above
// the catalog. A second copy inside the panel was a second thing to find for
// something the reader had just pressed.
function RuleCatalog() {
  const t = useT()
  const { data: rules, loading, error } = useApiData('/api/schema-audit/rules', [])

  return (
    <section className="panel rule-catalog" aria-labelledby="rule-catalog-heading">
      <div className="panel-head">
        <div className="panel-heading">
          <h2 className="panel-title" id="rule-catalog-heading">
            {t('Rule catalog')}
          </h2>
          <p className="panel-description">
            {t('Every check the audit runs, and what each one looks for.')}
          </p>
        </div>
      </div>

      {loading ? (
        <StateBlock variant="loading" title={t('Loading rules')} lines={5} />
      ) : error ? (
        <StateBlock
          variant="error"
          title={t('Could not load the rules')}
          text={error}
        />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t('Rule')}</th>
                <th>{t('Name')}</th>
                <th>{t('Severity')}</th>
                <th>{t('Category')}</th>
                <th>{t('Checks for')}</th>
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
                      {t(rule.severity)}
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
  const t = useT()
  const { data: report, loading, error } = useApiData('/api/schema-audit')
  // Set by pressing one of the four cards at the top. They were already the
  // place the counts are read; pressing the one you just read is a shorter way
  // to see what it counted than finding a control that repeats the number.
  const [severity, setSeverity] = useState('all')
  const [search, setSearch] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [open, setOpen] = useState({})
  // Held by the page rather than by each card, so closing a finding and
  // opening it again does not throw away a paragraph that took ten seconds to
  // arrive, and neither does narrowing the search.
  const [explanations, setExplanations] = useState({})

  // Over the findings already on the page. The audit is one request that reads
  // the whole catalog; narrowing it is a question about what is on screen, not
  // a reason to run it again.
  //
  // Severity is part of the search rather than a row of chips: the four counts
  // are already in the cards above, and typing "error" is the one thing the
  // chips did that nothing else here does. It matches the translated word too,
  // because that is the one printed on the badge.
  const findings = useMemo(() => {
    const all = report?.findings || []
    const term = search.trim().toLowerCase()
    return all.filter((finding) => {
      if (severity !== 'all' && finding.severity !== severity) return false
      if (!term) return true
      return [
        finding.rule_name,
        t(friendlyTitle(finding.rule_name)),
        finding.target,
        finding.message,
        finding.rule_id,
        finding.severity,
        t(finding.severity),
        ...(finding.tables || []),
      ].some((field) => String(field).toLowerCase().includes(term))
    })
  }, [report, severity, search, t])

  // Over the same set the list below shows, so everything on the screen is
  // describing one thing. Narrowing to errors and reading a breakdown of all
  // thirteen findings would be two answers to one question.
  const breakdown = useMemo(() => tableBreakdown(findings), [findings])

  // Pressing the card that is already applied clears it, so the filter can
  // always be undone at the place it was set.
  function pickSeverity(key) {
    setSeverity((current) => (current === key ? 'all' : key))
  }

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
        <PageHeader eyebrow={t('Database')} title={t('Schema Audit')} />
        <div className="card">
          <StateBlock variant="loading" title={t('Analysing the schema')} lines={6} />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow={t('Database')} title={t('Schema Audit')} />
        <div className="card">
          <StateBlock
            variant="error"
            title={t('Could not run the audit')}
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
        eyebrow={t('Database')}
        title={t('Schema Audit')}
        description={t('Structural review of the "{schema}" schema against {count} rules.', {
          schema: report.schema,
          count: report.scanned.rules,
        })}
      />

      {/* Visible, and no larger than it needs to be: one line saying the audit
          reads and never writes. */}
      <p className="audit-readonly">
        <LockIcon size={15} />
        <span>
          <strong>{t('Read-only.')}</strong>{' '}
          {t(
            'The audit reads the catalog and writes out the statements it would suggest - nothing is applied to the database, here or anywhere else. Review every statement before you run it.',
          )}
        </span>
      </p>

      {/* Also the filter. The colours are the severities' own - the same three
          the badges use further down - so the row reads as a key to the list
          as well as a count of it. */}
      <div className="stat-grid audit-summary">
        <StatCard
          label={t('Findings')}
          value={formatNumber(report.summary.total)}
          hint={t('{tables} tables, {keys} foreign keys, {indexes} indexes', {
            tables: report.scanned.tables,
            keys: report.scanned.foreign_keys,
            indexes: report.scanned.indexes,
          })}
          icon={<SchemaIcon size={17} />}
          tone="primary"
          emphasis
          onClick={() => setSeverity('all')}
          active={severity === 'all'}
        />
        <StatCard
          label={t('Errors')}
          value={formatNumber(report.summary.error)}
          hint={t('Break integrity or block work')}
          icon={<AlertIcon size={17} />}
          tone="danger"
          onClick={() => pickSeverity('error')}
          active={severity === 'error'}
        />
        <StatCard
          label={t('Warnings')}
          value={formatNumber(report.summary.warning)}
          hint={t('Worth fixing deliberately')}
          icon={<AlertIcon size={17} />}
          tone="warning"
          onClick={() => pickSeverity('warning')}
          active={severity === 'warning'}
        />
        <StatCard
          label={t('Info')}
          value={formatNumber(report.summary.info)}
          hint={t('Consistency and documentation')}
          icon={<InfoIcon size={17} />}
          tone="info"
          onClick={() => pickSeverity('info')}
          active={severity === 'info'}
        />
      </div>

      {/* Where the findings fall, not how many there are - the four counts are
          in the cards above and do not need saying twice. Left: the tables, in
          words. Right: the same numbers as bars, which is the faster read when
          you only want to know where the weight is. Both follow the filter, so
          the panel and the list below it always describe the same findings. */}
      <section className="panel audit-breakdown" aria-labelledby="audit-breakdown-heading">
        <div className="panel-head">
          <div className="panel-heading">
            <h2 className="panel-title" id="audit-breakdown-heading">
              {t('Findings by table')}
            </h2>
            <p className="panel-description">
              {t(
                'A finding can concern more than one table - a loop, or a column declared two ways - so these add up to more than the total.',
              )}
            </p>
          </div>
          <button
            type="button"
            className="button button-sm"
            aria-expanded={showRules}
            onClick={() => setShowRules((visible) => !visible)}
          >
            {showRules ? t('Hide rules') : t('Show rules')}
          </button>
        </div>

        <div className="panel-body audit-breakdown-body">
          {breakdown.length === 0 ? (
            <p className="audit-table-empty">
              {narrowed
                ? t('No finding in this selection names a table.')
                : t('No finding names a table.')}
            </p>
          ) : (
            <div className="audit-breakdown-main">
              <ul className="audit-table-list">
                {breakdown.map((row) => (
                  <li className="audit-table-row" key={row.table}>
                    <span className="audit-table-name">{row.table}</span>
                    <span className="audit-table-counts">
                      {severities.map((level) =>
                        row[level] > 0 ? (
                          <span
                            className={`audit-table-count audit-table-count-${level}`}
                            key={level}
                          >
                            <span className="badge-dot" aria-hidden="true" />
                            {formatNumber(row[level])}
                            <span className="visually-hidden"> {t(level)}</span>
                          </span>
                        ) : null,
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="audit-breakdown-chart">
                <ColumnChart
                  data={breakdown.map((row) => ({
                    label: row.table,
                    value: row.total,
                    hint: severities
                      .filter((level) => row[level] > 0)
                      .map((level) => `${formatNumber(row[level])} ${t(level)}`)
                      .join(' · '),
                  }))}
                  formatValue={formatNumber}
                  formatTick={(value) => formatNumber(Math.round(value))}
                />
              </div>
            </div>
          )}

          {/* The search and what it left on the screen, on one line under both
              columns - a filtered audit that only printed its own length would
              read as a cleaner schema. The placeholder says what can be typed,
              so the box needs no label above it. */}
          <div className="audit-breakdown-foot">
            <span className="search-control">
              <span className="search-icon">
                <SearchIcon size={15} />
              </span>
              <input
                type="search"
                className="input"
                value={search}
                aria-label={t('Search findings')}
                placeholder={t('Rule, table, column, severity or message')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
            <span className="audit-count" role="status" aria-live="polite">
              {narrowed
                ? t('{shown} of {total} findings', {
                    shown: formatNumber(findings.length),
                    total: formatNumber(total),
                  })
                : t('{count} findings', { count: formatNumber(total) })}
            </span>
          </div>
        </div>
      </section>

      {showRules ? <RuleCatalog /> : null}

      {findings.length === 0 ? (
        <div className="card">
          <StateBlock
            title={narrowed ? t('No findings match') : t('Nothing to report')}
            text={
              narrowed
                ? t('Nothing matches what is selected.')
                : t('The audit ran and found nothing against these rules.')
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
                  {t('Clear the filter')}
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

      <p className="audit-footer">
        {t('Generated at {timestamp}', {
          timestamp: formatDateTime(report.generated_at),
        })}
      </p>
    </>
  )
}
