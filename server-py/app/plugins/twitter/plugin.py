from __future__ import annotations

import asyncio
from typing import Any

from app.plugins.base import PluginMeta, SourcePlugin


class TwitterPlugin(SourcePlugin):
    @classmethod
    def meta(cls) -> PluginMeta:
        return PluginMeta(
            name="twitter",
            display_name="Twitter / X",
            description="Surveiller des comptes Twitter/X et des recherches via twitter-scraper.",
            version="1.0.0",
            icon="twitter",
            dependencies=["twitter-scraper"],
            default_refresh_seconds=1800,
            config_schema={
                "type": "object",
                "properties": {
                    "mode": {"type": "string", "enum": ["user", "search"], "title": "Mode"},
                    "username": {"type": "string", "title": "Nom d'utilisateur (sans @)"},
                    "query": {"type": "string", "title": "Requête de recherche"},
                    "max_items": {"type": "integer", "default": 20, "minimum": 1, "maximum": 100},
                },
                "required": ["mode"],
            },
        )

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        errors = []
        mode = config.get("mode")
        if mode not in ("user", "search"):
            errors.append("mode doit être 'user' ou 'search'")
        if mode == "user" and not config.get("username"):
            errors.append("username requis pour le mode user")
        if mode == "search" and not config.get("query"):
            errors.append("query requis pour le mode search")
        return errors

    async def fetch(self, config: dict[str, Any]) -> list[dict]:
        from twitter_scraper import get_tweets

        mode = config["mode"]
        max_items = config.get("max_items", 20)
        loop = asyncio.get_event_loop()

        if mode == "user":
            username = config["username"]
            tweets = await loop.run_in_executor(
                None, lambda: list(get_tweets(username, pages=2))
            )
        else:
            tweets = []

        rows = []
        for tweet in tweets[:max_items]:
            text = tweet.get("text", "")
            rows.append({
                "title": text[:200],
                "description": text,
                "link": f"https://twitter.com/{config.get('username', 'x')}/status/{tweet.get('tweetId', '')}",
                "pubDate": str(tweet.get("time", "")),
                "source": f"twitter:@{config.get('username', '')}",
            })
        return rows
