"""UserArticleState — per-user article state (read, starred, read_later, annotations)."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class UserArticleState(Base):
    __tablename__ = "user_article_states"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    article_id: Mapped[uuid.UUID] = mapped_column(nullable=False)

    read: Mapped[bool] = mapped_column(Boolean, default=False)
    starred: Mapped[bool] = mapped_column(Boolean, default=False)
    read_later: Mapped[bool] = mapped_column(Boolean, default=False)

    # Annotations (JSON list of {text, note, color, position})
    annotations_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    starred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_uas_user_article", "user_id", "article_id", unique=True),
        Index("ix_uas_user_starred", "user_id", "starred"),
        Index("ix_uas_user_readlater", "user_id", "read_later"),
    )
