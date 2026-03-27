"""
RSS catalog ingestion — fetch all catalog feeds and run through article pipeline.
Includes both builtin feeds (RSS_CATALOG) and user-added custom feeds (rss_catalog table).
Callable on-demand (case creation, force ingest) or from the background loop.
"""

import asyncio
import logging

from sqlalchemy import select

from app.domains.news.rss_catalog import RSS_CATALOG
from app.source_engine.rss_fetcher import fetch_rss_feed
from app.source_engine.article_pipeline import ingest_articles

logger = logging.getLogger(__name__)


async def _get_custom_feeds(db) -> list[dict]:
    """Load user-added RSS sources from the rss_catalog table."""
    try:
        from app.models.ai_feed import RssCatalogEntry
        result = await db.execute(select(RssCatalogEntry))
        entries = result.scalars().all()
        return [{"name": e.name, "url": e.url} for e in entries]
    except Exception:
        return []


async def ingest_full_catalog(db) -> int:
    """Ingest all RSS catalog feeds (builtin + custom) into the article DB.
    Returns total number of newly inserted articles. Deduplication is handled
    by article_pipeline via SHA256 hash of each article link."""
    # Merge builtin + custom, deduplicate by URL
    seen_urls = set()
    all_feeds = []
    for feed in RSS_CATALOG:
        if feed["url"] not in seen_urls:
            all_feeds.append(feed)
            seen_urls.add(feed["url"])

    custom_feeds = await _get_custom_feeds(db)
    for feed in custom_feeds:
        if feed["url"] not in seen_urls:
            all_feeds.append(feed)
            seen_urls.add(feed["url"])

    total_inserted = 0
    for feed in all_feeds:
        try:
            rows = await fetch_rss_feed(feed["url"], max_items=30, timeout=12)
            if rows:
                source_id = f"catalog_{feed['name'].lower().replace(' ', '_')}"
                inserted = await ingest_articles(db, source_id, rows)
                total_inserted += inserted
        except Exception as e:
            logger.warning(f"Catalog ingest '{feed['name']}' failed: {e}")
        await asyncio.sleep(0.5)  # rate limit between feeds

    if total_inserted:
        logger.info(f"Catalog ingest: {total_inserted} new articles from {len(all_feeds)} feeds ({len(custom_feeds)} custom)")
    return total_inserted
