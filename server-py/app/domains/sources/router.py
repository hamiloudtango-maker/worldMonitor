"""
Unified Sources API — Inoreader-style source management.
One URL → auto-detect → add to catalog + optional folder.
Folders, article states, trending, read later.
"""
import json
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.article import Article
from app.models.folder import Folder
from app.models.user_article import UserArticleState

router = APIRouter(prefix="/sources/v2", tags=["sources-v2"])


# ═══════════════════════════════════════════════════════════════
# SOURCE AUTO-DETECTION
# ═══════════════════════════════════════════════════════════════


@router.post("/detect")
async def detect_source(body: dict):
    """Paste a URL → auto-detect source type (RSS, Facebook, Telegram, etc.)."""
    from app.domains.sources.detector import detect_source_type

    url = body.get("url", "").strip()
    if not url:
        raise HTTPException(422, "url is required")
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    result = await detect_source_type(url)
    return result


@router.post("/add")
async def add_source(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a source (auto-detected or manual). Optionally assign to a folder."""
    from app.plugins.registry import plugin_registry
    from app.plugins.models import PluginInstance

    plugin_type = body.get("type", "rss")
    config = body.get("config", {})
    name = body.get("name", "")
    folder_id = body.get("folder_id")
    tags = body.get("tags", [])
    country = body.get("country")
    lang = body.get("lang")

    # Validate plugin type exists
    plugin = plugin_registry.get_plugin(plugin_type)
    if not plugin:
        raise HTTPException(404, f"Plugin type '{plugin_type}' not found")

    # Validate config
    errors = await plugin.validate_config(config)
    if errors:
        raise HTTPException(422, {"errors": errors})

    # Generate source_id
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:80]
    source_id = f"plugin_{plugin_type}_{slug}"

    # Check uniqueness
    existing = await db.execute(
        select(PluginInstance).where(PluginInstance.source_id == source_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Source '{name}' already exists")

    instance = PluginInstance(
        plugin_type=plugin_type,
        name=name,
        config=config,
        source_id=source_id,
        refresh_seconds=plugin.meta().default_refresh_seconds,
        tags=tags,
        lang=lang,
        country=country,
        tier=2,
    )
    db.add(instance)
    await db.flush()

    # Add to folder if specified
    if folder_id:
        folder = await db.get(Folder, uuid.UUID(folder_id))
        if folder and folder.org_id == user.org_id:
            sids = list(folder.source_ids or [])
            if source_id not in sids:
                sids.append(source_id)
                folder.source_ids = sids

    await db.commit()
    await db.refresh(instance)

    return {
        "id": str(instance.id),
        "source_id": instance.source_id,
        "plugin_type": instance.plugin_type,
        "name": instance.name,
        "config": instance.config,
    }


@router.post("/search")
async def search_sources(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
):
    """Search for sources by keyword — searches Inoreader-style across known feeds."""
    from app.plugins.registry import plugin_registry

    query = body.get("query", "").strip().lower()
    if len(query) < 2:
        raise HTTPException(422, "query must be at least 2 characters")

    # Search in RSS catalog
    from sqlalchemy import select as sel
    from app.models.ai_feed import AIFeedSource

    results = []

    # Also check if it's a URL
    if query.startswith("http"):
        from app.domains.sources.detector import detect_source_type
        detected = await detect_source_type(query)
        results.append({
            "type": "detected",
            "source_type": detected["type"],
            "name": detected["name"],
            "icon": detected["icon"],
            "config": detected["config"],
            "url": query,
        })

    return {"results": results, "query": query}


# ═══════════════════════════════════════════════════════════════
# FOLDERS
# ═══════════════════════════════════════════════════════════════


@router.get("/folders")
async def list_folders(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Folder)
        .where(Folder.org_id == user.org_id)
        .order_by(Folder.position)
    )
    folders = result.scalars().all()
    return {
        "folders": [
            {
                "id": str(f.id),
                "name": f.name,
                "icon": f.icon,
                "color": f.color,
                "position": f.position,
                "source_ids": f.source_ids or [],
                "source_count": len(f.source_ids or []),
                "unread_count": f.unread_count,
            }
            for f in folders
        ]
    }


@router.post("/folders", status_code=201)
async def create_folder(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = Folder(
        org_id=user.org_id,
        name=body["name"],
        icon=body.get("icon"),
        color=body.get("color"),
        position=body.get("position", 0),
        source_ids=body.get("source_ids", []),
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return {
        "id": str(folder.id),
        "name": folder.name,
        "source_ids": folder.source_ids or [],
    }


@router.patch("/folders/{folder_id}")
async def update_folder(
    folder_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await db.get(Folder, uuid.UUID(folder_id))
    if not folder or folder.org_id != user.org_id:
        raise HTTPException(404)
    for key in ["name", "icon", "color", "position", "source_ids", "unread_retention_days"]:
        if key in body:
            setattr(folder, key, body[key])
    await db.commit()
    await db.refresh(folder)
    return {"id": str(folder.id), "name": folder.name, "source_ids": folder.source_ids or []}


@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await db.get(Folder, uuid.UUID(folder_id))
    if not folder or folder.org_id != user.org_id:
        raise HTTPException(404)
    await db.delete(folder)
    await db.commit()


@router.post("/folders/{folder_id}/add-source")
async def add_source_to_folder(
    folder_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await db.get(Folder, uuid.UUID(folder_id))
    if not folder or folder.org_id != user.org_id:
        raise HTTPException(404)
    source_id = body.get("source_id", "")
    sids = list(folder.source_ids or [])
    if source_id not in sids:
        sids.append(source_id)
        folder.source_ids = sids
        await db.commit()
    return {"source_ids": folder.source_ids}


@router.post("/folders/{folder_id}/remove-source")
async def remove_source_from_folder(
    folder_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await db.get(Folder, uuid.UUID(folder_id))
    if not folder or folder.org_id != user.org_id:
        raise HTTPException(404)
    source_id = body.get("source_id", "")
    sids = [s for s in (folder.source_ids or []) if s != source_id]
    folder.source_ids = sids
    await db.commit()
    return {"source_ids": folder.source_ids}


# ═══════════════════════════════════════════════════════════════
# ARTICLE STATES (read, starred, read later, annotations)
# ═══════════════════════════════════════════════════════════════


async def _get_or_create_state(db: AsyncSession, user_id: uuid.UUID, article_id: uuid.UUID) -> UserArticleState:
    result = await db.execute(
        select(UserArticleState).where(
            UserArticleState.user_id == user_id,
            UserArticleState.article_id == article_id,
        )
    )
    state = result.scalar_one_or_none()
    if not state:
        state = UserArticleState(user_id=user_id, article_id=article_id)
        db.add(state)
        await db.flush()
    return state


@router.post("/articles/{article_id}/read")
async def mark_read(
    article_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    state = await _get_or_create_state(db, user.user_id, uuid.UUID(article_id))
    state.read = True
    state.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"read": True}


@router.post("/articles/{article_id}/star")
async def toggle_star(
    article_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    state = await _get_or_create_state(db, user.user_id, uuid.UUID(article_id))
    state.starred = not state.starred
    if state.starred:
        state.starred_at = datetime.now(timezone.utc)
    await db.commit()
    return {"starred": state.starred}


@router.post("/articles/{article_id}/read-later")
async def toggle_read_later(
    article_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    state = await _get_or_create_state(db, user.user_id, uuid.UUID(article_id))
    state.read_later = not state.read_later
    await db.commit()
    return {"read_later": state.read_later}


@router.post("/articles/{article_id}/annotate")
async def save_annotations(
    article_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    state = await _get_or_create_state(db, user.user_id, uuid.UUID(article_id))
    state.annotations_json = json.dumps(body.get("annotations", []))
    await db.commit()
    return {"ok": True}


@router.get("/articles/starred")
async def list_starred(
    limit: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserArticleState.article_id)
        .where(UserArticleState.user_id == user.user_id, UserArticleState.starred == True)
        .order_by(desc(UserArticleState.starred_at))
        .limit(limit)
    )
    article_ids = [r[0] for r in result.all()]
    if not article_ids:
        return {"articles": []}
    articles = (await db.execute(
        select(Article).where(Article.id.in_(article_ids))
    )).scalars().all()
    return {"articles": [_article_summary(a) for a in articles]}


@router.get("/articles/read-later")
async def list_read_later(
    limit: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserArticleState.article_id)
        .where(UserArticleState.user_id == user.user_id, UserArticleState.read_later == True)
        .order_by(desc(UserArticleState.created_at))
        .limit(limit)
    )
    article_ids = [r[0] for r in result.all()]
    if not article_ids:
        return {"articles": []}
    articles = (await db.execute(
        select(Article).where(Article.id.in_(article_ids))
    )).scalars().all()
    return {"articles": [_article_summary(a) for a in articles]}


# ═══════════════════════════════════════════════════════════════
# TRENDING
# ═══════════════════════════════════════════════════════════════


@router.get("/trending")
async def trending_articles(
    period: str = Query("day", description="day or week"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Articles trending among sources — most mentioned topics, highest threat articles."""
    from datetime import timedelta

    hours = 24 if period == "day" else 168
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    # High-value articles: critical/high threat + breaking/developing
    result = await db.execute(
        select(Article)
        .where(
            Article.created_at >= cutoff,
            Article.threat_level.in_(["critical", "high"]),
        )
        .order_by(desc(Article.created_at))
        .limit(limit)
    )
    trending = result.scalars().all()

    # If not enough critical/high, fill with recent articles
    if len(trending) < limit:
        fill = await db.execute(
            select(Article)
            .where(Article.created_at >= cutoff)
            .order_by(desc(Article.created_at))
            .limit(limit - len(trending))
        )
        trending.extend(fill.scalars().all())

    return {"articles": [_article_summary(a) for a in trending], "period": period}


# ═══════════════════════════════════════════════════════════════
# FOLDER ARTICLES
# ═══════════════════════════════════════════════════════════════


@router.get("/folders/{folder_id}/articles")
async def folder_articles(
    folder_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: str = Query("date", description="date or relevance"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await db.get(Folder, uuid.UUID(folder_id))
    if not folder or folder.org_id != user.org_id:
        raise HTTPException(404)

    source_ids = folder.source_ids or []
    if not source_ids:
        return {"articles": [], "total": 0}

    stmt = select(Article).where(Article.source_id.in_(source_ids))
    if sort == "relevance":
        # Prioritize by threat level
        stmt = stmt.order_by(
            func.case(
                (Article.threat_level == "critical", 0),
                (Article.threat_level == "high", 1),
                (Article.threat_level == "medium", 2),
                (Article.threat_level == "low", 3),
                else_=4,
            ),
            desc(Article.created_at),
        )
    else:
        stmt = stmt.order_by(desc(Article.created_at))

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    articles = result.scalars().all()

    total = (await db.execute(
        select(func.count(Article.id)).where(Article.source_id.in_(source_ids))
    )).scalar() or 0

    return {"articles": [_article_summary(a) for a in articles], "total": total}


# ═══════════════════════════════════════════════════════════════
# OPML IMPORT/EXPORT
# ═══════════════════════════════════════════════════════════════


@router.get("/export-opml")
async def export_opml(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all sources as OPML."""
    from app.plugins.models import PluginInstance

    folders = (await db.execute(
        select(Folder).where(Folder.org_id == user.org_id).order_by(Folder.position)
    )).scalars().all()

    instances = (await db.execute(select(PluginInstance).where(PluginInstance.active == True))).scalars().all()
    inst_map = {i.source_id: i for i in instances}

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<opml version="2.0">',
        "<head><title>WorldMonitor Sources</title></head>",
        "<body>",
    ]

    for folder in folders:
        lines.append(f'  <outline text="{folder.name}" title="{folder.name}">')
        for sid in (folder.source_ids or []):
            inst = inst_map.get(sid)
            if inst and inst.plugin_type == "rss":
                url = inst.config.get("url", "")
                lines.append(f'    <outline type="rss" text="{inst.name}" title="{inst.name}" xmlUrl="{url}" />')
            elif inst:
                lines.append(f'    <outline text="{inst.name}" title="{inst.name}" description="{inst.plugin_type}:{sid}" />')
        lines.append("  </outline>")

    # Unsorted sources
    folder_sids = set()
    for f in folders:
        folder_sids.update(f.source_ids or [])
    unsorted = [i for i in instances if i.source_id not in folder_sids]
    if unsorted:
        lines.append('  <outline text="Non classé" title="Non classé">')
        for inst in unsorted:
            if inst.plugin_type == "rss":
                url = inst.config.get("url", "")
                lines.append(f'    <outline type="rss" text="{inst.name}" title="{inst.name}" xmlUrl="{url}" />')
        lines.append("  </outline>")

    lines.extend(["</body>", "</opml>"])

    from fastapi.responses import Response
    return Response(
        content="\n".join(lines),
        media_type="text/xml",
        headers={"Content-Disposition": "attachment; filename=worldmonitor-sources.opml"},
    )


@router.post("/import-opml")
async def import_opml(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import sources from OPML content."""
    from lxml import etree
    from app.plugins.models import PluginInstance

    opml_content = body.get("content", "")
    if not opml_content:
        raise HTTPException(422, "content is required")

    root = etree.fromstring(opml_content.encode())
    imported = 0

    for outline in root.iter("outline"):
        xml_url = outline.get("xmlUrl")
        if not xml_url:
            continue
        name = outline.get("title") or outline.get("text") or xml_url[:80]
        slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:80]
        source_id = f"plugin_rss_{slug}"

        existing = await db.execute(select(PluginInstance).where(PluginInstance.source_id == source_id))
        if existing.scalar_one_or_none():
            continue

        inst = PluginInstance(
            plugin_type="rss",
            name=name,
            config={"url": xml_url},
            source_id=source_id,
            refresh_seconds=900,
            tags=[],
            tier=3,
        )
        db.add(inst)
        imported += 1

    await db.commit()
    return {"imported": imported}


# ═══════════════════════════════════════════════════════════════
# OUTPUT FEEDS (redistribution RSS)
# ═══════════════════════════════════════════════════════════════


@router.get("/output/{folder_id}/rss")
async def output_rss_feed(
    folder_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Generate RSS feed from a folder's articles — for redistribution."""
    folder = await db.get(Folder, uuid.UUID(folder_id))
    if not folder:
        raise HTTPException(404)

    source_ids = folder.source_ids or []
    articles = []
    if source_ids:
        result = await db.execute(
            select(Article)
            .where(Article.source_id.in_(source_ids))
            .order_by(desc(Article.created_at))
            .limit(limit)
        )
        articles = result.scalars().all()

    items = []
    for a in articles:
        pub = a.pub_date.strftime("%a, %d %b %Y %H:%M:%S +0000") if a.pub_date else ""
        desc_text = (a.description or "").replace("&", "&amp;").replace("<", "&lt;")
        title = (a.title or "").replace("&", "&amp;").replace("<", "&lt;")
        items.append(f"""    <item>
      <title>{title}</title>
      <link>{a.link}</link>
      <description>{desc_text}</description>
      <pubDate>{pub}</pubDate>
      <guid>{a.link}</guid>
    </item>""")

    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>WorldMonitor — {folder.name}</title>
    <description>Articles from folder: {folder.name}</description>
    <lastBuildDate>{datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")}</lastBuildDate>
{chr(10).join(items)}
  </channel>
</rss>"""

    from fastapi.responses import Response
    return Response(content=rss, media_type="application/rss+xml")


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════


def _parse_json(val: str | None) -> list:
    if not val:
        return []
    try:
        return json.loads(val)
    except Exception:
        return []


def _article_summary(a: Article) -> dict:
    return {
        "id": str(a.id),
        "hash": a.hash,
        "title": a.title,
        "description": (a.description or "")[:300],
        "url": a.link,
        "source_id": a.source_id,
        "pub_date": a.pub_date.isoformat() if a.pub_date else None,
        "threat_level": a.threat_level,
        "theme": a.theme,
        "family": a.family,
        "section": a.section,
        "sentiment": a.sentiment,
        "criticality": a.criticality,
        "lang": a.lang,
        "countries": _parse_json(a.country_codes_json),
        "tags": _parse_json(a.tags_json),
    }
