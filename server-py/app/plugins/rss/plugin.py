from typing import Any

from app.plugins.base import PluginMeta, SourcePlugin


class RssPlugin(SourcePlugin):
    @classmethod
    def meta(cls) -> PluginMeta:
        return PluginMeta(
            name="rss",
            display_name="RSS / Atom",
            description="Flux RSS 2.0 et Atom avec requêtes conditionnelles (ETag/Last-Modified).",
            version="1.0.0",
            icon="rss",
            supports_batch=True,
            default_refresh_seconds=900,
            config_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "format": "uri", "title": "URL du flux RSS"},
                    "max_items": {
                        "type": "integer",
                        "default": 30,
                        "minimum": 1,
                        "maximum": 100,
                        "title": "Nombre max d'articles",
                    },
                },
                "required": ["url"],
            },
        )

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        errors = []
        url = config.get("url", "")
        if not url:
            errors.append("url est requis")
        elif not url.startswith(("http://", "https://")):
            errors.append("url doit commencer par http:// ou https://")
        return errors

    async def fetch(self, config: dict[str, Any]) -> list[dict]:
        from app.source_engine.rss_fetcher import fetch_rss_feed

        return await fetch_rss_feed(config["url"], max_items=config.get("max_items", 30))
