"""
Cases API — CRUD for intelligence cases with board layout management,
article correlation, and LLM-powered identity cards.
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.domains.cases.identity import generate_identity_card
from app.models.article import Article
from app.models.case import Case, CaseBoard

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cases", tags=["cases"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CaseCreate(BaseModel):
    name: str = Field(..., max_length=200)
    type: str = Field(..., max_length=20)
    description: str = Field("", max_length=1000)


class CaseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    search_keywords: str | None = None
    query: dict | None = None  # Feed-style query {layers: [...]}
    identity_card: dict | None = None
    status: str | None = None
    regenerate: bool = False  # if True, re-generate identity card + keywords from description


class BoardUpdate(BaseModel):
    layout: list


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _generate_search_keywords(name: str, identity: dict | None = None, description: str = "") -> str:
    """Build search keywords from name + identity card + description.

    These keywords are stored on the case and used by the article filter.
    Each keyword is separated by | (pipe) to distinguish multi-word phrases.
    """
    terms: list[str] = [name]

    if identity:
        # Aliases are high-value search terms
        for alias in identity.get("aliases", []):
            if alias and len(alias) >= 2:
                terms.append(alias)
        # AI-generated search terms from description analysis
        for st in identity.get("search_terms", []):
            if st and len(st) >= 3:
                terms.append(st)
        # Sector if multi-word
        sector = identity.get("sector", "")
        if sector and " " in sector:
            terms.append(sector)
        # Stock ticker
        ticker = identity.get("stock_ticker", "")
        if ticker and len(ticker) >= 2:
            terms.append(ticker)

    # Deduplicate
    seen = set()
    unique = []
    for t in terms:
        low = t.lower().strip()
        if low and low not in seen:
            seen.add(low)
            unique.append(t.strip())
    return "|".join(unique)  # pipe-separated for multi-word support


def _serialize_article(a: Article) -> dict:
    """Convert an Article model instance to a JSON-safe dict."""
    return {
        "id": str(a.id),
        "source_id": a.source_id,
        "title": a.title,
        "title_translated": a.title_translated,
        "description": a.description,
        "link": a.link,
        "pub_date": a.pub_date.isoformat() if a.pub_date else None,
        "lang": a.lang,
        "threat_level": a.threat_level,
        "theme": a.theme,
        "confidence": a.confidence,
        "entities": json.loads(a.entities_json) if a.entities_json else [],
        "country_codes": json.loads(a.country_codes_json) if a.country_codes_json else [],
    }


# Common FR→EN country name mapping for cases
_COUNTRY_FR_EN = {
    "mongolie": "Mongolia", "france": "France", "taiwan": "Taiwan",
    "allemagne": "Germany", "espagne": "Spain", "italie": "Italy",
    "russie": "Russia", "chine": "China", "japon": "Japan",
    "coree du sud": "South Korea", "coree du nord": "North Korea",
    "royaume-uni": "United Kingdom", "etats-unis": "United States",
    "bresil": "Brazil", "mexique": "Mexico", "inde": "India",
    "turquie": "Turkey", "egypte": "Egypt", "maroc": "Morocco",
    "algerie": "Algeria", "tunisie": "Tunisia", "arabie saoudite": "Saudi Arabia",
    "emirats arabes unis": "UAE", "iran": "Iran", "irak": "Iraq",
    "syrie": "Syria", "liban": "Lebanon", "israel": "Israel",
    "palestine": "Palestine", "ukraine": "Ukraine", "pologne": "Poland",
    "roumanie": "Romania", "grece": "Greece", "suede": "Sweden",
    "norvege": "Norway", "finlande": "Finland", "danemark": "Denmark",
    "pays-bas": "Netherlands", "belgique": "Belgium", "suisse": "Switzerland",
    "autriche": "Austria", "hongrie": "Hungary", "portugal": "Portugal",
    "colombie": "Colombia", "perou": "Peru", "chili": "Chile",
    "argentine": "Argentina", "venezuela": "Venezuela", "cuba": "Cuba",
    "nigeria": "Nigeria", "afrique du sud": "South Africa", "ethiopie": "Ethiopia",
    "kenya": "Kenya", "senegal": "Senegal", "cote d ivoire": "Ivory Coast",
    "thailande": "Thailand", "vietnam": "Vietnam", "indonesie": "Indonesia",
    "malaisie": "Malaysia", "philippines": "Philippines", "pakistan": "Pakistan",
    "bangladesh": "Bangladesh", "myanmar": "Myanmar", "cambodge": "Cambodia",
    "australie": "Australia", "nouvelle-zelande": "New Zealand",
}


def _add_country_names(case_name: str, cc: str, strong: list[str]):
    """Add both FR and EN country names as strong search terms."""
    name_lower = case_name.lower()
    en_name = _COUNTRY_FR_EN.get(name_lower)
    if en_name and en_name.lower() != name_lower:
        strong.append(en_name)


def _get_case_search_terms(case: Case) -> tuple[list[str], list[str]]:
    """Extract strong and weak search terms from a case.

    Strong = terms containing the case name (or root) or unique identifiers
    Weak = generic terms that need anchoring to avoid noise
    """
    case_name_lower = case.name.lower()
    # Extract root for cross-language matching: "Mongolie" → "mongol", "Ukraine" → "ukrain"
    root = case_name_lower[:min(len(case_name_lower), 6)].rstrip("eaiou")
    if len(root) < 3:
        root = case_name_lower[:4]

    strong: list[str] = [case.name]
    weak: list[str] = []

    if case.search_keywords:
        for kw in case.search_keywords.split("|"):
            kw = kw.strip()
            if len(kw) < 3:
                continue
            kw_lower = kw.lower()
            # Keyword related to case name → strong
            # Matches: "Mongolie"→"Mongolia", "Mongolian resources", "Outer Mongolia"
            if (case_name_lower in kw_lower
                    or kw_lower in case_name_lower
                    or root in kw_lower):
                strong.append(kw)
            else:
                weak.append(kw)

    if case.identity_card:
        try:
            card = json.loads(case.identity_card) if isinstance(case.identity_card, str) else case.identity_card
            # Stock ticker is strong (unique)
            ticker = card.get("stock_ticker", "")
            if ticker and len(ticker) >= 2:
                strong.append(ticker)
            # Country code — NOT added to strong terms (too short, causes false matches)
            # Used directly in the filter for country_codes_json matching only
            cc = (card.get("country_code") or "").upper()
            # For country-type cases, add both FR and EN full country names as strong terms
            if case.type == "country":
                _add_country_names(case.name, cc, strong)
            # Sector is weak (generic)
            sector = card.get("sector", "")
            if sector and len(sector) >= 3:
                weak.append(sector)
            # Key people last names → strong
            for person in card.get("key_people", []):
                name = person if isinstance(person, str) else (person.get("name", "") if isinstance(person, dict) else "")
                parts = name.strip().split()
                if len(parts) >= 2 and len(parts[-1]) >= 3:
                    strong.append(parts[-1])
            # Aliases → strong (they are specific to this entity)
            for alias in card.get("aliases", []):
                if alias and len(alias) >= 3:
                    strong.append(alias)
        except Exception:
            pass

    # Deduplicate
    def dedup(lst):
        seen = set()
        out = []
        for t in lst:
            low = t.lower()
            if low not in seen:
                seen.add(low)
                out.append(t)
        return out

    return dedup(strong), dedup(weak)


def _case_where_clause(case: Case) -> str | None:
    """Return the raw SQL WHERE clause string for a case's query, or None.
    Used by matching.py for populating the junction table (LIKE scan at write time).
    """
    if not case.query_json:
        return None
    try:
        query = json.loads(case.query_json) if isinstance(case.query_json, str) else case.query_json
        layers = query.get("layers", [])
        if layers:
            from app.domains._shared.query_filter import build_query_where
            return build_query_where(layers)
    except Exception:
        pass
    return None


def _case_article_filter(case: Case):
    """Return a SQLAlchemy filter using the pre-computed case_articles junction table."""
    from app.models.case import CaseArticle
    return Article.id.in_(select(CaseArticle.article_id).where(CaseArticle.case_id == case.id))


async def _ai_compose_query(db, name: str, case_type: str, identity: dict) -> list[str]:
    """Use LLM to compose a multi-model query from the Intel Models catalog.

    Finds existing models by fuzzy search, creates missing ones,
    and returns a list of model IDs for optimal coverage.
    """
    from app.models.intel_model import IntelModel
    from app.source_engine.matching_engine import search_models

    all_models = (await db.scalars(select(IntelModel).order_by(IntelModel.family, IntelModel.section))).all()

    # Build compact catalog for the LLM
    catalog_lines = []
    for m in all_models:
        catalog_lines.append(f"{m.id.hex[:12]}|{m.family}/{m.section}|{m.name}")
    catalog_text = "\n".join(catalog_lines[:300])  # limit context size

    # Type → default section for new models
    TYPE_SECTIONS = {
        "company": ("foundation", "Companies"),
        "person": ("foundation", "Persons"),
        "country": ("foundation", "Countries"),
        "thematic": ("foundation", "Industries"),
    }
    default_fam, default_sec = TYPE_SECTIONS.get(case_type, ("foundation", "Industries"))

    description = identity.get("description", "") if identity else ""
    sector = identity.get("sector", "") if identity else ""

    try:
        from app.source_engine.detector import _call_gemini
        import re as _re

        prompt = f"""You are composing an OSINT intelligence query for a case.

Case: "{name}"
Type: {case_type}
  - company = surveiller une organisation (entreprise, ONG, institution)
  - person = suivre un individu clé (dirigeant, politique, personnalité)
  - country = veille géopolitique sur un pays ou une région
  - thematic = sujet transversal (industrie, technologie, risque)
Description: {description}
Sector: {sector}

Here is the catalog of existing Intel Models (id|family/section|name):
{catalog_text}

Your job: compose a STARTING intelligence query.

IMPORTANT: Start with just ONE layer (OR) containing ONLY the main entity.
The user will add AND/NOT layers manually to refine.

For a COMPANY: Line 1 (OR) = the company itself only
For a COUNTRY: Line 1 (OR) = the country itself only
For a PERSON: Line 1 (OR) = the person only
For a THEMATIC: Line 1 (OR) = the main topic only

If the entity doesn't exist in the catalog, include it as NEW.

Return ONLY valid JSON (no markdown):
{{
  "layers": [
    {{"operator": "OR", "existing_ids": ["id1"], "new_models": []}}
  ]
}}

Each layer can have:
- existing_ids: 12-char IDs from the catalog above
- new_models: [{{"name": "...", "family": "{default_fam}", "section": "{default_sec}", "aliases": ["8-15 SPECIFIC aliases, multilingual, min 5 chars. NEVER use common words that appear in normal text (e.g. 'Total', 'Global', 'National', 'Energy'). Only use unique identifiers for this entity."]}}]

Rules:
- Companies → foundation/Companies, Countries → foundation/Countries, Industries → foundation/Industries
- 1 layer ONLY. The user adds more manually."""

        raw = await _call_gemini(prompt)
        cleaned = _re.sub(r"^```(?:json)?\s*", "", raw.strip())
        cleaned = _re.sub(r"\s*```$", "", cleaned)
        data = json.loads(cleaned.strip())

        id_map = {m.id.hex[:12]: m.id.hex for m in all_models}
        result_layers = []

        for layer in data.get("layers", []):
            op = layer.get("operator", "OR")
            layer_model_ids = []

            # Resolve existing IDs
            for short_id in layer.get("existing_ids", []):
                full_id = id_map.get(short_id[:12])
                if full_id:
                    layer_model_ids.append(full_id)

            # Create new models if needed
            for new in layer.get("new_models", []):
                existing = search_models(new["name"], limit=1)
                if existing and existing[0]["score"] >= 80:
                    layer_model_ids.append(existing[0]["model_id"])
                    logger.info("Compose: '%s' matched existing '%s'", new["name"], existing[0]["model_name"])
                else:
                    m = IntelModel(
                        name=new["name"],
                        family=new.get("family", default_fam),
                        section=new.get("section", default_sec),
                        aliases=new.get("aliases", [new["name"]]),
                        origin="ai_enriched",
                    )
                    db.add(m)
                    await db.flush()
                    layer_model_ids.append(m.id.hex)
                    logger.info("Compose: created '%s' in %s/%s", m.name, m.family, m.section)

            if layer_model_ids:
                result_layers.append({"operator": op, "model_ids": layer_model_ids})

        logger.info("AI compose for case '%s': %d layers", name, len(result_layers))
        return result_layers

    except Exception:
        logger.warning("AI compose failed for case '%s', fallback to fuzzy search", name, exc_info=True)
        results = search_models(name, limit=1)
        if results:
            return [{"operator": "OR", "model_ids": [results[0]["model_id"]]}]
        return []


def _get_model_layers(case: Case) -> list[dict]:
    """Extract model layers from case query_json.
    Returns [{"operator": "OR"|"AND"|"NOT", "model_ids": ["hex1", "hex2"]}]"""
    if not case.query_json:
        return []
    try:
        q = json.loads(case.query_json) if isinstance(case.query_json, str) else case.query_json
        # New format: {"model_layers": [{"operator": "OR", "model_ids": [...]}]}
        if "model_layers" in q:
            layers = []
            for layer in q["model_layers"]:
                mids = [m.replace("-", "") for m in layer.get("model_ids", []) if m]
                if mids:
                    layers.append({"operator": layer.get("operator", "OR"), "model_ids": mids})
            return layers
        # Flat format: {"models": ["uuid1", "uuid2"]} → single OR layer
        if "models" in q:
            mids = [m.replace("-", "") for m in q["models"] if m]
            return [{"operator": "OR", "model_ids": mids}] if mids else []
    except Exception:
        pass
    return []


def _get_model_ids(case: Case) -> list[str]:
    """Flat list of all model IDs (for backward compat)."""
    layers = _get_model_layers(case)
    all_ids = []
    for layer in layers:
        all_ids.extend(layer.get("model_ids", []))
    return all_ids


async def _count_articles_and_alerts(db: AsyncSession, case: Case) -> tuple[int, int]:
    """Count articles + alerts via article_models (new) or case_articles (legacy)."""
    from sqlalchemy import text
    model_ids = _get_model_ids(case)

    model_layers = _get_model_layers(case)
    if model_layers:
        # Sequential layer logic: OR within layer, AND/NOT between layers
        # Build nested SQL: each layer filters the result of all previous layers
        params = {}
        pidx = 0

        # Start with all article IDs
        inner_sql = "SELECT id FROM articles"

        for layer in model_layers:
            op = layer["operator"]
            mids = layer["model_ids"]
            placeholders = ",".join(f":p{pidx + i}" for i in range(len(mids)))
            for i, mid in enumerate(mids):
                params[f"p{pidx + i}"] = mid
            pidx += len(mids)

            # Articles matching ANY model in this layer (OR within layer)
            layer_sql = f"SELECT article_id FROM article_models WHERE model_id IN ({placeholders})"

            if op == "NOT":
                inner_sql = f"SELECT id FROM ({inner_sql}) sub WHERE id NOT IN ({layer_sql})"
            else:
                # AND: intersection — keep articles that are in BOTH previous result and this layer
                inner_sql = f"SELECT id FROM ({inner_sql}) sub WHERE id IN ({layer_sql})"

        result = await db.execute(text(
            f"SELECT count(*), sum(CASE WHEN a.threat_level IN ('critical','high') THEN 1 ELSE 0 END) "
            f"FROM articles a WHERE a.id IN ({inner_sql})"
        ), params)
    else:
        # Legacy path: case_articles (for old cases not yet migrated)
        result = await db.execute(text(
            "SELECT count(*), sum(CASE WHEN a.threat_level IN ('critical','high') THEN 1 ELSE 0 END) "
            "FROM articles a JOIN case_articles ca ON ca.article_id = a.id "
            "WHERE ca.case_id = :cid"
        ), {"cid": case.id.hex})

    row = result.one()
    return row[0] or 0, int(row[1] or 0)


def _serialize_case(case: Case, article_count: int = 0, alert_count: int = 0) -> dict:
    """Serialize a Case model to a JSON-safe dict."""
    return {
        "id": str(case.id),
        "org_id": str(case.org_id),
        "owner_id": str(case.owner_id),
        "name": case.name,
        "type": case.type,
        "search_keywords": case.search_keywords,
        "query": json.loads(case.query_json) if case.query_json else None,
        "identity_card": json.loads(case.identity_card) if case.identity_card else None,
        "status": case.status,
        "article_count": article_count,
        "alert_count": alert_count,
        "created_at": case.created_at.isoformat() if case.created_at else None,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
    }


async def _background_refresh_case(case_id_str: str):
    """Rebuild case_articles junction in background (non-blocking for the API response)."""
    try:
        import uuid
        from app.db import async_session
        from app.domains.cases.matching import refresh_case_articles

        async with async_session() as db:
            case = await db.scalar(select(Case).where(Case.id == uuid.UUID(case_id_str)))
            if case:
                await refresh_case_articles(db, case)
                await db.commit()
    except Exception:
        logger.warning("Background refresh failed for case %s", case_id_str, exc_info=True)


async def _background_ingest(case_name: str):
    """Trigger article ingestion for a case via all pipelines: RSS catalog + Google News + GDELT."""
    try:
        from app.source_engine.google_news import fetch_google_news
        from app.source_engine.gdelt import fetch_gdelt
        from app.source_engine.article_pipeline import ingest_articles
        from app.source_engine.catalog_ingest import ingest_full_catalog
        from app.db import async_session

        async with async_session() as db:
            # 1) Refresh RSS catalog — ensures latest BBC, Guardian, etc. are in DB
            try:
                catalog_inserted = await ingest_full_catalog(db)
                if catalog_inserted:
                    logger.info("Catalog refresh for case '%s': %d new articles", case_name, catalog_inserted)
            except Exception:
                pass

            # 2) Google News (query-based)
            all_rows = []
            source_id = f"case_{case_name.lower().replace(' ', '_')}"
            try:
                gnews = await fetch_google_news(query=case_name, theme="", country="", lang="en")
                all_rows.extend(gnews)
            except Exception:
                pass

            # 3) GDELT (query-based, broader coverage)
            try:
                gdelt = await fetch_gdelt(query=case_name, max_records=100)
                all_rows.extend(gdelt)
            except Exception:
                pass

            # 4) Ingest query-based results — dedup handled by SHA256(link)
            if all_rows:
                inserted = await ingest_articles(db, source_id, all_rows)
                logger.info("Background ingest for case '%s': %d inserted (%d fetched)", case_name, inserted, len(all_rows))
    except Exception:
        logger.warning("Background ingestion failed for case '%s'", case_name, exc_info=True)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

# 1. POST /cases — Create case
@router.post("")
async def create_case(
    body: CaseCreate,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new intelligence case with auto-generated identity card."""
    # Generate identity card via LLM — description gives the AI full context
    identity = await generate_identity_card(body.name, body.type, body.description)
    if not identity:
        identity = {"name": body.name, "type": body.type, "description": body.description or f"{body.type.title()} named {body.name}"}
    search_keywords = _generate_search_keywords(body.name, identity, body.description)

    # AI-compose: find or create Intel Models, then compose a multi-model query
    from app.models.intel_model import IntelModel
    query_layers = await _ai_compose_query(db, body.name, body.type, identity)
    case = Case(
        id=uuid.uuid4(),
        org_id=user.org_id,
        owner_id=user.user_id,
        name=body.name,
        type=body.type,
        search_keywords=search_keywords,
        query_json=json.dumps({"model_layers": query_layers}) if query_layers else None,
        identity_card=json.dumps(identity),
        status="active",
    )

    # Default board layout
    default_layout = [
        {"i": "identity", "x": 0, "y": 0, "w": 4, "h": 4},
        {"i": "articles", "x": 4, "y": 0, "w": 8, "h": 4},
        {"i": "stats", "x": 0, "y": 4, "w": 6, "h": 3},
        {"i": "timeline", "x": 6, "y": 4, "w": 6, "h": 3},
    ]

    board = CaseBoard(
        id=uuid.uuid4(),
        case_id=case.id,
        layout=json.dumps(default_layout),
    )

    db.add(case)
    db.add(board)
    await db.commit()
    await db.refresh(case)

    # Trigger background ingestion
    background_tasks.add_task(_background_ingest, body.name)

    article_count, alert_count = await _count_articles_and_alerts(db, case)

    return _serialize_case(case, article_count, alert_count)


# 2. GET /cases — List all cases for org
@router.get("")
async def list_cases(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all cases for the current user's organization."""
    stmt = (
        select(Case)
        .where(Case.org_id == user.org_id)
        .order_by(desc(Case.created_at))
    )
    result = await db.scalars(stmt)
    cases = result.all()

    out = []
    for c in cases:
        article_count, alert_count = await _count_articles_and_alerts(db, c)
        out.append(_serialize_case(c, article_count, alert_count))

    return {"cases": out}


# 3. GET /cases/{id} — Single case detail
@router.get("/{case_id}")
async def get_case(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single case by ID."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    article_count, alert_count = await _count_articles_and_alerts(db, case)

    return _serialize_case(case, article_count, alert_count)


# 4. PUT /cases/{id} — Update case
@router.put("/{case_id}")
async def update_case(
    case_id: uuid.UUID,
    body: CaseUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update case fields. If regenerate=true, re-generates identity card + keywords from description."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    if body.name is not None:
        case.name = body.name
    if body.status is not None:
        case.status = body.status

    # Regenerate identity card + MERGE keywords (never lose old terms)
    if body.regenerate and body.description is not None:
        identity = await generate_identity_card(case.name, case.type, body.description)
        if not identity:
            identity = {"name": case.name, "type": case.type, "description": body.description}
        case.identity_card = json.dumps(identity)
        new_kw = _generate_search_keywords(case.name, identity, body.description)
        # Merge: old keywords + new keywords (union, never shrink)
        old_terms = set((case.search_keywords or "").split("|"))
        new_terms = set(new_kw.split("|"))
        merged = old_terms | new_terms
        merged.discard("")
        case.search_keywords = "|".join(sorted(merged))
    else:
        if body.search_keywords is not None:
            case.search_keywords = body.search_keywords
        if body.identity_card is not None:
            case.identity_card = json.dumps(body.identity_card)

    query_changed = False
    if body.query is not None:
        case.query_json = json.dumps(body.query)
        query_changed = True

    case.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(case)

    # Re-populate junction: article_models for new format, case_articles for legacy
    if query_changed:
        model_ids = _get_model_ids(case)
        if not model_ids:
            # Legacy format: use LIKE-based refresh
            from app.domains.cases.matching import refresh_case_articles
            count = await refresh_case_articles(db, case)
            await db.commit()
            logger.info("update_case(%s): legacy refresh, %d articles", case.name, count)
        else:
            # New format: article_models already populated at ingestion, just log
            logger.info("update_case(%s): query uses %d model_ids, no refresh needed", case.name, len(model_ids))

    article_count, alert_count = await _count_articles_and_alerts(db, case)

    return _serialize_case(case, article_count, alert_count)


# 5. DELETE /cases/{id} — Delete case + board (cascade)
@router.delete("/{case_id}")
async def delete_case(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a case and its associated board."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    await db.delete(case)
    await db.commit()

    return {"deleted": True, "id": str(case_id)}


# 6. GET /cases/{id}/articles — Articles matching case
@router.get("/{case_id}/articles")
async def case_articles(
    case_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    days: int = Query(7, ge=1, le=90, description="Retention window in days"),
    threat: str = Query("", description="Filter by threat level"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get articles matching this case via article_models (new) or case_articles (legacy)."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    cutoff = datetime.now(timezone.utc) - __import__('datetime').timedelta(days=days)
    model_ids = _get_model_ids(case)

    model_layers = _get_model_layers(case)
    if model_layers:
        # Sequential layer logic via raw SQL (same as _count_articles_and_alerts)
        from sqlalchemy import text as sa_text
        params = {}
        pidx = 0
        inner_sql = f"SELECT id FROM articles WHERE pub_date >= :cutoff"
        params["cutoff"] = cutoff.isoformat()

        for layer in model_layers:
            op = layer["operator"]
            mids = layer["model_ids"]
            placeholders = ",".join(f":p{pidx + i}" for i in range(len(mids)))
            for i, mid in enumerate(mids):
                params[f"p{pidx + i}"] = mid
            pidx += len(mids)
            layer_sql = f"SELECT article_id FROM article_models WHERE model_id IN ({placeholders})"
            if op == "NOT":
                inner_sql = f"SELECT id FROM ({inner_sql}) sub WHERE id NOT IN ({layer_sql})"
            else:
                inner_sql = f"SELECT id FROM ({inner_sql}) sub WHERE id IN ({layer_sql})"

        # Execute raw SQL to get matched IDs, then ORM select
        import uuid as _uuid
        result_ids = await db.execute(sa_text(inner_sql), params)
        matched_ids = [_uuid.UUID(row[0]) for row in result_ids.fetchall()]
        stmt = (
            select(Article)
            .where(Article.id.in_(matched_ids))
            .order_by(desc(Article.pub_date))
        )
    else:
        # Legacy path: case_articles
        from app.models.case import CaseArticle
        stmt = (
            select(Article)
            .join(CaseArticle, CaseArticle.article_id == Article.id)
            .where(CaseArticle.case_id == case_id, Article.pub_date >= cutoff)
            .order_by(desc(Article.pub_date))
        )

    if threat:
        stmt = stmt.where(Article.threat_level == threat)

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt) or 0

    # Fetch page
    stmt = stmt.offset(offset).limit(limit)
    result = await db.scalars(stmt)
    articles = result.all()

    return {
        "articles": [_serialize_article(a) for a in articles],
        "total": total,
    }


# 7. GET /cases/{id}/stats — Stats scoped to case
@router.get("/{case_id}/stats")
async def case_stats(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated stats for articles matching this case.

    Uses case_articles junction (indexed JOIN) + CTE for single-scan aggregation.
    """
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    from sqlalchemy import text

    # Build article ID set using model_layers logic
    model_layers = _get_model_layers(case)
    if model_layers:
        params = {}
        pidx = 0
        inner_sql = "SELECT id FROM articles"
        for layer in model_layers:
            mids = layer["model_ids"]
            placeholders = ",".join(f":p{pidx + i}" for i in range(len(mids)))
            for i, mid in enumerate(mids):
                params[f"p{pidx + i}"] = mid
            pidx += len(mids)
            layer_sql = f"SELECT article_id FROM article_models WHERE model_id IN ({placeholders})"
            if layer["operator"] == "NOT":
                inner_sql = f"SELECT id FROM ({inner_sql}) sub WHERE id NOT IN ({layer_sql})"
            else:
                inner_sql = f"SELECT id FROM ({inner_sql}) sub WHERE id IN ({layer_sql})"

        raw = f"""
            WITH matched AS (
                SELECT a.threat_level, a.theme, a.source_id
                FROM articles a
                WHERE a.id IN ({inner_sql})
            )
            SELECT 'total' AS stat, '_' AS key, count(*) AS n FROM matched
            UNION ALL
            SELECT 'threat', COALESCE(threat_level, 'info'), count(*) FROM matched GROUP BY threat_level
            UNION ALL
            SELECT 'theme', COALESCE(theme, 'unknown'), count(*) FROM matched GROUP BY theme
            UNION ALL
            SELECT 'source', COALESCE(source_id, 'unknown'), count(*) FROM matched GROUP BY source_id
        """
        result = await db.execute(text(raw), params)
    else:
        # Legacy fallback
        raw = """
            WITH matched AS (
                SELECT a.threat_level, a.theme, a.source_id
                FROM articles a
                JOIN case_articles ca ON ca.article_id = a.id
                WHERE ca.case_id = :cid
            )
            SELECT 'total' AS stat, '_' AS key, count(*) AS n FROM matched
            UNION ALL
            SELECT 'threat', COALESCE(threat_level, 'info'), count(*) FROM matched GROUP BY threat_level
            UNION ALL
            SELECT 'theme', COALESCE(theme, 'unknown'), count(*) FROM matched GROUP BY theme
            UNION ALL
            SELECT 'source', COALESCE(source_id, 'unknown'), count(*) FROM matched GROUP BY source_id
        """
        result = await db.execute(text(raw), {"cid": case_id.hex})
    rows = result.all()

    total = 0
    by_threat: dict[str, int] = {}
    by_theme: dict[str, int] = {}
    by_source: dict[str, int] = {}
    for stat, key, n in rows:
        if stat == "total":
            total = n
        elif stat == "threat":
            by_threat[key] = n
        elif stat == "theme":
            by_theme[key] = n
        elif stat == "source":
            by_source[key] = n

    return {
        "total": total,
        "by_threat": by_threat,
        "by_theme": by_theme,
        "by_source": by_source,
    }


# 8. POST /cases/{id}/ingest — Force ingestion for case
@router.post("/{case_id}/ingest")
async def ingest_case(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Force article ingestion for a case name. Tracked as a job for frontend polling."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    from app.domains.jobs.helpers import start_job, finish_job
    job_id = await start_job("case_ingest", target_id=str(case_id))

    # Auto-migrate legacy cases to new format (models)
    model_ids = _get_model_ids(case)
    if not model_ids:
        try:
            from app.models.intel_model import IntelModel
            existing_model = (await db.scalars(
                select(IntelModel).where(func.lower(IntelModel.name) == case.name.lower())
            )).first()
            if existing_model:
                case.query_json = json.dumps({"models": [str(existing_model.id)]})
                await db.commit()
                logger.info("Auto-migrated case '%s' to models format (model=%s)", case.name, existing_model.name)
        except Exception:
            logger.debug("Auto-migration skipped for case '%s'", case.name, exc_info=True)

    try:
        from app.source_engine.google_news import fetch_google_news
        from app.source_engine.gdelt import fetch_gdelt
        from app.source_engine.article_pipeline import ingest_articles
        from app.source_engine.catalog_ingest import ingest_full_catalog

        # 0) Refresh RSS catalog first — ensures latest articles from all feeds are in DB
        try:
            catalog_inserted = await ingest_full_catalog(db)
        except Exception:
            catalog_inserted = 0

        # Fetch with multiple queries for better coverage
        all_rows = []
        source_id = f"case_{case.name.lower().replace(' ', '_')}"

        # Detect local language
        local_lang = "en"
        if case.identity_card:
            try:
                card = json.loads(case.identity_card) if isinstance(case.identity_card, str) else case.identity_card
                cc = (card.get("country_code") or "").upper()
                lang_map = {"FR": "fr", "DE": "de", "ES": "es", "IT": "it", "PT": "pt", "JP": "ja", "CN": "zh", "KR": "ko", "SA": "ar", "RU": "ru"}
                local_lang = lang_map.get(cc, "en")
            except Exception:
                pass

        # 1) Google News — case name in EN + local lang
        rows_en = await fetch_google_news(query=case.name, theme="", country="", lang="en", max_items=100)
        all_rows.extend(rows_en)
        if local_lang != "en":
            rows_local = await fetch_google_news(query=case.name, theme="", country="", lang=local_lang, max_items=50)
            all_rows.extend(rows_local)

        # 2) GDELT — broader coverage, 3-day window
        try:
            gdelt_rows = await fetch_gdelt(query=case.name, theme=case.type or "", max_records=150)
            all_rows.extend(gdelt_rows)
        except Exception:
            pass

        # 3) Also fetch top search_terms from identity card (enriches the corpus)
        if case.identity_card:
            try:
                card = json.loads(case.identity_card) if isinstance(case.identity_card, str) else case.identity_card
                for term in (card.get("search_terms") or [])[:5]:
                    if term and len(term) >= 3 and term.lower() != case.name.lower():
                        extra = await fetch_google_news(query=term, theme="", country="", lang="en", max_items=30)
                        all_rows.extend(extra)
            except Exception:
                pass

        # Deduplicate by link — no blind tagging, relevance is handled
        # by the strong/weak keyword filter at read time
        seen_links = set()
        unique_rows = []
        for r in all_rows:
            if r.get("link") not in seen_links:
                seen_links.add(r.get("link"))
                unique_rows.append(r)

        inserted = await ingest_articles(db, source_id, unique_rows)

        await finish_job(job_id)
        return {
            "case_id": str(case_id),
            "job_id": job_id,
            "fetched": len(unique_rows),
            "inserted": inserted,
            "catalog_inserted": catalog_inserted,
        }
    except Exception:
        await finish_job(job_id, error="Ingestion pipeline unavailable")
        logger.warning("Ingestion failed for case '%s'", case.name, exc_info=True)
        return {
            "case_id": str(case_id),
            "job_id": job_id,
            "fetched": 0,
            "inserted": 0,
            "warning": "Ingestion pipeline unavailable",
        }


# 9. GET /cases/{id}/board — Get board layout
@router.get("/{case_id}/board")
async def get_board(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the board layout for a case."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    board = await db.scalar(
        select(CaseBoard).where(CaseBoard.case_id == case_id)
    )

    return {
        "case_id": str(case_id),
        "layout": json.loads(board.layout) if board and board.layout else [],
    }


# 10. PUT /cases/{id}/board — Save board layout
@router.put("/{case_id}/board")
async def update_board(
    case_id: uuid.UUID,
    body: BoardUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save the board layout for a case."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    board = await db.scalar(
        select(CaseBoard).where(CaseBoard.case_id == case_id)
    )

    if board:
        board.layout = json.dumps(body.layout)
        board.updated_at = datetime.now(timezone.utc)
    else:
        board = CaseBoard(
            id=uuid.uuid4(),
            case_id=case_id,
            layout=json.dumps(body.layout),
        )
        db.add(board)

    await db.commit()

    return {
        "case_id": str(case_id),
        "layout": body.layout,
    }
