# database_yonetim_sistemi (SQL-AI Management System)

Internal management dashboard for a fictional defense industry company.

Current stage:

```text
User -> Keycloak Login -> React Frontend -> FastAPI REST API -> PostgreSQL
```

Every list page and the dashboard summary are read live from the database.
There is no mock data left in the frontend.

## Repository structure

```text
.
├── frontend/                 React + Vite single page application
│   └── src/
│       ├── auth/             Keycloak provider and route guard
│       ├── components/       Layout, sidebar, table, cards
│       ├── pages/            One component per route
│       └── utils/            REST client and formatting helpers
├── backend/                  FastAPI service (read-only REST API)
│   ├── main.py               Endpoints
│   ├── db.py                 PostgreSQL connection settings
│   └── labels.py             Turkish -> English display labels
├── database/
│   ├── migrations/           PostgreSQL schema and seed data
│   └── run_seeds.ps1         Applies the seed migrations in one transaction
├── identity/
│   └── keycloak/             Keycloak realm export
└── .env.example              Template for the local .env file
```

## Prerequisites

- PostgreSQL 16 or newer, installed locally
- Python 3.11 or newer
- Node.js 18 or newer
- Keycloak, installed locally

## 1. Configure environment files

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Set at least `PGDATABASE`, `PGUSER` and `PGPASSWORD` in `.env` - the backend
reads that file on startup. Real `.env` files are git-ignored; only the
`.env.example` templates are committed.

## 2. Prepare the database

Create the database once, apply the schema, then the seed data:

```powershell
createdb -U postgres savunma_db
psql -U postgres -d savunma_db -f database\migrations\001_initial_schema.sql
powershell -ExecutionPolicy Bypass -File database\run_seeds.ps1
```

`run_seeds.ps1` runs every seed file inside a single transaction and prints the
row counts at the end, so a failure leaves the tables exactly as they were.

## 3. Start the backend

```powershell
python -m venv .venv
.venv\Scripts\pip install -r backend\requirements.txt
.venv\Scripts\python -m uvicorn main:app --reload --app-dir backend --port 8000
```

Quick check - it must report `"database": "connected"`:

```bash
curl http://localhost:8000/api/health
```

Interactive API documentation is served at http://localhost:8000/docs.

## 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

## API endpoints

All endpoints are read-only GETs and return JSON.

| Endpoint           | Returns                                                     |
| ------------------ | ----------------------------------------------------------- |
| `/api/health`      | Service and database status                                  |
| `/api/dashboard`   | Summary counters and totals for the dashboard cards          |
| `/api/departments` | Departments with a derived `employee_count`                  |
| `/api/employees`   | Employees joined with their department name                  |
| `/api/projects`    | Projects with budget and status                              |
| `/api/products`    | Product and subsystem catalog                                |
| `/api/investments` | Investments joined with their project name                   |

Numeric and date columns are cast in SQL, so the payload contains plain numbers
and ISO `YYYY-MM-DD` date strings.

The junction tables `project_employees` and `project_products` have no endpoint,
menu entry or page on purpose; they will be used inside project detail screens.

## Data language

The application is English end to end. The seed data is written in English and
the API serves stored values exactly as they are - there is no translation
layer.

It used to work differently: the tables were seeded in Turkish and
`backend/labels.py` mapped every stored value to English on the way out. That
file is gone. The map had to be edited by hand whenever a row was added, a
missing entry failed silently, and translating a department name is no more
correct than translating a person's name - the data itself is now English
instead.

One consequence is worth knowing. `projects.status` holds display text, so the
value is matched literally in two places: the active-project count in
`backend/main.py` and the colour map in
`frontend/src/components/StatusBadge.jsx`. Storing a language-neutral code
(`ACTIVE` / `COMPLETED` / `PLANNING`, guarded by a CHECK constraint) would
remove both literals and let the UI decide how to label them.

## URLs

| Service               | URL                                            |
| --------------------- | ---------------------------------------------- |
| Frontend              | http://localhost:5173                          |
| Backend API           | http://localhost:8000                          |
| API documentation     | http://localhost:8000/docs                     |
| Keycloak Admin Console| http://localhost:8080/admin                    |
| Realm login page      | http://localhost:8080/realms/sql-ai/account    |

## Keycloak

Start the local Keycloak installation in development mode and import the
realm export once:

```powershell
bin\kc.bat import --file <repo>\identity\keycloak\sql-ai-realm.json
bin\kc.bat start-dev
```

Keycloak settings used by the frontend:

- Realm: `sql-ai`
- Client: `frontend` (public client, standard flow + PKCE S256)
- Valid redirect URI: `http://localhost:5173/*`
- Web origin: `http://localhost:5173`

The realm export deliberately contains no user accounts, so no password is
stored in the repository. Create a test user after the first start:

1. Open http://localhost:8080/admin and sign in as the Keycloak admin.
2. Switch the realm selector (top left) from `Keycloak` to **sql-ai**.
3. Go to **Users** -> **Add user**.
   - Username: `testuser`
   - Email verified: On (optional, avoids the verification screen)
   - Click **Create**.
4. Open the **Credentials** tab -> **Set password**.
   - Choose any password, set **Temporary** to **Off**, then **Save**.

## Log in

1. Open http://localhost:5173.
2. The application has no local login form - it redirects straight to the
   Keycloak login page of the `sql-ai` realm.
3. Sign in with the test user.
4. Keycloak redirects back to the frontend and the Dashboard is shown.
5. The signed-in username appears in the top bar, next to the **Log out**
   button.

All routes (`/dashboard`, `/projects`, `/employees`, `/departments`,
`/products`, `/investments`, `/reports`) are protected and cannot be opened
without an active Keycloak session.

## Not implemented yet

LDAP, AI/LLM features, natural-language-to-SQL, the reporting engine, and
backend token validation. The API is currently open on the development machine:
authentication happens only between React and Keycloak, and the backend does
not yet verify the access token.

Workflow test
