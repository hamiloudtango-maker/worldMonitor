from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class PluginMeta:
    name: str
    display_name: str
    description: str
    version: str
    author: str = "WorldMonitor"
    icon: str = "rss"
    config_schema: dict = field(default_factory=dict)
    dependencies: list[str] = field(default_factory=list)
    supports_batch: bool = False
    default_refresh_seconds: int = 900


class SourcePlugin(ABC):
    @classmethod
    @abstractmethod
    def meta(cls) -> PluginMeta: ...

    @abstractmethod
    async def validate_config(self, config: dict[str, Any]) -> list[str]: ...

    @abstractmethod
    async def fetch(self, config: dict[str, Any]) -> list[dict]: ...

    async def test_connection(self, config: dict[str, Any]) -> dict[str, Any]:
        errors = await self.validate_config(config)
        if errors:
            return {"ok": False, "errors": errors}
        try:
            rows = await self.fetch(config)
            return {
                "ok": True,
                "item_count": len(rows),
                "sample_title": rows[0]["title"] if rows else None,
            }
        except Exception as e:
            return {"ok": False, "errors": [str(e)]}
