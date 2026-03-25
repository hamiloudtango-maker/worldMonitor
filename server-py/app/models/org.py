import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Org(Base):
    __tablename__ = "orgs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    users: Mapped[list["User"]] = relationship(back_populates="org")  # noqa: F821
    templates: Mapped[list["SourceTemplate"]] = relationship(back_populates="org")  # noqa: F821
    dashboards: Mapped[list["Dashboard"]] = relationship(back_populates="org")  # noqa: F821
    secrets: Mapped[list["OrgSecret"]] = relationship(back_populates="org")  # noqa: F821
