"""OPML Import/Export — subscribe to OPML feed lists, export sources."""
import re
import uuid
import xml.etree.ElementTree as ET
from collections import defaultdict
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.plugins.models import PluginInstance

router = APIRouter(prefix="/opml/v1", tags=["opml"])


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════


def _slugify(text: str, max_len: int = 80) -> str:
    """Turn arbitrary text into a safe source_id slug."""
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return slug[:max_len] if slug else "unnamed"


def _build_opml_xml(feeds_by_category: dict[str, list[dict]]) -> str:
    """Build OPML 2.0 XML string from {category: [{name, url, html_url}]}."""
    opml = ET.Element("opml", version="2.0")
    head = ET.SubElement(opml, "head")
    ET.SubElement(head, "title").text = "WorldMonitor Feeds"
    body = ET.SubElement(opml, "body")

    for category, feeds in sorted(feeds_by_category.items()):
        folder = ET.SubElement(body, "outline", text=category, title=category)
        for feed in sorted(feeds, key=lambda f: f["name"]):
            ET.SubElement(
                folder,
                "outline",
                type="rss",
                text=feed["name"],
                title=feed["name"],
                xmlUrl=feed["url"],
                htmlUrl=feed.get("html_url") or "",
            )

    tree = ET.ElementTree(opml)
    buf = BytesIO()
    tree.write(buf, encoding="unicode", xml_declaration=True)
    return buf.getvalue()


def _parse_opml(xml_bytes: bytes) -> list[dict]:
    """
    Parse OPML XML and extract feeds.
    Returns list of {name, url, html_url, category}.
    Handles both flat and nested outline structures.
    """
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise HTTPException(422, f"Invalid OPML XML: {exc}")

    feeds: list[dict] = []

    def _walk(element: ET.Element, parent_category: str = "Uncategorized"):
        xml_url = element.get("xmlUrl")
        if xml_url:
            # This is a leaf feed
            feeds.append(
                {
                    "name": element.get("title") or element.get("text") or xml_url,
                    "url": xml_url.strip(),
                    "html_url": (element.get("htmlUrl") or "").strip(),
                    "category": parent_category,
                }
            )
        else:
            # This is a folder/category — recurse into children
            folder_name = element.get("title") or element.get("text") or parent_category
            for child in element:
                _walk(child, folder_name)

    body = root.find("body")
    if body is None:
        raise HTTPException(422, "OPML missing <body> element")

    for outline in body:
        _walk(outline)

    return feeds


async def _import_feeds(
    feeds: list[dict], db: AsyncSession
) -> dict:
    """
    Import a list of parsed feeds into PluginInstance.
    Returns {imported, skipped, feeds: [...]}.
    """
    # Pre-fetch all existing source_ids for fast duplicate check
    result = await db.execute(
        select(PluginInstance.source_id).where(PluginInstance.plugin_type == "rss")
    )
    existing_ids: set[str] = {row[0] for row in result.all()}

    # Also index by URL to avoid duplicates with different slugs
    result_urls = await db.execute(
        select(PluginInstance.config).where(PluginInstance.plugin_type == "rss")
    )
    existing_urls: set[str] = set()
    for (cfg,) in result_urls.all():
        if isinstance(cfg, dict) and cfg.get("url"):
            existing_urls.add(cfg["url"].strip().rstrip("/"))

    imported = 0
    skipped = 0
    feed_results: list[dict] = []

    for feed in feeds:
        url_normalized = feed["url"].strip().rstrip("/")

        # Skip if URL already exists
        if url_normalized in existing_urls:
            skipped += 1
            feed_results.append(
                {"name": feed["name"], "url": feed["url"], "category": feed["category"], "status": "skipped"}
            )
            continue

        # Generate unique source_id
        source_id = f"plugin_rss_{_slugify(feed['name'])}"
        # Handle collisions
        base_id = source_id
        counter = 2
        while source_id in existing_ids:
            source_id = f"{base_id}_{counter}"
            counter += 1

        instance = PluginInstance(
            plugin_type="rss",
            name=feed["name"],
            config={"url": feed["url"], "name": feed["name"], "html_url": feed.get("html_url", "")},
            source_id=source_id,
            active=True,
            tags=[feed["category"]] if feed["category"] != "Uncategorized" else [],
            refresh_seconds=900,
            tier=3,
        )
        db.add(instance)

        existing_ids.add(source_id)
        existing_urls.add(url_normalized)
        imported += 1
        feed_results.append(
            {"name": feed["name"], "url": feed["url"], "category": feed["category"], "status": "imported"}
        )

    if imported > 0:
        await db.flush()

    return {"imported": imported, "skipped": skipped, "feeds": feed_results}


# ═══════════════════════════════════════════════════════════════
# EXPORT
# ═══════════════════════════════════════════════════════════════


@router.get("/export")
async def export_opml(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all RSS sources as an OPML 2.0 XML file."""
    result = await db.execute(
        select(PluginInstance).where(
            PluginInstance.plugin_type == "rss",
            PluginInstance.active == True,  # noqa: E712
        )
    )
    instances = result.scalars().all()

    # Group by category (first tag, or "Uncategorized")
    by_category: dict[str, list[dict]] = defaultdict(list)
    for inst in instances:
        category = inst.tags[0] if inst.tags else "Uncategorized"
        url = inst.config.get("url", "") if isinstance(inst.config, dict) else ""
        html_url = inst.config.get("html_url", "") if isinstance(inst.config, dict) else ""
        by_category[category].append(
            {"name": inst.name, "url": url, "html_url": html_url}
        )

    xml_str = _build_opml_xml(by_category)
    return Response(
        content=xml_str,
        media_type="application/xml",
        headers={"Content-Disposition": 'attachment; filename="worldmonitor-feeds.opml"'},
    )


# ═══════════════════════════════════════════════════════════════
# IMPORT (file upload)
# ═══════════════════════════════════════════════════════════════


@router.post("/import")
async def import_opml(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import feeds from an uploaded OPML file."""
    if file.content_type and file.content_type not in (
        "application/xml",
        "text/xml",
        "text/x-opml",
        "application/octet-stream",
    ):
        raise HTTPException(422, f"Unexpected content type: {file.content_type}")

    contents = await file.read()
    if len(contents) > 5_000_000:
        raise HTTPException(413, "OPML file too large (max 5 MB)")

    feeds = _parse_opml(contents)
    if not feeds:
        raise HTTPException(422, "No RSS feeds found in the OPML file")

    result = await _import_feeds(feeds, db)
    await db.commit()
    return result


# ═══════════════════════════════════════════════════════════════
# SUBSCRIBE (remote URL)
# ═══════════════════════════════════════════════════════════════


@router.post("/subscribe")
async def subscribe_opml(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a remote OPML URL and import all feeds."""
    import httpx

    url = (body.get("url") or "").strip()
    if not url:
        raise HTTPException(422, "url is required")
    if not url.startswith(("http://", "https://")):
        raise HTTPException(422, "url must be an HTTP(S) URL")

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"Remote returned {exc.response.status_code}")
    except httpx.RequestError as exc:
        raise HTTPException(502, f"Failed to fetch OPML: {exc}")

    feeds = _parse_opml(resp.content)
    if not feeds:
        raise HTTPException(422, "No RSS feeds found in the remote OPML")

    result = await _import_feeds(feeds, db)
    await db.commit()
    return result
