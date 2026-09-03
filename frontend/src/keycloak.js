import Keycloak from 'keycloak-js'

// Single Keycloak instance shared by the whole application.
// Values come from frontend/.env (see frontend/.env.example).
const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'sql-ai',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'frontend',
})

export default keycloak
