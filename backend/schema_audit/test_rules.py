r"""Tests for the tables a finding says it belongs to.

Finding.tables exists because target cannot be parsed back into a table name:
for R002 and R003 it is a constraint name, for R005 a list, for R010 a bare
column name. The Schema Audit page groups its chart by table, so a rule
getting this wrong moves a bar rather than raising an error - which is why it
is worth a test even though the rest of the rule set has none.

Coverage is deliberately partial. The eight rules whose target already starts
with the table name are not interesting; these three are the ones where the
answer has to be carried rather than derived.

Run from the repository root:
    .venv\Scripts\python.exe -m pytest backend/schema_audit/test_rules.py -q
"""

from schema_audit.model import Column, ForeignKey, Index, Schema, Table
from schema_audit.rules import (
    circular_foreign_keys,
    inconsistent_column_type,
    undefined_on_delete,
    undefined_on_update,
)


def column(name, data_type="integer", type_oid=23, position=1, not_null=True):
    return Column(
        name=name,
        data_type=data_type,
        type_oid=type_oid,
        base_type=data_type,
        not_null=not_null,
        position=position,
    )


def table(name, columns, primary_key=("id",)):
    """A table with a primary key index, so R001 and R008 stay quiet."""
    indexes = ()
    if primary_key:
        indexes = (
            Index(
                name=f"{name}_pkey",
                columns=tuple(primary_key),
                is_unique=True,
                is_primary=True,
                definition="",
            ),
        )
    return Table(
        name=name,
        columns=tuple(columns),
        indexes=indexes,
        primary_key=tuple(primary_key),
        unique_sets=(),
    )


def foreign_key(name, source, column_name, target, on_delete="NO ACTION"):
    return ForeignKey(
        name=name,
        table=source,
        columns=(column_name,),
        target_table=target,
        target_columns=("id",),
        on_delete=on_delete,
        on_update="NO ACTION",
    )


# --------------------------------------------------------------------------
# R002 / R003 - the constraint name says nothing about which table owns it
# --------------------------------------------------------------------------


def referential_schema():
    return Schema(
        name="public",
        tables={
            "departments": table("departments", [column("id")]),
            "employees": table(
                "employees",
                [column("id"), column("department_id", position=2)],
            ),
        },
        foreign_keys=(
            foreign_key(
                "employees_department_id_fkey",
                "employees",
                "department_id",
                "departments",
            ),
        ),
    )


def test_on_delete_counts_against_the_child_table():
    findings = undefined_on_delete(referential_schema())

    assert len(findings) == 1
    # Not "departments": the constraint is declared on the child, and that is
    # the table a reader would go and change.
    assert findings[0].tables == ("employees",)


def test_on_update_counts_against_the_child_table():
    findings = undefined_on_update(referential_schema())

    assert len(findings) == 1
    assert findings[0].tables == ("employees",)


# --------------------------------------------------------------------------
# R005 - a loop belongs to every table in it
# --------------------------------------------------------------------------


def test_a_cycle_lists_every_table_in_the_loop():
    schema = Schema(
        name="public",
        tables={
            "a": table("a", [column("id"), column("b_id", position=2)]),
            "b": table("b", [column("id"), column("c_id", position=2)]),
            "c": table("c", [column("id"), column("a_id", position=2)]),
        },
        foreign_keys=(
            foreign_key("a_b_id_fkey", "a", "b_id", "b"),
            foreign_key("b_c_id_fkey", "b", "c_id", "c"),
            foreign_key("c_a_id_fkey", "c", "a_id", "a"),
        ),
    )

    findings = circular_foreign_keys(schema)

    assert len(findings) == 1
    assert set(findings[0].tables) == {"a", "b", "c"}


def test_a_self_reference_is_not_a_cycle():
    schema = Schema(
        name="public",
        tables={
            "employees": table(
                "employees",
                [column("id"), column("manager_id", position=2, not_null=False)],
            ),
        },
        foreign_keys=(
            foreign_key("employees_manager_id_fkey", "employees", "manager_id", "employees"),
        ),
    )

    assert circular_foreign_keys(schema) == []


# --------------------------------------------------------------------------
# R010 - target is a bare column name, shared by several tables
# --------------------------------------------------------------------------


def test_a_shared_column_lists_every_table_that_declares_it():
    schema = Schema(
        name="public",
        tables={
            "employees": table(
                "employees",
                [column("id"), column("code", "character varying(20)", 1043, 2)],
            ),
            "products": table(
                "products",
                [column("id"), column("code", "character varying(20)", 1043, 2)],
            ),
            "projects": table(
                "projects",
                [column("id"), column("code", "text", 25, 2)],
            ),
        },
    )

    findings = inconsistent_column_type(schema)

    assert len(findings) == 1
    # Including the tables that use the preferred type: the finding is about
    # the disagreement, and a reader comparing them needs both sides.
    assert findings[0].tables == ("employees", "products", "projects")


def test_one_type_everywhere_reports_nothing():
    schema = Schema(
        name="public",
        tables={
            "employees": table(
                "employees",
                [column("id"), column("code", "text", 25, 2)],
            ),
            "products": table(
                "products",
                [column("id"), column("code", "text", 25, 2)],
            ),
        },
    )

    assert inconsistent_column_type(schema) == []
