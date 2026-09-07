"""Turns the live schema into the text a language model reads before writing SQL.

Everything here is descriptive: no model is called and nothing is generated.
The output is a compact description of the tables, their columns and - the part
that actually decides whether generated SQL works - how the tables join.

Without the foreign key lines a model has no way to know that departments
reaches projects through employees and project_employees, so it invents a join
that does not exist. Column types matter for the same reason: they tell the
model that a date can be compared to a date and that money is numeric.

The schema itself comes from schema_audit.introspect, which already reads the
catalog for the audit screen. One loader, two consumers.
"""

from db import fetch_all
from schema_audit.introspect import load_schema

# A text column with at most this many distinct values is treated as a fixed
# set worth listing. Above it the values are free text (names, descriptions)
# and listing them would be noise.
ENUM_LIMIT = 12

# Columns whose contents are obviously prose; never worth sampling.
SKIP_SAMPLING = {"name", "description", "email", "first_name", "last_name"}


def _sampled_values(schema) -> dict[tuple[str, str], list[str]]:
    """Distinct values for short text columns, keyed by (table, column).

    Filters are where generated SQL goes wrong most often: a model that has not
    seen the data writes status = 'active' when the column holds 'Active'.
    Showing the real values removes the guesswork.

    Identifiers are interpolated because they cannot be bound as parameters.
    They come from the system catalog, not from a user, so there is nothing to
    inject here.
    """
    values: dict[tuple[str, str], list[str]] = {}

    for table_name in sorted(schema.tables):
        table = schema.tables[table_name]
        for column in table.columns:
            if not column.base_type.startswith("varchar"):
                continue
            if column.name in SKIP_SAMPLING:
                continue

            rows = fetch_all(
                f'SELECT DISTINCT "{column.name}" AS value '
                f'FROM "{schema.name}"."{table_name}" '
                f'WHERE "{column.name}" IS NOT NULL '
                f"ORDER BY 1 LIMIT {ENUM_LIMIT + 1}"
            )
            # One over the limit means the column is open-ended, not a set.
            if 0 < len(rows) <= ENUM_LIMIT:
                values[(table_name, column.name)] = [row["value"] for row in rows]

    return values


def build_schema_context(schema_name: str = "public", sample_values: bool = True) -> str:
    """The block of text describing the database, ready to drop into a prompt."""
    schema = load_schema(schema_name)
    values = _sampled_values(schema) if sample_values else {}

    lines = [
        "PostgreSQL database. Tables, columns and relationships:",
        "",
    ]

    for table_name in sorted(schema.tables):
        table = schema.tables[table_name]
        lines.append(f"{table_name}")

        for column in table.columns:
            marks = []
            if column.name in table.primary_key:
                marks.append("primary key")
            if column.not_null:
                marks.append("not null")

            listed = values.get((table_name, column.name))
            if listed:
                quoted = ", ".join(f"'{value}'" for value in listed)
                marks.append(f"one of: {quoted}")

            suffix = f"  [{'; '.join(marks)}]" if marks else ""
            lines.append(f"    {column.name} {column.data_type}{suffix}")

        lines.append("")

    if schema.foreign_keys:
        lines.append("Relationships (join on these):")
        for fk in sorted(schema.foreign_keys, key=lambda item: item.table):
            source = ", ".join(fk.columns)
            target = ", ".join(fk.target_columns)
            lines.append(
                f"    {fk.table}.{source} -> {fk.target_table}.{target}"
            )
        lines.append("")

    junctions = [name for name in sorted(schema.tables) if schema.is_junction(name)]
    if junctions:
        lines.append(
            "Link tables (they only connect two others, join through them "
            "rather than selecting from them directly):"
        )
        lines.append(f"    {', '.join(junctions)}")

    return "\n".join(lines).rstrip() + "\n"
