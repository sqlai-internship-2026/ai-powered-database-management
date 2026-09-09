"""Scores generated SQL against the hand-written reference set.

    .venv\\Scripts\\python.exe backend\\reports\\run_eval.py
    .venv\\Scripts\\python.exe backend\\reports\\run_eval.py --generator ask
    .venv\\Scripts\\python.exe backend\\reports\\run_eval.py --only top_earners -v

Both queries are executed and the result sets are compared. Nothing here looks
at SQL text: a question has many correct spellings, and the only thing that
matters is whether the rows are the same.

Three comparisons run, in order, and each is reported under its own mark rather
than folded into the pass count, because they are progressively weaker results
and worth seeing apart:

  1. PASS  exact - same rows, same column order;
  2. PASS* reordered - same rows once each row's values are sorted, which
     catches an answer that selected the right columns in a different order;
  3. PASS+ extra - every expected value is there, alongside columns nobody
     asked for. A query that adds the id next to the name has answered the
     question; failing it would be grading presentation, not correctness.

A fourth mark, SKIP, is not a result at all: the model never answered, because
the endpoint was busy or unreachable. Those cases leave the score entirely
instead of counting as wrong SQL, and are reported on their own line.

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
from llm.client import LLMError  # noqa: E402
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


def _covers(reference_row, candidate_row):
    """Every value of the reference row appears in the candidate row.

    A list rather than a set: two employees on the same salary are two values,
    and a candidate carrying only one of them has not answered the question.
    """
    remaining = list(candidate_row)
    for value in reference_row:
        if value not in remaining:
            return False
        remaining.remove(value)
    return True


def _covers_all(reference, candidate):
    """Each reference row is matched, one to one, by a row that carries it.

    Quadratic, which is fine on results this size and would not be on 500 rows;
    the cases here return tens of rows because a question a person asks does.
    """
    unmatched = list(candidate)
    for row in reference:
        for index, other in enumerate(unmatched):
            if _covers(row, other):
                unmatched.pop(index)
                break
        else:
            return False
    return True


def compare(reference_rows, candidate_rows):
    """(verdict, note) where verdict is 'pass', 'reordered', 'extra' or 'fail'.

    What counts as a right answer is a real choice, and this is where it is
    made. Two queries that answer the same question rarely agree on
    presentation: one selects the id alongside the name, another writes
    first_name || ' ' || last_name where the reference kept two columns. Both
    return the information that was asked for.

    So the rule is that the reference's values have to be present, not that the
    two shapes have to match. Extra columns are forgiven ('extra'); a missing
    value is not, and neither is a wrong one. SELECT * does not slip through
    that: it has to return the right rows as well, and the row count is checked
    before anything else.
    """
    reference = _rows_as_tuples(reference_rows)
    candidate = _rows_as_tuples(candidate_rows)

    if len(reference) != len(candidate):
        return "fail", (
            f"returned {len(candidate)} rows, expected {len(reference)}"
        )

    if _sorted_rows(reference) == _sorted_rows(candidate):
        return "pass", ""

    if _sorted_cells(reference) == _sorted_cells(candidate):
        return "reordered", "same values, different column order"

    if _covers_all(_sorted_rows(reference), _sorted_rows(candidate)):
        width = len(candidate[0]) - len(reference[0]) if reference else 0
        return "extra", f"all expected values, plus {width} more column(s)"

    if reference and len(reference[0]) != len(candidate[0]):
        return "fail", (
            f"returned {len(candidate[0])} columns, expected {len(reference[0])}"
        )

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
    except LLMError as exc:
        # The model never answered - busy, unreachable, out of tokens. Scoring
        # that as a wrong query would blame the model for the free tier and
        # quietly lower the number this whole harness exists to produce, so it
        # leaves the score entirely and says why.
        result["verdict"] = "skipped"
        result["note"] = f"{type(exc).__name__}: {exc}"
        result["seconds"] = time.perf_counter() - started
        return result
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

MARKS = {
    "pass": "PASS",
    "reordered": "PASS*",
    "extra": "PASS+",
    "fail": "FAIL",
    "skipped": "SKIP",
}

# The three that answered the question, however they laid the answer out.
USABLE = ("pass", "reordered", "extra")


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

    # A skipped case is one the model never answered, so it is not evidence
    # either way and is counted out of the score rather than against it. The
    # count is still printed: a run that scores 10/10 having skipped ten cases
    # is a very different result from one that scored 10/10 out of ten.
    scored = [r for r in results if r["verdict"] != "skipped"]
    skipped = len(results) - len(scored)
    passed = sum(1 for r in scored if r["verdict"] == "pass")
    reordered = sum(1 for r in scored if r["verdict"] == "reordered")
    extra = sum(1 for r in scored if r["verdict"] == "extra")
    total = len(scored)

    print()
    if total:
        usable = passed + reordered + extra
        print(f"  {passed}/{total} exact", end="")
        if reordered:
            print(f", {reordered} in a different column order (PASS*)", end="")
        if extra:
            print(f", {extra} with extra columns (PASS+)", end="")
        print(f"  -  {usable}/{total} usable ({round(100 * usable / total)}%)")
    else:
        print("  no case was answered, so there is nothing to score")
    if skipped:
        print(f"  {skipped} skipped: the model did not answer (not counted above)")

    by_difficulty = {}
    for result in scored:
        bucket = by_difficulty.setdefault(result["difficulty"], [0, 0])
        bucket[1] += 1
        if result["verdict"] in USABLE:
            bucket[0] += 1
    parts = [
        f"{name} {good}/{count}"
        for name, (good, count) in sorted(by_difficulty.items())
    ]
    if parts:
        print(f"  by difficulty: {', '.join(parts)}")
    print(f"  total time: {sum(r['seconds'] for r in results):.1f}s")
    print()

    # A skip is not a pass: a green exit code has to mean every case was both
    # answered and right, or a rate-limited run would look like a clean one.
    return bool(total) and not skipped and passed + reordered + extra == total


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
