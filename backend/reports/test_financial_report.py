"""Tests for how the Financial report decides a project is over budget.

No database: fetch_all is replaced, and the rows it hands back are shaped like
the report's project query. What is checked is plain Python over those rows -
which projects the summary counts as overspent - and that the project detail
panel reaches the same answer for the same project.

Run from the repository root:
    .venv\\Scripts\\python.exe -m pytest backend/reports/test_financial_report.py -q
"""

from decimal import Decimal

import pytest

from project_detail import financial_summary
from reports import queries
from reports.queries import financial_report, is_over_budget


def project(project_id, budget, invested):
    """A row as the report's project query returns it."""
    return {
        "id": project_id,
        "name": f"Project {project_id}",
        "status": "Active",
        "start_date": "2024-01-01",
        "end_date": "2026-12-31",
        "budget": budget,
        "invested": invested,
        "remaining": None if budget is None else budget - invested,
        "investment_count": 1 if invested else 0,
        "utilization": round(invested / budget * 100, 1) if budget else None,
    }


@pytest.fixture
def report_of(monkeypatch):
    """The whole report for a given list of project rows.

    The report asks fetch_all three times: projects, then the yearly trend,
    then the split by type. Only the first carries anything these tests read.
    """

    def use(projects):
        calls = []

        def fake_fetch_all(sql, params=None):
            calls.append(sql)
            return projects if len(calls) == 1 else []

        monkeypatch.setattr(queries, "fetch_all", fake_fetch_all)
        return financial_report()

    return use


@pytest.fixture
def summary_of(report_of):
    """Just the summary, for the tests that only ask what it counted."""

    def use(projects):
        return report_of(projects)["summary"]

    return use


def test_a_missing_budget_with_investments_is_not_over_budget(summary_of):
    assert is_over_budget(None, 5000.0) is False
    assert summary_of([project(1, None, 5000.0)])["over_budget_count"] == 0


def test_a_zero_budget_with_investments_is_over_budget(summary_of):
    assert is_over_budget(0.0, 250.0) is True
    assert summary_of([project(1, 0.0, 250.0)])["over_budget_count"] == 1


def test_a_zero_budget_with_nothing_invested_is_not_over_budget(summary_of):
    assert is_over_budget(0.0, 0.0) is False
    assert summary_of([project(1, 0.0, 0.0)])["over_budget_count"] == 0


def test_a_positive_budget_is_over_only_once_spending_passes_it(summary_of):
    assert is_over_budget(100.0, 120.0) is True
    assert is_over_budget(100.0, 100.0) is False
    assert summary_of([project(1, 100.0, 120.0)])["over_budget_count"] == 1
    assert summary_of([project(1, 100.0, 100.0)])["over_budget_count"] == 0


def test_the_summary_counts_each_case_by_the_same_rule(summary_of):
    rows = [
        project(1, None, 5000.0),  # unknown budget: not counted
        project(2, 0.0, 250.0),  # zero budget, spent: counted
        project(3, 100.0, 120.0),  # overspent: counted
        project(4, 100.0, 60.0),  # within budget: not counted
    ]
    assert summary_of(rows)["over_budget_count"] == 2


def test_every_row_carries_the_verdict_the_summary_counted(report_of):
    # The table's "Over budget" note reads this field. It used to be worked out
    # again in the browser from utilization, which is a different rule.
    rows = [
        project(1, None, 5000.0),  # unknown budget: not over
        project(2, 0.0, 250.0),  # zero budget, spent: over
        project(3, 100.0, 120.0),  # overspent: over
        project(4, 100.0, 60.0),  # within budget: not over
    ]
    report = report_of(rows)

    assert [row["over_budget"] for row in report["projects"]] == [
        False,
        True,
        True,
        False,
    ]
    assert report["summary"]["over_budget_count"] == 2


def test_a_zero_budget_row_is_flagged_although_it_has_no_utilization(report_of):
    # The case the two rules disagreed on, and the reason the field exists: the
    # tile counted this project while its own row showed a dash and no note.
    row = report_of([project(1, 0.0, 250.0)])["projects"][0]

    assert row["utilization"] is None
    assert row["over_budget"] is True


@pytest.mark.parametrize(
    "budget, invested",
    [
        (None, "5000.00"),
        ("0.00", "250.00"),
        ("0.00", "0.00"),
        ("100.00", "120.00"),
        ("100.00", "100.00"),
    ],
)
def test_the_project_detail_panel_agrees_with_the_report(budget, invested):
    exact_budget = None if budget is None else Decimal(budget)
    detail = financial_summary(exact_budget, [Decimal(invested)])
    report = is_over_budget(
        None if budget is None else float(budget), float(invested)
    )
    assert detail["over_budget"] is report
