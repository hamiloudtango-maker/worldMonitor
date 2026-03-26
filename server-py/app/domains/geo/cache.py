"""
GeoJSON file cache with freshness metadata.
Each layer is cached as a JSON file in data/geo-cache/.
"""

import json
import time
from pathlib import Path
from datetime import datetime, timezone

CACHE_DIR = Path(__file__).resolve().parents[3] / "data" / "geo-cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _path(layer_id: str) -> Path:
    return CACHE_DIR / f"{layer_id}.json"


def read(layer_id: str) -> dict | None:
    p = _path(layer_id)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def write(layer_id: str, features: list[dict], meta: dict) -> dict:
    """Write features + metadata to cache. Returns the full envelope."""
    envelope = {
        "id": layer_id,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "feature_count": len(features),
        **meta,
        "features": features,
    }
    _path(layer_id).write_text(json.dumps(envelope, ensure_ascii=False), encoding="utf-8")
    return envelope


def is_fresh(layer_id: str, ttl_hours: float) -> bool:
    cached = read(layer_id)
    if not cached or "fetched_at" not in cached:
        return False
    try:
        fetched = datetime.fromisoformat(cached["fetched_at"])
        age_hours = (datetime.now(timezone.utc) - fetched).total_seconds() / 3600
        return age_hours < ttl_hours
    except Exception:
        return False


def age_hours(layer_id: str) -> float | None:
    cached = read(layer_id)
    if not cached or "fetched_at" not in cached:
        return None
    try:
        fetched = datetime.fromisoformat(cached["fetched_at"])
        return (datetime.now(timezone.utc) - fetched).total_seconds() / 3600
    except Exception:
        return None
