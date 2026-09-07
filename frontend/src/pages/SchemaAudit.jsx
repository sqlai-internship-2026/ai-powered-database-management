import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { useApiData } from '../utils/api'
import { formatNumber } from '../utils/format'

// The API keeps severity and risk as English code values so it stays easy to
// match on; only the display text is Turkish.
const severityLabels = {
  error: 'Hata',
  warning: 'Uyarı',
  info: 'Bilgi',
}

const riskLabels = {
  low: 'düşük risk',
  medium: 'orta risk',
  high: 'yüksek risk',
}

const severityFilters = [
  { key: 'all', label: 'Tümü' },
  { key: 'error', label: 'Hatalar' },
  { key: 'warning', label: 'Uyarılar' },
  { key: 'info', label: 'Bilgi' },
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
      {copied ? 'Kopyalandı' : 'Kopyala'}
    </button>
  )
}

function Remediation({ remediation }) {
  return (
    <div className="remediation">
      <div className="remediation-head">
        <span className="remediation-label">{remediation.label}</span>
        <span className={`chip chip-risk-${remediation.risk}`}>
          {riskLabels[remediation.risk] || remediation.risk}
        </span>
        {remediation.recommended ? (
          <span className="chip chip-recommended">Önerilen</span>
        ) : null}
        {remediation.requires_decision ? (
          <span className="chip chip-decision">Senin kararın</span>
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
          {severityLabels[finding.severity] || finding.severity}
        </span>
        <span className="finding-rule">
          {finding.rule_id} · {finding.rule_name}
        </span>
        {finding.confidence === 'heuristic' ? (
          <span className="chip">Sezgisel</span>
        ) : null}
      </div>

      <h3 className="finding-message">{finding.message}</h3>
      <code className="finding-target">{finding.target}</code>
      <p className="finding-rationale">{finding.rationale}</p>

      {finding.remediations.length > 0 ? (
        <div className="remediation-list">
          <div className="remediation-heading">Önerilen düzeltmeler</div>
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

  if (loading) return <div className="card placeholder">Kurallar yükleniyor...</div>
  if (error) {
    return <div className="card placeholder">Kurallar yüklenemedi: {error}</div>
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Kural</th>
            <th>Ad</th>
            <th>Önem</th>
            <th>Kategori</th>
            <th>Ne arıyor</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.id}</td>
              <td>{rule.name}</td>
              <td>
                <span className={`badge badge-${rule.severity}`}>
                  {severityLabels[rule.severity] || rule.severity}
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
        <div className="card placeholder">Şema analiz ediliyor...</div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Schema Audit" />
        <div className="card placeholder">Denetim çalıştırılamadı: {error}</div>
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
        description={`"${report.schema}" şemasının ${report.scanned.rules} kurala göre yapısal denetimi.`}
      />

      <div className="notice">
        Salt okunur. Denetim yalnızca katalogu okur ve önereceği SQL cümlelerini
        yazar - veritabanına hiçbir şey uygulanmaz. Her cümleyi çalıştırmadan
        önce gözden geçir.
      </div>

      <div className="stat-grid">
        <StatCard
          label="Bulgu"
          value={formatNumber(report.summary.total)}
          hint={`${report.scanned.tables} tablo, ${report.scanned.foreign_keys} foreign key, ${report.scanned.indexes} index`}
        />
        <StatCard
          label="Hata"
          value={formatNumber(report.summary.error)}
          hint="Bütünlüğü bozar veya işi durdurur"
        />
        <StatCard
          label="Uyarı"
          value={formatNumber(report.summary.warning)}
          hint="Bilinçli olarak düzeltilmeye değer"
        />
        <StatCard
          label="Bilgi"
          value={formatNumber(report.summary.info)}
          hint="Tutarlılık ve belgeleme"
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
          {showRules ? 'Kuralları gizle' : 'Kuralları göster'}
        </button>
      </div>

      {showRules ? (
        <div className="rule-catalog">
          <RuleCatalog />
        </div>
      ) : null}

      {findings.length === 0 ? (
        <div className="card placeholder">
          Bu önem seviyesinde gösterilecek bulgu yok.
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

      <p className="audit-footer">Oluşturulma: {report.generated_at}</p>
    </>
  )
}
