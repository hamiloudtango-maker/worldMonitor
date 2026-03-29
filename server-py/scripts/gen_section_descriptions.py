"""Generate section reference descriptions via Gemini for embedding."""
import asyncio
import json
import re
import sys
sys.path.insert(0, ".")

import httpx
from app.source_engine.detector import call_gemini
from app.domains.ai_feeds.taxonomy import FAMILIES, SECTIONS

PROMPT_TEMPLATE = """You are building reference descriptions for a news article classification system.
Each description will be converted to a semantic embedding vector, so it must capture the FULL semantic field of the section.

For each section below, write a RICH description (40-60 words) that:
- Lists the main topics, subtopics, and concepts covered
- Includes concrete examples of what articles in this section discuss
- Uses diverse vocabulary (synonyms, related terms) to maximize embedding coverage
- Covers both English and French key terms naturally
- Is dense with discriminating keywords — no filler words

Example for cyber/Attacks:
"Cyberattacks, ransomware incidents, malware infections, phishing campaigns, data breaches and leaks, DDoS attacks, network intrusions, hacking operations, digital espionage, cyber warfare. Includes piratage informatique, rançongiciel, fuite de données. Covers both state-sponsored and criminal cyber operations targeting infrastructure, companies, and governments."

Sections:
{sections}

Return ONLY valid JSON (no markdown):
{{"sections": {{"family/Section": "description", ...}}}}"""


async def main():
    all_keys = []
    for fam, secs in SECTIONS.items():
        for sec in secs:
            all_keys.append(f"{fam}/{sec}")

    # Split in small batches to avoid timeout
    batch_size = 10
    batches = [all_keys[i:i+batch_size] for i in range(0, len(all_keys), batch_size)]
    all_results = {}

    # Get auth token once
    import google.auth
    import google.auth.transport.requests
    creds, _ = google.auth.default()
    creds.refresh(google.auth.transport.requests.Request())
    token = creds.token

    async with httpx.AsyncClient(timeout=120) as client:
        for i, batch in enumerate(batches):
            prompt = PROMPT_TEMPLATE.format(sections="\n".join(batch))
            print(f"Batch {i+1}/{len(batches)} ({len(batch)} sections)...", file=sys.stderr)
            raw = await call_gemini(prompt, client=client, token=token)
            cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
            cleaned = re.sub(r"\s*```$", "", cleaned)
            data = json.loads(cleaned)
            all_results.update(data.get("sections", {}))

    print("SECTION_DESCRIPTIONS: dict[tuple[str, str], str] = {")
    for key in sorted(all_results.keys()):
        parts = key.split("/", 1)
        if len(parts) == 2:
            fam, sec = parts
            desc = all_results[key].replace('"', '\\"')
            print(f'    ("{fam}", "{sec}"): "{desc}",')
    print("}")
    print(f"\n# {len(all_results)} descriptions generated", file=sys.stderr)


asyncio.run(main())
