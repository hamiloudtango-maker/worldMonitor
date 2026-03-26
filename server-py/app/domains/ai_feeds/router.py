"""AI Feeds API — CRUD for thematic feeds with query builder and source management."""

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.ai_feed import AIFeed, AIFeedSource, AIFeedResult
from app.domains.ai_feeds.schemas import (
    AIFeedCreate, AIFeedUpdate, AIFeedResponse,
    AIFeedSourceResponse, AIFeedResultResponse,
    SourceAdd, SourceToggle,
    ValidateUrlRequest, ValidateUrlResponse,
    CatalogEntry,
)
from app.domains.ai_feeds.seed import get_catalog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-feeds", tags=["ai-feeds"])


# ── Helpers ──────────────────────────────────────────────────
def _serialize_feed(feed: AIFeed, source_count: int = 0, result_count: int = 0) -> dict:
    return {
        "id": str(feed.id),
        "name": feed.name,
        "description": feed.description,
        "query": json.loads(feed.query) if feed.query else None,
        "ai_config": json.loads(feed.ai_config) if feed.ai_config else None,
        "status": feed.status,
        "is_template": feed.is_template,
        "source_count": source_count,
        "result_count": result_count,
        "created_at": feed.created_at.isoformat(),
        "updated_at": feed.updated_at.isoformat(),
    }


def _serialize_source(s: AIFeedSource) -> dict:
    return {
        "id": str(s.id),
        "url": s.url,
        "name": s.name,
        "lang": s.lang,
        "tier": s.tier,
        "source_type": s.source_type,
        "country": s.country,
        "continent": s.continent,
        "origin": s.origin,
        "enabled": s.enabled,
    }


def _serialize_result(r: AIFeedResult) -> dict:
    return {
        "id": str(r.id),
        "article_url": r.article_url,
        "title": r.title,
        "source_name": r.source_name,
        "published_at": r.published_at.isoformat() if r.published_at else None,
        "relevance_score": r.relevance_score,
        "entities": json.loads(r.entities) if r.entities else None,
        "summary": r.summary,
        "threat_level": r.threat_level,
        "category": r.category,
        "fetched_at": r.fetched_at.isoformat(),
    }


# ── Source catalog (MUST be before /{feed_id} routes) ────────
@router.get("/catalog/sources")
async def list_catalog(
    country: str | None = None,
    continent: str | None = None,
    thematic: str | None = None,
    lang: str | None = None,
    q: str | None = None,
):
    catalog = get_catalog()
    if country:
        catalog = [s for s in catalog if s.get("country", "").lower() == country.lower()]
    if continent:
        catalog = [s for s in catalog if s.get("continent", "").lower() == continent.lower()]
    if thematic:
        catalog = [s for s in catalog if s.get("thematic", "").lower() == thematic.lower()]
    if lang:
        catalog = [s for s in catalog if s.get("lang", "") == lang]
    if q:
        q_lower = q.lower()
        catalog = [s for s in catalog if q_lower in s["name"].lower() or q_lower in s.get("country", "").lower()]
    return {"sources": catalog, "total": len(catalog)}


@router.post("/catalog/validate-url")
async def validate_url(body: ValidateUrlRequest):
    """Validate an RSS URL or auto-discover RSS feeds from a website URL."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(body.url)
            content_type = resp.headers.get("content-type", "")
            text = resp.text[:10000]

            # Direct RSS feed
            if "xml" in content_type or "<rss" in text or "<feed" in text:
                return ValidateUrlResponse(valid=True, feeds_found=[{"url": body.url, "title": "Direct RSS feed"}])

            # HTML page — discover RSS links
            import re
            rss_links = re.findall(
                r'<link[^>]+type=["\']application/rss\+xml["\'][^>]*href=["\']([^"\']+)["\']',
                text,
            )
            atom_links = re.findall(
                r'<link[^>]+type=["\']application/atom\+xml["\'][^>]*href=["\']([^"\']+)["\']',
                text,
            )
            found = []
            for link in rss_links + atom_links:
                if link.startswith("/"):
                    from urllib.parse import urljoin
                    link = urljoin(body.url, link)
                found.append({"url": link, "title": "Discovered feed"})

            if found:
                return ValidateUrlResponse(valid=True, feeds_found=found)
            return ValidateUrlResponse(valid=False, error="No RSS/Atom feeds found on this page")

    except Exception as e:
        return ValidateUrlResponse(valid=False, error=str(e))


# ── CRUD: AI Feeds ───────────────────────────────────────────
@router.post("")
async def create_feed(
    body: AIFeedCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = AIFeed(
        org_id=user.org_id,
        owner_id=user.user_id,
        name=body.name,
        description=body.description,
        query=body.query.model_dump_json(),
        ai_config=body.ai_config.model_dump_json(),
    )
    db.add(feed)
    await db.commit()
    await db.refresh(feed)
    return _serialize_feed(feed)


@router.get("")
async def list_feeds(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            AIFeed,
            func.count(AIFeedSource.id).label("source_count"),
            func.count(AIFeedResult.id).label("result_count"),
        )
        .outerjoin(AIFeedSource, AIFeedSource.ai_feed_id == AIFeed.id)
        .outerjoin(AIFeedResult, AIFeedResult.ai_feed_id == AIFeed.id)
        .where(AIFeed.org_id == user.org_id, AIFeed.status != "archived")
        .group_by(AIFeed.id)
        .order_by(desc(AIFeed.created_at))
    )
    rows = (await db.execute(stmt)).all()
    return {"feeds": [_serialize_feed(f, sc, rc) for f, sc, rc in rows]}


@router.get("/{feed_id}")
async def get_feed(
    feed_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    sc = await db.scalar(select(func.count()).where(AIFeedSource.ai_feed_id == feed.id))
    rc = await db.scalar(select(func.count()).where(AIFeedResult.ai_feed_id == feed.id))
    return _serialize_feed(feed, sc or 0, rc or 0)


@router.put("/{feed_id}")
async def update_feed(
    feed_id: uuid.UUID,
    body: AIFeedUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    if body.name is not None:
        feed.name = body.name
    if body.description is not None:
        feed.description = body.description
    if body.query is not None:
        feed.query = body.query.model_dump_json()
    if body.ai_config is not None:
        feed.ai_config = body.ai_config.model_dump_json()
    if body.status is not None:
        feed.status = body.status
    feed.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(feed)
    return _serialize_feed(feed)


@router.delete("/{feed_id}")
async def delete_feed(
    feed_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    feed.status = "archived"
    feed.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "archived"}


# ── Sources management ───────────────────────────────────────
@router.get("/{feed_id}/sources")
async def list_feed_sources(
    feed_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    stmt = select(AIFeedSource).where(AIFeedSource.ai_feed_id == feed_id)
    sources = (await db.scalars(stmt)).all()
    return {"sources": [_serialize_source(s) for s in sources]}


@router.post("/{feed_id}/sources")
async def add_feed_source(
    feed_id: uuid.UUID,
    body: SourceAdd,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    source = AIFeedSource(
        ai_feed_id=feed_id,
        url=body.url,
        name=body.name,
        lang=body.lang,
        tier=body.tier,
        source_type=body.source_type,
        country=body.country,
        continent=body.continent,
        origin=body.origin,
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return _serialize_source(source)


@router.delete("/{feed_id}/sources/{source_id}")
async def remove_feed_source(
    feed_id: uuid.UUID,
    source_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    source = await db.get(AIFeedSource, source_id)
    if not source or source.ai_feed_id != feed_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source not found")
    await db.delete(source)
    await db.commit()
    return {"status": "removed"}


@router.patch("/{feed_id}/sources/{source_id}")
async def toggle_feed_source(
    feed_id: uuid.UUID,
    source_id: uuid.UUID,
    body: SourceToggle,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    source = await db.get(AIFeedSource, source_id)
    if not source or source.ai_feed_id != feed_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source not found")
    source.enabled = body.enabled
    await db.commit()
    return _serialize_source(source)


# ── Results (articles) ───────────────────────────────────────
@router.get("/{feed_id}/articles")
async def list_feed_articles(
    feed_id: uuid.UUID,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    total = await db.scalar(
        select(func.count()).where(AIFeedResult.ai_feed_id == feed_id)
    )
    stmt = (
        select(AIFeedResult)
        .where(AIFeedResult.ai_feed_id == feed_id)
        .order_by(desc(AIFeedResult.relevance_score), desc(AIFeedResult.published_at))
        .offset(offset)
        .limit(limit)
    )
    results = (await db.scalars(stmt)).all()
    return {"articles": [_serialize_result(r) for r in results], "total": total or 0}
