import uuid
from datetime import datetime

from pydantic import BaseModel


class PanelPosition(BaseModel):
    x: int = 0
    y: int = 0
    w: int = 4
    h: int = 3


class DashboardPanelCreate(BaseModel):
    template_id: uuid.UUID | None = None
    panel_type: str  # "dynamic_source" | "hardcoded"
    hardcoded_key: str | None = None
    config: dict = {}
    position: PanelPosition


class DashboardPanelUpdate(BaseModel):
    config: dict | None = None
    position: PanelPosition | None = None


class DashboardPanelResponse(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID | None
    panel_type: str
    hardcoded_key: str | None
    config: dict
    position: dict
    created_at: datetime


class DashboardCreate(BaseModel):
    name: str


class DashboardUpdate(BaseModel):
    name: str | None = None
    is_public: bool | None = None
    is_default: bool | None = None
    layout: list[dict] | None = None  # [{id, x, y, w, h}] from Gridstack


class DashboardResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    is_default: bool
    is_public: bool
    layout: list[dict]
    panels: list[DashboardPanelResponse]
    created_at: datetime
    updated_at: datetime


class DashboardListItem(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    is_default: bool
    is_public: bool
    panel_count: int
    updated_at: datetime
