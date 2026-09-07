"""Rule registry and the entry point the API calls.

Adding a rule means writing a pure function in rules.py and adding one line to
RULES below. The registry doubles as the catalog served to the UI, so a rule
can never appear in the report without being documented.

Rule ids, severities and category keys stay English because they are values the
API and the UI match on; the name and description are display text and follow
the findings into Turkish.
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
        name="Birincil anahtar yok",
        description="Her tablonun tek bir satırı adresleyebilecek bir anahtarı olmalı.",
        severity=ERROR,
        category="bütünlük",
        check=rules.missing_primary_key,
    ),
    Rule(
        id="R002",
        name="Tanımsız ON DELETE davranışı",
        description=(
            "NO ACTION'a düşen bir foreign key, silmeyi reddetmenin bilinçli "
            "bir karar olup olmadığını söylemez."
        ),
        severity=WARNING,
        category="referans davranışı",
        check=rules.undefined_on_delete,
    ),
    Rule(
        id="R003",
        name="Tanımsız ON UPDATE davranışı",
        description=(
            "Güncelleme için aynı soru. Anahtarlar otomatik üretilip hiç "
            "değiştirilmediği sürece zararsızdır."
        ),
        severity=INFO,
        category="referans davranışı",
        check=rules.undefined_on_update,
    ),
    Rule(
        id="R004",
        name="İlişkisiz tablo",
        description="Hiçbir yönde foreign key uğramayan tablo.",
        severity=INFO,
        category="yapı",
        check=rules.isolated_table,
    ),
    Rule(
        id="R005",
        name="Döngüsel foreign key zinciri",
        description="Hiçbir satırın ilk sırada eklenemediği tablo döngüsü.",
        severity=ERROR,
        category="yapı",
        check=rules.circular_foreign_keys,
    ),
    Rule(
        id="R006",
        name="Yinelenen veya gereksiz index",
        description=(
            "Aynı kolonlar üzerinde iki index, ya da bir başkasının baştan alt "
            "kümesi olan index."
        ),
        severity=WARNING,
        category="indeksleme",
        check=rules.redundant_index,
    ),
    Rule(
        id="R007",
        name="Foreign key tip uyuşmazlığı",
        description=(
            "Referans verdiği anahtardan farklı tipte tanımlanmış foreign key "
            "kolonu."
        ),
        severity=ERROR,
        category="bütünlük",
        check=rules.foreign_key_type_mismatch,
    ),
    Rule(
        id="R008",
        name="İndekslenmemiş foreign key",
        description=(
            "Alt tarafta, foreign key kolonlarıyla başlayan bir index bulunmuyor."
        ),
        severity=WARNING,
        category="indeksleme",
        check=rules.unindexed_foreign_key,
    ),
    Rule(
        id="R009",
        name="Foreign key ile korunmayan örtük ilişki",
        description="Referans gibi adlandırılmış ama hiçbir şeyin zorlamadığı kolon.",
        severity=WARNING,
        category="bütünlük",
        check=rules.implied_foreign_key,
    ),
    Rule(
        id="R010",
        name="Ortak kolon adı için tutarsız tip",
        description="Aynı kolon adının tablolar arasında farklı tiplerle tanımlanması.",
        severity=INFO,
        category="tutarlılık",
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
