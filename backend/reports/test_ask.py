"""Tests for the parts of the ask pipeline that need neither model nor database.

Pulling SQL out of a model reply is the piece most likely to break quietly when
the stub is swapped for a real model, because every model wraps its answer
differently. These cases are the shapes that have to survive.

Run from the repository root:
    .venv\\Scripts\\python.exe -m pytest backend/reports/test_ask.py -q
"""

from datetime import date
from decimal import Decimal

import pytest

from reports.ask import (
    NoSQLReturned,
    _jsonable,
    extract_sql,
    generate_sql,
    stub_questions,
)


# --------------------------------------------------------------------------
# extract_sql
# --------------------------------------------------------------------------


def test_bare_sql_is_returned_unchanged():
    assert extract_sql("SELECT 1") == "SELECT 1"


def test_sql_fence_is_unwrapped():
    reply = "```sql\nSELECT name FROM projects\n```"
    assert extract_sql(reply) == "SELECT name FROM projects"


def test_plain_fence_is_unwrapped():
    assert extract_sql("```\nSELECT 1\n```") == "SELECT 1"


def test_prose_around_a_fence_is_dropped():
    reply = (
        "Here is the query you asked for:\n\n"
        "```sql\nSELECT COUNT(*) FROM employees\n```\n\n"
        "This returns a single row."
    )
    assert extract_sql(reply) == "SELECT COUNT(*) FROM employees"


def test_prose_before_unfenced_sql_is_dropped():
    reply = "Sure! The query is: SELECT name FROM projects"
    assert extract_sql(reply) == "SELECT name FROM projects"


def test_cte_is_recognised_as_a_start():
    reply = "Here you go:\nWITH totals AS (SELECT 1 AS n) SELECT n FROM totals"
    assert extract_sql(reply).startswith("WITH totals")


def test_first_fence_wins_when_there_are_two():
    reply = "```sql\nSELECT 1\n```\nand also\n```sql\nSELECT 2\n```"
    assert extract_sql(reply) == "SELECT 1"


def test_empty_reply_is_refused():
    with pytest.raises(NoSQLReturned):
        extract_sql("")


def test_whitespace_reply_is_refused():
    with pytest.raises(NoSQLReturned):
        extract_sql("   \n  ")


def test_a_write_statement_is_passed_through_to_the_guard():
    # extract_sql does not judge the statement; sql_guard names it, and its
    # message ("starts with DELETE") is the one worth showing.
    assert extract_sql("DELETE FROM employees") == "DELETE FROM employees"


def test_refusal_prose_is_passed_through():
    reply = "I cannot answer that with the tables available."
    assert extract_sql(reply) == reply


def test_a_second_statement_survives_extraction():
    # Cutting at the first semicolon would hide it; the guard has to see it.
    reply = "```sql\nSELECT 1; DROP TABLE projects\n```"
    assert "DROP TABLE" in extract_sql(reply)


# --------------------------------------------------------------------------
# The stub generator
# --------------------------------------------------------------------------


def test_every_advertised_question_has_an_answer():
    # The UI offers stub_questions() as clickable examples, so each one has to
    # actually reach a canned reply.
    for question in stub_questions():
        assert extract_sql(generate_sql(question, ""))


def test_unknown_question_is_refused_with_a_readable_message():
    with pytest.raises(NoSQLReturned, match="no language model|not one of"):
        generate_sql("what is the weather in Ankara", "")


def test_counting_question_is_not_shadowed_by_the_generic_one():
    # "How many employees were hired in 2023" must not fall through to the
    # plain headcount answer.
    hired = generate_sql("How many employees were hired in 2023?", "")
    assert "hire_date" in hired


# --------------------------------------------------------------------------
# JSON conversion
# --------------------------------------------------------------------------


def test_decimal_becomes_a_number():
    assert _jsonable(Decimal("2865000000.00")) == 2865000000.0


def test_date_becomes_an_iso_string():
    assert _jsonable(date(2026, 3, 31)) == "2026-03-31"


def test_plain_values_are_left_alone():
    assert _jsonable(None) is None
    assert _jsonable(60) == 60
    assert _jsonable("Active") == "Active"
