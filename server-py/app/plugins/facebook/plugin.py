from __future__ import annotations

import asyncio
from typing import Any

from app.plugins.base import PluginMeta, SourcePlugin


class FacebookPlugin(SourcePlugin):
    @classmethod
    def meta(cls) -> PluginMeta:
        return PluginMeta(
            name="facebook",
            display_name="Facebook Pages",
            description="Suivre des pages Facebook publiques via facebook-scraper.",
            version="1.0.0",
            icon="facebook",
            dependencies=["facebook-scraper"],
            default_refresh_seconds=3600,
            config_schema={
                "type": "object",
                "properties": {
                    "page_name": {"type": "string", "title": "Nom de la page Facebook"},
                    "max_items": {"type": "integer", "default": 20, "minimum": 1, "maximum": 50},
                },
                "required": ["page_name"],
            },
        )

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        errors = []
        if not config.get("page_name"):
            errors.append("page_name est requis")
        return errors

    async def fetch(self, config: dict[str, Any]) -> list[dict]:
        from facebook_scraper import get_posts

        page = config["page_name"]
        max_items = config.get("max_items", 20)
        loop = asyncio.get_event_loop()
        posts = await loop.run_in_executor(
            None,
            lambda: list(get_posts(page, pages=2, options={"posts_per_page": max_items})),
        )

        rows = []
        for post in posts[:max_items]:
            text = post.get("text") or post.get("post_text") or ""
            link = post.get("post_url") or f"https://facebook.com/{page}"
            rows.append({
                "title": text[:200],
                "description": text,
                "link": link,
                "pubDate": str(post.get("time", "")),
                "source": f"facebook:{page}",
            })
        return rows
