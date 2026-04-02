"""
Automated reports — scheduled recurring summaries of articles.
Like Inoreader: create and schedule auto-generated reports per folder/case/feed.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AutoReport(Base):
    __tablename__ = "auto_reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(nullable=False)

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Scope: folder, case, feed, or "all"
    scope_type: Mapped[str] = mapped_column(String(20), nullable=False, default="all")
    scope_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Schedule: daily, weekly
    frequency: Mapped[str] = mapped_column(String(20), nullable=False, default="daily")

    # Output format: markdown, html
    format: Mapped[str] = mapped_column(String(20), nullable=False, default="markdown")

    # Custom LLM prompt template
    template_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_content: Mapped[str | None] = mapped_column(Text, nullable=True)  # cached last report
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
