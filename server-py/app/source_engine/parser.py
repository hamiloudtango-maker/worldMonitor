"""
Source parser — autonomous parsing using templates (NO LLM).
Port of prototype/source_detector.py Phase 2.
Supports: RSS/XML (lxml) and JSON APIs (jsonpath-ng).
"""

import json

from jsonpath_ng.ext import parse as jsonpath_parse
from lxml import etree

from app.source_engine.schemas import FieldDef, ParsedRow, SourceTemplate

# Standard RSS/Atom namespaces
_DEFAULT_NS = {
    "media": "http://search.yahoo.com/mrss/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "atom": "http://www.w3.org/2005/Atom",
    "content": "http://purl.org/rss/1.0/modules/content/",
}


def parse_rss(raw: str, fields: list[FieldDef], namespaces: dict[str, str] | None) -> list[ParsedRow]:
    """Parse RSS/XML using lxml XPath, driven by template fields."""
    root = etree.fromstring(raw.encode("utf-8"))

    nsmap = dict(_DEFAULT_NS)
    if namespaces:
        nsmap.update(namespaces)

    # Find items (RSS 2.0 or Atom)
    items = root.xpath("//item", namespaces=nsmap)
    if not items:
        items = root.xpath("//atom:entry", namespaces=nsmap)

    rows: list[ParsedRow] = []
    for item in items:
        row: ParsedRow = {}
        for f in fields:
            xpath = f.path
            # Normalize to relative path (relative to each item)
            for prefix in ("//item/", "//entry/", "/rss/channel/item/", "/feed/entry/"):
                if xpath.startswith(prefix):
                    xpath = xpath[len(prefix):]
                    break
            xpath = xpath.lstrip("/")

            results = item.xpath(xpath, namespaces=nsmap)
            if results:
                val = results[0]
                if isinstance(val, etree._Element):
                    row[f.name] = val.text
                else:
                    row[f.name] = str(val)
            else:
                row[f.name] = None
        rows.append(row)
    return rows


def parse_json(raw: str, fields: list[FieldDef]) -> list[ParsedRow]:
    """Parse JSON using jsonpath-ng, driven by template fields."""
    data = json.loads(raw)

    # Detect if paths use [*] (absolute) or not (relative)
    sample_path = fields[0].path if fields else "$"
    has_wildcard = "[*]" in sample_path

    if has_wildcard:
        # Absolute paths like $.features[*].properties.mag
        columns: dict[str, list] = {}
        max_len = 0
        for f in fields:
            try:
                expr = jsonpath_parse(f.path)
                matches = expr.find(data)
                values = [m.value for m in matches]
            except Exception:
                values = []
            columns[f.name] = values
            max_len = max(max_len, len(values))

        rows: list[ParsedRow] = []
        for i in range(max_len):
            row: ParsedRow = {}
            for f in fields:
                vals = columns[f.name]
                row[f.name] = vals[i] if i < len(vals) else None
            rows.append(row)
        return rows
    else:
        # Relative paths — data is a list or has an array to find
        items = data if isinstance(data, list) else None

        if items is None:
            for key in ("features", "results", "data", "items", "records", "entries", "events"):
                if isinstance(data.get(key), list):
                    items = data[key]
                    break

        if items is None:
            items = [data]  # Single object

        rows = []
        for item in items:
            row: ParsedRow = {}
            for f in fields:
                rel_path = "$." + f.path.lstrip("$.")
                try:
                    expr = jsonpath_parse(rel_path)
                    matches = expr.find(item)
                    row[f.name] = matches[0].value if matches else None
                except Exception:
                    row[f.name] = None
            rows.append(row)
        return rows


def parse_with_template(raw: str, template: SourceTemplate) -> list[ParsedRow]:
    """Parse raw content using a source template. Dispatches to RSS or JSON parser."""
    if template.source_type == "rss":
        return parse_rss(raw, template.fields, template.namespaces)
    elif template.source_type == "json_api":
        return parse_json(raw, template.fields)
    else:
        raise ValueError(f"Unsupported source_type: {template.source_type}")
