"""
Notifications API — CRUD, SSE stream, preferences.
"""
import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.notifications.dispatcher import register_sse_queue, unregister_sse_queue
from app.notifications.models import Notification, NotificationPreference

router = APIRouter(prefix="/notifications/v1", tags=["notifications"])


# ── List notifications ────────────────────────────────────────


@router.get("/")
async def list_notifications(
    type: str = Query(""),
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Notification).where(Notification.user_id == user.user_id)
    if type:
        stmt = stmt.where(Notification.type == type)
    if unread_only:
        stmt = stmt.where(Notification.read == False)
    stmt = stmt.order_by(desc(Notification.created_at)).limit(limit).offset(offset)
    result = await db.execute(stmt)
    notifs = result.scalars().all()
    return {
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "article_id": str(n.article_id) if n.article_id else None,
                "case_id": str(n.case_id) if n.case_id else None,
                "read": n.read,
                "starred": n.starred,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifs
        ]
    }


# ── Unread count ──────────────────────────────────────────────


@router.get("/count")
async def unread_count(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = (
        await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user.user_id,
                Notification.read == False,
            )
        )
    ).scalar() or 0
    return {"unread": count}


# ── Mark read ─────────────────────────────────────────────────


@router.patch("/{notif_id}/read")
async def mark_read(
    notif_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    n = await db.get(Notification, uuid.UUID(notif_id))
    if not n or n.user_id != user.user_id:
        raise HTTPException(404)
    n.read = True
    await db.commit()
    return {"ok": True}


@router.post("/mark-all-read")
async def mark_all_read(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.user_id, Notification.read == False)
        .values(read=True)
    )
    await db.commit()
    return {"ok": True}


# ── Delete ────────────────────────────────────────────────────


@router.delete("/{notif_id}", status_code=204)
async def delete_notification(
    notif_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    n = await db.get(Notification, uuid.UUID(notif_id))
    if not n or n.user_id != user.user_id:
        raise HTTPException(404)
    await db.delete(n)
    await db.commit()


# ── SSE stream ────────────────────────────────────────────────


@router.get("/stream")
async def notification_stream(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    uid = str(user.user_id)
    queue = register_sse_queue(uid)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            unregister_sse_queue(uid, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Preferences ───────────────────────────────────────────────


@router.get("/preferences")
async def get_preferences(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pref = (
        await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user.user_id
            )
        )
    ).scalar_one_or_none()
    if not pref:
        return {
            "in_app": True,
            "browser_push": False,
            "webhook_enabled": False,
            "webhook_url": None,
            "type_filters": None,
            "quiet_start": None,
            "quiet_end": None,
            "quiet_timezone": None,
        }
    return {
        "in_app": pref.in_app,
        "browser_push": pref.browser_push,
        "webhook_enabled": pref.webhook_enabled,
        "webhook_url": pref.webhook_url,
        "type_filters": pref.type_filters,
        "quiet_start": pref.quiet_start,
        "quiet_end": pref.quiet_end,
        "quiet_timezone": pref.quiet_timezone,
    }


@router.put("/preferences")
async def update_preferences(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pref = (
        await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user.user_id
            )
        )
    ).scalar_one_or_none()
    if not pref:
        pref = NotificationPreference(user_id=user.user_id)
        db.add(pref)
    for key in ["in_app", "browser_push", "webhook_enabled", "webhook_url",
                "type_filters", "quiet_start", "quiet_end", "quiet_timezone",
                "case_overrides", "feed_overrides"]:
        if key in body:
            setattr(pref, key, body[key])
    await db.commit()
    return {"ok": True}
