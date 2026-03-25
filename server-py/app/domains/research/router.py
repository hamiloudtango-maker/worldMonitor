"""Research — arxiv papers and Hacker News."""

import asyncio

import httpx
from fastapi import APIRouter, Query
from lxml import etree

from app.domains._shared.http import fetch_json, fetch_xml, now_iso

router = APIRouter(prefix="/research/v1", tags=["research"])


@router.get("/list-arxiv-papers")
async def list_arxiv_papers(
    category: str = Query("cs.AI"),
    page_size: int = Query(10, ge=1, le=50),
):
    content = await fetch_xml(
        "http://export.arxiv.org/api/query",
    )
    # arxiv doesn't support params via fetch_xml, re-fetch with params
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "http://export.arxiv.org/api/query",
            params={"search_query": f"cat:{category}", "max_results": page_size, "sortBy": "submittedDate", "sortOrder": "descending"},
        )
        resp.raise_for_status()
        content = resp.content

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    root = etree.fromstring(content)
    entries = root.xpath("//atom:entry", namespaces=ns)

    papers = []
    for entry in entries[:page_size]:
        title = entry.findtext("atom:title", "", namespaces=ns).strip().replace("\n", " ")
        summary = entry.findtext("atom:summary", "", namespaces=ns).strip()[:200]
        published = entry.findtext("atom:published", "", namespaces=ns)
        link = ""
        for el in entry.findall("atom:link", namespaces=ns):
            if el.get("type") == "text/html":
                link = el.get("href", "")
                break
        papers.append({"title": title, "summary": summary, "published": published, "url": link, "category": category})

    return {"papers": papers, "total": len(papers), "fetched_at": now_iso()}


@router.get("/list-hackernews-items")
async def list_hackernews_items(feed_type: str = Query("top"), page_size: int = Query(20, ge=1, le=50)):
    data = await fetch_json(f"https://hacker-news.firebaseio.com/v0/{feed_type}stories.json")
    ids = data[:page_size] if isinstance(data, list) else []

    async def fetch_item(item_id: int) -> dict | None:
        try:
            d = await fetch_json(f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json")
            return {
                "id": d.get("id"),
                "title": d.get("title", ""),
                "url": d.get("url", ""),
                "score": d.get("score", 0),
                "by": d.get("by", ""),
                "time": d.get("time", 0),
                "comments": d.get("descendants", 0),
            }
        except Exception:
            return None

    results = await asyncio.gather(*[fetch_item(i) for i in ids])
    items = [r for r in results if r is not None]

    return {"items": items, "total": len(items), "fetched_at": now_iso()}
