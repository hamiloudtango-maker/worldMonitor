"""
Shared Feed-style query filter — thin wrapper around query_compiler.

DEPRECATED: New code should use compile_query() directly for parameterized queries.
This module exists only for callers that need a raw WHERE string (avoid if possible).
"""

from app.domains._shared.query_compiler import compile_query


def build_query_where(layers: list[dict]) -> str | None:
    """Build a raw SQL WHERE clause string from Feed-style layers.

    WARNING: Returns an unparameterized string. Prefer compile_query() for safety.
    """
    result = compile_query(layers)
    if result is None:
        return None
    where, params = result
    # Inline the bind params into the string (for legacy callers only)
    for key, val in params.items():
        where = where.replace(f":{key}", f"'{val}'")
    return where
