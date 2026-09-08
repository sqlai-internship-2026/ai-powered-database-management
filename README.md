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
│   ├── auth.py               Keycloak access token validation
│   ├── db.py                 PostgreSQL connection settings
│   ├── reports/              Reporting queries, and the natural-language pipeline
│   │   ├── ask.py            Question -> SQL -> rows (the model call is stubbed)
│   │   ├── sql_guard.py      Accept-or-refuse gate for generated SQL
│   │   ├── schema_context.py The schema description a model reads
│   │   ├── eval_cases.py     20 questions with hand-written reference SQL
│   │   └── check_model.py    Is the hosted model reachable and answering?
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

`/api/health` is the only endpoint that answers without a token; every other
one replies `401` until the request carries a Keycloak access token, so Keycloak
has to be running before the frontend can load a page. See
[Backend token validation](#backend-token-validation).

Interactive API documentation is served at http://localhost:8000/docs.

## 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

## API endpoints

Every endpoint reads and returns JSON. All are GETs except `/api/reports/ask`,
which carries a question in its body rather than a change. All of them require
an `Authorization: Bearer <access token>` header except `/api/health`.

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
| `/api/reports/ask`         | POST. A question in English, answered with rows       |
| `/api/reports/ask/examples`| Questions the current generator can answer            |
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
| **Ask**       | `/reports/ask`       | A question typed in English, the SQL generated from it, and the rows it returns |

The first three tabs share one filter row. **Ask** builds its own query from the
question, so the filters do not apply to it.

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

## Natural language questions (Ask)

The `Ask` tab takes a question typed in English and answers it with rows. Four
steps, in `backend/reports/`:

| Step | File | What it does |
| ---- | ---- | ------------ |
| 1 | `schema_context.py` | Describes the live schema - tables, columns, how they join, and the actual values in short text columns such as `status` - as the text a model reads before writing SQL |
| 2 | `ask.py` -> `generate_sql()` | Question + schema -> SQL. **Stubbed**: returns canned answers, no model is called |
| 3 | `sql_guard.py` | Accepts or refuses the SQL. Only a single SELECT or WITH; writes, second statements and file-reading functions are named and rejected; a missing `LIMIT` is added |
| 4 | `db.readonly_cursor()` | Runs it as a role holding `SELECT` and nothing else, with `statement_timeout` set |

Steps 3 and 4 are deliberately independent. The guard runs in Python and can be
argued with in principle; the role is enforced by PostgreSQL and cannot. Neither
is enough alone - text filtering over SQL has been defeated many times, and a
privilege check has no opinion about a query that returns every row of a table.

The generated SQL is shown above the result on screen. The query is the only
way for a reader to judge whether the answer means what they asked, so hiding it
would turn a checkable number into a claim.

### Why the model is stubbed

Everything except step 2 works without one, and those are the parts that take
the time: pulling SQL out of a reply that wraps it in prose and markdown,
refusing writes, converting `Decimal` and `date` for JSON, an empty result, a
truncated result, and the sentence a user sees when their question cannot be
answered. Replacing the stub changes one function.

### Where the model runs

Not on this machine. The first plan was to install and serve a model locally;
the project uses NVIDIA's free developer endpoint instead, so there is nothing
to download, no GPU to size and no extra service to keep running next to
PostgreSQL and Keycloak.

The endpoint is **OpenAI-compatible**, which is why the switch is cheap: a POST
to `/chat/completions` carrying a `Bearer` key, so no client package is added.
Three settings in `.env` describe it - `NVIDIA_API_KEY`, `NVIDIA_MODEL` and
`NVIDIA_BASE_URL`. The key is personal and that file is git-ignored.

Replacing the stub then looks roughly like:

```python
def generate_sql(question, context):
    reply = post(f"{BASE_URL}/chat/completions", key=API_KEY, json={
        "model": MODEL,
        "messages": [
            {"role": "system", "content": PROMPT.format(schema=context)},
            {"role": "user", "content": question},
        ],
        "temperature": 0,
    })
    return reply["choices"][0]["message"]["content"]
```

### Checking the model on its own

`backend/reports/check_model.py` calls the endpoint directly - no database, no
API, no Keycloak, no SQL - so a model problem can be told apart from an Ask
problem. It answers one question, in three ordered steps that each name their
own cause on failure: the endpoint is **reachable**, the key is **authorised**
for that model, and a reply actually **comes back**. It sends a plain greeting
and prints the answer, the token counts and the latency.

It says nothing about the quality of what the model writes. Whether the model
can turn a question into correct SQL is measured separately, by `run_eval.py`
against `eval_cases.py`, once `generate_sql()` calls a model at all.

```powershell
.venv\Scripts\python.exe backend\reports\check_model.py --list-models   # which ids exist
.venv\Scripts\python.exe backend\reports\check_model.py                 # one request
.venv\Scripts\python.exe backend\reports\check_model.py --prompt "..."  # send your own message
.venv\Scripts\python.exe backend\reports\check_model.py --chat          # a conversation
.venv\Scripts\python.exe backend\reports\check_model.py --stream        # time to first token
```

`--chat` is the one to use to get a feel for the model: type a message, read the
reply, keep going, and end it with a blank line or Ctrl+C. It is worth doing
before writing the prompt Ask will send, because it shows how the model words a
refusal, whether it wraps SQL in markdown, and how long an answer takes.

The endpoint holds no session, so the whole conversation is resent on every
turn - the prompt grows as you go, and each message counts against the rate
limit below. Temperature defaults to `0` so a check repeats itself; pass
`--temperature 0.7` when exploring.

Start with `--list-models`. The name shown on a model's web page is not always
the id the API accepts, and a wrong id comes back as a `404` that reads like an
outage.

The file is deliberately not named `test_*.py`, so pytest does not collect it:
the backend suite runs without a network, a key or a model, and a check that
needs all three does not belong in it.

### When the endpoint says no

Two statuses mean "busy, nothing wrong with your request", and both are common
on the free tier: `429 Too Many Requests` and `503 Service temporarily
overloaded`. `--chat` retries them by itself after 3, 8 and 20 seconds rather
than making you retype the message.

A `429` is easy to misread as a spent quota. It usually is not. The flagship
models are the ones that refuse: asking `moonshotai/kimi-k3` was rejected in
under a second, over and over for half a minute, while
`nvidia/nemotron-3-super-120b-a12b` answered in **0.7s**, `openai/gpt-oss-20b`
in 22s and `mistralai/mistral-nemotron` in 40s - **on the same key, in the same
minute**. A personal quota would have stopped all four. So the limit belongs to
that model's shared free capacity, not to the account.

The endpoint sends no `Retry-After` and no quota headers at all, so there is
nothing to read for a remaining count - the responses carry only `Connection`,
`Content-Length`, `Content-Type`, `Date` and `Vary`. The practical move when a
model keeps refusing is to pass `--model` and use one that answers.

A model id can also be listed by `/models` and still not serve chat: on the same
run `moonshotai/kimi-k2.6` returned `404` and `meta/llama-3.1-8b-instruct`
returned `410 Gone`. Being listed is not the same as being available.

Ask will have to handle all of this when it starts calling the model for real,
which is a reason to keep the wait-and-retry behaviour in one place.

Try the pipeline from a terminal, without the frontend:

```powershell
.venv\Scripts\python.exe backend\reports\ask.py "Which projects are on hold?"
```

### The evaluation set

`backend/reports/eval_cases.py` holds 20 questions with SQL written by hand,
from single-table counts to two-hop joins through the link tables, anti-joins
and `HAVING`. It answers the question a model cannot answer about itself: is
this good enough to ship?

Grading compares **result sets, not SQL text** - `COUNT(*)`, `COUNT(id)` and
`COUNT(*) AS total` are all correct answers to the same question. Both queries
are executed and the rows compared, ignoring row order. An answer with the right
values in a different column order is reported separately as `PASS*`.

```powershell
.venv\Scripts\python.exe backend\reports\run_eval.py                    # harness self-test, must be 20/20
.venv\Scripts\python.exe backend\reports\run_eval.py --generator ask     # scores the current generator
.venv\Scripts\python.exe backend\reports\run_eval.py --only top_earners -v
```

The reference query is re-run at grading time rather than compared against a
stored answer, so the set stays correct when the seed data changes and a
question like "projects past their end date" stays correct on any day.

Writing the set is also how the feature got a definition. The questions say what
"it works" means, and each one is precise enough to have a single defensible
reading - ambiguity in a question shows up as a false failure in the report.

## Tests

```powershell
.venv\Scripts\python.exe -m pytest backend -q
```

57 tests, no database, no model and no Keycloak: the SQL guard, the extraction
of SQL from a model reply and the token claim rules are pure functions, which is
why they were written that way. The last two check the route table itself, so an
endpoint added without the token check fails the suite.

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

## Backend token validation

The login above proves who the person at the browser is. It says nothing about
the request that reaches the API, so the backend validates the access token
itself - a route guard in React is a convenience, not a control, because anyone
can call the API directly.

`frontend/src/utils/api.js` attaches the token to every call and refreshes it
when it is within 30 seconds of expiry. `backend/auth.py` verifies it and every
endpoint except `/api/health` depends on that check:

- **Signature**, against the realm's published keys, pinned to `RS256`. The keys
  are fetched from the realm JWKS endpoint once and cached, so validation is
  offline and costs no round trip per request.
- **Issuer and expiry**, plus the presence of `exp`, `iat`, `iss` and `sub`.
- **`azp`**, which has to name the `frontend` client. The audience of a token
  issued to a public client is `account`, so it cannot tell one client in the
  realm from another; `azp` can.
- **The `app_user` realm role.** Accounts created in the `sql-ai` realm receive
  it automatically. If a token is rejected with a message about the missing
  role, assign it under **Users** -> the account -> **Role mapping**.

The three outcomes are distinct on purpose: `401` for a missing, expired or
invalid token, `403` for a valid token whose account is not allowed, and `503`
when Keycloak itself cannot be reached - a client that retried with a fresh
token would fail the same way, so blaming the token there would be misleading.

Configuration lives in `.env` (`KEYCLOAK_URL`, `KEYCLOAK_REALM`,
`KEYCLOAK_CLIENT_ID`, `KEYCLOAK_REQUIRED_ROLE`) and has to match the `VITE_`
values the frontend uses.

## Not implemented yet

- **The language model behind Ask.** Everything around it is built and tested;
  `generate_sql()` in `backend/reports/ask.py` returns canned answers instead of
  calling a model. Where it will run is settled - NVIDIA's hosted endpoint, not
  a local install - and `check_model.py` verifies that endpoint already, but
  nothing in the request path calls it yet. See the section above.
- **LDAP** as an identity source.
- **Write operations.** Every endpoint is a GET; records are created and edited
  directly in the database.
- **Project detail screens**, which is where `project_employees` and
  `project_products` will be shown per program.
