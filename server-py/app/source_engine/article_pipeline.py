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


# ── NER extraction (Gemini Flash, marifa-inspired) ──────────────

NER_PROMPT = """Extract entities from these news headlines. Return ONLY valid JSON.

Headlines:
{headlines}

Return this exact JSON structure:
{{
  "articles": [
    {{
      "index": 0,
      "persons": ["Name1", "Name2"],
      "organizations": ["NATO", "OPEC"],
      "countries": ["US", "UA", "RU"],
      "theme": "conflict|economic|tech|military|disaster|health|cyber|diplomatic|protest|crime|environmental|infrastructure|terrorism|general"
    }}
  ]
}}

Rules:
- countries: use ISO 3166-1 alpha-2 codes (US, FR, UA, RU, CN, IR, etc.)
- persons: only named individuals (leaders, officials, CEOs)
- organizations: political bodies, companies, military alliances, NGOs
- theme: pick the single most relevant category
- If unsure, use empty arrays and "general"
"""


async def extract_entities_batch(titles: list[str]) -> list[dict]:
    """Extract NER entities from a batch of titles using Gemini Flash."""
    if not titles:
        return []
    numbered = "\n".join(f"{i}. {t}" for i, t in enumerate(titles))
    try:
        raw = await _call_gemini(NER_PROMPT.format(headlines=numbered))
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        data = json.loads(cleaned.strip())
        articles = data.get("articles", [])
        # Build index-based lookup
        by_index = {a["index"]: a for a in articles}
        return [
            by_index.get(i, {"persons": [], "organizations": [], "countries": [], "theme": "general"})
            for i in range(len(titles))
        ]
    except Exception as e:
        logger.warning(f"NER extraction failed: {e}")
    return [{"persons": [], "organizations": [], "countries": [], "theme": "general"}] * len(titles)


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

    # Step 1: Keyword classification (local, instant)
    classifications = []
    for r, _, _ in new_rows:
        title = str(r.get("title", ""))
        desc = str(r.get("description", "") or "")
        classifications.append(classify(title, desc))

    # Step 2: Language detection
    titles = [str(r.get("title", "")) for r, _, _ in new_rows]
    langs = [detect_lang(t) for t in titles]

    # Step 3: Translate non-EN/FR titles
    to_translate_idx = [i for i, lang in enumerate(langs) if lang not in TARGET_LANGS and titles[i]]
    translated = dict.fromkeys(range(len(titles)))

    if to_translate_idx:
        batch = [titles[i] for i in to_translate_idx]
        results = await translate_batch(batch, "multi")
        for idx, result in zip(to_translate_idx, results):
            translated[idx] = result

    # Step 4: NER extraction (batch all titles — use translated when available)
    ner_titles = [translated.get(i) or titles[i] for i in range(len(titles))]
    # Batch in groups of 10
    all_ner: list[dict] = []
    for batch_start in range(0, len(ner_titles), 10):
        batch = ner_titles[batch_start:batch_start + 10]
        ner_results = await extract_entities_batch(batch)
        all_ner.extend(ner_results)

    # Step 5: Store
    inserted = 0
    for i, (r, h, link) in enumerate(new_rows):
        title = titles[i]
        ner = all_ner[i] if i < len(all_ner) else {}
        cls = classifications[i]

        # Merge NER theme with keyword theme (keyword wins if not "general")
        theme = cls["theme"] if cls["theme"] != "general" else ner.get("theme", "general")

        # Combine entities
        entities = ner.get("persons", []) + ner.get("organizations", [])
        countries = ner.get("countries", [])

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
            title_translated=translated.get(i),
            description=str(r.get("description", "") or "")[:500],
            link=link,
            pub_date=pub_date,
            lang=langs[i],
            threat_level=cls["threat_level"],
            theme=theme,
            confidence=cls["confidence"],
            entities_json=json.dumps(entities) if entities else None,
            country_codes_json=json.dumps(countries) if countries else None,
        )
        db.add(article)
        inserted += 1

    await db.commit()
    return inserted
