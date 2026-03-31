"""Spotlights — auto-colored keywords in article text (like Inoreader Spotlights)."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Spotlight(Base):
    __tablename__ = "spotlights"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)

    # Group of keywords with a shared color
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    keywords: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # ["nuclear", "nucléaire", "atom"]
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#ef4444")  # hex color
    enabled: Mapped[bool] = mapped_column(default=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
