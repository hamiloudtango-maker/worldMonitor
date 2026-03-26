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


class CaseUpdate(BaseModel):
    name: str | None = None
    search_keywords: str | None = None
    identity_card: dict | None = None
    status: str | None = None


class BoardUpdate(BaseModel):
    layout: list


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _generate_search_keywords(name: str) -> str:
    """Derive search keywords from the case name."""
    # Split on common separators, lower-case, deduplicate
    words = name.lower().replace("-", " ").replace("_", " ").split()
    unique = list(dict.fromkeys(words))  # preserves order, removes dupes
    return " ".join(unique)


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


def _case_article_filter(case: Case):
    """Return a SQLAlchemy filter clause matching articles to a case name."""
    name = case.name
    return Article.title.ilike(f"%{name}%") | Article.entities_json.ilike(f"%{name}%")


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
    """Try to trigger article ingestion for a case name via existing pipelines."""
    try:
        from app.source_engine.google_news import fetch_google_news
        from app.source_engine.article_pipeline import ingest_articles
        from app.db import async_session

        rows = await fetch_google_news(query=case_name, theme="", country="", lang="en")
        if rows:
            async with async_session() as db:
                source_id = f"case_{case_name.lower().replace(' ', '_')}"
                await ingest_articles(db, source_id, rows)
                logger.info("Background ingest for case '%s': %d articles", case_name, len(rows))
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
    search_keywords = _generate_search_keywords(body.name)

    # Generate identity card via LLM
    identity = await generate_identity_card(body.name, body.type)

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
    """Update case fields (name, search_keywords, identity_card, status)."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    if body.name is not None:
        case.name = body.name
    if body.search_keywords is not None:
        case.search_keywords = body.search_keywords
    if body.identity_card is not None:
        case.identity_card = json.dumps(body.identity_card)
    if body.status is not None:
        case.status = body.status

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
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    threat: str = Query("", description="Filter by threat level"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get articles matching this case (by title or entities)."""
    case = await db.scalar(
        select(Case).where(Case.id == case_id, Case.org_id == user.org_id)
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    stmt = select(Article).where(_case_article_filter(case)).order_by(desc(Article.pub_date))

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

    return {
        "total": total,
        "by_threat": by_threat,
        "by_theme": by_theme,
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
        from app.source_engine.article_pipeline import ingest_articles

        rows = await fetch_google_news(query=case.name, theme="", country="", lang="en")
        source_id = f"case_{case.name.lower().replace(' ', '_')}"
        inserted = await ingest_articles(db, source_id, rows)

        return {
            "case_id": str(case_id),
            "fetched": len(rows),
            "inserted": inserted,
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
