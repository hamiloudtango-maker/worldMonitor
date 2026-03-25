"""
GDELT source — global news index with 3-day backfill.
API: https://api.gdeltproject.org/api/v2/doc/doc
Free, no auth, 250 articles per query.
"""

import logging

import httpx

from app.source_engine.schemas import ParsedRow

logger = logging.getLogger(__name__)

GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

# GDELT theme codes mapping
THEME_QUERIES = {
    "conflict": "conflict OR war OR military",
    "economic": "economy OR trade OR sanctions OR market",
    "tech": "technology OR AI OR cyber",
    "disaster": "earthquake OR hurricane OR flood OR wildfire",
    "health": "pandemic OR disease OR outbreak",
    "diplomatic": "diplomacy OR summit OR treaty OR UN",
    "climate": "climate OR emissions OR environmental",
    "military": "military OR missile OR troops OR defense",
    "terrorism": "terrorism OR attack OR bombing",
    "protest": "protest OR riot OR demonstration",
}

# Country code to query term
COUNTRY_QUERIES = {
    "US": "United States", "FR": "France", "UA": "Ukraine", "RU": "Russia",
    "CN": "China", "IR": "Iran", "IL": "Israel", "PS": "Palestine",
    "DE": "Germany", "GB": "United Kingdom", "JP": "Japan", "IN": "India",
    "BR": "Brazil", "TR": "Turkey", "SA": "Saudi Arabia", "KR": "South Korea",
}


async def fetch_gdelt(
    query: str = "",
    theme: str = "",
    country: str = "",
    timespan: str = "3d",
    max_records: int = 250,
) -> list[ParsedRow]:
    """Fetch articles from GDELT API. Returns parsed rows."""
    # Build query
    parts = []
    if query:
        parts.append(query)
    if theme and theme in THEME_QUERIES:
        parts.append(THEME_QUERIES[theme])
    if country and country.upper() in COUNTRY_QUERIES:
        parts.append(f'sourcecountry:{country.upper()}')

    if not parts:
        parts.append("world news")

    q = " ".join(parts)

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(
                GDELT_URL,
                params={
                    "query": q,
                    "mode": "artlist",
                    "maxrecords": max_records,
                    "timespan": timespan,
                    "format": "json",
                    "sort": "datedesc",
                },
                headers={"User-Agent": "Mozilla/5.0 (WorldMonitor)"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning(f"GDELT fetch failed: {e}")
        return []

    articles = data.get("articles", [])
    rows: list[ParsedRow] = []
    for a in articles:
        rows.append({
            "title": a.get("title", ""),
            "description": a.get("seendate", ""),
            "link": a.get("url", ""),
            "pubDate": a.get("seendate", ""),
            "source": a.get("domain", ""),
            "language": a.get("language", ""),
            "tone": a.get("tone", 0),
            "image": a.get("socialimage", ""),
        })

    return rows
