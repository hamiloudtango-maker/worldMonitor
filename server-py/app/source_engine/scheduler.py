"""
Source refresh scheduler — asyncio tasks that periodically fetch and cache source data.
Each active source gets its own task, staggered to avoid thundering herd.
"""

import asyncio
import logging
import random
from datetime import datetime, timezone

import httpx

from app.source_engine.cache import source_cache
from app.source_engine.circuit_breaker import breaker_registry
from app.source_engine.parser import parse_with_template
from app.source_engine.schemas import SourceTemplate
from app.source_engine.source_auth import apply_auth_headers

logger = logging.getLogger(__name__)

# Active tasks: source_id → asyncio.Task
_tasks: dict[str, asyncio.Task] = {}

# Registered templates: source_id → (template, secrets)
_templates: dict[str, tuple[SourceTemplate, dict[str, str]]] = {}


async def _fetch_and_cache(template: SourceTemplate, secrets: dict[str, str]) -> None:
    """Fetch source, parse, and update cache."""
    headers = {"User-Agent": "WorldMonitor/2.0", "Accept": "*/*"}
    params: dict[str, str] = {}

    apply_auth_headers(template.auth, secrets, headers, params)

    # Build final URL: preserve existing query params + add auth params
    url = template.url
    if params:
        sep = "&" if "?" in url else "?"
        url = url + sep + "&".join(f"{k}={v}" for k, v in params.items())

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        raw = resp.text

    rows = parse_with_template(raw, template)
    source_cache.set(template.source_id, rows, template.refresh_seconds)
    return rows


async def _refresh_loop(source_id: str) -> None:
    """Background loop for a single source."""
    # Stagger start: random delay 0-10s
    await asyncio.sleep(random.uniform(0, 10))

    while True:
        template, secrets = _templates.get(source_id, (None, None))
        if template is None:
            break  # Source was unregistered

        breaker = breaker_registry.get(source_id)

        if breaker.is_allowed:
            try:
                await _fetch_and_cache(template, secrets)
                breaker.record_success()
                logger.debug(f"Refreshed {source_id}")
            except Exception as e:
                breaker.record_failure()
                logger.warning(f"Failed to refresh {source_id}: {e}")
        else:
            logger.debug(f"Circuit open for {source_id}, skipping refresh")

        await asyncio.sleep(template.refresh_seconds)


def register_source(template: SourceTemplate, secrets: dict[str, str] | None = None) -> None:
    """Register a source for automatic refresh."""
    _templates[template.source_id] = (template, secrets or {})

    # Cancel existing task if any
    existing = _tasks.get(template.source_id)
    if existing and not existing.done():
        existing.cancel()

    _tasks[template.source_id] = asyncio.create_task(
        _refresh_loop(template.source_id),
        name=f"refresh-{template.source_id}",
    )


def unregister_source(source_id: str) -> None:
    """Stop refreshing a source."""
    _templates.pop(source_id, None)
    task = _tasks.pop(source_id, None)
    if task and not task.done():
        task.cancel()
    source_cache.delete(source_id)
    breaker_registry.remove(source_id)


async def fetch_source_data(
    template: SourceTemplate, secrets: dict[str, str] | None = None
) -> tuple[list[dict], bool]:
    """
    Get data for a source. Returns (rows, cached).
    Uses cache if fresh, fetches if not.
    """
    # Check cache first
    cached = source_cache.get(template.source_id)
    if cached and cached.is_fresh:
        return cached.rows, True

    # Try fresh fetch
    breaker = breaker_registry.get(template.source_id)
    if breaker.is_allowed:
        try:
            rows = await _fetch_and_cache(template, secrets or {})
            breaker.record_success()
            return rows, False
        except Exception as e:
            breaker.record_failure()
            # Fall through to stale cache
            if cached and cached.is_stale:
                return cached.rows, True
            raise

    # Circuit open — serve stale if available
    if cached and cached.is_stale:
        return cached.rows, True

    raise RuntimeError(f"Circuit open for {template.source_id} and no cached data")


def get_active_sources() -> list[str]:
    """List of currently active source_ids."""
    return list(_templates.keys())


async def shutdown() -> None:
    """Cancel all refresh tasks."""
    for task in _tasks.values():
        task.cancel()
    _tasks.clear()
    _templates.clear()
