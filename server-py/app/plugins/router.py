import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.plugins.models import PluginInstance
from app.plugins.registry import plugin_registry
from app.plugins.schemas import PluginInstanceCreate, PluginInstanceUpdate

router = APIRouter(prefix="/plugins/v1", tags=["plugins"])


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:80]


def _to_response(inst: PluginInstance) -> dict:
    return {
        "id": str(inst.id),
        "plugin_type": inst.plugin_type,
        "name": inst.name,
        "description": inst.description,
        "active": inst.active,
        "priority": inst.priority,
        "source_id": inst.source_id,
        "refresh_seconds": inst.refresh_seconds,
        "last_fetched_at": inst.last_fetched_at,
        "last_item_count": inst.last_item_count,
        "total_items_fetched": inst.total_items_fetched,
        "consecutive_errors": inst.consecutive_errors,
        "last_error": inst.last_error,
        "auto_disabled": inst.auto_disabled,
        "tags": inst.tags,
        "created_at": inst.created_at,
        "config": inst.config,
    }


# ── Plugin types ──────────────────────────────────────────────


@router.get("/types")
async def list_plugin_types():
    return {
        "types": [
            {
                "name": m.name,
                "display_name": m.display_name,
                "description": m.description,
                "version": m.version,
                "icon": m.icon,
                "config_schema": m.config_schema,
                "default_refresh_seconds": m.default_refresh_seconds,
            }
            for m in plugin_registry.list_types()
        ]
    }


# ── Instances CRUD ────────────────────────────────────────────


@router.get("/instances")
async def list_instances(
    plugin_type: str = Query(""),
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PluginInstance)
    if plugin_type:
        stmt = stmt.where(PluginInstance.plugin_type == plugin_type)
    if active_only:
        stmt = stmt.where(PluginInstance.active == True)
    stmt = stmt.order_by(PluginInstance.created_at.desc())
    result = await db.execute(stmt)
    return {"instances": [_to_response(i) for i in result.scalars().all()]}


@router.post("/instances", status_code=201)
async def create_instance(
    body: PluginInstanceCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plugin = plugin_registry.get_plugin(body.plugin_type)
    if not plugin:
        raise HTTPException(404, f"Plugin type '{body.plugin_type}' not found")
    errors = await plugin.validate_config(body.config)
    if errors:
        raise HTTPException(422, {"errors": errors})

    source_id = f"plugin_{body.plugin_type}_{_slugify(body.name)}"
    existing = await db.execute(
        select(PluginInstance).where(PluginInstance.source_id == source_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Source '{source_id}' already exists")

    instance = PluginInstance(
        plugin_type=body.plugin_type,
        name=body.name,
        description=body.description,
        config=body.config,
        source_id=source_id,
        refresh_seconds=body.refresh_seconds or plugin.meta().default_refresh_seconds,
        tags=body.tags or [],
        lang=body.lang,
        country=body.country,
        tier=body.tier or 3,
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _to_response(instance)


@router.get("/instances/{instance_id}")
async def get_instance(instance_id: str, db: AsyncSession = Depends(get_db)):
    inst = await db.get(PluginInstance, uuid.UUID(instance_id))
    if not inst:
        raise HTTPException(404)
    return _to_response(inst)


@router.patch("/instances/{instance_id}")
async def update_instance(
    instance_id: str,
    body: PluginInstanceUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    inst = await db.get(PluginInstance, uuid.UUID(instance_id))
    if not inst:
        raise HTTPException(404)
    if body.config is not None:
        plugin = plugin_registry.get_plugin(inst.plugin_type)
        if plugin:
            errors = await plugin.validate_config(body.config)
            if errors:
                raise HTTPException(422, {"errors": errors})
    for fld, val in body.model_dump(exclude_unset=True).items():
        setattr(inst, fld, val)
    await db.commit()
    await db.refresh(inst)
    return _to_response(inst)


@router.delete("/instances/{instance_id}", status_code=204)
async def delete_instance(
    instance_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    inst = await db.get(PluginInstance, uuid.UUID(instance_id))
    if not inst:
        raise HTTPException(404)
    await db.delete(inst)
    await db.commit()


# ── Actions ───────────────────────────────────────────────────


@router.post("/instances/{instance_id}/test")
async def test_instance(instance_id: str, db: AsyncSession = Depends(get_db)):
    inst = await db.get(PluginInstance, uuid.UUID(instance_id))
    if not inst:
        raise HTTPException(404)
    plugin = plugin_registry.get_plugin(inst.plugin_type)
    if not plugin:
        raise HTTPException(404, "Plugin type not loaded")
    return await plugin.test_connection(inst.config)


@router.post("/instances/{instance_id}/fetch")
async def trigger_fetch(
    instance_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    inst = await db.get(PluginInstance, uuid.UUID(instance_id))
    if not inst:
        raise HTTPException(404)
    plugin = plugin_registry.get_plugin(inst.plugin_type)
    if not plugin:
        raise HTTPException(404, "Plugin type not loaded")
    try:
        rows = await plugin.fetch(inst.config)
        if rows:
            from app.source_engine.article_pipeline import ingest_articles

            count = await ingest_articles(db, inst.source_id, rows)
            return {"ok": True, "fetched": len(rows), "inserted": count}
        return {"ok": True, "fetched": 0, "inserted": 0}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/instances/{instance_id}/toggle")
async def toggle_instance(
    instance_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    inst = await db.get(PluginInstance, uuid.UUID(instance_id))
    if not inst:
        raise HTTPException(404)
    inst.active = not inst.active
    inst.auto_disabled = False
    inst.consecutive_errors = 0
    await db.commit()
    return {"active": inst.active}


# ── Health ────────────────────────────────────────────────────


@router.get("/health")
async def plugin_health(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(PluginInstance.id)))).scalar() or 0
    active = (
        await db.execute(
            select(func.count(PluginInstance.id)).where(
                PluginInstance.active == True, PluginInstance.auto_disabled == False
            )
        )
    ).scalar() or 0
    errored = (
        await db.execute(
            select(func.count(PluginInstance.id)).where(PluginInstance.auto_disabled == True)
        )
    ).scalar() or 0
    return {
        "plugin_types": plugin_registry.type_count,
        "total_instances": total,
        "active_instances": active,
        "errored_instances": errored,
    }
