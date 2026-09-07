"""Single place that knows how to reach the local PostgreSQL server.

Connection details come from the repository root .env file so the backend and
database/run_seeds.ps1 can share the same PG* values. Connections are opened
per request: the dashboard is read-only and low traffic, so a pool would only
add moving parts.
"""

import os
from contextlib import contextmanager
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def connection_string():
    """DATABASE_URL wins; otherwise the standard libpq variables are used."""
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    return make_conninfo(
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
        dbname=os.getenv("PGDATABASE", "savunma_db"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD"),
    )


@contextmanager
def cursor():
    with psycopg.connect(connection_string(), connect_timeout=5) as connection:
        with connection.cursor(row_factory=dict_row) as cur:
            yield cur


def fetch_all(sql, params=None):
    with cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def fetch_one(sql, params=None):
    with cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


# ---------------------------------------------------------------------------
# Untrusted SQL
#
# Everything above runs as the application role and is only ever handed SQL
# written in this repository. Generated SQL - anything a language model wrote -
# goes through the pair below instead, which connects as a role that holds
# SELECT and nothing else. The separation is physical on purpose: a reviewer
# can tell which queries are trusted by looking at the function name.
#
# The role also carries statement_timeout and default_transaction_read_only, so
# a runaway or writing query is stopped by the server rather than by a check in
# application code.
# ---------------------------------------------------------------------------


def readonly_connection_string():
    """Credentials for the SELECT-only role (see .env.example)."""
    url = os.getenv("DATABASE_URL_READONLY")
    if url:
        return url
    return make_conninfo(
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
        dbname=os.getenv("PGDATABASE", "savunma_db"),
        user=os.getenv("PG_READONLY_USER", "sqlai_readonly"),
        password=os.getenv("PG_READONLY_PASSWORD"),
    )


@contextmanager
def readonly_cursor():
    with psycopg.connect(
        readonly_connection_string(), connect_timeout=5
    ) as connection:
        with connection.cursor(row_factory=dict_row) as cur:
            yield cur


def fetch_all_readonly(sql, params=None):
    """Runs SQL this codebase did not write. The role cannot modify anything."""
    with readonly_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()
