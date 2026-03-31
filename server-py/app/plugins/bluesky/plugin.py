from __future__ import annotations

from typing import Any

import httpx

from app.plugins.base import PluginMeta, SourcePlugin

BSKY_API = "https://public.api.bsky.app/xrpc"


class BlueskyPlugin(SourcePlugin):
    @classmethod
    def meta(cls) -> PluginMeta:
        return PluginMeta(
            name="bluesky",
            display_name="Bluesky",
            description="Suivre des comptes et recherches Bluesky via l'API AT Protocol.",
            version="1.0.0",
            icon="cloud",
            default_refresh_seconds=1800,
            config_schema={
                "type": "object",
                "properties": {
                    "mode": {"type": "string", "enum": ["user", "search"], "title": "Mode"},
                    "handle": {"type": "string", "title": "Handle (ex: user.bsky.social)"},
                    "query": {"type": "string", "title": "Recherche"},
                    "max_items": {"type": "integer", "default": 25, "minimum": 1, "maximum": 100},
                },
                "required": ["mode"],
            },
        )

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        errors = []
        mode = config.get("mode")
        if mode not in ("user", "search"):
            errors.append("mode doit être 'user' ou 'search'")
        if mode == "user" and not config.get("handle"):
            errors.append("handle requis pour le mode user")
        if mode == "search" and not config.get("query"):
            errors.append("query requis pour le mode search")
        return errors

    async def fetch(self, config: dict[str, Any]) -> list[dict]:
        mode = config["mode"]
        max_items = config.get("max_items", 25)

        async with httpx.AsyncClient(timeout=15) as client:
            if mode == "user":
                handle = config["handle"]
                r = await client.get(f"{BSKY_API}/app.bsky.actor.getProfile", params={"actor": handle})
                r.raise_for_status()
                did = r.json()["did"]
                r = await client.get(
                    f"{BSKY_API}/app.bsky.feed.getAuthorFeed",
                    params={"actor": did, "limit": max_items},
                )
                r.raise_for_status()
                feed = r.json().get("feed", [])
            else:
                r = await client.get(
                    f"{BSKY_API}/app.bsky.feed.searchPosts",
                    params={"q": config["query"], "limit": max_items},
                )
                r.raise_for_status()
                feed = [{"post": p} for p in r.json().get("posts", [])]

        rows = []
        for item in feed[:max_items]:
            post = item.get("post", {})
            record = post.get("record", {})
            text = record.get("text", "")
            author = post.get("author", {}).get("handle", "")
            uri = post.get("uri", "")
            parts = uri.replace("at://", "").split("/")
            web_url = (
                f"https://bsky.app/profile/{parts[0]}/post/{parts[-1]}"
                if len(parts) >= 3
                else uri
            )
            rows.append({
                "title": text[:200],
                "description": text,
                "link": web_url,
                "pubDate": record.get("createdAt", ""),
                "source": f"bluesky:@{author}",
            })
        return rows
