"""
RSS catalog ingestion — fetch all catalog feeds and run through article pipeline.
Callable on-demand (case creation, force ingest) or from the background loop.
"""

import asyncio
import logging

from app.domains.news.rss_catalog import RSS_CATALOG
from app.source_engine.rss_fetcher import fetch_rss_feed
from app.source_engine.article_pipeline import ingest_articles

logger = logging.getLogger(__name__)


async def ingest_full_catalog(db) -> int:
    """Ingest all RSS catalog feeds into the article DB.
    Returns total number of newly inserted articles."""
    total_inserted = 0
    for feed in RSS_CATALOG:
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
        logger.info(f"Catalog ingest: {total_inserted} new articles from {len(RSS_CATALOG)} feeds")
    return total_inserted
