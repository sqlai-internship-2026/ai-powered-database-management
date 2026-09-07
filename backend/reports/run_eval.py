"""Scores generated SQL against the hand-written reference set.

    .venv\\Scripts\\python.exe backend\\reports\\run_eval.py
    .venv\\Scripts\\python.exe backend\\reports\\run_eval.py --generator ask
    .venv\\Scripts\\python.exe backend\\reports\\run_eval.py --only top_earners -v

Both queries are executed and the result sets are compared. Nothing here looks
at SQL text: a question has many correct spellings, and the only thing that
matters is whether the rows are the same.

Two comparisons run, in order:

  1. exact - same rows, same column order;
  2. reordered - same rows once each row's values are sorted, which catches an
     answer that selected the right columns in a different order.

A reordered match is reported separately rather than folded into the pass
count, because it is a weaker result and worth seeing.

Row order is ignored throughout. A question that names an order ("largest
first") pins the rows through LIMIT anyway, and grading a plain GROUP BY on row
order would fail correct answers.

The candidate query goes through sql_guard.validate_select first, exactly as it
would in the application, so a refusal counts as a failure and says so.

Default generator is `self`, which feeds each reference query back in as its own
answer. That must score 100%: it tests the harness and proves every reference
query still runs against the current data.
"""

import sys
from pathlib import Path

# Run as a plain script from the repository root; the package lives one level up.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import argparse  # noqa: E402
import time  # noqa: E402
from datetime import date, datetime  # noqa: E402
from decimal import Decimal  # noqa: E402

import psycopg  # noqa: E402

from db import fetch_all, fetch_all_readonly  # noqa: E402
from reports.eval_cases import CASES, case_by_id  # noqa: E402
from reports.sql_guard import UnsafeQuery, validate_select  # noqa: E402

# Money is summed as numeric, so two correct queries can differ in the last
# digits after arithmetic. Two decimal places is the unit the data is stored in.
MONEY_PLACES = 2


def _normalize(value):
    """One cell, in a form two queries can be compared on."""
    if isinstance(value, Decimal):
        return float(round(value, MONEY_PLACES))
    if isinstance(value, float):
        return round(value, MONEY_PLACES)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _rows_as_tuples(rows):
    return [tuple(_normalize(value) for value in row.values()) for row in rows]


def _sorted_rows(tuples):
    # str() as the sort key so a column holding None next to numbers still
    # sorts; the comparison itself is on the tuples, not on the key.
    return sorted(tuples, key=lambda row: tuple(str(value) for value in row))


def _sorted_cells(tuples):
    return _sorted_rows([tuple(sorted(row, key=str)) for row in tuples])


def compare(reference_rows, candidate_rows):
    """(verdict, note) where verdict is 'pass', 'reordered' or 'fail'."""
    reference = _rows_as_tuples(reference_rows)
    candidate = _rows_as_tuples(candidate_rows)

    if len(reference) != len(candidate):
        return "fail", (
            f"returned {len(candidate)} rows, expected {len(reference)}"
        )

    if reference and len(reference[0]) != len(candidate[0]):
        return "fail", (
            f"returned {len(candidate[0])} columns, expected {len(reference[0])}"
        )

    if _sorted_rows(reference) == _sorted_rows(candidate):
        return "pass", ""

    if _sorted_cells(reference) == _sorted_cells(candidate):
        return "reordered", "same values, different column order"

    # Name one row that differs; a whole diff is unreadable at 500 rows.
    missing = [row for row in _sorted_rows(reference) if row not in candidate]
    if missing:
        return "fail", f"expected row not returned: {missing[0]}"
    return "fail", "values differ"


def grade_case(case, translate):
    """Runs one case end to end and returns a result dict."""
    started = time.perf_counter()
    result = {
        "id": case["id"],
        "question": case["question"],
        "difficulty": case["difficulty"],
        "verdict": "fail",
        "note": "",
        "sql": "",
    }

    reference_rows = fetch_all(case["sql"])

    try:
        raw = translate(case["question"])
    except Exception as exc:  # a generator failure is a failed case, not a crash
        result["note"] = f"generator raised {type(exc).__name__}: {exc}"
        result["seconds"] = time.perf_counter() - started
        return result

    result["sql"] = (raw or "").strip()

    try:
        safe = validate_select(raw)
    except UnsafeQuery as exc:
        result["note"] = f"refused by the guard: {exc}"
        result["seconds"] = time.perf_counter() - started
        return result

    try:
        candidate_rows = fetch_all_readonly(safe)
    except psycopg.Error as exc:
        result["note"] = f"SQL error: {str(exc).strip().splitlines()[0]}"
        result["seconds"] = time.perf_counter() - started
        return result

    verdict, note = compare(reference_rows, candidate_rows)
    result["verdict"] = verdict
    result["note"] = note
    result["seconds"] = time.perf_counter() - started
    return result


def run_eval(translate, cases=CASES):
    return [grade_case(case, translate) for case in cases]


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

MARKS = {"pass": "PASS", "reordered": "PASS*", "fail": "FAIL"}


def print_report(results, verbose=False):
    width = max(len(result["id"]) for result in results)

    print()
    for result in results:
        mark = MARKS[result["verdict"]]
        # One line per case stays scannable; -v prints the query itself.
        note = result["note"]
        if len(note) > 72:
            note = note[:69] + "..."
        note = f"  {note}" if note else ""
        print(f"  {mark:<5} {result['id']:<{width}}  {result['difficulty']:<6}{note}")
        if verbose and result["sql"]:
            for line in result["sql"].splitlines():
                print(f"        | {line}")

    passed = sum(1 for r in results if r["verdict"] == "pass")
    reordered = sum(1 for r in results if r["verdict"] == "reordered")
    total = len(results)

    print()
    print(f"  {passed}/{total} correct", end="")
    if reordered:
        print(f", {reordered} correct with a different column order (PASS*)", end="")
    print(f"  -  {round(100 * (passed + reordered) / total)}% usable")

    by_difficulty = {}
    for result in results:
        bucket = by_difficulty.setdefault(result["difficulty"], [0, 0])
        bucket[1] += 1
        if result["verdict"] in ("pass", "reordered"):
            bucket[0] += 1
    parts = [
        f"{name} {good}/{count}"
        for name, (good, count) in sorted(by_difficulty.items())
    ]
    print(f"  by difficulty: {', '.join(parts)}")
    print(f"  total time: {sum(r['seconds'] for r in results):.1f}s")
    print()

    return passed + reordered == total


def build_translator(name):
    """question -> SQL, for whichever source is being scored."""
    if name == "self":
        # The reference answers itself. Proves the harness and the reference
        # queries are sound; scoring anything below 100% here is a bug in the
        # set, not in a model.
        lookup = {case["question"]: case["sql"] for case in CASES}
        return lambda question: lookup[question]

    if name == "ask":
        from reports.ask import extract_sql, generate_sql, schema_context

        context = schema_context()
        return lambda question: extract_sql(generate_sql(question, context))

    raise SystemExit(f"Unknown generator: {name}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--generator",
        default="self",
        choices=["self", "ask"],
        help="where the candidate SQL comes from (default: self)",
    )
    parser.add_argument("--only", help="run a single case by id")
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="print the candidate SQL"
    )
    args = parser.parse_args()

    cases = CASES
    if args.only:
        case = case_by_id(args.only)
        if not case:
            raise SystemExit(f"No case with id {args.only!r}")
        cases = [case]

    translate = build_translator(args.generator)
    results = run_eval(translate, cases)
    ok = print_report(results, verbose=args.verbose)
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
