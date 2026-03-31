from __future__ import annotations

from typing import Any

import httpx

from app.plugins.base import PluginMeta, SourcePlugin


class TelegramPlugin(SourcePlugin):
    @classmethod
    def meta(cls) -> PluginMeta:
        return PluginMeta(
            name="telegram",
            display_name="Telegram Channels",
            description="Suivre des channels Telegram publics via scraping t.me.",
            version="1.0.0",
            icon="send",
            default_refresh_seconds=1800,
            config_schema={
                "type": "object",
                "properties": {
                    "channel": {"type": "string", "title": "Nom du channel (sans @)"},
                    "max_items": {"type": "integer", "default": 20, "minimum": 1, "maximum": 50},
                },
                "required": ["channel"],
            },
        )

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        errors = []
        if not config.get("channel"):
            errors.append("channel est requis")
        return errors

    async def fetch(self, config: dict[str, Any]) -> list[dict]:
        channel = config["channel"].lstrip("@")
        max_items = config.get("max_items", 20)

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"https://t.me/s/{channel}")
            resp.raise_for_status()

        from lxml import html

        tree = html.fromstring(resp.text)
        messages = tree.cssselect(".tgme_widget_message_wrap")

        rows = []
        for msg in messages[-max_items:]:
            text_el = msg.cssselect(".tgme_widget_message_text")
            text = text_el[0].text_content().strip() if text_el else ""
            link_el = msg.cssselect(".tgme_widget_message_date")
            link = link_el[0].get("href", "") if link_el else ""
            date_el = msg.cssselect("time")
            date = date_el[0].get("datetime", "") if date_el else ""
            if text:
                rows.append({
                    "title": text[:200],
                    "description": text,
                    "link": link,
                    "pubDate": date,
                    "source": f"telegram:@{channel}",
                })
        return rows
