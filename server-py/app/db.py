from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# SQLite needs connect_args for async
_connect_args = {}
_pool_class = None
if settings.database_url.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}
    # NullPool: each request gets its own connection.
    # With WAL mode, readers don't block writers and vice versa.
    # Default StaticPool uses 1 connection → background ingestion blocks all reads.
    _pool_class = NullPool

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args=_connect_args,
    **({"poolclass": _pool_class} if _pool_class else {}),
)

# Enable WAL mode for SQLite — allows concurrent reads during writes
if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with async_session() as session:
        yield session


async def create_all_tables() -> None:
    """Create all tables (for dev with SQLite). Use alembic for prod."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
