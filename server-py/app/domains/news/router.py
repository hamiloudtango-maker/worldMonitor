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
from app.domains.news.rss_catalog import RSS_CATALOG

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
async def list_rss_catalog():
    """List all pre-built RSS sources available for ingestion."""
    return {
        "sources": RSS_CATALOG,
        "total": len(RSS_CATALOG),
    }


@router.post("/ingest-rss")
async def ingest_rss(
    url: str = Query(...),
    name: str = Query(""),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingest articles from any RSS feed URL into the articles database."""
    import hashlib
    import uuid
    from app.models.article import Article

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers={"User-Agent": "WorldMonitor/2.0"})
            resp.raise_for_status()

        root = etree.fromstring(resp.content)
        items = root.xpath("//item") or root.xpath("//{http://www.w3.org/2005/Atom}entry")

        source_id = f"rss_{name.lower().replace(' ', '_')}" if name else f"rss_{hashlib.md5(url.encode()).hexdigest()[:8]}"
        inserted = 0

        for item in items[:50]:
            title = item.findtext("title", "") or item.findtext("{http://www.w3.org/2005/Atom}title", "")
            link = item.findtext("link", "") or ""
            if not link:
                link_el = item.find("{http://www.w3.org/2005/Atom}link")
                if link_el is not None:
                    link = link_el.get("href", "")
            desc = item.findtext("description", "") or item.findtext("{http://www.w3.org/2005/Atom}summary", "")
            pub = item.findtext("pubDate", "") or item.findtext("{http://www.w3.org/2005/Atom}published", "")

            if not title or not link:
                continue

            h = hashlib.sha256(link.encode()).hexdigest()

            # Check if already exists
            from sqlalchemy import select
            exists = (await db.execute(select(Article.id).where(Article.hash == h))).scalar()
            if exists:
                continue

            article = Article(
                id=uuid.uuid4(),
                hash=h,
                source_id=source_id,
                title=title[:500],
                description=(desc or "")[:1000],
                link=link,
                pub_date=_parse_date(pub),
                lang="en",
                threat_level="info",
                theme="general",
                confidence=0.3,
            )
            db.add(article)
            inserted += 1

        await db.commit()

        # Run enrichment pipeline in background if available
        try:
            from app.source_engine.article_pipeline import enrich_recent_articles
            asyncio.create_task(enrich_recent_articles(source_id))
        except Exception:
            pass

        return {
            "source": source_id,
            "url": url,
            "fetched": len(items),
            "inserted": inserted,
        }

    except Exception as e:
        logger.warning(f"RSS ingest failed for {url}: {e}")
        return {"error": str(e), "url": url, "fetched": 0, "inserted": 0}


def _parse_date(s: str) -> datetime | None:
    if not s:
        return None
    from email.utils import parsedate_to_datetime
    try:
        return parsedate_to_datetime(s)
    except Exception:
        pass
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None
