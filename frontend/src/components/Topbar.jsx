import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { navigationItems } from './Sidebar'
import { initials } from '../utils/format'
import { applyTheme, readTheme, saveTheme } from '../utils/theme'
import { MenuIcon, MoonIcon, SunIcon } from './icons'

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

  // Read from the page rather than from storage: index.html has already applied
  // the saved choice by the time this renders.
  const [theme, setTheme] = useState(readTheme)
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const themeLabel = `Switch to ${nextTheme} theme`

  function toggleTheme() {
    applyTheme(nextTheme)
    saveTheme(nextTheme)
    setTheme(nextTheme)
  }

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

      <div className="topbar-actions">
        {/* The icon shows the theme a press switches to, and the label says it. */}
        <button
          type="button"
          className="topbar-icon-button"
          onClick={toggleTheme}
          aria-label={themeLabel}
          title={themeLabel}
        >
          {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>

        <div className="topbar-user">
          <span className="topbar-username">
            Signed in as <strong>{displayName}</strong>
          </span>
          <span className="topbar-avatar" aria-hidden="true">
            {initials(displayName)}
          </span>
        </div>
      </div>
    </header>
  )
}
