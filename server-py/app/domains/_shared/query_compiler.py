"""
Unified query compiler — single source of truth for Feed/Case article matching.

Compiles a layers/parts/aliases query structure into a **parameterized** SQL WHERE clause.
Used by: Cases (matching.py), AI Feeds (router.py), and delta-matching.

Returns (where_clause_str, bind_params_dict) for use with sqlalchemy.text().
"""


def compile_query(
    layers: list[dict],
    scope: str = "all",
) -> tuple[str, dict] | None:
    """Compile Feed-style layers into a parameterized SQL WHERE clause.

    Args:
        layers: [{"operator": "AND"|"OR"|"NOT", "parts": [{"value": ..., "aliases": [...], "scope": ...}]}]
        scope: Default scope — "all" (title+description+entities) or "title" (title only).
               Individual parts can override via part["scope"].

    Returns:
        (where_clause, params) tuple, or None if no valid clauses.
        where_clause contains :named placeholders; params has their values.
    """
    clauses: list[tuple[str, str]] = []
    params: dict[str, str] = {}
    idx = 0

    for layer in layers:
        op = layer.get("operator", "AND")
        parts = layer.get("parts", [])
        if not parts:
            continue

        or_likes: list[str] = []
        for part in parts:
            value = (part.get("value") or "").strip()
            aliases = part.get("aliases") or []
            part_scope = part.get("scope", scope)

            field = _field_for_scope(part_scope)

            for term in [value] + [a for a in aliases if a]:
                safe = term.lower().replace("'", "")
                if len(safe) < 3:
                    continue
                words = [w for w in safe.split() if len(w) >= 3]
                if len(words) > 2:
                    # Multi-word: each word must appear (AND)
                    word_conds = []
                    for w in words:
                        pname = f"q{idx}"
                        idx += 1
                        params[pname] = f"%{w}%"
                        word_conds.append(f"{field} LIKE :{pname}")
                    or_likes.append(f"({' AND '.join(word_conds)})")
                elif words:
                    pname = f"q{idx}"
                    idx += 1
                    params[pname] = f"%{safe}%"
                    or_likes.append(f"{field} LIKE :{pname}")

        if not or_likes:
            continue
        clause = "(" + " OR ".join(or_likes) + ")"
        clauses.append((op, clause))

    if not clauses:
        return None

    # Combine layers: first standalone, rest with their operator
    where = clauses[0][1]
    for op, clause in clauses[1:]:
        if op == "NOT":
            where = f"({where}) AND NOT {clause}"
        elif op == "OR":
            where = f"({where}) OR {clause}"
        else:
            where = f"({where}) AND {clause}"

    return where, params


def _field_for_scope(scope: str) -> str:
    if scope == "title":
        return "LOWER(title)"
    # "all" or "title_and_content" — search across title, description, and entities
    return "LOWER(title || ' ' || COALESCE(description, '') || ' ' || COALESCE(entities_json, ''))"
