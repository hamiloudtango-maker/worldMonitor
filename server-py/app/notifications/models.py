import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    org_id: Mapped[uuid.UUID] = mapped_column(nullable=False)

    # Type: alert | rule | case | feed | system | digest
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="alert")
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Optional references
    article_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    rule_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)

    # State
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    starred: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_notif_user_read", "user_id", "read"),
        Index("ix_notif_user_created", "user_id", "created_at"),
    )


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(nullable=False, unique=True)

    # Channels enabled
    in_app: Mapped[bool] = mapped_column(Boolean, default=True)
    browser_push: Mapped[bool] = mapped_column(Boolean, default=False)
    webhook_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Type filters (JSON list of types to receive, null = all)
    type_filters: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Quiet hours
    quiet_start: Mapped[str | None] = mapped_column(String(5), nullable=True)  # HH:MM
    quiet_end: Mapped[str | None] = mapped_column(String(5), nullable=True)
    quiet_timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Per-case/feed overrides: {case_id: {min_threat: "high"}, ...}
    case_overrides: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    feed_overrides: Mapped[dict | None] = mapped_column(JSON, nullable=True)
