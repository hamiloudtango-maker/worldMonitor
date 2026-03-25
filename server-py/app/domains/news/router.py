"""
News domain — article summarization and feed digest.
RPCs: SummarizeArticle, GetSummarizeArticleCache, ListFeedDigest
"""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query
from lxml import etree

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
