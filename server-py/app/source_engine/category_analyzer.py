"""
Weekly category analyzer — aggregates article metadata to generate dynamic feed categories.
Runs from existing enriched data (tags, themes, entities, countries) — no LLM needed.
"""
import json
import logging
from collections import Counter
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Minimum article count to surface a category
MIN_ARTICLES = 3


async def analyze_categories(db: AsyncSession, days: int = 7) -> dict:
    """Analyze recent articles and return dynamic categories with subcategories.

    Returns:
    {
        "generated_at": "...",
        "period_days": 7,
        "total_articles": 1234,
        "categories": [
            {
                "name": "Conflict",
                "article_count": 150,
                "subcategories": [
                    {"name": "Ukraine War", "article_count": 80, "keywords": ["Ukraine", "Russia", "Zelensky"]},
                    {"name": "Iran Strikes", "article_count": 45, "keywords": ["Iran", "Israel", "missile"]},
                ]
            },
        ],
        "trending_entities": [{"name": "Zelensky", "count": 45}, ...],
        "trending_countries": [{"name": "United States", "count": 200}, ...],
        "trending_tags": [{"name": "nuclear", "count": 60}, ...],
    }
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_str = cutoff.isoformat()

    # Count total
    total_result = await db.execute(
        text("SELECT COUNT(*) FROM articles WHERE created_at > :cutoff"),
        {"cutoff": cutoff_str},
    )
    total = total_result.scalar() or 0

    # Aggregate themes
    theme_rows = await db.execute(
        text("SELECT theme, COUNT(*) as cnt FROM articles WHERE created_at > :cutoff AND theme IS NOT NULL GROUP BY theme ORDER BY cnt DESC"),
        {"cutoff": cutoff_str},
    )
    themes = [(r[0], r[1]) for r in theme_rows.fetchall() if r[0] and r[0] != "general"]

    # Aggregate tags
    tag_rows = await db.execute(
        text("SELECT tags_json FROM articles WHERE created_at > :cutoff AND tags_json IS NOT NULL"),
        {"cutoff": cutoff_str},
    )
    tag_counter: Counter = Counter()
    for (tags_str,) in tag_rows.fetchall():
        try:
            tags = json.loads(tags_str)
            if isinstance(tags, list):
                for t in tags:
                    if t and len(t) >= 2:
                        tag_counter[t.lower()] += 1
        except (json.JSONDecodeError, TypeError):
            pass

    # Aggregate entities
    entity_rows = await db.execute(
        text("SELECT entities_json FROM articles WHERE created_at > :cutoff AND entities_json IS NOT NULL"),
        {"cutoff": cutoff_str},
    )
    entity_counter: Counter = Counter()
    for (ent_str,) in entity_rows.fetchall():
        try:
            entities = json.loads(ent_str)
            if isinstance(entities, list):
                for e in entities:
                    if e and len(e) >= 2:
                        entity_counter[e] += 1
        except (json.JSONDecodeError, TypeError):
            pass

    # Aggregate countries mentioned
    country_rows = await db.execute(
        text("SELECT countries_mentioned_json FROM articles WHERE created_at > :cutoff AND countries_mentioned_json IS NOT NULL"),
        {"cutoff": cutoff_str},
    )
    country_counter: Counter = Counter()
    for (c_str,) in country_rows.fetchall():
        try:
            countries = json.loads(c_str)
            if isinstance(countries, list):
                for c in countries:
                    if c and len(c) >= 2:
                        country_counter[c] += 1
        except (json.JSONDecodeError, TypeError):
            pass

    # Build categories from themes + subcategories from co-occurring tags
    categories = []
    for theme_name, theme_count in themes:
        if theme_count < MIN_ARTICLES:
            continue

        # Get tags that co-occur with this theme
        sub_rows = await db.execute(
            text("""
                SELECT tags_json FROM articles
                WHERE created_at > :cutoff AND theme = :theme AND tags_json IS NOT NULL
            """),
            {"cutoff": cutoff_str, "theme": theme_name},
        )
        sub_tags: Counter = Counter()
        for (tags_str,) in sub_rows.fetchall():
            try:
                tags = json.loads(tags_str)
                if isinstance(tags, list):
                    for t in tags:
                        if t and len(t) >= 2:
                            sub_tags[t.lower()] += 1
            except (json.JSONDecodeError, TypeError):
                pass

        subcategories = [
            {"name": tag, "article_count": count, "keywords": [tag]}
            for tag, count in sub_tags.most_common(10)
            if count >= MIN_ARTICLES
        ]

        # Enrich subcategories with top entities for this theme
        ent_rows = await db.execute(
            text("""
                SELECT entities_json FROM articles
                WHERE created_at > :cutoff AND theme = :theme AND entities_json IS NOT NULL
            """),
            {"cutoff": cutoff_str, "theme": theme_name},
        )
        theme_entities: Counter = Counter()
        for (ent_str,) in ent_rows.fetchall():
            try:
                entities = json.loads(ent_str)
                if isinstance(entities, list):
                    for e in entities:
                        if e and len(e) >= 2:
                            theme_entities[e] += 1
            except (json.JSONDecodeError, TypeError):
                pass

        # Add entity-based subcategories
        for ent, count in theme_entities.most_common(5):
            if count >= MIN_ARTICLES and not any(s["name"] == ent.lower() for s in subcategories):
                subcategories.append({"name": ent, "article_count": count, "keywords": [ent]})

        categories.append({
            "name": theme_name,
            "article_count": theme_count,
            "subcategories": subcategories[:15],
        })

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period_days": days,
        "total_articles": total,
        "categories": categories,
        "trending_entities": [{"name": e, "count": c} for e, c in entity_counter.most_common(30)],
        "trending_countries": [{"name": c, "count": n} for c, n in country_counter.most_common(30)],
        "trending_tags": [{"name": t, "count": c} for t, c in tag_counter.most_common(30)],
    }

    logger.info(f"Category analysis: {total} articles, {len(categories)} categories, {len(tag_counter)} unique tags")
    return result


# File cache for the analysis result
_CACHE_PATH = None

def _get_cache_path():
    global _CACHE_PATH
    if _CACHE_PATH is None:
        from pathlib import Path
        _CACHE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "category-analysis.json"
    return _CACHE_PATH


async def _name_clusters_with_llm(categories: list[dict]) -> list[dict]:
    """Use LLM to name subcategory clusters properly.
    Input subcategories have raw tag/entity names. LLM proposes human-readable names.
    Example: tags ["Iran", "nuclear", "IAEA"] → "Programme nucléaire iranien"
    """
    try:
        from app.source_engine.detector import _call_gemini
        import re

        # Build a compact summary for LLM
        clusters = []
        for cat in categories:
            for sub in cat.get("subcategories", []):
                clusters.append({
                    "theme": cat["name"],
                    "raw_name": sub["name"],
                    "keywords": sub.get("keywords", []),
                    "count": sub["article_count"],
                })

        if not clusters:
            return categories

        prompt = f"""You are an intelligence analyst. Below are topic clusters detected from news articles this week.
For each cluster, propose a clear, concise French label (2-5 words) that describes what the cluster is about.

Clusters:
{json.dumps(clusters[:30], ensure_ascii=False)}

Return ONLY a JSON array of objects with "raw_name" and "label" fields. No markdown.
Example: [{{"raw_name": "nuclear", "label": "Programme nucléaire"}}, {{"raw_name": "Iran", "label": "Tensions Iran-Occident"}}]
"""
        raw = await _call_gemini(prompt)
        cleaned = raw.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        labels = json.loads(cleaned.strip())

        # Build lookup
        label_map = {item["raw_name"]: item["label"] for item in labels if "raw_name" in item and "label" in item}

        # Apply labels
        for cat in categories:
            for sub in cat.get("subcategories", []):
                if sub["name"] in label_map:
                    sub["label"] = label_map[sub["name"]]
                    # Keep original name as keyword
                    if sub["name"] not in sub.get("keywords", []):
                        sub.setdefault("keywords", []).append(sub["name"])

        logger.info(f"LLM named {len(label_map)} subcategory clusters")
    except Exception as e:
        logger.warning(f"LLM cluster naming failed: {e}")

    return categories


async def run_weekly_analysis(db: AsyncSession) -> dict:
    """Run analysis, name clusters with LLM, cache to disk."""
    result = await analyze_categories(db, days=7)

    # LLM pass: name clusters properly
    result["categories"] = await _name_clusters_with_llm(result["categories"])

    path = _get_cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    logger.info(f"Weekly category analysis saved to {path}")
    return result


def get_cached_analysis() -> dict | None:
    """Read cached analysis from disk."""
    path = _get_cache_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return None
