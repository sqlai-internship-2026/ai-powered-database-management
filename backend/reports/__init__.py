"""Aggregated reporting over the management database.

The package is read-only: every function here runs SELECTs and returns plain
dicts. All grouping and arithmetic happens in SQL so the frontend receives
figures it can render directly instead of numbers it has to recompute.
"""

from .queries import (
    filter_options,
    financial_report,
    portfolio_report,
    workforce_report,
)

__all__ = [
    "filter_options",
    "financial_report",
    "portfolio_report",
    "workforce_report",
]
