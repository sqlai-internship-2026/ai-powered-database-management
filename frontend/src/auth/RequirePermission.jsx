import { useAuth } from './AuthProvider'
import AccessDenied from '../pages/AccessDenied'

// Shows a page only to a role that holds its permission, and says so otherwise.
//
// No redirect: a reader who typed an address they cannot use sees why, on the
// address they typed, instead of landing somewhere else - and a redirect to a
// page the account cannot open either would never end. It renders inside
// ProtectedRoute, so the session and the token are settled before this runs and
// nothing protected is drawn while signing in is still under way.
export default function RequirePermission({ permission, children }) {
  const { can } = useAuth()
  return can(permission) ? children : <AccessDenied />
}
