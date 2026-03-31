"""
Rule condition evaluator — evaluates boolean condition trees in-memory against articles.
Does NOT use SQL. All evaluation happens on Python objects for speed.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from app.models.article import Article

THREAT_ORDER = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


@dataclass
class ArticleContext:
    """Lightweight wrapper around an Article with pre-parsed JSON fields."""
    article: Article
    tags: list[str] = field(default_factory=list)
    country_codes: list[str] = field(default_factory=list)
    persons: list[str] = field(default_factory=list)
    orgs: list[str] = field(default_factory=list)
    matched_model_ids: set[str] = field(default_factory=set)
    matched_case_ids: set[str] = field(default_factory=set)

    @classmethod
    def from_article(cls, article: Article) -> ArticleContext:
        def _parse(val):
            if not val:
                return []
            try:
                return json.loads(val)
            except Exception:
                return []

        return cls(
            article=article,
            tags=_parse(article.tags_json),
            country_codes=_parse(article.country_codes_json),
            persons=_parse(article.persons_json),
            orgs=_parse(article.orgs_json),
        )


class RuleEvaluator:
    """Stateless evaluator for condition trees."""

    def evaluate(self, conditions: dict, ctx: ArticleContext) -> bool:
        if "operator" in conditions:
            return self._eval_group(conditions, ctx)
        if conditions.get("type") == "condition":
            return self._eval_condition(conditions, ctx)
        return False

    def _eval_group(self, node: dict, ctx: ArticleContext) -> bool:
        op = node["operator"]
        children = node.get("children", [])
        if op == "AND":
            return all(self.evaluate(c, ctx) for c in children)
        if op == "OR":
            return any(self.evaluate(c, ctx) for c in children)
        if op == "NOT":
            return not any(self.evaluate(c, ctx) for c in children)
        return False

    def _eval_condition(self, cond: dict, ctx: ArticleContext) -> bool:
        field = cond.get("field", "")
        op = cond.get("op", "")
        value = cond.get("value")
        a = ctx.article

        if field == "keyword":
            text = self._get_text(a, cond.get("scope", "full"))
            if op == "contains":
                return value.lower() in text.lower() if value else False
            if op == "regex":
                try:
                    return bool(re.search(value, text, re.IGNORECASE))
                except re.error:
                    return False

        if field == "source_id":
            if op == "eq":
                return a.source_id == value
            if op == "in":
                return a.source_id in (value if isinstance(value, list) else [value])

        if field == "threat_level":
            if op == "eq":
                return a.threat_level == value
            if op == "gte":
                return THREAT_ORDER.get(a.threat_level, 0) >= THREAT_ORDER.get(value, 0)
            if op == "in":
                return a.threat_level in (value if isinstance(value, list) else [value])

        if field == "theme":
            return self._match_str(a.theme, op, value)

        if field == "family":
            return self._match_str(a.family, op, value)

        if field == "section":
            return self._match_str(a.section, op, value)

        if field == "country":
            if op == "in":
                codes = value if isinstance(value, list) else [value]
                return bool(set(ctx.country_codes) & set(codes))

        if field == "sentiment":
            return self._match_str(a.sentiment, op, value)

        if field == "criticality":
            return self._match_str(a.criticality, op, value)

        if field == "lang":
            return self._match_str(a.lang, op, value)

        if field == "tag":
            if op == "contains":
                return value in ctx.tags if value else False

        if field == "person":
            if op == "contains":
                return any(value.lower() in p.lower() for p in ctx.persons) if value else False

        if field == "org":
            if op == "contains":
                return any(value.lower() in o.lower() for o in ctx.orgs) if value else False

        if field == "intel_model":
            if op == "matched":
                return value in ctx.matched_model_ids

        if field == "case":
            if op == "matched":
                return value in ctx.matched_case_ids

        if field == "article_type":
            return self._match_str(a.article_type, op, value)

        return False

    def _match_str(self, actual: str | None, op: str, value) -> bool:
        if op == "eq":
            return actual == value
        if op == "in":
            vals = value if isinstance(value, list) else [value]
            return actual in vals
        return False

    def _get_text(self, a: Article, scope: str) -> str:
        if scope == "title":
            return a.title or ""
        if scope == "description":
            return a.description or ""
        return f"{a.title or ''} {a.description or ''}"
