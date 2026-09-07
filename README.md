# database_yonetim_sistemi (SQL-AI Management System)

Internal management dashboard for a fictional defense industry company.

Current stage:

```text
User -> Keycloak Login -> React Frontend -> FastAPI REST API -> PostgreSQL
```

Every list page, the dashboard summary, the reporting screens and the schema
audit are read live from the database. There is no mock data in the frontend.

## Repository structure

```text
.
├── frontend/                 React + Vite single page application
│   └── src/
│       ├── auth/             Keycloak provider and route guard
│       ├── components/       Layout, sidebar, table, cards
│       │   └── charts/       Bar, column and bullet-meter marks (no chart library)
│       ├── pages/            One component per route
│       │   └── reports/      The three reporting tabs
│       └── utils/            REST client, formatting and CSV helpers
├── backend/                  FastAPI service (read-only REST API)
│   ├── main.py               Endpoints
│   ├── db.py                 PostgreSQL connection settings
│   ├── reports/              Aggregation queries behind the reporting screens
│   └── schema_audit/         Structural review of the live schema
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

The batch is **re-runnable**: `002_sequence_baslangic.sql` truncates the seeded
tables before the inserts, so applying it again after a data change replaces the
rows instead of failing on a duplicate key. Because that truncate is inside the
same transaction, a failure further down rolls it back too.

Seeded volume: 10 departments, 60 employees, 22 projects, 32 products, 95
investments, 133 project assignments and 96 product allocations. Investments
span 2019-2026 so the reporting screens have a real time series, and the figures
are deliberately uneven - two programs are over budget, one is past its end
date, the Planning ones have barely spent anything - because evenly distributed
data produces reports that say nothing.

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

| Endpoint                   | Returns                                              |
| -------------------------- | ---------------------------------------------------- |
| `/api/health`              | Service and database status                          |
| `/api/dashboard`           | Summary counters and totals for the dashboard cards  |
| `/api/departments`         | Departments with a derived `employee_count`          |
| `/api/employees`           | Employees joined with their department name          |
| `/api/projects`            | Projects with budget and status                      |
| `/api/products`            | Product and subsystem catalog                        |
| `/api/investments`         | Investments joined with their project name           |
| `/api/reports/filters`     | Statuses, investment year range and departments      |
| `/api/reports/financial`   | Budget against committed investment, per program and year |
| `/api/reports/workforce`   | Headcount, payroll, hiring history and allocation    |
| `/api/reports/portfolio`   | Schedule position and hardware consumption           |
| `/api/schema-audit`        | Structural findings with suggested DDL per finding    |
| `/api/schema-audit/rules`  | The audit rule catalog                               |

Numeric and date columns are cast in SQL, so the payload contains plain numbers
and ISO `YYYY-MM-DD` date strings.

The junction tables `project_employees` and `project_products` have no endpoint
of their own, no menu entry and no page on purpose. They are read through the
reporting endpoints, and will also be used inside project detail screens.

## Reports

Reporting lives behind a single `Reports` menu entry and splits into three tabs,
so the sidebar stays a list of subjects rather than a list of reports:

| Tab           | Route                | Covers                                            |
| ------------- | -------------------- | ------------------------------------------------- |
| **Financial** | `/reports`           | Budget against committed investment, per program and per year, by investment type |
| **Workforce** | `/reports/workforce` | Headcount and payroll per department, hiring history, per-person program load |
| **Portfolio** | `/reports/portfolio` | Where each program sits in its schedule, and the hardware it consumes |

Filters (`year range`, `project status`, `department`) are passed to the API as
query parameters, so the aggregation happens in SQL rather than in the browser.
A single filter row scopes every card below it.

Each card offers a **Chart / Table** switch and a **CSV** export, so no value is
reachable only by hovering a mark. **Print** in the toolbar drops the sidebar,
top bar and controls through a print stylesheet.

No charting dependency was added: the bars, columns and bullet meters in
`frontend/src/components/charts/` are plain CSS and flex. One series colour
carries every mark, since bar length already encodes the magnitude - which
leaves colour free to mean state. The three meter states (on track, near the
limit, over it) always print their value beside the bar, so colour never carries
the meaning alone.

Hardware cost is worth reading carefully: it is
`project_products.quantity × products.unit_cost`, which is material cost only.
It lands between roughly 2% and 22% of a program budget, because a budget also
covers labour, test infrastructure and certification.

## Schema audit

`Schema Audit` reads the live catalog and reports structural problems - missing
primary keys, undefined `ON DELETE` / `ON UPDATE` behaviour, isolated tables,
circular foreign key chains, redundant indexes, foreign key type mismatches,
unindexed foreign keys, relationships that are implied by naming but not
enforced, and inconsistent types for a shared column name. Ten rules in total,
each documented in the catalog the UI can display.

The package never writes to the database. Findings carry **suggested DDL as
text** with a risk level, so applying a suggestion stays a human decision -
review every statement before running it.

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

Person names are data, not labels, and are never translated.

One consequence is worth knowing. `projects.status` holds display text, so the
value is matched literally in two places: the active-project count in
`backend/main.py` and the colour map in
`frontend/src/components/StatusBadge.jsx`. Storing a language-neutral code
(`ACTIVE` / `COMPLETED` / `PLANNING` / `ON_HOLD`, guarded by a CHECK constraint)
would remove both literals and let the UI decide how to label them.

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

Import **once only**. Running it again overwrites the realm and takes the test
user with it; on an already-imported installation `bin\kc.bat start-dev` is all
that is needed.

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

Every route is protected and cannot be opened without an active Keycloak
session: `/dashboard`, `/projects`, `/employees`, `/departments`, `/products`,
`/investments`, `/reports` (plus `/reports/workforce` and `/reports/portfolio`)
and `/schema-audit`.

## Not implemented yet

- **Backend token validation.** The API is open on the development machine:
  authentication happens only between React and Keycloak, and the backend does
  not verify the access token.
- **AI and LLM features**, including natural-language-to-SQL. The reporting
  screens are a fixed set of queries, not a query builder and not generated.
- **LDAP** as an identity source.
- **Write operations.** Every endpoint is a GET; records are created and edited
  directly in the database.
- **Project detail screens**, which is where `project_employees` and
  `project_products` will be shown per program.
