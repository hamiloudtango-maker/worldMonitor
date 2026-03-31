"""
Notification dispatcher — creates notifications and pushes to SSE queues.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.notifications.models import Notification

logger = logging.getLogger(__name__)

# SSE: one asyncio.Queue per connected user_id
_sse_queues: dict[str, list[asyncio.Queue]] = {}


def register_sse_queue(user_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _sse_queues.setdefault(user_id, []).append(q)
    return q


def unregister_sse_queue(user_id: str, q: asyncio.Queue) -> None:
    queues = _sse_queues.get(user_id, [])
    if q in queues:
        queues.remove(q)
    if not queues:
        _sse_queues.pop(user_id, None)


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    type: str = "alert",
    title: str,
    body: str | None = None,
    article_id: uuid.UUID | None = None,
    case_id: uuid.UUID | None = None,
    rule_id: uuid.UUID | None = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        org_id=org_id,
        type=type,
        title=title,
        body=body,
        article_id=article_id,
        case_id=case_id,
        rule_id=rule_id,
    )
    db.add(notif)
    await db.flush()

    # Push to SSE
    uid = str(user_id)
    for q in _sse_queues.get(uid, []):
        try:
            q.put_nowait({
                "id": str(notif.id),
                "type": notif.type,
                "title": notif.title,
                "body": notif.body,
                "article_id": str(notif.article_id) if notif.article_id else None,
                "case_id": str(notif.case_id) if notif.case_id else None,
                "created_at": notif.created_at.isoformat(),
            })
        except asyncio.QueueFull:
            pass

    return notif


async def fire_webhook(url: str, payload: dict) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json=payload)
            return r.status_code < 400
    except Exception as e:
        logger.warning("Webhook failed %s: %s", url, e)
        return False
