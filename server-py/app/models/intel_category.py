"""Intel Category — stores aliases for families and sections (levels 1 & 2 of the Intel tree)."""

import uuid
from sqlalchemy import JSON, String, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class IntelCategory(Base):
    __tablename__ = "intel_categories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    level: Mapped[str] = mapped_column(String(10), nullable=False)  # 'family' or 'section'
    key: Mapped[str] = mapped_column(String(100), nullable=False)   # e.g. 'market' or 'Strategic Moves'
    parent_key: Mapped[str | None] = mapped_column(String(100), nullable=True)  # family key for sections
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    aliases: Mapped[list | None] = mapped_column(JSON, default=list)

    __table_args__ = (
        Index("ix_intel_cat_unique", "level", "key", "parent_key", unique=True),
    )
