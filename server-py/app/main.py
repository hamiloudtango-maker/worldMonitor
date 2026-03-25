from contextlib import asynccontextmanager
from importlib import import_module

from fastapi import FastAPI

from app.config import settings
from app.gateway import setup_middleware

# Every module here must export a `router` attribute
ROUTERS = [
    # Core
    "app.auth.router",
    "app.source_engine.router",
    "app.dashboards.router",
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
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.database_url.startswith("sqlite"):
        from app.db import create_all_tables

        await create_all_tables()
    yield
    from app.source_engine.scheduler import shutdown

    await shutdown()


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)
setup_middleware(app)

for module_path in ROUTERS:
    app.include_router(import_module(module_path).router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
