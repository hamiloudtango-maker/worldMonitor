import importlib
import logging
from pathlib import Path

from app.plugins.base import SourcePlugin
from app.plugins.registry import plugin_registry

logger = logging.getLogger(__name__)
PLUGINS_DIR = Path(__file__).parent


def discover_plugins() -> int:
    count = 0
    for child in sorted(PLUGINS_DIR.iterdir()):
        if not child.is_dir() or child.name.startswith("_"):
            continue
        plugin_file = child / "plugin.py"
        if not plugin_file.exists():
            continue
        module_path = f"app.plugins.{child.name}.plugin"
        try:
            mod = importlib.import_module(module_path)
            for attr_name in dir(mod):
                attr = getattr(mod, attr_name)
                if (
                    isinstance(attr, type)
                    and issubclass(attr, SourcePlugin)
                    and attr is not SourcePlugin
                ):
                    meta = attr.meta()
                    plugin_registry.register_type(meta.name, attr)
                    count += 1
                    logger.info("Plugin discovered: %s (%s v%s)", meta.name, meta.display_name, meta.version)
                    break
        except Exception as e:
            logger.warning("Failed to load plugin %s: %s", child.name, e)
    return count
