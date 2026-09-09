"""Turns a typed question into rows, through generated SQL.

The pipeline is five steps, and the model is only in the first and the last:

    build_schema_context()   what the database looks like
    generate_sql()           question + schema -> SQL          <- the model
    validate_select()        accept or refuse the SQL
    readonly_cursor()        run it as a role that can only read
    summarize_rows()         rows -> a sentence or two          <- the model

The two model calls fail differently and are treated differently. A query that
cannot be written means there is no answer at all; a summary that cannot be
written means the rows arrive without a sentence over them, which is a smaller
loss than an empty screen.

The model is hosted on NVIDIA's free developer endpoint rather than installed
locally, so no GPU and no extra service are involved. llm/client.py owns the
call; this module owns the prompt and what to do with the reply.

Only the second step trusts the model, and only for the text of a query. The
two steps after it assume that text is hostile: the guard refuses anything but
a single SELECT, and the role it then runs as cannot write even if the guard is
wrong. That is why letting a model write SQL against this database is safe at
all.

check_model.py in this package calls the endpoint on its own - no database, no
API - so "the model is down" and "Ask is broken" stay separate questions.
"""

import re
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

# Imported normally by the API (uvicorn puts backend/ on the path). Run as a
# script it has to find backend/ itself.
if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import readonly_cursor  # noqa: E402
from llm import client  # noqa: E402
from reports.schema_context import build_schema_context  # noqa: E402
from reports.sql_guard import UnsafeQuery, validate_select  # noqa: E402

# Same cap the guard applies. Kept here too because the answer says whether the
# result was cut off, and that needs the number.
MAX_ROWS = 500


class NoSQLReturned(ValueError):
    """The generator produced no SQL. The message is meant to be shown."""


# ---------------------------------------------------------------------------
# Schema context
# ---------------------------------------------------------------------------

_context_cache = None


def schema_context(refresh: bool = False) -> str:
    """The schema description, built once per process.

    Building it costs one catalog read plus a DISTINCT query per short text
    column. That is cheap, but it is the same answer every time, and a question
    should not pay for it. Call with refresh=True after a migration.
    """
    global _context_cache
    if refresh or _context_cache is None:
        _context_cache = build_schema_context()
    return _context_cache


# ---------------------------------------------------------------------------
# Getting SQL out of what the model said
# ---------------------------------------------------------------------------

_FENCE = re.compile(r"```(?:sql)?\s*(.+?)```", re.DOTALL | re.IGNORECASE)

# A line that begins with SELECT or WITH is the statement. Checked first
# because "with" is an ordinary English word - "I cannot answer that with the
# tables available" would otherwise be cut into nonsense.
_LINE_START = re.compile(r"^[ \t]*(select|with)\b", re.IGNORECASE | re.MULTILINE)

# Fallback for a reply that puts the query on the same line as its sentence
# ("Sure! The query is: SELECT ..."). SELECT only: a CTE always starts a line.
_INLINE_SELECT = re.compile(r"\bselect\b", re.IGNORECASE)

# A reply with no SELECT in it is one of two very different things, and they
# need opposite handling. This tells them apart: a statement that changes the
# database is still SQL and belongs to the guard, which names it precisely
# ("starts with DELETE"). Anything else is the model talking, and its own
# sentence is a better message than any this module could invent.
_WRITE_START = re.compile(
    r"^(insert|update|delete|drop|alter|create|truncate|grant|revoke|merge|copy)\b",
    re.IGNORECASE,
)


def extract_sql(text: str) -> str:
    """The SQL inside a model reply, or NoSQLReturned carrying the model's words.

    Models rarely answer with bare SQL. The common shape is a sentence, a
    fenced block, then another sentence:

        Here is the query you asked for:
        ```sql
        SELECT ...
        ```
        This returns one row per department.

    A fenced block wins when there is one. Without a fence, everything from the
    first SELECT or WITH is taken and trailing prose is left in place on
    purpose: cutting at the first semicolon would also swallow a second
    statement, and refusing that is sql_guard's job, not this function's.

    When there is no SELECT anywhere, the reply is either a write statement -
    passed through, because the guard describes it better - or the model
    declining to answer. A refusal is re-raised with its own text, so someone
    who asks about a table that does not exist reads "the database does not
    contain a customers table" rather than a parser complaining that their
    query starts with THE.
    """
    if not text or not text.strip():
        raise NoSQLReturned("The generator returned nothing.")

    fenced = _FENCE.search(text)
    candidate = fenced.group(1) if fenced else text

    start = _LINE_START.search(candidate) or _INLINE_SELECT.search(candidate)
    if start:
        candidate = candidate[start.start() :].strip()
        if not candidate:
            raise NoSQLReturned(
                "The generator returned nothing that looks like a query."
            )
        return candidate

    candidate = candidate.strip()
    if _WRITE_START.match(candidate):
        return candidate
    raise NoSQLReturned(candidate)


# ---------------------------------------------------------------------------
# The model call
# ---------------------------------------------------------------------------

# Every rule below was written against a refusal or a wrong query the model
# actually produced, not against what a model might do in principle:
#
#   ILIKE      it wrote name = 'Radar Signal' for a project stored as "Radar
#              Signal Processing Upgrade", which is valid SQL returning nothing
#              - the worst kind of wrong answer, because it looks like an empty
#              department rather than a typo.
#   LEFT JOIN  it wrote an inner join to departments, which silently drops
#              every employee whose department_id is null.
#   no fence   it wraps SQL in ```sql when not told otherwise, and extract_sql
#              should not have to be the only thing standing between the model
#              and the guard.
#
# The last rule is the one that makes a refusal readable: a model told to
# always answer will invent a customers table rather than admit there is none.
SQL_PROMPT = """You write PostgreSQL SELECT queries against the database described below.

{schema}
Rules:
- Answer with the query only: no explanation, no markdown fence, no comments.
- Exactly one statement, and it must read. A WITH ... SELECT is fine. Never
  write INSERT, UPDATE, DELETE, or anything else that changes the database.
- When filtering on a name the person typed, match it with ILIKE and %
  wildcards instead of =. They rarely type a stored name exactly.
- Give each value its own column. Do not concatenate two columns into one,
  even when the question names them together: a first name and a last name
  stay two columns, so a caller can sort or format them.
- Join through the link tables rather than selecting from them directly.
- Use LEFT JOIN where the joining column may be null, so rows without a match
  are not silently dropped.
- Order the result whenever the question implies an order.
- If the question cannot be answered from these tables, write no SQL at all.
  Reply with one or two plain sentences saying what is missing.
"""


def generate_sql(question: str, context: str) -> str:
    """Question and schema in, whatever the model wrote out.

    Deliberately does no parsing and no judging. extract_sql takes the SQL out
    of the reply and the guard decides whether to run it, so this function has
    exactly one job and can be swapped for another provider without touching
    either of them.

    Raises client.LLMError subclasses, which the caller separates from a bad
    answer: an unreachable endpoint is not the model being wrong.
    """
    return client.chat(SQL_PROMPT.format(schema=context), question)


# Offered under the question box so the first thing a visitor sees is a
# question that works. Chosen to span the shapes the schema supports - a count,
# a filter, a grouping, a ranking, a join through a link table, an absence -
# rather than to be the easiest ones to answer.
EXAMPLE_QUESTIONS = [
    "How many employees are there?",
    "Which projects are on hold?",
    "Total investment amount per investment type, largest first.",
    "The five highest paid employees, with their department.",
    "Which employees work on the Tactical Radar System project, with their job title?",
    "Which products are not used in any project?",
    "How many employees does each department have?",
]


def example_questions():
    """Questions to show as examples. A copy, so a caller cannot edit the list."""
    return list(EXAMPLE_QUESTIONS)


# ---------------------------------------------------------------------------
# Saying what came back
# ---------------------------------------------------------------------------

# How many rows the summary is allowed to read. Beyond this it is describing a
# table nobody is going to read row by row anyway, and the prompt would cost
# more than the sentence is worth.
SUMMARY_ROWS = 50

# Answers when there is nothing to summarise. Written out rather than asked for
# because a model cannot say "no rows" more clearly than this, and asking it to
# spends a request on a sentence that is always the same.
NO_ROWS = "No rows matched that question."

# The one rule that matters is the third. Everything a person reads here looks
# authoritative, and the failure that would actually hurt is a plausible number
# that is in the sentence but not in the table.
SUMMARY_PROMPT = """You describe the result of a database query in plain English.

You are given the question that was asked and the rows that came back.

Rules:
- One to three sentences. No preamble, no sign-off, no apology.
- Say what the rows show. Do not explain the SQL and do not offer advice.
- Every number and name in your answer must appear in the rows. Never estimate,
  round, or infer a figure that is not there.
- If the rows are only part of a larger result, say so.
"""


def _rows_as_text(columns, rows):
    """The rows as a small table the model can read."""
    lines = [" | ".join(columns)]
    for row in rows:
        lines.append(" | ".join("" if value is None else str(value) for value in row.values()))
    return "\n".join(lines)


def summarize_rows(question: str, columns, rows, row_count: int = None):
    """One or two sentences about the rows, or None if the model could not.

    Returning None rather than raising is deliberate. The rows are the answer;
    the sentence is a convenience on top of them. A model that is busy or
    unreachable should cost the reader their summary, not their data - and the
    table and the SQL are on screen either way.
    """
    if not rows:
        return NO_ROWS

    total = row_count if row_count is not None else len(rows)
    shown = list(rows)[:SUMMARY_ROWS]
    header = f"Question: {question}\n\n"
    if len(shown) < total:
        header += f"First {len(shown)} of {total} rows:\n"
    else:
        header += f"Rows ({total}):\n"

    try:
        return client.chat(
            SUMMARY_PROMPT,
            header + _rows_as_text(columns, shown),
            max_tokens=client.SUMMARY_TOKENS,
        )
    except client.LLMError:
        return None


# ---------------------------------------------------------------------------
# Running it
# ---------------------------------------------------------------------------


def _jsonable(value):
    """Postgres types the JSON encoder does not know."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def answer_question(question: str, summarize: bool = True) -> dict:
    """Question in, rows out. Raises NoSQLReturned or UnsafeQuery on refusal.

    Two model calls when summarize is on: one to write the query, one to say
    what came back. They are separate on purpose - the first has to be exact
    and the second only has to read well, and a model that fails at the second
    still leaves a complete answer behind.

    A database error is not caught here: the caller decides whether a broken
    generated query is a 400 to the user or a line in an eval report.
    """
    raw = generate_sql(question, schema_context())
    sql = extract_sql(raw)
    safe = validate_select(sql, MAX_ROWS)

    with readonly_cursor() as cur:
        cur.execute(safe)
        rows = cur.fetchall()
        # Taken from the cursor rather than from the first row, so an empty
        # result still knows its own columns and the table renders its header.
        columns = [column.name for column in cur.description or []]

    return {
        "question": question,
        "sql": safe,
        "columns": columns,
        "rows": [
            {key: _jsonable(value) for key, value in row.items()} for row in rows
        ],
        "row_count": len(rows),
        # Hitting the cap exactly is the only signal available without running
        # the query twice; it may be a false alarm on a result of exactly 500.
        "truncated": len(rows) >= MAX_ROWS,
        # None when the summarising call failed. The UI shows the table and the
        # query in that case and says nothing, which is honest: there is no
        # sentence, rather than a sentence that might be wrong.
        "answer": summarize_rows(question, columns, rows) if summarize else None,
        # Which model wrote the query. Travels with the answer so a report can
        # name it without the reader having to know what .env said that day.
        "generator": client.model_name(),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python backend/reports/ask.py \"your question\"")
        print("\nFor example:")
        for example in example_questions():
            print(f"  - {example}")
        raise SystemExit(2)

    try:
        answer = answer_question(" ".join(sys.argv[1:]))
    except (NoSQLReturned, UnsafeQuery, client.LLMError) as exc:
        raise SystemExit(f"Refused: {exc}")

    if answer["answer"]:
        print(answer["answer"])
        print()

    print(answer["sql"])
    print()
    print(" | ".join(answer["columns"]))
    for row in answer["rows"]:
        print(" | ".join(str(value) for value in row.values()))
    print(f"\n{answer['row_count']} rows" + (" (truncated)" if answer["truncated"] else ""))
