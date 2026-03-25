"""Aviation domain — aviation news from RSS."""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/aviation/v1", tags=["aviation"])

_now = lambda: datetime.now(timezone.utc).isoformat()


@router.get("/list-aviation-news")
async def list_aviation_news(page_size: int = Query(10)):
    # Can fetch from RSS
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://www.flightradar24.com/blog/feed/", headers={"User-Agent": "WorldMonitor/2.0"})
            resp.raise_for_status()
        from lxml import etree
        root = etree.fromstring(resp.content)
        items = root.xpath("//item")[:page_size]
        news = [{"title": i.findtext("title", ""), "link": i.findtext("link", ""), "pubDate": i.findtext("pubDate", "")} for i in items]
        return {"news": news, "fetched_at": _now()}
    except Exception:
        return {"news": [], "fetched_at": _now()}
