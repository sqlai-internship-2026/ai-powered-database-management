import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useT } from '../i18n'

// The shell. It owns the two pieces of state the sidebar and the topbar both
// need - whether the desktop sidebar is a rail, and whether the phone drawer is
// open - because they are one navigation shown two ways rather than two
// components with opinions of their own.

const COLLAPSED_KEY = 'sqlai.sidebar.collapsed'

// Matches the breakpoint in index.css where the sidebar stops being furniture
// and becomes a drawer. Only used to decide whether closing the drawer should
// hand focus back to the button that opened it.
const DRAWER_QUERY = '(max-width: 900px)'

function readCollapsed() {
  // A preference, not data: if storage is unavailable the sidebar simply opens
  // the way it does on a first visit.
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

export default function Layout() {
  const { pathname } = useLocation()
  const t = useT()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const drawerCloseRef = useRef(null)

  // Every caller of this - the scrim, the Escape handler, the close button -
  // only exists while the drawer is open, so it can hand focus straight back
  // to the button that opened it. Sending focus there makes sense only where
  // that button exists, which is the drawer breakpoint.
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    if (window.matchMedia(DRAWER_QUERY).matches) {
      menuButtonRef.current?.focus()
    }
  }, [])

  // Picking a page is the usual way out of the drawer, so it closes itself
  // rather than making every link remember to.
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed))
    } catch {
      // Nothing to do: the sidebar still collapses, it just forgets.
    }
  }, [collapsed])

  // The page behind an open drawer must not scroll, and Escape has to close it
  // - both are what a reader expects from anything drawn over a page.
  useEffect(() => {
    if (!drawerOpen) return undefined

    document.body.classList.add('has-drawer-open')
    drawerCloseRef.current?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') closeDrawer()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('has-drawer-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [drawerOpen, closeDrawer])

  return (
    <div className={collapsed ? 'layout is-collapsed' : 'layout'}>
      <Sidebar
        collapsed={collapsed}
        drawerOpen={drawerOpen}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onCloseDrawer={closeDrawer}
        closeButtonRef={drawerCloseRef}
      />

      {/* Only rendered while the drawer is open, so it never sits invisibly
          over a desktop page. */}
      {drawerOpen ? (
        <button
          type="button"
          className="drawer-overlay"
          aria-label={t('Close the navigation menu')}
          onClick={closeDrawer}
        />
      ) : null}

      <div className="main">
        <Topbar
          menuButtonRef={menuButtonRef}
          drawerOpen={drawerOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
