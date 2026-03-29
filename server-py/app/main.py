from contextlib import asynccontextmanager
from importlib import import_module

from fastapi import FastAPI

from app.config import settings
from app.gateway import setup_middleware

# Every module here must export a `router` attribute
ROUTERS = [
    # Geo layers (unified)
    "app.domains.geo.router",
    # Core
    "app.auth.router",
    "app.source_engine.router",
    "app.dashboards.router",
    # Jobs (background task tracking)
    "app.domains.jobs.router",
    # Article intelligence pipeline
    "app.domains.articles.router",
    # Domains with live implementations
    "app.domains.seismology.router",
    "app.domains.radiation.router",
    "app.domains.wildfire.router",
    "app.domains.natural.router",
    "app.domains.climate.router",
    "app.domains.cyber.router",
    "app.domains.prediction.router",
    "app.domains.imagery.router",
    "app.domains.displacement.router",
    "app.domains.maritime.router",
    "app.domains.conflict.router",
    "app.domains.news.router",
    "app.domains.research.router",
    "app.domains.supply_chain.router",
    "app.domains.aviation.router",
    "app.domains.trade.router",
    "app.domains.infrastructure.router",
    "app.domains.economic.router",
    "app.domains.market.router",
    # Case intelligence
    "app.domains.cases.router",
    # AI Feeds
    "app.domains.ai_feeds.router",
]


_db_ready = None  # asyncio.Event — set after lifespan init completes


async def _auto_ingest_catalog():
    """Background task: ingest all RSS catalog sources every 10 min.
    On startup, checks if data is stale (>1h) and ingests immediately if so."""
    import asyncio
    import logging
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select, func
    from app.db import async_session
    from app.models.ai_feed import RssCatalogEntry
    from app.source_engine.catalog_ingest import ingest_full_catalog

    logger = logging.getLogger("catalog-ingest")
    await _db_ready.wait()  # wait for DB init + seed to complete

    # Check if data is stale (>1h since last fetch)
    try:
        async with async_session() as db:
            last = await db.scalar(select(func.max(RssCatalogEntry.last_fetched_at)))
            if last is not None:
                if isinstance(last, str):
                    from datetime import datetime as dt
                    last = dt.fromisoformat(last)
                if last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                age = datetime.now(timezone.utc) - last
                if age < timedelta(hours=1):
                    wait = int((timedelta(minutes=10) - (age % timedelta(minutes=10))).total_seconds())
                    print(f"[INGEST] Data is fresh ({age.total_seconds()/60:.0f}min old), next cycle in {wait}s")
                    await asyncio.sleep(wait)
                else:
                    print(f"[INGEST] Data is stale ({age.total_seconds()/3600:.1f}h old), ingesting now")
    except Exception:
        pass  # If check fails, just start normally

    from app.domains.jobs.helpers import start_job, finish_job

    while True:
        job_id = await start_job("catalog_ingest")
        try:
            async with async_session() as db:
                await ingest_full_catalog(db, db_session_factory=async_session)
            await finish_job(job_id)
        except Exception as e:
            await finish_job(job_id, error=str(e)[:500])
            try:
                print(f"[INGEST] Cycle failed: {e}")
            except Exception:
                pass  # UnicodeEncodeError on Windows terminal

        await asyncio.sleep(10 * 60)  # every 10 min


async def _auto_refresh_cases():
    """Background task: refresh all active cases every 4 hours.
    Aggregates Google News + GDELT + relevant RSS catalog feeds. Dedup via SHA256(link)."""
    import asyncio
    import logging
    from sqlalchemy import select
    from app.db import async_session
    from app.models.case import Case
    from app.source_engine.google_news import fetch_google_news
    from app.source_engine.gdelt import fetch_gdelt
    from app.source_engine.article_pipeline import ingest_articles

    logger = logging.getLogger("case-refresh")
    await _db_ready.wait()  # wait for DB init + seed to complete
    await asyncio.sleep(30)  # small grace period for first catalog ingest

    from app.domains.jobs.helpers import start_job, finish_job

    while True:
        job_id = await start_job("case_refresh")
        try:
            async with async_session() as db:
                cases = (await db.scalars(select(Case).where(Case.status == "active"))).all()
                for case in cases:
                    source_id = f"case_{case.name.lower().replace(' ', '_')}"
                    all_rows = []

                    # 1) Google News (primary)
                    try:
                        gnews = await fetch_google_news(
                            query=case.name, theme="", country="", lang="en", max_items=100,
                        )
                        all_rows.extend(gnews)
                    except Exception as e:
                        logger.warning(f"GNews '{case.name}': {e}")

                    await asyncio.sleep(1)

                    # 2) GDELT (complementary — broader coverage, 3-day window)
                    try:
                        gdelt = await fetch_gdelt(
                            query=case.name, theme=case.type or "", max_records=100,
                        )
                        all_rows.extend(gdelt)
                    except Exception as e:
                        logger.warning(f"GDELT '{case.name}': {e}")

                    # 3) Ingest all — dedup is handled by SHA256(link) in pipeline
                    if all_rows:
                        try:
                            inserted = await ingest_articles(db, source_id, all_rows)
                            if inserted:
                                logger.info(f"Case '{case.name}': {inserted} new articles ({len(all_rows)} fetched)")
                        except Exception as e:
                            logger.warning(f"Case ingest '{case.name}': {e}")

                    await asyncio.sleep(2)  # rate limit between cases
            await finish_job(job_id)
        except Exception as e:
            await finish_job(job_id, error=str(e)[:500])
            logger.warning(f"Case auto-refresh cycle failed: {e}")

        await asyncio.sleep(4 * 3600)  # every 4 hours


async def _auto_analyze_categories():
    """Background task: analyze article categories weekly."""
    import asyncio
    import logging
    from app.db import async_session
    from app.source_engine.category_analyzer import run_weekly_analysis

    logger = logging.getLogger("category-analyzer")
    await _db_ready.wait()  # wait for DB init + seed to complete
    await asyncio.sleep(5 * 60)  # wait 5min for initial ingestion

    from app.domains.jobs.helpers import start_job, finish_job

    while True:
        job_id = await start_job("category_analysis")
        try:
            async with async_session() as db:
                result = await run_weekly_analysis(db)
                logger.info(f"Category analysis: {result['total_articles']} articles, {len(result['categories'])} categories")
            await finish_job(job_id)
        except Exception as e:
            await finish_job(job_id, error=str(e)[:500])
            logger.warning(f"Category analysis failed: {e}")

        await asyncio.sleep(7 * 24 * 3600)  # every 7 days


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.database_url.startswith("sqlite"):
        from app.db import create_all_tables
        import app.models.intel_model  # noqa: F401 — register model before create_all
        import app.models.intel_category  # noqa: F401
        import app.models.article_model  # noqa: F401
        import app.models.job  # noqa: F401 — register model before create_all

        await create_all_tables()

    # Seed RSS catalog + Intel Models on boot
    from app.db import async_session
    from app.domains.ai_feeds.seed import seed_catalog
    from app.domains.ai_feeds.intel_models_seed import seed_intel_models
    import logging
    _log = logging.getLogger(__name__)
    async with async_session() as db:
        count = await seed_catalog(db)
        if count:
            _log.info(f"Seeded {count} RSS catalog entries")
        im_count = await seed_intel_models(db)
        if im_count:
            _log.info(f"Seeded {im_count} intel models")

    # Seed intel categories (family/section) from existing models
    from sqlalchemy import select
    from app.models.intel_category import IntelCategory
    from app.models.intel_model import IntelModel
    async with async_session() as db:
        existing = (await db.scalars(select(IntelCategory))).all()
        if not existing:
            models = (await db.scalars(select(IntelModel))).all()
            fams: set[str] = set()
            secs: set[tuple[str, str]] = set()
            for m in models:
                fams.add(m.family)
                secs.add((m.family, m.section))
            fam_labels = {
                "market": "Market Intelligence", "threat": "Threat Intelligence",
                "risk": "Risk Intelligence", "foundation": "Foundation",
                "biopharma": "Biopharma Research", "geopolitical": "Geopolitical", "mute": "Mute Filters",
            }
            for f in fams:
                db.add(IntelCategory(level="family", key=f, label=fam_labels.get(f, f), aliases=[]))
            for f, s in secs:
                db.add(IntelCategory(level="section", key=s, parent_key=f, label=s, aliases=[]))
            await db.commit()
            _log.info(f"Seeded {len(fams)} family + {len(secs)} section categories")

    # Run initial category analysis on boot (uses cached data, fast)
    from app.source_engine.category_analyzer import run_weekly_analysis, get_cached_analysis
    if not get_cached_analysis():
        async with async_session() as db:
            await run_weekly_analysis(db)

    # Cases use article_models now — no more case_articles LIKE refresh at boot

    # Pre-load matching engine (RapidFuzz + MiniLM) with Intel Models
    from app.source_engine.matching_engine import load_models
    from app.models.intel_model import IntelModel as _IM
    async with async_session() as db:
        _all_models = (await db.scalars(select(_IM))).all()
        load_models(_all_models)

    # Signal background tasks that DB is ready
    import asyncio
    global _db_ready
    _db_ready = asyncio.Event()
    _db_ready.set()

    # Start background ingestion tasks
    catalog_task = asyncio.create_task(_auto_ingest_catalog())
    refresh_task = asyncio.create_task(_auto_refresh_cases())
    category_task = asyncio.create_task(_auto_analyze_categories())

    yield

    catalog_task.cancel()
    refresh_task.cancel()
    category_task.cancel()
    from app.source_engine.scheduler import shutdown
    await shutdown()


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)
setup_middleware(app)

for module_path in ROUTERS:
    try:
        app.include_router(import_module(module_path).router, prefix="/api")
    except Exception as e:
        print(f"[WARN] Failed to load router {module_path}: {e}")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
