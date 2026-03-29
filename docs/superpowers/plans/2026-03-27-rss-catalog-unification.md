# RSS Catalog Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge three separate RSS source catalogs (rss_catalog.py 41 sources, seed.py ~270 sources, rss_catalog DB table) into a single DB-backed source of truth.

**Architecture:** The `rss_catalog` DB table becomes the only source of RSS metadata. A seed function populates it on first boot with all ~300 deduplicated sources. All consumers (catalog_ingest, AI Feeds router, news router) read exclusively from the DB. The two static Python files are deleted.

**Tech Stack:** SQLAlchemy (async), SQLite/Postgres, FastAPI, Python 3.11+

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `server-py/app/models/ai_feed.py` | Update `RssCatalogEntry` model — `thematic` → `tags` (JSON), add `active`, `description`, `last_fetched_at`, `fetch_error_count` |
| Rewrite | `server-py/app/domains/ai_feeds/seed.py` | Becomes a DB seeder function with all ~300 merged sources |
| Modify | `server-py/app/main.py` | Call seed function in lifespan after `create_all_tables()` |
| Modify | `server-py/app/source_engine/catalog_ingest.py` | Read feeds from DB instead of `RSS_CATALOG` import |
| Modify | `server-py/app/domains/ai_feeds/router.py` | Remove `get_catalog()` import, read from DB only, adapt `thematic` → `tags` filtering |
| Modify | `server-py/app/domains/news/router.py` | Remove `RSS_CATALOG` import, read from DB |
| Delete | `server-py/app/domains/news/rss_catalog.py` | No longer needed |

---

### Task 1: Update RssCatalogEntry model

**Files:**
- Modify: `server-py/app/models/ai_feed.py:94-110`

- [ ] **Step 1: Update the model**

Replace the `RssCatalogEntry` class with the new schema:

```python
class RssCatalogEntry(Base):
    """Global RSS source catalog — single source of truth for all feeds."""
    __tablename__ = "rss_catalog"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    lang: Mapped[str | None] = mapped_column(String(5), nullable=True)
    tier: Mapped[int] = mapped_column(Integer, default=3)
    source_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    continent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, default=list)
    origin: Mapped[str] = mapped_column(String(20), nullable=False, default="builtin")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fetch_error_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
```

Add `JSON` to the SQLAlchemy imports at the top of the file (line 4):

```python
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
```

- [ ] **Step 2: Verify model loads**

Run: `cd /c/dev/worldmonitor/server-py && python -c "from app.models.ai_feed import RssCatalogEntry; print('OK:', [c.name for c in RssCatalogEntry.__table__.columns])"`

Expected: OK with column names including `tags`, `active`, `description`, `last_fetched_at`, `fetch_error_count`

- [ ] **Step 3: Commit**

```bash
git add server-py/app/models/ai_feed.py
git commit -m "refactor(rss-catalog): update RssCatalogEntry schema — tags JSON, active, description, fetch tracking"
```

---

### Task 2: Rewrite seed.py as DB seeder

**Files:**
- Rewrite: `server-py/app/domains/ai_feeds/seed.py`

The seed file keeps all ~300 source dicts as static data but exposes an `async def seed_catalog(db)` function that inserts them into the DB (skip existing URLs).

- [ ] **Step 1: Rewrite seed.py**

The file structure:
1. `_SOURCES: list[dict]` — single flat list of all ~300 sources, each with `{name, url, lang, tier, source_type, country, continent, tags}` where `tags` is a list of strings.
2. `async def seed_catalog(db) -> int` — insert missing sources into `rss_catalog` table, return count inserted.

Key changes from current seed.py:
- Merge `_BUILTIN_GLOBAL` + `_BUILTIN_COUNTRY` into one `_SOURCES` list
- Convert every `"thematic": "X"` to `"tags": ["X"]`
- Add the ~15 sources from `rss_catalog.py` that are NOT already in seed.py (BBC Business, BBC Tech, Le Monde Éco, Libération, Spiegel Int, Wired, The War Zone, FT, Investing.com, TASS, Xinhua, NHK World, Times of India, Haaretz, Middle East Eye, The Hacker News, BleepingComputer, Dark Reading, gCaptain, Splash247, Rigzone, Carbon Brief, Climate Home), enriched with proper tier/country/continent/source_type/tags
- Remove the old `get_catalog()` function

The `seed_catalog` function:

```python
async def seed_catalog(db) -> int:
    """Insert builtin sources into rss_catalog table. Skips existing URLs."""
    from sqlalchemy import select
    from app.models.ai_feed import RssCatalogEntry

    result = await db.execute(select(RssCatalogEntry.url))
    existing_urls = {row[0] for row in result.all()}

    inserted = 0
    for src in _SOURCES:
        if src["url"] not in existing_urls:
            entry = RssCatalogEntry(
                url=src["url"],
                name=src["name"],
                lang=src.get("lang", "en"),
                tier=src.get("tier", 3),
                source_type=src.get("source_type"),
                country=src.get("country"),
                continent=src.get("continent"),
                tags=src.get("tags", []),
                origin="builtin",
            )
            db.add(entry)
            inserted += 1

    if inserted:
        await db.commit()
    return inserted
```

- [ ] **Step 2: Verify seed data loads**

Run: `cd /c/dev/worldmonitor/server-py && python -c "from app.domains.ai_feeds.seed import _SOURCES; print(f'{len(_SOURCES)} sources'); urls = [s['url'] for s in _SOURCES]; print(f'{len(urls)} urls, {len(set(urls))} unique'); assert len(urls) == len(set(urls)), 'DUPLICATES FOUND'"`

Expected: ~300 sources, all unique URLs, no assertion error.

- [ ] **Step 3: Commit**

```bash
git add server-py/app/domains/ai_feeds/seed.py
git commit -m "refactor(rss-catalog): rewrite seed.py as DB seeder with ~300 merged sources, tags as JSON arrays"
```

---

### Task 3: Hook seed into app lifespan

**Files:**
- Modify: `server-py/app/main.py:126-137`

- [ ] **Step 1: Add seed call after create_all_tables**

In the `lifespan` function, after `await create_all_tables()`, add:

```python
    if settings.database_url.startswith("sqlite"):
        from app.db import create_all_tables
        await create_all_tables()

    # Seed RSS catalog on boot (inserts only missing sources)
    from app.db import async_session
    from app.domains.ai_feeds.seed import seed_catalog
    async with async_session() as db:
        count = await seed_catalog(db)
        if count:
            import logging
            logging.getLogger(__name__).info(f"Seeded {count} RSS catalog entries")
```

Note: seed runs OUTSIDE the `if sqlite` block — it should always run, regardless of DB backend.

- [ ] **Step 2: Verify app starts and seeds**

Run: `cd /c/dev/worldmonitor/server-py && python -c "
import asyncio
from app.db import create_all_tables, async_session
from app.domains.ai_feeds.seed import seed_catalog
async def test():
    await create_all_tables()
    async with async_session() as db:
        n = await seed_catalog(db)
        print(f'Seeded {n} entries')
        # Verify
        from sqlalchemy import select, func
        from app.models.ai_feed import RssCatalogEntry
        result = await db.execute(select(func.count()).select_from(RssCatalogEntry))
        print(f'Total in DB: {result.scalar()}')
asyncio.run(test())
"`

Expected: Seeded ~300 entries, Total in DB: ~300

- [ ] **Step 3: Commit**

```bash
git add server-py/app/main.py
git commit -m "feat(rss-catalog): seed RSS catalog on app boot"
```

---

### Task 4: Migrate catalog_ingest.py to read from DB

**Files:**
- Modify: `server-py/app/source_engine/catalog_ingest.py`

- [ ] **Step 1: Rewrite catalog_ingest.py**

Replace the entire file. No more `RSS_CATALOG` import, no more `_get_custom_feeds`. Just read all active feeds from the DB table:

```python
"""
RSS catalog ingestion — fetch all active catalog feeds and run through article pipeline.
Reads from the unified rss_catalog DB table (builtin + custom).
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, update

from app.models.ai_feed import RssCatalogEntry
from app.source_engine.rss_fetcher import fetch_rss_feed
from app.source_engine.article_pipeline import ingest_articles

logger = logging.getLogger(__name__)


async def ingest_full_catalog(db) -> int:
    """Ingest all active RSS catalog feeds into the article DB.
    Returns total number of newly inserted articles."""
    result = await db.execute(
        select(RssCatalogEntry).where(RssCatalogEntry.active == True)
    )
    feeds = result.scalars().all()

    total_inserted = 0
    for feed in feeds:
        try:
            rows = await fetch_rss_feed(feed.url, max_items=30, timeout=12)
            if rows:
                source_id = f"catalog_{feed.name.lower().replace(' ', '_')}"
                inserted = await ingest_articles(db, source_id, rows)
                total_inserted += inserted
            # Update last_fetched_at, reset error count
            await db.execute(
                update(RssCatalogEntry)
                .where(RssCatalogEntry.id == feed.id)
                .values(last_fetched_at=datetime.now(timezone.utc), fetch_error_count=0)
            )
        except Exception as e:
            logger.warning(f"Catalog ingest '{feed.name}' failed: {e}")
            await db.execute(
                update(RssCatalogEntry)
                .where(RssCatalogEntry.id == feed.id)
                .values(fetch_error_count=feed.fetch_error_count + 1)
            )
        await asyncio.sleep(0.5)

    await db.commit()
    if total_inserted:
        logger.info(f"Catalog ingest: {total_inserted} new articles from {len(feeds)} feeds")
    return total_inserted
```

- [ ] **Step 2: Verify import works**

Run: `cd /c/dev/worldmonitor/server-py && python -c "from app.source_engine.catalog_ingest import ingest_full_catalog; print('OK')"`

Expected: OK (no import errors)

- [ ] **Step 3: Commit**

```bash
git add server-py/app/source_engine/catalog_ingest.py
git commit -m "refactor(rss-catalog): catalog_ingest reads from DB instead of static RSS_CATALOG"
```

---

### Task 5: Migrate AI Feeds router to DB-only

**Files:**
- Modify: `server-py/app/domains/ai_feeds/router.py:22,88-115,398-402`

- [ ] **Step 1: Remove get_catalog import (line 22)**

Delete:
```python
from app.domains.ai_feeds.seed import get_catalog
```

- [ ] **Step 2: Rewrite /catalog/sources endpoint (lines 88-115)**

Replace the merge logic with a pure DB query:

```python
@router.get("/catalog/sources")
async def list_catalog_sources(
    country: str | None = None,
    continent: str | None = None,
    tag: str | None = None,
    lang: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    from app.models.ai_feed import RssCatalogEntry
    query = select(RssCatalogEntry).where(RssCatalogEntry.active == True)

    if country:
        query = query.where(RssCatalogEntry.country.ilike(country))
    if continent:
        query = query.where(RssCatalogEntry.continent.ilike(continent))
    if lang:
        query = query.where(RssCatalogEntry.lang == lang)

    result = await db.execute(query)
    sources = result.scalars().all()

    # Filter by tag (JSON array contains) and text search in Python
    catalog = []
    for s in sources:
        if tag and tag.lower() not in [t.lower() for t in (s.tags or [])]:
            continue
        if q:
            q_lower = q.lower()
            if q_lower not in s.name.lower() and q_lower not in (s.country or "").lower():
                continue
        catalog.append({
            "name": s.name, "url": s.url, "lang": s.lang, "tier": s.tier,
            "source_type": s.source_type, "country": s.country,
            "continent": s.continent, "tags": s.tags or [],
            "active": s.active, "description": s.description,
        })

    return {"sources": catalog, "total": len(catalog)}
```

Note: `thematic` query param becomes `tag`. Tag filtering stays in Python because JSON containment queries differ between SQLite and Postgres.

- [ ] **Step 3: Update ai_bootstrap endpoint (line 398)**

Replace:
```python
    catalog = get_catalog()
```
With:
```python
    from app.models.ai_feed import RssCatalogEntry
    result = await db.execute(select(RssCatalogEntry).where(RssCatalogEntry.active == True))
    db_sources = result.scalars().all()
    catalog = [
        {"name": s.name, "url": s.url, "lang": s.lang, "tier": s.tier,
         "source_type": s.source_type, "country": s.country,
         "continent": s.continent, "tags": s.tags or []}
        for s in db_sources
    ]
```

And add `db: AsyncSession = Depends(get_db)` to the function signature if not already present.

Update the `catalog_summary` line to use `tags` instead of `thematic`:
```python
    catalog_summary = "\n".join(
        f"- {s['name']} ({s['country']}, {s['continent']}, {', '.join(s['tags'])}, {s['lang']}, tier {s['tier']})"
        for s in catalog
    )
```

- [ ] **Step 4: Update bulk-add endpoint (line 229-238)**

Replace `thematic=cat.get("thematic")` with `tags=[cat["thematic"]] if cat.get("thematic") else []` in the `RssCatalogEntry(...)` constructor.

- [ ] **Step 5: Update add-source endpoint (line 700-710)**

Replace `thematic` references with `tags`. The `RssCatalogEntry(...)` at line 700 currently doesn't set `thematic` — keep it as-is but ensure no reference to the removed column.

- [ ] **Step 6: Verify import works**

Run: `cd /c/dev/worldmonitor/server-py && python -c "from app.domains.ai_feeds.router import router; print('OK')"`

Expected: OK

- [ ] **Step 7: Commit**

```bash
git add server-py/app/domains/ai_feeds/router.py
git commit -m "refactor(rss-catalog): AI Feeds router reads from DB, thematic→tags"
```

---

### Task 6: Migrate news router to DB-only

**Files:**
- Modify: `server-py/app/domains/news/router.py:16,83-89`

- [ ] **Step 1: Remove RSS_CATALOG import (line 16)**

Delete:
```python
from app.domains.news.rss_catalog import RSS_CATALOG
```

- [ ] **Step 2: Rewrite /rss-catalog endpoint (lines 83-89)**

```python
@router.get("/rss-catalog")
async def list_rss_catalog(db: AsyncSession = Depends(get_db)):
    """List all RSS sources available for ingestion."""
    from sqlalchemy import select
    from app.models.ai_feed import RssCatalogEntry
    result = await db.execute(
        select(RssCatalogEntry).where(RssCatalogEntry.active == True)
    )
    sources = result.scalars().all()
    return {
        "sources": [
            {"name": s.name, "url": s.url, "lang": s.lang, "tier": s.tier,
             "tags": s.tags or [], "country": s.country}
            for s in sources
        ],
        "total": len(sources),
    }
```

- [ ] **Step 3: Verify import works**

Run: `cd /c/dev/worldmonitor/server-py && python -c "from app.domains.news.router import router; print('OK')"`

Expected: OK

- [ ] **Step 4: Commit**

```bash
git add server-py/app/domains/news/router.py
git commit -m "refactor(rss-catalog): news router reads from DB instead of static RSS_CATALOG"
```

---

### Task 7: Delete rss_catalog.py and cleanup

**Files:**
- Delete: `server-py/app/domains/news/rss_catalog.py`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "rss_catalog import\|from.*rss_catalog" server-py/app/ --include="*.py"`

Expected: No matches (all imports were removed in Tasks 4-6).

- [ ] **Step 2: Delete the file**

```bash
rm server-py/app/domains/news/rss_catalog.py
```

- [ ] **Step 3: Final verification — app starts clean**

Run: `cd /c/dev/worldmonitor/server-py && python -c "
import asyncio
from app.db import create_all_tables, async_session
from app.domains.ai_feeds.seed import seed_catalog
async def test():
    await create_all_tables()
    async with async_session() as db:
        n = await seed_catalog(db)
        print(f'Seeded {n}')
    from app.source_engine.catalog_ingest import ingest_full_catalog
    from app.domains.ai_feeds.router import router as ai_router
    from app.domains.news.router import router as news_router
    print('All imports OK')
asyncio.run(test())
"`

Expected: All imports OK, no errors.

- [ ] **Step 4: Commit**

```bash
git rm server-py/app/domains/news/rss_catalog.py
git commit -m "refactor(rss-catalog): delete rss_catalog.py — DB is now single source of truth"
```

---

### Task 8: Frontend — update thematic → tags references

**Files:**
- Search & modify any frontend files that reference `thematic` from the catalog API

- [ ] **Step 1: Find frontend references**

Run: `grep -r "thematic" client/src/ --include="*.ts" --include="*.tsx" -l`

- [ ] **Step 2: Update any filter/display code**

Replace `source.thematic` or `s.thematic` with `source.tags` / `s.tags` (now an array). Update any filter UI that used a single thematic dropdown to handle multi-tag filtering.

- [ ] **Step 3: Verify frontend builds**

Run: `cd /c/dev/worldmonitor && npx vite build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/
git commit -m "refactor(rss-catalog): frontend thematic→tags migration"
```
