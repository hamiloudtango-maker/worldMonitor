import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.plugins.models import PluginInstance
from app.plugins.registry import plugin_registry

logger = logging.getLogger(__name__)

CIRCUIT_BREAKER_THRESHOLD = 10
ERROR_BACKOFF_HOURS = 1
BATCH_SIZE = 20


async def run_plugin_ingest_cycle(db_session_factory, priority: str | None = None) -> int:
    async with db_session_factory() as db:
        stmt = select(PluginInstance).where(
            PluginInstance.active == True,
            PluginInstance.auto_disabled == False,
        )
        if priority:
            stmt = stmt.where(PluginInstance.priority == priority)
        result = await db.execute(stmt)
        instances = result.scalars().all()

    now = datetime.now(timezone.utc)
    eligible = []
    for inst in instances:
        if inst.consecutive_errors >= CIRCUIT_BREAKER_THRESHOLD:
            if inst.last_error_at and (now - inst.last_error_at) < timedelta(hours=ERROR_BACKOFF_HOURS):
                continue
        if inst.last_fetched_at:
            elapsed = (now - inst.last_fetched_at).total_seconds()
            if elapsed < inst.refresh_seconds:
                continue
        plugin = plugin_registry.get_plugin(inst.plugin_type)
        if plugin is None:
            continue
        eligible.append((inst, plugin))

    if not eligible:
        return 0

    all_feed_rows: list[tuple[str, list[dict]]] = []
    instance_updates: list[tuple] = []

    for batch_start in range(0, len(eligible), BATCH_SIZE):
        batch = eligible[batch_start : batch_start + BATCH_SIZE]
        tasks = [_fetch_one(inst, plugin) for inst, plugin in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for (inst, _), res in zip(batch, results):
            if isinstance(res, Exception):
                instance_updates.append((inst.id, False, str(res)[:500], 0, 0))
                continue
            success, rows, duration_ms, error_msg = res
            instance_updates.append((inst.id, success, error_msg, duration_ms, len(rows) if rows else 0))
            if success and rows:
                all_feed_rows.append((inst.source_id, rows))

    total_inserted = 0
    if all_feed_rows:
        from app.source_engine.article_pipeline import dedup_and_prepare_bulk, enrich_and_store

        async with db_session_factory() as db:
            prepared = await dedup_and_prepare_bulk(db, all_feed_rows)
            if prepared:
                total_inserted = await enrich_and_store(db, prepared)

    async with db_session_factory() as db:
        for inst_id, success, error_msg, duration_ms, item_count in instance_updates:
            if success:
                await db.execute(
                    update(PluginInstance)
                    .where(PluginInstance.id == inst_id)
                    .values(
                        last_fetched_at=now,
                        last_fetch_duration_ms=duration_ms,
                        last_item_count=item_count,
                        total_items_fetched=PluginInstance.total_items_fetched + item_count,
                        consecutive_errors=0,
                        last_error=None,
                    )
                )
            else:
                await db.execute(
                    update(PluginInstance)
                    .where(PluginInstance.id == inst_id)
                    .values(
                        last_fetched_at=now,
                        consecutive_errors=PluginInstance.consecutive_errors + 1,
                        last_error=error_msg,
                        last_error_at=now,
                        auto_disabled=PluginInstance.consecutive_errors + 1 >= CIRCUIT_BREAKER_THRESHOLD,
                    )
                )
        await db.commit()

    return total_inserted


async def _fetch_one(inst, plugin) -> tuple[bool, list | None, int, str | None]:
    start = time.monotonic()
    try:
        rows = await plugin.fetch(inst.config)
        duration_ms = int((time.monotonic() - start) * 1000)
        return True, rows, duration_ms, None
    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        return False, None, duration_ms, str(e)[:500]
