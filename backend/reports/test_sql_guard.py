"""Tests for the generated-SQL gate.

No database and no model: every case is a string in and a decision out, which
is the reason the check was written as a pure function in the first place.

Run from the repository root:
    .venv\\Scripts\\python.exe -m pytest backend/reports/test_sql_guard.py -q
"""

import pytest

from reports.sql_guard import DEFAULT_MAX_ROWS, UnsafeQuery, validate_select


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
    sql = "-- report of active projects\nSELECT name FROM projects LIMIT 1"
    assert validate_select(sql).startswith("--")


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
