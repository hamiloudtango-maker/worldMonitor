"""
Keyword-based threat classifier — port of WorldMonitor v1 threat-classifier.ts.
Covers ~70% of articles without any LLM call.
"""

import re

# Theme categories
THEMES = [
    "conflict", "protest", "disaster", "diplomatic", "economic",
    "terrorism", "cyber", "health", "environmental", "military",
    "crime", "infrastructure", "tech", "general",
]

THREAT_LEVELS = ["critical", "high", "medium", "low", "info"]

# ── Keyword maps ──────────────────────────────────────────────

CRITICAL: dict[str, str] = {
    "nuclear strike": "military", "nuclear attack": "military", "nuclear war": "military",
    "invasion": "conflict", "declaration of war": "conflict", "declares war": "conflict",
    "all-out war": "conflict", "full-scale war": "conflict",
    "martial law": "military", "coup": "military", "coup attempt": "military",
    "genocide": "conflict", "ethnic cleansing": "conflict",
    "chemical attack": "terrorism", "biological attack": "terrorism", "dirty bomb": "terrorism",
    "mass casualty": "conflict", "massive strikes": "conflict",
    "pandemic declared": "health", "health emergency": "health",
    "nato article 5": "military", "evacuation order": "disaster",
    "meltdown": "disaster", "nuclear meltdown": "disaster",
    "launches strikes on iran": "military", "attacks iran": "military", "strikes iran": "military",
}

HIGH: dict[str, str] = {
    "war": "conflict", "armed conflict": "conflict", "airstrike": "conflict",
    "drone strike": "conflict", "missile": "military", "missile launch": "military",
    "troops deployed": "military", "military escalation": "military",
    "military operation": "military", "ground offensive": "military",
    "bombing": "conflict", "bombardment": "conflict", "shelling": "conflict",
    "casualties": "conflict", "killed in": "conflict",
    "hostage": "terrorism", "terrorist": "terrorism", "terror attack": "terrorism",
    "assassination": "crime", "sanctions": "economic", "embargo": "economic",
    "cyber attack": "cyber", "ransomware": "cyber", "data breach": "cyber",
    "earthquake": "disaster", "tsunami": "disaster", "hurricane": "disaster",
    "typhoon": "disaster", "explosions": "conflict",
    "retaliatory strike": "military", "ballistic missile": "military",
    "major outage": "tech", "global outage": "tech",
    "zero-day": "cyber", "critical vulnerability": "cyber", "mass layoff": "tech",
}

MEDIUM: dict[str, str] = {
    "protest": "protest", "protests": "protest", "riot": "protest", "riots": "protest",
    "unrest": "protest", "military exercise": "military", "naval exercise": "military",
    "arms deal": "military", "diplomatic crisis": "diplomatic",
    "ambassador recalled": "diplomatic", "trade war": "economic", "tariff": "economic",
    "recession": "economic", "market crash": "economic",
    "flood": "disaster", "wildfire": "disaster", "volcano": "disaster", "eruption": "disaster",
    "outbreak": "health", "epidemic": "health", "pipeline explosion": "infrastructure",
    "outage": "tech", "breach": "cyber", "hack": "cyber",
    "vulnerability": "cyber", "layoff": "tech", "antitrust": "tech",
}

LOW: dict[str, str] = {
    "election": "diplomatic", "vote": "diplomatic", "referendum": "diplomatic",
    "summit": "diplomatic", "treaty": "diplomatic",
    "climate change": "environmental", "emissions": "environmental",
    "pollution": "environmental", "deforestation": "environmental",
    "vaccine": "health", "vaccination": "health", "disease": "health",
    "interest rate": "economic", "gdp": "economic", "unemployment": "economic",
    "regulation": "economic", "ipo": "tech", "funding": "tech",
    "acquisition": "economic", "merger": "economic",
}

# Words that should NOT trigger classification
EXCLUSIONS = {
    "protein", "couples", "relationship", "diet", "fitness", "recipe",
    "cooking", "fashion", "celebrity", "movie", "sports", "game",
    "concert", "wedding", "strikes deal", "strikes agreement", "strikes partnership",
}

# Short words need word boundary matching
SHORT_WORDS = {"war", "coup", "ban", "vote", "riot", "hack", "gdp", "flood"}

# Escalation: if HIGH conflict/military + geopolitical target → bump to CRITICAL
_ESCALATION_ACTION = re.compile(r"\b(attack|strike|bomb|missile|offensive|retaliates|killed)\b", re.I)
_ESCALATION_TARGET = re.compile(r"\b(iran|russia|china|taiwan|nato|us base|us forces)\b", re.I)

CONFIDENCE = {"critical": 0.90, "high": 0.80, "medium": 0.70, "low": 0.60, "info": 0.30}


def classify(title: str, description: str = "") -> dict:
    """
    Classify an article by threat level and theme using keywords.
    Returns: {"threat_level": str, "theme": str, "confidence": float, "source": "keyword"}
    or None if no match.
    """
    text = f"{title} {description}".lower()

    # Check exclusions
    for ex in EXCLUSIONS:
        if ex in text:
            return {"threat_level": "info", "theme": "general", "confidence": 0.30, "source": "keyword"}

    # Check each level (highest first)
    for level, keywords in [("critical", CRITICAL), ("high", HIGH), ("medium", MEDIUM), ("low", LOW)]:
        for kw, theme in keywords.items():
            if kw in SHORT_WORDS:
                if re.search(rf"\b{re.escape(kw)}\b", text):
                    return _maybe_escalate(level, theme, text)
            elif kw in text:
                return _maybe_escalate(level, theme, text)

    return {"threat_level": "info", "theme": "general", "confidence": 0.30, "source": "keyword"}


def _maybe_escalate(level: str, theme: str, text: str) -> dict:
    """Escalate HIGH conflict/military to CRITICAL if geopolitical target present."""
    if level == "high" and theme in ("conflict", "military"):
        if _ESCALATION_ACTION.search(text) and _ESCALATION_TARGET.search(text):
            return {"threat_level": "critical", "theme": theme, "confidence": 0.85, "source": "keyword"}
    return {"threat_level": level, "theme": theme, "confidence": CONFIDENCE[level], "source": "keyword"}
