"""Accept-or-reject gate for SQL this codebase did not write.

This is the first of two defences. It runs in Python, before the query reaches
the server, and it exists to catch two different things:

  * statements that are not reads at all - a generated DROP or a second
    statement smuggled in after a semicolon;
  * reads that are technically harmless but would still hurt - a query with no
    LIMIT that returns every row of a large table.

The second defence is the database role itself (see db.fetch_all_readonly),
which holds SELECT and nothing else. That one cannot be talked around, but it
also cannot tell a 60,000-row result from a sensible one. Neither layer is
enough alone: text filtering over SQL has been defeated many times, and a
privilege check has no opinion about result size.

Rejecting here also gives the user a sentence they can act on instead of a
Postgres permission error.
"""

import re

DEFAULT_MAX_ROWS = 500

# Statements that can only be writes, plus the ones that reach outside the
# database. INSERT/UPDATE/DELETE are listed even though a query has to start
# with SELECT or WITH: a data-modifying CTE (WITH x AS (DELETE ...)) starts
# with WITH and would otherwise pass the opening check.
FORBIDDEN = (
    "insert",
    "update",
    "delete",
    "drop",
    "create",
    "alter",
    "truncate",
    "grant",
    "revoke",
    "copy",
    "vacuum",
    "reindex",
    "cluster",
    "listen",
    "notify",
    "prepare",
    "execute",
    "dblink",
    "pg_read_file",
    "pg_read_binary_file",
    "pg_ls_dir",
    "pg_sleep",
    "pg_terminate_backend",
    "pg_cancel_backend",
    "lo_import",
    "lo_export",
)


class UnsafeQuery(ValueError):
    """Generated SQL was rejected. The message is meant to be shown to a user."""


def _without_noise(sql: str) -> str:
    """The query with comments removed and string literal contents blanked.

    Every check below runs against this copy, never the original. A semicolon
    inside a string is data; a semicolon inside a comment is invisible to the
    server but would fool a naive scan of the raw text. Blanking rather than
    deleting keeps offsets close enough for readable errors.
    """
    out = []
    i = 0
    length = len(sql)

    while i < length:
        char = sql[i]

        # Line comment: -- to end of line
        if char == "-" and sql[i + 1 : i + 2] == "-":
            while i < length and sql[i] != "\n":
                i += 1
            continue

        # Block comment: /* ... */ (Postgres allows nesting)
        if char == "/" and sql[i + 1 : i + 2] == "*":
            depth = 1
            i += 2
            while i < length and depth:
                if sql[i] == "/" and sql[i + 1 : i + 2] == "*":
                    depth += 1
                    i += 2
                elif sql[i] == "*" and sql[i + 1 : i + 2] == "/":
                    depth -= 1
                    i += 2
                else:
                    i += 1
            out.append(" ")
            continue

        # Single-quoted literal; '' is an escaped quote inside one
        if char == "'":
            out.append("''")
            i += 1
            while i < length:
                if sql[i] == "'":
                    if sql[i + 1 : i + 2] == "'":
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            continue

        # Double-quoted identifier: kept, it names a real column
        if char == '"':
            out.append(char)
            i += 1
            while i < length and sql[i] != '"':
                out.append(sql[i])
                i += 1
            out.append('"')
            i += 1
            continue

        out.append(char)
        i += 1

    return "".join(out)


def validate_select(sql: str, max_rows: int = DEFAULT_MAX_ROWS) -> str:
    """Returns the query to run, or raises UnsafeQuery explaining the refusal.

    The returned string is the caller's SQL with any trailing semicolon removed
    and a LIMIT appended when it had none.
    """
    if not sql or not sql.strip():
        raise UnsafeQuery("The model returned an empty query.")

    code = _without_noise(sql).strip()

    # Dollar quoting ($$ ... $$) can hold a whole function body and has no
    # place in a generated SELECT. Refuse rather than try to parse it.
    if re.search(r"\$[A-Za-z_]*\$", code):
        raise UnsafeQuery("Dollar-quoted strings are not allowed in a report query.")

    # One statement only. A single trailing semicolon is the normal way to end
    # a query, so it is dropped before looking for any others.
    code = code.rstrip().rstrip(";").rstrip()
    if ";" in code:
        raise UnsafeQuery(
            "The query contains more than one statement. Only a single SELECT "
            "can be run."
        )

    if not re.match(r"^\s*(select|with)\b", code, re.IGNORECASE):
        first = re.match(r"^\s*([A-Za-z_]+)", code)
        word = first.group(1).upper() if first else "?"
        raise UnsafeQuery(
            f"The query starts with {word}, not SELECT. Only reads are allowed."
        )

    lowered = code.lower()
    for keyword in FORBIDDEN:
        if re.search(rf"\b{re.escape(keyword)}\b", lowered):
            raise UnsafeQuery(
                f'The query uses "{keyword.upper()}", which a report is not '
                f"allowed to do."
            )

    # A LIMIT anywhere counts, including one inside a subquery. That is a
    # deliberate simplification: proving which LIMIT is the outer one needs a
    # real parser, and the row cap is a comfort feature - the statement_timeout
    # on the read-only role is what actually protects the server.
    original = sql.strip().rstrip(";").rstrip()
    if not re.search(r"\blimit\b", lowered):
        return f"{original}\nLIMIT {max_rows}"

    return original
