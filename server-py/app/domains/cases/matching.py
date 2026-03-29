"""
Case <-> Article matching engine.

Pre-computes which articles match which cases via the case_articles junction table.
Called on:
  - Case query update (full refresh for that case)
  - Article ingestion (delta: test new articles against all active cases)

All queries use compile_query() for parameterized SQL — no string interpolation.
"""

import json
import logging

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains._shared.query_compiler import compile_query
from app.models.article import Article
from app.models.case import Case, CaseArticle

logger = logging.getLogger(__name__)


def _parse_layers(case: Case) -> list[dict] | None:
    """Extract layers list from a case's query_json."""
    if not case.query_json:
        return None
    try:
        query = json.loads(case.query_json) if isinstance(case.query_json, str) else case.query_json
        layers = query.get("layers", [])
        return layers if layers else None
    except Exception:
        logger.warning("Failed to parse query_json for case %s", case.id, exc_info=True)
        return None


async def refresh_case_articles(db: AsyncSession, case: Case) -> int:
    """Full refresh: delete all mappings for this case, then re-populate.

    Returns the number of matched articles.
    """
    layers = _parse_layers(case)

    # Clear existing mappings
    await db.execute(delete(CaseArticle).where(CaseArticle.case_id == case.id))

    if not layers:
        await db.flush()
        return 0

    compiled = compile_query(layers)
    if compiled is None:
        await db.flush()
        return 0

    where_clause, params = compiled
    # Use hex (no dashes) to match SQLAlchemy's UUID storage format in SQLite
    params["_cid"] = case.id.hex
    result = await db.execute(
        text(
            "INSERT OR IGNORE INTO case_articles (case_id, article_id) "
            f"SELECT :_cid, id FROM articles WHERE {where_clause}"
        ),
        params,
    )
    await db.flush()
    count = result.rowcount or 0
    logger.info("refresh_case_articles(%s '%s'): %d matched", case.id, case.name, count)
    return count


async def refresh_all_cases(db: AsyncSession) -> dict[str, int]:
    """Refresh case_articles for all active cases. Returns {case_name: count}."""
    cases = (await db.scalars(
        select(Case).where(Case.status == "active")
    )).all()

    results = {}
    for case in cases:
        count = await refresh_case_articles(db, case)
        results[case.name] = count

    await db.commit()
    return results


async def match_new_articles(db: AsyncSession, article_ids: list) -> int:
    """Delta match: test a batch of newly ingested articles against all active cases.

    More efficient than full refresh when only a few new articles arrive.
    """
    if not article_ids:
        return 0

    cases = (await db.scalars(
        select(Case).where(Case.status == "active")
    )).all()

    total_inserted = 0
    for case in cases:
        layers = _parse_layers(case)
        if not layers:
            continue

        compiled = compile_query(layers)
        if compiled is None:
            continue

        where_clause, params = compiled
        params["_cid"] = case.id.hex

        # Add article IDs as bind params
        for i, aid in enumerate(article_ids):
            params[f"_aid{i}"] = getattr(aid, "hex", str(aid))
        aid_placeholders = ",".join(f":_aid{i}" for i in range(len(article_ids)))

        result = await db.execute(
            text(
                "INSERT OR IGNORE INTO case_articles (case_id, article_id) "
                f"SELECT :_cid, id FROM articles "
                f"WHERE id IN ({aid_placeholders}) AND ({where_clause})"
            ),
            params,
        )
        total_inserted += result.rowcount or 0

    await db.flush()
    logger.info("match_new_articles: %d new mappings for %d articles x %d cases",
                total_inserted, len(article_ids), len(cases))
    return total_inserted
