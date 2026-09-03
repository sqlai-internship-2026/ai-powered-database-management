import { createContext, useContext, useEffect, useState } from 'react'
import keycloak from '../keycloak'

const AuthContext = createContext(null)

// React StrictMode mounts effects twice in development; keycloak-js can only be
// initialized once per page load, so the promise is cached at module level.
let initPromise = null

function initKeycloak() {
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    })
  }
  return initPromise
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading') // loading | authenticated | error
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    initKeycloak()
      .then((authenticated) => {
        if (!active) return
        setStatus(authenticated ? 'authenticated' : 'error')
      })
      .catch((err) => {
        if (!active) return
        setError(err)
        setStatus('error')
      })

    // Keep the access token fresh while the user works.
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.login())
    }

    return () => {
      active = false
    }
  }, [])

  const value = {
    status,
    error,
    authenticated: status === 'authenticated',
    username:
      keycloak.tokenParsed?.preferred_username ||
      keycloak.tokenParsed?.name ||
      'Unknown user',
    fullName: keycloak.tokenParsed?.name || '',
    login: () => keycloak.login(),
    logout: () => keycloak.logout({ redirectUri: window.location.origin }),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
