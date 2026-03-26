"""
Google News RSS — dynamic feed generation by theme/country.
Fallback to GDELT if Google blocks (429/captcha).
"""

import logging

from lxml import etree

from app.domains._shared.http import fetch_xml, now_iso
from app.source_engine.gdelt import fetch_gdelt
from app.source_engine.schemas import ParsedRow

logger = logging.getLogger(__name__)

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"

# Pre-built queries per theme
THEME_SEARCHES = {
    "conflict": "war OR conflict OR military strike",
    "economic": "economy OR markets OR trade OR GDP",
    "tech": "technology OR AI OR startup",
    "disaster": "earthquake OR hurricane OR flood OR wildfire",
    "health": "pandemic OR disease OR health crisis",
    "diplomatic": "diplomacy OR summit OR treaty",
    "climate": "climate change OR emissions OR renewable",
    "military": "military OR defense OR missile",
    "cyber": "cybersecurity OR hack OR data breach",
}


async def fetch_google_news(
    query: str = "",
    theme: str = "",
    country: str = "",
    lang: str = "en",
    max_items: int = 50,
) -> list[ParsedRow]:
    """
    Fetch from Google News RSS. Falls back to GDELT on failure.
    """
    # Build search query
    parts = []
    if query:
        parts.append(query)
    if theme and theme in THEME_SEARCHES:
        parts.append(THEME_SEARCHES[theme])
    if country:
        parts.append(country)

    q = " ".join(parts) if parts else "world news"
    q += " when:7d"  # Last 7 days

    # Map lang to Google News hl param
    hl_map = {"en": "en-US", "fr": "fr-FR", "de": "de-DE", "es": "es-ES", "ar": "ar-SA", "ja": "ja-JP"}
    hl = hl_map.get(lang, "en-US")

    try:
        content = await fetch_xml(
            f"{GOOGLE_NEWS_RSS}?q={q}&hl={hl}&gl=US&ceid=US:en",
            timeout=10,
        )
        root = etree.fromstring(content)
        items = root.xpath("//item")

        rows: list[ParsedRow] = []
        for item in items[:max_items]:
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")
            source = item.findtext("source", "")

            # Google News titles often end with " - Source Name"
            clean_title = title.rsplit(" - ", 1)[0] if " - " in title else title

            rows.append({
                "title": clean_title,
                "description": f"via {source}" if source else "",
                "link": link,
                "pubDate": pub_date,
                "source": source,
            })

        if rows:
            logger.info(f"Google News: {len(rows)} articles for q='{q[:40]}'")
            return rows

    except Exception as e:
        logger.warning(f"Google News failed (q='{q[:30]}'): {e}, falling back to GDELT")

    # Fallback to GDELT
    return await fetch_gdelt(query=query, theme=theme, country=country)
