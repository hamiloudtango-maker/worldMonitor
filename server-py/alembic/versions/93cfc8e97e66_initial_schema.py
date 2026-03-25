"""initial_schema

Revision ID: 93cfc8e97e66
Revises:
Create Date: 2026-03-25 11:00:04.695697

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "93cfc8e97e66"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "orgs",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="editor"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "source_templates",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", sa.Uuid(), nullable=True),
        sa.Column("source_id", sa.String(100), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("refresh_seconds", sa.Integer(), server_default="300"),
        sa.Column("auth_config", postgresql.JSONB(), nullable=True),
        sa.Column("fields", postgresql.JSONB(), nullable=False),
        sa.Column("panel_config", postgresql.JSONB(), nullable=False),
        sa.Column("validation", postgresql.JSONB(), nullable=True),
        sa.Column("is_catalog", sa.Boolean(), server_default="false"),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "source_id"),
    )

    op.create_table(
        "dashboards",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="false"),
        sa.Column("is_public", sa.Boolean(), server_default="false"),
        sa.Column("layout", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "slug"),
    )

    op.create_table(
        "dashboard_panels",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("dashboard_id", sa.Uuid(), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=True),
        sa.Column("panel_type", sa.String(30), nullable=False),
        sa.Column("hardcoded_key", sa.String(50), nullable=True),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("position", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dashboard_id"], ["dashboards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["source_templates.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "org_secrets",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("encrypted_value", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "key"),
    )


def downgrade() -> None:
    op.drop_table("org_secrets")
    op.drop_table("dashboard_panels")
    op.drop_table("dashboards")
    op.drop_table("source_templates")
    op.drop_table("users")
    op.drop_table("orgs")
