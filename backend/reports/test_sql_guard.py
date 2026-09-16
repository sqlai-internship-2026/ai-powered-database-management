"""Tests for the generated-SQL gate.

No database and no model: every case is a string in and a decision out, which
is the reason the check was written as a pure function in the first place.

Run from the repository root:
    .venv\\Scripts\\python.exe -m pytest backend/reports/test_sql_guard.py -q
"""

import pytest

from reports.sql_guard import (
    DEFAULT_MAX_ROWS,
    UnsafeQuery,
    _scan,
    checked_select,
    validate_select,
)


# --------------------------------------------------------------------------
# Queries that should be allowed through
# --------------------------------------------------------------------------


def test_plain_select_passes():
    assert "SELECT" in validate_select("SELECT name FROM projects")


def test_cte_passes():
    sql = "WITH totals AS (SELECT 1 AS n) SELECT n FROM totals"
    assert validate_select(sql).startswith("WITH")


def test_trailing_semicolon_is_removed():
    assert ";" not in validate_select("SELECT 1;")


def test_existing_limit_is_left_alone():
    sql = "SELECT name FROM projects LIMIT 5"
    assert validate_select(sql) == sql


def test_missing_limit_is_added():
    result = validate_select("SELECT name FROM projects")
    assert result.endswith(f"LIMIT {DEFAULT_MAX_ROWS}")


def test_limit_size_is_configurable():
    assert validate_select("SELECT 1", max_rows=10).endswith("LIMIT 10")


def test_semicolon_inside_a_string_is_data():
    # The value contains a semicolon; that is not a second statement.
    sql = "SELECT * FROM projects WHERE name = 'a; b'"
    assert validate_select(sql).startswith("SELECT")


def test_forbidden_word_inside_a_string_is_data():
    sql = "SELECT * FROM projects WHERE name = 'drop table'"
    assert validate_select(sql).startswith("SELECT")


def test_forbidden_word_as_part_of_an_identifier_is_allowed():
    # "created_at" contains "create" but is not the CREATE statement.
    sql = "SELECT created_at FROM projects LIMIT 1"
    assert validate_select(sql).startswith("SELECT")


def test_comment_is_tolerated():
    # Accepted, and the comment does not travel to the server: what runs is the
    # statement the comment introduced, on its own.
    sql = "-- report of active projects\nSELECT name FROM projects LIMIT 1"
    assert validate_select(sql) == "SELECT name FROM projects LIMIT 1"


# --------------------------------------------------------------------------
# Queries that must be refused
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM projects",
        "UPDATE projects SET budget = 0",
        "INSERT INTO departments (id) VALUES (1)",
        "DROP TABLE projects",
        "CREATE TABLE t (id int)",
        "ALTER TABLE projects ADD COLUMN x int",
        "TRUNCATE projects",
        "GRANT SELECT ON projects TO public",
    ],
)
def test_write_statements_are_refused(sql):
    with pytest.raises(UnsafeQuery):
        validate_select(sql)


def test_second_statement_is_refused():
    with pytest.raises(UnsafeQuery, match="more than one statement"):
        validate_select("SELECT 1; DROP TABLE projects")


def test_statement_hidden_behind_a_line_comment_is_refused():
    # The server ignores the comment but still sees the second statement.
    with pytest.raises(UnsafeQuery, match="more than one statement"):
        validate_select("SELECT 1 -- harmless\n; DROP TABLE projects")


def test_statement_hidden_inside_a_block_comment_is_refused():
    with pytest.raises(UnsafeQuery, match="more than one statement"):
        validate_select("SELECT 1 /* note */ ; DELETE FROM projects")


def test_data_modifying_cte_is_refused():
    # Starts with WITH, so the opening check alone would not catch it.
    sql = "WITH gone AS (DELETE FROM projects RETURNING id) SELECT * FROM gone"
    with pytest.raises(UnsafeQuery, match="DELETE"):
        validate_select(sql)


def test_file_reading_function_is_refused():
    with pytest.raises(UnsafeQuery, match="PG_READ_FILE"):
        validate_select("SELECT pg_read_file('/etc/passwd')")


def test_sleep_is_refused():
    with pytest.raises(UnsafeQuery, match="PG_SLEEP"):
        validate_select("SELECT pg_sleep(60)")


def test_dollar_quoting_is_refused():
    with pytest.raises(UnsafeQuery, match="Dollar-quoted"):
        validate_select("SELECT $$ anything $$")


def test_empty_query_is_refused():
    with pytest.raises(UnsafeQuery, match="empty"):
        validate_select("   ")


def test_refusal_message_names_the_statement():
    with pytest.raises(UnsafeQuery, match="starts with DELETE"):
        validate_select("DELETE FROM projects")


def test_checked_select_hands_back_the_query_without_the_added_limit():
    # The second element is what a caller counts through. It has to be free of
    # the cap, or the count answers 500 no matter how many rows there were.
    to_run, uncapped = checked_select("SELECT name FROM projects")
    assert to_run == "SELECT name FROM projects\nLIMIT 500"
    assert uncapped == "SELECT name FROM projects"


def test_a_limit_the_caller_wrote_is_kept_in_both():
    # Nothing was added, so there is nothing to strip - and counting past a
    # limit somebody asked for would answer a question nobody posed.
    to_run, uncapped = checked_select("SELECT name FROM projects LIMIT 10")
    assert to_run == uncapped == "SELECT name FROM projects LIMIT 10"


# --------------------------------------------------------------------------
# One text: what is checked is what runs
#
# The checks above are only worth what the text they read is worth. These say
# that the text they read and the text handed to the server are the same one.
# --------------------------------------------------------------------------


def test_a_comment_after_the_semicolon_does_not_survive():
    # The failure this section was written for. The semicolon is not at the end
    # of the raw text - a comment is - so trimming the raw text left it in
    # place, and appending LIMIT turned one statement into two.
    assert validate_select("SELECT 1; -- merhaba") == "SELECT 1\nLIMIT 500"


def test_a_block_comment_after_the_semicolon_does_not_survive():
    assert ";" not in validate_select("SELECT 1 /* c */ ;  /* after */")


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT 1",
        "SELECT 'a; b' FROM t",
        "SELECT 1 /* note */ FROM t",
        "SELECT 1 -- tail",
        'SELECT 1 AS "odd;name"',
        "SELECT 'unterminated",
        "SELECT 1 /* unterminated",
        'SELECT "unterminated',
    ],
)
def test_the_scan_returns_two_strings_of_the_same_length(sql):
    # Everything else here rests on this: an index found in the mask names the
    # same character in the text that will run.
    runnable, mask = _scan(sql)
    assert len(runnable) == len(mask)


def test_removing_a_comment_does_not_weld_the_words_around_it():
    # Dropping it outright would leave "SELECT ab".
    runnable, _ = _scan("SELECT a/*c*/b")
    assert "ab" not in runnable


def test_a_string_literal_runs_exactly_as_it_was_written():
    sql = "SELECT * FROM projects WHERE name = 'a; b'"
    assert validate_select(sql).startswith(sql)


def test_a_semicolon_inside_a_quoted_identifier_is_part_of_the_name():
    # A double-quoted identifier names a column; it is never a statement.
    assert validate_select('SELECT 1 AS "odd;name"').startswith("SELECT")


def test_checking_the_returned_query_again_changes_nothing():
    # A saved report card stores what this function returned and sends it back
    # to /api/reports/run later, where it is checked again from scratch. A
    # second pass that rewrote it would quietly change a saved report.
    once = checked_select("SELECT name FROM projects; -- saved")[0]
    assert checked_select(once)[0] == once


def test_a_reply_that_is_only_a_comment_is_refused():
    with pytest.raises(UnsafeQuery, match="empty"):
        validate_select("-- just a note")
