"""Email Digests API — CRUD + preview."""
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.notifications.digests import EmailDigest, generate_digest_content, render_digest_html

router = APIRouter(prefix="/digests/v1", tags=["digests"])


def _to_response(digest: EmailDigest) -> dict:
    return {
        "id": str(digest.id),
        "org_id": str(digest.org_id),
        "owner_id": str(digest.owner_id),
        "name": digest.name,
        "recipients": digest.recipients,
        "scope_type": digest.scope_type,
        "scope_id": digest.scope_id,
        "frequency": digest.frequency,
        "send_hour": digest.send_hour,
        "send_day": digest.send_day,
        "min_threat": digest.min_threat,
        "max_articles": digest.max_articles,
        "enabled": digest.enabled,
        "last_sent_at": digest.last_sent_at.isoformat() if digest.last_sent_at else None,
        "created_at": digest.created_at.isoformat(),
    }


@router.get("/")
async def list_digests(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(EmailDigest)
        .where(EmailDigest.org_id == user.org_id)
        .order_by(EmailDigest.created_at.desc())
    )
    result = await db.execute(stmt)
    return {"digests": [_to_response(d) for d in result.scalars().all()]}


@router.post("/", status_code=201)
async def create_digest(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    digest = EmailDigest(
        org_id=user.org_id,
        owner_id=user.user_id,
        name=body["name"],
        recipients=body.get("recipients", []),
        scope_type=body.get("scope_type", "all"),
        scope_id=body.get("scope_id"),
        frequency=body.get("frequency", "daily"),
        send_hour=body.get("send_hour", 8),
        send_day=body.get("send_day"),
        min_threat=body.get("min_threat"),
        max_articles=body.get("max_articles", 20),
    )
    db.add(digest)
    await db.commit()
    await db.refresh(digest)
    return _to_response(digest)


@router.put("/{digest_id}")
async def update_digest(
    digest_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    digest = await db.get(EmailDigest, uuid.UUID(digest_id))
    if not digest or digest.org_id != user.org_id:
        raise HTTPException(404)
    if "name" in body:
        digest.name = body["name"]
    if "recipients" in body:
        digest.recipients = body["recipients"]
    if "scope_type" in body:
        digest.scope_type = body["scope_type"]
    if "scope_id" in body:
        digest.scope_id = body["scope_id"]
    if "frequency" in body:
        digest.frequency = body["frequency"]
    if "send_hour" in body:
        digest.send_hour = body["send_hour"]
    if "send_day" in body:
        digest.send_day = body["send_day"]
    if "min_threat" in body:
        digest.min_threat = body["min_threat"]
    if "max_articles" in body:
        digest.max_articles = body["max_articles"]
    if "enabled" in body:
        digest.enabled = body["enabled"]
    await db.commit()
    await db.refresh(digest)
    return _to_response(digest)


@router.delete("/{digest_id}", status_code=204)
async def delete_digest(
    digest_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    digest = await db.get(EmailDigest, uuid.UUID(digest_id))
    if not digest or digest.org_id != user.org_id:
        raise HTTPException(404)
    await db.delete(digest)
    await db.commit()


@router.post("/{digest_id}/toggle")
async def toggle_digest(
    digest_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    digest = await db.get(EmailDigest, uuid.UUID(digest_id))
    if not digest or digest.org_id != user.org_id:
        raise HTTPException(404)
    digest.enabled = not digest.enabled
    await db.commit()
    return {"enabled": digest.enabled}


@router.post("/{digest_id}/preview")
async def preview_digest(
    digest_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a preview of the digest content and rendered HTML."""
    digest = await db.get(EmailDigest, uuid.UUID(digest_id))
    if not digest or digest.org_id != user.org_id:
        raise HTTPException(404)
    content = await generate_digest_content(db, digest)
    html = render_digest_html(content)
    return {"html": html, "article_count": content["article_count"]}
