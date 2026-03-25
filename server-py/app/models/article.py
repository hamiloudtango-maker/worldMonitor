import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)  # SHA256 of link
    source_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    title_translated: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str] = mapped_column(Text, nullable=False)
    pub_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lang: Mapped[str] = mapped_column(String(5), nullable=False, default="en")

    # Classification (keyword + LLM)
    threat_level: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    theme: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    # NER entities (JSON string: ["Putin", "NATO", "Ukraine"])
    entities_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Country codes (JSON string: ["UA", "RU"])
    country_codes_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_articles_pub_date", "pub_date"),
        Index("ix_articles_source_theme", "source_id", "theme"),
    )
