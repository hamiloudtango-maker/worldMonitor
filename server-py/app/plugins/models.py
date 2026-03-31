import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PluginInstance(Base):
    __tablename__ = "plugin_instances"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    plugin_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Scheduling
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    priority_score: Mapped[int] = mapped_column(Integer, default=0)
    refresh_seconds: Mapped[int] = mapped_column(Integer, default=900)

    # Fetch tracking
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_fetch_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_item_count: Mapped[int] = mapped_column(Integer, default=0)
    total_items_fetched: Mapped[int] = mapped_column(Integer, default=0)

    # Error tracking
    consecutive_errors: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_error_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    auto_disabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Classification
    tags: Mapped[list | None] = mapped_column(JSON, default=list)
    lang: Mapped[str | None] = mapped_column(String(5), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tier: Mapped[int] = mapped_column(Integer, default=3)

    # Usage
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    last_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Source ID for articles table
    source_id: Mapped[str] = mapped_column(String(150), nullable=False, unique=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_plugin_type_active", "plugin_type", "active"),
    )
