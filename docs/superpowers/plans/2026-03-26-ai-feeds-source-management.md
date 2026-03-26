# AI Feeds — Source Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an "AI Feeds" tab where users construct thematic feed queries via a visual query builder, with AI-powered source suggestion and article filtering. Each saved feed becomes a widget available on dashboards and Cases.

**Architecture:** New FastAPI domain (`app/domains/ai_feeds/`) with 3 SQLAlchemy models (ai_feeds, ai_feed_sources, ai_feed_results). New React tab in v2 Dashboard. ~270 RSS sources seeded into source catalog. Existing system untouched.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic, React 19, Tailwind CSS, Gemini Flash (LLM), Redis (cache)

---

## File Structure

### Backend (server-py/)

| File | Responsibility |
|------|---------------|
| `app/models/ai_feed.py` | SQLAlchemy models: AIFeed, AIFeedSource, AIFeedResult |
| `app/models/__init__.py` | Register new models (modify) |
| `app/domains/ai_feeds/__init__.py` | Package init |
| `app/domains/ai_feeds/router.py` | FastAPI CRUD + AI endpoints |
| `app/domains/ai_feeds/schemas.py` | Pydantic request/response schemas |
| `app/domains/ai_feeds/service.py` | Business logic: query matching, source suggestion, RSS fetch |
| `app/domains/ai_feeds/seed.py` | Seed ~270 RSS sources into source_catalog |
| `app/domains/ai_feeds/rss_discovery.py` | Auto-discover RSS from website URL |
| `app/main.py` | Register router + background worker (modify) |
| `alembic/versions/xxxx_add_ai_feeds.py` | Migration: 3 new tables |

### Frontend (src/v2/)

| File | Responsibility |
|------|---------------|
| `src/v2/lib/ai-feeds-api.ts` | API client functions for AI Feeds |
| `src/v2/hooks/useAIFeeds.ts` | React hook for AI Feeds CRUD |
| `src/v2/components/AIFeedsView.tsx` | Main AI Feeds tab layout (list + builder + sources) |
| `src/v2/components/ai-feeds/QueryBuilder.tsx` | Visual query builder (layers, AND/OR/NOT, topics, entities) |
| `src/v2/components/ai-feeds/SourceSelector.tsx` | Source selection panel with AI suggestions |
| `src/v2/components/ai-feeds/FeedPreview.tsx` | Article preview at bottom of builder |
| `src/v2/components/ai-feeds/FeedList.tsx` | Left panel: list of user's AI Feeds |
| `src/v2/components/Dashboard.tsx` | Add 'ai-feeds' NavKey + tab rendering (modify) |
| `src/v2/components/shared/WidgetCatalog.tsx` | Add AI Feed widget type (modify) |

---

## Task 1: Backend Models

**Files:**
- Create: `server-py/app/models/ai_feed.py`
- Modify: `server-py/app/models/__init__.py`

- [ ] **Step 1: Create the AI Feed models file**

```python
# server-py/app/models/ai_feed.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class AIFeed(Base):
    __tablename__ = "ai_feeds"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    query: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    ai_config: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="active")
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    sources: Mapped[list["AIFeedSource"]] = relationship(
        back_populates="feed", cascade="all, delete-orphan"
    )
    results: Mapped[list["AIFeedResult"]] = relationship(
        back_populates="feed", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_ai_feeds_org_id", "org_id"),
        Index("ix_ai_feeds_org_status", "org_id", "status"),
    )


class AIFeedSource(Base):
    __tablename__ = "ai_feed_sources"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ai_feed_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai_feeds.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    lang: Mapped[str | None] = mapped_column(String(5), nullable=True)
    tier: Mapped[int] = mapped_column(Integer, default=3)
    source_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    continent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    origin: Mapped[str] = mapped_column(String(20), nullable=False, default="catalog")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    feed: Mapped["AIFeed"] = relationship(back_populates="sources")

    __table_args__ = (
        Index("ix_ai_feed_sources_feed_id", "ai_feed_id"),
    )


class AIFeedResult(Base):
    __tablename__ = "ai_feed_results"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ai_feed_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai_feeds.id", ondelete="CASCADE"), nullable=False
    )
    article_url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source_name: Mapped[str] = mapped_column(String(200), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    entities: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    threat_level: Mapped[str | None] = mapped_column(String(10), nullable=True)
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    feed: Mapped["AIFeed"] = relationship(back_populates="results")

    __table_args__ = (
        Index("ix_ai_feed_results_feed_id", "ai_feed_id"),
        Index("ix_ai_feed_results_published", "ai_feed_id", "published_at"),
    )
```

- [ ] **Step 2: Register models in __init__.py**

Add to `server-py/app/models/__init__.py`:

```python
from app.models.ai_feed import AIFeed, AIFeedSource, AIFeedResult

__all__ = [
    "Article",
    "Case",
    "CaseBoard",
    "Dashboard",
    "DashboardPanel",
    "Org",
    "OrgSecret",
    "SourceTemplate",
    "User",
    "AIFeed",
    "AIFeedSource",
    "AIFeedResult",
]
```

- [ ] **Step 3: Verify models load without errors**

Run: `cd /c/dev/worldmonitor/server-py && python -c "from app.models import AIFeed, AIFeedSource, AIFeedResult; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
rtk git add server-py/app/models/ai_feed.py server-py/app/models/__init__.py
rtk git commit -m "feat(ai-feeds): add SQLAlchemy models for AIFeed, AIFeedSource, AIFeedResult"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `server-py/alembic/versions/xxxx_add_ai_feeds.py` (auto-generated)

- [ ] **Step 1: Generate migration**

Run: `cd /c/dev/worldmonitor/server-py && python -m alembic revision --autogenerate -m "add_ai_feeds_tables"`
Expected: New file in `alembic/versions/` with `create_table` for `ai_feeds`, `ai_feed_sources`, `ai_feed_results`

- [ ] **Step 2: Review generated migration**

Read the generated file. Verify it contains:
- `op.create_table("ai_feeds", ...)` with all columns from the model
- `op.create_table("ai_feed_sources", ...)` with FK to ai_feeds
- `op.create_table("ai_feed_results", ...)` with FK to ai_feeds
- All indexes
- `downgrade()` drops all 3 tables

If the auto-generated migration has issues (e.g., missing JSONB for SQLite compat), fix manually. Since dev uses SQLite, use `sa.Text()` for JSON fields (not `postgresql.JSONB`).

- [ ] **Step 3: Run migration (dev/SQLite)**

Run: `cd /c/dev/worldmonitor/server-py && python -m alembic upgrade head`
Expected: `INFO  [alembic.runtime.migration] Running upgrade ... -> ..., add_ai_feeds_tables`

Note: If using SQLite in dev (via `create_all_tables()`), this step may not apply. The tables will auto-create on app startup. Test by starting the server:

Run: `cd /c/dev/worldmonitor/server-py && timeout 5 python -m uvicorn app.main:app --port 8000 2>&1 || true`
Expected: Server starts without model errors.

- [ ] **Step 4: Commit**

```bash
rtk git add server-py/alembic/versions/
rtk git commit -m "feat(ai-feeds): add Alembic migration for ai_feeds tables"
```

---

## Task 3: Pydantic Schemas

**Files:**
- Create: `server-py/app/domains/ai_feeds/__init__.py`
- Create: `server-py/app/domains/ai_feeds/schemas.py`

- [ ] **Step 1: Create package init**

```python
# server-py/app/domains/ai_feeds/__init__.py
```

(Empty file)

- [ ] **Step 2: Create schemas**

```python
# server-py/app/domains/ai_feeds/schemas.py
from pydantic import BaseModel, Field


# ── Query structure ──────────────────────────────────────────
class QueryPart(BaseModel):
    type: str = Field(..., description="topic | entity | keyword")
    value: str
    aliases: list[str] = []
    scope: str = "title_and_content"  # title_and_content | title


class QueryLayer(BaseModel):
    operator: str = "AND"  # AND | OR | NOT
    parts: list[QueryPart] = []


class FeedQuery(BaseModel):
    layers: list[QueryLayer] = []


class AIConfig(BaseModel):
    relevance_threshold: int = 60  # 0-100
    enrichment_enabled: bool = True
    summary_enabled: bool = True


# ── Feed CRUD ────────────────────────────────────────────────
class AIFeedCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str = Field("", max_length=1000)
    query: FeedQuery = FeedQuery()
    ai_config: AIConfig = AIConfig()


class AIFeedUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    query: FeedQuery | None = None
    ai_config: AIConfig | None = None
    status: str | None = None


# ── Source management ────────────────────────────────────────
class SourceAdd(BaseModel):
    url: str
    name: str = Field(..., max_length=200)
    lang: str | None = None
    tier: int = 3
    source_type: str | None = None
    country: str | None = None
    continent: str | None = None
    origin: str = "catalog"  # catalog | custom | ai_suggested


class SourceToggle(BaseModel):
    enabled: bool


# ── Source catalog ───────────────────────────────────────────
class CatalogEntry(BaseModel):
    name: str
    url: str
    lang: str | None = None
    tier: int = 3
    source_type: str | None = None
    country: str | None = None
    continent: str | None = None
    thematic: str | None = None


class ValidateUrlRequest(BaseModel):
    url: str


class ValidateUrlResponse(BaseModel):
    valid: bool
    feeds_found: list[dict] = []  # [{url, title}]
    error: str | None = None


# ── AI endpoints ─────────────────────────────────────────────
class SuggestSourcesRequest(BaseModel):
    query: FeedQuery
    limit: int = 20


class ParseQueryRequest(BaseModel):
    text: str


# ── Response serialization ───────────────────────────────────
class AIFeedResponse(BaseModel):
    id: str
    name: str
    description: str | None
    query: dict | None
    ai_config: dict | None
    status: str
    is_template: bool
    source_count: int
    result_count: int
    created_at: str
    updated_at: str


class AIFeedSourceResponse(BaseModel):
    id: str
    url: str
    name: str
    lang: str | None
    tier: int
    source_type: str | None
    country: str | None
    continent: str | None
    origin: str
    enabled: bool


class AIFeedResultResponse(BaseModel):
    id: str
    article_url: str
    title: str
    source_name: str
    published_at: str | None
    relevance_score: float
    entities: list | None
    summary: str | None
    threat_level: str | None
    category: str | None
    fetched_at: str
```

- [ ] **Step 3: Verify schemas parse correctly**

Run: `cd /c/dev/worldmonitor/server-py && python -c "from app.domains.ai_feeds.schemas import AIFeedCreate, FeedQuery, QueryLayer, QueryPart; f = AIFeedCreate(name='Test', query=FeedQuery(layers=[QueryLayer(operator='AND', parts=[QueryPart(type='topic', value='M&A')])])); print(f.model_dump_json(indent=2))"`

Expected: JSON output with nested query structure.

- [ ] **Step 4: Commit**

```bash
rtk git add server-py/app/domains/ai_feeds/
rtk git commit -m "feat(ai-feeds): add Pydantic schemas for AI Feed API"
```

---

## Task 4: Source Catalog Seed

**Files:**
- Create: `server-py/app/domains/ai_feeds/seed.py`

- [ ] **Step 1: Create the seed data file**

This file contains ALL ~270 sources (the ~150 existing from feeds.ts + the 120 country sources). It provides a `get_catalog()` function returning a list of dicts.

```python
# server-py/app/domains/ai_feeds/seed.py
"""
Source catalog seed data — ~270 RSS sources.
Used by the AI Feeds system for source suggestion and selection.
"""


def get_catalog() -> list[dict]:
    """Return the full source catalog as a list of dicts.

    Each dict has: name, url, lang, tier, source_type, country, continent, thematic.
    """
    return _BUILTIN_GLOBAL + _BUILTIN_COUNTRY


# ── Existing WorldMonitor sources (from feeds.ts) ───────────────────
# Tier 1 = wire/agency, Tier 2 = major outlet, Tier 3 = specialty, Tier 4 = aggregator/blog
_BUILTIN_GLOBAL: list[dict] = [
    # Wire Services (Tier 1)
    {"name": "Reuters", "url": "https://www.reutersagency.com/feed/", "lang": "en", "tier": 1, "source_type": "wire", "country": "UK", "continent": "Europe", "thematic": "Actualites"},
    {"name": "AP News", "url": "https://rsshub.app/apnews/topics/apf-topnews", "lang": "en", "tier": 1, "source_type": "wire", "country": "US", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "AFP", "url": "https://www.france24.com/en/rss", "lang": "en", "tier": 1, "source_type": "wire", "country": "France", "continent": "Europe", "thematic": "Actualites"},
    # Major outlets (Tier 2)
    {"name": "BBC World", "url": "https://feeds.bbci.co.uk/news/world/rss.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "UK", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Guardian World", "url": "https://www.theguardian.com/world/rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "UK", "continent": "Europe", "thematic": "Actualites"},
    {"name": "CNN World", "url": "https://rss.cnn.com/rss/edition_world.rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "New York Times", "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "Le Monde", "url": "https://www.lemonde.fr/rss/une.xml", "lang": "fr", "tier": 2, "source_type": "mainstream", "country": "France", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Deutsche Welle (EN)", "url": "https://rss.dw.com/rdf/rss-en-all", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Allemagne", "continent": "Europe", "thematic": "Actualites"},
    {"name": "France 24 (EN)", "url": "https://www.france24.com/en/rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "France", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Al Jazeera (EN)", "url": "https://www.aljazeera.com/xml/rss/all.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Qatar", "continent": "Moyen-Orient", "thematic": "Actualites"},
    # US (Tier 2-3)
    {"name": "NPR", "url": "https://feeds.npr.org/1001/rss.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "PBS", "url": "https://www.pbs.org/newshour/feeds/rss/headlines", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "WSJ", "url": "https://feeds.a.dj.com/rss/RSSWorldNews.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "thematic": "Finance"},
    {"name": "Politico", "url": "https://rss.politico.com/politics-news.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "thematic": "Actualites"},
    # Tech (Tier 2-3)
    {"name": "TechCrunch", "url": "https://techcrunch.com/feed/", "lang": "en", "tier": 2, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "thematic": "Tech"},
    {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml", "lang": "en", "tier": 2, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "thematic": "Tech"},
    {"name": "Ars Technica", "url": "https://feeds.arstechnica.com/arstechnica/index", "lang": "en", "tier": 2, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "thematic": "Tech"},
    {"name": "Hacker News", "url": "https://hnrss.org/frontpage", "lang": "en", "tier": 4, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "thematic": "Tech"},
    {"name": "VentureBeat AI", "url": "https://venturebeat.com/category/ai/feed/", "lang": "en", "tier": 3, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "thematic": "AI"},
    {"name": "MIT Tech Review", "url": "https://www.technologyreview.com/feed/", "lang": "en", "tier": 2, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "thematic": "Tech"},
    # Finance (Tier 2-3)
    {"name": "CNBC", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", "lang": "en", "tier": 2, "source_type": "market", "country": "US", "continent": "Amerique du Nord", "thematic": "Finance"},
    {"name": "MarketWatch", "url": "https://feeds.marketwatch.com/marketwatch/topstories/", "lang": "en", "tier": 2, "source_type": "market", "country": "US", "continent": "Amerique du Nord", "thematic": "Finance"},
    {"name": "Financial Times", "url": "https://www.ft.com/rss/home/uk", "lang": "en", "tier": 1, "source_type": "market", "country": "UK", "continent": "Europe", "thematic": "Finance"},
    # Government (Tier 2)
    {"name": "White House", "url": "https://www.whitehouse.gov/feed/", "lang": "en", "tier": 2, "source_type": "gov", "country": "US", "continent": "Amerique du Nord", "thematic": "Gouvernement"},
    {"name": "UN News", "url": "https://news.un.org/feed/subscribe/en/news/all/rss.xml", "lang": "en", "tier": 2, "source_type": "gov", "country": "International", "continent": "International", "thematic": "Gouvernement"},
    # Defense/Intel (Tier 3)
    {"name": "Defense One", "url": "https://www.defenseone.com/rss/", "lang": "en", "tier": 3, "source_type": "intel", "country": "US", "continent": "Amerique du Nord", "thematic": "Defense"},
    {"name": "Jane's Defence", "url": "https://www.janes.com/feeds/news", "lang": "en", "tier": 2, "source_type": "intel", "country": "UK", "continent": "Europe", "thematic": "Defense"},
    {"name": "War on the Rocks", "url": "https://warontherocks.com/feed/", "lang": "en", "tier": 3, "source_type": "intel", "country": "US", "continent": "Amerique du Nord", "thematic": "Defense"},
    {"name": "CSIS", "url": "https://www.csis.org/analysis/feed", "lang": "en", "tier": 3, "source_type": "intel", "country": "US", "continent": "Amerique du Nord", "thematic": "Thinktank"},
    {"name": "Brookings", "url": "https://www.brookings.edu/feed/", "lang": "en", "tier": 3, "source_type": "intel", "country": "US", "continent": "Amerique du Nord", "thematic": "Thinktank"},
    # Cyber (Tier 3)
    {"name": "CISA Alerts", "url": "https://www.cisa.gov/cybersecurity-advisories/all.xml", "lang": "en", "tier": 2, "source_type": "gov", "country": "US", "continent": "Amerique du Nord", "thematic": "Cyber"},
    {"name": "Krebs on Security", "url": "https://krebsonsecurity.com/feed/", "lang": "en", "tier": 3, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "thematic": "Cyber"},
    # Energy (Tier 3)
    {"name": "OilPrice", "url": "https://oilprice.com/rss/main", "lang": "en", "tier": 3, "source_type": "market", "country": "US", "continent": "Amerique du Nord", "thematic": "Energie"},
]


# ── Country-specific sources (120 countries) ────────────────────────
_BUILTIN_COUNTRY: list[dict] = [
    {"name": "TOLOnews", "url": "https://tolonews.com/rss.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Afghanistan", "continent": "Asie", "thematic": "Actualites"},
    {"name": "News24", "url": "http://feeds.news24.com/articles/news24/TopStories/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Afrique du Sud", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Albanian Daily News", "url": "https://albaniandailynews.com/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Albanie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "TSA Algerie", "url": "https://www.tsa-algerie.com/feed/", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Algerie", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Arab News", "url": "https://www.arabnews.com/rss.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Arabie Saoudite", "continent": "Moyen-Orient", "thematic": "Actualites"},
    {"name": "Clarin", "url": "https://www.clarin.com/rss/lo-ultimo/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Argentine", "continent": "Amerique du Sud", "thematic": "Actualites"},
    {"name": "Armenpress", "url": "https://armenpress.am/eng/rss/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Armenie", "continent": "Asie", "thematic": "Actualites"},
    {"name": "ABC News Australia", "url": "https://www.abc.net.au/news/feed/45910/rss.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Australie", "continent": "Oceanie", "thematic": "Actualites"},
    {"name": "Der Standard", "url": "https://www.derstandard.at/rss", "lang": "de", "tier": 3, "source_type": "mainstream", "country": "Autriche", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Trend News Agency", "url": "https://en.trend.az/feeds/index.rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Azerbaidjan", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Bahrain News Agency", "url": "https://www.bna.bh/en/rss/", "lang": "en", "tier": 3, "source_type": "gov", "country": "Bahrein", "continent": "Moyen-Orient", "thematic": "Actualites"},
    {"name": "The Daily Star BD", "url": "https://www.thedailystar.net/frontpage/rss.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Bangladesh", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Le Soir", "url": "https://www.lesoir.be/rss", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Belgique", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Belta", "url": "https://eng.belta.by/rss", "lang": "en", "tier": 3, "source_type": "gov", "country": "Bielorussie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "El Deber", "url": "https://eldeber.com.bo/rss/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Bolivie", "continent": "Amerique du Sud", "thematic": "Actualites"},
    {"name": "Sarajevo Times", "url": "https://sarajevotimes.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Bosnie-Herzegovine", "continent": "Europe", "thematic": "Actualites"},
    {"name": "G1 Globo", "url": "https://g1.globo.com/rss/g1/", "lang": "pt", "tier": 2, "source_type": "mainstream", "country": "Bresil", "continent": "Amerique du Sud", "thematic": "Actualites"},
    {"name": "Borneo Bulletin", "url": "https://borneobulletin.com.bn/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Brunei", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Novinite", "url": "https://www.novinite.com/rss/news.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Bulgarie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Khmer Times", "url": "https://www.khmertimeskh.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Cambodge", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Cameroon Tribune", "url": "https://www.cameroon-tribune.cm/rss.xml", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Cameroun", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "CBC News", "url": "https://www.cbc.ca/cmlink/rss-topstories", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Canada", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "La Tercera", "url": "https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Chili", "continent": "Amerique du Sud", "thematic": "Actualites"},
    {"name": "South China Morning Post", "url": "https://www.scmp.com/rss/91/feed", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Chine", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Cyprus Mail", "url": "https://cyprus-mail.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Chypre", "continent": "Europe", "thematic": "Actualites"},
    {"name": "El Tiempo", "url": "https://www.eltiempo.com/rss", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Colombie", "continent": "Amerique du Sud", "thematic": "Actualites"},
    {"name": "Yonhap (EN)", "url": "https://en.yna.co.kr/RSS/news.xml", "lang": "en", "tier": 2, "source_type": "wire", "country": "Coree du Sud", "continent": "Asie", "thematic": "Actualites"},
    {"name": "The Tico Times", "url": "https://ticotimes.net/feed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Costa Rica", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "Fraternite Matin", "url": "https://www.fratmat.info/rss", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Cote d Ivoire", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Index.hr", "url": "https://www.index.hr/rss", "lang": "hr", "tier": 3, "source_type": "mainstream", "country": "Croatie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Granma (EN)", "url": "https://en.granma.cu/feed", "lang": "en", "tier": 3, "source_type": "gov", "country": "Cuba", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "Copenhagen Post", "url": "https://cphpost.dk/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Danemark", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Al Ahram (EN)", "url": "https://english.ahram.org.eg/RSS.aspx", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Egypte", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Gulf News", "url": "https://gulfnews.com/rss/top-stories", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Emirats Arabes Unis", "continent": "Moyen-Orient", "thematic": "Actualites"},
    {"name": "El Comercio Ecuador", "url": "https://www.elcomercio.com/feed/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Equateur", "continent": "Amerique du Sud", "thematic": "Actualites"},
    {"name": "El Pais", "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", "lang": "es", "tier": 2, "source_type": "mainstream", "country": "Espagne", "continent": "Europe", "thematic": "Actualites"},
    {"name": "ERR News", "url": "https://news.err.ee/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Estonie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Borkena", "url": "https://borkena.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Ethiopie", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Fiji Times", "url": "https://www.fijitimes.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Fidji", "continent": "Oceanie", "thematic": "Actualites"},
    {"name": "Yle (EN)", "url": "https://yle.fi/uutiset/rss/uutiset.rss?osasto=news", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Finlande", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Agenda.ge", "url": "https://agenda.ge/en/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Georgie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Graphic Online", "url": "https://www.graphic.com.gh/news.feed?type=rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Ghana", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Ekathimerini (EN)", "url": "https://www.ekathimerini.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Grece", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Prensa Libre", "url": "https://www.prensalibre.com/feed/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Guatemala", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "La Prensa Honduras", "url": "https://www.laprensa.hn/rss/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Honduras", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "Hungary Today", "url": "https://hungarytoday.hu/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Hongrie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "The Hindu", "url": "https://www.thehindu.com/news/national/feeder/default.rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Inde", "continent": "Asie", "thematic": "Actualites"},
    {"name": "The Jakarta Post", "url": "https://www.thejakartapost.com/news/feed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Indonesie", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Shafaq News", "url": "https://shafaq.com/en/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Irak", "continent": "Moyen-Orient", "thematic": "Actualites"},
    {"name": "Tehran Times", "url": "https://www.tehrantimes.com/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Iran", "continent": "Moyen-Orient", "thematic": "Actualites"},
    {"name": "RTE News", "url": "https://www.rte.ie/news/rss/news-headlines.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Irlande", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Iceland Monitor", "url": "https://icelandmonitor.mbl.is/rss/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Islande", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Jerusalem Post", "url": "https://www.jpost.com/rss/rssfeed.aspx?id=15", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Israel", "continent": "Moyen-Orient", "thematic": "Actualites"},
    {"name": "ANSA", "url": "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml", "lang": "it", "tier": 2, "source_type": "wire", "country": "Italie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Jamaica Gleaner", "url": "https://jamaica-gleaner.com/feed/rss.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Jamaique", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "The Japan Times", "url": "https://www.japantimes.co.jp/feed/", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Japon", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Jordan Times", "url": "https://jordantimes.com/rss/all.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Jordanie", "continent": "Moyen-Orient", "thematic": "Actualites"},
    {"name": "Astana Times", "url": "https://astanatimes.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Kazakhstan", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Daily Nation", "url": "https://nation.africa/service/search/kenya/290754?query=&sortByDate=true&wsRC=1&wsRSS=1", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Kenya", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "KUNA", "url": "https://www.kuna.net.kw/RssLatestNews.aspx?Language=en", "lang": "en", "tier": 3, "source_type": "wire", "country": "Koweit", "continent": "Moyen-Orient", "thematic": "Actualites"},
    {"name": "LSM", "url": "https://eng.lsm.lv/rss/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Lettonie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "L'Orient-Le Jour", "url": "https://www.lorientlejour.com/rss", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Liban", "continent": "Moyen-Orient", "thematic": "Actualites"},
    {"name": "LRT", "url": "https://www.lrt.lt/en/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Lituanie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "RTL Today", "url": "https://today.rtl.lu/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Luxembourg", "continent": "Europe", "thematic": "Actualites"},
    {"name": "MIA", "url": "https://mia.mk/en/rss", "lang": "en", "tier": 3, "source_type": "wire", "country": "Macedoine du Nord", "continent": "Europe", "thematic": "Actualites"},
    {"name": "The Star Malaysia", "url": "https://www.thestar.com.my/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Malaisie", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Times of Malta", "url": "https://timesofmalta.com/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Malte", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Le Matin", "url": "https://lematin.ma/express/rss", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Maroc", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "L'Express Maurice", "url": "https://lexpress.mu/rss", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Maurice", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "El Universal", "url": "https://www.eluniversal.com.mx/rss.xml", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Mexique", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "IPN Moldova", "url": "https://www.ipn.md/en/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Moldavie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Montsame", "url": "https://montsame.mn/en/rss", "lang": "en", "tier": 3, "source_type": "wire", "country": "Mongolie", "continent": "Asie", "thematic": "Actualites"},
    {"name": "The Irrawaddy", "url": "https://www.irrawaddy.com/feed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Myanmar", "continent": "Asie", "thematic": "Actualites"},
    {"name": "The Namibian", "url": "https://www.namibian.com.na/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Namibie", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Kathmandu Post", "url": "https://kathmandupost.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Nepal", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Vanguard Nigeria", "url": "https://www.vanguardngr.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Nigeria", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Aftenposten", "url": "https://www.aftenposten.no/rss", "lang": "no", "tier": 3, "source_type": "mainstream", "country": "Norvege", "continent": "Europe", "thematic": "Actualites"},
    {"name": "NZ Herald", "url": "https://www.nzherald.co.nz/arc/outboundfeeds/rss/news/", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Nouvelle-Zelande", "continent": "Oceanie", "thematic": "Actualites"},
    {"name": "Times of Oman", "url": "https://timesofoman.com/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Oman", "continent": "Moyen-Orient", "thematic": "Actualites"},
    {"name": "Daily Monitor Uganda", "url": "https://www.monitor.co.ug/uganda/news/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Ouganda", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Dawn", "url": "https://www.dawn.com/feeds/home/", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Pakistan", "continent": "Asie", "thematic": "Actualites"},
    {"name": "La Prensa Panama", "url": "https://www.prensa.com/arc/outboundfeeds/rss/?outputType=xml", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Panama", "continent": "Amerique du Nord", "thematic": "Actualites"},
    {"name": "Post Courier PNG", "url": "https://postcourier.com.pg/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Papouasie-Nouvelle-Guinee", "continent": "Oceanie", "thematic": "Actualites"},
    {"name": "ABC Color", "url": "https://www.abc.com.py/arc/outboundfeeds/rss/?outputType=xml", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Paraguay", "continent": "Amerique du Sud", "thematic": "Actualites"},
    {"name": "DutchNews (EN)", "url": "https://www.dutchnews.nl/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Pays-Bas", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Andina", "url": "https://andina.pe/rss/rss.aspx", "lang": "es", "tier": 3, "source_type": "wire", "country": "Perou", "continent": "Amerique du Sud", "thematic": "Actualites"},
    {"name": "Inquirer", "url": "https://www.inquirer.net/fullfeed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Philippines", "continent": "Asie", "thematic": "Actualites"},
    {"name": "The Warsaw Voice", "url": "http://www.warsawvoice.pl/rss/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Pologne", "continent": "Europe", "thematic": "Actualites"},
    {"name": "RTP", "url": "https://www.rtp.pt/noticias/rss", "lang": "pt", "tier": 3, "source_type": "mainstream", "country": "Portugal", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Prague Morning", "url": "https://www.praguemorning.cz/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Republique Tcheque", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Romania Insider", "url": "https://www.romania-insider.com/feed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Roumanie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Moscow Times (EN)", "url": "https://www.themoscowtimes.com/rss/news", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Russie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "The New Times Rwanda", "url": "https://www.newtimes.co.rw/feed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Rwanda", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Agence de Presse Senegalaise", "url": "https://aps.sn/feed/", "lang": "fr", "tier": 3, "source_type": "wire", "country": "Senegal", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "B92 (EN)", "url": "https://www.b92.net/eng/rss/vesti.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Serbie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Channel News Asia", "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Singapour", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Spectator Slovakia", "url": "https://spectator.sme.sk/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Slovaquie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "STA Slovenia", "url": "https://english.sta.si/rss", "lang": "en", "tier": 3, "source_type": "wire", "country": "Slovenie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Daily Mirror Sri Lanka", "url": "https://www.dailymirror.lk/rss/1", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Sri Lanka", "continent": "Asie", "thematic": "Actualites"},
    {"name": "The Local Sweden", "url": "https://feeds.thelocal.com/rss/se", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Suede", "continent": "Europe", "thematic": "Actualites"},
    {"name": "RTS Suisse", "url": "https://www.rts.ch/info/rss", "lang": "fr", "tier": 2, "source_type": "mainstream", "country": "Suisse", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Focus Taiwan", "url": "https://focustaiwan.tw/rss/news/all", "lang": "en", "tier": 3, "source_type": "wire", "country": "Taiwan", "continent": "Asie", "thematic": "Actualites"},
    {"name": "The Citizen Tanzania", "url": "https://www.thecitizen.co.tz/tanzania/news/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Tanzanie", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "Bangkok Post", "url": "https://www.bangkokpost.com/rss/data/topstories.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Thailande", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Hurriyet Daily News (EN)", "url": "https://www.hurriyetdailynews.com/rss.aspx", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Turquie", "continent": "Europe", "thematic": "Actualites"},
    {"name": "Kyiv Independent", "url": "https://kyivindependent.com/feed/", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Ukraine", "continent": "Europe", "thematic": "Actualites"},
    {"name": "El Pais Uruguay", "url": "https://www.elpais.com.uy/rss/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Uruguay", "continent": "Amerique du Sud", "thematic": "Actualites"},
    {"name": "El Nacional Venezuela", "url": "https://www.elnacional.com/feed/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Venezuela", "continent": "Amerique du Sud", "thematic": "Actualites"},
    {"name": "VNExpress (EN)", "url": "https://e.vnexpress.net/rss/news.rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Vietnam", "continent": "Asie", "thematic": "Actualites"},
    {"name": "Lusaka Times", "url": "https://www.lusakatimes.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Zambie", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "The Herald Zimbabwe", "url": "https://www.herald.co.zw/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Zimbabwe", "continent": "Afrique", "thematic": "Actualites"},
    {"name": "BBC UK", "url": "http://feeds.bbci.co.uk/news/world/rss.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Royaume-Uni", "continent": "Europe", "thematic": "Actualites"},
    {"name": "EuroNews", "url": "https://www.euronews.com/rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "France", "continent": "Europe", "thematic": "Actualites"},
]
```

- [ ] **Step 2: Verify catalog loads correctly**

Run: `cd /c/dev/worldmonitor/server-py && python -c "from app.domains.ai_feeds.seed import get_catalog; c = get_catalog(); print(f'{len(c)} sources loaded'); print(set(s['continent'] for s in c))"`

Expected: `~270+ sources loaded` and a set of continents.

- [ ] **Step 3: Commit**

```bash
rtk git add server-py/app/domains/ai_feeds/seed.py
rtk git commit -m "feat(ai-feeds): add source catalog seed data (~270 RSS sources)"
```

---

## Task 5: Backend CRUD Router

**Files:**
- Create: `server-py/app/domains/ai_feeds/router.py`
- Modify: `server-py/app/main.py`

- [ ] **Step 1: Create the router with CRUD endpoints**

```python
# server-py/app/domains/ai_feeds/router.py
"""AI Feeds API — CRUD for thematic feeds with query builder and source management."""

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
from app.domains.ai_feeds.seed import get_catalog

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


# ── Source catalog ───────────────────────────────────────────
@router.get("/catalog/sources")
async def list_catalog(
    country: str | None = None,
    continent: str | None = None,
    thematic: str | None = None,
    lang: str | None = None,
    q: str | None = None,
):
    catalog = get_catalog()
    if country:
        catalog = [s for s in catalog if s.get("country", "").lower() == country.lower()]
    if continent:
        catalog = [s for s in catalog if s.get("continent", "").lower() == continent.lower()]
    if thematic:
        catalog = [s for s in catalog if s.get("thematic", "").lower() == thematic.lower()]
    if lang:
        catalog = [s for s in catalog if s.get("lang", "") == lang]
    if q:
        q_lower = q.lower()
        catalog = [s for s in catalog if q_lower in s["name"].lower() or q_lower in s.get("country", "").lower()]
    return {"sources": catalog, "total": len(catalog)}


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
```

- [ ] **Step 2: Register router in main.py**

Add to `server-py/app/main.py` ROUTERS list (after the cases router line):

```python
    # AI Feeds
    "app.domains.ai_feeds.router",
```

- [ ] **Step 3: Verify server starts with new router**

Run: `cd /c/dev/worldmonitor/server-py && timeout 5 python -m uvicorn app.main:app --port 8000 2>&1 || true`

Expected: Server starts, no import errors. Check that routes are registered:

Run: `cd /c/dev/worldmonitor/server-py && python -c "from app.domains.ai_feeds.router import router; print([r.path for r in router.routes])"`

Expected: List of route paths.

- [ ] **Step 4: Commit**

```bash
rtk git add server-py/app/domains/ai_feeds/router.py server-py/app/main.py
rtk git commit -m "feat(ai-feeds): add CRUD API router with source catalog and URL validation"
```

---

## Task 6: Frontend API Client

**Files:**
- Create: `src/v2/lib/ai-feeds-api.ts`

- [ ] **Step 1: Create the API client**

```typescript
// src/v2/lib/ai-feeds-api.ts
import { api } from '@/v2/lib/api';

// ── Types ────────────────────────────────────────────────────
export interface QueryPart {
  type: 'topic' | 'entity' | 'keyword';
  value: string;
  aliases?: string[];
  scope: 'title_and_content' | 'title';
}

export interface QueryLayer {
  operator: 'AND' | 'OR' | 'NOT';
  parts: QueryPart[];
}

export interface FeedQuery {
  layers: QueryLayer[];
}

export interface AIConfig {
  relevance_threshold: number;
  enrichment_enabled: boolean;
  summary_enabled: boolean;
}

export interface AIFeedData {
  id: string;
  name: string;
  description: string | null;
  query: { layers: QueryLayer[] } | null;
  ai_config: AIConfig | null;
  status: string;
  is_template: boolean;
  source_count: number;
  result_count: number;
  created_at: string;
  updated_at: string;
}

export interface AIFeedSourceData {
  id: string;
  url: string;
  name: string;
  lang: string | null;
  tier: number;
  source_type: string | null;
  country: string | null;
  continent: string | null;
  origin: string;
  enabled: boolean;
}

export interface AIFeedArticle {
  id: string;
  article_url: string;
  title: string;
  source_name: string;
  published_at: string | null;
  relevance_score: number;
  entities: string[] | null;
  summary: string | null;
  threat_level: string | null;
  category: string | null;
  fetched_at: string;
}

export interface CatalogSource {
  name: string;
  url: string;
  lang: string | null;
  tier: number;
  source_type: string | null;
  country: string | null;
  continent: string | null;
  thematic: string | null;
}

// ── Feed CRUD ────────────────────────────────────────────────
export function listFeeds(): Promise<{ feeds: AIFeedData[] }> {
  return api('/ai-feeds');
}

export function getFeed(id: string): Promise<AIFeedData> {
  return api(`/ai-feeds/${id}`);
}

export function createFeed(data: {
  name: string;
  description?: string;
  query?: FeedQuery;
  ai_config?: Partial<AIConfig>;
}): Promise<AIFeedData> {
  return api('/ai-feeds', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateFeed(id: string, data: Record<string, unknown>): Promise<AIFeedData> {
  return api(`/ai-feeds/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteFeed(id: string): Promise<{ status: string }> {
  return api(`/ai-feeds/${id}`, { method: 'DELETE' });
}

// ── Sources ──────────────────────────────────────────────────
export function listFeedSources(feedId: string): Promise<{ sources: AIFeedSourceData[] }> {
  return api(`/ai-feeds/${feedId}/sources`);
}

export function addFeedSource(feedId: string, source: {
  url: string; name: string; lang?: string; tier?: number;
  source_type?: string; country?: string; continent?: string; origin?: string;
}): Promise<AIFeedSourceData> {
  return api(`/ai-feeds/${feedId}/sources`, {
    method: 'POST',
    body: JSON.stringify(source),
  });
}

export function removeFeedSource(feedId: string, sourceId: string): Promise<void> {
  return api(`/ai-feeds/${feedId}/sources/${sourceId}`, { method: 'DELETE' });
}

export function toggleFeedSource(feedId: string, sourceId: string, enabled: boolean): Promise<AIFeedSourceData> {
  return api(`/ai-feeds/${feedId}/sources/${sourceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

// ── Articles ─────────────────────────────────────────────────
export function listFeedArticles(feedId: string, params?: {
  limit?: number; offset?: number;
}): Promise<{ articles: AIFeedArticle[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return api(`/ai-feeds/${feedId}/articles${qs ? `?${qs}` : ''}`);
}

// ── Catalog ──────────────────────────────────────────────────
export function listCatalog(filters?: {
  country?: string; continent?: string; thematic?: string; lang?: string; q?: string;
}): Promise<{ sources: CatalogSource[]; total: number }> {
  const q = new URLSearchParams();
  if (filters?.country) q.set('country', filters.country);
  if (filters?.continent) q.set('continent', filters.continent);
  if (filters?.thematic) q.set('thematic', filters.thematic);
  if (filters?.lang) q.set('lang', filters.lang);
  if (filters?.q) q.set('q', filters.q);
  const qs = q.toString();
  return api(`/ai-feeds/catalog/sources${qs ? `?${qs}` : ''}`);
}

export function validateUrl(url: string): Promise<{
  valid: boolean; feeds_found: { url: string; title: string }[]; error?: string;
}> {
  return api('/ai-feeds/catalog/validate-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /c/dev/worldmonitor && npx tsc --noEmit src/v2/lib/ai-feeds-api.ts 2>&1 | head -20`

Expected: No errors (or only pre-existing errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
rtk git add src/v2/lib/ai-feeds-api.ts
rtk git commit -m "feat(ai-feeds): add frontend API client for AI Feeds"
```

---

## Task 7: React Hook — useAIFeeds

**Files:**
- Create: `src/v2/hooks/useAIFeeds.ts`

- [ ] **Step 1: Create the hook (following useCases pattern)**

```typescript
// src/v2/hooks/useAIFeeds.ts
import { useState, useCallback, useEffect } from 'react';
import { listFeeds, createFeed, deleteFeed, updateFeed } from '@/v2/lib/ai-feeds-api';
import type { AIFeedData, FeedQuery, AIConfig } from '@/v2/lib/ai-feeds-api';

export function useAIFeeds() {
  const [feeds, setFeeds] = useState<AIFeedData[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFeeds();
      setFeeds(data.feeds);
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const add = useCallback(async (name: string, description?: string, query?: FeedQuery, ai_config?: Partial<AIConfig>) => {
    const f = await createFeed({ name, description, query, ai_config });
    setFeeds(prev => [f, ...prev]);
    return f;
  }, []);

  const update = useCallback(async (id: string, data: Record<string, unknown>) => {
    const f = await updateFeed(id, data);
    setFeeds(prev => prev.map(x => x.id === id ? f : x));
    return f;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteFeed(id);
    setFeeds(prev => prev.filter(f => f.id !== id));
  }, []);

  return { feeds, loading, reload, add, update, remove };
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/v2/hooks/useAIFeeds.ts
rtk git commit -m "feat(ai-feeds): add useAIFeeds React hook"
```

---

## Task 8: FeedList Component (Left Panel)

**Files:**
- Create: `src/v2/components/ai-feeds/FeedList.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/v2/components/ai-feeds/FeedList.tsx
import { useState } from 'react';
import { Plus, Search, Rss, Trash2, Loader2 } from 'lucide-react';
import type { AIFeedData } from '@/v2/lib/ai-feeds-api';

interface Props {
  feeds: AIFeedData[];
  selectedId: string | null;
  onSelect: (feed: AIFeedData) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function FeedList({ feeds, selectedId, onSelect, onCreate, onDelete }: Props) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = feeds.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreate(newName.trim());
      setNewName('');
    } catch { /* silent */ }
    setCreating(false);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDeleting(id);
    try { await onDelete(id); } catch { /* silent */ }
    setDeleting(null);
  }

  return (
    <div className="w-72 border-r border-slate-200/60 bg-white flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Mes AI Feeds</h3>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#42d3a5] bg-slate-50"
          />
        </div>
        {/* Quick create */}
        <div className="flex gap-1.5">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Nouveau feed..."
            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#42d3a5] bg-slate-50"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="p-1.5 rounded-lg bg-[#42d3a5] text-white hover:bg-[#38b891] disabled:opacity-50 transition-colors"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.map(feed => (
          <button
            key={feed.id}
            onClick={() => onSelect(feed)}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all group ${
              selectedId === feed.id
                ? 'bg-[#42d3a5]/10 border border-[#42d3a5]/20'
                : 'hover:bg-slate-50 border border-transparent'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              selectedId === feed.id ? 'bg-[#42d3a5]/20 text-[#2a9d7e]' : 'bg-slate-100 text-slate-400'
            }`}>
              <Rss size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-slate-900 truncate">{feed.name}</div>
              <div className="text-[10px] text-slate-400">
                {feed.source_count} sources · {feed.result_count} articles
              </div>
            </div>
            {feed.is_template && (
              <span className="text-[8px] font-bold text-[#42d3a5] bg-[#42d3a5]/10 px-1.5 py-0.5 rounded">TPL</span>
            )}
            <button
              onClick={e => handleDelete(e, feed.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
            >
              {deleting === feed.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">
            {search ? 'Aucun résultat' : 'Créez votre premier AI Feed'}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/v2/components/ai-feeds/FeedList.tsx
rtk git commit -m "feat(ai-feeds): add FeedList component"
```

---

## Task 9: QueryBuilder Component

**Files:**
- Create: `src/v2/components/ai-feeds/QueryBuilder.tsx`

- [ ] **Step 1: Create the visual query builder**

```typescript
// src/v2/components/ai-feeds/QueryBuilder.tsx
import { useState } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';
import type { QueryLayer, QueryPart, FeedQuery } from '@/v2/lib/ai-feeds-api';

interface Props {
  query: FeedQuery;
  onChange: (query: FeedQuery) => void;
}

const OPERATORS = ['AND', 'OR', 'NOT'] as const;
const SCOPES = [
  { value: 'title_and_content', label: 'Titre & Contenu' },
  { value: 'title', label: 'Titre uniquement' },
] as const;
const PART_TYPES = [
  { value: 'topic', label: 'Topic' },
  { value: 'entity', label: 'Entité' },
  { value: 'keyword', label: 'Mot-clé' },
] as const;

export default function QueryBuilder({ query, onChange }: Props) {
  const [editingAliases, setEditingAliases] = useState<string | null>(null);

  function addLayer() {
    onChange({
      layers: [...query.layers, { operator: 'AND', parts: [] }],
    });
  }

  function removeLayer(idx: number) {
    onChange({ layers: query.layers.filter((_, i) => i !== idx) });
  }

  function updateLayer(idx: number, layer: QueryLayer) {
    const updated = [...query.layers];
    updated[idx] = layer;
    onChange({ layers: updated });
  }

  function addPart(layerIdx: number) {
    const layer = query.layers[layerIdx];
    updateLayer(layerIdx, {
      ...layer,
      parts: [...layer.parts, { type: 'topic', value: '', scope: 'title_and_content' }],
    });
  }

  function updatePart(layerIdx: number, partIdx: number, part: QueryPart) {
    const layer = query.layers[layerIdx];
    const parts = [...layer.parts];
    parts[partIdx] = part;
    updateLayer(layerIdx, { ...layer, parts });
  }

  function removePart(layerIdx: number, partIdx: number) {
    const layer = query.layers[layerIdx];
    updateLayer(layerIdx, {
      ...layer,
      parts: layer.parts.filter((_, i) => i !== partIdx),
    });
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-slate-900">Collect articles and reports</h4>
      <p className="text-[11px] text-slate-400">Construisez votre requête avec des filtres combinés (AND/OR/NOT)</p>

      {query.layers.map((layer, li) => (
        <div key={li} className="relative">
          {/* Operator badge between layers */}
          {li > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 border-t border-slate-200" />
              <select
                value={layer.operator}
                onChange={e => updateLayer(li, { ...layer, operator: e.target.value as QueryLayer['operator'] })}
                className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-[#42d3a5]"
              >
                {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <div className="flex-1 border-t border-slate-200" />
            </div>
          )}

          {/* Layer card */}
          <div className="bg-slate-50 rounded-lg border border-slate-200/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Filtre {li + 1}
              </span>
              <button onClick={() => removeLayer(li)} className="text-slate-400 hover:text-red-500 p-0.5">
                <X size={12} />
              </button>
            </div>

            {/* Parts (tags) */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {layer.parts.map((part, pi) => (
                <div key={pi} className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 group">
                  {/* Type selector */}
                  <select
                    value={part.type}
                    onChange={e => updatePart(li, pi, { ...part, type: e.target.value as QueryPart['type'] })}
                    className="text-[9px] font-bold uppercase text-[#42d3a5] bg-transparent border-none focus:outline-none cursor-pointer"
                  >
                    {PART_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>

                  {/* Value input */}
                  <input
                    value={part.value}
                    onChange={e => updatePart(li, pi, { ...part, value: e.target.value })}
                    placeholder="Valeur..."
                    className="text-[11px] text-slate-700 font-medium bg-transparent border-none focus:outline-none w-28"
                  />

                  {/* Scope dropdown */}
                  <select
                    value={part.scope}
                    onChange={e => updatePart(li, pi, { ...part, scope: e.target.value as QueryPart['scope'] })}
                    className="text-[9px] text-slate-400 bg-transparent border-none focus:outline-none cursor-pointer"
                  >
                    {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>

                  {/* Aliases (for entities) */}
                  {part.type === 'entity' && (
                    <button
                      onClick={() => setEditingAliases(editingAliases === `${li}-${pi}` ? null : `${li}-${pi}`)}
                      className="text-[9px] text-blue-500 hover:text-blue-700 font-medium"
                    >
                      {part.aliases?.length ? `+${part.aliases.length}` : 'aliases'}
                    </button>
                  )}

                  {/* Remove */}
                  <button
                    onClick={() => removePart(li, pi)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 ml-1"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              <button
                onClick={() => addPart(li)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-[#42d3a5] border border-dashed border-slate-200 rounded-lg hover:border-[#42d3a5] transition-colors"
              >
                <Plus size={10} /> Ajouter
              </button>
            </div>

            {/* Aliases editor (inline, shown when editing) */}
            {layer.parts.map((part, pi) =>
              editingAliases === `${li}-${pi}` && part.type === 'entity' ? (
                <div key={`alias-${pi}`} className="mt-2 p-2 bg-white rounded border border-blue-100">
                  <label className="text-[9px] font-bold text-blue-600 uppercase mb-1 block">
                    Aliases pour "{part.value}"
                  </label>
                  <input
                    value={(part.aliases || []).join(', ')}
                    onChange={e => updatePart(li, pi, {
                      ...part,
                      aliases: e.target.value.split(',').map(a => a.trim()).filter(Boolean),
                    })}
                    placeholder="Apple Inc., AAPL, Apple Computer"
                    className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-blue-400"
                  />
                </div>
              ) : null
            )}
          </div>
        </div>
      ))}

      <button
        onClick={addLayer}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-slate-400 hover:text-[#42d3a5] border border-dashed border-slate-200 rounded-lg hover:border-[#42d3a5] transition-colors"
      >
        <Plus size={12} /> Ajouter un filtre
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/v2/components/ai-feeds/QueryBuilder.tsx
rtk git commit -m "feat(ai-feeds): add QueryBuilder component (AND/OR/NOT layers)"
```

---

## Task 10: SourceSelector Component

**Files:**
- Create: `src/v2/components/ai-feeds/SourceSelector.tsx`

- [ ] **Step 1: Create the source selector**

```typescript
// src/v2/components/ai-feeds/SourceSelector.tsx
import { useState, useEffect } from 'react';
import { Search, Plus, Globe, X, Loader2, ExternalLink } from 'lucide-react';
import { listCatalog, validateUrl, addFeedSource, removeFeedSource, listFeedSources, toggleFeedSource } from '@/v2/lib/ai-feeds-api';
import type { CatalogSource, AIFeedSourceData } from '@/v2/lib/ai-feeds-api';

interface Props {
  feedId: string | null;
}

const CONTINENTS = ['Europe', 'Asie', 'Afrique', 'Amerique du Nord', 'Amerique du Sud', 'Oceanie', 'Moyen-Orient'];

export default function SourceSelector({ feedId }: Props) {
  const [catalog, setCatalog] = useState<CatalogSource[]>([]);
  const [feedSources, setFeedSources] = useState<AIFeedSourceData[]>([]);
  const [search, setSearch] = useState('');
  const [continent, setContinent] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load catalog
  useEffect(() => {
    listCatalog({ q: search || undefined, continent: continent || undefined })
      .then(d => setCatalog(d.sources))
      .catch(() => {});
  }, [search, continent]);

  // Load feed sources
  useEffect(() => {
    if (!feedId) { setFeedSources([]); return; }
    listFeedSources(feedId).then(d => setFeedSources(d.sources)).catch(() => {});
  }, [feedId]);

  const feedSourceUrls = new Set(feedSources.map(s => s.url));

  async function handleAddFromCatalog(source: CatalogSource) {
    if (!feedId || feedSourceUrls.has(source.url)) return;
    setLoading(true);
    try {
      const added = await addFeedSource(feedId, {
        url: source.url, name: source.name, lang: source.lang ?? undefined,
        tier: source.tier, source_type: source.source_type ?? undefined,
        country: source.country ?? undefined, continent: source.continent ?? undefined,
        origin: 'catalog',
      });
      setFeedSources(prev => [...prev, added]);
    } catch { /* silent */ }
    setLoading(false);
  }

  async function handleRemove(sourceId: string) {
    if (!feedId) return;
    try {
      await removeFeedSource(feedId, sourceId);
      setFeedSources(prev => prev.filter(s => s.id !== sourceId));
    } catch { /* silent */ }
  }

  async function handleToggle(sourceId: string, enabled: boolean) {
    if (!feedId) return;
    try {
      const updated = await toggleFeedSource(feedId, sourceId, enabled);
      setFeedSources(prev => prev.map(s => s.id === sourceId ? updated : s));
    } catch { /* silent */ }
  }

  async function handleCustomUrl() {
    if (!feedId || !customUrl.trim()) return;
    setValidating(true);
    try {
      const result = await validateUrl(customUrl.trim());
      if (result.valid && result.feeds_found.length > 0) {
        const feed = result.feeds_found[0];
        const added = await addFeedSource(feedId, {
          url: feed.url, name: feed.title || customUrl.trim(), origin: 'custom',
        });
        setFeedSources(prev => [...prev, added]);
        setCustomUrl('');
      }
    } catch { /* silent */ }
    setValidating(false);
  }

  if (!feedId) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-slate-400">
        Sélectionnez un feed pour gérer ses sources
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Feed sources (top) */}
      <div className="p-3 border-b border-slate-100">
        <h4 className="text-[11px] font-bold text-slate-900 mb-2">
          Sources actives ({feedSources.filter(s => s.enabled).length})
        </h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {feedSources.map(s => (
            <div key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 group">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={e => handleToggle(s.id, e.target.checked)}
                className="rounded text-[#42d3a5] focus:ring-[#42d3a5] w-3 h-3"
              />
              <span className="text-[10px] text-slate-700 flex-1 truncate">{s.name}</span>
              <span className="text-[8px] text-slate-400">{s.country || s.origin}</span>
              <button onClick={() => handleRemove(s.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500">
                <X size={10} />
              </button>
            </div>
          ))}
          {feedSources.length === 0 && (
            <div className="text-[10px] text-slate-400 text-center py-2">Aucune source — ajoutez depuis le catalogue</div>
          )}
        </div>
      </div>

      {/* Custom URL */}
      <div className="p-3 border-b border-slate-100">
        <div className="flex gap-1.5">
          <input
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomUrl()}
            placeholder="Ajouter une URL RSS..."
            className="flex-1 px-2.5 py-1.5 text-[10px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#42d3a5] bg-slate-50"
          />
          <button
            onClick={handleCustomUrl}
            disabled={validating || !customUrl.trim()}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-[#42d3a5] hover:text-white disabled:opacity-50 transition-colors"
          >
            {validating ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
          </button>
        </div>
      </div>

      {/* Catalog browser */}
      <div className="flex-1 overflow-hidden flex flex-col p-3">
        <h4 className="text-[11px] font-bold text-slate-900 mb-2">Catalogue ({catalog.length} sources)</h4>
        <div className="flex gap-1.5 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={10} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-6 pr-2 py-1 text-[10px] border border-slate-200 rounded focus:outline-none focus:border-[#42d3a5] bg-slate-50"
            />
          </div>
          <select
            value={continent}
            onChange={e => setContinent(e.target.value)}
            className="text-[10px] px-2 py-1 border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-[#42d3a5]"
          >
            <option value="">Tous continents</option>
            {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {catalog.slice(0, 50).map((s, i) => (
            <button
              key={i}
              onClick={() => handleAddFromCatalog(s)}
              disabled={feedSourceUrls.has(s.url) || loading}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                feedSourceUrls.has(s.url) ? 'bg-[#42d3a5]/5 opacity-60' : 'hover:bg-slate-50'
              }`}
            >
              <Globe size={10} className="text-slate-400 shrink-0" />
              <span className="text-[10px] text-slate-700 font-medium flex-1 truncate">{s.name}</span>
              <span className="text-[8px] text-slate-400">{s.country}</span>
              {!feedSourceUrls.has(s.url) && <Plus size={10} className="text-[#42d3a5]" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/v2/components/ai-feeds/SourceSelector.tsx
rtk git commit -m "feat(ai-feeds): add SourceSelector component with catalog browser"
```

---

## Task 11: FeedPreview Component

**Files:**
- Create: `src/v2/components/ai-feeds/FeedPreview.tsx`

- [ ] **Step 1: Create the preview component**

```typescript
// src/v2/components/ai-feeds/FeedPreview.tsx
import { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { listFeedArticles } from '@/v2/lib/ai-feeds-api';
import type { AIFeedArticle } from '@/v2/lib/ai-feeds-api';
import { timeAgo } from '@/v2/lib/constants';

interface Props {
  feedId: string | null;
}

const THREAT_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-600',
  high: 'bg-orange-100 text-orange-600',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-600',
};

export default function FeedPreview({ feedId }: Props) {
  const [articles, setArticles] = useState<AIFeedArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!feedId) return;
    setLoading(true);
    try {
      const data = await listFeedArticles(feedId, { limit: 10 });
      setArticles(data.articles);
      setTotal(data.total);
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [feedId]);

  if (!feedId) {
    return (
      <div className="text-center py-4 text-xs text-slate-400">
        Sélectionnez un feed pour voir l'aperçu
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-bold text-slate-900">
          Aperçu ({total} articles)
        </h4>
        <button onClick={load} disabled={loading} className="p-1 text-slate-400 hover:text-[#42d3a5] transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="space-y-1.5">
        {articles.map(a => (
          <a
            key={a.id}
            href={a.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2.5 rounded-lg border border-slate-100 hover:border-[#42d3a5]/30 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1">
              {a.threat_level && (
                <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${THREAT_COLORS[a.threat_level] || 'bg-slate-100 text-slate-500'}`}>
                  {a.threat_level}
                </span>
              )}
              <span className="text-[9px] font-semibold text-[#42d3a5]">{a.source_name}</span>
              <span className="text-[8px] text-slate-400 ml-auto">{a.published_at ? timeAgo(a.published_at) : ''}</span>
              <span className="text-[9px] font-bold text-blue-500">{Math.round(a.relevance_score)}%</span>
            </div>
            <p className="text-[11px] text-slate-700 font-medium line-clamp-2">{a.title}</p>
            {a.summary && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{a.summary}</p>}
            {a.entities && a.entities.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {a.entities.slice(0, 5).map((e, i) => (
                  <span key={i} className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{e}</span>
                ))}
              </div>
            )}
          </a>
        ))}
        {articles.length === 0 && !loading && (
          <div className="text-center py-6 text-xs text-slate-400">
            Pas encore d'articles — ajoutez des sources et lancez un refresh
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/v2/components/ai-feeds/FeedPreview.tsx
rtk git commit -m "feat(ai-feeds): add FeedPreview component"
```

---

## Task 12: AIFeedsView — Main Tab Layout

**Files:**
- Create: `src/v2/components/AIFeedsView.tsx`

- [ ] **Step 1: Create the main view assembling all sub-components**

```typescript
// src/v2/components/AIFeedsView.tsx
import { useState, useCallback } from 'react';
import { useAIFeeds } from '@/v2/hooks/useAIFeeds';
import type { AIFeedData, FeedQuery, AIConfig } from '@/v2/lib/ai-feeds-api';
import { updateFeed as apiFeedUpdate } from '@/v2/lib/ai-feeds-api';
import FeedList from './ai-feeds/FeedList';
import QueryBuilder from './ai-feeds/QueryBuilder';
import SourceSelector from './ai-feeds/SourceSelector';
import FeedPreview from './ai-feeds/FeedPreview';

export default function AIFeedsView() {
  const { feeds, loading, add, remove, update } = useAIFeeds();
  const [selected, setSelected] = useState<AIFeedData | null>(null);
  const [localQuery, setLocalQuery] = useState<FeedQuery>({ layers: [] });
  const [dirty, setDirty] = useState(false);

  function handleSelect(feed: AIFeedData) {
    setSelected(feed);
    setLocalQuery(feed.query || { layers: [] });
    setDirty(false);
  }

  function handleQueryChange(query: FeedQuery) {
    setLocalQuery(query);
    setDirty(true);
  }

  async function handleCreate(name: string) {
    const feed = await add(name);
    handleSelect(feed);
  }

  async function handleDelete(id: string) {
    await remove(id);
    if (selected?.id === id) {
      setSelected(null);
      setLocalQuery({ layers: [] });
    }
  }

  async function handleSave() {
    if (!selected || !dirty) return;
    const updated = await update(selected.id, { query: localQuery });
    setSelected(updated);
    setDirty(false);
  }

  return (
    <div className="flex h-full -m-5 bg-white rounded-xl border border-slate-200/60 overflow-hidden">
      {/* Left: Feed list */}
      <FeedList
        feeds={feeds}
        selectedId={selected?.id || null}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />

      {/* Center: Query builder + Preview */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200/60">
        {selected ? (
          <>
            {/* Feed header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{selected.name}</h2>
                <p className="text-[10px] text-slate-400">
                  {selected.source_count} sources · {selected.result_count} articles · {selected.status}
                </p>
              </div>
              {dirty && (
                <button
                  onClick={handleSave}
                  className="px-4 py-1.5 text-[11px] font-semibold text-white rounded-lg shadow-sm transition-colors"
                  style={{ background: '#42d3a5' }}
                >
                  Sauvegarder
                </button>
              )}
            </div>

            {/* Query builder */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <QueryBuilder query={localQuery} onChange={handleQueryChange} />
              <div className="border-t border-slate-100 pt-4">
                <FeedPreview feedId={selected.id} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">AI Feeds</h3>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Créez des thématiques intelligentes pour collecter et filtrer les articles les plus pertinents.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Source selector */}
      <div className="w-80 shrink-0 bg-white">
        <SourceSelector feedId={selected?.id || null} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/v2/components/AIFeedsView.tsx
rtk git commit -m "feat(ai-feeds): add AIFeedsView main component"
```

---

## Task 13: Dashboard Integration — New Tab

**Files:**
- Modify: `src/v2/components/Dashboard.tsx`

- [ ] **Step 1: Add import for AIFeedsView**

At line 19 of `Dashboard.tsx` (after `import WorldView from './WorldView';`), add:

```typescript
import AIFeedsView from './AIFeedsView';
```

- [ ] **Step 2: Add 'ai-feeds' to NavKey type**

Change line 33 from:

```typescript
type NavKey = 'dashboard' | 'cases' | 'world' | 'reports' | 'settings';
```

to:

```typescript
type NavKey = 'dashboard' | 'cases' | 'ai-feeds' | 'world' | 'reports' | 'settings';
```

- [ ] **Step 3: Add nav item to NAV_ITEMS array**

Add the Rss import to the lucide-react imports at line 3:

```typescript
import {
  LayoutDashboard, FolderOpen, FileBarChart, Settings, Bell, Search,
  AlertTriangle, Globe, TrendingUp, Building,
  Newspaper, Activity, BarChart2,
  RefreshCw, LogOut, ExternalLink, Rss
} from 'lucide-react';
```

Then change NAV_ITEMS (lines 44-50) to insert the AI Feeds item after 'cases':

```typescript
const NAV_ITEMS: { key: NavKey; label: string; icon: typeof LayoutDashboard; sep?: boolean }[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'cases',     label: 'Cases',           icon: FolderOpen },
  { key: 'ai-feeds',  label: 'AI Feeds',        icon: Rss },
  { key: 'world',     label: '360 Mondial',     icon: Globe },
  { key: 'reports',   label: 'Rapports',        icon: FileBarChart },
  { key: 'settings',  label: 'Configuration',   icon: Settings, sep: true },
];
```

- [ ] **Step 4: Add the tab render block**

After the World View block (after line 276 `{nav === 'world' && <WorldView />}`), add:

```typescript
          {/* ════════════════════ AI FEEDS VIEW ════════════════════ */}
          {nav === 'ai-feeds' && <AIFeedsView />}
```

- [ ] **Step 5: Verify the app compiles**

Run: `cd /c/dev/worldmonitor && npx tsc --noEmit 2>&1 | head -30`

Expected: No new errors from Dashboard.tsx changes.

- [ ] **Step 6: Commit**

```bash
rtk git add src/v2/components/Dashboard.tsx
rtk git commit -m "feat(ai-feeds): integrate AI Feeds tab into Dashboard navigation"
```

---

## Task 14: Widget Integration — AI Feed as Widget Type

**Files:**
- Modify: `src/v2/components/shared/WidgetCatalog.tsx`

- [ ] **Step 1: Add AI Feed widget definition to FULL_CATALOG**

At the end of the FULL_CATALOG array (after the last entry but before `];`), add a comment section and a dynamic widget loader. First, add the Rss import to lucide-react imports at line 6:

Add `Rss` to the lucide-react import.

Then add this entry to the FULL_CATALOG array:

```typescript
  // AI Feeds (dynamic — placeholder, real feeds are loaded from API)
  { id: 'ai-feed-placeholder', title: 'AI Feed', icon: Rss, category: 'AI Feeds', defaultW: 4, defaultH: 6, minH: 3, minW: 3 },
```

- [ ] **Step 2: Add AI Feed renderer to renderSharedWidget**

Find the `renderSharedWidget` function in the file. Add a case for the `ai-feed-` prefix at the beginning of the switch/if chain:

```typescript
  // AI Feed widgets
  if (id.startsWith('ai-feed-') && id !== 'ai-feed-placeholder') {
    const feedId = id.replace('ai-feed-', '');
    return <AIFeedWidget feedId={feedId} />;
  }
```

And add the AIFeedWidget component at the bottom of the file:

```typescript
function AIFeedWidget({ feedId }: { feedId: string }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@/v2/lib/ai-feeds-api').then(({ listFeedArticles }) => {
      listFeedArticles(feedId, { limit: 15 })
        .then(d => { setArticles(d.articles); setLoading(false); })
        .catch(() => setLoading(false));
    });
  }, [feedId]);

  if (loading) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Chargement...</div>;

  return (
    <div className="overflow-y-auto h-full p-2 space-y-1.5">
      {articles.map((a: any, i: number) => (
        <a key={i} href={a.article_url} target="_blank" rel="noopener noreferrer"
           className="block pl-2.5 border-l-2 border-slate-100 hover:border-[#42d3a5] pb-1.5 transition-colors">
          <p className="text-[10px] text-slate-600 line-clamp-1 font-medium">{a.title}</p>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-semibold uppercase text-[#42d3a5]">{a.source_name}</span>
            {a.relevance_score > 0 && <span className="text-[8px] text-blue-500 font-bold">{Math.round(a.relevance_score)}%</span>}
            <span className="text-[8px] text-slate-400">{a.published_at ? timeAgo(a.published_at) : ''}</span>
          </div>
        </a>
      ))}
      {articles.length === 0 && <div className="text-center text-xs text-slate-400 py-6">Pas d'articles</div>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
rtk git add src/v2/components/shared/WidgetCatalog.tsx
rtk git commit -m "feat(ai-feeds): add AI Feed widget type to shared catalog"
```

---

## Task 15: End-to-End Smoke Test

- [ ] **Step 1: Start the backend**

Run: `cd /c/dev/worldmonitor/server-py && python -m uvicorn app.main:app --port 8000 &`

Wait for startup, then:

- [ ] **Step 2: Test catalog endpoint**

Run: `curl -s http://localhost:8000/api/ai-feeds/catalog/sources?continent=Asie | python -m json.tool | head -30`

Expected: JSON with sources from Asia.

- [ ] **Step 3: Test URL validation**

Run: `curl -s -X POST http://localhost:8000/api/ai-feeds/catalog/validate-url -H 'Content-Type: application/json' -d '{"url":"https://www.bbc.com"}' | python -m json.tool`

Expected: `{"valid": true, "feeds_found": [...]}` with discovered RSS feeds.

- [ ] **Step 4: Start the frontend**

Run: `cd /c/dev/worldmonitor && npm run dev &`

Expected: Vite dev server starts. Navigate to localhost:5173, log in, and verify the "AI Feeds" tab appears in the sidebar.

- [ ] **Step 5: Commit final state**

```bash
rtk git add -A && rtk git status
rtk git commit -m "feat(ai-feeds): complete MVP — AI Feeds tab with query builder, source catalog, and widget integration"
```
