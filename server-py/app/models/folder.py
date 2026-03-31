"""Folders — organize sources into thematic groups like Inoreader."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    # Source IDs in this folder (from rss_catalog or plugin_instances)
    source_ids: Mapped[list] = mapped_column(JSON, default=list)

    # Unread tracking
    unread_count: Mapped[int] = mapped_column(Integer, default=0)
    unread_retention_days: Mapped[int] = mapped_column(Integer, default=30)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
