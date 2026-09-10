"""Tests for the parts of the ask pipeline that need neither model nor database.

Pulling SQL out of a model reply is the piece most likely to break quietly when
the stub is swapped for a real model, because every model wraps its answer
differently. These cases are the shapes that have to survive.

Run from the repository root:
    .venv\\Scripts\\python.exe -m pytest backend/reports/test_ask.py -q
"""

from contextlib import contextmanager
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from llm import client
from reports import ask
from reports.ask import (
    NO_ROWS,
    SQL_PROMPT,
    SUMMARY_PROMPT,
    SUMMARY_ROWS,
    NoSQLReturned,
    _jsonable,
    example_questions,
    extract_sql,
    run_query,
    summarize_rows,
)
from reports.sql_guard import UnsafeQuery


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


def test_refusal_prose_is_raised_with_its_own_words():
    # What the person reads is the model's explanation, not a parser error
    # about a query starting with the word "I".
    reply = "I cannot answer that with the tables available."
    with pytest.raises(NoSQLReturned, match="tables available"):
        extract_sql(reply)


def test_a_refusal_naming_a_missing_table_survives_intact():
    # The shape the model actually produced for "How many customers do we have?"
    reply = (
        "The database does not contain a customers table, so the number of "
        "customers cannot be determined."
    )
    with pytest.raises(NoSQLReturned) as raised:
        extract_sql(reply)
    assert str(raised.value) == reply


def test_every_write_verb_still_reaches_the_guard():
    # Each of these is SQL, so extract_sql must not swallow it as prose: the
    # guard's message names the verb, which is the one worth showing.
    for statement in (
        "DELETE FROM employees",
        "UPDATE employees SET salary = 0",
        "INSERT INTO employees (id) VALUES (1)",
        "DROP TABLE projects",
        "TRUNCATE employees",
    ):
        assert extract_sql(statement) == statement


def test_a_second_statement_survives_extraction():
    # Cutting at the first semicolon would hide it; the guard has to see it.
    reply = "```sql\nSELECT 1; DROP TABLE projects\n```"
    assert "DROP TABLE" in extract_sql(reply)


# --------------------------------------------------------------------------
# The prompt and the examples
#
# generate_sql itself is not tested here: it is one call to the model, and a
# test that needs a key, a network and a bill is not a unit test. What can be
# checked without any of those is that the prompt still says the things the
# model was observed to get wrong without them.
# --------------------------------------------------------------------------


def test_prompt_takes_the_schema():
    filled = SQL_PROMPT.format(schema="departments\n    id integer\n")
    assert "departments" in filled
    assert "{schema}" not in filled


def test_prompt_asks_for_ilike_on_typed_names():
    # Without this the model writes name = 'Radar Signal' for a project stored
    # as "Radar Signal Processing Upgrade": valid SQL, no rows, no error.
    assert "ILIKE" in SQL_PROMPT


def test_prompt_asks_for_left_join_on_nullable_columns():
    # An inner join to departments drops every employee without one.
    assert "LEFT JOIN" in SQL_PROMPT


def test_prompt_forbids_writing():
    # Wrapped across lines in the prompt, so compare on collapsed whitespace.
    flat = " ".join(SQL_PROMPT.lower().split())
    assert "never write insert, update, delete" in flat


def test_prompt_allows_a_refusal():
    # A model told to always answer invents a customers table instead of
    # saying there is none.
    assert "cannot be answered" in SQL_PROMPT


def test_examples_are_a_copy():
    # The UI offers these as clickable chips; a caller editing the list it got
    # back must not change what the next caller sees.
    first = example_questions()
    first.append("something else")
    assert "something else" not in example_questions()


# --------------------------------------------------------------------------
# summarize_rows
#
# The model is replaced throughout: what is being checked is when it is called,
# what it is shown and what happens when it fails - none of which needs a real
# one, and all of which would be untestable with it.
# --------------------------------------------------------------------------


@pytest.fixture
def sent(monkeypatch):
    """Captures the calls to the model instead of making them."""
    calls = []

    def fake_chat(system, user, **kwargs):
        calls.append({"system": system, "user": user, **kwargs})
        return "Seven employees work on that project."

    monkeypatch.setattr(client, "chat", fake_chat)
    return calls


def test_no_rows_is_answered_without_asking_the_model(sent):
    # A request spent on a sentence that is always the same is a request wasted.
    assert summarize_rows("Which projects are on hold?", ["name"], []) == NO_ROWS
    assert sent == []


def test_the_summary_sees_the_question_and_the_rows(sent):
    rows = [{"name": "Esra Gunes", "job_title": "Senior Project Manager"}]
    summarize_rows("Who runs that project?", ["name", "job_title"], rows)

    assert sent[0]["system"] == SUMMARY_PROMPT
    assert "Who runs that project?" in sent[0]["user"]
    assert "Esra Gunes" in sent[0]["user"]
    assert "Senior Project Manager" in sent[0]["user"]


def test_only_the_first_rows_are_sent(sent):
    rows = [{"n": index} for index in range(SUMMARY_ROWS + 30)]
    summarize_rows("List them.", ["n"], rows)

    body = sent[0]["user"]
    # The cap holds, and the model is told the result was larger than what it
    # can see, so it does not describe a partial list as the whole answer.
    assert f"First {SUMMARY_ROWS} of {SUMMARY_ROWS + 30} rows" in body
    assert str(SUMMARY_ROWS + 29) not in body


def test_a_busy_model_costs_the_summary_and_nothing_else(monkeypatch):
    def refuse(*args, **kwargs):
        raise client.LLMRateLimited("busy")

    monkeypatch.setattr(client, "chat", refuse)
    # None, not an exception: the caller still has rows to show.
    assert summarize_rows("Anything?", ["n"], [{"n": 1}]) is None


def test_the_summary_is_told_not_to_invent_numbers():
    flat = " ".join(SUMMARY_PROMPT.lower().split())
    assert "must appear in the rows" in flat


# --------------------------------------------------------------------------
# run_query
#
# The spine both endpoints stand on: /api/reports/ask reaches it through
# answer_question, and /api/reports/run calls it with SQL a saved report card
# sent back. The database is replaced with a cursor that returns what it is
# told, because what is being checked here is the payload and the order of the
# steps, neither of which needs a server.
# --------------------------------------------------------------------------


@pytest.fixture
def rows_from(monkeypatch):
    """Makes readonly_cursor hand back fixed rows, and records the SQL it ran."""
    ran = {}

    def use(columns, rows):
        @contextmanager
        def fake_cursor():
            class Cursor:
                description = [SimpleNamespace(name=name) for name in columns]

                def execute(self, sql):
                    ran["sql"] = sql

                def fetchall(self):
                    return rows

            yield Cursor()

        monkeypatch.setattr(ask, "readonly_cursor", fake_cursor)
        return ran

    return use


def test_a_result_carries_the_chart_it_should_be_drawn_as(rows_from):
    rows_from(
        ["year", "amount"],
        [{"year": 2024, "amount": Decimal(10)}, {"year": 2025, "amount": Decimal(20)}],
    )
    answer = run_query("SELECT year, SUM(amount) AS amount FROM investments GROUP BY 1")

    assert answer["chart"]["type"] == "column"
    assert answer["chart"]["label_column"] == "year"
    # The rows are JSON by now, but the chart was chosen before that: a Decimal
    # and a date still had their types when the rules read them.
    assert answer["rows"][0]["amount"] == 10.0


def test_the_guard_still_stands_between_the_sql_and_the_cursor(rows_from):
    rows_from(["n"], [])
    with pytest.raises(UnsafeQuery):
        run_query("DELETE FROM employees")


def test_a_missing_limit_is_added_before_the_query_runs(rows_from):
    ran = rows_from(["n"], [{"n": 1}])
    run_query("SELECT 1 AS n")
    assert "LIMIT" in ran["sql"]


def test_re_running_a_query_asks_no_model_at_all(rows_from, monkeypatch):
    rows_from(["n"], [{"n": 1}])

    def refuse(*args, **kwargs):
        raise AssertionError("a re-run must not call the model")

    monkeypatch.setattr(client, "chat", refuse)
    answer = run_query("SELECT 1 AS n", "How many?")

    assert answer["answer"] is None
    # No generator either: the SQL was written once, and naming today's model
    # would credit it for a query it did not write.
    assert "generator" not in answer


def test_a_question_still_steers_the_chart_on_a_re_run(rows_from):
    rows_from(
        ["status", "count"],
        [{"status": "Active", "count": 4}, {"status": "On Hold", "count": 2}],
    )
    answer = run_query(
        "SELECT status, COUNT(*) AS count FROM projects GROUP BY 1",
        "Projects per status as a pie chart.",
    )
    assert answer["chart"]["type"] == "donut"


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
