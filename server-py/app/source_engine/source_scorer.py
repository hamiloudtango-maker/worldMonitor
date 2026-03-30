"""
Source priority scorer — ranks RSS sources by usage and consultation patterns.

Score formula:
  +30  per feed using this source (strong signal: user chose it)
  +50  per widget view in last 7 days (capped at 200)
  +40  if tier 1 (wire agency), +20 if tier 2 (major outlet)
  +log2(articles) * 10  for article volume last 7 days (diminishing returns)
  -2   per day of inactivity (no views), floor 0

Priority bands:
  high   = top 30% -> refresh every 15 min
  medium = next 30% -> refresh every 1h
  low    = remaining 40% -> refresh every 2h
"""

import logging
import math
import uuid as _uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, update, text

logger = logging.getLogger(__name__)


async def recompute_priorities(db) -> dict[str, int]:
    """Recompute priority for all active sources. Returns {priority: count}."""
    from app.models.ai_feed import RssCatalogEntry, AIFeedSource

    sources = (await db.execute(
        select(
            RssCatalogEntry.id, RssCatalogEntry.name, RssCatalogEntry.tier,
            RssCatalogEntry.view_count, RssCatalogEntry.last_viewed_at,
            RssCatalogEntry.priority_score,
        )
        .where(RssCatalogEntry.active == True)
    )).all()

    if not sources:
        return {}

    scores: dict[str, int] = {}
    name_to_id: dict[str, str] = {}
    now = datetime.now(timezone.utc)
    cutoff_7d = now - timedelta(days=7)

    for s in sources:
        sid = s[0] if isinstance(s[0], str) else s[0].hex
        scores[sid] = 0
        name_to_id[s[1].lower()] = sid

        # Tier bonus (structural importance)
        tier = s[2] or 3
        if tier == 1:
            scores[sid] += 40
        elif tier == 2:
            scores[sid] += 20

        # View bonus / inactivity decay
        views = s[3] or 0
        last_viewed = s[4]
        prev_score = s[5] or 0
        if last_viewed:
            if isinstance(last_viewed, str):
                try:
                    last_viewed = datetime.fromisoformat(last_viewed)
                except ValueError:
                    last_viewed = None
            if last_viewed and last_viewed.tzinfo is None:
                last_viewed = last_viewed.replace(tzinfo=timezone.utc)
            if last_viewed and last_viewed > cutoff_7d:
                scores[sid] += min(views, 50) * 4  # cap 200 pts
            else:
                days_idle = (now - last_viewed).days if last_viewed else 7
                scores[sid] -= min(days_idle * 2, prev_score)
        else:
            scores[sid] -= min(14, prev_score)

    # Feed usage: +30 per feed referencing this source
    url_to_id = {}
    url_rows = (await db.execute(
        select(RssCatalogEntry.id, RssCatalogEntry.url)
        .where(RssCatalogEntry.active == True)
    )).all()
    for r in url_rows:
        uid = r[0] if isinstance(r[0], str) else r[0].hex
        url_to_id[r[1]] = uid

    feed_counts = (await db.execute(
        select(AIFeedSource.url, func.count(AIFeedSource.id))
        .group_by(AIFeedSource.url)
    )).all()

    for url, count in feed_counts:
        sid = url_to_id.get(url)
        if sid and sid in scores:
            scores[sid] += count * 30

    # Article volume: logarithmic (diminishing returns)
    art_counts = (await db.execute(
        text("""
            SELECT source_id, count(*) as c
            FROM articles
            WHERE created_at > :cutoff AND source_id LIKE 'catalog_%'
            GROUP BY source_id
        """),
        {"cutoff": cutoff_7d.isoformat()}
    )).all()

    for source_id, count in art_counts:
        cat_name = source_id.replace("catalog_", "").replace("_", " ").lower()
        sid = name_to_id.get(cat_name)
        if not sid:
            for name, s_id in name_to_id.items():
                if name.replace(" ", "_") == source_id.replace("catalog_", "").lower():
                    sid = s_id
                    break
        if sid and sid in scores:
            # log2(10)=3.3 -> 33pts, log2(100)=6.6 -> 66pts, log2(500)=9 -> 90pts
            scores[sid] += int(math.log2(max(count, 1)) * 10)

    # Floor at 0
    scores = {sid: max(0, score) for sid, score in scores.items()}

    # Sort and assign bands
    sorted_sources = sorted(scores.items(), key=lambda x: -x[1])
    total = len(sorted_sources)
    high_cutoff = max(1, int(total * 0.30))
    medium_cutoff = high_cutoff + max(1, int(total * 0.30))

    results = {"high": 0, "medium": 0, "low": 0}
    for i, (sid, score) in enumerate(sorted_sources):
        if i < high_cutoff:
            priority = "high"
        elif i < medium_cutoff:
            priority = "medium"
        else:
            priority = "low"

        results[priority] += 1
        try:
            sid_val = _uuid.UUID(sid) if len(sid) == 32 else sid
        except Exception:
            sid_val = sid

        await db.execute(
            update(RssCatalogEntry)
            .where(RssCatalogEntry.id == sid_val)
            .values(priority=priority, priority_score=score)
        )

    await db.commit()
    logger.info(
        f"Priority recomputed: {results['high']} high, {results['medium']} medium, {results['low']} low "
        f"(top={sorted_sources[0][1] if sorted_sources else 0}, min={sorted_sources[-1][1] if sorted_sources else 0})"
    )
    return results
