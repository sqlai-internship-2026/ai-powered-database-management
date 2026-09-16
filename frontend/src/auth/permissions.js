// Who may see what, in the browser.
//
// A copy of the matrix in backend/auth.py, in the same shape so the two can be
// compared line by line; a change belongs in both. Hiding a menu entry here is
// only a courtesy to the reader. The backend checks the role on every request
// whatever the browser shows, and that check is the control.
//
// Roles are Keycloak realm roles, read from the access token. Anything that is
// not one of the four grants nothing, and an unknown permission name is refused
// rather than allowed.

// Most privileged first, so the first one an account holds is its effective role.
export const APP_ROLES = ['ADMIN', 'DBA', 'ANALYST', 'VIEWER']

export const PERMISSIONS = {
  // Dashboard, the lists, project detail and the fixed reports.
  read: ['VIEWER', 'ANALYST', 'DBA', 'ADMIN'],
  // The Assistant and dynamic reports.
  ai: ['ANALYST', 'DBA', 'ADMIN'],
  // The structural review of the live schema.
  schema_audit: ['DBA', 'ADMIN'],
  // A finding explained by a model.
  schema_audit_explain: ['DBA', 'ADMIN'],
}

const ROLE_LABELS = {
  ADMIN: 'Admin',
  DBA: 'DBA',
  ANALYST: 'Analyst',
  VIEWER: 'Viewer',
}

// The application roles among a token's realm roles, most privileged first.
// Compared without regard to case or surrounding spaces, as the backend does.
export function appRoles(realmRoles) {
  const names = new Set(
    (Array.isArray(realmRoles) ? realmRoles : [])
      .filter((role) => typeof role === 'string')
      .map((role) => role.trim().toUpperCase()),
  )
  return APP_ROLES.filter((role) => names.has(role))
}

export function effectiveRole(roles) {
  return roles[0] || null
}

export function hasPermission(roles, permission) {
  const allowed = PERMISSIONS[permission]
  if (!allowed) return false
  return roles.some((role) => allowed.includes(role))
}

export function roleLabel(role) {
  return role ? ROLE_LABELS[role] : 'No role assigned'
}
