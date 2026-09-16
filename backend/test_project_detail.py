"""Tests for the project detail endpoint.

No database: the four queries run against a cursor that hands back fixed rows,
which is enough to check what matters here - that the id travels as a
parameter, that the totals come from the rows rather than from a join that
repeats them, that the budget figures follow the Financial report's rules, and
that nothing about salary is read or returned.

Amounts are Decimal and dates are ISO strings, because that is what the
database returns for these columns and the queries cast them to.

Run from the repository root:
    .venv\\Scripts\\python.exe -m pytest backend/test_project_detail.py -q
"""

from contextlib import contextmanager
from decimal import Decimal

import pytest
from fastapi import HTTPException

import project_detail
from project_detail import financial_summary, read_project

PROJECT = {
    "id": 3004,
    "name": "Radar Signal Processing Upgrade",
    "description": "Signal chain replacement for the coastal radar network.",
    "status": "Completed",
    "start_date": "2021-03-01",
    "end_date": "2023-06-30",
    "budget": Decimal("68000000.00"),
}

TEAM = [
    {
        "employee_id": 12,
        "first_name": "Ayse",
        "last_name": "Kaya",
        "email": "ayse.kaya@example.com",
        "job_title": "Systems Engineer",
        "department_name": "Research and Development",
        "role_in_project": "Lead Engineer",
    },
    {
        "employee_id": 31,
        "first_name": "Mert",
        "last_name": "Yildiz",
        "email": "mert.yildiz@example.com",
        "job_title": "Test Engineer",
        "department_name": None,
        "role_in_project": "Verification",
    },
]

PRODUCTS = [
    {
        "product_id": 7,
        "name": "X-band Antenna",
        "category": "Sensors",
        "quantity": 4,
        "unit_cost": Decimal("1250000.50"),
    },
    {
        "product_id": 9,
        "name": "Signal Processor",
        "category": "Electronics",
        "quantity": 10,
        "unit_cost": Decimal("310000.00"),
    },
]

INVESTMENTS = [
    {
        "investment_id": 41,
        "investment_type": "Equipment",
        "amount": Decimal("30000000.00"),
        "investment_date": "2023-02-10",
    },
    {
        "investment_id": 40,
        "investment_type": "Research",
        "amount": Decimal("40000000.00"),
        "investment_date": "2022-01-15",
    },
]


@pytest.fixture
def database(monkeypatch):
    """Replaces the connection with one that answers each query from `rows`.

    Returns the rows, so a test can empty a relation or remove the project, and
    the list of (sql, params) the endpoint ran.
    """
    rows = {
        "project": dict(PROJECT),
        "team": [dict(row) for row in TEAM],
        "products": [dict(row) for row in PRODUCTS],
        "investments": [dict(row) for row in INVESTMENTS],
    }
    ran = []

    @contextmanager
    def fake_cursor():
        class Cursor:
            last = ""

            def execute(self, sql, params=None):
                ran.append((sql, params))
                self.last = sql

            def fetchone(self):
                return rows["project"]

            def fetchall(self):
                if "project_employees" in self.last:
                    return rows["team"]
                if "project_products" in self.last:
                    return rows["products"]
                if "FROM investments" in self.last:
                    return rows["investments"]
                raise AssertionError(f"unexpected query: {self.last}")

        yield Cursor()

    monkeypatch.setattr(project_detail, "cursor", fake_cursor)
    return rows, ran


def query_for(ran, table):
    return next(sql for sql, _ in ran if table in sql)


# --------------------------------------------------------------------------
# The project and its relations
# --------------------------------------------------------------------------


def test_an_existing_project_comes_back_with_its_own_fields(database):
    detail = read_project(3004)
    assert detail["project"] == {
        "id": 3004,
        "name": "Radar Signal Processing Upgrade",
        "description": "Signal chain replacement for the coastal radar network.",
        "status": "Completed",
        "start_date": "2021-03-01",
        "end_date": "2023-06-30",
        "budget": 68000000.0,
    }


def test_the_id_travels_as_a_parameter_on_every_query(database):
    _, ran = database
    read_project(3004)

    assert len(ran) == 4
    for sql, params in ran:
        assert params == (3004,)
        assert "%s" in sql
        assert "3004" not in sql


def test_every_query_only_reads(database):
    _, ran = database
    read_project(3004)
    assert all(sql.strip().upper().startswith("SELECT") for sql, _ in ran)


def test_the_team_is_read_through_project_employees(database):
    _, ran = database
    detail = read_project(3004)

    assert "FROM project_employees" in query_for(ran, "project_employees")
    assert detail["team"] == TEAM


def test_a_product_line_is_its_quantity_times_its_unit_cost(database):
    detail = read_project(3004)
    antenna, processor = detail["products"]

    assert antenna["quantity"] == 4
    assert antenna["unit_cost"] == 1250000.5
    assert antenna["line_total"] == 5000002.0
    assert processor["line_total"] == 3100000.0


def test_a_product_without_a_unit_cost_has_no_line_total(database):
    rows, _ = database
    rows["products"][0]["unit_cost"] = None
    assert read_project(3004)["products"][0]["line_total"] is None


def test_counts_are_taken_from_the_rows(database):
    assert read_project(3004)["counts"] == {
        "team_members": 2,
        "products": 2,
        "product_units": 14,
        "investments": 2,
    }


def test_investments_are_read_newest_first(database):
    _, ran = database
    detail = read_project(3004)

    assert "ORDER BY investment_date DESC NULLS LAST" in query_for(ran, "FROM investments")
    # The response keeps the order the database returned.
    assert [row["investment_id"] for row in detail["investments"]] == [41, 40]
    assert detail["investments"][0] == {
        "investment_id": 41,
        "investment_type": "Equipment",
        "amount": 30000000.0,
        "investment_date": "2023-02-10",
    }


def test_a_project_with_nothing_recorded_is_still_a_project(database):
    rows, _ = database
    rows["team"], rows["products"], rows["investments"] = [], [], []
    detail = read_project(3004)

    assert detail["team"] == []
    assert detail["products"] == []
    assert detail["investments"] == []
    assert detail["counts"] == {
        "team_members": 0,
        "products": 0,
        "product_units": 0,
        "investments": 0,
    }
    assert detail["financial_summary"]["total_invested"] == 0.0
    assert detail["financial_summary"]["utilization"] == 0.0


def test_an_unknown_project_reads_nothing_else(database):
    rows, ran = database
    rows["project"] = None
    assert read_project(999) is None
    assert len(ran) == 1


def test_an_unknown_project_is_a_404(database):
    import main

    rows, _ = database
    rows["project"] = None
    with pytest.raises(HTTPException) as raised:
        main.get_project(999)

    assert raised.value.status_code == 404
    assert "999" in raised.value.detail


def test_salary_is_neither_read_nor_returned(database):
    rows, ran = database
    # Even if a later query selected it, the response is built from a fixed
    # list of fields.
    rows["team"][0]["salary"] = Decimal("98000.00")
    detail = read_project(3004)

    assert all("salary" not in sql.lower() for sql, _ in ran)

    def keys(value):
        if isinstance(value, dict):
            for key, child in value.items():
                yield key
                yield from keys(child)
        elif isinstance(value, list):
            for child in value:
                yield from keys(child)

    assert not any("salary" in key for key in keys(detail))


def test_a_request_without_a_token_is_refused_before_anything_is_read(database):
    # That the route carries the token check is test_auth.py's job. This checks
    # the consequence for this endpoint: the refusal comes before the database
    # is asked anything. The application is called the way the ASGI server
    # calls it, without adding an HTTP client to the dependencies for it.
    import asyncio

    import main

    _, ran = database
    sent = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent.append(message)

    path = "/api/projects/3004"
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [],
        "client": ("127.0.0.1", 50000),
        "server": ("127.0.0.1", 8000),
    }
    asyncio.run(main.app(scope, receive, send))

    start = next(message for message in sent if message["type"] == "http.response.start")
    assert start["status"] == 401
    assert ran == []


# --------------------------------------------------------------------------
# Budget position
# --------------------------------------------------------------------------


def test_the_financial_totals_add_up(database):
    summary = read_project(3004)["financial_summary"]
    assert summary == {
        "budget": 68000000.0,
        "total_invested": 70000000.0,
        "remaining": -2000000.0,
        "utilization": 102.9,
        "investment_count": 2,
        "over_budget": True,
    }


def test_a_project_within_its_budget_is_not_over():
    summary = financial_summary(Decimal("100.00"), [Decimal("60.00")])
    assert summary["remaining"] == 40.0
    assert summary["utilization"] == 60.0
    assert summary["over_budget"] is False


def test_spending_exactly_the_budget_is_not_over():
    summary = financial_summary(Decimal("100.00"), [Decimal("40.00"), Decimal("60.00")])
    assert summary["remaining"] == 0.0
    assert summary["utilization"] == 100.0
    assert summary["over_budget"] is False


def test_cents_are_not_lost_to_floating_point():
    # 0.1 + 0.1 + 0.1 is 0.30000000000000004 in floats, which is over 0.30.
    summary = financial_summary(Decimal("0.30"), [Decimal("0.10")] * 3)
    assert summary["remaining"] == 0.0
    assert summary["over_budget"] is False


def test_utilization_rounds_half_away_from_zero_like_postgres():
    # 49 / 400 * 100 is exactly 12.25. PostgreSQL's ROUND gives 12.3; Python's
    # round() would give 12.2 and disagree with the Financial report.
    assert financial_summary(Decimal("400"), [Decimal("49")])["utilization"] == 12.3


def test_a_missing_budget_with_nothing_invested_has_no_figures():
    assert financial_summary(None, []) == {
        "budget": None,
        "total_invested": 0.0,
        "remaining": None,
        "utilization": None,
        "investment_count": 0,
        "over_budget": False,
    }


def test_a_missing_budget_is_unknown_and_never_over_budget():
    # Not recorded is not zero: money spent against a budget nobody wrote down
    # is not evidence of an overspend.
    assert financial_summary(None, [Decimal("5000.00")]) == {
        "budget": None,
        "total_invested": 5000.0,
        "remaining": None,
        "utilization": None,
        "investment_count": 1,
        "over_budget": False,
    }


def test_a_project_without_a_budget_reads_as_unknown_end_to_end(database):
    rows, _ = database
    rows["project"]["budget"] = None
    detail = read_project(3004)

    assert detail["project"]["budget"] is None
    assert detail["financial_summary"] == {
        "budget": None,
        "total_invested": 70000000.0,
        "remaining": None,
        "utilization": None,
        "investment_count": 2,
        "over_budget": False,
    }


def test_a_zero_budget_with_nothing_invested_is_not_over():
    assert financial_summary(Decimal("0.00"), []) == {
        "budget": 0.0,
        "total_invested": 0.0,
        "remaining": 0.0,
        "utilization": None,
        "investment_count": 0,
        "over_budget": False,
    }


def test_anything_invested_against_a_zero_budget_is_over():
    # Zero is a real budget: the remaining goes negative, and there is still no
    # percentage of it to show.
    assert financial_summary(Decimal("0.00"), [Decimal("250.00")]) == {
        "budget": 0.0,
        "total_invested": 250.0,
        "remaining": -250.0,
        "utilization": None,
        "investment_count": 1,
        "over_budget": True,
    }
