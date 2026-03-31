from __future__ import annotations

from dataclasses import dataclass, field
from typing import Type

from app.plugins.base import PluginMeta, SourcePlugin


@dataclass
class PluginRegistry:
    _types: dict[str, Type[SourcePlugin]] = field(default_factory=dict)
    _instances: dict[str, SourcePlugin] = field(default_factory=dict)

    def register_type(self, name: str, cls: Type[SourcePlugin]) -> None:
        self._types[name] = cls
        self._instances[name] = cls()

    def get_plugin(self, name: str) -> SourcePlugin | None:
        return self._instances.get(name)

    def list_types(self) -> list[PluginMeta]:
        return [cls.meta() for cls in self._types.values()]

    def has_type(self, name: str) -> bool:
        return name in self._types

    @property
    def type_count(self) -> int:
        return len(self._types)


plugin_registry = PluginRegistry()
