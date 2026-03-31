from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class PluginInstanceCreate(BaseModel):
    plugin_type: str
    name: str
    description: str | None = None
    config: dict[str, Any]
    refresh_seconds: int | None = None
    tags: list[str] | None = None
    lang: str | None = None
    country: str | None = None
    tier: int | None = None


class PluginInstanceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    config: dict[str, Any] | None = None
    active: bool | None = None
    priority: str | None = None
    refresh_seconds: int | None = None
    tags: list[str] | None = None


class PluginTypeResponse(BaseModel):
    name: str
    display_name: str
    description: str
    version: str
    icon: str
    config_schema: dict[str, Any]
    default_refresh_seconds: int


class PluginInstanceResponse(BaseModel):
    id: str
    plugin_type: str
    name: str
    description: str | None
    active: bool
    priority: str
    source_id: str
    refresh_seconds: int
    last_fetched_at: datetime | None
    last_item_count: int
    total_items_fetched: int
    consecutive_errors: int
    last_error: str | None
    auto_disabled: bool
    tags: list[str] | None
    created_at: datetime

    class Config:
        from_attributes = True


class PluginTestResult(BaseModel):
    ok: bool
    item_count: int | None = None
    sample_title: str | None = None
    errors: list[str] = []
