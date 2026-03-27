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
    catalog_summary = "\n".join(
        f"- {s['name']} ({s['country']}, {s['continent']}, {', '.join(s['tags'])}, {s['lang']}, tier {s['tier']})"
        for s in catalog
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
        "operator": "AND",
        "parts": [
          {{"type": "topic", "value": "Topic Name", "scope": "title_and_content"}},
          {{"type": "entity", "value": "Entity Name", "aliases": ["Alias1", "Alias2"], "scope": "title_and_content"}}
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
- Generate 2-4 meaningful layers. First layer should capture the core topic. Add NOT layers to exclude noise.
- For entities, always include common aliases (abbreviations, stock tickers, former names)

Available RSS sources catalog:
{catalog_summary}
"""

    try:
        raw = await _call_gemini(prompt)
        cleaned = raw.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        result = json.loads(cleaned.strip())

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

    query = body.get("query", {})
    layers = query.get("layers", [])
    if not layers:
        return {"articles": [], "total": 0}

    # Strategy: respect each layer's operator (AND/OR/NOT)
    # - Layer 1: always included
    # - Layer N operator: how it combines with all previous layers
    # - Within a layer: OR between parts + aliases
    field = "LOWER(title || ' ' || COALESCE(description, ''))"
    clauses = []  # list of (operator, sql_clause)

    for layer in layers:
        op = layer.get("operator", "AND")
        parts = layer.get("parts", [])
        if not parts:
            continue

        or_likes = []
        for part in parts:
            value = part.get("value", "").strip()
            aliases = part.get("aliases", [])
            for t in [value] + [a for a in aliases if a]:
                safe = t.lower().replace("'", "")
                if safe:
                    or_likes.append(f"{field} LIKE '%{safe}%'")

        if not or_likes:
            continue

        clause = "(" + " OR ".join(or_likes) + ")"
        clauses.append((op, clause))

    if not clauses:
        return {"articles": [], "total": 0}

    # Build WHERE: first clause standalone, then combine with operators
    where = clauses[0][1]
    for op, clause in clauses[1:]:
        if op == "NOT":
            where = f"({where}) AND NOT {clause}"
        elif op == "OR":
            where = f"({where}) OR {clause}"
        else:  # AND
            where = f"({where}) AND {clause}"

    raw_sql = f"""
        SELECT title, link, source_id, pub_date, description, threat_level, theme
        FROM articles WHERE {where}
        ORDER BY pub_date DESC LIMIT 20
    """
    result = await db.execute(text(raw_sql))
    rows = result.fetchall()

    articles = [
        {
            "title": r[0] or "",
            "article_url": r[1] or "",
            "source_name": r[2] or "",
            "published_at": r[3],
            "summary": (r[4] or "")[:200],
            "threat_level": r[5],
            "category": r[6],
        }
        for r in rows
    ]

    count_sql = f"SELECT COUNT(*) FROM articles WHERE {where}"
    count_result = await db.execute(text(count_sql))
    total = count_result.scalar() or 0

    return {"articles": articles, "total": total}


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
    return _serialize_feed(feed)


@router.get("")
async def list_feeds(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            AIFeed,
            func.count(AIFeedSource.id).label("source_count"),
            func.count(AIFeedResult.id).label("result_count"),
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
