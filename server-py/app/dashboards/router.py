import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import CurrentUser, get_current_user, get_optional_user
from app.dashboards.schemas import (
    DashboardCreate,
    DashboardListItem,
    DashboardPanelCreate,
    DashboardPanelResponse,
    DashboardPanelUpdate,
    DashboardResponse,
    DashboardUpdate,
)
from app.dashboards.service import (
    add_panel,
    clone_dashboard,
    create_dashboard,
    get_dashboard_with_panels,
    get_public_dashboard,
)
from app.db import get_db
from app.models.dashboard import Dashboard, DashboardPanel

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


def _dashboard_response(d: Dashboard) -> DashboardResponse:
    return DashboardResponse(
        id=d.id,
        name=d.name,
        slug=d.slug,
        is_default=d.is_default,
        is_public=d.is_public,
        layout=d.layout,
        panels=[
            DashboardPanelResponse(
                id=p.id,
                template_id=p.template_id,
                panel_type=p.panel_type,
                hardcoded_key=p.hardcoded_key,
                config=p.config,
                position=p.position,
                created_at=p.created_at,
            )
            for p in d.panels
        ],
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


# --- Dashboard CRUD ---


@router.get("", response_model=list[DashboardListItem])
async def list_dashboards(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.panels))
        .where(Dashboard.org_id == user.org_id)
        .order_by(Dashboard.is_default.desc(), Dashboard.updated_at.desc())
    )
    dashboards = result.scalars().all()
    return [
        DashboardListItem(
            id=d.id,
            name=d.name,
            slug=d.slug,
            is_default=d.is_default,
            is_public=d.is_public,
            panel_count=len(d.panels),
            updated_at=d.updated_at,
        )
        for d in dashboards
    ]


@router.post("", response_model=DashboardResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: DashboardCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        dashboard = await create_dashboard(db, user.org_id, user.user_id, body.name)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    await db.commit()
    await db.refresh(dashboard, ["panels"])
    return _dashboard_response(dashboard)


@router.get("/public/{slug}", response_model=DashboardResponse)
async def get_public(slug: str, db: AsyncSession = Depends(get_db)):
    dashboard = await get_public_dashboard(db, slug)
    if not dashboard:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dashboard not found or not public")
    return _dashboard_response(dashboard)


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_one(
    dashboard_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dashboard = await get_dashboard_with_panels(db, dashboard_id)
    if not dashboard or dashboard.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dashboard not found")
    return _dashboard_response(dashboard)


@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update(
    dashboard_id: uuid.UUID,
    body: DashboardUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dashboard = await get_dashboard_with_panels(db, dashboard_id)
    if not dashboard or dashboard.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dashboard not found")

    if body.name is not None:
        dashboard.name = body.name
    if body.is_public is not None:
        dashboard.is_public = body.is_public
    if body.is_default is not None:
        dashboard.is_default = body.is_default
    if body.layout is not None:
        dashboard.layout = body.layout

    await db.commit()
    await db.refresh(dashboard, ["panels"])
    return _dashboard_response(dashboard)


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    dashboard_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dashboard = await db.get(Dashboard, dashboard_id)
    if not dashboard or dashboard.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dashboard not found")
    await db.delete(dashboard)
    await db.commit()


@router.post("/{dashboard_id}/clone", response_model=DashboardResponse)
async def clone(
    dashboard_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    source = await get_dashboard_with_panels(db, dashboard_id)
    if not source or source.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dashboard not found")

    try:
        new = await clone_dashboard(db, source, user.user_id)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    await db.commit()
    await db.refresh(new, ["panels"])
    return _dashboard_response(new)


# --- Panel CRUD ---


@router.post(
    "/{dashboard_id}/panels",
    response_model=DashboardPanelResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_panel(
    dashboard_id: uuid.UUID,
    body: DashboardPanelCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dashboard = await db.get(Dashboard, dashboard_id)
    if not dashboard or dashboard.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dashboard not found")

    try:
        panel = await add_panel(
            db,
            dashboard_id,
            body.template_id,
            body.panel_type,
            body.hardcoded_key,
            body.config,
            body.position.model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    await db.commit()
    await db.refresh(panel)
    return DashboardPanelResponse(
        id=panel.id,
        template_id=panel.template_id,
        panel_type=panel.panel_type,
        hardcoded_key=panel.hardcoded_key,
        config=panel.config,
        position=panel.position,
        created_at=panel.created_at,
    )


@router.put("/{dashboard_id}/panels/{panel_id}", response_model=DashboardPanelResponse)
async def update_panel(
    dashboard_id: uuid.UUID,
    panel_id: uuid.UUID,
    body: DashboardPanelUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    panel = await db.get(DashboardPanel, panel_id)
    if not panel or panel.dashboard_id != dashboard_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Panel not found")

    # Verify org ownership
    dashboard = await db.get(Dashboard, dashboard_id)
    if not dashboard or dashboard.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dashboard not found")

    if body.config is not None:
        panel.config = body.config
    if body.position is not None:
        panel.position = body.position.model_dump()

    await db.commit()
    await db.refresh(panel)
    return DashboardPanelResponse(
        id=panel.id,
        template_id=panel.template_id,
        panel_type=panel.panel_type,
        hardcoded_key=panel.hardcoded_key,
        config=panel.config,
        position=panel.position,
        created_at=panel.created_at,
    )


@router.delete(
    "/{dashboard_id}/panels/{panel_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_panel(
    dashboard_id: uuid.UUID,
    panel_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    panel = await db.get(DashboardPanel, panel_id)
    if not panel or panel.dashboard_id != dashboard_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Panel not found")

    dashboard = await db.get(Dashboard, dashboard_id)
    if not dashboard or dashboard.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dashboard not found")

    await db.delete(panel)
    await db.commit()
