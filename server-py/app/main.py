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


async def _auto_ingest_catalog():
    """Background task: ingest all RSS catalog sources every 30 min."""
    import asyncio
    import logging
    from app.db import async_session
    from app.source_engine.catalog_ingest import ingest_full_catalog

    logger = logging.getLogger("catalog-ingest")
    await asyncio.sleep(10)  # wait for startup

    while True:
        try:
            async with async_session() as db:
                await ingest_full_catalog(db)
        except Exception as e:
            logger.warning(f"Catalog ingest cycle failed: {e}")

        await asyncio.sleep(30 * 60)  # every 30 min


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
    await asyncio.sleep(60)  # wait for catalog first pass

    while True:
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
        except Exception as e:
            logger.warning(f"Case auto-refresh cycle failed: {e}")

        await asyncio.sleep(4 * 3600)  # every 4 hours


async def _auto_analyze_categories():
    """Background task: analyze article categories weekly."""
    import asyncio
    import logging
    from app.db import async_session
    from app.source_engine.category_analyzer import run_weekly_analysis

    logger = logging.getLogger("category-analyzer")
    await asyncio.sleep(5 * 60)  # wait 5min for initial ingestion

    while True:
        try:
            async with async_session() as db:
                result = await run_weekly_analysis(db)
                logger.info(f"Category analysis: {result['total_articles']} articles, {len(result['categories'])} categories")
        except Exception as e:
            logger.warning(f"Category analysis failed: {e}")

        await asyncio.sleep(7 * 24 * 3600)  # every 7 days


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.database_url.startswith("sqlite"):
        from app.db import create_all_tables
        import app.models.intel_model  # noqa: F401 — register model before create_all

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

    # Run initial category analysis on boot (uses cached data, fast)
    from app.source_engine.category_analyzer import run_weekly_analysis, get_cached_analysis
    if not get_cached_analysis():
        async with async_session() as db:
            await run_weekly_analysis(db)

    # Start background ingestion tasks
    import asyncio
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
