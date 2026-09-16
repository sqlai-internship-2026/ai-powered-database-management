import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { roleLabel } from '../auth/permissions'
import { LockIcon } from '../components/icons'
import { useT } from '../i18n'

// What a signed-in reader sees on a page their role does not include.
//
// Two cases, because the way out differs. A role that lacks this one page can
// go back to the dashboard. An account with no application role cannot open
// the dashboard either, so it is told that a role has to be assigned, and is
// offered the only thing that still works: logging out.
export default function AccessDenied() {
  const { role, can, logout } = useAuth()
  const t = useT()

  return (
    <section className="card" aria-labelledby="access-denied-title">
      <div className="state-block">
        <span className="state-icon">
          <LockIcon size={20} />
        </span>
        <h1 className="state-title" id="access-denied-title">
          {t('Access denied')}
        </h1>
        <p className="state-text">
          {role
            ? t('The {role} role does not include this page.', {
                role: t(roleLabel(role)),
              })
            : t(
                'This account has no application role yet. An administrator has to assign one in Keycloak.',
              )}
        </p>
        <div className="state-actions">
          {can('read') ? (
            <Link className="button" to="/dashboard">
              {t('Back to dashboard')}
            </Link>
          ) : (
            <button type="button" className="button" onClick={logout}>
              {t('Log out')}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
