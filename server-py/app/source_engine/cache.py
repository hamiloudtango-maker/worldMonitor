"""
Two-level cache for source data.
L1: in-memory dict (fast, per-process)
L2: Redis (survives restarts, shared across workers) — optional
"""

import time
from dataclasses import dataclass, field

from app.source_engine.schemas import ParsedRow


@dataclass
class CacheEntry:
    rows: list[ParsedRow]
    fetched_at: float
    ttl: float  # seconds

    @property
    def is_fresh(self) -> bool:
        return time.time() - self.fetched_at < self.ttl

    @property
    def is_stale(self) -> bool:
        """Stale but still usable (within 3x TTL)."""
        return time.time() - self.fetched_at < self.ttl * 3


@dataclass
class SourceCache:
    """In-memory L1 cache. L2 Redis integration added later."""

    _store: dict[str, CacheEntry] = field(default_factory=dict)

    def get(self, source_id: str) -> CacheEntry | None:
        entry = self._store.get(source_id)
        if entry is None:
            return None
        # Evict if even stale window expired
        if not entry.is_stale:
            del self._store[source_id]
            return None
        return entry

    def set(self, source_id: str, rows: list[ParsedRow], ttl: float) -> None:
        self._store[source_id] = CacheEntry(
            rows=rows,
            fetched_at=time.time(),
            ttl=ttl,
        )

    def delete(self, source_id: str) -> None:
        self._store.pop(source_id, None)

    def clear(self) -> None:
        self._store.clear()

    @property
    def size(self) -> int:
        return len(self._store)


# Global singleton
source_cache = SourceCache()
