"""Rule registry and the entry point the API calls.

Adding a rule means writing a pure function in rules.py and adding one line to
RULES below. The registry doubles as the catalog served to the UI, so a rule
can never appear in the report without being documented.
"""

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Callable

from . import rules
from .introspect import load_schema
from .model import ERROR, INFO, SEVERITY_ORDER, WARNING, Finding, Schema


@dataclass(frozen=True)
class Rule:
    id: str
    name: str
    description: str
    severity: str
    category: str
    check: Callable[[Schema], list[Finding]]


RULES: tuple[Rule, ...] = (
    Rule(
        id="R001",
        name="Missing primary key",
        description="Every table needs a way to address a single row.",
        severity=ERROR,
        category="integrity",
        check=rules.missing_primary_key,
    ),
    Rule(
        id="R002",
        name="Undefined ON DELETE behaviour",
        description=(
            "A foreign key left on NO ACTION does not say whether refusing the "
            "delete was intended."
        ),
        severity=WARNING,
        category="referential actions",
        check=rules.undefined_on_delete,
    ),
    Rule(
        id="R003",
        name="Undefined ON UPDATE behaviour",
        description=(
            "Same question for updates. Harmless while keys are generated and "
            "never edited."
        ),
        severity=INFO,
        category="referential actions",
        check=rules.undefined_on_update,
    ),
    Rule(
        id="R004",
        name="Isolated table",
        description="A table no foreign key reaches, in either direction.",
        severity=INFO,
        category="structure",
        check=rules.isolated_table,
    ),
    Rule(
        id="R005",
        name="Circular foreign key chain",
        description="A loop of tables where no row can be inserted first.",
        severity=ERROR,
        category="structure",
        check=rules.circular_foreign_keys,
    ),
    Rule(
        id="R006",
        name="Duplicate or redundant index",
        description=(
            "Two indexes on the same columns, or one that is a leading subset "
            "of another."
        ),
        severity=WARNING,
        category="indexing",
        check=rules.redundant_index,
    ),
    Rule(
        id="R007",
        name="Foreign key type mismatch",
        description=(
            "A foreign key column declared differently from the key it "
            "references."
        ),
        severity=ERROR,
        category="integrity",
        check=rules.foreign_key_type_mismatch,
    ),
    Rule(
        id="R008",
        name="Unindexed foreign key",
        description="No index starts with the foreign key columns on the child side.",
        severity=WARNING,
        category="indexing",
        check=rules.unindexed_foreign_key,
    ),
    Rule(
        id="R009",
        name="Implied relationship without a foreign key",
        description="A column named like a reference that nothing enforces.",
        severity=WARNING,
        category="integrity",
        check=rules.implied_foreign_key,
    ),
    Rule(
        id="R010",
        name="Inconsistent type for a shared column name",
        description="The same column name declared with different types across tables.",
        severity=INFO,
        category="consistency",
        check=rules.inconsistent_column_type,
    ),
)


def rule_catalog() -> list[dict]:
    """The registry without the callables, for the UI."""
    return [
        {
            "id": rule.id,
            "name": rule.name,
            "description": rule.description,
            "severity": rule.severity,
            "category": rule.category,
        }
        for rule in RULES
    ]


def run_audit(schema_name: str = "public") -> dict:
    """Loads the schema once, runs every rule over it, returns a report."""
    schema = load_schema(schema_name)

    findings: list[Finding] = []
    for rule in RULES:
        findings.extend(rule.check(schema))

    # Worst first, then stable by rule and by the object the finding is about.
    findings.sort(
        key=lambda finding: (
            SEVERITY_ORDER.get(finding.severity, 99),
            finding.rule_id,
            finding.target,
        )
    )

    summary = {
        "total": len(findings),
        ERROR: sum(1 for f in findings if f.severity == ERROR),
        WARNING: sum(1 for f in findings if f.severity == WARNING),
        INFO: sum(1 for f in findings if f.severity == INFO),
    }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "schema": schema_name,
        "scanned": {
            "tables": len(schema.tables),
            "foreign_keys": len(schema.foreign_keys),
            "indexes": sum(len(table.indexes) for table in schema.tables.values()),
            "rules": len(RULES),
        },
        "summary": summary,
        "findings": [asdict(finding) for finding in findings],
    }
