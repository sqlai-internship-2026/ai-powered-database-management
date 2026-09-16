import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import turkish from './translations'

// The language the console speaks, remembered per browser.
//
// English is the default and needs no dictionary: a phrase with no Turkish
// entry falls back to its own key, which is the English text. That is what
// keeps the two languages from drifting - there is one list to maintain, not
// two, and a phrase nobody has translated yet still reads as a sentence.
//
// Storage is a preference, not data, so it fails the way the theme's does:
// quietly, with the language still switching for as long as the page is open.

export const LANGUAGE_KEY = 'sqlai.lang'

const DICTIONARIES = { en: null, tr: turkish }

// The locale handed to Intl. Kept here rather than in format.js so the two
// cannot disagree about what "tr" means.
const LOCALES = { en: 'en-US', tr: 'tr-TR' }

export function readLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY)
    if (stored === 'tr' || stored === 'en') return stored
  } catch {
    // Storage is unavailable: open in English, the way a first visit does.
  }
  return 'en'
}

// Read by format.js, which formats numbers and dates outside React and so
// cannot use the hook. Kept in step with the provider's state by setLanguage.
let current = readLanguage()

export function currentLanguage() {
  return current
}

export function currentLocale() {
  return LOCALES[current] || LOCALES.en
}

// {name} is filled by the caller. Translations never assemble a sentence out
// of fragments, because Turkish and English put the pieces in different
// orders and only one of the two would come out right.
export function translate(language, text, values) {
  if (text === null || text === undefined) return text
  const dictionary = DICTIONARIES[language]
  const phrase = (dictionary && dictionary[text]) || text
  if (!values) return phrase
  return String(phrase).replace(/\{(\w+)\}/g, (token, name) =>
    name in values ? String(values[name]) : token,
  )
}

// The same lookup, for the few places outside the component tree - format.js
// writes "3 gün" and "12 Mar 2026" without being able to call a hook.
export function translateNow(text, values) {
  return translate(current, text, values)
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(current)

  const setLanguage = useCallback((next) => {
    const chosen = next === 'tr' ? 'tr' : 'en'
    current = chosen
    document.documentElement.lang = chosen
    try {
      window.localStorage.setItem(LANGUAGE_KEY, chosen)
    } catch {
      // Nothing to do: the language still changes, it is just not remembered.
    }
    setLanguageState(chosen)
  }, [])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === 'tr' ? 'en' : 'tr'),
      t: (text, values) => translate(language, text, values),
    }),
    [language, setLanguage],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used inside a LanguageProvider')
  }
  return context
}

// The common case: a screen that only needs to say things.
export function useT() {
  return useLanguage().t
}
