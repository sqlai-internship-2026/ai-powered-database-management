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


def _scan(sql: str):
    """The query to run, and a mask of it for the checks below.

    Two strings come out of one pass, and they are the same length:

      * the first is the query with its comments removed - the text that will
        actually run;
      * the second is that same text with the inside of every quoted section
        blanked, which is what every check in this module reads.

    Both drop exactly the same comments, and blanking replaces what is inside a
    quoted section in place, so an index found in the mask names the same
    character in the text that runs. That identity is the whole point of
    returning two strings instead of one. Checking one text and running another
    is how a semicolon once survived the single-statement check below: it sat
    behind a trailing comment, where only the raw text still carried it.

    A comment becomes one space rather than nothing, so removing it cannot weld
    the tokens on either side of it into a single word.

    Quoted sections are blanked rather than read, because both kinds are data to
    this module: a semicolon inside a string is a value, and a column named
    "delete" is a name. The quotes themselves stay in the mask, so a query that
    opens with one is still seen to start with something other than SELECT.
    """
    runnable = []
    mask = []
    i = 0
    length = len(sql)

    while i < length:
        char = sql[i]

        # Line comment: -- to end of line. The newline itself is left to the
        # last branch, so the line structure of the query survives.
        if char == "-" and sql[i + 1 : i + 2] == "-":
            while i < length and sql[i] != "\n":
                i += 1
            runnable.append(" ")
            mask.append(" ")
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
            runnable.append(" ")
            mask.append(" ")
            continue

        # A string literal or a quoted identifier. Both open on a quote and
        # close on the next one, and '' is an escaped quote inside a literal.
        # An unterminated one runs to the end of the text and is blanked just
        # the same, so the two outputs stay the same length either way.
        if char in "'\"":
            start = i
            closed = False
            i += 1
            while i < length:
                if sql[i] == char:
                    if char == "'" and sql[i + 1 : i + 2] == "'":
                        i += 2
                        continue
                    i += 1
                    closed = True
                    break
                i += 1
            quoted = sql[start:i]
            inside = len(quoted) - (2 if closed else 1)
            runnable.append(quoted)
            mask.append(char + " " * inside + (char if closed else ""))
            continue

        runnable.append(char)
        mask.append(char)
        i += 1

    return "".join(runnable), "".join(mask)


def validate_select(sql: str, max_rows: int = DEFAULT_MAX_ROWS) -> str:
    """Returns the query to run, or raises UnsafeQuery explaining the refusal.

    The returned string is the caller's SQL with its comments and any trailing
    semicolon removed, and a LIMIT appended when it had none.
    """
    return checked_select(sql, max_rows)[0]


def checked_select(sql: str, max_rows: int = DEFAULT_MAX_ROWS):
    """The same check as validate_select, returning (to_run, uncapped).

    The second element is the validated query without the LIMIT this module
    added, which is what a caller needs to ask how many rows the query would
    have returned had it not been capped. It has passed every check above, so
    counting through it trusts the text no further than running it does.

    When the caller's own SQL already carried a LIMIT the two are identical:
    that limit was asked for, and counting past it would answer a question
    nobody posed.

    Both are cut out of the same text the checks below read, at the same
    indexes. Nothing that was not checked can reach the server that way, which
    is the property the closing check states out loud.
    """
    if not sql or not sql.strip():
        raise UnsafeQuery("The model returned an empty query.")

    runnable, mask = _scan(sql)

    # Dollar quoting ($$ ... $$) can hold a whole function body and has no
    # place in a generated SELECT. Refuse rather than try to parse it.
    if re.search(r"\$[A-Za-z_]*\$", mask):
        raise UnsafeQuery("Dollar-quoted strings are not allowed in a report query.")

    # Where the statement really ends. The mask carries no comments, so a single
    # trailing semicolon - the normal way to end a query - is the last thing in
    # it when there is one, however much the model wrote after it. Both strings
    # are then cut at the same indexes, which is what keeps the text that was
    # checked and the text that will run one text.
    end = len(mask.rstrip())
    if mask[:end].endswith(";"):
        end = len(mask[: end - 1].rstrip())
    start = len(mask) - len(mask.lstrip())
    mask, statement = mask[start:end], runnable[start:end]

    if not statement:
        raise UnsafeQuery("The query is empty once its comments are removed.")

    # One statement only. Any semicolon left inside the cut is a second one.
    if ";" in mask:
        raise UnsafeQuery(
            "The query contains more than one statement. Only a single SELECT "
            "can be run."
        )

    if not re.match(r"^\s*(select|with)\b", mask, re.IGNORECASE):
        first = re.match(r"^\s*([A-Za-z_]+)", mask)
        word = first.group(1).upper() if first else "?"
        raise UnsafeQuery(
            f"The query starts with {word}, not SELECT. Only reads are allowed."
        )

    lowered = mask.lower()
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
    if re.search(r"\blimit\b", lowered):
        to_run = statement
    else:
        to_run = f"{statement}\nLIMIT {max_rows}"

    # Said out loud rather than assumed. Everything above already makes it true;
    # stating it here means a later change to the scan or to the cut cannot
    # quietly hand the server a second statement, which is precisely what went
    # wrong while the checks read one text and the server was given another.
    if ";" in _scan(to_run)[1]:
        raise UnsafeQuery("The query could not be reduced to a single statement.")

    return to_run, statement
