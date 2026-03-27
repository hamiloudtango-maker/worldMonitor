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


@asynccontextmanager
async def lifespan(app: FastAPI):
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

    # Start background ingestion tasks
    import asyncio
    catalog_task = asyncio.create_task(_auto_ingest_catalog())
    refresh_task = asyncio.create_task(_auto_refresh_cases())

    yield

    catalog_task.cancel()
    refresh_task.cancel()
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
