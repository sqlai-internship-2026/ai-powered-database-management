"""Read-only REST API over the management database.

Nothing here writes: every endpoint reads, and the one POST carries a question
in its body rather than a change. Reading still takes a signed-in account -
every route below sits on a router that validates the Keycloak access token
first (see auth.py), with /api/health as the one deliberate exception.

Numeric and date columns are cast in SQL so the JSON payload matches what the
frontend already expects: plain numbers and ISO (YYYY-MM-DD) date strings.
"""

import os

import psycopg
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from auth import require_user
from db import fetch_all, fetch_one
from reports import (
    filter_options,
    financial_report,
    portfolio_report,
    workforce_report,
)
from llm import client
from reports.ask import (
    NoSQLReturned,
    answer_question,
    example_questions,
    run_query,
)
from reports.sql_guard import UnsafeQuery
from schema_audit.engine import rule_catalog, run_audit

app = FastAPI(title="SQL-AI API", version="0.1.0")

# The Vite dev server runs on a different port, so the browser needs CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ],
    # POST is only used by /api/reports/ask, which sends a question in the
    # body rather than in a query string.
    allow_methods=["GET", "POST"],
    # "*" covers Authorization as well, which every call now carries.
    allow_headers=["*"],
)

# Everything that reads a row hangs off this router, so the token check is
# declared once instead of on fourteen endpoints. /api/health stays on the app
# itself: it answers whether the service and the database are up, which is the
# first thing to check when signing in is what is failing.
api = APIRouter(dependencies=[Depends(require_user)])


async def database_error(request, exc):
    """Turns a dead or misconfigured database into a readable 503."""
    return JSONResponse(
        status_code=503,
        content={"detail": f"Database is not reachable: {exc}".strip()},
    )


app.add_exception_handler(psycopg.Error, database_error)


@app.get("/api/health")
def health():
    fetch_one("SELECT 1 AS ok")
    return {"status": "ok", "database": "connected"}


@api.get("/api/departments")
def list_departments():
    rows = fetch_all(
        """
        SELECT d.id,
               d.name,
               d.description,
               COUNT(e.id)::int AS employee_count
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id
        GROUP BY d.id, d.name, d.description
        ORDER BY d.id
        """
    )
    return rows


@api.get("/api/employees")
def list_employees():
    rows = fetch_all(
        """
        SELECT e.id,
               e.first_name,
               e.last_name,
               e.email,
               e.job_title,
               e.department_id,
               d.name             AS department_name,
               e.hire_date::text  AS hire_date,
               e.salary::float8   AS salary
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        ORDER BY e.id
        """
    )
    return rows


@api.get("/api/projects")
def list_projects():
    rows = fetch_all(
        """
        SELECT id,
               name,
               description,
               start_date::text AS start_date,
               end_date::text   AS end_date,
               budget::float8   AS budget,
               status
        FROM projects
        ORDER BY id
        """
    )
    return rows


@api.get("/api/products")
def list_products():
    rows = fetch_all(
        """
        SELECT id,
               name,
               category,
               description,
               unit_cost::float8 AS unit_cost
        FROM products
        ORDER BY id
        """
    )
    return rows


@api.get("/api/investments")
def list_investments():
    rows = fetch_all(
        """
        SELECT i.id,
               i.project_id,
               p.name                  AS project_name,
               i.investment_type,
               i.amount::float8        AS amount,
               i.investment_date::text AS investment_date
        FROM investments i
        LEFT JOIN projects p ON p.id = i.project_id
        ORDER BY i.id
        """
    )
    return rows


@api.get("/api/dashboard")
def dashboard():
    totals = fetch_one(
        """
        SELECT (SELECT COUNT(*) FROM projects)::int    AS total_projects,
               (SELECT COUNT(*) FROM employees)::int   AS total_employees,
               (SELECT COUNT(*) FROM departments)::int AS total_departments,
               (SELECT COUNT(*) FROM products)::int    AS total_products,
               (SELECT COALESCE(SUM(amount), 0) FROM investments)::float8 AS total_investment_amount,
               (SELECT COALESCE(SUM(budget), 0) FROM projects)::float8    AS total_project_budget,
               (SELECT COUNT(*) FROM projects WHERE status = 'Active')::int AS active_projects
        """
    )
    return totals


def _status_list(status):
    """Turns the repeatable ?status= query parameter into a clean list.

    FastAPI hands over None when the parameter is absent, which the report
    functions read as "no status filter".
    """
    if not status:
        return None
    values = [value.strip() for value in status.split(",") if value.strip()]
    return values or None


@api.get("/api/reports/filters")
def report_filters():
    """Statuses, the investment year range and departments, from live data."""
    return filter_options()


@api.get("/api/reports/financial")
def report_financial(
    year_from: int | None = None,
    year_to: int | None = None,
    status: str | None = None,
):
    """Budget against committed investment, per project and per year."""
    return financial_report(
        year_from=year_from,
        year_to=year_to,
        statuses=_status_list(status),
    )


@api.get("/api/reports/workforce")
def report_workforce(department_id: int | None = None):
    """Headcount, payroll and program allocation."""
    return workforce_report(department_id=department_id)


@api.get("/api/reports/portfolio")
def report_portfolio(status: str | None = None):
    """Schedule position and hardware consumption per program."""
    return portfolio_report(statuses=_status_list(status))


@api.get("/api/schema-audit")
def schema_audit():
    """Structural review of the live schema, with suggested DDL per finding.

    Read-only: the audit reads pg_catalog and returns statements as text. It
    never runs them - applying a suggestion stays a human decision.
    """
    return run_audit()


@api.get("/api/schema-audit/rules")
def schema_audit_rules():
    """The rule catalog, so the UI can explain what was checked."""
    return rule_catalog()


# ---------------------------------------------------------------------------
# Natural language reporting
#
# The question is generated into SQL, checked, and run as a role that holds
# SELECT and nothing else. Three things can go wrong before any row is read -
# no query was produced, the query was refused, the query did not run - and
# each returns the sentence explaining which, because the user is looking at
# their own question and needs to know whether to rephrase it.
# ---------------------------------------------------------------------------


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)


class RunRequest(BaseModel):
    """SQL a browser saved earlier, sent back to be run again.

    The question rides along because the chart rules read it for wording like
    "as a pie chart"; it is never sent to a model here, and an empty one only
    costs the card its default chart type.
    """

    sql: str = Field(min_length=1, max_length=5000)
    question: str = Field(default="", max_length=500)


@api.get("/api/reports/ask/examples")
def report_ask_examples():
    """Example questions to offer, and the model that will answer them.

    The model can answer far more than these; they exist so the box is not
    empty on arrival. Reading them needs no key, so the page still loads when
    the model does not.
    """
    return {"generator": client.model_name(), "questions": example_questions()}


def _answered(build):
    """Runs one step of the ask pipeline and gives each failure its own status.

    Shared by the two endpoints below because they fail in exactly the same
    ways: both hand untrusted SQL to the guard and to a role that can only
    read, and both would otherwise repeat this ladder verbatim. Only the model
    branches are specific to asking - a re-run never calls one, so those simply
    never fire there.
    """
    try:
        return build()
    except NoSQLReturned as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except UnsafeQuery as exc:
        raise HTTPException(
            status_code=422, detail=f"The generated query was refused. {exc}"
        )
    except client.LLMRateLimited as exc:
        # The one the free tier produces. 429 rather than 503 because the
        # answer is to wait, not to call somebody: a browser and a person read
        # it the same way.
        raise HTTPException(status_code=429, detail=str(exc))
    except client.LLMTruncated as exc:
        # The model was answering and ran out of room. Nothing is wrong with
        # the service, so this is not a 503; a shorter question usually works.
        raise HTTPException(status_code=422, detail=str(exc))
    except client.LLMNotConfigured as exc:
        # A missing or rejected key, or a model id that does not exist. The
        # message names the .env line to fix, and no question will work until
        # somebody does.
        raise HTTPException(status_code=503, detail=str(exc))
    except client.LLMError as exc:
        # LLMUnavailable and anything added later. 503 is the honest answer:
        # the service this endpoint depends on is not answering, and the
        # question was never the problem.
        raise HTTPException(status_code=503, detail=str(exc))
    except psycopg.errors.QueryCanceled:
        # statement_timeout on the read-only role fired. The query was valid;
        # it was too expensive, and the fix is a narrower question.
        raise HTTPException(
            status_code=422,
            detail=(
                "The generated query took longer than the 5 second limit and "
                "was stopped. Try narrowing the question."
            ),
        )
    except psycopg.OperationalError:
        # The database itself is unreachable. Left to the handler above, which
        # answers 503 - blaming the user's question here would send them to
        # rewrite a question that was never the problem.
        #
        # This branch has to sit below QueryCanceled, which is a subclass of
        # OperationalError and would otherwise be swallowed by it.
        raise
    except psycopg.Error as exc:
        # A syntax error or an unknown column: the database is healthy and the
        # generated query is not. Caught here so it does not reach the handler
        # above, which would call a working database unreachable.
        first_line = str(exc).strip().splitlines()[0]
        raise HTTPException(
            status_code=422,
            detail=f"The generated query did not run: {first_line}",
        )


@api.post("/api/reports/ask")
def report_ask(request: AskRequest):
    """Answers a typed question with the rows its generated SQL returns."""
    return _answered(lambda: answer_question(request.question))


@api.post("/api/reports/run")
def report_run(request: RunRequest):
    """Runs SQL a saved report card is holding, without asking a model again.

    This is the one endpoint that takes SQL from the browser, so it is worth
    being explicit about why that is safe. It is the same SQL the model wrote
    when the card was built, and it meets exactly the same two defences on the
    way back in: validate_select accepts a single SELECT and nothing else, and
    the role it then runs as holds SELECT and nothing else, under a five second
    statement timeout. Neither defence trusts where the text came from, which
    is the whole point - a card saved last week is no more trusted than a
    sentence a model produced a moment ago.

    Re-running the SQL rather than the question is what makes a saved report a
    report: the same query every morning, no model call, no bill, and no chance
    of today's phrasing quietly changing yesterday's figures.
    """
    return _answered(lambda: run_query(request.sql, request.question))


# Registered last, so every route defined above is part of the router.
app.include_router(api)
