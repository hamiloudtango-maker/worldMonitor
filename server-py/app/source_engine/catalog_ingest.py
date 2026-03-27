"""
RSS catalog ingestion — fetch all active catalog feeds and run through article pipeline.
Reads from the unified rss_catalog DB table (builtin + custom).
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, update

from app.models.ai_feed import RssCatalogEntry
from app.source_engine.rss_fetcher import fetch_rss_feed
from app.source_engine.article_pipeline import ingest_articles

logger = logging.getLogger(__name__)


async def ingest_full_catalog(db) -> int:
    """Ingest all active RSS catalog feeds into the article DB.
    Returns total number of newly inserted articles."""
    result = await db.execute(
        select(RssCatalogEntry).where(RssCatalogEntry.active == True)
    )
    feeds = result.scalars().all()

    total_inserted = 0
    for feed in feeds:
        try:
            rows = await fetch_rss_feed(feed.url, max_items=30, timeout=12)
            if rows:
                source_id = f"catalog_{feed.name.lower().replace(' ', '_')}"
                inserted = await ingest_articles(db, source_id, rows)
                total_inserted += inserted
            # Update last_fetched_at, reset error count
            await db.execute(
                update(RssCatalogEntry)
                .where(RssCatalogEntry.id == feed.id)
                .values(last_fetched_at=datetime.now(timezone.utc), fetch_error_count=0)
            )
        except Exception as e:
            logger.warning(f"Catalog ingest '{feed.name}' failed: {e}")
            await db.execute(
                update(RssCatalogEntry)
                .where(RssCatalogEntry.id == feed.id)
                .values(fetch_error_count=feed.fetch_error_count + 1)
            )
        await asyncio.sleep(0.5)

    await db.commit()
    if total_inserted:
        logger.info(f"Catalog ingest: {total_inserted} new articles from {len(feeds)} feeds")
    return total_inserted
