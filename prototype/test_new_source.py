"""Test une nouvelle source jamais vue."""

import json
import time
from source_detector import detect_source, parse_with_template

# NOAA Solar Flare alerts - structure differente de tout ce qu'on a teste
URL = "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json"


def main():
    tpl = detect_source(URL)

    print(f"\n  Result:")
    print(f"    ID:       {tpl.get('source_id')}")
    print(f"    Type:     {tpl.get('source_type')}")
    print(f"    Category: {tpl.get('category')}")
    print(f"    Fields:   {len(tpl.get('fields', []))}")
    print(f"    Panel:    {tpl.get('panel', {}).get('title')}")
    print(f"    Display:  {tpl.get('panel', {}).get('display')}")
    for f in tpl.get("fields", []):
        print(f"      - {f['name']:20s} ({f['type']:10s}) {f['path']}")

    # Phase 2
    t0 = time.time()
    rows = parse_with_template(tpl)
    elapsed = time.time() - t0

    print(f"\n  Phase 2: {len(rows)} items in {elapsed:.2f}s (NO LLM)")
    for i, row in enumerate(rows[:5]):
        summary = {k: (str(v)[:60] if v else None) for k, v in row.items()}
        print(f"    [{i}] {json.dumps(summary, ensure_ascii=False)}")
    if len(rows) > 5:
        print(f"    ... +{len(rows)-5} more")


if __name__ == "__main__":
    main()
