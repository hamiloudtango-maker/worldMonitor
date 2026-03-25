"""
Source Engine API — detect, validate, data, templates CRUD.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user, get_optional_user
from app.db import get_db
from app.models.source_template import SourceTemplate as SourceTemplateModel
from app.source_engine.detector import detect_source
from app.source_engine.scheduler import fetch_source_data, register_source, unregister_source
from app.source_engine.schemas import (
    DataResponse,
    DetectRequest,
    DetectResponse,
    SourceTemplate,
    TemplateCreateRequest,
    TemplateResponse,
    ValidateRequest,
    ValidateResponse,
)
from app.source_engine.validator import validate_template

router = APIRouter(prefix="/sources/v1", tags=["sources"])


# --- Detection & Validation ---


@router.post("/detect", response_model=DetectResponse)
async def detect(body: DetectRequest, user: CurrentUser = Depends(get_current_user)):
    """Phase 1: LLM-powered source detection. One-time per source."""
    try:
        template = await detect_source(body.url)
    except Exception as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Detection failed: {e}")
    return DetectResponse(template=template)


@router.post("/validate", response_model=ValidateResponse)
async def validate(body: ValidateRequest, user: CurrentUser = Depends(get_current_user)):
    """Validate a template by fetching and parsing the source."""
    result = await validate_template(body.template)
    return ValidateResponse(
        valid=result.row_count > 0 and len(result.errors) == 0,
        row_count=result.row_count,
        sample_row=result.sample_row,
        errors=result.errors,
    )


# --- Data ---


@router.get("/data/{source_id}", response_model=DataResponse)
async def get_data(
    source_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get parsed data for a source. Returns translated titles when available."""
    import json as _json

    from app.models.article import Article
    from app.source_engine.article_pipeline import ingest_articles

    # Load template from DB
    row = await db.scalar(
        select(SourceTemplateModel).where(
            SourceTemplateModel.source_id == source_id,
            (SourceTemplateModel.org_id == user.org_id) | (SourceTemplateModel.is_catalog == True),
        )
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source template not found")

    template = SourceTemplate(
        source_id=row.source_id,
        source_type=row.source_type,
        category=row.category,
        url=row.url,
        refresh_seconds=row.refresh_seconds,
        fields=row.fields,
        panel=row.panel_config,
        namespaces=row.auth_config.get("namespaces") if row.auth_config else None,
        auth=row.auth_config,
    )

    try:
        rows, cached = await fetch_source_data(template)
    except Exception as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Fetch failed: {e}")

    # Run ingestion pipeline (dedup ensures no double-inserts)
    try:
        await ingest_articles(db, source_id, rows)
    except Exception:
        pass  # Non-blocking — raw data still returned if ingestion fails

    # Enrich rows with translations + NER from articles table
    articles = (await db.scalars(
        select(Article).where(Article.source_id == source_id).order_by(Article.pub_date.desc()).limit(200)
    )).all()

    if articles:
        # Build lookup by link hash
        enriched_rows = []
        for a in articles:
            enriched = {
                "title": a.title_translated or a.title,
                "title_original": a.title if a.title_translated else None,
                "description": a.description,
                "link": a.link,
                "pubDate": a.pub_date.isoformat() if a.pub_date else "",
                "lang": a.lang,
                "threat_level": a.threat_level,
                "theme": a.theme,
                "entities": _json.loads(a.entities_json) if a.entities_json else [],
                "country_codes": _json.loads(a.country_codes_json) if a.country_codes_json else [],
            }
            enriched_rows.append(enriched)
        rows = enriched_rows

    return DataResponse(
        source_id=source_id,
        rows=rows,
        row_count=len(rows),
        fetched_at=datetime.now(timezone.utc),
        cached=cached,
    )


# --- Templates CRUD ---


@router.get("/catalog")
async def get_catalog(db: AsyncSession = Depends(get_db)):
    """Get global catalog of pre-validated templates."""
    result = await db.scalars(
        select(SourceTemplateModel).where(SourceTemplateModel.is_catalog == True)
    )
    templates = result.all()
    return [
        {
            "id": str(t.id),
            "source_id": t.source_id,
            "source_type": t.source_type,
            "category": t.category,
            "url": t.url,
            "panel_config": t.panel_config,
            "fields_count": len(t.fields),
        }
        for t in templates
    ]


@router.get("/templates")
async def list_templates(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List templates for the current org."""
    result = await db.scalars(
        select(SourceTemplateModel).where(
            (SourceTemplateModel.org_id == user.org_id) | (SourceTemplateModel.is_catalog == True)
        )
    )
    templates = result.all()
    return [
        TemplateResponse(
            id=t.id,
            template=SourceTemplate(
                source_id=t.source_id,
                source_type=t.source_type,
                category=t.category,
                url=t.url,
                refresh_seconds=t.refresh_seconds,
                fields=t.fields,
                panel=t.panel_config,
            ),
            created_at=t.created_at,
        )
        for t in templates
    ]


@router.post("/templates", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    body: TemplateCreateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new source template for the current org."""
    tpl = body.template
    model = SourceTemplateModel(
        org_id=user.org_id,
        source_id=tpl.source_id,
        source_type=tpl.source_type,
        category=tpl.category,
        url=tpl.url,
        refresh_seconds=tpl.refresh_seconds,
        auth_config=tpl.auth.model_dump() if tpl.auth else None,
        fields=[f.model_dump() for f in tpl.fields],
        panel_config=tpl.panel.model_dump(),
        is_catalog=False,
        created_by=user.user_id,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)

    # Register for auto-refresh
    register_source(tpl)

    return TemplateResponse(
        id=model.id,
        template=tpl,
        created_at=model.created_at,
    )


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a source template."""
    model = await db.get(SourceTemplateModel, template_id)
    if not model or model.org_id != user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")

    unregister_source(model.source_id)
    await db.delete(model)
    await db.commit()
