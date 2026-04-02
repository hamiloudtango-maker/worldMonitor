"""Automated Reports API — CRUD + generate."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.article import Article
from app.automation.reports_model import AutoReport

router = APIRouter(prefix="/reports/v1", tags=["reports"])


def _to_response(report: AutoReport) -> dict:
    return {
        "id": str(report.id),
        "name": report.name,
        "scope_type": report.scope_type,
        "scope_id": report.scope_id,
        "frequency": report.frequency,
        "format": report.format,
        "template_prompt": report.template_prompt,
        "enabled": report.enabled,
        "last_generated_at": report.last_generated_at.isoformat() if report.last_generated_at else None,
        "created_at": report.created_at.isoformat(),
    }


@router.get("/")
async def list_reports(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AutoReport)
        .where(AutoReport.org_id == user.org_id)
        .order_by(AutoReport.created_at.desc())
    )
    result = await db.execute(stmt)
    return {"reports": [_to_response(r) for r in result.scalars().all()]}


@router.post("/", status_code=201)
async def create_report(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = AutoReport(
        org_id=user.org_id,
        owner_id=user.user_id,
        name=body["name"],
        scope_type=body.get("scope_type", "all"),
        scope_id=body.get("scope_id"),
        frequency=body.get("frequency", "daily"),
        format=body.get("format", "markdown"),
        template_prompt=body.get("template_prompt"),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return _to_response(report)


@router.put("/{report_id}")
async def update_report(
    report_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(AutoReport, uuid.UUID(report_id))
    if not report or report.org_id != user.org_id:
        raise HTTPException(404)
    if "name" in body:
        report.name = body["name"]
    if "scope_type" in body:
        report.scope_type = body["scope_type"]
    if "scope_id" in body:
        report.scope_id = body["scope_id"]
    if "frequency" in body:
        report.frequency = body["frequency"]
    if "format" in body:
        report.format = body["format"]
    if "template_prompt" in body:
        report.template_prompt = body["template_prompt"]
    if "enabled" in body:
        report.enabled = body["enabled"]
    await db.commit()
    await db.refresh(report)
    return _to_response(report)


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(AutoReport, uuid.UUID(report_id))
    if not report or report.org_id != user.org_id:
        raise HTTPException(404)
    await db.delete(report)
    await db.commit()


@router.post("/{report_id}/toggle")
async def toggle_report(
    report_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(AutoReport, uuid.UUID(report_id))
    if not report or report.org_id != user.org_id:
        raise HTTPException(404)
    report.enabled = not report.enabled
    await db.commit()
    return {"enabled": report.enabled}


@router.post("/{report_id}/generate")
async def generate_report(
    report_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate report content now from recent articles matching scope."""
    report = await db.get(AutoReport, uuid.UUID(report_id))
    if not report or report.org_id != user.org_id:
        raise HTTPException(404)

    # Query recent articles by scope
    since = report.last_generated_at or (datetime.now(timezone.utc) - timedelta(hours=24))
    stmt = select(Article).where(Article.created_at >= since)

    if report.scope_type == "folder":
        from app.models.folder import Folder
        folder = await db.get(Folder, uuid.UUID(report.scope_id)) if report.scope_id else None
        if folder and folder.source_ids:
            stmt = stmt.where(Article.source_id.in_(folder.source_ids))
    elif report.scope_type == "feed" and report.scope_id:
        stmt = stmt.where(Article.source_id == report.scope_id)

    stmt = stmt.order_by(Article.created_at.desc()).limit(50)
    result = await db.execute(stmt)
    articles = result.scalars().all()

    now = datetime.now(timezone.utc)

    # Build report content from articles
    lines = [f"# {report.name}", f"", f"*Generated: {now.strftime('%Y-%m-%d %H:%M UTC')}*", f"", f"## Articles ({len(articles)})"]
    for a in articles:
        threat_emoji = {"critical": "\U0001f534", "high": "\U0001f7e0", "medium": "\U0001f7e1", "low": "\U0001f7e2"}.get(a.threat_level, "\u26aa")
        lines.append(f"- {threat_emoji} **{a.title}** \u2014 {a.source_id}")
        if a.summary:
            lines.append(f"  > {a.summary[:200]}")
    content = "\n".join(lines)

    # Save to report
    report.last_content = content
    report.last_generated_at = now
    await db.commit()

    return {
        "content": content,
        "article_count": len(articles),
        "generated_at": now.isoformat(),
    }
