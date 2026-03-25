import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class SourceTemplate(Base):
    __tablename__ = "source_templates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orgs.id"), nullable=True)
    source_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)  # rss | json_api
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_seconds: Mapped[int] = mapped_column(Integer, default=300)
    auth_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    fields: Mapped[list] = mapped_column(JSON, nullable=False)
    panel_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    validation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_catalog: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    org: Mapped["Org | None"] = relationship(back_populates="templates")  # noqa: F821
