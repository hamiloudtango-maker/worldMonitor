"""
Identity Card generator — uses Gemini Flash to build a structured profile
for a case entity (company, person, country, organization, etc.).
"""

import json
import logging
import re

from app.source_engine.detector import _call_gemini

logger = logging.getLogger(__name__)

_IDENTITY_PROMPT = """You are an intelligence analyst.
Generate a JSON identity card for the following entity.

Entity name: {name}
Entity type: {entity_type}
User description: {description}

Use the user description to enrich and guide your research. Respond ONLY with valid JSON (no markdown, no ```). Use this exact structure:
{{
  "description": "Two-sentence description of the entity.",
  "headquarters": "City, Country",
  "sector": "Primary sector or domain",
  "country_code": "XX",
  "founded": 2000,
  "website": "https://example.com",
  "key_people": [
    {{"name": "Full Name", "role": "Title"}},
    {{"name": "Full Name", "role": "Title"}},
    {{"name": "Full Name", "role": "Title"}}
  ],
  "revenue": "Estimated annual revenue or N/A",
  "aliases": ["Acronym", "Subsidiary Name", "Former Name"],
  "search_terms": ["key phrase 1", "key phrase 2", "related topic"]
}}

Rules:
- country_code must be ISO 3166-1 alpha-2 (e.g. US, FR, CN)
- key_people: maximum 3 entries
- If information is unknown, use null for that field
- founded must be a year number or null
- aliases: alternative names, acronyms, subsidiaries (e.g. ["Areva", "COGEMA"])
- search_terms: SHORT keywords (1-3 words each) to find news articles. Include competitors, related topics, locations. Do NOT prefix with entity name. Example for Orano: ["uranium", "nuclear fuel", "enrichment", "Cameco", "La Hague", "Niger uranium"]. Provide 5-15 terms.
"""


def _fallback_identity(name: str, entity_type: str) -> dict:
    """Return a skeleton identity card when LLM generation fails."""
    return {
        "description": f"{name} ({entity_type})",
        "headquarters": None,
        "sector": None,
        "country_code": None,
        "founded": None,
        "website": None,
        "key_people": [],
        "revenue": None,
        "aliases": [],
        "search_terms": [],
    }


async def generate_identity_card(name: str, entity_type: str, description: str = "") -> dict:
    """Call Gemini Flash to produce a structured identity card for a case entity."""
    try:
        prompt = _IDENTITY_PROMPT.format(name=name, entity_type=entity_type, description=description or "N/A")
        raw = await _call_gemini(prompt)

        # Clean markdown fences if present
        cleaned = raw.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

        return json.loads(cleaned.strip())
    except Exception:
        logger.warning("Identity card generation failed for %s, using fallback", name, exc_info=True)
        return _fallback_identity(name, entity_type)
