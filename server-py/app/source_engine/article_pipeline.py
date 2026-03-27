"""
Article ingestion pipeline:
  fetch RSS → detect lang → classify (keywords) → translate if needed → NER → store indexed.

Inspired by marifa entity extraction (Gemini Flash one-shot JSON)
and WM v1 keyword classifier.
"""

import hashlib
import json
import logging
import re
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.source_engine.classifier import classify
from app.source_engine.detector import _call_gemini
from app.source_engine.schemas import ParsedRow

logger = logging.getLogger(__name__)

# ── Language detection (heuristic, no LLM) ──────────────────────

_FR_MARKERS = re.compile(
    r"\b(le|la|les|des|une|dans|pour|avec|sur|est|sont|qui|que|cette|mais|pas|nous|vous|ils|ont|aux)\b",
    re.I,
)
_EN_MARKERS = re.compile(
    r"\b(the|is|are|was|were|has|have|been|will|would|could|should|their|from|with|this|that|said)\b",
    re.I,
)
_DE_MARKERS = re.compile(r"\b(der|die|das|und|ist|ein|eine|für|mit|auf|von|den|dem|sich|nach|über)\b", re.I)
_ES_MARKERS = re.compile(r"\b(el|la|los|las|del|por|con|para|una|que|como|más|fue|son|han)\b", re.I)
_AR_MARKERS = re.compile(r"[\u0600-\u06FF]{3,}")
_JA_MARKERS = re.compile(r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{2,}")

TARGET_LANGS = {"en", "fr"}  # Don't translate these


def detect_lang(text: str) -> str:
    """Simple heuristic language detection. Returns ISO 639-1 code."""
    if _AR_MARKERS.search(text):
        return "ar"
    if _JA_MARKERS.search(text):
        return "ja"

    words = text.split()
    if len(words) < 3:
        return "en"

    fr = len(_FR_MARKERS.findall(text))
    en = len(_EN_MARKERS.findall(text))
    de = len(_DE_MARKERS.findall(text))
    es = len(_ES_MARKERS.findall(text))

    scores = {"fr": fr, "en": en, "de": de, "es": es}
    best = max(scores, key=scores.get)  # type: ignore
    return best if scores[best] >= 2 else "en"


# ── Translation (Gemini Flash batch) ────────────────────────────

TRANSLATE_PROMPT = """Translate the following news headlines to English.
Return ONLY a JSON array of translated strings, same order as input.
Do not add explanations.

Headlines:
{headlines}"""


async def translate_batch(texts: list[str], source_lang: str) -> list[str]:
    """Translate a batch of texts to English using Gemini Flash."""
    if not texts:
        return []
    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))
    try:
        raw = await _call_gemini(TRANSLATE_PROMPT.format(headlines=numbered))
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        result = json.loads(cleaned.strip())
        if isinstance(result, list) and len(result) == len(texts):
            return result
    except Exception as e:
        logger.warning(f"Translation failed: {e}")
    return texts  # Fallback: return originals


# ── Unified enrichment (single LLM call: NER + sentiment + summary + tags + countries) ──

ENRICH_PROMPT = """Analyze these news headlines. Return ONLY valid JSON (no markdown).

Headlines:
{headlines}

Return this exact JSON structure:
{{
  "articles": [
    {{
      "index": 0,
      "title_en": "English translation of headline (if already English, copy as-is)",
      "persons": ["Name1", "Name2"],
      "organizations": ["NATO", "OPEC"],
      "country_codes": ["US", "UA", "RU"],
      "countries_mentioned": ["United States", "Ukraine", "Russia"],
      "theme": "conflict|economic|tech|military|disaster|health|cyber|diplomatic|protest|crime|environmental|infrastructure|terrorism|general",
      "tags": ["nuclear", "diplomacy", "sanctions"],
      "sentiment": "positive|negative|neutral",
      "summary": "Brief 1-2 sentence summary of the headline's topic and significance."
    }}
  ]
}}

Rules:
- title_en: translate to English if not already English. Keep original if already in English.
- country_codes: ISO 3166-1 alpha-2 (US, FR, UA, RU, CN, IR, etc.)
- countries_mentioned: full country names in English (United States, France, Ukraine, etc.)
- persons: only named individuals (leaders, officials, CEOs)
- organizations: political bodies, companies, military alliances, NGOs
- theme: pick the single most relevant category from the list
- tags: 1-5 specific topic keywords (lowercase, e.g. "nuclear", "oil prices", "ai regulation")
- sentiment: overall tone of the headline
- summary: 1-2 sentences explaining what the article is about
- If unsure, use empty arrays and "general"/"neutral"
"""

_EMPTY_ENRICHMENT = {
    "title_en": "", "persons": [], "organizations": [], "country_codes": [],
    "countries_mentioned": [], "theme": "general", "tags": [],
    "sentiment": "neutral", "summary": "",
}


async def enrich_batch(titles: list[str]) -> list[dict]:
    """Enrich a batch of headlines in a single LLM call."""
    if not titles:
        return []
    numbered = "\n".join(f"{i}. {t}" for i, t in enumerate(titles))
    try:
        raw = await _call_gemini(ENRICH_PROMPT.format(headlines=numbered))
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        data = json.loads(cleaned.strip())
        articles = data.get("articles", [])
        by_index = {a["index"]: a for a in articles}
        return [
            {**_EMPTY_ENRICHMENT, **by_index.get(i, {})}
            for i in range(len(titles))
        ]
    except Exception as e:
        logger.warning(f"Enrichment failed: {e}")
    return [dict(_EMPTY_ENRICHMENT) for _ in titles]


# ── Full pipeline ───────────────────────────────────────────────

def _hash_article(link: str) -> str:
    return hashlib.sha256(link.encode()).hexdigest()


async def ingest_articles(
    db: AsyncSession,
    source_id: str,
    rows: list[ParsedRow],
) -> int:
    """
    Full pipeline: classify → detect lang → translate → NER → store.
    Returns number of new articles inserted.
    """
    if not rows:
        return 0

    # Step 0: Dedup — skip articles already in DB
    links = [str(r.get("link", "") or r.get("url", "")) for r in rows]
    hashes = [_hash_article(link) for link in links]
    existing = set()
    for h in hashes:
        result = await db.scalar(select(Article.hash).where(Article.hash == h))
        if result:
            existing.add(h)

    new_rows = [(r, h, link) for r, h, link in zip(rows, hashes, links) if h not in existing]
    if not new_rows:
        return 0

    # Step 1: Keyword classification (local, instant — no LLM)
    classifications = []
    for r, _, _ in new_rows:
        title = str(r.get("title", ""))
        desc = str(r.get("description", "") or "")
        classifications.append(classify(title, desc))

    # Step 2: Language detection
    titles = [str(r.get("title", "")) for r, _, _ in new_rows]
    langs = [detect_lang(t) for t in titles]

    # Step 3: Unified enrichment (single LLM call: translate + NER + sentiment + summary + tags)
    all_enriched: list[dict] = []
    for batch_start in range(0, len(titles), 10):
        batch = titles[batch_start:batch_start + 10]
        enriched = await enrich_batch(batch)
        all_enriched.extend(enriched)

    # Step 4: Store
    inserted = 0
    for i, (r, h, link) in enumerate(new_rows):
        title = titles[i]
        enriched = all_enriched[i] if i < len(all_enriched) else dict(_EMPTY_ENRICHMENT)
        cls = classifications[i]

        # Merge keyword theme with LLM theme (keyword wins if not "general")
        theme = cls["theme"] if cls["theme"] != "general" else enriched.get("theme", "general")

        # Combine entities
        entities = enriched.get("persons", []) + enriched.get("organizations", [])
        country_codes = enriched.get("country_codes", [])
        countries_mentioned = enriched.get("countries_mentioned", [])

        # Translation from enrichment
        title_en = enriched.get("title_en", "")
        translated = title_en if (title_en and title_en != title) else None

        # Parse pub_date
        pub_date = None
        raw_date = r.get("pubDate") or r.get("pub_date") or r.get("date")
        if raw_date:
            try:
                if isinstance(raw_date, (int, float)):
                    pub_date = datetime.fromtimestamp(raw_date / 1000, tz=timezone.utc)
                else:
                    from email.utils import parsedate_to_datetime
                    pub_date = parsedate_to_datetime(str(raw_date))
            except Exception:
                pass

        article = Article(
            hash=h,
            source_id=source_id,
            title=title,
            title_translated=translated,
            description=str(r.get("description", "") or "")[:500],
            link=link,
            pub_date=pub_date,
            lang=langs[i],
            threat_level=cls["threat_level"],
            theme=theme,
            confidence=cls["confidence"],
            entities_json=json.dumps(entities) if entities else None,
            country_codes_json=json.dumps(country_codes) if country_codes else None,
            sentiment=enriched.get("sentiment"),
            summary=enriched.get("summary"),
            tags_json=json.dumps(enriched.get("tags", [])) if enriched.get("tags") else None,
            countries_mentioned_json=json.dumps(countries_mentioned) if countries_mentioned else None,
        )
        db.add(article)
        inserted += 1

    await db.commit()
    return inserted
