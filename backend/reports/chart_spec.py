"""Decides how a result set should be drawn, without asking the model.

Ask returns whatever shape the generated SQL produced, and most of those shapes
have exactly one sensible reading: a year column with an amount beside it is a
trend, a department name with a headcount is a ranking, a single number is a
figure. This module encodes those readings as rules over the column types, the
column names and the rows themselves.

It is deliberately not a second model call. That would cost a few seconds on
every question, would be one more thing the free tier can refuse, and would
answer the same question differently on two afternoons - a poor trade for a
decision the column types already determine. It is also what lets the rules be
tested with no key, no network and no database, like the rest of this package.

The choice is a suggestion, not a verdict. The spec carries `alternatives`: the
other chart types this particular shape supports, which the UI turns into
buttons so a reader can disagree with the default. A type missing from that
list is missing because it would misread the data - a donut of average salaries
shows slices of a total nobody computed - so the UI offers no way to reach it.

The spec never carries data. It names columns, and the browser reads the values
out of the rows it already has, so nothing travels twice.
"""

import re
from datetime import date, datetime
from decimal import Decimal

# Beyond this a bar chart is a wall of hairlines and the table is the honest
# view. The reader can still switch to the chart; it just is not the default.
MAX_CHART_ROWS = 30

# A donut stops being readable at about eight slices, and the leftovers cannot
# be lumped into "other" without inventing a row that was never in the result.
MAX_DONUT_SLICES = 8

# Up to this many points, columns read better than a line: the gaps between
# discrete periods stay visible. Past it the columns get thin and the shape of
# the series matters more than the individual periods.
MAX_COLUMN_POINTS = 6

# One card per number, so a row of two or three totals still reads as figures
# rather than as a one-row table. More than this and they are a table again.
MAX_KPI_VALUES = 4

# Token sets rather than substrings, so "hire_date" does not read as currency
# because some other list happens to contain part of the word.
PERCENT_TOKENS = {"percent", "pct", "share", "ratio", "utilization", "utilisation"}
CURRENCY_TOKENS = {
    "amount",
    "budget",
    "cost",
    "payroll",
    "price",
    "revenue",
    "salary",
    "spend",
    "committed",
    "investment",
}
COUNT_TOKENS = {
    "count",
    "headcount",
    "hires",
    "quantity",
    "qty",
    "units",
    "people",
    "employees",
    "projects",
    "products",
    "investments",
}

# Columns that hold a key rather than a measurement. Charting a sum of ids is
# always wrong, and it is the one numeric column every SELECT tends to carry.
_IDENTIFIER = re.compile(r"^id$|_id$")

# An average, a median or a rate does not add up to anything, so no share-of-
# total chart may be drawn from one even when the numbers look summable.
_NOT_SUMMABLE = {"average", "avg", "mean", "median", "rate", "percent", "pct", "ratio"}

# A four digit number in a column called something like "hire_year" is a point
# on a time axis, not a quantity to measure.
_YEAR_RANGE = range(1900, 2201)

# to_char(date, 'YYYY-MM') and friends: a string that is really a period.
_PERIOD = re.compile(r"^\d{4}(-\d{2}){0,2}$")

# What the reader asked for in words. Checked in order, first match wins, so
# "line chart" is not caught by the looser bar pattern below it. Loose words
# were left out on purpose: "list" and "top five" appear in questions that want
# an ordinary ranking, and reading them as a chart request would replace a good
# default with a worse one.
_REQUESTED = (
    ("donut", re.compile(r"\b(pie|donut|doughnut)\b", re.IGNORECASE)),
    ("line", re.compile(r"\b(line chart|line graph|trend|over time)\b", re.IGNORECASE)),
    ("column", re.compile(r"\b(column chart|vertical bars?)\b", re.IGNORECASE)),
    ("bar", re.compile(r"\b(bar chart|bar graph)\b", re.IGNORECASE)),
    ("table", re.compile(r"\b(as a table|in a table|table form)\b", re.IGNORECASE)),
)

# Wording that says the question is about how a whole divides up. Without it a
# donut is offered but not chosen: a ranking of five departments is a bar chart
# even though the same five numbers would fit in a circle.
_SHARE = re.compile(
    r"\b(share|shares|breakdown|distribution|proportion|proportions|percentage|"
    r"percentages|split|composition)\b",
    re.IGNORECASE,
)


def _tokens(name):
    return {token for token in re.split(r"[^a-z0-9]+", name.lower()) if token}


def value_format(column: str) -> str:
    """What kind of number a column holds, guessed from its name.

    The generated SQL names its own output columns, and a model asked for
    "total budget per department" writes AS total_budget rather than AS x, so
    the name is the only type information there is beyond "numeric" - and it is
    right often enough to be worth using. A wrong guess costs a currency symbol,
    never a wrong number.
    """
    tokens = _tokens(column)
    if tokens & PERCENT_TOKENS:
        return "percent"
    # Counting before currency, because a column can carry both words and the
    # counting one is the noun: investment_count is how many, not how much.
    if tokens & COUNT_TOKENS:
        return "count"
    if tokens & CURRENCY_TOKENS:
        return "currency"
    return "number"


def _is_identifier(column: str) -> bool:
    return bool(_IDENTIFIER.search(column.lower()))


def _is_summable(column: str) -> bool:
    return not (_tokens(column) & _NOT_SUMMABLE)


def _present(rows, column):
    """The non-null values in one column."""
    return [row.get(column) for row in rows if row.get(column) is not None]


def column_kind(column: str, values) -> str:
    """One of temporal, numeric, category or empty.

    bool is checked before int on purpose: in Python True is an integer, and a
    column of flags charted as a quantity would draw a bar of height one.
    """
    if not values:
        return "empty"

    if all(isinstance(value, (date, datetime)) for value in values):
        return "temporal"

    if all(isinstance(value, bool) for value in values):
        return "category"

    if all(isinstance(value, (int, float, Decimal)) for value in values):
        if "year" in _tokens(column) and all(int(v) in _YEAR_RANGE for v in values):
            return "temporal"
        return "numeric"

    if all(isinstance(value, str) for value in values):
        if all(_PERIOD.match(value) for value in values):
            return "temporal"
        return "category"

    return "category"


def _ascending(values) -> bool:
    """True when the labels already run oldest to newest.

    A time axis that is not in time order is not a time axis. When the query
    sorted by amount instead - "the three biggest years" - the order carries the
    answer, and drawing a line through it would suggest a sequence that is not
    there. Sorting the points here would be worse still: it would quietly
    contradict the ORDER BY the reader asked for.
    """
    if any(value is None for value in values):
        return False
    try:
        return all(a <= b for a, b in zip(values, values[1:]))
    except TypeError:
        return False


# The order the UI shows the buttons in, so a switch never rearranges itself.
_TYPE_ORDER = ("kpi", "column", "line", "bar", "donut", "table")


def _spec(chart_type, label, value, value_columns, formats, alternatives, reason,
          hint=None):
    offered = set(alternatives) | {chart_type, "table"}
    return {
        "type": chart_type,
        "label_column": label,
        # A second text column, shown under the label on a bar so the extra
        # word the query selected is not simply dropped by the chart.
        "hint_column": hint,
        "value_column": value,
        "value_columns": value_columns,
        "formats": formats,
        "alternatives": [name for name in _TYPE_ORDER if name in offered],
        "reason": reason,
    }


def requested_type(question: str):
    """The chart the question asked for in words, or None."""
    for name, pattern in _REQUESTED:
        if pattern.search(question or ""):
            return name
    return None


def choose_chart(question: str, columns, rows) -> dict:
    """The chart a result should be drawn as, and the ones it could be.

    Takes the rows as the database returned them - Decimal and date still
    intact - because the JSON copy has lost exactly the type information these
    rules run on: by then an amount and a year are both numbers, and a date is
    a string.
    """
    columns = list(columns or [])

    def table(reason, formats=None):
        return _spec("table", None, None, [], formats or {}, ["table"], reason)

    if not columns:
        return table("The query returned no columns.")
    if not rows:
        # No rows means no types either, so no format can honestly be claimed.
        return table(
            "The query returned no rows, so there is nothing to draw.",
            {column: "text" for column in columns},
        )

    kinds = {column: column_kind(column, _present(rows, column)) for column in columns}
    # A format only means something over a number. Guessing one from the name of
    # a text column produces nonsense - "investment_type" is not an amount - and
    # the browser would go on to format a word as money.
    formats = {
        column: value_format(column)
        if kind == "numeric"
        else "date"
        if kind == "temporal"
        else "text"
        for column, kind in kinds.items()
    }
    measures = [
        column
        for column in columns
        if kinds[column] == "numeric" and not _is_identifier(column)
    ]
    labels_available = [
        column for column in columns if kinds[column] in ("temporal", "category")
    ]
    label = next((c for c in labels_available if kinds[c] == "temporal"), None)
    if label is None:
        label = labels_available[0] if labels_available else None

    if not measures:
        return table(
            "No column holds a number to measure, so the rows are the answer.", formats
        )

    if label is None:
        if len(rows) == 1 and len(measures) <= MAX_KPI_VALUES:
            return _finish(
                question,
                _spec(
                    "kpi",
                    None,
                    measures[0],
                    measures,
                    formats,
                    ["kpi"],
                    "A single row of numbers, shown as figures.",
                ),
            )
        return table("The result has no column to label a mark with.", formats)

    labels = [row.get(label) for row in rows]
    if len({str(value) for value in labels}) != len(labels):
        return table(
            f'"{label}" repeats a value, so one mark would stand for several rows.',
            formats,
        )

    value = measures[0]
    # The text columns the label did not use. One of them can ride along as a
    # hint under each mark; two or more mean the row is a record - a person with
    # a surname, a department and a salary - and charting it by the first column
    # would throw away most of what was asked for.
    spare = [column for column in labels_available if column != label]
    hint = spare[0] if spare else None
    record_like = len(spare) > 1

    crowded = len(rows) > MAX_CHART_ROWS
    # Three or more measures is a table that happens to contain a chart. Every
    # chart type stays reachable, because the reader can pick which measure to
    # draw, but showing one of four columns by default hides the other three.
    many_measures = len(measures) > 2

    if crowded:
        too_much = f"{len(rows)} rows is more than a chart reads well at once."
    elif many_measures:
        too_much = f"{len(measures)} numeric columns, so the table shows them all."
    else:
        too_much = (
            f'Each row is a record rather than one "{label}", so the table keeps '
            f"every column."
        )
    fall_back = crowded or many_measures or record_like

    if kinds[label] == "temporal" and _ascending(labels):
        alternatives = ["column", "line", "bar"]
        if fall_back:
            chosen, reason = "table", too_much
        elif len(rows) <= MAX_COLUMN_POINTS:
            chosen, reason = "column", f'"{value}" over {len(rows)} periods.'
        else:
            chosen = "line"
            reason = f'"{value}" over {len(rows)} periods, drawn as a series.'
        return _finish(
            question,
            _spec(chosen, label, value, measures, formats, alternatives, reason, hint),
        )

    # Categorical, or a time column the query deliberately sorted some other
    # way. Either way the label is a name, not a position on an axis.
    alternatives = ["bar"]
    longest = max((len(str(entry)) for entry in labels), default=0)
    if len(rows) <= 12 and longest <= 12:
        alternatives.append("column")

    numbers = _present(rows, value)
    shareable = (
        2 <= len(rows) <= MAX_DONUT_SLICES
        and _is_summable(value)
        and formats[value] != "percent"
        and all(number >= 0 for number in numbers)
    )
    if shareable:
        alternatives.append("donut")

    if fall_back:
        chosen, reason = "table", too_much
    elif shareable and _SHARE.search(question or ""):
        chosen = "donut"
        reason = f"The question asks how a total divides, over {len(rows)} parts."
    else:
        chosen, reason = "bar", f'"{value}" across {len(rows)} {label} values.'

    return _finish(
        question,
        _spec(chosen, label, value, measures, formats, alternatives, reason, hint),
    )


def _finish(question: str, spec: dict) -> dict:
    """Applies what the question asked for in words, where the shape allows it.

    A request the shape cannot honour is neither obeyed nor silently dropped:
    the reason says a pie was asked for and why there is none. Drawing it anyway
    would be the worse failure - the reader asked for a picture, not for a wrong
    one.
    """
    wanted = requested_type(question)
    if not wanted or wanted == spec["type"]:
        return spec

    if wanted in spec["alternatives"]:
        spec["type"] = wanted
        spec["reason"] = f"Drawn as a {wanted} chart, as the question asked."
    else:
        spec["reason"] += (
            f" A {wanted} chart was asked for, but this result cannot be read as one."
        )
    return spec
