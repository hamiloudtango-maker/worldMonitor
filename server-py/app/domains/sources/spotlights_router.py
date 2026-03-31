"""Spotlights & Annotations API."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.spotlight import Spotlight

router = APIRouter(prefix="/spotlights/v1", tags=["spotlights"])


@router.get("/")
async def list_spotlights(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Spotlight)
        .where(Spotlight.user_id == user.user_id)
        .order_by(Spotlight.position)
    )
    return {
        "spotlights": [
            {
                "id": str(s.id),
                "name": s.name,
                "keywords": s.keywords,
                "color": s.color,
                "enabled": s.enabled,
            }
            for s in result.scalars().all()
        ]
    }


@router.post("/", status_code=201)
async def create_spotlight(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = Spotlight(
        user_id=user.user_id,
        name=body["name"],
        keywords=body.get("keywords", []),
        color=body.get("color", "#ef4444"),
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {"id": str(s.id), "name": s.name, "keywords": s.keywords, "color": s.color}


@router.put("/{spotlight_id}")
async def update_spotlight(
    spotlight_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = await db.get(Spotlight, uuid.UUID(spotlight_id))
    if not s or s.user_id != user.user_id:
        raise HTTPException(404)
    for key in ["name", "keywords", "color", "enabled"]:
        if key in body:
            setattr(s, key, body[key])
    await db.commit()
    return {"ok": True}


@router.delete("/{spotlight_id}", status_code=204)
async def delete_spotlight(
    spotlight_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = await db.get(Spotlight, uuid.UUID(spotlight_id))
    if not s or s.user_id != user.user_id:
        raise HTTPException(404)
    await db.delete(s)
    await db.commit()
