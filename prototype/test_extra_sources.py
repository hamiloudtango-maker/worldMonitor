"""
Test sur 2 sources supplementaires jamais vues pour valider que
le pipeline template LLM -> parse autonome est robuste.

1. NASA EONET (Natural Events) - JSON nested
2. Al Jazeera RSS - XML avec namespaces differents
"""

import json
import time
from pathlib import Path
from source_detector import detect_source, parse_with_template

EXTRA_SOURCES = [
    # JSON nested avec geometry complexe
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20",
    # RSS avec structure differente de BBC
    "https://www.aljazeera.com/xml/rss/all.xml",
]


def main():
    for url in EXTRA_SOURCES:
        try:
            # Phase 1: LLM
            tpl = detect_source(url)

            print(f"\n  Result:")
            print(f"    ID:       {tpl.get('source_id')}")
            print(f"    Type:     {tpl.get('source_type')}")
            print(f"    Category: {tpl.get('category')}")
            print(f"    Fields:   {len(tpl.get('fields', []))}")
            print(f"    Panel:    {tpl.get('panel', {}).get('title')}")
            print(f"    Display:  {tpl.get('panel', {}).get('display')}")
            for f in tpl.get("fields", []):
                print(f"      - {f['name']:20s} ({f['type']:10s}) {f['path']}")

            # Phase 2: No LLM
            t0 = time.time()
            rows = parse_with_template(tpl)
            elapsed = time.time() - t0

            print(f"\n  Phase 2: {len(rows)} items in {elapsed:.2f}s (NO LLM)")
            for i, row in enumerate(rows[:3]):
                summary = {k: (str(v)[:60] if v else None) for k, v in row.items()}
                print(f"    [{i}] {json.dumps(summary, ensure_ascii=False)}")
            if len(rows) > 3:
                print(f"    ... +{len(rows)-3} more")

        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()

    print("\nDone.")


if __name__ == "__main__":
    main()
