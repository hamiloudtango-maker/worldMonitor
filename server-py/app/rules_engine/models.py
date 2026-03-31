import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(nullable=False)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Conditions: recursive boolean tree (JSON)
    # {"operator": "AND", "children": [{"type":"condition","field":"threat_level","op":"gte","value":"high"}, ...]}
    conditions_json: Mapped[str] = mapped_column(Text, nullable=False)

    # Actions: ordered list (JSON)
    # [{"type":"add_tag","params":{"tag":"urgent"}}, {"type":"notify","params":{"title":"..."}}]
    actions_json: Mapped[str] = mapped_column(Text, nullable=False)

    # Scope: global | feed | case
    scope: Mapped[str] = mapped_column(String(10), nullable=False, default="global")
    scope_target_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)

    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    short_circuit: Mapped[bool] = mapped_column(Boolean, default=False)

    # Schedule: {"type": "always"} | {"type": "window", "start": "08:00", ...}
    schedule_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Stats
    match_count: Mapped[int] = mapped_column(Integer, default=0)
    last_matched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_rules_org_enabled", "org_id", "enabled"),
        Index("ix_rules_scope", "scope", "scope_target_id"),
    )


class RuleExecutionLog(Base):
    __tablename__ = "rule_execution_log"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    rule_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    article_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    matched: Mapped[bool] = mapped_column(Boolean, nullable=False)
    actions_executed: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluation_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
