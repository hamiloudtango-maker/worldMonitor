import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class FieldDef(BaseModel):
    name: str
    path: str
    type: Literal["string", "number", "date_ms", "date_iso", "geo_lat", "geo_lon", "url"]


class PanelConfig(BaseModel):
    title: str
    display: Literal["feed", "table", "metric_cards", "chart", "map_markers"]
    columns: list[str] = []
    sort_field: str | None = None
    sort_order: Literal["asc", "desc"] | None = None


class AuthConfig(BaseModel):
    type: Literal["none", "api_key_header", "api_key_query", "bearer", "oauth2_client"]
    header_name: str | None = None
    query_param: str | None = None
    token_url: str | None = None
    secret_ref: str | None = None  # key into org_secrets table


class ValidationResult(BaseModel):
    last_validated_at: datetime
    row_count: int
    sample_row: dict | None = None
    errors: list[str] = []


class SourceTemplate(BaseModel):
    source_id: str
    source_type: Literal["rss", "json_api"]
    category: str
    url: str
    refresh_seconds: int = 300
    enabled: bool = True
    namespaces: dict[str, str] | None = None
    auth: AuthConfig | None = None
    fields: list[FieldDef]
    panel: PanelConfig
    validation: ValidationResult | None = None
    user_title: str | None = None


# --- API request/response models ---

class DetectRequest(BaseModel):
    url: str
    auth: AuthConfig | None = None


class DetectResponse(BaseModel):
    template: SourceTemplate


class ValidateRequest(BaseModel):
    template: SourceTemplate


class ValidateResponse(BaseModel):
    valid: bool
    row_count: int
    sample_row: dict | None = None
    errors: list[str] = []


class TemplateCreateRequest(BaseModel):
    template: SourceTemplate


class TemplateResponse(BaseModel):
    id: uuid.UUID
    template: SourceTemplate
    created_at: datetime


class DataResponse(BaseModel):
    source_id: str
    rows: list[dict]
    row_count: int
    fetched_at: datetime
    cached: bool = False


# Type alias for parsed rows
ParsedRow = dict[str, str | int | float | None]
