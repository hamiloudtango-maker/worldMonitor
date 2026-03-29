import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    search_keywords: Mapped[str | None] = mapped_column(String(500), nullable=True)
    query_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # Feed-style query JSON
    identity_card: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    board: Mapped["CaseBoard | None"] = relationship(
        back_populates="case", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_cases_org_id", "org_id"),
        Index("ix_cases_org_status", "org_id", "status"),
    )


class CaseBoard(Base):
    __tablename__ = "case_boards"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cases.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    layout: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    case: Mapped["Case"] = relationship(back_populates="board")


class CaseArticle(Base):
    """Junction table: pre-computed mapping of which articles match which cases.

    Populated at ingestion time and when a case query changes.
    Turns O(articles × aliases) LIKE scans into O(1) indexed JOINs at read time.
    """
    __tablename__ = "case_articles"

    case_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )

    __table_args__ = (
        Index("ix_case_articles_case", "case_id"),
        Index("ix_case_articles_article", "article_id"),
    )
