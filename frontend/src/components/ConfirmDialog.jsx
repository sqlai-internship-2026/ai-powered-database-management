import { useEffect, useRef } from 'react'
import { useT } from '../i18n'

// The one place this console asks "are you sure?".
//
// window.confirm was doing this job, which put a browser chrome dialog in the
// middle of a designed screen, gave the destructive answer no more weight than
// the safe one, and could not say which report was about to be deleted in any
// voice but the browser's. This is the same question asked inside the console:
// the wording is ours, the destructive button looks destructive, and everything
// a keyboard reaches while it is open is inside it.
//
// Deliberately small. It confirms and it cancels; it is not a modal framework,
// and nothing in the application needs one.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  const t = useT()
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)
  // Where the keyboard was before the dialog opened, so closing it puts the
  // reader back on the control they pressed rather than at the top of the page.
  const returnRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    returnRef.current = document.activeElement
    document.body.classList.add('has-dialog-open')

    // A destructive question opens on the safe answer: Enter on a dialog the
    // reader has not read yet must not delete anything.
    const initial = tone === 'danger' ? cancelRef.current : confirmRef.current
    initial?.focus()

    return () => {
      document.body.classList.remove('has-dialog-open')
      const target = returnRef.current
      if (target && typeof target.focus === 'function') target.focus()
    }
  }, [open, tone])

  if (!open) return null

  // Tab is kept inside the dialog by hand: with only two or three controls,
  // wrapping the ends of the list is the whole of a focus trap.
  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel?.()
      return
    }
    if (event.key !== 'Tab') return

    const items = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="dialog-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.()
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-description' : undefined}
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <h2 className="dialog-title" id="confirm-dialog-title">
          {title}
        </h2>
        {description ? (
          <p className="dialog-description" id="confirm-dialog-description">
            {description}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button
            type="button"
            className="button"
            ref={cancelRef}
            onClick={() => onCancel?.()}
          >
            {cancelLabel || t('Cancel')}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'button button-danger' : 'button button-primary'}
            ref={confirmRef}
            onClick={() => onConfirm?.()}
          >
            {confirmLabel || t('Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
