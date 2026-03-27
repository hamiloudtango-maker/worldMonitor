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
            # Country code is strong (2-letter ISO)
            cc = (card.get("country_code") or "").upper()
            if cc and len(cc) == 2:
                strong.append(cc)
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


def _case_article_filter(case: Case):
    """Return a SQLAlchemy filter for case articles.

    Strategy:
    - Strong terms (case name, aliases, tickers) → match alone in title/entities/countries
    - Weak terms (generic: "Mining", "China trade") → only match if the article
      ALSO contains a strong term (AND logic), preventing noise
    - Tagged articles always match
    """
    from sqlalchemy import or_, and_

    strong_terms, weak_terms = _get_case_search_terms(case)

    conditions = []

    # 1. Strong terms — match alone (high signal: "Mongolia", "Gobi Desert minerals")
    for term in strong_terms:
        if len(term) == 2 and term.isupper():
            # Country code — only match in country_codes_json, not in free text
            conditions.append(Article.country_codes_json.ilike(f'%"{term}"%'))
        elif len(term) >= 3:
            conditions.append(Article.title.ilike(f"%{term}%"))
            conditions.append(Article.entities_json.ilike(f"%{term}%"))

    # 3. Country code match if available (e.g. "MN" for Mongolia)
    if case.identity_card:
        try:
            card = json.loads(case.identity_card) if isinstance(case.identity_card, str) else case.identity_card
            cc = (card.get("country_code") or "").upper()
            if cc and len(cc) == 2:
                conditions.append(Article.country_codes_json.ilike(f'%"{cc}"%'))
        except Exception:
            pass

    # 4. Weak terms — only match if article also has a strong term (AND logic)
    #    This prevents "Mining" alone from matching all mining articles worldwide
    if weak_terms and strong_terms:
        strong_anchor = or_(
            *[Article.title.ilike(f"%{s}%") for s in strong_terms if len(s) >= 3],
            *[Article.entities_json.ilike(f"%{s}%") for s in strong_terms if len(s) >= 3],
            *[Article.country_codes_json.ilike(f'%"{s}"%') for s in strong_terms if len(s) == 2],
        )
        for term in weak_terms:
            term = term.strip()
            if len(term) >= 3 and term.lower() not in {s.lower() for s in strong_terms}:
                weak_match = or_(
                    Article.title.ilike(f"%{term}%"),
                    Article.entities_json.ilike(f"%{term}%"),
                )
                conditions.append(and_(weak_match, strong_anchor))

    return or_(*conditions)


async def _count_articles(db: AsyncSession, case: Case) -> int:
    """Count articles matching a case."""
    stmt = select(func.count()).select_from(Article).where(_case_article_filter(case))
    return await db.scalar(stmt) or 0


async def _count_alerts(db: AsyncSession, case: Case) -> int:
    """Count high/critical threat articles matching a case."""
    stmt = (
        select(func.count())
        .select_from(Article)
        .where(
            _case_article_filter(case),
            Article.threat_level.in_(["critical", "high"]),
        )
    )
    return await db.scalar(stmt) or 0


def _serialize_case(case: Case, article_count: int = 0, alert_count: int = 0) -> dict:
    """Serialize a Case model to a JSON-safe dict."""
    return {
        "id": str(case.id),
        "org_id": str(case.org_id),
        "owner_id": str(case.owner_id),
        "name": case.name,
        "type": case.type,
        "search_keywords": case.search_keywords,
        "identity_card": json.loads(case.identity_card) if case.identity_card else None,
        "status": case.status,
        "article_count": article_count,
        "alert_count": alert_count,
        "created_at": case.created_at.isoformat() if case.created_at else None,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
    }


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

    case = Case(
        id=uuid.uuid4(),
        org_id=user.org_id,
        owner_id=user.user_id,
        name=body.name,
        type=body.type,
        search_keywords=search_keywords,
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

    article_count = await _count_articles(db, case)
    alert_count = await _count_alerts(db, case)

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
        article_count = await _count_articles(db, c)
        alert_count = await _count_alerts(db, c)
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

    article_count = await _count_articles(db, case)
    alert_count = await _count_alerts(db, case)

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

    case.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(case)

    article_count = await _count_articles(db, case)
    alert_count = await _count_alerts(db, case)

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
    """Get articles matching this case, within retention window (default 7 days)."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    cutoff = datetime.now(timezone.utc) - __import__('datetime').timedelta(days=days)
    stmt = select(Article).where(
        _case_article_filter(case),
        Article.pub_date >= cutoff,
    ).order_by(desc(Article.pub_date))

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
    """Get aggregated stats for articles matching this case."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    base_filter = _case_article_filter(case)

    # Total
    total = await db.scalar(
        select(func.count()).select_from(Article).where(base_filter)
    ) or 0

    # By threat
    threat_rows = await db.execute(
        select(Article.threat_level, func.count())
        .where(base_filter)
        .group_by(Article.threat_level)
        .order_by(desc(func.count()))
    )
    by_threat = {row[0] or "info": row[1] for row in threat_rows}

    # By theme
    theme_rows = await db.execute(
        select(Article.theme, func.count())
        .where(base_filter)
        .group_by(Article.theme)
        .order_by(desc(func.count()))
    )
    by_theme = {row[0] or "unknown": row[1] for row in theme_rows}

    # By source
    source_rows = await db.execute(
        select(Article.source_id, func.count())
        .where(base_filter)
        .group_by(Article.source_id)
        .order_by(desc(func.count()))
    )
    by_source = {row[0] or "unknown": row[1] for row in source_rows}

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
    """Force article ingestion for a case name."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

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

        return {
            "case_id": str(case_id),
            "fetched": len(unique_rows),
            "inserted": inserted,
            "catalog_inserted": catalog_inserted,
        }
    except Exception:
        logger.warning("Ingestion failed for case '%s'", case.name, exc_info=True)
        return {
            "case_id": str(case_id),
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
