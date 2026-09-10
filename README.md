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
│       ├── components/       Layout, sidebar, table, cards, the assistant
│       │   └── charts/       Bar, column, line, donut and meter marks (no chart library)
│       ├── pages/            One component per route
│       │   └── reports/      The four reporting tabs
│       └── utils/            REST client, formatting, CSV and saved-report helpers
├── backend/                  FastAPI service (read-only REST API)
│   ├── main.py               Endpoints
│   ├── auth.py               Keycloak access token validation
│   ├── db.py                 PostgreSQL connection settings
│   ├── llm/                  The one place that calls a language model
│   │   └── client.py         Key, retries, and a named error per failure
│   ├── reports/              Reporting queries, and the natural-language pipeline
│   │   ├── ask.py            Question -> SQL -> rows -> a sentence about them
│   │   ├── sql_guard.py      Accept-or-refuse gate for generated SQL
│   │   ├── chart_spec.py     Picks the chart a result should be drawn as
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

Every endpoint reads and returns JSON. All are GETs except `/api/reports/ask`
and `/api/reports/run`, which carry a question and a query in their bodies
rather than a change. All of them require an `Authorization: Bearer <access
token>` header except `/api/health`.

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
| `/api/reports/ask`         | POST. A question in English, answered with rows and a chart |
| `/api/reports/run`         | POST. Runs a saved report card's SQL again, without a model |
| `/api/reports/ask/examples`| Example questions, and the model that will answer them|
| `/api/schema-audit`        | Structural findings with suggested DDL per finding    |
| `/api/schema-audit/rules`  | The audit rule catalog                               |

Numeric and date columns are cast in SQL, so the payload contains plain numbers
and ISO `YYYY-MM-DD` date strings.

`/api/reports/run` is the one endpoint that takes SQL from the browser, which is
worth being explicit about. It is the same SQL the model wrote when a report
card was built, and it meets exactly the same two defences on the way back in:
`validate_select` accepts a single SELECT and nothing else, and the role it then
runs as holds `SELECT` and nothing else, under a five second statement timeout.
Neither defence trusts where the text came from - that is the point. A card
saved last week is no more trusted than a sentence a model produced a moment
ago, and both are refused the same way.

The junction tables `project_employees` and `project_products` have no endpoint
of their own, no menu entry and no page on purpose. They are read through the
reporting endpoints, and will also be used inside project detail screens.

## Reports

Reporting lives behind a single `Reports` menu entry and splits into four tabs,
so the sidebar stays a list of subjects rather than a list of reports:

| Tab           | Route                | Covers                                            |
| ------------- | -------------------- | ------------------------------------------------- |
| **Financial** | `/reports`           | Budget against committed investment, per program and per year, by investment type |
| **Workforce** | `/reports/workforce` | Headcount and payroll per department, hiring history, per-person program load |
| **Portfolio** | `/reports/portfolio` | Where each program sits in its schedule, and the hardware it consumes |
| **Dynamic**   | `/reports/ask`       | Reports built from typed questions: each answer arrives as a chart and can be kept as a card |

The first three tabs are fixed - the questions were chosen in advance and their
SQL lives in `backend/reports/queries.py`. **Dynamic** is the opposite: the reader
writes the question, the query is generated from it, and the report is whatever
they decide to keep. It builds its own query, so the shared filter row does not
apply to it.

The **assistant** at the bottom of the dashboard answers the same kind of
question against the same endpoint. It has no menu entry and no route of its
own: the figures at the top of that page are the questions somebody thought to
ask in advance, and it is where the rest of them go.

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

### Reports built from questions

The **Dynamic** tab is where a report nobody wrote in advance gets built. Ask a
question, see the rows drawn as whatever shape they turn out to be, overrule
that shape if it is wrong, and keep the card. Cards accumulate into a report
with a title and a description, which can be saved, reopened, refreshed and
printed.

Which chart a result gets is decided in `backend/reports/chart_spec.py`, from
the column types, the column names and the rows - not by a second call to the
model. A model call would cost a few seconds on every question, would be one
more thing the free tier can refuse, and would answer the same question
differently on two afternoons. Column types already determine the answer, and
deciding in Python is what lets the rules be unit tested with no key, no network
and no database.

| The shape of the result | Drawn as |
| ----------------------- | -------- |
| No rows, or no numeric column to measure | Table |
| One row, up to four numbers, no label column | A figure card per number |
| Label + one measure, label is a date or an ascending year, up to 6 points | Columns |
| Label + one measure, label is a date or an ascending year, more than 6 points | Line |
| Label + one measure, categorical label, up to 30 rows | Bars |
| As above, up to 8 rows, summable values, and the question asks about a share, a breakdown or a distribution | Donut |
| More than 30 rows, three or more numeric columns, or each row is a record rather than one label | Table |

Four rules do most of the work of keeping a chart honest:

- An `id` column is never a measurement, and a four-digit `year` is a position
  on an axis rather than a quantity.
- A time axis has to already be in time order. "The three biggest years" is
  sorted by amount, and drawing a line through it would show a sequence that is
  not there - so it becomes a ranking instead. The rows are never re-sorted,
  because that would contradict the `ORDER BY` the question asked for.
- A donut is only offered when the values add up to something. An average or a
  rate never gets one, whatever the wording.
- When several text columns come back, each row is a record rather than one
  labelled value - "the five highest paid employees, with their department" -
  and the table keeps every column instead of a chart dropping three of them.

Naming a chart in the question works when the result supports it: "as a pie
chart", "over time", "as a table". When it does not, the request is neither
obeyed nor silently dropped - the card says a pie was asked for and why there is
none. Every card also carries buttons for the types its result genuinely
supports, and a **Measure** picker when more than one numeric column came back.
Types that would misread the data are absent rather than disabled.

Charts still add no dependency. `LineChart` and `DonutChart` join the existing
CSS bars and columns; the line is an SVG stretched over the plot box with a
non-scaling stroke, and the donut is `stroke-dasharray` on a circle. The donut
is the one chart that needs more than one colour, because a slice has no length
to compare - it uses a single-hue ramp handed out largest slice first, so
lightness and ordering say the same thing, and the legend prints the value and
the share beside every label.

**Saved reports live in the browser**, in `localStorage`. Saving to the database
would mean the first migration, the first `POST` that writes, a role that can do
more than `SELECT`, and a decision about who may edit whose report - a lot to
take on for a convenience one reader gets the whole value of. The cost is said
plainly on screen: a saved report is not shared.

What is stored is the definition, never the data: the question, the SQL, the
chosen chart type and measure. Reopening a report runs each card's SQL again
through `/api/reports/run`, so the figures are today's, no model is called, and
nothing is billed. If a refreshed result no longer supports the chart type that
was saved with it, the card falls back to what the new result reads as.

## Natural language questions

A question typed in English, answered with rows, a chart and a sentence
describing them. Two screens use the same endpoint: the **assistant** at the
bottom of the dashboard, which keeps the questions asked so far on screen, and
the **Dynamic** report (`/reports/ask`), where answers are kept as the cards of a
report.

Six steps, in `backend/`:

| Step | File | What it does |
| ---- | ---- | ------------ |
| 1 | `reports/schema_context.py` | Describes the live schema - tables, columns, how they join, and the actual values in short text columns such as `status` - as the text a model reads before writing SQL |
| 2 | `reports/ask.py` -> `generate_sql()` | Question + schema -> SQL, through `llm/client.py` |
| 3 | `reports/sql_guard.py` | Accepts or refuses the SQL. Only a single SELECT or WITH; writes, second statements and file-reading functions are named and rejected; a missing `LIMIT` is added |
| 4 | `db.readonly_cursor()` | Runs it as a role holding `SELECT` and nothing else, with `statement_timeout` set |
| 5 | `reports/chart_spec.py` | Reads the shape of the result and names the chart it should be drawn as |
| 6 | `reports/ask.py` -> `summarize_rows()` | The rows that came back -> one to three sentences |

Steps 3 and 4 are deliberately independent. The guard runs in Python and can be
argued with in principle; the role is enforced by PostgreSQL and cannot. Neither
is enough alone - text filtering over SQL has been defeated many times, and a
privilege check has no opinion about a query that returns every row of a table.
Together they are why letting a model write SQL against this database is safe:
only step 2 trusts the model, and only for the text of a query.

The generated SQL is on screen with every answer - shown by the Dynamic report,
one click away in the assistant. The query is the only way for a reader to judge
whether the answer means what they asked, so hiding it would turn a checkable
number into a claim. The same reasoning puts the result table directly under the
sentence: the sentence is written by a model and can be wrong in a way the rows
cannot.

### Two model calls, failing differently

Writing the query and describing the result are separate requests, and they are
not equally important. A query that cannot be written means there is no answer
at all, and the endpoint says so. A summary that cannot be written costs the
reader a sentence: `summarize_rows` returns nothing, the rows and the SQL are
displayed as usual, and the screen says the summary is missing rather than
inventing one.

Two shortcuts keep the second call honest and cheap. An empty result is answered
from a constant instead of a request - a model cannot say "no rows" better than
that sentence does. A large result is capped at 50 rows, and the prompt is told
how many rows exist, so a partial list is never described as the whole answer.

### Where the model runs

Not on this machine. The first plan was to install and serve a model locally;
the project uses NVIDIA's free developer endpoint instead, so there is nothing
to download, no GPU to size and no extra service to keep running next to
PostgreSQL and Keycloak.

The endpoint is **OpenAI-compatible**: a POST to `/chat/completions` carrying a
`Bearer` key, which is small enough that no client package was added. Three
settings in `.env` describe it - `NVIDIA_API_KEY`, `NVIDIA_MODEL` and
`NVIDIA_BASE_URL`. The key is personal and that file is git-ignored.

`backend/llm/client.py` is the only code that makes the call. It reads the key,
retries while the endpoint is busy, and raises a named exception for each way a
call can fail, so the API layer never has to read an HTTP body:

| Exception | What happened | Status the API returns |
| --------- | ------------- | ---------------------- |
| `LLMNotConfigured` | No key, a rejected key, or a model id the endpoint does not serve | 503 |
| `LLMRateLimited` | Still busy after retrying at 3, 8 and 20 seconds | 429 |
| `LLMTruncated` | The reply ran out of tokens mid-answer | 422 |
| `LLMUnavailable` | Unreachable, timed out, or an unreadable reply | 503 |

Two details about the model are worth knowing before changing the settings. It
reasons before answering and keeps that working out in a separate field, which
never reaches the SQL parser - but it is charged for and it is slow, so a
question costs a few seconds and a token budget that has to cover the thinking
as well as the answer. And the better known model names share a small free
capacity pool: `kimi-k3` refused every request across half a minute on the same
key that `nemotron-3-super-120b-a12b` answered in under a second.

### What the prompt insists on

Three rules in `SQL_PROMPT` exist because the model got these wrong without
them, and each failure was silent rather than loud:

- **`ILIKE` for a name the person typed.** With `=` it wrote
  `name = 'Radar Signal'` for a project stored as "Radar Signal Processing
  Upgrade": valid SQL, no error, no rows - which reads as an empty department
  rather than as a typo.
- **`LEFT JOIN` on a nullable column.** An inner join to `departments` silently
  drops every employee whose `department_id` is null.
- **One column per value.** It wrote `first_name || ' ' || last_name` as a
  single column, which is fine to read and impossible to sort or format.

A question the schema cannot answer is not forced into SQL. The model replies in
plain English, `extract_sql` recognises that there is no query in it, and the
person reads the model's own sentence - "the database does not contain a
customers table" - rather than a parser complaining that their query starts with
the word THE.

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
are executed and the rows compared, ignoring row order.

How much presentation is allowed to differ is a real choice, and the marks are
where it is made:

| Mark | Means |
| ---- | ----- |
| `PASS` | Same rows, same columns |
| `PASS*` | Same values, in a different column order |
| `PASS+` | Every expected value is there, alongside columns nobody asked for - a query that selects the id next to the name has answered the question |
| `FAIL` | A value is missing or wrong, the row count differs, the guard refused it, or it did not run |
| `SKIP` | The model never answered - busy, unreachable, out of tokens. Left out of the score entirely rather than counted as wrong SQL |

`SELECT *` does not slip through `PASS+`: the row count is checked first, so a
query returning every row of a table fails before its columns are looked at.
A run is only green when every case was answered and right - a skip is not a
pass, or a rate-limited run would look like a clean one.

Against the 20 questions the current model scores **20/20 usable, 13 of them
exact**, in about two minutes.

```powershell
.venv\Scripts\python.exe backend\reports\run_eval.py                    # harness self-test, must be 20/20
.venv\Scripts\python.exe backend\reports\run_eval.py --generator ask     # scores the model: ~2 minutes, 20 requests
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

110 tests, no database, no model and no Keycloak. The SQL guard, the extraction
of SQL from a model reply, the chart rules and the token claim rules are pure
functions, which is why they were written that way. The summarising step is
tested with the model replaced, and `run_query` with the cursor replaced: what
matters in both is when the call happens, what it is shown and what happens when
it fails, none of which needs a real one. Two tests check the route table
itself, so an endpoint added without the token check fails the suite.

The chart cases are written with the types the database actually returns -
`Decimal` amounts, `date` objects, integer years - because the rules read Python
types. A test built from strings and floats would pass while the real thing
chose a table for everything.

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

- **Follow-up questions.** The assistant answers each question on its own and
  sends nothing of the conversation back, so "and their salaries?" does not
  work. Multi-turn text-to-SQL is a substantially harder problem than the
  single-question case that works today.
- **Sharing a saved report.** Reports built on the Dynamic tab live in the browser
  that built them. Sharing one means a table, a write endpoint and a decision
  about who may edit whose report; printing is the answer for now.
- **Working without a network.** Both screens need the hosted endpoint. There
  is no offline fallback, which is a deliberate choice and worth revisiting if
  a demo has to run without internet.
- **LDAP** as an identity source.
- **Write operations.** Every endpoint is a GET; records are created and edited
  directly in the database.
- **Project detail screens**, which is where `project_employees` and
  `project_products` will be shown per program.
