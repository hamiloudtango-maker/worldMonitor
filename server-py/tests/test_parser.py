"""Tests for source engine parser — uses prototype templates as fixtures."""

import json
from pathlib import Path

import httpx
import pytest

from app.source_engine.parser import parse_rss, parse_json, parse_with_template
from app.source_engine.schemas import SourceTemplate

TEMPLATES_DIR = Path(__file__).parent.parent.parent / "prototype" / "templates"


def load_template(name: str) -> SourceTemplate:
    path = TEMPLATES_DIR / f"{name}.json"
    if not path.exists():
        pytest.skip(f"Template {name} not found at {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    return SourceTemplate(**data)


@pytest.mark.asyncio
async def test_parse_bbc_rss():
    tpl = load_template("bbc_world_news")
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(tpl.url, headers={"User-Agent": "WorldMonitor/2.0"})
        resp.raise_for_status()

    rows = parse_with_template(resp.text, tpl)
    assert len(rows) > 10, f"Expected >10 rows, got {len(rows)}"

    first = rows[0]
    non_null = sum(1 for v in first.values() if v is not None)
    fill_ratio = non_null / len(first)
    assert fill_ratio > 0.5, f"Expected >50% fill, got {fill_ratio:.0%} ({non_null}/{len(first)})"


@pytest.mark.asyncio
async def test_parse_usgs_json():
    tpl = load_template("usgs_earthquakes_significant_month")
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(tpl.url, headers={"User-Agent": "WorldMonitor/2.0"})
        resp.raise_for_status()

    rows = parse_with_template(resp.text, tpl)
    assert len(rows) >= 1, f"Expected >=1 rows, got {len(rows)}"

    first = rows[0]
    non_null = sum(1 for v in first.values() if v is not None)
    fill_ratio = non_null / len(first)
    assert fill_ratio > 0.5, f"Expected >50% fill, got {fill_ratio:.0%}"


def test_parse_rss_minimal():
    xml = """<?xml version="1.0"?>
    <rss><channel>
        <item><title>Hello</title><link>http://example.com</link></item>
        <item><title>World</title><link>http://example.com/2</link></item>
    </channel></rss>"""
    fields = [
        {"name": "title", "path": "title", "type": "string"},
        {"name": "link", "path": "link", "type": "url"},
    ]
    from app.source_engine.schemas import FieldDef
    rows = parse_rss(xml, [FieldDef(**f) for f in fields], None)
    assert len(rows) == 2
    assert rows[0]["title"] == "Hello"
    assert rows[1]["link"] == "http://example.com/2"


def test_parse_json_array():
    raw = json.dumps([
        {"name": "Bitcoin", "price": 70000},
        {"name": "Ethereum", "price": 2000},
    ])
    from app.source_engine.schemas import FieldDef
    fields = [
        FieldDef(name="name", path="name", type="string"),
        FieldDef(name="price", path="price", type="number"),
    ]
    rows = parse_json(raw, fields)
    assert len(rows) == 2
    assert rows[0]["name"] == "Bitcoin"
    assert rows[0]["price"] == 70000


def test_parse_json_nested_with_wildcard():
    raw = json.dumps({
        "features": [
            {"properties": {"title": "Quake 1", "mag": 5.0}},
            {"properties": {"title": "Quake 2", "mag": 7.3}},
        ]
    })
    from app.source_engine.schemas import FieldDef
    fields = [
        FieldDef(name="title", path="$.features[*].properties.title", type="string"),
        FieldDef(name="mag", path="$.features[*].properties.mag", type="number"),
    ]
    rows = parse_json(raw, fields)
    assert len(rows) == 2
    assert rows[1]["mag"] == 7.3
