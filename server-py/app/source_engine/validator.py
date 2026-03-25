"""
Template validator — verifies a template produces valid data.
Fetches the URL, parses with the template, checks rows > 0 and field coverage.
"""

from datetime import datetime, timezone

from app.source_engine.detector import fetch_raw
from app.source_engine.parser import parse_with_template
from app.source_engine.schemas import SourceTemplate, ValidationResult


async def validate_template(template: SourceTemplate) -> ValidationResult:
    """Fetch source, parse with template, verify results."""
    errors: list[str] = []

    # Step 1: Fetch
    try:
        _, raw = await fetch_raw(template.url)
    except Exception as e:
        return ValidationResult(
            last_validated_at=datetime.now(timezone.utc),
            row_count=0,
            errors=[f"Fetch failed: {e}"],
        )

    # Step 2: Parse
    try:
        rows = parse_with_template(raw, template)
    except Exception as e:
        return ValidationResult(
            last_validated_at=datetime.now(timezone.utc),
            row_count=0,
            errors=[f"Parse failed: {e}"],
        )

    # Step 3: Check rows
    if not rows:
        errors.append("No rows parsed")
        return ValidationResult(
            last_validated_at=datetime.now(timezone.utc),
            row_count=0,
            errors=errors,
        )

    # Step 4: Check field coverage — each panel column should have ≥1 non-null value
    first_row = rows[0]
    for col in template.panel.columns:
        if col not in first_row:
            errors.append(f"Column '{col}' not found in parsed fields")
        elif first_row[col] is None:
            # Check if any row has this field non-null
            has_value = any(r.get(col) is not None for r in rows[:10])
            if not has_value:
                errors.append(f"Column '{col}' is null in all sampled rows")

    return ValidationResult(
        last_validated_at=datetime.now(timezone.utc),
        row_count=len(rows),
        sample_row=dict(rows[0]) if rows else None,
        errors=errors,
    )
