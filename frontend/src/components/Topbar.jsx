import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { navigationItems } from './Sidebar'
import { initials } from '../utils/format'
import { useLanguage } from '../i18n'
import { applyTheme, readTheme, saveTheme } from '../utils/theme'
import { MenuIcon, MoonIcon, SunIcon } from './icons'

// Where you are, who you are, and on a phone the way back to the menu. It
// deliberately does not repeat the page heading below it: the same words set
// twice, one above the other, waste the only strip of the screen that is
// always visible and make the page look emptier than it is.

function useLocationTrail(t) {
  const { pathname } = useLocation()
  const match = navigationItems
    .filter((item) => pathname.startsWith(item.to))
    .sort((a, b) => b.to.length - a.to.length)[0]

  if (!match) return { section: 'SQL-AI', page: t('Not found') }
  return { section: t(match.group), page: t(match.label) }
}

export default function Topbar({ menuButtonRef, drawerOpen = false, onOpenDrawer }) {
  const { username, fullName } = useAuth()
  const { language, toggleLanguage, t } = useLanguage()
  const { section, page } = useLocationTrail(t)
  const displayName = fullName || username || t('Unknown user')

  // Read from the page rather than from storage: index.html has already applied
  // the saved choice by the time this renders.
  const [theme, setTheme] = useState(readTheme)
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const themeLabel =
    nextTheme === 'dark' ? t('Switch to dark theme') : t('Switch to light theme')

  // The same convention as the theme button beside it: what is written on the
  // button is what a press switches to, so "TR" means "press for Turkish".
  const nextLanguage = language === 'tr' ? 'en' : 'tr'
  const languageLabel =
    nextLanguage === 'tr' ? t('Switch to Turkish') : t('Switch to English')

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
          aria-label={t('Open the navigation menu')}
          aria-expanded={drawerOpen}
          aria-controls="app-sidebar"
        >
          <MenuIcon size={20} />
        </button>

        <nav className="topbar-breadcrumb" aria-label={t('Breadcrumb')}>
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

        {/* Two letters rather than a flag: a language is not a country, and
            the pair of buttons reads as one row of settings at this size. */}
        <button
          type="button"
          className="topbar-icon-button topbar-language-button"
          onClick={toggleLanguage}
          aria-label={languageLabel}
          title={languageLabel}
        >
          {nextLanguage.toUpperCase()}
        </button>

        <div className="topbar-user">
          <span className="topbar-username">
            {t('Signed in as')} <strong>{displayName}</strong>
          </span>
          <span className="topbar-avatar" aria-hidden="true">
            {initials(displayName)}
          </span>
        </div>
      </div>
    </header>
  )
}
