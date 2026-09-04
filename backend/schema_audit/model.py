"""Plain data model for a database schema plus the audit results.

Rules never touch the database. introspect.py loads the catalog into these
objects once, and every rule is a pure function over the result. That keeps
rules testable against hand-built fixtures and leaves room for a second loader
(parsing .sql files instead of reading the catalog) without touching a rule.
"""

from dataclasses import dataclass, field

ERROR = "error"
WARNING = "warning"
INFO = "info"

# Lower sorts first, so the worst findings end up at the top of the report.
SEVERITY_ORDER = {ERROR: 0, WARNING: 1, INFO: 2}


@dataclass(frozen=True)
class Column:
    name: str
    data_type: str  # format_type() output, e.g. "character varying(150)"
    type_oid: int  # compared directly when checking foreign key type matches
    base_type: str  # typname without modifiers, e.g. "varchar"
    not_null: bool
    position: int


@dataclass(frozen=True)
class Index:
    name: str
    columns: tuple[str, ...]
    is_unique: bool
    is_primary: bool
    definition: str

    def covers(self, columns: tuple[str, ...]) -> bool:
        """True when "columns" are the leading columns of this index.

        A composite index only helps a lookup that starts at its first column,
        which is why a junction table's primary key covers its first foreign
        key but not its second one.
        """
        return self.columns[: len(columns)] == tuple(columns)


@dataclass(frozen=True)
class ForeignKey:
    name: str
    table: str
    columns: tuple[str, ...]
    target_table: str
    target_columns: tuple[str, ...]
    on_delete: str  # already expanded to NO ACTION / CASCADE / ...
    on_update: str

    @property
    def label(self) -> str:
        source = ", ".join(self.columns)
        target = ", ".join(self.target_columns)
        return f"{self.table}({source}) -> {self.target_table}({target})"


@dataclass(frozen=True)
class Table:
    name: str
    columns: tuple[Column, ...]
    indexes: tuple[Index, ...]
    primary_key: tuple[str, ...]  # empty when the table has no primary key
    unique_sets: tuple[tuple[str, ...], ...]

    def column(self, name: str) -> Column | None:
        for column in self.columns:
            if column.name == name:
                return column
        return None

    @property
    def column_names(self) -> tuple[str, ...]:
        return tuple(column.name for column in self.columns)


@dataclass
class Schema:
    name: str
    tables: dict[str, Table] = field(default_factory=dict)
    foreign_keys: tuple[ForeignKey, ...] = ()

    def outgoing(self, table_name: str) -> list[ForeignKey]:
        """Foreign keys declared on this table."""
        return [fk for fk in self.foreign_keys if fk.table == table_name]

    def incoming(self, table_name: str) -> list[ForeignKey]:
        """Foreign keys pointing at this table."""
        return [fk for fk in self.foreign_keys if fk.target_table == table_name]

    def is_junction(self, table_name: str) -> bool:
        """A table that exists only to connect two others.

        The test is structural: a composite primary key made up entirely of
        foreign key columns. It matters because the right ON DELETE answer
        differs - a link row is meaningless once either side is gone, so
        CASCADE is correct there and dangerous almost everywhere else.
        """
        table = self.tables.get(table_name)
        if table is None or len(table.primary_key) < 2:
            return False
        fk_columns: set[str] = set()
        for fk in self.outgoing(table_name):
            fk_columns.update(fk.columns)
        return set(table.primary_key) <= fk_columns


@dataclass(frozen=True)
class Remediation:
    """One way to fix a finding.

    Several rules have more than one defensible answer, so a finding carries a
    list of these instead of a single "correct" statement. requires_decision
    marks the ones that depend on a business rule the tool cannot know.
    """

    label: str
    ddl: str
    risk: str  # low | medium | high
    recommended: bool = False
    requires_decision: bool = False
    note: str = ""


@dataclass(frozen=True)
class Finding:
    rule_id: str
    rule_name: str
    severity: str
    target: str  # table, column or constraint the finding is about
    message: str
    rationale: str  # why this is worth changing
    confidence: str = "certain"  # certain | heuristic
    remediations: tuple[Remediation, ...] = ()
