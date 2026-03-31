from __future__ import annotations

import hashlib
from typing import Any

import httpx

from app.plugins.base import PluginMeta, SourcePlugin


class WebScraperPlugin(SourcePlugin):
    @classmethod
    def meta(cls) -> PluginMeta:
        return PluginMeta(
            name="web_scraper",
            display_name="Web Scraper / Track Changes",
            description="Suivre les changements sur des pages web sans RSS.",
            version="1.0.0",
            icon="globe",
            default_refresh_seconds=3600,
            config_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "format": "uri", "title": "URL de la page"},
                    "selector": {"type": "string", "title": "Sélecteur CSS (optionnel)", "default": ""},
                },
                "required": ["url"],
            },
        )

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        errors = []
        if not config.get("url"):
            errors.append("url est requis")
        return errors

    async def fetch(self, config: dict[str, Any]) -> list[dict]:
        url = config["url"]
        selector = config.get("selector", "")

        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()

        from lxml import html

        tree = html.fromstring(resp.text)

        if selector:
            elements = tree.cssselect(selector)
            texts = [el.text_content().strip() for el in elements if el.text_content().strip()]
        else:
            for tag in tree.cssselect("script, style, nav, header, footer"):
                tag.getparent().remove(tag)
            texts = [tree.text_content().strip()]

        rows = []
        for text in texts[:10]:
            h = hashlib.sha256(text[:500].encode()).hexdigest()[:16]
            rows.append({
                "title": text[:200],
                "description": text[:2000],
                "link": f"{url}#change-{h}",
                "pubDate": "",
                "source": f"web:{url[:80]}",
            })
        return rows
