"""Loads the live PostgreSQL catalog into the objects from model.py.

Five read-only queries, no writes. The one trap worth naming: pg_index.indkey
is an int2vector and therefore 0-based, so subscripting it like an ordinary
array silently returns the wrong column. It is expanded through its text
representation instead, which is 1-based like every other array in SQL.
"""

from db import fetch_all
from .model import Column, ForeignKey, Index, Schema, Table

# pg_constraint stores the referential actions as single characters.
ACTIONS = {
    "a": "NO ACTION",
    "r": "RESTRICT",
    "c": "CASCADE",
    "n": "SET NULL",
    "d": "SET DEFAULT",
}

TABLES_SQL = """
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = %s
    ORDER BY c.relname
"""

COLUMNS_SQL = """
    SELECT c.relname                              AS table_name,
           a.attname                              AS column_name,
           format_type(a.atttypid, a.atttypmod)   AS data_type,
           a.atttypid::int                        AS type_oid,
           t.typname                              AS base_type,
           a.attnotnull                           AS not_null,
           a.attnum::int                          AS position
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    JOIN pg_type t      ON t.oid = a.atttypid
    WHERE c.relkind = 'r'
      AND n.nspname = %s
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum
"""

# indkey is expanded via string_to_array so the ordinality is 1-based.
# Expression indexes carry attnum 0, which matches no pg_attribute row; those
# rows come back with fewer names than keys and are skipped in Python.
INDEXES_SQL = """
    SELECT t.relname            AS table_name,
           i.relname            AS index_name,
           ix.indisunique       AS is_unique,
           ix.indisprimary      AS is_primary,
           pg_get_indexdef(ix.indexrelid) AS definition,
           array_length(string_to_array(ix.indkey::text, ' '), 1) AS key_count,
           (SELECT array_agg(a.attname ORDER BY k.ord)
              FROM unnest(string_to_array(ix.indkey::text, ' ')::smallint[])
                   WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = t.oid AND a.attnum = k.attnum) AS columns
    FROM pg_index ix
    JOIN pg_class i     ON i.oid = ix.indexrelid
    JOIN pg_class t     ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = %s AND t.relkind = 'r'
    ORDER BY t.relname, i.relname
"""

KEY_CONSTRAINTS_SQL = """
    SELECT rel.relname   AS table_name,
           con.contype   AS constraint_type,
           (SELECT array_agg(a.attname ORDER BY k.ord)
              FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = con.conrelid AND a.attnum = k.attnum) AS columns
    FROM pg_constraint con
    JOIN pg_class rel   ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = %s AND con.contype IN ('p', 'u')
    ORDER BY rel.relname
"""

FOREIGN_KEYS_SQL = """
    SELECT con.conname     AS name,
           src.relname     AS table_name,
           tgt.relname     AS target_table,
           con.confdeltype AS delete_action,
           con.confupdtype AS update_action,
           (SELECT array_agg(a.attname ORDER BY k.ord)
              FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = con.conrelid AND a.attnum = k.attnum) AS columns,
           (SELECT array_agg(a.attname ORDER BY k.ord)
              FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = con.confrelid AND a.attnum = k.attnum) AS target_columns
    FROM pg_constraint con
    JOIN pg_class src   ON src.oid = con.conrelid
    JOIN pg_class tgt   ON tgt.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = src.relnamespace
    WHERE n.nspname = %s AND con.contype = 'f'
    ORDER BY src.relname, con.conname
"""


def load_schema(schema_name: str = "public") -> Schema:
    """Reads one schema out of the catalog and returns it as a Schema object."""
    params = (schema_name,)

    columns_by_table: dict[str, list[Column]] = {}
    for row in fetch_all(COLUMNS_SQL, params):
        columns_by_table.setdefault(row["table_name"], []).append(
            Column(
                name=row["column_name"],
                data_type=row["data_type"],
                type_oid=row["type_oid"],
                base_type=row["base_type"],
                not_null=row["not_null"],
                position=row["position"],
            )
        )

    indexes_by_table: dict[str, list[Index]] = {}
    for row in fetch_all(INDEXES_SQL, params):
        names = row["columns"]
        # Skip expression indexes: their column list cannot be resolved to
        # plain names, and none of the rules can say anything useful about one.
        if not names or len(names) != row["key_count"]:
            continue
        indexes_by_table.setdefault(row["table_name"], []).append(
            Index(
                name=row["index_name"],
                columns=tuple(names),
                is_unique=row["is_unique"],
                is_primary=row["is_primary"],
                definition=row["definition"],
            )
        )

    primary_keys: dict[str, tuple[str, ...]] = {}
    unique_sets: dict[str, list[tuple[str, ...]]] = {}
    for row in fetch_all(KEY_CONSTRAINTS_SQL, params):
        columns = tuple(row["columns"] or ())
        if row["constraint_type"] == "p":
            primary_keys[row["table_name"]] = columns
        else:
            unique_sets.setdefault(row["table_name"], []).append(columns)

    tables: dict[str, Table] = {}
    for row in fetch_all(TABLES_SQL, params):
        name = row["table_name"]
        tables[name] = Table(
            name=name,
            columns=tuple(columns_by_table.get(name, [])),
            indexes=tuple(indexes_by_table.get(name, [])),
            primary_key=primary_keys.get(name, ()),
            unique_sets=tuple(unique_sets.get(name, [])),
        )

    foreign_keys = tuple(
        ForeignKey(
            name=row["name"],
            table=row["table_name"],
            columns=tuple(row["columns"] or ()),
            target_table=row["target_table"],
            target_columns=tuple(row["target_columns"] or ()),
            on_delete=ACTIONS.get(row["delete_action"], row["delete_action"]),
            on_update=ACTIONS.get(row["update_action"], row["update_action"]),
        )
        for row in fetch_all(FOREIGN_KEYS_SQL, params)
    )

    return Schema(name=schema_name, tables=tables, foreign_keys=foreign_keys)
