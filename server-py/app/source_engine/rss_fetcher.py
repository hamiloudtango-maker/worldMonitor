"""
Generic RSS/Atom feed fetcher — parses standard feeds into ParsedRow.
Used by the catalog auto-ingestion and case enrichment.
"""

import logging

from lxml import etree

from app.domains._shared.http import fetch_xml, fetch_xml_conditional
from app.source_engine.schemas import ParsedRow

logger = logging.getLogger(__name__)

# Atom namespace
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


async def fetch_rss_feed(url: str, max_items: int = 50, timeout: int = 15) -> list[ParsedRow]:
    """
    Fetch and parse a standard RSS 2.0 or Atom feed.
    Returns list of ParsedRow dicts compatible with ingest_articles().
    """
    try:
        content = await fetch_xml(url, timeout=timeout)
        root = etree.fromstring(content)
    except Exception as e:
        logger.warning(f"RSS fetch failed ({url[:60]}): {e}")
        return []


async def fetch_rss_feed_conditional(
    url: str,
    *,
    etag: str | None = None,
    last_modified: str | None = None,
    max_items: int = 30,
    timeout: int = 6,
) -> tuple[list[ParsedRow] | None, str | None, str | None]:
    """Fetch RSS with conditional request. Returns (rows, new_etag, new_last_modified).
    rows is None on 304 Not Modified (feed unchanged)."""
    try:
        content, new_etag, new_lm = await fetch_xml_conditional(
            url, etag=etag, last_modified=last_modified, timeout=timeout,
        )
        if content is None:
            return None, new_etag, new_lm
        root = etree.fromstring(content)
    except Exception as e:
        logger.warning(f"RSS fetch failed ({url[:60]}): {e}")
        raise

    tag = root.tag.lower().split("}")[-1] if "}" in root.tag else root.tag.lower()
    rows = _parse_atom(root, max_items) if tag == "feed" else _parse_rss(root, max_items)
    return rows, new_etag, new_lm

    # Detect format: RSS 2.0 vs Atom
    tag = root.tag.lower().split("}")[-1] if "}" in root.tag else root.tag.lower()

    if tag == "feed":
        return _parse_atom(root, max_items)
    else:
        return _parse_rss(root, max_items)


def _parse_rss(root: etree._Element, max_items: int) -> list[ParsedRow]:
    """Parse RSS 2.0 feed."""
    items = root.xpath("//item")
    rows: list[ParsedRow] = []
    for item in items[:max_items]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not title or not link:
            continue
        rows.append({
            "title": title,
            "description": (item.findtext("description") or "")[:500],
            "link": link,
            "pubDate": item.findtext("pubDate") or item.findtext("dc:date") or "",
            "source": item.findtext("source") or "",
        })
    return rows


def _parse_atom(root: etree._Element, max_items: int) -> list[ParsedRow]:
    """Parse Atom feed."""
    entries = root.xpath("//atom:entry", namespaces=ATOM_NS)
    if not entries:
        # Try without namespace (some feeds don't use it properly)
        entries = root.xpath("//entry")
    rows: list[ParsedRow] = []
    for entry in entries[:max_items]:
        title = (entry.findtext("atom:title", namespaces=ATOM_NS)
                 or entry.findtext("title") or "").strip()
        # Atom links are in <link href="..."/>
        link_el = entry.find("atom:link[@href]", namespaces=ATOM_NS)
        if link_el is None:
            link_el = entry.find("link[@href]")
        link = (link_el.get("href", "") if link_el is not None else "").strip()
        if not title or not link:
            continue

        desc = (entry.findtext("atom:summary", namespaces=ATOM_NS)
                or entry.findtext("summary")
                or entry.findtext("atom:content", namespaces=ATOM_NS)
                or entry.findtext("content") or "")[:500]

        pub = (entry.findtext("atom:published", namespaces=ATOM_NS)
               or entry.findtext("published")
               or entry.findtext("atom:updated", namespaces=ATOM_NS)
               or entry.findtext("updated") or "")

        rows.append({
            "title": title,
            "description": desc,
            "link": link,
            "pubDate": pub,
            "source": "",
        })
    return rows
