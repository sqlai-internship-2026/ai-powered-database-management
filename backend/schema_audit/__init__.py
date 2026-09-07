"""Schema audit: reads the live catalog and reports structural problems.

The package never writes to the database. Rules produce suggested DDL as text
so a human can review it before running anything.
"""
