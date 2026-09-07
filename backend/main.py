"""Read-only REST API over the management database.

The dashboard only lists records for now, so every endpoint is a GET. Keycloak
token validation is a later stage; on the development machine the endpoints are
open. Numeric and date columns are cast in SQL so the JSON payload matches what
the frontend already expects: plain numbers and ISO (YYYY-MM-DD) date strings.
"""

import os

import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from db import fetch_all, fetch_one
from labels import ACTIVE_STATUS, to_english, translate_rows
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
    allow_methods=["GET"],
    allow_headers=["*"],
)


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


@app.get("/api/departments")
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
    return translate_rows(rows, ["name", "description"])


@app.get("/api/employees")
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
    return translate_rows(rows, ["job_title", "department_name"])


@app.get("/api/projects")
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
    return translate_rows(rows, ["name", "description", "status"])


@app.get("/api/products")
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
    return translate_rows(rows, ["name", "category", "description"])


@app.get("/api/investments")
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
    return translate_rows(rows, ["project_name", "investment_type"])


@app.get("/api/dashboard")
def dashboard():
    totals = fetch_one(
        """
        SELECT (SELECT COUNT(*) FROM projects)::int    AS total_projects,
               (SELECT COUNT(*) FROM employees)::int   AS total_employees,
               (SELECT COUNT(*) FROM departments)::int AS total_departments,
               (SELECT COUNT(*) FROM products)::int    AS total_products,
               (SELECT COALESCE(SUM(amount), 0) FROM investments)::float8 AS total_investment_amount,
               (SELECT COALESCE(SUM(budget), 0) FROM projects)::float8    AS total_project_budget
        """
    )
    # Statuses are stored in Turkish, so they are normalised before counting
    # instead of comparing against a hard-coded value inside the SQL.
    status_counts = fetch_all(
        "SELECT status, COUNT(*)::int AS count FROM projects GROUP BY status"
    )
    totals["active_projects"] = sum(
        row["count"]
        for row in status_counts
        if to_english(row["status"]) == ACTIVE_STATUS
    )
    return totals


@app.get("/api/schema-audit")
def schema_audit():
    """Structural review of the live schema, with suggested DDL per finding.

    Read-only: the audit reads pg_catalog and returns statements as text. It
    never runs them - applying a suggestion stays a human decision.
    """
    return run_audit()


@app.get("/api/schema-audit/rules")
def schema_audit_rules():
    """The rule catalog, so the UI can explain what was checked."""
    return rule_catalog()
