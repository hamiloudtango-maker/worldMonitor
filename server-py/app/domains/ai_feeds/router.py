"""AI Feeds API — CRUD for feeds with query builder and source management."""

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.ai_feed import AIFeed, AIFeedSource, AIFeedResult
from app.domains.ai_feeds.schemas import (
    AIFeedCreate, AIFeedUpdate, AIFeedResponse,
    AIFeedSourceResponse, AIFeedResultResponse,
    SourceAdd, SourceToggle,
    ValidateUrlRequest, ValidateUrlResponse,
    CatalogEntry,
)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-feeds", tags=["ai-feeds"])


# ── Helpers ──────────────────────────────────────────────────
def _serialize_feed(feed: AIFeed, source_count: int = 0, result_count: int = 0) -> dict:
    return {
        "id": str(feed.id),
        "name": feed.name,
        "description": feed.description,
        "query": json.loads(feed.query) if feed.query else None,
        "ai_config": json.loads(feed.ai_config) if feed.ai_config else None,
        "status": feed.status,
        "is_template": feed.is_template,
        "source_count": source_count,
        "result_count": result_count,
        "created_at": feed.created_at.isoformat(),
        "updated_at": feed.updated_at.isoformat(),
    }


def _serialize_source(s: AIFeedSource) -> dict:
    return {
        "id": str(s.id),
        "url": s.url,
        "name": s.name,
        "lang": s.lang,
        "tier": s.tier,
        "source_type": s.source_type,
        "country": s.country,
        "continent": s.continent,
        "origin": s.origin,
        "enabled": s.enabled,
    }


async def _ensure_matching(db, model_layers: list[dict]) -> None:
    """Ensure articles are matched against the given models before querying.
    - Articles < 2 days: Gemini Flash (semantic)
    - Articles > 2 days: FlashText (exact keywords)
    """
    from sqlalchemy import text as sa_text
    from datetime import timedelta

    all_mids = []
    for layer in model_layers:
        all_mids.extend(m.replace("-", "") for m in layer.get("model_ids", []) if m)
    if not all_mids:
        return

    unique_mids = list(set(all_mids))

    # Find articles not yet matched against these models (last 30 days)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    two_days_ago = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

    from app.models.article import Article
    from app.models.article_model import ArticleModel
    from app.source_engine.matching_engine import match_articles_targeted, match_articles_gemini, store_matches

    # Find articles not already matched against these specific models
    # Using ORM to avoid UUID string/hex mismatch
    already_matched = select(ArticleModel.article_id).where(
        ArticleModel.model_id.in_([uuid.UUID(m) if len(m) == 32 else uuid.UUID(m) for m in unique_mids])
    )

    # Older articles (2-30 days) — FlashText
    older_articles = (await db.execute(
        select(Article)
        .where(Article.created_at > cutoff, Article.created_at <= two_days_ago)
        .where(Article.id.not_in(already_matched))
        .limit(1000)
    )).scalars().all()

    if older_articles:
        matches = match_articles_targeted(older_articles, unique_mids)
        if matches:
            await store_matches(db, matches)
            await db.commit()
        logger.info(f"FlashText matched {len(older_articles)} older articles -> {len(matches)} matches")

    # Recent articles (< 2 days) — Gemini Flash
    recent_articles = (await db.execute(
        select(Article)
        .where(Article.created_at > two_days_ago)
        .where(Article.id.not_in(already_matched))
        .limit(500)
    )).scalars().all()

    if recent_articles:
        matches = await match_articles_gemini(recent_articles, unique_mids, db)
        if matches:
            await store_matches(db, matches)
            await db.commit()
        logger.info(f"Gemini matched {len(recent_articles)} recent articles -> {len(matches)} matches")


async def _refresh_feed_results(db, feed_id, query_data: dict) -> int:
    """Run feed query against articles table and populate ai_feed_results.
    Supports new format (models: []) via article_models JOIN, and legacy (layers: []) via LIKE."""
    from sqlalchemy import text as sa_text

    # New format: model_layers with sequential AND/OR/NOT
    model_layers = query_data.get("model_layers", [])
    # Also support flat "models" format
    if not model_layers and query_data.get("models"):
        model_layers = [{"operator": "OR", "model_ids": query_data["models"]}]

    if model_layers:
        # Ensure matching is up to date for these models
        await _ensure_matching(db, model_layers)
        params = {}
        pidx = 0
        inner_sql = "SELECT id FROM articles"
        for layer in model_layers:
            mids = [m.replace("-", "") for m in layer.get("model_ids", []) if m]
            if not mids:
                continue
            placeholders = ",".join(f":p{pidx + i}" for i in range(len(mids)))
            for i, mid in enumerate(mids):
                params[f"p{pidx + i}"] = mid
            pidx += len(mids)
            layer_sql = f"SELECT article_id FROM article_models WHERE model_id IN ({placeholders})"
            if layer.get("operator") == "NOT":
                inner_sql = f"SELECT id FROM ({inner_sql}) sub WHERE id NOT IN ({layer_sql})"
            else:
                inner_sql = f"SELECT id FROM ({inner_sql}) sub WHERE id IN ({layer_sql})"

        result = await db.execute(
            sa_text(
                "SELECT a.title, a.link, a.source_id, a.pub_date, a.description, a.threat_level, a.theme "
                f"FROM articles a WHERE a.id IN ({inner_sql}) "
                "ORDER BY a.pub_date DESC LIMIT 500"
            ),
            params,
        )
    else:
        # Legacy format: LIKE
        from app.domains._shared.query_compiler import compile_query
        layers = query_data.get("layers", [])
        compiled = compile_query(layers) if layers else None
        if compiled is None:
            return 0
        where_clause, params = compiled
        result = await db.execute(
            sa_text(
                "SELECT title, link, source_id, pub_date, description, threat_level, theme "
                f"FROM articles WHERE {where_clause} "
                "ORDER BY pub_date DESC LIMIT 500"
            ),
            params,
        )
    rows = result.fetchall()
    if not rows:
        return 0

    # Get existing URLs to avoid duplicates
    existing = await db.execute(
        select(AIFeedResult.article_url).where(AIFeedResult.ai_feed_id == feed_id)
    )
    existing_urls = {r[0] for r in existing.all()}

    inserted = 0
    now = datetime.now(timezone.utc)
    for r in rows:
        url = r[1] or ""
        if not url or url in existing_urls:
            continue
        # Parse published_at — may be string from SQLite
        pub = r[3]
        if isinstance(pub, str):
            try:
                pub = datetime.fromisoformat(pub.replace(" ", "T"))
            except (ValueError, TypeError):
                pub = None
        result_entry = AIFeedResult(
            ai_feed_id=feed_id,
            article_url=url,
            title=r[0] or "",
            source_name=r[2] or "",
            published_at=pub,
            summary=(r[4] or "")[:500],
            threat_level=r[5],
            category=r[6],
            relevance_score=0.5,
            fetched_at=now,
        )
        db.add(result_entry)
        existing_urls.add(url)
        inserted += 1

    if inserted:
        await db.commit()
    return inserted


def _serialize_result(r: AIFeedResult) -> dict:
    return {
        "id": str(r.id),
        "article_url": r.article_url,
        "title": r.title,
        "source_name": r.source_name,
        "published_at": r.published_at.isoformat() if r.published_at else None,
        "relevance_score": r.relevance_score,
        "entities": json.loads(r.entities) if r.entities else None,
        "summary": r.summary,
        "threat_level": r.threat_level,
        "category": r.category,
        "fetched_at": r.fetched_at.isoformat(),
    }


# ── Source catalog (MUST be before /{feed_id} routes) ────────
@router.get("/catalog/sources")
async def list_catalog(
    country: str | None = None,
    continent: str | None = None,
    tag: str | None = None,
    lang: str | None = None,
    status_filter: str | None = None,
    q: str | None = None,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    from app.models.ai_feed import RssCatalogEntry
    query = select(RssCatalogEntry)

    if not include_inactive:
        query = query.where(RssCatalogEntry.active == True)
    if country:
        query = query.where(RssCatalogEntry.country.ilike(country))
    if continent:
        query = query.where(RssCatalogEntry.continent.ilike(continent))
    if lang:
        query = query.where(RssCatalogEntry.lang == lang)

    result = await db.execute(query)
    sources = result.scalars().all()

    catalog = []
    for s in sources:
        if tag and tag.lower() not in [t.lower() for t in (s.tags or [])]:
            continue
        if q:
            q_lower = q.lower()
            if q_lower not in s.name.lower() and q_lower not in (s.country or "").lower() and q_lower not in (s.url or "").lower():
                continue
        # Status filter
        if status_filter:
            st = _source_status(s)
            if status_filter != st:
                continue
        catalog.append(_serialize_catalog(s))

    return {"sources": catalog, "total": len(catalog)}


def _source_status(s) -> str:
    if not s.active:
        return "disabled"
    if s.fetch_error_count >= 10:
        return "error"
    if s.fetch_error_count >= 3:
        return "degraded"
    return "active"


def _serialize_catalog(s) -> dict:
    return {
        "id": str(s.id), "name": s.name, "url": s.url, "lang": s.lang,
        "tier": s.tier, "source_type": s.source_type, "country": s.country,
        "continent": s.continent, "tags": s.tags or [], "active": s.active,
        "description": s.description, "origin": s.origin,
        "last_fetched_at": s.last_fetched_at.isoformat() if s.last_fetched_at else None,
        "fetch_error_count": s.fetch_error_count,
        "last_error": getattr(s, 'last_error', None),
        "status": _source_status(s),
    }


@router.patch("/catalog/{source_id}")
async def update_catalog_source(
    source_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Update a catalog source's metadata."""
    import uuid as _uuid
    from app.models.ai_feed import RssCatalogEntry
    entry = await db.get(RssCatalogEntry, _uuid.UUID(source_id))
    if not entry:
        raise HTTPException(404, "Source not found")

    allowed = {"name", "tags", "tier", "country", "continent", "description", "active", "source_type", "lang"}
    for key, val in body.items():
        if key in allowed:
            setattr(entry, key, val)

    await db.commit()
    await db.refresh(entry)
    return _serialize_catalog(entry)


@router.delete("/catalog/{source_id}")
async def delete_catalog_source(
    source_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a custom source, or deactivate a builtin source."""
    import uuid as _uuid
    from app.models.ai_feed import RssCatalogEntry
    entry = await db.get(RssCatalogEntry, _uuid.UUID(source_id))
    if not entry:
        raise HTTPException(404, "Source not found")

    if entry.origin == "builtin":
        entry.active = False
        await db.commit()
        return {"ok": True, "action": "deactivated"}

    await db.delete(entry)
    await db.commit()
    return {"ok": True, "action": "deleted"}


@router.post("/catalog/bulk-action")
async def bulk_action_catalog(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Bulk activate/deactivate/delete catalog sources."""
    from app.models.ai_feed import RssCatalogEntry
    ids = body.get("ids", [])
    action = body.get("action")
    if not ids or action not in ("activate", "deactivate", "delete"):
        raise HTTPException(400, "ids and action (activate|deactivate|delete) required")

    import uuid as _uuid
    affected = 0
    for source_id in ids:
        entry = await db.get(RssCatalogEntry, _uuid.UUID(source_id))
        if not entry:
            continue
        if action == "activate":
            entry.active = True
            affected += 1
        elif action == "deactivate":
            entry.active = False
            affected += 1
        elif action == "delete":
            if entry.origin == "builtin":
                entry.active = False
            else:
                await db.delete(entry)
            affected += 1

    await db.commit()
    return {"affected": affected}


@router.post("/catalog/validate-url")
async def validate_url(body: ValidateUrlRequest):
    """Validate an RSS URL or auto-discover RSS feeds from a website URL."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(body.url)
            content_type = resp.headers.get("content-type", "")
            text = resp.text[:10000]

            # Direct RSS feed
            if "xml" in content_type or "<rss" in text or "<feed" in text:
                return ValidateUrlResponse(valid=True, feeds_found=[{"url": body.url, "title": "Direct RSS feed"}])

            # HTML page — discover RSS links
            import re
            rss_links = re.findall(
                r'<link[^>]+type=["\']application/rss\+xml["\'][^>]*href=["\']([^"\']+)["\']',
                text,
            )
            atom_links = re.findall(
                r'<link[^>]+type=["\']application/atom\+xml["\'][^>]*href=["\']([^"\']+)["\']',
                text,
            )
            found = []
            for link in rss_links + atom_links:
                if link.startswith("/"):
                    from urllib.parse import urljoin
                    link = urljoin(body.url, link)
                found.append({"url": link, "title": "Discovered feed"})

            if found:
                return ValidateUrlResponse(valid=True, feeds_found=found)
            return ValidateUrlResponse(valid=False, error="No RSS/Atom feeds found on this page")

    except Exception as e:
        return ValidateUrlResponse(valid=False, error=str(e))


# ── Catalog bulk-add with AI categorization ──────────────────
@router.post("/catalog/bulk-add")
async def bulk_add_sources(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-add RSS URLs to the global catalog. AI auto-categorizes each source."""
    import re
    import httpx
    import feedparser
    from app.models.ai_feed import RssCatalogEntry
    from app.source_engine.detector import _call_gemini

    urls = body.get("urls", [])
    if not urls:
        return {"added": [], "errors": []}

    added = []
    errors = []

    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for url in urls[:50]:  # Max 50 at a time
            url = url.strip()
            if not url.startswith("http"):
                errors.append({"url": url, "error": "Invalid URL"})
                continue

            # Check if already exists
            existing = await db.execute(
                select(RssCatalogEntry).where(RssCatalogEntry.url == url)
            )
            if existing.scalar():
                errors.append({"url": url, "error": "Already in catalog"})
                continue

            # Fetch and parse the RSS to get the title
            try:
                resp = await client.get(url)
                feed = feedparser.parse(resp.text)
                title = feed.feed.get("title", url.split("/")[2] if "/" in url else url)
                lang = feed.feed.get("language", "en")[:2]
            except Exception:
                title = url.split("/")[2] if len(url.split("/")) > 2 else url
                lang = "en"

            # AI auto-categorize
            try:
                prompt = f"""Categorize this RSS feed for an OSINT intelligence platform.
Feed title: "{title}"
Feed URL: {url}
Language: {lang}

JSON only (no markdown):
{{"country": "Country name", "continent": "Continent", "tags": ["Category1", "Category2"], "source_type": "wire|mainstream|tech|finance|intel|cyber|specialty", "tier": 3}}

Rules:
- country: publisher's country (e.g. "France", "US")
- continent: Europe, Asie, Afrique, Amerique du Nord, Amerique du Sud, Oceanie, Moyen-Orient
- tags: list of categories, e.g. ["Actualites"], ["Tech", "Cyber"], ["Finance", "Energie"]
- tier: 1=wire agency, 2=major outlet, 3=specialty/niche, 4=blog/aggregator
- source_type: wire, mainstream, tech, finance, intel, cyber, specialty"""

                raw = await _call_gemini(prompt)
                cleaned = raw.strip()
                cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
                cleaned = re.sub(r"\s*```$", "", cleaned)
                cat = json.loads(cleaned.strip())
            except Exception:
                cat = {"country": None, "continent": None, "tags": [], "source_type": "specialty", "tier": 3}

            entry = RssCatalogEntry(
                url=url,
                name=title[:200],
                lang=lang,
                tier=cat.get("tier", 3),
                source_type=cat.get("source_type"),
                country=cat.get("country"),
                continent=cat.get("continent"),
                tags=cat.get("tags") or ([cat["thematic"]] if cat.get("thematic") else []),
                origin="custom",
            )
            db.add(entry)
            added.append({"url": url, "name": title, **cat})

    await db.commit()
    return {"added": added, "errors": errors, "total_added": len(added)}


# ── AI Suggest — L1+L2 static (instant), L3 on-demand ───────

_TREE = {
    "strategic": [
        {"label": "Région / Pays", "keywords_strong": ["conflict", "geopolitics"], "keywords_weak": ["region", "country"], "children": [
            {"label": "Moyen-Orient", "description": "Iran, Irak, Syrie, Liban, Yémen", "keywords_strong": ["Middle East", "Iran", "Israel"], "keywords_weak": ["Gulf", "MENA"]},
            {"label": "Asie-Pacifique", "description": "Chine, Japon, Corées, Taïwan", "keywords_strong": ["Asia Pacific", "China", "Taiwan"], "keywords_weak": ["Indo-Pacific", "ASEAN"]},
            {"label": "Afrique", "description": "Sahel, Corne de l'Afrique, Grands Lacs", "keywords_strong": ["Africa", "Sahel", "coup"], "keywords_weak": ["Sub-Saharan", "AU"]},
            {"label": "Europe de l'Est", "description": "Ukraine, Russie, Biélorussie", "keywords_strong": ["Ukraine", "Russia", "NATO"], "keywords_weak": ["Eastern Europe", "Kremlin"]},
            {"label": "Amérique latine", "description": "Venezuela, Colombie, Brésil", "keywords_strong": ["Latin America", "Brazil", "Venezuela"], "keywords_weak": ["cartel", "LATAM"]},
        ]},
        {"label": "Organisations internationales", "keywords_strong": ["UN", "NATO", "EU"], "keywords_weak": ["multilateral", "summit"], "children": [
            {"label": "ONU & Conseil de sécurité", "description": "Résolutions, veto, missions", "keywords_strong": ["United Nations", "Security Council"], "keywords_weak": ["UNSC", "resolution"]},
            {"label": "OTAN", "description": "Alliance, défense collective", "keywords_strong": ["NATO", "alliance"], "keywords_weak": ["Article 5", "defense"]},
            {"label": "Union Européenne", "description": "Sanctions, réglementations", "keywords_strong": ["European Union", "EU sanctions"], "keywords_weak": ["Brussels", "Commission"]},
            {"label": "OPEP+", "description": "Production pétrolière, quotas", "keywords_strong": ["OPEC", "oil production"], "keywords_weak": ["crude", "barrel"]},
        ]},
        {"label": "Secteurs industriels", "keywords_strong": ["industry", "sector"], "keywords_weak": ["market", "business"], "children": [
            {"label": "Défense & Aéronautique", "description": "Armement, spatial, drones", "keywords_strong": ["defense", "arms", "military"], "keywords_weak": ["aerospace", "drone"]},
            {"label": "Énergie", "description": "Pétrole, gaz, nucléaire, renouvelable", "keywords_strong": ["energy", "oil", "gas"], "keywords_weak": ["nuclear", "renewable"]},
            {"label": "Finance & Banque", "description": "Banques, marchés, régulation", "keywords_strong": ["finance", "bank", "market"], "keywords_weak": ["stock", "investment"]},
            {"label": "Tech & Telecom", "description": "GAFAM, semiconducteurs, IA", "keywords_strong": ["technology", "AI", "semiconductor"], "keywords_weak": ["big tech", "chip"]},
            {"label": "Pharma & Santé", "description": "Médicaments, pandémie, biotech", "keywords_strong": ["pharma", "health", "biotech"], "keywords_weak": ["vaccine", "WHO"]},
        ]},
        {"label": "Matières premières", "keywords_strong": ["commodity", "resources"], "keywords_weak": ["raw materials", "mining"], "children": [
            {"label": "Pétrole & Gaz", "description": "Cours, production, pipelines", "keywords_strong": ["oil", "crude", "natural gas"], "keywords_weak": ["pipeline", "refinery"]},
            {"label": "Métaux critiques", "description": "Lithium, cobalt, terres rares", "keywords_strong": ["lithium", "rare earth", "cobalt"], "keywords_weak": ["mining", "EV battery"]},
            {"label": "Uranium & Nucléaire", "description": "Enrichissement, centrales", "keywords_strong": ["uranium", "nuclear", "enrichment"], "keywords_weak": ["IAEA", "reactor"]},
            {"label": "Agriculture", "description": "Céréales, sécurité alimentaire", "keywords_strong": ["grain", "wheat", "food security"], "keywords_weak": ["agriculture", "famine"]},
        ]},
        {"label": "Technologies", "keywords_strong": ["technology", "innovation"], "keywords_weak": ["research", "breakthrough"], "children": [
            {"label": "Intelligence Artificielle", "description": "LLM, deep learning, régulation IA", "keywords_strong": ["artificial intelligence", "AI", "LLM"], "keywords_weak": ["machine learning", "GPT"]},
            {"label": "Spatial & Satellites", "description": "SpaceX, Starlink, GNSS", "keywords_strong": ["space", "satellite", "SpaceX"], "keywords_weak": ["orbit", "launch"]},
            {"label": "Cyber & Quantique", "description": "Sécurité, ordinateurs quantiques", "keywords_strong": ["quantum", "cybersecurity"], "keywords_weak": ["encryption", "quantum computing"]},
            {"label": "Semi-conducteurs", "description": "TSMC, ASML, guerre des puces", "keywords_strong": ["semiconductor", "chip", "TSMC"], "keywords_weak": ["foundry", "ASML"]},
        ]},
        {"label": "Climat & Environnement", "keywords_strong": ["climate", "environment"], "keywords_weak": ["pollution", "disaster"], "children": [
            {"label": "Changement climatique", "description": "COP, émissions, accords", "keywords_strong": ["climate change", "emissions", "COP"], "keywords_weak": ["global warming", "carbon"]},
            {"label": "Catastrophes naturelles", "description": "Séismes, ouragans, inondations", "keywords_strong": ["earthquake", "hurricane", "flood"], "keywords_weak": ["disaster", "tsunami"]},
            {"label": "Transition énergétique", "description": "Renouvelable, hydrogène", "keywords_strong": ["renewable energy", "green hydrogen"], "keywords_weak": ["solar", "wind farm"]},
        ]},
    ],
    "cyber": [
        {"label": "Secteur ciblé", "keywords_strong": ["cyberattack", "breach"], "keywords_weak": ["hack", "incident"], "children": [
            {"label": "Finance & Banque", "description": "Banques, fintech, crypto", "keywords_strong": ["bank hack", "financial fraud"], "keywords_weak": ["crypto theft", "fintech"]},
            {"label": "Santé", "description": "Hôpitaux, pharma, données patients", "keywords_strong": ["hospital ransomware", "health data"], "keywords_weak": ["medical device", "HIPAA"]},
            {"label": "Énergie & Infrastructure", "description": "OT, SCADA, utilities", "keywords_strong": ["energy cyberattack", "SCADA", "ICS"], "keywords_weak": ["power grid", "utility"]},
            {"label": "Gouvernement", "description": "Espionnage, hacktivisme", "keywords_strong": ["government hack", "state espionage"], "keywords_weak": ["classified", "leak"]},
            {"label": "Tech & Telecom", "description": "Cloud, SaaS, supply chain", "keywords_strong": ["cloud breach", "supply chain attack"], "keywords_weak": ["SaaS", "telecom"]},
        ]},
        {"label": "Threat Actors", "keywords_strong": ["APT", "threat actor"], "keywords_weak": ["hacker", "campaign"], "children": [
            {"label": "Russie", "description": "APT28, APT29, Sandworm", "keywords_strong": ["Russia APT", "Fancy Bear", "Cozy Bear"], "keywords_weak": ["GRU", "SVR", "Sandworm"]},
            {"label": "Chine", "description": "APT41, APT10, Hafnium", "keywords_strong": ["China APT", "APT41", "Hafnium"], "keywords_weak": ["MSS", "PLA"]},
            {"label": "Corée du Nord", "description": "Lazarus, Kimsuky", "keywords_strong": ["Lazarus Group", "North Korea cyber"], "keywords_weak": ["Kimsuky", "crypto theft"]},
            {"label": "Iran", "description": "Charming Kitten, MuddyWater", "keywords_strong": ["Iran cyber", "Charming Kitten"], "keywords_weak": ["IRGC cyber", "MuddyWater"]},
            {"label": "Cybercrime", "description": "RaaS, FIN groups, cartels", "keywords_strong": ["ransomware gang", "cybercrime"], "keywords_weak": ["RaaS", "dark web"]},
        ]},
        {"label": "Malware", "keywords_strong": ["malware", "ransomware"], "keywords_weak": ["trojan", "payload"], "children": [
            {"label": "Ransomware", "description": "LockBit, BlackCat, Clop", "keywords_strong": ["ransomware", "LockBit", "BlackCat"], "keywords_weak": ["Clop", "ransom demand"]},
            {"label": "Infostealers", "description": "RedLine, Raccoon, Vidar", "keywords_strong": ["infostealer", "credential theft"], "keywords_weak": ["RedLine", "Raccoon"]},
            {"label": "Wipers & Destructeurs", "description": "Sabotage, destruction données", "keywords_strong": ["wiper malware", "destructive"], "keywords_weak": ["sabotage", "disk wipe"]},
            {"label": "Botnets", "description": "Mirai, Emotet, DDoS", "keywords_strong": ["botnet", "DDoS"], "keywords_weak": ["Mirai", "Emotet"]},
        ]},
        {"label": "Vulnérabilités", "keywords_strong": ["vulnerability", "CVE", "exploit"], "keywords_weak": ["patch", "zero-day"], "children": [
            {"label": "Zero-day", "description": "Exploits non patchés", "keywords_strong": ["zero-day", "0day", "unpatched"], "keywords_weak": ["in the wild", "exploit"]},
            {"label": "CVE critiques", "description": "CVSS 9+, RCE", "keywords_strong": ["critical CVE", "RCE", "CVSS"], "keywords_weak": ["remote code execution", "patch"]},
            {"label": "Supply chain", "description": "Dépendances, packages malveillants", "keywords_strong": ["supply chain vulnerability", "dependency"], "keywords_weak": ["npm malware", "PyPI"]},
        ]},
        {"label": "Frameworks (MITRE)", "keywords_strong": ["MITRE ATT&CK", "TTP"], "keywords_weak": ["technique", "tactic"], "children": [
            {"label": "Initial Access", "description": "Phishing, exploits publics", "keywords_strong": ["phishing", "initial access"], "keywords_weak": ["spear phishing", "exploit"]},
            {"label": "Lateral Movement", "description": "Pass-the-hash, RDP", "keywords_strong": ["lateral movement", "pass the hash"], "keywords_weak": ["RDP", "privilege escalation"]},
            {"label": "Exfiltration & C2", "description": "Tunneling, beaconing", "keywords_strong": ["data exfiltration", "C2", "command control"], "keywords_weak": ["DNS tunnel", "beacon"]},
        ]},
        {"label": "Régions d'origine", "keywords_strong": ["cyber threat", "state-sponsored"], "keywords_weak": ["attribution", "campaign"], "children": [
            {"label": "Russie & CEI", "description": "APT28/29, Sandworm, cybercrime", "keywords_strong": ["Russia cyber", "Russian hacker"], "keywords_weak": ["CIS", "Kremlin cyber"]},
            {"label": "Chine", "description": "APT10/41, espionnage industriel", "keywords_strong": ["China cyber", "Chinese hacker"], "keywords_weak": ["industrial espionage"]},
            {"label": "Moyen-Orient", "description": "Iran, hacktivistes", "keywords_strong": ["Iran cyber", "Middle East hack"], "keywords_weak": ["hacktivist"]},
        ]},
    ],
}


@router.post("/ai/suggest")
async def ai_suggest(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
):
    """Return L1+L2 tree instantly (static). L3 loaded on-demand via /ai/suggest-leaves."""
    tab = body.get("tab", "strategic")
    tree = _TREE.get(tab, _TREE["strategic"])
    # Return L1+L2 with empty children for L2 (L3 generated on demand)
    categories = []
    for l1 in tree:
        l1_copy = {**l1, "children": []}
        for l2 in l1.get("children", []):
            l1_copy["children"].append({**l2, "children": []})
        categories.append(l1_copy)
    return {"categories": categories}


@router.post("/ai/suggest-leaves")
async def ai_suggest_leaves(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
):
    """Generate L3 leaf items with keywords for a specific L1>L2 path using Gemini."""
    import re
    from app.source_engine.detector import _call_gemini

    tab = body.get("tab", "strategic")
    l1_label = body.get("l1", "")
    l2_label = body.get("l2", "")
    l2_keywords = body.get("l2_keywords_strong", [])

    domain = "intelligence géopolitique/stratégique (OSINT)" if tab == "strategic" else "cybersécurité et threat intelligence"

    prompt = f"""Tu es un analyste {domain}.
Contexte: {l1_label} > {l2_label}
Keywords: {', '.join(l2_keywords)}

Génère 4-6 items spécifiques et actionnables basés sur les tendances ACTUELLES.

JSON valide uniquement (pas de markdown):
{{"children": [{{"label": "Nom", "description": "< 50 car. FR", "keywords_strong": ["EN term 1", "EN term 2"], "keywords_weak": ["EN term 1"]}}]}}

Règles: keywords EN anglais, strong=AND obligatoire (2-4), weak=OR optionnel (2-3). Items basés sur l'actualité."""

    try:
        raw = await _call_gemini(prompt)
        cleaned = raw.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        return json.loads(cleaned.strip())
    except Exception as e:
        logger.warning("AI suggest-leaves failed: %s", e, exc_info=True)
        return {"children": [], "error": str(e)}


# ── Dynamic categories & suggestions ─────────────────────────
@router.get("/dynamic-categories")
async def get_dynamic_categories():
    """Return cached category analysis (generated weekly)."""
    from app.source_engine.category_analyzer import get_cached_analysis
    result = get_cached_analysis()
    if not result:
        return {"categories": [], "trending_entities": [], "trending_countries": [], "trending_tags": []}
    return result


@router.post("/dynamic-categories/refresh")
async def refresh_dynamic_categories(
    db: AsyncSession = Depends(get_db),
):
    """Force regenerate category analysis now."""
    from app.source_engine.category_analyzer import run_weekly_analysis
    return await run_weekly_analysis(db)


# ── Intel Models resolve by IDs (lightweight) ───────────────
@router.post("/intel-models/resolve-ids")
async def resolve_model_ids(body: dict, db: AsyncSession = Depends(get_db)):
    """Resolve a list of model IDs to their names/family/section. Fast, no tree."""
    from app.models.intel_model import IntelModel
    import uuid as _uuid
    ids = body.get("ids", [])
    if not ids:
        return {"models": {}}
    models_out = {}
    for mid_str in ids:
        mid_hex = mid_str.replace("-", "")
        try:
            m = await db.get(IntelModel, _uuid.UUID(mid_hex))
            if m:
                models_out[mid_hex] = {"name": m.name, "family": m.family, "section": m.section}
        except Exception:
            pass
    return {"models": models_out}


# ── Intel Models search (fuzzy, for search bar) ─────────────
@router.get("/intel-models/search")
async def search_intel_models(q: str = Query("", min_length=2), limit: int = Query(10, le=50)):
    """Fuzzy search Intel Models by name or alias. Uses RapidFuzz."""
    from app.source_engine.matching_engine import search_models
    return {"results": search_models(q, limit=limit)}


# ── Intel Models catalog ──────────────────────────────────────
@router.get("/intel-models")
async def list_intel_models(
    family: str | None = None,
    section: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all intelligence models, optionally filtered by family/section/search."""
    from app.models.intel_model import IntelModel
    query = select(IntelModel)
    if family:
        query = query.where(IntelModel.family == family)
    if section:
        query = query.where(IntelModel.section == section)
    result = await db.execute(query.order_by(IntelModel.section, IntelModel.name))
    models = result.scalars().all()

    if q:
        q_lower = q.lower()
        models = [m for m in models if q_lower in m.name.lower() or any(q_lower in a.lower() for a in (m.aliases or []))]

    # Group by section
    sections: dict[str, list] = {}
    for m in models:
        sections.setdefault(m.section, []).append({
            "id": str(m.id), "name": m.name, "family": m.family,
            "section": m.section, "aliases": m.aliases or [],
            "article_count": m.article_count, "origin": m.origin,
        })

    return {"sections": sections, "total": len(models)}


@router.get("/intel-models/tree")
async def intel_models_tree(db: AsyncSession = Depends(get_db)):
    """Return 3-level tree: family → section → models, with aliases at each level."""
    from app.models.intel_model import IntelModel
    from app.models.intel_category import IntelCategory

    result = await db.execute(
        select(IntelModel).order_by(IntelModel.family, IntelModel.section, desc(IntelModel.article_count))
    )
    models = result.scalars().all()

    # Load category aliases
    cats = (await db.scalars(select(IntelCategory))).all()
    fam_aliases: dict[str, list] = {}
    sec_aliases: dict[str, list] = {}
    fam_labels: dict[str, str] = {}
    for c in cats:
        if c.level == "family":
            fam_aliases[c.key] = c.aliases or []
            fam_labels[c.key] = c.label
        elif c.level == "section":
            sec_aliases[f"{c.parent_key}:{c.key}"] = c.aliases or []

    tree: dict[str, dict[str, list]] = {}
    for m in models:
        tree.setdefault(m.family, {}).setdefault(m.section, []).append({
            "id": str(m.id), "name": m.name, "aliases": m.aliases or [],
            "description": m.description, "article_count": m.article_count,
        })

    from app.domains.ai_feeds.taxonomy import FAMILIES
    families = []
    # Order: taxonomy order, then any extras at the end
    fam_order = list(FAMILIES.keys())
    for fam_key in sorted(tree.keys(), key=lambda k: fam_order.index(k) if k in fam_order else 99):
        sections = []
        for sec_name, sec_models in tree[fam_key].items():
            sections.append({
                "name": sec_name,
                "aliases": sec_aliases.get(f"{fam_key}:{sec_name}", []),
                "models": sec_models,
            })
        families.append({
            "key": fam_key,
            "label": fam_labels.get(fam_key, FAMILIES.get(fam_key, fam_key)),
            "aliases": fam_aliases.get(fam_key, []),
            "sections": sections,
        })
    return {"families": families}


@router.post("/intel-enrich-aliases")
async def enrich_aliases(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """LLM-enrich aliases for any level, using hierarchical context.

    Body: { "level": "family"|"section"|"model", "id": "...",
            "family_key": "...", "section_name": "..." }

    Context rules:
      - Level 1 (family): LLM reads all sections + models below
      - Level 2 (section): LLM reads parent family + sibling sections + child models
      - Level 3 (model): LLM reads parent family + parent section context
    """
    import re
    from app.models.intel_model import IntelModel
    from app.models.intel_category import IntelCategory
    from app.source_engine.detector import _call_gemini

    level = body.get("level")
    target_id = body.get("id")
    family_key = body.get("family_key", "")
    section_name = body.get("section_name", "")

    # Gather context
    all_models = (await db.scalars(select(IntelModel))).all()
    all_cats = (await db.scalars(select(IntelCategory))).all()

    if level == "family":
        cat = next((c for c in all_cats if c.level == "family" and c.key == family_key), None)
        if not cat:
            raise HTTPException(404, "Family not found")
        # Context: all sections + models under this family
        children = [m for m in all_models if m.family == family_key]
        sections_below = sorted(set(m.section for m in children))
        models_below = [f"{m.name} ({', '.join((m.aliases or [])[:5])})" for m in children[:30]]
        current_aliases = cat.aliases or []

        prompt = f"""LEVEL 1 — TOP-LEVEL DOMAIN aliases for OSINT platform.

Family: "{cat.label}" (key: {cat.key})
Current aliases: {current_aliases}
Sub-domains: {sections_below}
Sample entities below:
{chr(10).join(f'  - {m}' for m in models_below)}

This is the BROADEST level. Generate 10-20 DOMAIN-LEVEL aliases:
- How an intelligence professional names this entire discipline
- General terms that encompass ALL sub-topics and entities below
- NOT sub-topics, NOT entities — pure domain vocabulary
Example for "Market Intelligence": ["veille économique", "business intelligence", "intelligence économique", "competitive intelligence", "analyse de marché"]

English + French + relevant languages. Min 3 chars.
Return ONLY a JSON array: ["alias1", "alias2", ...]"""

        target_name = cat.label

    elif level == "section":
        cat = next((c for c in all_cats if c.level == "section" and c.key == section_name and c.parent_key == family_key), None)
        if not cat:
            raise HTTPException(404, "Section not found")
        fam_cat = next((c for c in all_cats if c.level == "family" and c.key == family_key), None)
        children = [m for m in all_models if m.family == family_key and m.section == section_name]
        models_below = [f"{m.name} ({', '.join((m.aliases or [])[:5])})" for m in children[:20]]
        sibling_secs = sorted(set(m.section for m in all_models if m.family == family_key and m.section != section_name))
        current_aliases = cat.aliases or []

        prompt = f"""LEVEL 2 — SUB-DOMAIN aliases for OSINT platform.

Parent domain (L1): "{fam_cat.label if fam_cat else family_key}" (aliases: {fam_cat.aliases if fam_cat else []})
Section: "{section_name}"
Current aliases: {current_aliases}
Sibling sections: {sibling_secs[:10]}
Entities in this section (L3):
{chr(10).join(f'  - {m}' for m in models_below)}

This is LEVEL 2 — a GENERALIST sub-domain, still broad.
Generate 10-15 TOPIC-LEVEL aliases:
- Terms describing this category of intelligence as a topic
- Broader than any specific entity but scoped within the parent domain
- NOT entity names — those are Level 3
Example for "Strategic Moves" under "Market Intelligence": ["stratégie d'entreprise", "corporate strategy", "mouvements stratégiques", "corporate actions", "business strategy"]

English + French + relevant languages. Min 3 chars.
Return ONLY a JSON array: ["alias1", "alias2", ...]"""

        target_name = section_name

    elif level == "model":
        model = await db.get(IntelModel, __import__('uuid').UUID(target_id))
        if not model:
            raise HTTPException(404, "Model not found")
        fam_cat = next((c for c in all_cats if c.level == "family" and c.key == model.family), None)
        sec_cat = next((c for c in all_cats if c.level == "section" and c.key == model.section and c.parent_key == model.family), None)
        current_aliases = model.aliases or []

        prompt = f"""LEVEL 3 — PRECISE ENTITY aliases for OSINT platform.

Parent domain (L1): "{fam_cat.label if fam_cat else model.family}" (aliases: {fam_cat.aliases if fam_cat else []})
Parent section (L2): "{sec_cat.label if sec_cat else model.section}" (aliases: {sec_cat.aliases if sec_cat else []})
Model: "{model.name}"
Current aliases: {current_aliases}

This is LEVEL 3 — the most SPECIFIC level. This is a concrete entity:
a company, a person, a technology, a threat actor, a specific concept.

Generate 10-20 PRECISE aliases:
- Exact name variations, abbreviations, stock tickers, acronyms
- Translations in English, French, and the entity's local language
- Former names, parent orgs, subsidiaries, common misspellings
Example for "TotalEnergies": ["Total", "TotalEnergies SE", "TTE", "Total S.A.", "Total Energies", "Compagnie Française des Pétroles"]

Min 3 chars each.
Return ONLY a JSON array: ["alias1", "alias2", ...]"""

        target_name = model.name

    else:
        raise HTTPException(400, "level must be family, section, or model")

    # Call LLM
    raw = await _call_gemini(prompt)
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    new_aliases = json.loads(cleaned.strip())

    if not isinstance(new_aliases, list):
        raise HTTPException(500, "LLM returned invalid format")

    # Filter and deduplicate
    new_aliases = sorted(set(
        a.strip() for a in new_aliases if isinstance(a, str) and len(a.strip()) >= 3
    ))

    # Save
    if level == "model":
        model.aliases = new_aliases
        await db.commit()
    else:
        cat.aliases = new_aliases
        await db.commit()

    return {"level": level, "name": target_name, "aliases": new_aliases, "count": len(new_aliases)}


@router.post("/intel-enrich-all")
async def enrich_all_aliases(db: AsyncSession = Depends(get_db)):
    """Batch-enrich aliases for the entire Intel tree: all families, sections, models.

    Processes bottom-up: models first (context = family+section names),
    then sections (context = family + child model aliases),
    then families (context = child section + model aliases).
    Streams progress via JSON lines."""
    import re
    from app.models.intel_model import IntelModel
    from app.models.intel_category import IntelCategory
    from app.source_engine.detector import _call_gemini

    all_models = (await db.scalars(select(IntelModel))).all()
    all_cats = (await db.scalars(select(IntelCategory))).all()

    fam_cats = {c.key: c for c in all_cats if c.level == "family"}
    sec_cats = {f"{c.parent_key}:{c.key}": c for c in all_cats if c.level == "section"}

    stats = {"families": 0, "sections": 0, "models": 0, "errors": 0}

    async def _call_and_parse(prompt: str) -> list[str]:
        raw = await _call_gemini(prompt)
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)
        aliases = json.loads(cleaned.strip())
        if not isinstance(aliases, list):
            return []
        return sorted(set(a.strip() for a in aliases if isinstance(a, str) and len(a.strip()) >= 3))

    # ── Phase 1: LEVEL 3 — Models = PRECISE (entities, companies, persons, specific concepts) ──
    # Context: knows its family + section to stay in scope
    for m in all_models:
        if m.aliases and len(m.aliases) >= 5:
            continue
        fam_label = fam_cats.get(m.family, None)
        prompt = f"""You are generating search aliases for a PRECISE intelligence model in an OSINT platform.

Model: "{m.name}"
Family (broad domain): "{fam_label.label if fam_label else m.family}"
Section (sub-domain): "{m.section}"

This is LEVEL 3 — the most specific level. This model represents a concrete entity:
a company, a person, a technology, a specific threat, a precise concept.

Generate 10-15 PRECISE aliases:
- Exact name variations, abbreviations, stock tickers
- Translations in English, French, and the entity's local language
- Common misspellings or alternate spellings people search for
- Former names, parent companies, subsidiaries if relevant

Every alias must be at least 3 characters. Be specific, not generic.
Return ONLY a JSON array: ["alias1", "alias2", ...]"""
        try:
            m.aliases = await _call_and_parse(prompt)
            stats["models"] += 1
        except Exception:
            stats["errors"] += 1

    await db.commit()

    # ── Phase 2: LEVEL 2 — Sections = GENERAL SUB-DOMAIN (reads L1 family context + L3 model aliases below) ──
    # Broader than entities but scoped within the family
    for sec_key, sec_cat in sec_cats.items():
        fam_key = sec_cat.parent_key
        children = [m for m in all_models if m.family == fam_key and m.section == sec_cat.key]
        child_names = ", ".join(m.name for m in children[:15])
        child_alias_sample = []
        for m in children[:10]:
            child_alias_sample.extend((m.aliases or [])[:3])
        fam_label = fam_cats.get(fam_key, None)

        prompt = f"""You are generating search aliases for a SUB-DOMAIN SECTION in an OSINT intelligence platform.

Section: "{sec_cat.key}"
Parent family (broad domain): "{fam_label.label if fam_label else fam_key}"
Entities in this section (Level 3): {child_names}
Sample entity-level aliases: {child_alias_sample[:20]}

This is LEVEL 2 — a GENERALIST sub-domain, NOT entity-specific.
Think of it as a TOPIC or CATEGORY that groups related entities.

Example: if section = "Strategic Moves" → aliases should be: ["stratégie d'entreprise", "corporate strategy", "business moves", "mouvements stratégiques", "corporate actions"]
NOT specific entities like "M&A" or "IPO" (those are Level 3).

Generate 10-15 GENERALIST sub-domain aliases:
- Topic-level terms that describe this category of intelligence
- Terms an analyst would use to search for this type of information broadly
- English + French + relevant languages. Min 3 chars.

Return ONLY a JSON array: ["alias1", "alias2", ...]"""
        try:
            sec_cat.aliases = await _call_and_parse(prompt)
            stats["sections"] += 1
        except Exception:
            stats["errors"] += 1

    await db.commit()

    # ── Phase 3: LEVEL 1 — Families = BROADEST DOMAIN (reads L2 section aliases below) ──
    # The widest filter — entire intelligence domain
    for fam_key, fam_cat in fam_cats.items():
        children_secs = [c for c in all_cats if c.level == "section" and c.parent_key == fam_key]
        sec_names = [c.key for c in children_secs]
        sec_alias_sample = []
        for c in children_secs[:8]:
            sec_alias_sample.extend((c.aliases or [])[:3])
        model_count = len([m for m in all_models if m.family == fam_key])

        prompt = f"""You are generating search aliases for a TOP-LEVEL intelligence DOMAIN in an OSINT platform.

Family: "{fam_cat.label}" (key: {fam_key})
Sub-domains (Level 2): {sec_names}
Sample sub-domain aliases: {sec_alias_sample[:15]}
Number of entities under this domain: {model_count}

This is LEVEL 1 — the BROADEST level. This represents an entire field of intelligence.

Example: if family = "Market Intelligence" → aliases should be: ["veille économique", "business intelligence", "market analysis", "intelligence économique", "veille marché", "competitive intelligence", "analyse de marché"]
NOT sub-topics like "technology" or "strategy" (those are Level 2).

Generate 10-20 VERY BROAD domain-level aliases:
- Terms that encompass the entire field
- How an intelligence professional would name this discipline
- English + French + other relevant languages. Min 3 chars.

Return ONLY a JSON array: ["alias1", "alias2", ...]"""
        try:
            fam_cat.aliases = await _call_and_parse(prompt)
            stats["families"] += 1
        except Exception:
            stats["errors"] += 1

    await db.commit()
    return stats


@router.put("/intel-categories/{cat_level}/{cat_key}")
async def update_intel_category(
    cat_level: str, cat_key: str,
    parent_key: str | None = Query(None),
    body: dict = {},
    db: AsyncSession = Depends(get_db),
):
    """Update a category's label or aliases."""
    from app.models.intel_category import IntelCategory
    stmt = select(IntelCategory).where(IntelCategory.level == cat_level, IntelCategory.key == cat_key)
    if parent_key:
        stmt = stmt.where(IntelCategory.parent_key == parent_key)
    cat = (await db.scalars(stmt)).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    if "label" in body:
        cat.label = body["label"]
    if "aliases" in body:
        cat.aliases = body["aliases"]
    await db.commit()
    return {"id": str(cat.id), "level": cat.level, "key": cat.key, "label": cat.label, "aliases": cat.aliases or []}


@router.put("/intel-models/{model_id}")
async def update_intel_model(
    model_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Update an intel model's name, aliases, family, section."""
    from app.models.intel_model import IntelModel
    import uuid
    m = await db.get(IntelModel, uuid.UUID(model_id))
    if not m:
        raise HTTPException(404, "Model not found")
    if "name" in body:
        m.name = body["name"]
    if "aliases" in body:
        m.aliases = body["aliases"]
    if "family" in body:
        m.family = body["family"]
    if "section" in body:
        m.section = body["section"]
    await db.commit()
    return {
        "id": str(m.id), "name": m.name, "family": m.family,
        "section": m.section, "aliases": m.aliases or [],
        "article_count": m.article_count, "origin": m.origin,
    }


@router.delete("/intel-models/{model_id}")
async def delete_intel_model(
    model_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete an intel model."""
    from app.models.intel_model import IntelModel
    import uuid
    m = await db.get(IntelModel, uuid.UUID(model_id))
    if not m:
        raise HTTPException(404, "Model not found")
    await db.delete(m)
    await db.commit()
    return {"deleted": True}


@router.post("/intel-models/dedup")
async def dedup_intel_models(db: AsyncSession = Depends(get_db)):
    """Find and merge duplicate intel models (same name, case-insensitive).
    Keeps the one with the most aliases, merges aliases from others, then deletes dupes."""
    from app.models.intel_model import IntelModel
    from collections import defaultdict

    result = await db.execute(select(IntelModel).order_by(IntelModel.name))
    models = result.scalars().all()

    # Group by lowercase name
    groups: dict[str, list] = defaultdict(list)
    for m in models:
        groups[m.name.lower().strip()].append(m)

    merged_count = 0
    deleted_count = 0
    for name_lower, group in groups.items():
        if len(group) <= 1:
            continue
        # Keep the one with most aliases
        group.sort(key=lambda x: len(x.aliases or []), reverse=True)
        keeper = group[0]
        all_aliases = set(a.lower() for a in (keeper.aliases or []))
        for dupe in group[1:]:
            # Merge aliases
            for a in (dupe.aliases or []):
                all_aliases.add(a.lower())
            # Sum article counts
            keeper.article_count = (keeper.article_count or 0) + (dupe.article_count or 0)
            await db.delete(dupe)
            deleted_count += 1
        # Deduplicate aliases
        keeper.aliases = sorted(set(a for a in all_aliases if len(a) >= 3))
        merged_count += 1

    await db.commit()
    return {"merged_groups": merged_count, "deleted_duplicates": deleted_count}


@router.post("/intel-models/resolve")
async def resolve_intel_model(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Resolve a term to an existing intel model, or create one via LLM.
    Returns the model with its aliases. Updates last_used_at."""
    import re
    from datetime import datetime, timezone
    from app.models.intel_model import IntelModel

    term = body.get("term", "").strip()
    if not term or len(term) < 2:
        raise HTTPException(400, "term required (min 2 chars)")

    term_lower = term.lower()

    # 1. Search existing models by name or aliases
    # 1. Exact match only — by name or alias
    result = await db.execute(select(IntelModel))
    all_models = result.scalars().all()

    match = None
    for m in all_models:
        if m.name.lower() == term_lower:
            match = m
            break
        for a in (m.aliases or []):
            if a.lower() == term_lower:
                match = m
                break
        if match:
            break

    # 2. Found — update last_used_at and return
    # No fuzzy matching — if not found, LLM creates a new model
    if match:
        match.last_used_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(match)
        return {
            "model": {
                "id": str(match.id), "name": match.name, "family": match.family,
                "section": match.section, "aliases": match.aliases or [],
                "description": match.description, "article_count": match.article_count,
            },
            "created": False,
        }

    # 3. Not found — ask LLM to create a new model
    try:
        from app.source_engine.detector import _call_gemini

        from app.domains.ai_feeds.taxonomy import FAMILIES, SECTIONS
        taxonomy_lines = []
        for fam, secs in SECTIONS.items():
            taxonomy_lines.append(f"  {fam} ({FAMILIES[fam]}): {', '.join(secs)}")
        taxonomy_text = "\n".join(taxonomy_lines)

        prompt = f"""Create an intelligence model for the OSINT term: "{term}"

TAXONOMY (you MUST pick from these families and sections):
{taxonomy_text}

ALIAS RULES:
- 8-15 aliases: synonyms, abbreviations, translations (English, French, + relevant language)
- Every alias must be specific enough to find this entity in news articles
- NEVER use common words that appear in unrelated text (e.g. "Total", "Global", "National")
- Every alias must be at least 3 characters

Return ONLY valid JSON (no markdown):
{{
  "name": "Proper name for this concept",
  "family": "one of the families above",
  "section": "one of the sections above for that family",
  "description": "One sentence description",
  "aliases": ["alias1", "alias2", "..."]
}}"""

        raw = await _call_gemini(prompt)
        cleaned = raw.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        data = json.loads(cleaned.strip())

        from app.domains.ai_feeds.taxonomy import is_valid
        fam = data.get("family", "foundation")
        sec = data.get("section", "Companies")
        if not is_valid(fam, sec):
            fam, sec = "foundation", "Companies"

        # Dedup: check if LLM-generated name already exists (case-insensitive)
        llm_name = data.get("name", term)
        llm_aliases = data.get("aliases", [term])
        llm_name_lower = llm_name.lower()
        for m in all_models:
            if m.name.lower() == llm_name_lower:
                m.last_used_at = datetime.now(timezone.utc)
                await db.commit()
                await db.refresh(m)
                return {
                    "model": {
                        "id": str(m.id), "name": m.name, "family": m.family,
                        "section": m.section, "aliases": m.aliases or [],
                        "description": m.description, "article_count": m.article_count,
                    },
                    "created": False,
                }

        model = IntelModel(
            name=llm_name,
            family=fam,
            section=sec,
            description=data.get("description"),
            aliases=llm_aliases,
            origin="ai_enriched",
            last_used_at=datetime.now(timezone.utc),
        )
        db.add(model)
        await db.commit()
        await db.refresh(model)

        return {
            "model": {
                "id": str(model.id), "name": model.name, "family": model.family,
                "section": model.section, "aliases": model.aliases or [],
                "description": model.description, "article_count": 0,
            },
            "created": True,
        }
    except Exception as e:
        logger.warning(f"Intel model creation failed for '{term}': {e}")
        # Fallback: create minimal model without LLM
        model = IntelModel(
            name=term,
            family="foundation",
            section="Companies",
            aliases=[term],
            origin="ai_enriched",
            last_used_at=datetime.now(timezone.utc),
        )
        db.add(model)
        await db.commit()
        await db.refresh(model)
        return {
            "model": {
                "id": str(model.id), "name": model.name, "family": model.family,
                "section": model.section, "aliases": [term],
                "description": None, "article_count": 0,
            },
            "created": True,
        }


@router.get("/suggestions")
async def get_suggestions(
    q: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Autosuggest for feed search bar — based on trending tags, entities, countries."""
    from app.source_engine.category_analyzer import get_cached_analysis
    analysis = get_cached_analysis()
    if not analysis:
        return {"suggestions": []}

    suggestions = []
    q_lower = q.lower()

    # Merge trending tags, entities, countries into one ranked list
    for item in analysis.get("trending_tags", []):
        suggestions.append({"text": item["name"], "type": "tag", "count": item["count"]})
    for item in analysis.get("trending_entities", []):
        suggestions.append({"text": item["name"], "type": "entity", "count": item["count"]})
    for item in analysis.get("trending_countries", []):
        suggestions.append({"text": item["name"], "type": "country", "count": item["count"]})

    # Filter by query if provided
    if q_lower:
        suggestions = [s for s in suggestions if q_lower in s["text"].lower()]

    # Sort by count, deduplicate
    seen = set()
    unique = []
    for s in sorted(suggestions, key=lambda x: -x["count"]):
        key = s["text"].lower()
        if key not in seen:
            seen.add(key)
            unique.append(s)

    return {"suggestions": unique[:20]}


# ── AI Aliases — generate synonyms/translations for a term ───
@router.post("/ai/aliases")
async def generate_aliases(body: dict):
    """Generate aliases (synonyms, translations, abbreviations) for a search term."""
    import re
    from app.source_engine.detector import _call_gemini

    term = body.get("term", "").strip()
    term_type = body.get("type", "keyword")  # keyword, entity, topic
    if not term:
        return {"aliases": []}

    prompt = f"""Generate aliases for this OSINT search term. Include synonyms, translations (English, French, and local language if applicable), abbreviations, and related terms.

Term: "{term}"
Type: {term_type}

Return ONLY a JSON array of strings. No markdown, no explanation.
Example for "Russie": ["Russia", "Russian", "Kremlin", "Moscow", "Россия", "russe", "federation de Russie", "Russian Federation"]
Example for "cyberattack": ["cyberattaque", "cyber attack", "hacking", "piratage", "intrusion", "breach", "кибератака"]
Example for "OTAN": ["NATO", "North Atlantic Treaty Organization", "Alliance atlantique", "НАТО"]

IMPORTANT: Every alias must be at least 3 characters long. Include translations in English, French, and the relevant language for the subject.

Generate 8-15 aliases for "{term}":"""

    try:
        raw = await _call_gemini(prompt)
        cleaned = raw.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        aliases = json.loads(cleaned.strip())
        if isinstance(aliases, list):
            return {"aliases": [a for a in aliases if isinstance(a, str) and a.strip()][:15]}
    except Exception as e:
        logger.warning(f"Alias generation failed for '{term}': {e}")

    return {"aliases": []}


# ── AI Bootstrap — auto-generate query + suggest sources ─────
@router.post("/ai/bootstrap")
async def ai_bootstrap(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Given a feed name/description, use Gemini to generate query layers and suggest sources."""
    import re
    from app.source_engine.detector import _call_gemini
    from app.models.ai_feed import RssCatalogEntry

    name = body.get("name", "")
    description = body.get("description", "")

    result = await db.execute(select(RssCatalogEntry).where(RssCatalogEntry.active == True))
    db_sources = result.scalars().all()
    catalog = [
        {"name": s.name, "url": s.url, "lang": s.lang, "tier": s.tier,
         "source_type": s.source_type, "country": s.country,
         "continent": s.continent, "tags": s.tags or []}
        for s in db_sources
    ]
    # Keep catalog compact to avoid token overflow and JSON truncation
    catalog_summary = "\n".join(
        f"- {s['name']} ({s['country']}, {', '.join(s['tags'])})"
        for s in catalog[:80]  # Top 80 sources only (tier 1-2 first)
    )

    prompt = f"""You are an OSINT intelligence analyst configuring an RSS monitoring feed.

The user wants to create a feed called: "{name}"
Description: "{description or 'N/A'}"

Your job:
1. Generate a structured query with filter layers (topics, entities, keywords) using AND/OR/NOT operators
2. Select the most relevant RSS sources from the catalog below

Respond ONLY with valid JSON (no markdown, no ```). Use this exact structure:
{{
  "query": {{
    "layers": [
      {{
        "operator": "OR",
        "parts": [
          {{"type": "keyword", "value": "keyword1 in English", "scope": "title_and_content"}},
          {{"type": "keyword", "value": "keyword2 en français", "scope": "title_and_content"}},
          {{"type": "keyword", "value": "keyword3 in local language", "scope": "title_and_content"}},
          {{"type": "entity", "value": "Key Entity", "aliases": ["Alias1", "Alias2"], "scope": "title_and_content"}}
        ]
      }},
      {{
        "operator": "NOT",
        "parts": [
          {{"type": "keyword", "value": "exclusion term", "scope": "title"}}
        ]
      }}
    ]
  }},
  "suggested_sources": ["Source Name 1", "Source Name 2", "Source Name 3"],
  "description": "A clear one-sentence description of what this feed monitors."
}}

Rules:
- part.type must be "topic", "entity", or "keyword"
- part.scope must be "title_and_content" or "title"
- operator must be "AND", "OR", or "NOT"
- suggested_sources must be exact names from the catalog (case-sensitive match)
- Suggest 5-15 relevant sources. Prefer tier 1-2 sources. Match by country/continent/tags relevance.
- CRITICAL: The first layer MUST use operator "OR" (not AND). An article matches if it contains ANY of the keywords.
- AND layers (optional, for layer 2+): used to narrow results. Each part in an AND layer MUST also have aliases/similar terms. Example: AND layer with "Russie" must include aliases ["Russia", "Russian", "Kremlin", "Moscow", "Россия", "russe"].
- CRITICAL: Generate rich, comprehensive keywords. The first OR layer MUST contain 15-25 keywords/terms covering all aspects of the topic.
  Example for "Énergie & Ressources": oil, gas, petroleum, nuclear energy, renewable, solar, wind power, OPEC, pipeline, mining, coal, uranium, lithium, hydrogen, electricity grid, energy security, fossil fuel, natural gas, LNG, crude oil, pétrole, gaz naturel, énergie nucléaire, énergie renouvelable, transition énergétique
  Example for "Guerre Ukraine": Ukraine war, Russian invasion, Zelensky, Putin, Donbas, Crimea, NATO, Bakhmut, drone strike, frontline, ceasefire, guerre Ukraine, invasion russe, cessez-le-feu, війна, Україна, вторгнення
  Example for "Cybersécurité": cyberattack, ransomware, data breach, malware, phishing, hacking, vulnerability, zero-day, DDoS, cyber espionage, CISA, APT, threat actor, CVE, incident response, cyberattaque, piratage, faille de sécurité, rançongiciel
- MANDATORY: Include keywords in English, French, and the relevant language for the subject. Every keyword must be at least 3 characters long.
- Generate 2-3 layers max. Layer 1 = OR with all topic keywords in 3 languages. Layer 2 (optional) = AND to narrow by geography/actor (with aliases!). Layer 3 (optional) = NOT to exclude noise.
- For entities, always include common aliases (abbreviations, stock tickers, former names)

Available RSS sources catalog:
{catalog_summary}
"""

    try:
        raw = await _call_gemini(prompt)
        cleaned = raw.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()
        # Fix truncated JSON — try to close open brackets/braces
        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            # Try fixing common truncation issues
            fixed = cleaned
            open_braces = fixed.count('{') - fixed.count('}')
            open_brackets = fixed.count('[') - fixed.count(']')
            if open_brackets > 0:
                fixed += ']' * open_brackets
            if open_braces > 0:
                fixed += '}' * open_braces
            # Remove trailing comma before closing
            fixed = re.sub(r',\s*([}\]])', r'\1', fixed)
            result = json.loads(fixed)

        # Resolve source names to full catalog entries
        catalog_by_name = {s["name"]: s for s in catalog}
        resolved_sources = []
        for sname in result.get("suggested_sources", []):
            if sname in catalog_by_name:
                resolved_sources.append(catalog_by_name[sname])
        result["resolved_sources"] = resolved_sources

        return result
    except Exception as e:
        logger.warning("AI bootstrap failed: %s", e, exc_info=True)
        return {
            "query": {"layers": []},
            "suggested_sources": [],
            "resolved_sources": [],
            "description": "",
            "error": str(e),
        }


# ── Live Preview — search ingested articles by query keywords ─
@router.post("/preview")
async def preview_query(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Preview articles matching query keywords from the already-ingested articles table."""
    from sqlalchemy import text
    from app.domains._shared.query_filter import build_query_where

    query = body.get("query", {})
    layers = query.get("layers", [])
    if not layers:
        return {"articles": [], "total": 0}

    where = build_query_where(layers)
    if not where:
        return {"articles": [], "total": 0}

    raw_sql = f"""
        SELECT id, title, link, source_id, pub_date, description, threat_level, theme
        FROM articles WHERE {where}
        ORDER BY pub_date DESC LIMIT 20
    """
    result = await db.execute(text(raw_sql))
    rows = result.fetchall()

    articles = [
        {
            "id": str(r[0]),
            "title": r[1] or "",
            "article_url": r[2] or "",
            "source_name": r[3] or "",
            "published_at": r[4],
            "summary": (r[5] or "")[:200],
            "threat_level": r[6],
            "category": r[7],
        }
        for r in rows
    ]

    count_sql = f"SELECT COUNT(*) FROM articles WHERE {where}"
    count_result = await db.execute(text(count_sql))
    total = count_result.scalar() or 0

    return {"articles": articles, "total": total}


# ── Refresh feed results ─────────────────────────────────────
@router.post("/{feed_id}/refresh")
async def refresh_feed(
    feed_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run the feed query against ingested articles and populate results."""
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")

    query_data = json.loads(feed.query) if isinstance(feed.query, str) else (feed.query or {})
    inserted = await _refresh_feed_results(db, feed.id, query_data)
    rc = await db.scalar(select(func.count()).where(AIFeedResult.ai_feed_id == feed.id))
    return {"inserted": inserted, "total_results": rc or 0}


# ── CRUD: AI Feeds ───────────────────────────────────────────
@router.post("")
async def create_feed(
    body: AIFeedCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = AIFeed(
        org_id=user.org_id,
        owner_id=user.user_id,
        name=body.name,
        description=body.description,
        query=body.query.model_dump_json(),
        ai_config=body.ai_config.model_dump_json(),
    )
    db.add(feed)
    await db.commit()
    await db.refresh(feed)

    # Auto-populate results from existing articles
    query_data = body.query.model_dump()
    await _refresh_feed_results(db, feed.id, query_data)

    sc = await db.scalar(select(func.count()).where(AIFeedSource.ai_feed_id == feed.id))
    rc = await db.scalar(select(func.count()).where(AIFeedResult.ai_feed_id == feed.id))
    return _serialize_feed(feed, sc or 0, rc or 0)


@router.get("")
async def list_feeds(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import distinct
    stmt = (
        select(
            AIFeed,
            func.count(distinct(AIFeedSource.id)).label("source_count"),
            func.count(distinct(AIFeedResult.id)).label("result_count"),
        )
        .outerjoin(AIFeedSource, AIFeedSource.ai_feed_id == AIFeed.id)
        .outerjoin(AIFeedResult, AIFeedResult.ai_feed_id == AIFeed.id)
        .where(AIFeed.org_id == user.org_id, AIFeed.status != "archived")
        .group_by(AIFeed.id)
        .order_by(desc(AIFeed.created_at))
    )
    rows = (await db.execute(stmt)).all()
    return {"feeds": [_serialize_feed(f, sc, rc) for f, sc, rc in rows]}


@router.get("/{feed_id}")
async def get_feed(
    feed_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    sc = await db.scalar(select(func.count()).where(AIFeedSource.ai_feed_id == feed.id))
    rc = await db.scalar(select(func.count()).where(AIFeedResult.ai_feed_id == feed.id))
    return _serialize_feed(feed, sc or 0, rc or 0)


@router.put("/{feed_id}")
async def update_feed(
    feed_id: uuid.UUID,
    body: AIFeedUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    if body.name is not None:
        feed.name = body.name
    if body.description is not None:
        feed.description = body.description
    if body.query is not None:
        feed.query = body.query.model_dump_json()
    if body.ai_config is not None:
        feed.ai_config = body.ai_config.model_dump_json()
    if body.status is not None:
        feed.status = body.status
    feed.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(feed)
    return _serialize_feed(feed)


@router.delete("/{feed_id}")
async def delete_feed(
    feed_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    feed.status = "archived"
    feed.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "archived"}


# ── Sources management ───────────────────────────────────────
@router.get("/{feed_id}/sources")
async def list_feed_sources(
    feed_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    stmt = select(AIFeedSource).where(AIFeedSource.ai_feed_id == feed_id)
    sources = (await db.scalars(stmt)).all()
    return {"sources": [_serialize_source(s) for s in sources]}


@router.post("/{feed_id}/sources")
async def add_feed_source(
    feed_id: uuid.UUID,
    body: SourceAdd,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    source = AIFeedSource(
        ai_feed_id=feed_id,
        url=body.url,
        name=body.name,
        lang=body.lang,
        tier=body.tier,
        source_type=body.source_type,
        country=body.country,
        continent=body.continent,
        origin=body.origin,
    )
    db.add(source)

    # Also persist in global RSS catalog (dedup by URL)
    from app.models.ai_feed import RssCatalogEntry
    existing = await db.execute(
        select(RssCatalogEntry).where(RssCatalogEntry.url == body.url)
    )
    if not existing.scalar():
        catalog_entry = RssCatalogEntry(
            url=body.url,
            name=body.name,
            lang=body.lang,
            tier=body.tier or 3,
            source_type=body.source_type,
            country=body.country,
            continent=body.continent,
            origin="custom",
        )
        db.add(catalog_entry)

    await db.commit()
    await db.refresh(source)
    return _serialize_source(source)


@router.delete("/{feed_id}/sources/{source_id}")
async def remove_feed_source(
    feed_id: uuid.UUID,
    source_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    source = await db.get(AIFeedSource, source_id)
    if not source or source.ai_feed_id != feed_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source not found")
    await db.delete(source)
    await db.commit()
    return {"status": "removed"}


@router.patch("/{feed_id}/sources/{source_id}")
async def toggle_feed_source(
    feed_id: uuid.UUID,
    source_id: uuid.UUID,
    body: SourceToggle,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    source = await db.get(AIFeedSource, source_id)
    if not source or source.ai_feed_id != feed_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source not found")
    source.enabled = body.enabled
    await db.commit()
    return _serialize_source(source)


# ── Results (articles) ───────────────────────────────────────
@router.get("/{feed_id}/articles")
async def list_feed_articles(
    feed_id: uuid.UUID,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(AIFeed, feed_id)
    if not feed or feed.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed not found")
    total = await db.scalar(
        select(func.count()).where(AIFeedResult.ai_feed_id == feed_id)
    )
    stmt = (
        select(AIFeedResult)
        .where(AIFeedResult.ai_feed_id == feed_id)
        .order_by(desc(AIFeedResult.relevance_score), desc(AIFeedResult.published_at))
        .offset(offset)
        .limit(limit)
    )
    results = (await db.scalars(stmt)).all()
    return {"articles": [_serialize_result(r) for r in results], "total": total or 0}
