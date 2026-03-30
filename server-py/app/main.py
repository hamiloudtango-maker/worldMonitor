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


async def _auto_ingest_by_priority(priority: str, interval_min: int):
    """Background task: ingest RSS sources of a given priority at a fixed interval."""
    import asyncio
    import logging
    from app.db import async_session
    from app.source_engine.catalog_ingest import ingest_full_catalog
    from app.domains.jobs.helpers import start_job, finish_job

    logger = logging.getLogger(f"ingest-{priority}")
    await _db_ready.wait()

    # Stagger start: high=0s, medium=30s, low=60s
    stagger = {"high": 0, "medium": 30, "low": 60}
    await asyncio.sleep(stagger.get(priority, 0))

    while True:
        job_id = await start_job(f"catalog_ingest_{priority}")
        try:
            async with async_session() as db:
                n = await ingest_full_catalog(db, db_session_factory=async_session, priority=priority)
            logger.info(f"[{priority.upper()}] {n} new articles")
            await finish_job(job_id)
        except Exception as e:
            await finish_job(job_id, error=str(e)[:500])
            logger.warning(f"[{priority.upper()}] failed: {e}")

        await asyncio.sleep(interval_min * 60)


async def _auto_fetch_feeds_gnews():
    """Background task: fetch Google News for all active AI Feeds every 30 min."""
    import asyncio
    import logging
    from app.db import async_session
    from sqlalchemy import select

    logger = logging.getLogger("feeds-gnews")
    await _db_ready.wait()
    await asyncio.sleep(2 * 60)  # let startup + first RSS ingest settle

    while True:
        try:
            from app.models.ai_feed import AIFeed
            from app.source_engine.google_news import fetch_google_news
            from app.source_engine.article_pipeline import ingest_articles

            async with async_session() as db:
                feeds = (await db.scalars(
                    select(AIFeed).where(AIFeed.status != "archived")
                )).all()

                total = 0
                for feed in feeds:
                    try:
                        source_id = f"feed_{feed.name.lower().replace(' ', '_')}"
                        rows = await fetch_google_news(query=feed.name, theme="", country="", lang="en", max_items=30)
                        if rows:
                            n = await ingest_articles(db, source_id, rows)
                            total += n
                    except Exception:
                        pass
                    await asyncio.sleep(10)  # rate limit between feeds

                if total:
                    await db.commit()
                    logger.info(f"Google News: {total} new articles across {len(feeds)} feeds")
        except Exception as e:
            logger.warning(f"Feeds Google News failed: {e}")

        await asyncio.sleep(30 * 60)  # every 30 min


async def _auto_recompute_priorities():
    """Recompute source priorities every 6 hours based on usage stats."""
    import asyncio
    import logging
    from app.db import async_session
    from app.source_engine.source_scorer import recompute_priorities

    logger = logging.getLogger("priority-scorer")
    await _db_ready.wait()
    await asyncio.sleep(10)  # let first ingest finish

    while True:
        try:
            async with async_session() as db:
                result = await recompute_priorities(db)
            logger.info(f"Priorities: {result}")
        except Exception as e:
            logger.warning(f"Priority recompute failed: {e}")

        await asyncio.sleep(6 * 3600)  # every 6 hours


async def _auto_classify_articles():
    """Background task: classify articles > 1 day with no family/section via FlashText.
    Runs continuously — processes batches of 500, sleeps 30s between batches.
    Stops when nothing left, then checks every 5 min for new unclassified articles."""
    import asyncio
    from app.db import async_session
    from app.source_engine.matching_engine import classify_unclassified_articles

    await _db_ready.wait()
    await asyncio.sleep(30)  # let ingestion start first

    while True:
        try:
            async with async_session() as db:
                n = await classify_unclassified_articles(db)
            if n > 0:
                await asyncio.sleep(5)  # more to do, short pause
            else:
                await asyncio.sleep(5 * 60)  # nothing left, check every 5 min
        except Exception:
            await asyncio.sleep(60)


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


async def _auto_purge_old_articles():
    """Background task: delete articles older than 7 days + their article_models rows."""
    import asyncio
    import logging
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import text, delete, select
    from app.db import async_session
    from app.models.article import Article
    from app.models.article_model import ArticleModel

    logger = logging.getLogger("article-purge")
    await _db_ready.wait()
    await asyncio.sleep(60)  # let startup settle

    while True:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=7)
            async with async_session() as db:
                # Find old article IDs
                old_ids = (await db.execute(
                    select(Article.id).where(Article.pub_date < cutoff)
                )).scalars().all()

                if old_ids:
                    # Delete article_models rows first (FK)
                    await db.execute(
                        delete(ArticleModel).where(ArticleModel.article_id.in_(old_ids))
                    )
                    # Delete articles
                    await db.execute(
                        delete(Article).where(Article.id.in_(old_ids))
                    )
                    await db.commit()
                    logger.info(f"Purged {len(old_ids)} articles older than 7 days")
                else:
                    logger.info("No articles to purge")
        except Exception as e:
            logger.warning(f"Article purge failed: {e}")

        await asyncio.sleep(6 * 3600)  # every 6 hours


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
    from app.domains.ai_feeds.intel_models_seed import seed_intel_models, migrate_existing_models
    import logging
    _log = logging.getLogger(__name__)
    async with async_session() as db:
        count = await seed_catalog(db)
        if count:
            _log.info(f"Seeded {count} RSS catalog entries")
        migrated = await migrate_existing_models(db)
        if migrated:
            _log.info(f"Migrated {migrated} intel models to new taxonomy")
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

    # Compute initial source priorities before starting ingest loops
    from app.source_engine.source_scorer import recompute_priorities
    async with async_session() as db:
        await recompute_priorities(db)

    # Signal background tasks that DB is ready
    import asyncio
    global _db_ready
    _db_ready = asyncio.Event()
    _db_ready.set()

    # Start background tasks — 3 priority-based ingest loops
    ingest_high   = asyncio.create_task(_auto_ingest_by_priority("high", 15))    # every 15 min
    ingest_medium = asyncio.create_task(_auto_ingest_by_priority("medium", 60))  # every 1h
    ingest_low    = asyncio.create_task(_auto_ingest_by_priority("low", 120))    # every 2h
    scorer_task   = asyncio.create_task(_auto_recompute_priorities())
    feeds_gnews   = asyncio.create_task(_auto_fetch_feeds_gnews())
    refresh_task  = asyncio.create_task(_auto_refresh_cases())
    category_task = asyncio.create_task(_auto_analyze_categories())
    classify_task = asyncio.create_task(_auto_classify_articles())
    purge_task    = asyncio.create_task(_auto_purge_old_articles())

    yield

    for t in [ingest_high, ingest_medium, ingest_low, scorer_task, feeds_gnews,
              refresh_task, category_task, classify_task, purge_task]:
        t.cancel()
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
