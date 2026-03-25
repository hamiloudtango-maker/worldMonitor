"""
Articles API — filterable, searchable article index.
Supports: country, theme, entity, threat level, full-text search, source.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.article import Article
from app.source_engine.article_pipeline import ingest_articles
from app.source_engine.parser import parse_with_template
from app.source_engine.schemas import SourceTemplate

router = APIRouter(prefix="/articles/v1", tags=["articles"])


@router.get("/search")
async def search_articles(
    q: str = Query("", description="Full-text search query"),
    country: str = Query("", description="ISO-2 country code filter (e.g. UA, RU, US)"),
    theme: str = Query("", description="Theme filter (conflict, economic, tech, military, etc.)"),
    entity: str = Query("", description="Entity name filter (person or organization)"),
    threat: str = Query("", description="Threat level filter (critical, high, medium, low)"),
    source_id: str = Query("", description="Source ID filter"),
    lang: str = Query("", description="Language filter (en, fr, de, es, ar, etc.)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Search and filter articles with multiple criteria."""
    stmt = select(Article).order_by(desc(Article.pub_date))

    if q:
        # SQLite LIKE search (upgrade to FTS5 for PG tsvector in prod)
        stmt = stmt.where(
            Article.title.ilike(f"%{q}%") | Article.title_translated.ilike(f"%{q}%")
        )

    if country:
        stmt = stmt.where(Article.country_codes_json.ilike(f'%"{country.upper()}"%'))

    if theme:
        stmt = stmt.where(Article.theme == theme)

    if entity:
        stmt = stmt.where(Article.entities_json.ilike(f"%{entity}%"))

    if threat:
        stmt = stmt.where(Article.threat_level == threat)

    if source_id:
        stmt = stmt.where(Article.source_id == source_id)

    if lang:
        stmt = stmt.where(Article.lang == lang)

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt) or 0

    # Fetch page
    stmt = stmt.offset(offset).limit(limit)
    result = await db.scalars(stmt)
    articles = result.all()

    return {
        "articles": [
            {
                "id": str(a.id),
                "source_id": a.source_id,
                "title": a.title,
                "title_translated": a.title_translated,
                "description": a.description,
                "link": a.link,
                "pub_date": a.pub_date.isoformat() if a.pub_date else None,
                "lang": a.lang,
                "threat_level": a.threat_level,
                "theme": a.theme,
                "confidence": a.confidence,
                "entities": json.loads(a.entities_json) if a.entities_json else [],
                "country_codes": json.loads(a.country_codes_json) if a.country_codes_json else [],
            }
            for a in articles
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/stats")
async def article_stats(db: AsyncSession = Depends(get_db)):
    """Get aggregated stats: articles per theme, per country, per source."""
    total = await db.scalar(select(func.count()).select_from(Article)) or 0

    # By theme
    theme_rows = await db.execute(
        select(Article.theme, func.count())
        .group_by(Article.theme)
        .order_by(desc(func.count()))
    )
    themes = {row[0] or "unknown": row[1] for row in theme_rows}

    # By threat level
    threat_rows = await db.execute(
        select(Article.threat_level, func.count())
        .group_by(Article.threat_level)
        .order_by(desc(func.count()))
    )
    threats = {row[0] or "info": row[1] for row in threat_rows}

    # By source
    source_rows = await db.execute(
        select(Article.source_id, func.count())
        .group_by(Article.source_id)
        .order_by(desc(func.count()))
        .limit(20)
    )
    sources = {row[0]: row[1] for row in source_rows}

    # By language
    lang_rows = await db.execute(
        select(Article.lang, func.count())
        .group_by(Article.lang)
        .order_by(desc(func.count()))
    )
    langs = {row[0]: row[1] for row in lang_rows}

    return {
        "total": total,
        "by_theme": themes,
        "by_threat": threats,
        "by_source": sources,
        "by_lang": langs,
    }


@router.post("/ingest/{source_id}")
async def trigger_ingest(
    source_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger article ingestion for a source template."""
    from sqlalchemy import select as sel
    from app.models.source_template import SourceTemplate as STModel

    row = await db.scalar(
        sel(STModel).where(
            STModel.source_id == source_id,
            (STModel.org_id == user.org_id) | (STModel.is_catalog == True),
        )
    )
    if not row:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")

    template = SourceTemplate(
        source_id=row.source_id,
        source_type=row.source_type,
        category=row.category,
        url=row.url,
        refresh_seconds=row.refresh_seconds,
        fields=row.fields,
        panel=row.panel_config,
    )

    # Fetch and parse
    from app.source_engine.detector import fetch_raw
    _, raw_text = await fetch_raw(template.url)
    rows = parse_with_template(raw_text, template)

    # Run pipeline
    inserted = await ingest_articles(db, source_id, rows)

    return {"source_id": source_id, "fetched": len(rows), "inserted": inserted}


@router.post("/ingest-gdelt")
async def ingest_gdelt(
    theme: str = Query("", description="Theme: conflict, economic, tech, military, etc."),
    country: str = Query("", description="Country ISO-2 code"),
    max_records: int = Query(100, ge=10, le=250),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingest articles from GDELT API (3-day backfill)."""
    from app.source_engine.gdelt import fetch_gdelt

    rows = await fetch_gdelt(theme=theme, country=country, max_records=max_records)
    source_id = f"gdelt_{theme or 'world'}_{country or 'all'}"
    inserted = await ingest_articles(db, source_id, rows)

    return {"source": "gdelt", "theme": theme, "country": country, "fetched": len(rows), "inserted": inserted}


@router.post("/ingest-google-news")
async def ingest_google_news(
    query: str = Query("", description="Search query"),
    theme: str = Query("", description="Theme filter"),
    country: str = Query("", description="Country name or code"),
    lang: str = Query("en"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingest articles from Google News RSS (with GDELT fallback)."""
    from app.source_engine.google_news import fetch_google_news

    rows = await fetch_google_news(query=query, theme=theme, country=country, lang=lang)
    source_id = f"gnews_{theme or query or 'world'}_{country or 'all'}"
    inserted = await ingest_articles(db, source_id, rows)

    return {"source": "google_news", "query": query, "theme": theme, "fetched": len(rows), "inserted": inserted}


@router.get("/countries")
async def list_countries(db: AsyncSession = Depends(get_db)):
    """Get all countries with article counts, for sidebar filters."""
    # Extract country codes from JSON and count
    result = await db.scalars(
        select(Article.country_codes_json).where(Article.country_codes_json.isnot(None))
    )
    country_counts: dict[str, int] = {}
    for row in result:
        try:
            codes = json.loads(row)
            for code in codes:
                country_counts[code] = country_counts.get(code, 0) + 1
        except Exception:
            pass

    return {"countries": sorted(country_counts.items(), key=lambda x: -x[1])}


@router.get("/themes")
async def list_themes(db: AsyncSession = Depends(get_db)):
    """Get all themes with article counts."""
    rows = await db.execute(
        select(Article.theme, func.count())
        .where(Article.theme.isnot(None))
        .group_by(Article.theme)
        .order_by(desc(func.count()))
    )
    return {"themes": [(row[0], row[1]) for row in rows]}


@router.get("/entities")
async def list_entities(limit: int = Query(50, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    """Get most mentioned entities across all articles."""
    result = await db.scalars(
        select(Article.entities_json).where(Article.entities_json.isnot(None)).limit(1000)
    )
    entity_counts: dict[str, int] = {}
    for row in result:
        try:
            entities = json.loads(row)
            for e in entities:
                entity_counts[e] = entity_counts.get(e, 0) + 1
        except Exception:
            pass

    top = sorted(entity_counts.items(), key=lambda x: -x[1])[:limit]
    return {"entities": top}
