import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dashboard import Dashboard, DashboardPanel

_SLUG_RE = re.compile(r"[^a-z0-9]+")

MAX_DASHBOARDS_PER_ORG = 20
MAX_PANELS_PER_DASHBOARD = 50


def _make_slug(name: str) -> str:
    return _SLUG_RE.sub("-", name.lower()).strip("-")[:100] or "dashboard"


async def create_dashboard(
    db: AsyncSession, org_id: uuid.UUID, owner_id: uuid.UUID, name: str
) -> Dashboard:
    # Check limit
    count = await db.scalar(
        select(func.count()).select_from(Dashboard).where(Dashboard.org_id == org_id)
    )
    if count and count >= MAX_DASHBOARDS_PER_ORG:
        raise ValueError(f"Max {MAX_DASHBOARDS_PER_ORG} dashboards per org")

    # Generate unique slug
    base_slug = _make_slug(name)
    slug = base_slug
    suffix = 1
    while await db.scalar(
        select(Dashboard).where(Dashboard.org_id == org_id, Dashboard.slug == slug)
    ):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    # First dashboard is default
    is_first = count == 0

    dashboard = Dashboard(
        org_id=org_id,
        owner_id=owner_id,
        name=name,
        slug=slug,
        is_default=is_first,
        layout=[],
    )
    db.add(dashboard)
    await db.flush()
    return dashboard


async def get_dashboard_with_panels(
    db: AsyncSession, dashboard_id: uuid.UUID
) -> Dashboard | None:
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.panels))
        .where(Dashboard.id == dashboard_id)
    )
    return result.scalar_one_or_none()


async def get_public_dashboard(db: AsyncSession, slug: str) -> Dashboard | None:
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.panels))
        .where(Dashboard.slug == slug, Dashboard.is_public == True)
    )
    return result.scalar_one_or_none()


async def clone_dashboard(
    db: AsyncSession, source: Dashboard, owner_id: uuid.UUID
) -> Dashboard:
    new = await create_dashboard(db, source.org_id, owner_id, f"{source.name} (copy)")
    new.layout = list(source.layout)
    await db.flush()

    # Clone panels
    for panel in source.panels:
        new_panel = DashboardPanel(
            dashboard_id=new.id,
            template_id=panel.template_id,
            panel_type=panel.panel_type,
            hardcoded_key=panel.hardcoded_key,
            config=dict(panel.config),
            position=dict(panel.position),
        )
        db.add(new_panel)

    await db.flush()
    return new


async def add_panel(
    db: AsyncSession,
    dashboard_id: uuid.UUID,
    template_id: uuid.UUID | None,
    panel_type: str,
    hardcoded_key: str | None,
    config: dict,
    position: dict,
) -> DashboardPanel:
    # Check panel limit
    count = await db.scalar(
        select(func.count())
        .select_from(DashboardPanel)
        .where(DashboardPanel.dashboard_id == dashboard_id)
    )
    if count and count >= MAX_PANELS_PER_DASHBOARD:
        raise ValueError(f"Max {MAX_PANELS_PER_DASHBOARD} panels per dashboard")

    panel = DashboardPanel(
        dashboard_id=dashboard_id,
        template_id=template_id,
        panel_type=panel_type,
        hardcoded_key=hardcoded_key,
        config=config,
        position=position,
    )
    db.add(panel)
    await db.flush()
    return panel
