"""Turns a typed question into rows, through generated SQL.

The pipeline is four steps and every one of them already existed except the
second:

    build_schema_context()   what the database looks like
    generate_sql()           question + schema -> SQL          <- the model
    validate_select()        accept or refuse the SQL
    readonly_cursor()        run it as a role that can only read

`generate_sql` is a stub. It returns canned answers for a handful of questions
and nothing else - no model is called, no key is needed, no GPU is involved.
That is deliberate: everything around the model (extracting SQL from prose,
refusing writes, serialising Decimal and date, an empty result, a truncated
result, the error text a user sees) can be built and tested without one, and
those are the parts that take the time. Replacing the stub with a real call
changes this function and nothing else.

The model it will call is hosted on NVIDIA's free developer endpoint rather than
installed locally, so no GPU and no extra service are involved. That endpoint is
OpenAI-compatible and is configured by NVIDIA_API_KEY, NVIDIA_MODEL and
NVIDIA_BASE_URL in .env. check_model.py in this package calls it on its own, so
whether the model is reachable can be answered without going through Ask.

The stub answers a few of the questions in eval_cases.py correctly, one in a
different column order, and one wrongly, so `run_eval.py --generator ask` prints
a mixed report instead of a meaningless 100%.
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
from reports.schema_context import build_schema_context  # noqa: E402
from reports.sql_guard import UnsafeQuery, validate_select  # noqa: E402

# Same cap the guard applies. Kept here too because the answer says whether the
# result was cut off, and that needs the number.
MAX_ROWS = 500

# Which generator produced the SQL. Travels with the answer so the UI can say
# "canned answer" instead of implying a model ran.
GENERATOR = "stub"


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


def extract_sql(text: str) -> str:
    """The SQL inside a model reply.

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

    Text with no SQL at all is passed through rather than rejected here, so the
    guard can name what it actually is ("starts with DELETE") instead of this
    function reporting a vague absence.
    """
    if not text or not text.strip():
        raise NoSQLReturned("The generator returned nothing.")

    fenced = _FENCE.search(text)
    candidate = fenced.group(1) if fenced else text

    start = _LINE_START.search(candidate) or _INLINE_SELECT.search(candidate)
    if start:
        candidate = candidate[start.start() :]

    candidate = candidate.strip()
    if not candidate:
        raise NoSQLReturned("The generator returned nothing that looks like a query.")
    return candidate


# ---------------------------------------------------------------------------
# The model call - stubbed
# ---------------------------------------------------------------------------

# Each entry: every keyword must appear in the lower-cased question. The reply
# shapes vary on purpose - bare SQL, a fenced block, prose around the block -
# because that variety is what extract_sql has to survive.
_STUB_ANSWERS = [
    (
        # "are there" as well as "how many employees", or this entry would also
        # swallow "how many employees were hired in 2023" and "how many
        # employees work in each department".
        ("how many employees", "are there"),
        "SELECT COUNT(*) AS employee_count FROM employees",
    ),
    (
        ("on hold",),
        "```sql\nSELECT name FROM projects WHERE status = 'On Hold' ORDER BY name\n```",
    ),
    (
        ("total budget",),
        "Here is the query:\n\n```sql\nSELECT SUM(budget) AS total_budget\nFROM projects\n```\n\n"
        "It returns a single row.",
    ),
    (
        ("largest budget",),
        "```sql\nSELECT name, budget FROM projects ORDER BY budget DESC LIMIT 1\n```",
    ),
    (
        ("investment type",),
        "SELECT investment_type, SUM(amount) AS total_amount\n"
        "FROM investments\n"
        "GROUP BY investment_type\n"
        "ORDER BY total_amount DESC",
    ),
    (
        ("not used in any project",),
        "```sql\nSELECT pr.name\nFROM products pr\nWHERE NOT EXISTS (\n"
        "    SELECT 1 FROM project_products pp WHERE pp.product_id = pr.id\n"
        ")\nORDER BY pr.name\n```",
    ),
    (
        # Right answer, columns in another order: shows up as PASS* in the eval.
        ("five highest paid",),
        "```sql\nSELECT d.name AS department, e.salary, e.first_name, e.last_name\n"
        "FROM employees e\n"
        "LEFT JOIN departments d ON d.id = e.department_id\n"
        "ORDER BY e.salary DESC\nLIMIT 5\n```",
    ),
    (
        # Wrong on purpose - reads 2022 - so a failing case appears in the report.
        ("hired in 2023",),
        "SELECT COUNT(*) AS hired FROM employees "
        "WHERE EXTRACT(YEAR FROM hire_date) = 2022",
    ),
    (
        # Not an eval case. Here to exercise the guard by hand.
        ("delete",),
        "DELETE FROM employees WHERE id = 1",
    ),
    (
        # Not an eval case. A column that does not exist, to see the database
        # error reach the user as a readable message.
        ("job level",),
        "SELECT job_level, COUNT(*) FROM employees GROUP BY job_level",
    ),
]


def generate_sql(question: str, context: str) -> str:
    """Question and schema in, model reply out. Stubbed - see the module docstring.

    The real version sends `context` and `question` to a model and returns what
    it says. `context` is ignored here, but it stays in the signature so
    swapping the body changes nothing above this line.

    Replacing it looks roughly like:

        reply = post(f"{BASE_URL}/chat/completions", key=API_KEY, json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": PROMPT.format(schema=context)},
                {"role": "user", "content": question},
            ],
            "temperature": 0,
        })
        return reply["choices"][0]["message"]["content"]
    """
    asked = question.lower()

    for keywords, reply in _STUB_ANSWERS:
        if all(keyword in asked for keyword in keywords):
            return reply

    raise NoSQLReturned(
        "No language model is connected yet, and this question is not one of "
        "the canned examples. Try one of the suggestions below the box."
    )


def stub_questions():
    """The questions the stub can answer, for the UI to offer as examples."""
    return [
        "How many employees are there?",
        "Which projects are on hold?",
        "What is the total budget across all projects?",
        "Which project has the largest budget?",
        "Total investment amount per investment type, largest first.",
        "Which products are not used in any project?",
        "The five highest paid employees, with their department.",
    ]


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


def answer_question(question: str) -> dict:
    """Question in, rows out. Raises NoSQLReturned or UnsafeQuery on refusal.

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
        "generator": GENERATOR,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python backend/reports/ask.py \"your question\"")
        print("\nThe stub can answer:")
        for example in stub_questions():
            print(f"  - {example}")
        raise SystemExit(2)

    try:
        answer = answer_question(" ".join(sys.argv[1:]))
    except (NoSQLReturned, UnsafeQuery) as exc:
        raise SystemExit(f"Refused: {exc}")

    print(answer["sql"])
    print()
    print(" | ".join(answer["columns"]))
    for row in answer["rows"]:
        print(" | ".join(str(value) for value in row.values()))
    print(f"\n{answer['row_count']} rows" + (" (truncated)" if answer["truncated"] else ""))
