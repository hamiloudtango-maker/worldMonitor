# Cases Intelligence Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add case-based entity tracking to WorldMonitor — users create Cases (company/person/country/thematic), get auto-generated identity cards, automatic article ingestion, and customizable Gridstack investigation boards.

**Architecture:** New `cases` + `case_boards` tables in the FastAPI backend. Cases link to articles via dynamic search queries (no join table). LLM generates identity cards. Scheduler refreshes articles every 30min. Frontend gets 5 tabs: Dashboard (case synthesis), Cases (CRUD + board), 360 Mondial (global view), Rapports, Config.

**Tech Stack:** Python FastAPI, SQLAlchemy async, Gemini Flash (identity cards), React 19, Tailwind v4, Recharts, MapLibre GL, Gridstack.

**Spec:** `docs/superpowers/specs/2026-03-26-cases-intelligence-platform-design.md`

---

## File Structure

### Backend — New Files
- `server-py/app/models/case.py` — Case + CaseBoard SQLAlchemy models
- `server-py/app/domains/cases/router.py` — Cases CRUD + articles + board endpoints
- `server-py/app/domains/cases/identity.py` — LLM identity card generation
- `server-py/app/domains/cases/scheduler.py` — Case ingestion scheduler (30min loop)
- `server-py/tests/test_cases.py` — Tests for cases endpoints

### Backend — Modified Files
- `server-py/app/models/__init__.py` — Export Case, CaseBoard
- `server-py/app/main.py` — Register cases router + start case scheduler in lifespan
- `server-py/app/db.py` — No changes needed (auto table creation handles new models)

### Frontend — New Files
- `src/v2/components/CasesView.tsx` — Cases list + create modal + filters
- `src/v2/components/CaseBoard.tsx` — Gridstack board for single case
- `src/v2/components/WorldView.tsx` — 360 Mondial (global unfiltered view)
- `src/v2/components/CreateCaseModal.tsx` — Modal: name + type → create
- `src/v2/components/IdentityCard.tsx` — Editable case identity widget
- `src/v2/hooks/useCases.ts` — Cases API hook (CRUD + polling)

### Frontend — Modified Files
- `src/v2/components/Dashboard.tsx` — Rewrite: synthesis across all cases
- `src/v2/lib/api.ts` — Add case endpoint helpers

---

## Task 1: Backend — Case & CaseBoard Models

**Files:**
- Create: `server-py/app/models/case.py`
- Modify: `server-py/app/models/__init__.py`

- [ ] **Step 1: Create Case model**

```python
# server-py/app/models/case.py
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # company|person|country|thematic
    search_keywords: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    identity_card: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    board: Mapped["CaseBoard | None"] = relationship(
        back_populates="case", cascade="all, delete-orphan", uselist=False
    )

    __table_args__ = (
        Index("ix_cases_org_id", "org_id"),
        Index("ix_cases_org_status", "org_id", "status"),
    )


class CaseBoard(Base):
    __tablename__ = "case_boards"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    layout: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    case: Mapped["Case"] = relationship(back_populates="board")
```

- [ ] **Step 2: Export models in __init__.py**

Add to `server-py/app/models/__init__.py`:
```python
from app.models.case import Case, CaseBoard
```

And add `"Case", "CaseBoard"` to the `__all__` list.

- [ ] **Step 3: Verify tables create**

Run: `cd server-py && python -c "import asyncio; from app.db import create_all_tables; asyncio.run(create_all_tables()); print('OK')"`

Expected: `OK` (no errors, tables created in SQLite)

- [ ] **Step 4: Commit**

```bash
git add server-py/app/models/case.py server-py/app/models/__init__.py
git commit -m "feat(cases): add Case and CaseBoard SQLAlchemy models"
```

---

## Task 2: Backend — Identity Card LLM Generation

**Files:**
- Create: `server-py/app/domains/cases/identity.py`
- Create: `server-py/app/domains/cases/__init__.py`

- [ ] **Step 1: Create identity card generator**

```python
# server-py/app/domains/cases/__init__.py
```

```python
# server-py/app/domains/cases/identity.py
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

IDENTITY_PROMPT = """Generate a JSON identity card for "{name}" (type: {type}).
Fields:
- description: 2 sentences max describing this entity
- headquarters: city and country (or "N/A")
- sector: industry or domain
- country_code: ISO-2 country code
- founded: year as integer (or null)
- website: URL string (or null)
- key_people: array of max 3 objects with "name" and "role" fields
- revenue: string with currency (or null)

Respond with valid JSON only, no markdown fences."""


async def generate_identity_card(name: str, entity_type: str) -> dict[str, Any]:
    """Call Gemini Flash to generate an identity card. Returns dict or fallback."""
    try:
        from app.source_engine.detector import _call_gemini
    except Exception:
        logger.warning("Gemini not available, returning empty identity card")
        return _fallback_card(name, entity_type)

    prompt = IDENTITY_PROMPT.format(name=name, type=entity_type)
    try:
        raw = await _call_gemini(prompt)
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        card = json.loads(cleaned.strip())
        # Ensure required fields exist
        card.setdefault("description", f"{name} — {entity_type}")
        card.setdefault("country_code", "")
        card.setdefault("sector", "")
        card.setdefault("headquarters", "")
        card.setdefault("key_people", [])
        return card
    except Exception as e:
        logger.warning(f"Identity card generation failed for {name}: {e}")
        return _fallback_card(name, entity_type)


def _fallback_card(name: str, entity_type: str) -> dict[str, Any]:
    return {
        "description": f"{name} ({entity_type})",
        "headquarters": "",
        "sector": "",
        "country_code": "",
        "founded": None,
        "website": None,
        "key_people": [],
        "revenue": None,
    }
```

- [ ] **Step 2: Commit**

```bash
git add server-py/app/domains/cases/
git commit -m "feat(cases): add LLM identity card generator"
```

---

## Task 3: Backend — Cases CRUD Router

**Files:**
- Create: `server-py/app/domains/cases/router.py`
- Modify: `server-py/app/main.py`

- [ ] **Step 1: Create cases router with all endpoints**

```python
# server-py/app/domains/cases/router.py
import json
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.case import Case, CaseBoard
from app.models.article import Article
from app.domains.cases.identity import generate_identity_card

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cases", tags=["cases"])


# ── Schemas ──────────────────────────────────────────────────
class CaseCreate(BaseModel):
    name: str
    type: str  # company|person|country|thematic


class CaseUpdate(BaseModel):
    name: str | None = None
    search_keywords: str | None = None
    identity_card: dict[str, Any] | None = None
    status: str | None = None


class BoardUpdate(BaseModel):
    layout: list[dict[str, Any]]


# ── Helpers ──────────────────────────────────────────────────
def _make_keywords(name: str) -> str:
    """Generate search keywords from entity name."""
    parts = [name.strip()]
    # Add lowercase variant
    lower = name.lower().strip()
    if lower != parts[0]:
        parts.append(lower)
    return ", ".join(parts)


async def _count_articles(db: AsyncSession, keywords: str, name: str) -> tuple[int, int]:
    """Count total articles and alert articles matching a case."""
    kw = f"%{name}%"
    total_q = select(func.count()).select_from(Article).where(
        (Article.title.ilike(kw))
        | (Article.entities_json.ilike(kw))
    )
    total = (await db.execute(total_q)).scalar() or 0

    alert_q = total_q.where(Article.threat_level.in_(["critical", "high"]))
    alerts = (await db.execute(alert_q)).scalar() or 0
    return total, alerts


def _case_to_dict(case: Case, article_count: int = 0, alert_count: int = 0) -> dict:
    card = None
    if case.identity_card:
        try:
            card = json.loads(case.identity_card)
        except Exception:
            card = None
    return {
        "id": str(case.id),
        "name": case.name,
        "type": case.type,
        "search_keywords": case.search_keywords,
        "identity_card": card,
        "status": case.status,
        "article_count": article_count,
        "alert_count": alert_count,
        "created_at": case.created_at.isoformat() if case.created_at else None,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
    }


# ── Endpoints ────────────────────────────────────────────────
@router.get("")
async def list_cases(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Case)
        .where(Case.org_id == user.org_id)
        .order_by(Case.created_at.desc())
    )
    cases = result.scalars().all()
    out = []
    for c in cases:
        total, alerts = await _count_articles(db, c.search_keywords, c.name)
        out.append(_case_to_dict(c, total, alerts))
    return out


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_case(
    body: CaseCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.type not in ("company", "person", "country", "thematic"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "type must be company|person|country|thematic")

    keywords = _make_keywords(body.name)

    # Generate identity card (async, non-blocking if LLM fails)
    card = await generate_identity_card(body.name, body.type)

    case = Case(
        org_id=user.org_id,
        owner_id=user.user_id,
        name=body.name,
        type=body.type,
        search_keywords=keywords,
        identity_card=json.dumps(card),
    )
    db.add(case)
    await db.flush()

    # Create empty board with default layout
    default_layout = [
        {"id": "identity", "x": 0, "y": 0, "w": 4, "h": 3, "widget_type": "identity_card"},
        {"id": "map", "x": 4, "y": 0, "w": 8, "h": 5, "widget_type": "map"},
        {"id": "alerts", "x": 0, "y": 3, "w": 4, "h": 4, "widget_type": "alerts"},
        {"id": "articles", "x": 4, "y": 5, "w": 8, "h": 4, "widget_type": "articles"},
        {"id": "sentiment", "x": 0, "y": 7, "w": 6, "h": 3, "widget_type": "sentiment"},
        {"id": "themes", "x": 6, "y": 7, "w": 6, "h": 3, "widget_type": "themes"},
    ]
    board = CaseBoard(case_id=case.id, layout=json.dumps(default_layout))
    db.add(board)
    await db.commit()

    # Trigger initial ingestion in background
    asyncio.create_task(_ingest_for_case(body.name))

    total, alerts = await _count_articles(db, keywords, body.name)
    return _case_to_dict(case, total, alerts)


@router.get("/{case_id}")
async def get_case(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(Case, case_id)
    if not case or case.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    total, alerts = await _count_articles(db, case.search_keywords, case.name)
    return _case_to_dict(case, total, alerts)


@router.put("/{case_id}")
async def update_case(
    case_id: uuid.UUID,
    body: CaseUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(Case, case_id)
    if not case or case.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    if body.name is not None:
        case.name = body.name
        case.search_keywords = _make_keywords(body.name)
    if body.search_keywords is not None:
        case.search_keywords = body.search_keywords
    if body.identity_card is not None:
        case.identity_card = json.dumps(body.identity_card)
    if body.status is not None:
        if body.status not in ("active", "archived"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "status must be active|archived")
        case.status = body.status
    await db.commit()
    total, alerts = await _count_articles(db, case.search_keywords, case.name)
    return _case_to_dict(case, total, alerts)


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(Case, case_id)
    if not case or case.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    await db.delete(case)
    await db.commit()


# ── Case Articles ────────────────────────────────────────────
@router.get("/{case_id}/articles")
async def get_case_articles(
    case_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    threat: str = "",
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(Case, case_id)
    if not case or case.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    kw = f"%{case.name}%"
    q = select(Article).where(
        (Article.title.ilike(kw))
        | (Article.entities_json.ilike(kw))
    )
    if threat:
        q = q.where(Article.threat_level == threat)
    q = q.order_by(Article.pub_date.desc()).limit(min(limit, 200)).offset(offset)

    total_q = select(func.count()).select_from(Article).where(
        (Article.title.ilike(kw)) | (Article.entities_json.ilike(kw))
    )
    if threat:
        total_q = total_q.where(Article.threat_level == threat)

    total = (await db.execute(total_q)).scalar() or 0
    result = await db.execute(q)
    articles = result.scalars().all()

    return {
        "articles": [_article_to_dict(a) for a in articles],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{case_id}/stats")
async def get_case_stats(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(Case, case_id)
    if not case or case.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    kw = f"%{case.name}%"
    base = (Article.title.ilike(kw)) | (Article.entities_json.ilike(kw))

    total = (await db.execute(select(func.count()).select_from(Article).where(base))).scalar() or 0

    threat_q = await db.execute(
        select(Article.threat_level, func.count())
        .where(base)
        .group_by(Article.threat_level)
    )
    by_threat = {r[0] or "unknown": r[1] for r in threat_q.all()}

    theme_q = await db.execute(
        select(Article.theme, func.count())
        .where(base)
        .group_by(Article.theme)
        .order_by(func.count().desc())
    )
    by_theme = {r[0] or "general": r[1] for r in theme_q.all()}

    return {"total": total, "by_threat": by_threat, "by_theme": by_theme}


@router.post("/{case_id}/ingest")
async def force_ingest(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(Case, case_id)
    if not case or case.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    result = await _ingest_for_case(case.name)
    return result


# ── Case Board ───────────────────────────────────────────────
@router.get("/{case_id}/board")
async def get_board(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(Case, case_id, options=[selectinload(Case.board)])
    if not case or case.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    layout = []
    if case.board and case.board.layout:
        try:
            layout = json.loads(case.board.layout)
        except Exception:
            pass
    return {"case_id": str(case_id), "layout": layout}


@router.put("/{case_id}/board")
async def update_board(
    case_id: uuid.UUID,
    body: BoardUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(Case, case_id, options=[selectinload(Case.board)])
    if not case or case.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    if case.board:
        case.board.layout = json.dumps(body.layout)
    else:
        board = CaseBoard(case_id=case.id, layout=json.dumps(body.layout))
        db.add(board)
    await db.commit()
    return {"case_id": str(case_id), "layout": body.layout}


# ── Ingestion helper ─────────────────────────────────────────
async def _ingest_for_case(name: str) -> dict:
    """Trigger Google News + GDELT ingestion for a case name."""
    results = {"google_news": None, "gdelt": None}
    try:
        from app.domains.articles.router import _do_ingest_google_news, _do_ingest_gdelt
        results["google_news"] = await _do_ingest_google_news(query=name)
    except Exception as e:
        logger.warning(f"Google News ingest failed for case '{name}': {e}")
        results["google_news"] = {"error": str(e)}
    try:
        from app.domains.articles.router import _do_ingest_gdelt
        results["gdelt"] = await _do_ingest_gdelt(query=name)
    except Exception as e:
        logger.warning(f"GDELT ingest failed for case '{name}': {e}")
        results["gdelt"] = {"error": str(e)}
    return results


def _article_to_dict(a: Article) -> dict:
    entities = []
    if a.entities_json:
        try:
            entities = json.loads(a.entities_json)
        except Exception:
            pass
    country_codes = []
    if a.country_codes_json:
        try:
            country_codes = json.loads(a.country_codes_json)
        except Exception:
            pass
    return {
        "id": str(a.id),
        "source_id": a.source_id,
        "title": a.title,
        "title_translated": getattr(a, "title_translated", None),
        "description": a.description,
        "link": a.link,
        "pub_date": a.pub_date.isoformat() if a.pub_date else None,
        "lang": a.lang,
        "threat_level": a.threat_level,
        "theme": a.theme,
        "confidence": a.confidence,
        "entities": entities,
        "country_codes": country_codes,
    }
```

- [ ] **Step 2: Register router in main.py**

Add `"app.domains.cases.router"` to the `ROUTERS` list in `server-py/app/main.py`.

- [ ] **Step 3: Test endpoints manually**

```bash
cd server-py && python -m uvicorn app.main:app --port 8000 &
sleep 3

# Register + get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"analyst@osint.lab","password":"password123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Create case
curl -s -X POST http://localhost:8000/api/cases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"TotalEnergies","type":"company"}'

# List cases
curl -s http://localhost:8000/api/cases -H "Authorization: Bearer $TOKEN"
```

- [ ] **Step 4: Commit**

```bash
git add server-py/app/domains/cases/ server-py/app/main.py
git commit -m "feat(cases): add cases CRUD, articles, board, identity card endpoints"
```

---

## Task 4: Backend — Tests

**Files:**
- Create: `server-py/tests/test_cases.py`

- [ ] **Step 1: Write case tests**

```python
# server-py/tests/test_cases.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_case(authed_client: AsyncClient):
    resp = await authed_client.post("/api/cases", json={"name": "Test Corp", "type": "company"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Corp"
    assert data["type"] == "company"
    assert data["status"] == "active"
    assert data["identity_card"] is not None
    assert "id" in data


@pytest.mark.asyncio
async def test_list_cases(authed_client: AsyncClient):
    await authed_client.post("/api/cases", json={"name": "Case A", "type": "person"})
    await authed_client.post("/api/cases", json={"name": "Case B", "type": "country"})
    resp = await authed_client.get("/api/cases")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_get_case(authed_client: AsyncClient):
    create = await authed_client.post("/api/cases", json={"name": "Taiwan", "type": "country"})
    case_id = create.json()["id"]
    resp = await authed_client.get(f"/api/cases/{case_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Taiwan"


@pytest.mark.asyncio
async def test_update_case(authed_client: AsyncClient):
    create = await authed_client.post("/api/cases", json={"name": "Old Name", "type": "company"})
    case_id = create.json()["id"]
    resp = await authed_client.put(f"/api/cases/{case_id}", json={"name": "New Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_case(authed_client: AsyncClient):
    create = await authed_client.post("/api/cases", json={"name": "Temp", "type": "thematic"})
    case_id = create.json()["id"]
    resp = await authed_client.delete(f"/api/cases/{case_id}")
    assert resp.status_code == 204
    resp2 = await authed_client.get(f"/api/cases/{case_id}")
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_case_board(authed_client: AsyncClient):
    create = await authed_client.post("/api/cases", json={"name": "Board Test", "type": "company"})
    case_id = create.json()["id"]
    # Get default board
    resp = await authed_client.get(f"/api/cases/{case_id}/board")
    assert resp.status_code == 200
    assert len(resp.json()["layout"]) > 0
    # Update board
    new_layout = [{"id": "w1", "x": 0, "y": 0, "w": 12, "h": 4, "widget_type": "map"}]
    resp2 = await authed_client.put(f"/api/cases/{case_id}/board", json={"layout": new_layout})
    assert resp2.status_code == 200
    assert resp2.json()["layout"] == new_layout


@pytest.mark.asyncio
async def test_case_articles(authed_client: AsyncClient):
    create = await authed_client.post("/api/cases", json={"name": "Ukraine", "type": "country"})
    case_id = create.json()["id"]
    resp = await authed_client.get(f"/api/cases/{case_id}/articles")
    assert resp.status_code == 200
    assert "articles" in resp.json()
    assert "total" in resp.json()


@pytest.mark.asyncio
async def test_case_stats(authed_client: AsyncClient):
    create = await authed_client.post("/api/cases", json={"name": "conflict", "type": "thematic"})
    case_id = create.json()["id"]
    resp = await authed_client.get(f"/api/cases/{case_id}/stats")
    assert resp.status_code == 200
    assert "total" in resp.json()
    assert "by_threat" in resp.json()


@pytest.mark.asyncio
async def test_invalid_type(authed_client: AsyncClient):
    resp = await authed_client.post("/api/cases", json={"name": "Bad", "type": "invalid"})
    assert resp.status_code == 400
```

- [ ] **Step 2: Run tests**

Run: `cd server-py && python -m pytest tests/test_cases.py -v`

- [ ] **Step 3: Commit**

```bash
git add server-py/tests/test_cases.py
git commit -m "test(cases): add cases endpoint tests"
```

---

## Task 5: Frontend — Cases API Hook

**Files:**
- Create: `src/v2/hooks/useCases.ts`
- Modify: `src/v2/lib/api.ts`

- [ ] **Step 1: Add case API helpers to api.ts**

Append to `src/v2/lib/api.ts`:

```typescript
// ── Cases API ─────────────────────────────────────────────
export interface CaseData {
  id: string;
  name: string;
  type: string;
  search_keywords: string;
  identity_card: Record<string, any> | null;
  status: string;
  article_count: number;
  alert_count: number;
  created_at: string;
  updated_at: string;
}

export async function listCases(): Promise<CaseData[]> {
  return api('/cases');
}

export async function createCase(name: string, type: string): Promise<CaseData> {
  return api('/cases', { method: 'POST', body: JSON.stringify({ name, type }) });
}

export async function getCase(id: string): Promise<CaseData> {
  return api(`/cases/${id}`);
}

export async function updateCase(id: string, data: Partial<{ name: string; search_keywords: string; identity_card: any; status: string }>): Promise<CaseData> {
  return api(`/cases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteCase(id: string): Promise<void> {
  await api(`/cases/${id}`, { method: 'DELETE' });
}

export async function getCaseArticles(id: string, params?: { limit?: number; offset?: number; threat?: string }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.threat) qs.set('threat', params.threat);
  return api<{ articles: any[]; total: number }>(`/cases/${id}/articles?${qs}`);
}

export async function getCaseStats(id: string) {
  return api<{ total: number; by_threat: Record<string, number>; by_theme: Record<string, number> }>(`/cases/${id}/stats`);
}

export async function getCaseBoard(id: string) {
  return api<{ case_id: string; layout: any[] }>(`/cases/${id}/board`);
}

export async function updateCaseBoard(id: string, layout: any[]) {
  return api(`/cases/${id}/board`, { method: 'PUT', body: JSON.stringify({ layout }) });
}

export async function forceIngestCase(id: string) {
  return api(`/cases/${id}/ingest`, { method: 'POST' });
}
```

- [ ] **Step 2: Create useCases hook**

```typescript
// src/v2/hooks/useCases.ts
import { useState, useEffect, useCallback } from 'react';
import { listCases, createCase, deleteCase, type CaseData } from '@/v2/lib/api';

export function useCases() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCases();
      setCases(data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const add = useCallback(async (name: string, type: string) => {
    const c = await createCase(name, type);
    setCases(prev => [c, ...prev]);
    return c;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteCase(id);
    setCases(prev => prev.filter(c => c.id !== id));
  }, []);

  return { cases, loading, reload, add, remove };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/v2/hooks/useCases.ts src/v2/lib/api.ts
git commit -m "feat(frontend): add cases API hook and helpers"
```

---

## Task 6: Frontend — CreateCaseModal Component

**Files:**
- Create: `src/v2/components/CreateCaseModal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
// src/v2/components/CreateCaseModal.tsx
import { useState } from 'react';
import { X, Building, Flag, Users, Hash, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, type: string) => Promise<void>;
}

const TYPES = [
  { key: 'company',  label: 'Entreprise', icon: Building, desc: 'Société, organisation' },
  { key: 'person',   label: 'Personne',   icon: Users,    desc: 'Individu, dirigeant' },
  { key: 'country',  label: 'Pays / Zone', icon: Flag,    desc: 'État, région géopolitique' },
  { key: 'thematic', label: 'Thématique', icon: Hash,     desc: 'Sujet, tendance, crise' },
];

export default function CreateCaseModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('company');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onCreate(name.trim(), type);
      setName('');
      setType('company');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Créer un Case</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom de l'entité</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="ex: TotalEnergies, Taïwan, Elon Musk..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#42d3a5] focus:ring-2 focus:ring-[#42d3a5]/10"
              autoFocus required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => setType(t.key)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    type === t.key
                      ? 'border-[#42d3a5] bg-[#42d3a5]/5 text-[#2a9d7e]'
                      : 'border-slate-100 hover:border-slate-200 text-slate-600'
                  }`}>
                  <t.icon size={16} />
                  <div>
                    <div className="text-xs font-semibold">{t.label}</div>
                    <div className="text-[10px] text-slate-400">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
          <button type="submit" disabled={loading || !name.trim()}
            className="w-full py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            style={{ background: '#42d3a5' }}>
            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Créer le case'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/v2/components/CreateCaseModal.tsx
git commit -m "feat(frontend): add CreateCaseModal component"
```

---

## Task 7: Frontend — CasesView Component

**Files:**
- Create: `src/v2/components/CasesView.tsx`

- [ ] **Step 1: Create cases list view**

```tsx
// src/v2/components/CasesView.tsx
import { useState } from 'react';
import {
  Plus, Building, Flag, Users, Hash, AlertTriangle, ChevronRight,
  Trash2, RefreshCw, Search
} from 'lucide-react';
import type { CaseData } from '@/v2/lib/api';
import CreateCaseModal from './CreateCaseModal';

interface Props {
  cases: CaseData[];
  loading: boolean;
  onAdd: (name: string, type: string) => Promise<CaseData>;
  onDelete: (id: string) => Promise<void>;
  onSelect: (c: CaseData) => void;
  onOpenBoard: (c: CaseData) => void;
}

const TYPE_ICONS: Record<string, typeof Building> = {
  company: Building, person: Users, country: Flag, thematic: Hash,
};

export default function CasesView({ cases, loading, onAdd, onDelete, onSelect, onOpenBoard }: Props) {
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = cases
    .filter(c => filter === 'all' || c.type === filter)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-white rounded-lg border border-slate-200/60 p-0.5">
            {[
              { k: 'all', l: 'Tous' },
              { k: 'company', l: 'Entreprises' },
              { k: 'country', l: 'Pays' },
              { k: 'person', l: 'Personnes' },
              { k: 'thematic', l: 'Thématiques' },
            ].map(t => (
              <button key={t.k} onClick={() => setFilter(t.k)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                  filter === t.k ? 'bg-[#42d3a5]/10 text-[#2a9d7e] font-semibold' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {t.l}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer..." className="pl-8 pr-3 py-1.5 bg-white border border-slate-200/60 rounded-lg text-xs outline-none w-44 focus:border-[#42d3a5]" />
          </div>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-white text-[12px] font-semibold rounded-xl shadow-sm"
          style={{ background: '#42d3a5' }}>
          <Plus size={15} /> Créer un case
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/60 p-12 text-center">
          <Hash size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 mb-4">
            {cases.length === 0 ? 'Aucun case créé' : 'Aucun résultat pour ce filtre'}
          </p>
          {cases.length === 0 && (
            <button onClick={() => setModal(true)} className="text-sm font-semibold text-[#42d3a5]">
              Créer votre premier case
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map(c => {
            const Icon = TYPE_ICONS[c.type] || Hash;
            return (
              <div key={c.id}
                onClick={() => onSelect(c)}
                onDoubleClick={() => onOpenBoard(c)}
                className="bg-white p-4 rounded-xl border border-slate-200/60 hover:border-[#42d3a5]/30 hover:shadow-sm cursor-pointer transition-all group relative">
                {/* Delete button */}
                <button onClick={e => { e.stopPropagation(); onDelete(c.id); }}
                  className="absolute top-3 right-3 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={13} />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    c.alert_count > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate group-hover:text-[#2a9d7e] transition-colors">{c.name}</div>
                    <div className="text-[10px] text-slate-400">{c.article_count} articles · {c.type}</div>
                  </div>
                </div>
                {c.identity_card?.description && (
                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">{c.identity_card.description}</p>
                )}
                <div className="flex items-center justify-between">
                  {c.alert_count > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                      <AlertTriangle size={9} /> {c.alert_count} alertes
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400">Aucune alerte</span>
                  )}
                  <span className="text-[9px] text-slate-400 group-hover:text-[#42d3a5] flex items-center gap-0.5">
                    Double-clic → Board <ChevronRight size={10} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateCaseModal open={modal} onClose={() => setModal(false)} onCreate={onAdd} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/v2/components/CasesView.tsx
git commit -m "feat(frontend): add CasesView list component"
```

---

## Task 8: Frontend — WorldView (360 Mondial)

**Files:**
- Create: `src/v2/components/WorldView.tsx`

- [ ] **Step 1: Create 360 mondial view**

This reuses the same data-fetching pattern as Dashboard but shows ALL global data unfiltered.

```tsx
// src/v2/components/WorldView.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  Globe, TrendingUp, BarChart2, RefreshCw, Newspaper, AlertTriangle, Zap
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { api } from '@/v2/lib/api';
import type { Article, Stats } from '@/v2/lib/constants';
import { capitalize, timeAgo } from '@/v2/lib/constants';
import LiveMap from './LiveMap';

const COLORS = ['#42d3a5', '#3b82f6', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

export default function WorldView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        api<Stats>('/articles/v1/stats'),
        api<{ articles: Article[] }>('/articles/v1/search?limit=150'),
      ]);
      setStats(s); setArticles(a.articles);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const thematicData = Object.entries(stats?.by_theme || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([n, v]) => ({ name: capitalize(n), value: v }));

  const alertArticles = articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high');

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Documents', value: stats?.total || 0, color: '#3b82f6' },
          { label: 'Critiques', value: stats?.by_threat['critical'] || 0, color: '#ef4444' },
          { label: 'Élevées', value: stats?.by_threat['high'] || 0, color: '#f97316' },
          { label: 'Thématiques', value: Object.keys(stats?.by_theme || {}).length, color: '#8b5cf6' },
          { label: 'Sources', value: Object.keys(stats?.by_source || {}).length, color: '#06b6d4' },
        ].map((k, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-slate-200/60 text-center">
            <div className="text-2xl font-extrabold text-slate-900">{k.value.toLocaleString()}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Map + Alerts */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9 bg-white rounded-xl border border-slate-200/60 overflow-hidden flex flex-col" style={{ height: 420 }}>
          <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <h2 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
              <Globe size={14} className="text-[#42d3a5]" /> Carte mondiale — Tous les articles
            </h2>
            <button onClick={load} className="text-slate-400 hover:text-[#42d3a5] p-1">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex-1 min-h-0 p-1">
            {articles.length > 0 ? <LiveMap articles={articles} /> : (
              <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center text-slate-500 text-xs">Chargement...</div>
            )}
          </div>
        </div>

        <div className="col-span-3 flex flex-col gap-3">
          <div className="bg-red-50/50 rounded-xl border border-red-100/50 p-3 flex-1 overflow-hidden flex flex-col">
            <h2 className="text-[12px] font-bold text-red-800 flex items-center gap-1.5 mb-2 shrink-0">
              <Zap size={13} className="text-red-500" /> Alertes mondiales
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {alertArticles.slice(0, 6).map((a, i) => (
                <a key={i} href={a.link} target="_blank" rel="noopener noreferrer"
                  className="block bg-white/80 p-2 rounded-lg border border-red-100/40 hover:border-red-200 transition-colors">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${
                      a.threat_level === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                    }`}>{a.threat_level}</span>
                    <span className="text-[9px] text-slate-400 ml-auto">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
                  </div>
                  <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{a.title}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 h-56">
        <div className="bg-white rounded-xl border border-slate-200/60 p-4 flex flex-col">
          <h2 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5 mb-2 shrink-0">
            <BarChart2 size={14} className="text-[#42d3a5]" /> Répartition thématique
          </h2>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={thematicData} layout="vertical" margin={{ top: 0, right: 15, left: 5, bottom: 0 }} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }} width={65} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {thematicData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/60 p-3 flex flex-col">
          <h2 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5 mb-2 shrink-0">
            <Newspaper size={14} className="text-[#42d3a5]" /> Derniers articles
          </h2>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {articles.slice(0, 10).map((a, i) => (
              <a key={i} href={a.link} target="_blank" rel="noopener noreferrer"
                className="block px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                <p className="text-[11px] text-slate-700 font-medium line-clamp-1">{a.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-[#42d3a5] font-semibold uppercase">{a.theme}</span>
                  <span className="text-[9px] text-slate-400">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/v2/components/WorldView.tsx
git commit -m "feat(frontend): add WorldView 360 global component"
```

---

## Task 9: Frontend — Dashboard Rewrite (Case Synthesis)

**Files:**
- Modify: `src/v2/components/Dashboard.tsx`

- [ ] **Step 1: Rewrite Dashboard to integrate all views**

Rewrite `Dashboard.tsx` to:
- Import and use `useCases` hook
- Sidebar nav: Dashboard, Cases, 360 Mondial, Rapports, Configuration
- Dashboard tab: shows synthesis across ALL cases (aggregated KPIs, map with case countries, alerts from cases)
- Cases tab: renders `CasesView`
- 360 Mondial: renders `WorldView`
- Case board: full-screen overlay when user double-clicks a case
- Pass `selectedCase` state through to filter dashboard content

Key changes:
- Add `const { cases, loading: casesLoading, reload: reloadCases, add: addCase, remove: removeCase } = useCases();`
- Add `const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);`
- Add `const [boardCase, setBoardCase] = useState<CaseData | null>(null);`
- Change nav from `'entities'` to `'cases'`, from `'alerts'` to `'360'`
- Dashboard view filters articles/map/alerts by cases keywords when cases exist
- When `boardCase` is set, render full-screen `CaseBoard` overlay (placeholder div for now — Task 10)

This is the largest single file change. The complete implementation should follow the existing patterns in Dashboard.tsx but restructure the nav and add case-aware filtering.

- [ ] **Step 2: Verify app loads**

Open `http://localhost:5173/v2.html`, login, verify all tabs work.

- [ ] **Step 3: Commit**

```bash
git add src/v2/components/Dashboard.tsx
git commit -m "feat(frontend): rewrite dashboard with cases integration"
```

---

## Task 10: Frontend — CaseBoard (Gridstack)

**Files:**
- Create: `src/v2/components/CaseBoard.tsx`
- Create: `src/v2/components/IdentityCard.tsx`

- [ ] **Step 1: Install gridstack**

```bash
npm install gridstack
```

- [ ] **Step 2: Create IdentityCard widget**

```tsx
// src/v2/components/IdentityCard.tsx
import { useState } from 'react';
import { Building, Globe, Users, ExternalLink, Edit3, Check } from 'lucide-react';

interface Props {
  card: Record<string, any> | null;
  name: string;
  type: string;
  onSave?: (card: Record<string, any>) => void;
}

export default function IdentityCard({ card, name, type, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card || {});

  if (!card) return <div className="p-4 text-sm text-slate-400 text-center">Fiche en cours de génération...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-900 text-base">{name}</h3>
        {onSave && (
          <button onClick={() => { if (editing) { onSave(draft); } setEditing(!editing); }}
            className="p-1 text-slate-400 hover:text-[#42d3a5]">
            {editing ? <Check size={14} /> : <Edit3 size={14} />}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-600 mb-3">{card.description}</p>
      <div className="space-y-2 text-xs">
        {card.headquarters && (
          <div className="flex justify-between"><span className="text-slate-400">Siège</span><span className="font-medium">{card.headquarters}</span></div>
        )}
        {card.sector && (
          <div className="flex justify-between"><span className="text-slate-400">Secteur</span><span className="font-medium">{card.sector}</span></div>
        )}
        {card.country_code && (
          <div className="flex justify-between"><span className="text-slate-400">Pays</span><span className="font-medium">{card.country_code}</span></div>
        )}
        {card.founded && (
          <div className="flex justify-between"><span className="text-slate-400">Fondé</span><span className="font-medium">{card.founded}</span></div>
        )}
        {card.website && (
          <a href={card.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#42d3a5] hover:underline">
            <ExternalLink size={11} /> {card.website}
          </a>
        )}
        {card.key_people?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Personnes clés</div>
            {card.key_people.map((p: any, i: number) => (
              <div key={i} className="flex justify-between py-0.5">
                <span className="font-medium">{p.name}</span>
                <span className="text-slate-400">{p.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create CaseBoard with widgets**

```tsx
// src/v2/components/CaseBoard.tsx — Full-screen case investigation board
```

This component:
- Takes a `CaseData` prop + `onClose` callback
- Fetches case articles and stats via `getCaseArticles`, `getCaseStats`, `getCaseBoard`
- Renders a fixed layout (not Gridstack for MVP — simplify to avoid complexity) with:
  - Identity card (top-left)
  - Map centered on case country (top-right)
  - Alerts (middle-left)
  - Articles list (middle-right)
  - Sentiment chart (bottom-left)
  - Themes chart (bottom-right)
- Back button to close

Note: Gridstack integration can be added later as an enhancement. For MVP, a fixed CSS Grid layout that looks like a board is sufficient and much simpler to implement reliably.

- [ ] **Step 4: Commit**

```bash
git add src/v2/components/CaseBoard.tsx src/v2/components/IdentityCard.tsx
git commit -m "feat(frontend): add CaseBoard and IdentityCard components"
```

---

## Task 11: Integration & Final Wiring

- [ ] **Step 1: Update Dashboard.tsx to render CaseBoard overlay**

When `boardCase` state is set (from double-click in CasesView), render:
```tsx
{boardCase && <CaseBoard case={boardCase} onClose={() => setBoardCase(null)} />}
```

- [ ] **Step 2: Test full flow**

1. Open `http://localhost:5173/v2.html`
2. Login with `analyst@osint.lab` / `password123`
3. Navigate to "Cases" tab
4. Click "Créer un case" → enter "TotalEnergies", type "Entreprise"
5. Verify case appears with identity card
6. Double-click → verify board opens with widgets
7. Press back → verify returns to cases list
8. Navigate to "360 Mondial" → verify global map and stats
9. Navigate to "Tableau de bord" → verify synthesis view

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: complete cases intelligence platform integration"
```
