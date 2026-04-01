"""
Background og:image enricher.
Fetches article pages (first 20KB only) and extracts og:image / twitter:image
for articles that have no image_url after RSS ingestion.
Uses httpx (async) + lxml (XPath) — zero new dependencies.
"""
import asyncio
import logging

import httpx
from lxml import html
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article

logger = logging.getLogger(__name__)

OG_PROPS = (
    "og:image",
    "og:image:url",
    "og:image:secure_url",
    "twitter:image",
    "twitter:image:src",
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


async def _fetch_og_image(
    client: httpx.AsyncClient,
    url: str,
    sem: asyncio.Semaphore,
) -> str | None:
    """Stream first 20KB of a page, extract og:image via XPath."""
    async with sem:
        try:
            async with client.stream("GET", url) as resp:
                if resp.status_code != 200:
                    return None
                chunks: list[bytes] = []
                size = 0
                async for chunk in resp.aiter_bytes(1024):
                    chunks.append(chunk)
                    size += len(chunk)
                    if size > 20_000:
                        break
                raw = b"".join(chunks)
        except Exception:
            return None

    try:
        doc = html.fromstring(raw)
    except Exception:
        return None

    for prop in OG_PROPS:
        els = doc.xpath(f'//meta[@property="{prop}"]/@content')
        if not els:
            els = doc.xpath(f'//meta[@name="{prop}"]/@content')
        if els and els[0].strip():
            img = els[0].strip()
            if img.startswith("http"):
                return img
    return None


async def enrich_missing_images(
    db: AsyncSession,
    *,
    batch_size: int = 50,
    max_concurrent: int = 10,
    timeout: int = 8,
) -> int:
    """Find articles with no image_url and fetch og:image from their page.
    Call from a background scheduler loop."""

    result = await db.execute(
        select(Article)
        .where(Article.image_url.is_(None))
        .where(Article.link.isnot(None))
        .order_by(Article.pub_date.desc().nullslast())
        .limit(batch_size)
    )
    articles = list(result.scalars().all())
    if not articles:
        return 0

    sem = asyncio.Semaphore(max_concurrent)
    limits = httpx.Limits(max_connections=max_concurrent, max_keepalive_connections=5)

    async with httpx.AsyncClient(
        timeout=timeout,
        limits=limits,
        headers=HEADERS,
        follow_redirects=True,
    ) as client:
        tasks = [_fetch_og_image(client, a.link, sem) for a in articles]
        images = await asyncio.gather(*tasks)

    updated = 0
    for article, img_url in zip(articles, images):
        if img_url:
            article.image_url = img_url
            updated += 1

    if updated:
        await db.commit()

    logger.info(f"og:image enrichment: {updated}/{len(articles)} articles updated")
    return updated
