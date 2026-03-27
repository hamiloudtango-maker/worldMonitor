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


async def _enrich_intel_models(db: AsyncSession, result: dict) -> int:
    """Enrich intel_models catalog from weekly article analysis.

    1. Update article_count for existing models (how many articles match their aliases)
    2. Detect new entities/topics from trending data that aren't in the catalog
    3. Ask LLM to propose new models with aliases for the top unknowns
    """
    from sqlalchemy import select, update
    from app.models.intel_model import IntelModel
    from app.source_engine.detector import _call_gemini
    import re

    # Load existing models
    existing = await db.execute(select(IntelModel))
    models = existing.scalars().all()
    model_names_lower = {m.name.lower() for m in models}
    all_aliases_lower = set()
    for m in models:
        all_aliases_lower.add(m.name.lower())
        for a in (m.aliases or []):
            all_aliases_lower.add(a.lower())

    # 1. Update article counts — count articles matching each model's aliases
    from sqlalchemy import text
    updated_counts = 0
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    for m in models:
        terms = [m.name] + (m.aliases or [])
        or_clauses = []
        for t in terms[:20]:  # limit to avoid huge queries
            safe = t.lower().replace("'", "")
            if len(safe) >= 3:
                or_clauses.append(f"LOWER(title || ' ' || COALESCE(description, '')) LIKE '%{safe}%'")
        if not or_clauses:
            continue
        where = " OR ".join(or_clauses)
        count_result = await db.execute(
            text(f"SELECT COUNT(*) FROM articles WHERE created_at > :cutoff AND ({where})"),
            {"cutoff": cutoff},
        )
        count = count_result.scalar() or 0
        if count != m.article_count:
            await db.execute(
                update(IntelModel).where(IntelModel.id == m.id).values(article_count=count)
            )
            updated_counts += 1

    # 2. Find trending entities/tags NOT in the catalog
    trending_entities = result.get("trending_entities", [])
    trending_tags = result.get("trending_tags", [])
    trending_countries = result.get("trending_countries", [])

    unknown_entities = []
    for item in trending_entities[:30]:
        name = item["name"]
        if name.lower() not in all_aliases_lower and len(name) >= 3 and item["count"] >= 5:
            unknown_entities.append({"name": name, "count": item["count"], "type": "entity"})
    for item in trending_tags[:20]:
        name = item["name"]
        if name.lower() not in all_aliases_lower and len(name) >= 3 and item["count"] >= 5:
            unknown_entities.append({"name": name, "count": item["count"], "type": "tag"})
    for item in trending_countries[:15]:
        name = item["name"]
        if name.lower() not in all_aliases_lower and len(name) >= 3 and item["count"] >= 5:
            unknown_entities.append({"name": name, "count": item["count"], "type": "country"})

    # 3. Ask LLM to propose new models for the top unknowns
    new_models = 0
    if unknown_entities[:15]:
        try:
            prompt = f"""You are building an OSINT intelligence model catalog. Below are trending entities/topics detected in news articles this week that are NOT yet in our catalog.

For each, propose: name, family (foundation/market/threat/risk), section, description (1 sentence), and aliases (synonyms, translations in English, French, and the relevant language for the subject). Every alias must be at least 3 characters.

Only propose entities that are clearly identifiable (companies, organizations, people, technologies, geopolitical concepts). Skip generic words.

Trending unknowns:
{json.dumps(unknown_entities[:15], ensure_ascii=False)}

Return ONLY a JSON array (no markdown):
[{{"name": "...", "family": "...", "section": "...", "description": "...", "aliases": ["...", "..."]}}]
If none are worth adding, return []."""

            raw = await _call_gemini(prompt)
            cleaned = raw.strip()
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            # Fix truncated JSON
            try:
                proposals = json.loads(cleaned)
            except json.JSONDecodeError:
                fixed = cleaned
                fixed += ']' * (fixed.count('[') - fixed.count(']'))
                fixed += '}' * (fixed.count('{') - fixed.count('}'))
                fixed = re.sub(r',\s*([}\]])', r'\1', fixed)
                proposals = json.loads(fixed)

            for p in proposals:
                if not isinstance(p, dict) or 'name' not in p:
                    continue
                if p['name'].lower() in model_names_lower:
                    continue
                model = IntelModel(
                    name=p['name'],
                    family=p.get('family', 'market'),
                    section=p.get('section', 'Trends'),
                    description=p.get('description'),
                    aliases=p.get('aliases', []),
                    origin='ai_enriched',
                )
                db.add(model)
                model_names_lower.add(p['name'].lower())
                new_models += 1

        except Exception as e:
            logger.warning(f"Intel model enrichment LLM failed: {e}")

    # 4. Cleanup: delete ai_enriched models not used in 30 days
    deleted = 0
    cutoff_30d = datetime.now(timezone.utc) - timedelta(days=30)
    stale = await db.execute(
        select(IntelModel).where(
            IntelModel.origin == "ai_enriched",
            (IntelModel.last_used_at == None) | (IntelModel.last_used_at < cutoff_30d),
            IntelModel.created_at < cutoff_30d,
        )
    )
    for m in stale.scalars().all():
        await db.delete(m)
        deleted += 1

    if updated_counts or new_models or deleted:
        await db.commit()

    logger.info(f"Intel models: {updated_counts} counts updated, {new_models} new, {deleted} stale deleted")
    return new_models


async def run_weekly_analysis(db: AsyncSession) -> dict:
    """Run analysis, name clusters with LLM, enrich intel models, cache to disk."""
    result = await analyze_categories(db, days=7)

    # LLM pass: name clusters properly
    result["categories"] = await _name_clusters_with_llm(result["categories"])

    # Enrich intel models catalog from trending data
    new_models = await _enrich_intel_models(db, result)
    result["new_intel_models"] = new_models

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
