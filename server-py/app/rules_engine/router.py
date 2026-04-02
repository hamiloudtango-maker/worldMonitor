"""
Rules & Automations API — CRUD, test, logs.
"""
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.article import Article
from app.rules_engine.evaluator import ArticleContext, RuleEvaluator
from app.rules_engine.models import AutomationRule, RuleExecutionLog
from app.rules_engine.runner import invalidate_rule_cache

router = APIRouter(prefix="/rules/v1", tags=["rules"])


def _to_response(rule: AutomationRule) -> dict:
    return {
        "id": str(rule.id),
        "name": rule.name,
        "description": rule.description,
        "conditions": json.loads(rule.conditions_json),
        "actions": json.loads(rule.actions_json),
        "scope": rule.scope,
        "scope_target_id": str(rule.scope_target_id) if rule.scope_target_id else None,
        "priority": rule.priority,
        "enabled": rule.enabled,
        "short_circuit": rule.short_circuit,
        "schedule": json.loads(rule.schedule_json) if rule.schedule_json else None,
        "match_count": rule.match_count,
        "last_matched_at": rule.last_matched_at.isoformat() if rule.last_matched_at else None,
        "created_at": rule.created_at.isoformat(),
        "updated_at": rule.updated_at.isoformat(),
    }


@router.get("/templates")
async def rule_templates():
    """Pre-built rule templates for common OSINT use cases."""
    return {
        "templates": [
            {
                "name": "Alerte menace critique",
                "description": "Notifier quand un article a un niveau de menace critical",
                "conditions": {"operator": "AND", "children": [
                    {"type": "condition", "field": "threat_level", "op": "gte", "value": "critical"},
                ]},
                "actions": [
                    {"type": "notify", "params": {"title": "\U0001f534 Menace critique: {title}"}},
                ],
            },
            {
                "name": "Veille pays",
                "description": "Tagger les articles mentionnant des pays sp\u00e9cifiques",
                "conditions": {"operator": "AND", "children": [
                    {"type": "condition", "field": "country", "op": "in", "value": ["FR", "DE", "GB"]},
                ]},
                "actions": [
                    {"type": "add_tag", "params": {"tag": "europe"}},
                ],
            },
            {
                "name": "Breaking news",
                "description": "Notifier sur les articles breaking avec menace high+",
                "conditions": {"operator": "AND", "children": [
                    {"type": "condition", "field": "criticality", "op": "eq", "value": "breaking"},
                    {"type": "condition", "field": "threat_level", "op": "gte", "value": "high"},
                ]},
                "actions": [
                    {"type": "notify", "params": {"title": "\u26a1 Breaking: {title}"}},
                    {"type": "add_tag", "params": {"tag": "breaking"}},
                ],
            },
            {
                "name": "Filtre bruit",
                "description": "Supprimer les articles info/low d'une source sp\u00e9cifique",
                "conditions": {"operator": "AND", "children": [
                    {"type": "condition", "field": "threat_level", "op": "in", "value": ["info", "low"]},
                    {"type": "condition", "field": "article_type", "op": "eq", "value": "opinion"},
                ]},
                "actions": [
                    {"type": "suppress", "params": {}},
                ],
            },
        ],
    }


@router.get("/")
async def list_rules(
    scope: str = Query(""),
    enabled_only: bool = Query(False),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AutomationRule).where(AutomationRule.org_id == user.org_id)
    if scope:
        stmt = stmt.where(AutomationRule.scope == scope)
    if enabled_only:
        stmt = stmt.where(AutomationRule.enabled == True)
    stmt = stmt.order_by(AutomationRule.priority)
    result = await db.execute(stmt)
    return {"rules": [_to_response(r) for r in result.scalars().all()]}


@router.post("/", status_code=201)
async def create_rule(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = AutomationRule(
        org_id=user.org_id,
        owner_id=user.user_id,
        name=body["name"],
        description=body.get("description"),
        conditions_json=json.dumps(body["conditions"]),
        actions_json=json.dumps(body["actions"]),
        scope=body.get("scope", "global"),
        scope_target_id=uuid.UUID(body["scope_target_id"]) if body.get("scope_target_id") else None,
        priority=body.get("priority", 100),
        short_circuit=body.get("short_circuit", False),
        schedule_json=json.dumps(body["schedule"]) if body.get("schedule") else None,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    invalidate_rule_cache()
    return _to_response(rule)


@router.get("/{rule_id}")
async def get_rule(
    rule_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await db.get(AutomationRule, uuid.UUID(rule_id))
    if not rule or rule.org_id != user.org_id:
        raise HTTPException(404)
    return _to_response(rule)


@router.put("/{rule_id}")
async def update_rule(
    rule_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await db.get(AutomationRule, uuid.UUID(rule_id))
    if not rule or rule.org_id != user.org_id:
        raise HTTPException(404)
    if "name" in body:
        rule.name = body["name"]
    if "description" in body:
        rule.description = body["description"]
    if "conditions" in body:
        rule.conditions_json = json.dumps(body["conditions"])
    if "actions" in body:
        rule.actions_json = json.dumps(body["actions"])
    if "scope" in body:
        rule.scope = body["scope"]
    if "scope_target_id" in body:
        rule.scope_target_id = uuid.UUID(body["scope_target_id"]) if body["scope_target_id"] else None
    if "priority" in body:
        rule.priority = body["priority"]
    if "enabled" in body:
        rule.enabled = body["enabled"]
    if "short_circuit" in body:
        rule.short_circuit = body["short_circuit"]
    if "schedule" in body:
        rule.schedule_json = json.dumps(body["schedule"]) if body["schedule"] else None
    await db.commit()
    await db.refresh(rule)
    invalidate_rule_cache()
    return _to_response(rule)


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await db.get(AutomationRule, uuid.UUID(rule_id))
    if not rule or rule.org_id != user.org_id:
        raise HTTPException(404)
    await db.delete(rule)
    await db.commit()
    invalidate_rule_cache()


@router.post("/{rule_id}/toggle")
async def toggle_rule(
    rule_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await db.get(AutomationRule, uuid.UUID(rule_id))
    if not rule or rule.org_id != user.org_id:
        raise HTTPException(404)
    rule.enabled = not rule.enabled
    await db.commit()
    invalidate_rule_cache()
    return {"enabled": rule.enabled}


@router.post("/{rule_id}/test")
async def test_rule(
    rule_id: str,
    limit: int = Query(50, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dry-run a rule against recent articles."""
    rule = await db.get(AutomationRule, uuid.UUID(rule_id))
    if not rule or rule.org_id != user.org_id:
        raise HTTPException(404)

    conditions = json.loads(rule.conditions_json)
    evaluator = RuleEvaluator()

    articles = (await db.execute(
        select(Article).order_by(desc(Article.created_at)).limit(limit)
    )).scalars().all()

    matches = []
    for article in articles:
        ctx = ArticleContext.from_article(article)
        if evaluator.evaluate(conditions, ctx):
            matches.append({
                "id": str(article.id),
                "title": article.title,
                "source_id": article.source_id,
                "threat_level": article.threat_level,
                "pub_date": article.pub_date.isoformat() if article.pub_date else None,
            })

    return {
        "matched_count": len(matches),
        "total_tested": len(articles),
        "sample_matches": matches[:20],
    }


@router.get("/{rule_id}/logs")
async def rule_logs(
    rule_id: str,
    limit: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await db.get(AutomationRule, uuid.UUID(rule_id))
    if not rule or rule.org_id != user.org_id:
        raise HTTPException(404)

    result = await db.execute(
        select(RuleExecutionLog)
        .where(RuleExecutionLog.rule_id == rule.id)
        .order_by(desc(RuleExecutionLog.created_at))
        .limit(limit)
    )
    logs = result.scalars().all()
    return {
        "logs": [
            {
                "id": str(l.id),
                "article_id": str(l.article_id),
                "matched": l.matched,
                "actions_executed": json.loads(l.actions_executed) if l.actions_executed else [],
                "evaluation_ms": l.evaluation_ms,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ]
    }


