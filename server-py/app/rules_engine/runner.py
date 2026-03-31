"""
Rules runner — evaluates and executes rules for article batches.
Hooks into the article pipeline AFTER enrichment + case matching.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.rules_engine.evaluator import ArticleContext, RuleEvaluator
from app.rules_engine.executor import execute_actions
from app.rules_engine.models import AutomationRule, RuleExecutionLog

logger = logging.getLogger(__name__)

# Cache of active rules — rebuilt periodically
_cached_rules: list[AutomationRule] = []
_cache_time: float = 0
CACHE_TTL = 300  # 5 minutes


async def _load_rules(db: AsyncSession) -> list[AutomationRule]:
    global _cached_rules, _cache_time
    now = time.time()
    if _cached_rules and (now - _cache_time) < CACHE_TTL:
        return _cached_rules
    result = await db.execute(
        select(AutomationRule)
        .where(AutomationRule.enabled == True)
        .order_by(AutomationRule.priority)
    )
    _cached_rules = list(result.scalars().all())
    _cache_time = now
    return _cached_rules


def invalidate_rule_cache():
    global _cached_rules, _cache_time
    _cached_rules = []
    _cache_time = 0


async def run_rules_for_articles(db: AsyncSession, articles: list[Article]) -> int:
    """Evaluate all active rules against a batch of articles.
    Returns total number of rule matches."""
    if not articles:
        return 0

    rules = await _load_rules(db)
    if not rules:
        return 0

    evaluator = RuleEvaluator()
    total_matches = 0

    for article in articles:
        ctx = ArticleContext.from_article(article)

        for rule in rules:
            try:
                conditions = json.loads(rule.conditions_json)
                actions = json.loads(rule.actions_json)
            except json.JSONDecodeError:
                continue

            start = time.monotonic()
            matched = evaluator.evaluate(conditions, ctx)
            eval_ms = int((time.monotonic() - start) * 1000)

            if matched:
                total_matches += 1
                results = await execute_actions(db, actions, ctx, rule.name)

                # Log execution
                db.add(RuleExecutionLog(
                    rule_id=rule.id,
                    article_id=article.id,
                    matched=True,
                    actions_executed=json.dumps(results),
                    evaluation_ms=eval_ms,
                ))

                # Update rule stats
                rule.match_count += 1
                rule.last_matched_at = datetime.now(timezone.utc)

                if rule.short_circuit:
                    break

    await db.flush()
    return total_matches
