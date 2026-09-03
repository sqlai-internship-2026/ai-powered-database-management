# database_yonetim_sistemi (SQL-AI Management System)

Internal management dashboard for a fictional defense industry company.

Current stage:

```text
User -> Keycloak Login -> React Frontend -> Mock Data
```

The next stage will replace the mock data with real data:

```text
React Frontend -> FastAPI REST API -> PostgreSQL
```

## Repository structure

```text
.
├── frontend/                 React + Vite single page application
│   └── src/
│       ├── auth/             Keycloak provider and route guard
│       ├── components/       Layout, sidebar, table, cards
│       ├── data/             Temporary mock datasets
│       ├── pages/            One component per route
│       └── utils/            Formatting helpers
├── backend/                  Reserved for the future FastAPI service (empty)
├── database/
│   └── migrations/           PostgreSQL schema (not used by the frontend yet)
├── identity/
│   └── keycloak/             Keycloak realm export imported on container start
├── docker-compose.yml        Development Keycloak service
└── .env.example              Template for the local .env file
```

## Prerequisites

- Docker Desktop (or Docker Engine with the Compose plugin)
- Node.js 18 or newer

## 1. Configure environment files

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Real `.env` files are git-ignored. Only the `.env.example` templates are committed.

## 2. Start Keycloak

```bash
docker compose up -d
```

The container starts in development mode and automatically imports
`identity/keycloak/sql-ai-realm.json` on first launch (`--import-realm`),
so the `sql-ai` realm and the `frontend` client already exist. The import only
runs when the realm is not present yet; later changes made in the admin console
are kept in the `keycloak_data` volume.

Check the status and logs with:

```bash
docker compose ps
docker compose logs -f keycloak
```

## 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

## URLs

| Service               | URL                                            |
| --------------------- | ---------------------------------------------- |
| Frontend              | http://localhost:5173                          |
| Keycloak Admin Console| http://localhost:8080/admin                    |
| Realm login page      | http://localhost:8080/realms/sql-ai/account    |

Keycloak settings used by the frontend:

- Realm: `sql-ai`
- Client: `frontend` (public client, standard flow + PKCE S256)
- Valid redirect URI: `http://localhost:5173/*`
- Web origin: `http://localhost:5173`

The Keycloak admin user comes from `.env` (`KEYCLOAK_ADMIN` /
`KEYCLOAK_ADMIN_PASSWORD`, defaults `admin` / `admin` for local development
only).

## 4. Create a test user

The realm export deliberately contains no user accounts, so no password is
stored in the repository. Create one after the first start:

1. Open http://localhost:8080/admin and sign in with the admin credentials
   from your `.env` file.
2. Switch the realm selector (top left) from `Keycloak` to **sql-ai**.
3. Go to **Users** -> **Add user**.
   - Username: `testuser`
   - Email: `testuser@example.com` (optional)
   - Email verified: On (optional, avoids the verification screen)
   - Click **Create**.
4. Open the **Credentials** tab -> **Set password**.
   - Choose any password, set **Temporary** to **Off**, then **Save**.

The same thing from the command line, inside the running container:

```bash
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh create users \
  -r sql-ai -s username=testuser -s enabled=true
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh set-password \
  -r sql-ai --username testuser --new-password "<your-password>"
```

## 5. Log in

1. Open http://localhost:5173.
2. The application has no local login form - it redirects straight to the
   Keycloak login page of the `sql-ai` realm.
3. Sign in with the test user.
4. Keycloak redirects back to the frontend and the Dashboard is shown.
5. The signed-in username appears in the top bar, next to the **Log out**
   button. Logging out ends the Keycloak session and returns you to the login
   flow.

All routes (`/dashboard`, `/projects`, `/employees`, `/departments`,
`/products`, `/investments`, `/reports`) are protected and cannot be opened
without an active Keycloak session.

## 6. Stop the services

```bash
# Frontend: press Ctrl+C in the terminal running "npm run dev"

# Keycloak
docker compose down

# Keycloak including users and realm changes
docker compose down -v
```

## Mock data

Every page reads from a module in `frontend/src/data/`:

| File                  | Used by                                    |
| --------------------- | ------------------------------------------ |
| `mockProjects.js`     | Projects, Dashboard                        |
| `mockEmployees.js`    | Employees                                  |
| `mockDepartments.js`  | Departments, Dashboard                     |
| `mockProducts.js`     | Products, Dashboard                        |
| `mockInvestments.js`  | Investments, Dashboard                     |
| `dashboardStats.js`   | Dashboard summary cards (derived)          |

Property names follow the column names in
`database/migrations/001_initial_schema.sql`, so each import can later be
replaced by a REST call without touching the table components.

The junction tables `project_employees` and `project_products` have no menu
entry or page on purpose; they will be used inside project detail screens once
the backend exists.

## Not implemented yet

LDAP, the FastAPI backend, PostgreSQL integration, AI/LLM features,
natural-language-to-SQL, the reporting engine, and backend token validation.
Authentication currently happens only between React and Keycloak.
