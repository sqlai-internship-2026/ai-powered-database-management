"""Tests for the rules that pick a chart for a result set.

Every case here is a shape the generated SQL actually produces, written as the
database returns it: Decimal amounts, date objects, integer years. That matters
because the rules read Python types, and a test built from strings and floats
would pass while the real thing chose a table for everything.

Run from the repository root:
    .venv\\Scripts\\python.exe -m pytest backend/reports/test_chart_spec.py -q
"""

from datetime import date
from decimal import Decimal

from reports.chart_spec import (
    MAX_CHART_ROWS,
    MAX_COLUMN_POINTS,
    MAX_DONUT_SLICES,
    choose_chart,
    column_kind,
    requested_type,
    value_format,
)


def spec(question, rows, columns=None):
    """choose_chart over rows given as dicts, columns taken from the first."""
    columns = columns if columns is not None else list(rows[0]) if rows else []
    return choose_chart(question, columns, rows)


# --------------------------------------------------------------------------
# Nothing to draw
# --------------------------------------------------------------------------


def test_no_rows_is_a_table():
    assert choose_chart("Which projects are on hold?", ["name"], [])["type"] == "table"


def test_no_columns_is_a_table():
    assert choose_chart("Anything?", [], [])["type"] == "table"


def test_a_result_without_numbers_is_a_table():
    rows = [{"name": "Esra Gunes", "job_title": "Senior Project Manager"}]
    assert spec("Who runs that project?", rows)["type"] == "table"


def test_an_id_is_not_a_measurement():
    # Every SELECT tends to carry one, and a bar chart of primary keys is the
    # most confidently wrong chart this module could draw.
    rows = [{"id": 3, "name": "Radar"}, {"id": 4, "name": "Sonar"}]
    chosen = spec("List the projects.", rows)
    assert chosen["type"] == "table"
    assert chosen["value_columns"] == []


def test_a_column_of_nulls_measures_nothing():
    rows = [{"name": "Radar", "budget": None}, {"name": "Sonar", "budget": None}]
    assert spec("Budget per program?", rows)["type"] == "table"


# --------------------------------------------------------------------------
# A single figure
# --------------------------------------------------------------------------


def test_one_row_one_number_is_a_figure():
    chosen = spec("How many employees are there?", [{"count": 60}])
    assert chosen["type"] == "kpi"
    assert chosen["value_column"] == "count"


def test_one_row_of_several_numbers_is_still_figures():
    rows = [{"employees": 60, "projects": 12, "products": 30}]
    chosen = spec("How big is the company?", rows)
    assert chosen["type"] == "kpi"
    # All three travel, so the UI can draw one card each rather than hiding two.
    assert chosen["value_columns"] == ["employees", "projects", "products"]


def test_too_many_numbers_in_one_row_is_a_table():
    rows = [{"a_count": 1, "b_count": 2, "c_count": 3, "d_count": 4, "e_count": 5}]
    assert spec("Everything at once.", rows)["type"] == "table"


# --------------------------------------------------------------------------
# Time
# --------------------------------------------------------------------------


def years(count, start=2020):
    return [
        {"year": start + index, "amount": Decimal(1000 * (index + 1))}
        for index in range(count)
    ]


def test_a_few_periods_are_columns():
    chosen = spec("Investment per year.", years(MAX_COLUMN_POINTS))
    assert chosen["type"] == "column"
    assert chosen["label_column"] == "year"
    assert chosen["value_column"] == "amount"


def test_many_periods_are_a_line():
    assert spec("Investment per year.", years(MAX_COLUMN_POINTS + 1))["type"] == "line"


def test_a_date_column_is_a_time_axis():
    rows = [
        {"investment_date": date(2026, 1, 1), "amount": Decimal(10)},
        {"investment_date": date(2026, 2, 1), "amount": Decimal(20)},
    ]
    chosen = spec("Investment by date.", rows)
    assert chosen["label_column"] == "investment_date"
    assert chosen["type"] == "column"


def test_a_period_string_is_a_time_axis():
    # to_char(investment_date, 'YYYY-MM') comes back as text, not as a date.
    rows = [{"month": "2026-01", "amount": 10}, {"month": "2026-02", "amount": 20}]
    assert spec("Investment per month.", rows)["label_column"] == "month"


def test_years_out_of_order_are_names_rather_than_an_axis():
    # "The three biggest years" sorted by amount: the order is the answer, and
    # a line through it would draw a sequence that is not there.
    rows = [
        {"year": 2024, "amount": Decimal(900)},
        {"year": 2026, "amount": Decimal(500)},
        {"year": 2022, "amount": Decimal(100)},
    ]
    chosen = spec("The three biggest investment years.", rows)
    assert chosen["type"] == "bar"
    assert "line" not in chosen["alternatives"]


def test_a_year_is_not_charted_as_a_quantity():
    # 2026 is a point on an axis. Summing it would be meaningless, so it may
    # never end up in value_columns.
    assert "year" not in spec("Investment per year.", years(3))["value_columns"]


# --------------------------------------------------------------------------
# Names
# --------------------------------------------------------------------------


def departments(count):
    return [
        {"name": f"Department {index}", "headcount": index + 1}
        for index in range(count)
    ]


def test_a_ranking_is_a_bar():
    chosen = spec("How many employees does each department have?", departments(6))
    assert chosen["type"] == "bar"
    assert chosen["formats"]["headcount"] == "count"


def test_a_repeated_label_falls_back_to_the_table():
    # One mark per row is the whole premise; two rows sharing a label would
    # draw one bar and drop the other.
    rows = [
        {"department": "Engineering", "salary": 100},
        {"department": "Engineering", "salary": 200},
    ]
    assert spec("Salaries by department.", rows)["type"] == "table"


def test_a_crowded_result_is_a_table_with_the_chart_still_offered():
    chosen = spec("Headcount per department.", departments(MAX_CHART_ROWS + 1))
    assert chosen["type"] == "table"
    assert "bar" in chosen["alternatives"]


def test_three_measures_default_to_the_table():
    rows = [
        {"name": "Engineering", "headcount": 10, "payroll": 100, "average_salary": 10},
        {"name": "Testing", "headcount": 5, "payroll": 40, "average_salary": 8},
    ]
    chosen = spec("Departments with their payroll.", rows)
    assert chosen["type"] == "table"
    # Still switchable: the reader picks which of the three to draw.
    assert "bar" in chosen["alternatives"]
    assert chosen["value_columns"] == ["headcount", "payroll", "average_salary"]


def test_a_row_that_is_a_record_stays_a_table():
    # "The five highest paid employees, with their department." Charting this
    # by first name alone drops the surname and the department, and would put
    # two people called Emre on the same bar.
    rows = [
        {"first_name": "Emre", "last_name": "Kaya", "department": "Avionics",
         "salary": Decimal(100)},
        {"first_name": "Esra", "last_name": "Gunes", "department": "Radar",
         "salary": Decimal(90)},
    ]
    chosen = spec("The highest paid employees, with their department.", rows)
    assert chosen["type"] == "table"
    assert "record" in chosen["reason"]
    assert "bar" in chosen["alternatives"]


def test_one_spare_text_column_becomes_a_hint():
    # Here the extra column fits: the bar is the program, and its status rides
    # along underneath rather than being dropped.
    rows = [
        {"name": "Radar", "status": "Active", "budget": Decimal(100)},
        {"name": "Sonar", "status": "On Hold", "budget": Decimal(90)},
    ]
    chosen = spec("Budget per program.", rows)
    assert chosen["type"] == "bar"
    assert chosen["label_column"] == "name"
    assert chosen["hint_column"] == "status"


def test_long_labels_do_not_offer_a_column_chart():
    # The column chart writes its labels under the plot, where a program name
    # does not fit.
    rows = [
        {"name": "Radar Signal Processing Upgrade", "budget": 10},
        {"name": "Tactical Communications Modernisation", "budget": 20},
    ]
    assert "column" not in spec("Budget per program.", rows)["alternatives"]


def test_short_labels_offer_a_column_chart():
    rows = [{"status": "Active", "count": 4}, {"status": "On Hold", "count": 2}]
    assert "column" in spec("Projects per status.", rows)["alternatives"]


# --------------------------------------------------------------------------
# Shares of a total
# --------------------------------------------------------------------------


def test_a_breakdown_question_gets_a_donut():
    rows = [
        {"investment_type": "R&D Fund", "amount": Decimal(300)},
        {"investment_type": "Equipment", "amount": Decimal(200)},
    ]
    assert spec("The breakdown of investment by type.", rows)["type"] == "donut"


def test_the_same_rows_without_the_wording_are_a_bar():
    rows = [
        {"investment_type": "R&D Fund", "amount": Decimal(300)},
        {"investment_type": "Equipment", "amount": Decimal(200)},
    ]
    chosen = spec("Total investment amount per type, largest first.", rows)
    assert chosen["type"] == "bar"
    # Offered, just not chosen: a ranking is a ranking until somebody says share.
    assert "donut" in chosen["alternatives"]


def test_an_average_has_no_share_of_a_total():
    rows = [
        {"name": "Engineering", "average_salary": Decimal(100)},
        {"name": "Testing", "average_salary": Decimal(80)},
    ]
    chosen = spec("The distribution of average salary by department.", rows)
    assert "donut" not in chosen["alternatives"]
    assert chosen["type"] == "bar"


def test_too_many_slices_is_not_a_donut():
    chosen = spec("The distribution of headcount.", departments(MAX_DONUT_SLICES + 1))
    assert "donut" not in chosen["alternatives"]


def test_a_negative_value_is_not_a_slice_of_anything():
    rows = [{"name": "A", "amount": Decimal(-5)}, {"name": "B", "amount": Decimal(10)}]
    assert "donut" not in spec("The split of amount by name.", rows)["alternatives"]


# --------------------------------------------------------------------------
# What the question asked for
# --------------------------------------------------------------------------


def test_a_pie_is_drawn_when_the_shape_allows_one():
    rows = [
        {"status": "Active", "count": 4},
        {"status": "On Hold", "count": 2},
    ]
    chosen = spec("Show projects per status as a pie chart.", rows)
    assert chosen["type"] == "donut"
    assert "as the question asked" in chosen["reason"]


def test_a_pie_that_cannot_be_drawn_is_explained_rather_than_faked():
    chosen = spec("Show headcount per department as a pie chart.", departments(20))
    assert chosen["type"] != "donut"
    assert "pie" in chosen["reason"] or "donut" in chosen["reason"]


def test_over_time_asks_for_a_line():
    chosen = spec("Investment over time.", years(3))
    assert chosen["type"] == "line"


def test_asking_for_a_table_is_honoured():
    assert spec("Investment per year as a table.", years(3))["type"] == "table"


def test_a_question_without_chart_words_asks_for_nothing():
    assert requested_type("Which projects are on hold?") is None
    assert requested_type("The five highest paid employees.") is None


# --------------------------------------------------------------------------
# Column reading
# --------------------------------------------------------------------------


def test_the_table_is_always_reachable():
    for chosen in (
        spec("How many employees are there?", [{"count": 60}]),
        spec("Investment per year.", years(3)),
        spec("Headcount per department.", departments(4)),
    ):
        assert "table" in chosen["alternatives"]


def test_column_names_suggest_their_format():
    assert value_format("total_budget") == "currency"
    assert value_format("average_salary") == "currency"
    assert value_format("headcount") == "count"
    assert value_format("employee_count") == "count"
    assert value_format("budget_used_percent") == "percent"
    assert value_format("duration_months") == "number"


def test_counting_wins_over_currency_when_a_name_says_both():
    # investment_count is how many, not how much, and formatting it as money
    # would put a currency symbol in front of the number 11.
    assert value_format("investment_count") == "count"
    assert value_format("total_investment_amount") == "currency"


def test_only_numbers_get_a_number_format():
    # "investment_type" holds words like "R&D Fund". Guessing a format from the
    # name alone once read it as currency, and the browser would have formatted
    # a word as money.
    rows = [
        {"investment_type": "R&D Fund", "investment_date": date(2026, 1, 1),
         "amount": Decimal(300)},
        {"investment_type": "Equipment", "investment_date": date(2026, 2, 1),
         "amount": Decimal(200)},
    ]
    formats = spec("Investment by type.", rows)["formats"]
    assert formats["investment_type"] == "text"
    assert formats["investment_date"] == "date"
    assert formats["amount"] == "currency"


def test_a_flag_is_not_a_quantity():
    # True is an integer in Python, and a column of them would otherwise chart
    # as a row of bars all one unit high.
    assert column_kind("is_active", [True, False]) == "category"


def test_decimals_are_numbers():
    assert column_kind("amount", [Decimal("2865000000.00")]) == "numeric"
