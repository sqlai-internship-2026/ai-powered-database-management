// The colour theme, remembered per browser.
//
// Light is the default and needs nothing: it is the stylesheet's plain :root.
// Dark is data-theme="dark" on <html>, which index.html sets from storage before
// anything is drawn, so this module only reads what is already on the page and
// changes it when the reader asks. The operating system's colour preference is
// deliberately not followed: the console opens light unless someone chose dark.
//
// Storage is a preference, not data, so it fails the way the sidebar's does -
// quietly, with the theme still switching for as long as the page is open.

export const THEME_KEY = 'sqlai.theme'

export function readTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.dataset.theme = 'dark'
  } else {
    delete document.documentElement.dataset.theme
  }
}

export function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Nothing to do: the theme still changes, it is just not remembered.
  }
}
