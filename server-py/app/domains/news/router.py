"""
News domain — article summarization, feed digest, RSS catalog.
"""

import asyncio
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Query
from lxml import etree
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/news/v1", tags=["news"])

# Sample feeds for digest
DIGEST_FEEDS = {
    "world": [
        ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
        ("Guardian", "https://www.theguardian.com/world/rss"),
        ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
    ],
    "tech": [
        ("NPR", "https://feeds.npr.org/1001/rss.xml"),
    ],
}


@router.post("/summarize-article")
async def summarize_article(
    headlines: list[str] = [],
    mode: str = Query("brief"),
):
    # LLM summarization — requires Groq/OpenRouter key
    return {
        "summary": "",
        "status": "SKIPPED",
        "note": "Requires LLM API key (GROQ_API_KEY or OPENROUTER_API_KEY)",
    }


@router.get("/list-feed-digest")
async def list_feed_digest(
    variant: str = Query("full"),
    lang: str = Query("en"),
):
    import asyncio

    feeds = DIGEST_FEEDS.get("world", []) + DIGEST_FEEDS.get(variant, [])

    async def fetch_feed(name: str, url: str) -> tuple[str, list | None, str]:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, headers={"User-Agent": "WorldMonitor/2.0"})
                resp.raise_for_status()
            root = etree.fromstring(resp.content)
            items = root.xpath("//item")[:10]
            cat_items = [
                {"title": i.findtext("title", ""), "link": i.findtext("link", ""), "pubDate": i.findtext("pubDate", ""), "source": name}
                for i in items
            ]
            return name, cat_items, "ok"
        except Exception as e:
            return name, None, f"error: {str(e)[:50]}"

    results = await asyncio.gather(*[fetch_feed(n, u) for n, u in feeds])

    categories = {name: items for name, items, _ in results if items is not None}
    feed_statuses = {name: status for name, _, status in results}

    return {
        "categories": categories,
        "feed_statuses": feed_statuses,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/rss-catalog")
async def list_rss_catalog(db: AsyncSession = Depends(get_db)):
    """List all RSS sources available for ingestion."""
    from sqlalchemy import select
    from app.models.ai_feed import RssCatalogEntry
    result = await db.execute(
        select(RssCatalogEntry).where(RssCatalogEntry.active == True)
    )
    sources = result.scalars().all()
    return {
        "sources": [
            {"name": s.name, "url": s.url, "lang": s.lang, "tier": s.tier,
             "tags": s.tags or [], "country": s.country}
            for s in sources
        ],
        "total": len(sources),
    }


@router.post("/ingest-rss")
async def ingest_rss(
    url: str = Query(...),
    name: str = Query(""),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingest articles from any RSS feed URL through the full pipeline
    (classify + NER + translate + store). Same pipeline as catalog & cases."""
    import hashlib
    from app.source_engine.rss_fetcher import fetch_rss_feed
    from app.source_engine.article_pipeline import ingest_articles

    source_id = f"rss_{name.lower().replace(' ', '_')}" if name else f"rss_{hashlib.md5(url.encode()).hexdigest()[:8]}"

    try:
        rows = await fetch_rss_feed(url, max_items=50, timeout=15)
        inserted = 0
        if rows:
            inserted = await ingest_articles(db, source_id, rows)

        return {
            "source": source_id,
            "url": url,
            "fetched": len(rows),
            "inserted": inserted,
        }
    except Exception as e:
        logger.warning(f"RSS ingest failed for {url}: {e}")
        return {"error": str(e), "url": url, "fetched": 0, "inserted": 0}
