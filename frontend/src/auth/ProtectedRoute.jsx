import { useAuth } from './AuthProvider'

// Blocks rendering of protected pages until Keycloak confirms a session.
// keycloak-js is configured with onLoad: 'login-required', so an
// unauthenticated visitor is redirected to the Keycloak login page before this
// component ever renders its children.
export default function ProtectedRoute({ children }) {
  const { status, error, login } = useAuth()

  if (status === 'loading') {
    return (
      <div className="centered-screen">
        <div>
          <h1 className="page-title">SQL-AI Management System</h1>
          <p className="placeholder">Signing you in with Keycloak...</p>
        </div>
      </div>
    )
  }

  if (status !== 'authenticated') {
    return (
      <div className="centered-screen">
        <div className="card">
          <h1 className="page-title">Authentication required</h1>
          <p className="placeholder">
            {error
              ? 'Could not reach the Keycloak server. Make sure it is running on the configured URL.'
              : 'Your session is not active. Please sign in to continue.'}
          </p>
          <button className="button button-primary" onClick={login}>
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return children
}
