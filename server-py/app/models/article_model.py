"""Junction table: pre-computed mapping of articles to Intel Models.
Populated at ingestion via SET + MiniLM matching on LLM-extracted metadata."""

import uuid
from sqlalchemy import ForeignKey, Index, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class ArticleModel(Base):
    __tablename__ = "article_models"

    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )
    model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("intel_models.id", ondelete="CASCADE"), primary_key=True
    )
    score: Mapped[float] = mapped_column(Float, default=0.0)  # cosine sim or 1.0 for SET match
    method: Mapped[str] = mapped_column(default="set")  # "set" or "embed"

    __table_args__ = (
        Index("ix_article_models_model", "model_id"),
        Index("ix_article_models_article", "article_id"),
    )
