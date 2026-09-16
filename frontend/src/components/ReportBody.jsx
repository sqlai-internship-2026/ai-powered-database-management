// The body of a fixed report, and the one place it says that the figures on
// screen are being replaced.
//
// A filter change used to dim the whole report and nothing else, which reads
// as the page having gone wrong rather than as it working. The previous render
// is still held - it is the last true answer, and blanking it would make every
// filter change a flash of empty cards - but a line above it now says what is
// happening, and says it to a screen reader as well.
import { useT } from '../i18n'

export default function ReportBody({ loading, children }) {
  const t = useT()

  return (
    <div
      className={loading ? 'report-body is-refetching' : 'report-body'}
      aria-busy={loading || undefined}
    >
      <p className="report-refetch" role="status" aria-live="polite">
        {loading ? (
          <>
            <span className="report-refetch-dot" aria-hidden="true" />
            {t('Updating for the selected filters')}
          </>
        ) : null}
      </p>
      {children}
    </div>
  )
}
