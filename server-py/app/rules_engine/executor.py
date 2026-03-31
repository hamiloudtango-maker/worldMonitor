"""
Rule action executor — dispatches actions for matched articles.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.rules_engine.evaluator import ArticleContext

logger = logging.getLogger(__name__)


async def execute_actions(
    db: AsyncSession,
    actions: list[dict],
    ctx: ArticleContext,
    rule_name: str = "",
) -> list[dict]:
    """Execute a list of actions for a matched article. Returns execution results."""
    results = []
    for action in actions:
        action_type = action.get("type", "")
        params = action.get("params", {})
        try:
            handler = ACTION_HANDLERS.get(action_type)
            if handler:
                await handler(db, ctx, params, rule_name)
                results.append({"action": action_type, "status": "ok"})
            else:
                results.append({"action": action_type, "status": "unknown_action"})
        except Exception as e:
            logger.warning("Action %s failed: %s", action_type, e)
            results.append({"action": action_type, "status": "error", "detail": str(e)[:200]})
    return results


async def _action_add_tag(db: AsyncSession, ctx: ArticleContext, params: dict, rule_name: str):
    tag = params.get("tag", "")
    if not tag:
        return
    tags = list(ctx.tags)
    if tag not in tags:
        tags.append(tag)
        ctx.article.tags_json = json.dumps(tags)
        ctx.tags = tags
        await db.flush()


async def _action_add_to_case(db: AsyncSession, ctx: ArticleContext, params: dict, rule_name: str):
    import uuid
    from sqlalchemy import text

    case_id = params.get("case_id")
    if not case_id:
        return
    # Use article_models pattern — insert into case matching
    await db.execute(
        text("INSERT OR IGNORE INTO case_articles (case_id, article_id) VALUES (:cid, :aid)"),
        {"cid": case_id, "aid": str(ctx.article.id)},
    )
    await db.flush()


async def _action_notify(db: AsyncSession, ctx: ArticleContext, params: dict, rule_name: str):
    from app.notifications.dispatcher import create_notification
    import uuid

    title = params.get("title", f"Rule: {rule_name}")
    body = params.get("body_template", "")
    # Simple template substitution
    body = body.replace("{title}", ctx.article.title or "")
    body = body.replace("{threat_level}", ctx.article.threat_level or "")
    body = body.replace("{source_id}", ctx.article.source_id or "")
    body = body.replace("{rule_name}", rule_name)

    # Notify all users in the org (simplified — in production, respect preferences)
    from sqlalchemy import select
    from app.models.user import User
    users = (await db.execute(select(User))).scalars().all()
    for user in users:
        await create_notification(
            db,
            user_id=user.id,
            org_id=user.org_id,
            type="rule",
            title=title,
            body=body or None,
            article_id=ctx.article.id,
        )


async def _action_webhook(db: AsyncSession, ctx: ArticleContext, params: dict, rule_name: str):
    from app.notifications.dispatcher import fire_webhook

    url = params.get("url", "")
    if not url:
        return
    payload = {
        "rule": rule_name,
        "article_title": ctx.article.title,
        "article_url": ctx.article.link,
        "threat_level": ctx.article.threat_level,
        "source": ctx.article.source_id,
        "timestamp": ctx.article.created_at.isoformat() if ctx.article.created_at else "",
    }
    await fire_webhook(url, payload)


async def _action_boost_priority(db: AsyncSession, ctx: ArticleContext, params: dict, rule_name: str):
    # This would boost the source priority — simplified
    pass


async def _action_mark_starred(db: AsyncSession, ctx: ArticleContext, params: dict, rule_name: str):
    # Would need a user_article_state table — placeholder
    pass


async def _action_suppress(db: AsyncSession, ctx: ArticleContext, params: dict, rule_name: str):
    # Mark article as suppressed — could add a column or tag
    tags = list(ctx.tags)
    if "_suppressed" not in tags:
        tags.append("_suppressed")
        ctx.article.tags_json = json.dumps(tags)
        ctx.tags = tags
        await db.flush()


ACTION_HANDLERS = {
    "add_tag": _action_add_tag,
    "add_to_case": _action_add_to_case,
    "notify": _action_notify,
    "webhook": _action_webhook,
    "boost_priority": _action_boost_priority,
    "mark_starred": _action_mark_starred,
    "suppress": _action_suppress,
}
