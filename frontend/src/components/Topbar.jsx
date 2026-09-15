import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { navigationItems } from './Sidebar'
import { initials } from '../utils/format'
import { MenuIcon } from './icons'

// Where you are, who you are, and on a phone the way back to the menu. It
// deliberately does not repeat the page heading below it: the same words set
// twice, one above the other, waste the only strip of the screen that is
// always visible and make the page look emptier than it is.

function useLocationTrail() {
  const { pathname } = useLocation()
  const match = navigationItems
    .filter((item) => pathname.startsWith(item.to))
    .sort((a, b) => b.to.length - a.to.length)[0]

  if (!match) return { section: 'SQL-AI', page: 'Not found' }
  return { section: match.group, page: match.label }
}

export default function Topbar({ menuButtonRef, drawerOpen = false, onOpenDrawer }) {
  const { username, fullName } = useAuth()
  const { section, page } = useLocationTrail()
  const displayName = fullName || username

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-button"
          onClick={onOpenDrawer}
          ref={menuButtonRef}
          aria-label="Open the navigation menu"
          aria-expanded={drawerOpen}
          aria-controls="app-sidebar"
        >
          <MenuIcon size={20} />
        </button>

        <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
          <span>{section}</span>
          <span className="topbar-breadcrumb-sep" aria-hidden="true">
            /
          </span>
          <span className="topbar-breadcrumb-current" aria-current="page">
            {page}
          </span>
        </nav>
      </div>

      <div className="topbar-user">
        <span className="topbar-username">
          Signed in as <strong>{displayName}</strong>
        </span>
        <span className="topbar-avatar" aria-hidden="true">
          {initials(displayName)}
        </span>
      </div>
    </header>
  )
}
