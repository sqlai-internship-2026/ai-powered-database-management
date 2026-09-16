import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import { useT } from '../i18n'

// A panel over the right-hand side of the page, for reading one record in full
// without leaving the list it was picked from.
//
// It behaves as a modal dialog, because while it is open it is the only thing
// that can be operated: focus moves into it and cannot Tab out, Escape and the
// scrim close it, the page behind it stops scrolling, and closing it puts focus
// back on whatever opened it - the row, on the Projects list. On a desktop the
// list stays visible to the left of it, which is the difference from the
// confirm dialog: this is read alongside the page rather than interrupting it.
//
// Rendered into <body>, so nothing in the page layout - the sticky sidebar, a
// scrolling table - can sit on top of it or clip it.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]'

// Controls taken out of the Tab order on purpose - the unselected tabs, the
// panel itself - stay out of the trap as well.
function focusableIn(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (element) => element.getAttribute('tabindex') !== '-1',
  )
}

export default function DetailDrawer({
  titleId,
  closeLabel,
  header,
  onClose,
  children,
}) {
  const t = useT()
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  const returnRef = useRef(null)

  useEffect(() => {
    returnRef.current = document.activeElement
    document.body.classList.add('has-panel-open')
    closeRef.current?.focus()

    return () => {
      document.body.classList.remove('has-panel-open')
      // The row that opened the panel is still on the list underneath. A panel
      // opened from a pasted link had nothing focused before it.
      const target = returnRef.current
      if (
        target &&
        target !== document.body &&
        target.isConnected &&
        typeof target.focus === 'function'
      ) {
        target.focus()
      }
    }
  }, [])

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const items = focusableIn(panelRef.current)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement

    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className="detail-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="detail-drawer-head">
          <div className="detail-drawer-heading">{header}</div>
          <button
            type="button"
            className="icon-button detail-drawer-close"
            onClick={onClose}
            ref={closeRef}
            aria-label={closeLabel || t('Close')}
          >
            <CloseIcon size={18} />
          </button>
        </header>
        <div className="detail-drawer-body">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
