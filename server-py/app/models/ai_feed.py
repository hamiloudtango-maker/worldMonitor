import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class AIFeed(Base):
    __tablename__ = "ai_feeds"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    query: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    ai_config: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="active")
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    sources: Mapped[list["AIFeedSource"]] = relationship(
        back_populates="feed", cascade="all, delete-orphan"
    )
    results: Mapped[list["AIFeedResult"]] = relationship(
        back_populates="feed", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_ai_feeds_org_id", "org_id"),
        Index("ix_ai_feeds_org_status", "org_id", "status"),
    )


class AIFeedSource(Base):
    __tablename__ = "ai_feed_sources"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ai_feed_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai_feeds.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    lang: Mapped[str | None] = mapped_column(String(5), nullable=True)
    tier: Mapped[int] = mapped_column(Integer, default=3)
    source_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    continent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    origin: Mapped[str] = mapped_column(String(20), nullable=False, default="catalog")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    feed: Mapped["AIFeed"] = relationship(back_populates="sources")

    __table_args__ = (Index("ix_ai_feed_sources_feed_id", "ai_feed_id"),)


class AIFeedResult(Base):
    __tablename__ = "ai_feed_results"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ai_feed_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai_feeds.id", ondelete="CASCADE"), nullable=False
    )
    article_url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source_name: Mapped[str] = mapped_column(String(200), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    entities: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    threat_level: Mapped[str | None] = mapped_column(String(10), nullable=True)
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    feed: Mapped["AIFeed"] = relationship(back_populates="results")

    __table_args__ = (
        Index("ix_ai_feed_results_feed_id", "ai_feed_id"),
        Index("ix_ai_feed_results_published", "ai_feed_id", "published_at"),
    )


class RssCatalogEntry(Base):
    """Global RSS source catalog — single source of truth for all feeds."""
    __tablename__ = "rss_catalog"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    lang: Mapped[str | None] = mapped_column(String(5), nullable=True)
    tier: Mapped[int] = mapped_column(Integer, default=3)
    source_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    continent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, default=list)
    origin: Mapped[str] = mapped_column(String(20), nullable=False, default="builtin")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fetch_error_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
