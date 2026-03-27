"""
Intelligence Model — predefined entity/concept with aliases for feed filtering.
Inspired by Feedly AI Models (Market Intelligence, Threat Intelligence, etc.)
Enriched weekly by LLM from article metadata.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class IntelModel(Base):
    __tablename__ = "intel_models"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    family: Mapped[str] = mapped_column(String(50), nullable=False)  # market, threat, risk, foundation
    section: Mapped[str] = mapped_column(String(100), nullable=False)  # Companies, Industries, Technologies, etc.
    aliases: Mapped[list | None] = mapped_column(JSON, default=list)
    origin: Mapped[str] = mapped_column(String(20), nullable=False, default="seed")  # seed, ai_enriched, manual
    article_count: Mapped[int] = mapped_column(Integer, default=0)  # updated weekly
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
