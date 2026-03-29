"""
Article ingestion pipeline:
  fetch RSS → detect lang → classify (keywords) → translate if needed → NER → store indexed.

Two modes:
  - ingest_articles(): full pipeline per-source (used by individual feed ingest)
  - dedup_and_prepare() + enrich_and_store(): split pipeline for batch catalog ingest
    (dedup+classify locally, then one big LLM batch across all feeds)
"""

import hashlib
import json
import logging
import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.source_engine.classifier import classify
from app.source_engine.detector import _call_gemini, call_gemini, get_gemini_token
from app.source_engine.schemas import ParsedRow

logger = logging.getLogger(__name__)

# Max headlines per LLM call — Gemini Flash outputs ~200 tokens/article,
# with max_tokens=8192 we can safely fit ~35 articles per call.
LLM_BATCH_SIZE = 15

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
      "family": "politics",
      "section": "Geopolitics",
      "persons": ["Name1", "Name2"],
      "organizations": ["NATO", "OPEC"],
      "country_codes": ["US", "UA", "RU"],
      "countries_mentioned": ["United States", "Ukraine", "Russia"],
      "tags": ["nuclear", "diplomacy", "sanctions"],
      "sentiment": "positive|negative|neutral",
      "summary": "Brief 1-2 sentence summary of the headline's topic and significance."
    }}
  ]
}}

TAXONOMY — pick ONE family + section per article:
  politics: Geopolitics, Governance, Legal & Regulation, Conflicts & Crises, Social Movements, Intelligence & Influence
  economy: Macroeconomics, Finance & Markets, Trade & Commodities, Supply Chains, Infrastructure, Agriculture & Food, Corporate, Employment
  defense: Military, Armament, Terrorism, Nuclear Weapons
  technology: Digital & AI, Hardware, Telecom, Space, Platforms & Internet, Science & Research
  cyber: Attacks, Threat Actors, Vulnerabilities, Detection, Cyber Policy
  energy: Fossil, Nuclear, Renewables, Energy Markets, Policy & Grid
  health: Diseases, Pharma & Biotech, Public Health, Healthcare Systems
  environment: Climate, Disasters, Sustainability, Resources
  society: Migration, Rights & Justice, Organized Crime, Education & Culture, Religion, Information & Media, Labor
  mute: Noise, Entertainment

Rules:
- family + section: classify the article into the MOST relevant family and section from the taxonomy above
- title_en: translate to English if not already English. Keep original if already in English.
- country_codes: ISO 3166-1 alpha-2 (US, FR, UA, RU, CN, IR, etc.)
- countries_mentioned: full country names in English (United States, France, Ukraine, etc.)
- persons: only named individuals (leaders, officials, CEOs)
- organizations: political bodies, companies, military alliances, NGOs
- tags: 1-5 specific topic keywords (lowercase, e.g. "nuclear", "oil prices", "ai regulation")
- sentiment: overall tone of the headline
- summary: 1-2 sentences explaining what the article is about
- Sports, job postings, celebrity gossip → mute/Noise or mute/Entertainment
- If unsure, use "economy" / "Corporate" as default
"""

_EMPTY_ENRICHMENT = {
    "title_en": "", "family": "economy", "section": "Corporate",
    "persons": [], "organizations": [], "country_codes": [],
    "countries_mentioned": [], "tags": [],
    "sentiment": "neutral", "summary": "",
}


async def enrich_batch(titles: list[str], *, client=None, token=None) -> list[dict]:
    """Enrich a batch of headlines in a single LLM call."""
    if not titles:
        return []
    numbered = "\n".join(f"{i}. {t}" for i, t in enumerate(titles))
    try:
        raw = await call_gemini(ENRICH_PROMPT.format(headlines=numbered), client=client, token=token)
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


# ── Helpers ──────────────────────────────────────────────────────

def _hash_article(link: str) -> str:
    return hashlib.sha256(link.encode()).hexdigest()


def _parse_pub_date(r: dict) -> datetime | None:
    raw_date = r.get("pubDate") or r.get("pub_date") or r.get("date")
    if not raw_date:
        return None
    try:
        if isinstance(raw_date, (int, float)):
            return datetime.fromtimestamp(raw_date / 1000, tz=timezone.utc)
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(str(raw_date))
    except Exception:
        return None


def _build_article(
    source_id: str, row: dict, h: str, link: str,
    title: str, lang: str, cls: dict, enriched: dict,
) -> Article:
    persons = enriched.get("persons", [])
    organizations = enriched.get("organizations", [])
    entities = persons + organizations
    country_codes = enriched.get("country_codes", [])
    countries_mentioned = enriched.get("countries_mentioned", [])
    title_en = enriched.get("title_en", "")
    translated = title_en if (title_en and title_en != title) else None

    # Validate family/section against taxonomy
    from app.domains.ai_feeds.taxonomy import is_valid
    family = enriched.get("family", "economy")
    section = enriched.get("section", "Corporate")
    if not is_valid(family, section):
        family, section = "economy", "Corporate"

    # theme from classifier as fallback, family/section from Gemini is primary
    theme = cls["theme"] if cls["theme"] != "general" else family

    return Article(
        hash=h,
        source_id=source_id,
        title=title,
        title_translated=translated,
        description=str(row.get("description", "") or "")[:500],
        link=link,
        pub_date=_parse_pub_date(row),
        lang=lang,
        threat_level=cls["threat_level"],
        theme=theme,
        confidence=cls["confidence"],
        family=family,
        section=section,
        entities_json=json.dumps(entities) if entities else None,
        persons_json=json.dumps(persons) if persons else None,
        orgs_json=json.dumps(organizations) if organizations else None,
        country_codes_json=json.dumps(country_codes) if country_codes else None,
        sentiment=enriched.get("sentiment"),
        summary=enriched.get("summary"),
        tags_json=json.dumps(enriched.get("tags", [])) if enriched.get("tags") else None,
        countries_mentioned_json=json.dumps(countries_mentioned) if countries_mentioned else None,
    )


# ── Full pipeline (single source) ───────────────────────────────

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

    # Step 0: Dedup — skip articles already in DB (batch query)
    links = [str(r.get("link", "") or r.get("url", "")) for r in rows]
    hashes = [_hash_article(link) for link in links]
    existing_result = await db.scalars(
        select(Article.hash).where(Article.hash.in_(hashes))
    )
    existing = set(existing_result.all())

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

    # Step 3: Unified enrichment (LLM batch: translate + NER + sentiment + summary + tags)
    all_enriched: list[dict] = []
    for batch_start in range(0, len(titles), LLM_BATCH_SIZE):
        batch = titles[batch_start:batch_start + LLM_BATCH_SIZE]
        enriched = await enrich_batch(batch)
        all_enriched.extend(enriched)

    # Step 4: Store
    new_articles: list[Article] = []
    for i, (r, h, link) in enumerate(new_rows):
        enriched = all_enriched[i] if i < len(all_enriched) else dict(_EMPTY_ENRICHMENT)
        art = _build_article(source_id, r, h, link, titles[i], langs[i], classifications[i], enriched)
        db.add(art)
        new_articles.append(art)

    await db.commit()

    # Match new articles against Intel Models (FlashText + Gemma)
    if new_articles:
        try:
            from app.source_engine.matching_engine import match_articles, store_matches
            matches = match_articles(new_articles)
            if matches:
                await store_matches(db, matches)
                await db.commit()
        except Exception:
            logger.debug("model matching after ingest_articles skipped", exc_info=True)

    # Delta-match new articles against all active cases
    if new_articles:
        try:
            from app.domains.cases.matching import match_new_articles
            await match_new_articles(db, [a.id for a in new_articles])
            await db.commit()
        except Exception:
            logger.debug("case matching after ingest_articles skipped", exc_info=True)

    return len(new_articles)


# ── Split pipeline for catalog batch ingest ──────────────────────

class PreparedArticle:
    """Article that passed dedup + classify, ready for LLM enrichment."""
    __slots__ = ("source_id", "row", "hash", "link", "title", "lang", "classification")

    def __init__(self, source_id: str, row: dict, h: str, link: str, title: str, lang: str, cls: dict):
        self.source_id = source_id
        self.row = row
        self.hash = h
        self.link = link
        self.title = title
        self.lang = lang
        self.classification = cls


async def dedup_and_prepare(
    db: AsyncSession,
    source_id: str,
    rows: list[ParsedRow],
) -> list[PreparedArticle]:
    """Dedup + classify locally (no LLM). Returns prepared articles ready for enrichment."""
    if not rows:
        return []

    links = [str(r.get("link", "") or r.get("url", "")) for r in rows]
    hashes = [_hash_article(link) for link in links]
    existing_result = await db.scalars(
        select(Article.hash).where(Article.hash.in_(hashes))
    )
    existing = set(existing_result.all())

    prepared = []
    for r, h, link in zip(rows, hashes, links):
        if h in existing:
            continue
        title = str(r.get("title", ""))
        desc = str(r.get("description", "") or "")
        cls = classify(title, desc)
        lang = detect_lang(title)
        prepared.append(PreparedArticle(source_id, r, h, link, title, lang, cls))

    return prepared


async def dedup_and_prepare_bulk(
    db: AsyncSession,
    feed_rows: list[tuple[str, list[ParsedRow]]],
) -> list[PreparedArticle]:
    """Dedup + classify ALL feeds in one DB query. Much faster than per-feed dedup."""
    if not feed_rows:
        return []

    # Collect all hashes across all feeds
    all_items: list[tuple[str, dict, str, str]] = []  # (source_id, row, hash, link)
    for source_id, rows in feed_rows:
        for r in rows:
            link = str(r.get("link", "") or r.get("url", ""))
            h = _hash_article(link)
            all_items.append((source_id, r, h, link))

    if not all_items:
        return []

    # One big dedup query
    all_hashes = [item[2] for item in all_items]
    # Query in chunks of 500 (SQLite variable limit)
    existing: set[str] = set()
    for i in range(0, len(all_hashes), 500):
        chunk = all_hashes[i:i + 500]
        result = await db.scalars(select(Article.hash).where(Article.hash.in_(chunk)))
        existing.update(result.all())

    # Classify only new articles
    prepared = []
    seen: set[str] = set()  # dedup within batch
    for source_id, r, h, link in all_items:
        if h in existing or h in seen:
            continue
        seen.add(h)
        title = str(r.get("title", ""))
        desc = str(r.get("description", "") or "")
        cls = classify(title, desc)
        lang = detect_lang(title)
        prepared.append(PreparedArticle(source_id, r, h, link, title, lang, cls))

    return prepared


async def enrich_and_store(
    db: AsyncSession,
    articles: list[PreparedArticle],
) -> int:
    """Enrich a batch of prepared articles via LLM, then store. Returns insert count."""
    if not articles:
        return 0

    # Dedup within batch (multiple feeds may have the same article)
    seen: set[str] = set()
    unique = []
    for a in articles:
        if a.hash not in seen:
            seen.add(a.hash)
            unique.append(a)
    articles = unique

    import httpx
    titles = [a.title for a in articles]

    # One token, one client for all LLM calls
    token = await get_gemini_token()
    all_enriched: list[dict] = []
    async with httpx.AsyncClient(timeout=30) as client:
        for batch_start in range(0, len(titles), LLM_BATCH_SIZE):
            batch = titles[batch_start:batch_start + LLM_BATCH_SIZE]
            enriched = await enrich_batch(batch, client=client, token=token)
            all_enriched.extend(enriched)

    new_articles: list[Article] = []
    for i, a in enumerate(articles):
        enriched = all_enriched[i] if i < len(all_enriched) else dict(_EMPTY_ENRICHMENT)
        art = _build_article(a.source_id, a.row, a.hash, a.link, a.title, a.lang, a.classification, enriched)
        db.add(art)
        new_articles.append(art)

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        return 0

    # Match new articles against Intel Models (FlashText + Gemma)
    if new_articles:
        try:
            from app.source_engine.matching_engine import match_articles, store_matches
            matches = match_articles(new_articles)
            if matches:
                await store_matches(db, matches)
                await db.commit()
        except Exception:
            logger.debug("model matching after ingest_articles skipped", exc_info=True)

    # Delta-match new articles against all active cases
    if new_articles:
        try:
            from app.domains.cases.matching import match_new_articles
            await match_new_articles(db, [a.id for a in new_articles])
            await db.commit()
        except Exception:
            logger.debug("case matching after enrich_and_store skipped", exc_info=True)

    return len(new_articles)
