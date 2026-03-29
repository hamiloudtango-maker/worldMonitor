"""
RSS catalog ingestion — fetch all active catalog feeds and run through article pipeline.

Architecture:
  1. Fetch all feeds in parallel (batches of 10) — network only, no LLM
  2. Dedup + classify locally — fast, no LLM
  3. One big batch LLM enrichment for ALL new articles across all feeds
  4. Store

This minimizes LLM calls: instead of 1 call per feed, we make ceil(new_articles/10) calls total.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, update

from app.models.ai_feed import RssCatalogEntry
from app.source_engine.rss_fetcher import fetch_rss_feed_conditional
from app.source_engine.article_pipeline import dedup_and_prepare_bulk, enrich_and_store, LLM_BATCH_SIZE

logger = logging.getLogger(__name__)

# Timestamp of last completed ingestion cycle
last_cycle_completed_at: datetime | None = None

BATCH_SIZE = 20
ERROR_THRESHOLD = 5
ERROR_BACKOFF_HOURS = 1


def _classify_error(e: Exception) -> str:
    """Classify a feed error into a human-readable category."""
    msg = str(e)
    if '404' in msg: return "Feed introuvable (404)"
    if '403' in msg: return "Acces refuse (403)"
    if '405' in msg: return "Methode non autorisee (405)"
    if '500' in msg or '502' in msg or '503' in msg: return "Serveur en panne"
    if '526' in msg: return "Erreur SSL serveur"
    if 'self-signed' in msg or 'ssl' in msg.lower(): return "Certificat SSL invalide"
    if 'StartTag' in msg or 'Start tag' in msg or 'XML' in msg: return "Reponse HTML au lieu de RSS"
    if 'EntityRef' in msg or 'xmlParse' in msg: return "RSS XML malforme"
    if 'Specification' in msg: return "HTML invalide (pas du RSS)"
    if 'Redirect' in msg: return "Redirection bloquee"
    if 'Timeout' in msg or 'timeout' in msg: return "Timeout"
    if 'Connection' in msg: return "Connexion impossible"
    return msg[:100]


DISABLE_THRESHOLD = 10  # Disable feed after this many consecutive errors


async def _fetch_one(feed) -> tuple:
    """Fetch a single feed (network only). Returns (feed_id, name, source_id, rows, success, new_etag, new_lm, error_count, error_msg)."""
    feed_id, url, name, error_count, etag, last_modified = feed
    source_id = f"catalog_{name.lower().replace(' ', '_')}"

    try:
        rows, new_etag, new_lm = await fetch_rss_feed_conditional(
            url, etag=etag, last_modified=last_modified,
        )
        return feed_id, name, source_id, rows, True, new_etag, new_lm, error_count, None
    except Exception as e:
        logger.warning(f"Catalog ingest '{name}' failed: {e}")
        return feed_id, name, source_id, None, False, etag, last_modified, error_count, _classify_error(e)


async def ingest_full_catalog(db, db_session_factory=None) -> int:
    """Ingest all active RSS catalog feeds. Returns total new articles inserted."""
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(
            RssCatalogEntry.id, RssCatalogEntry.url, RssCatalogEntry.name,
            RssCatalogEntry.fetch_error_count, RssCatalogEntry.etag,
            RssCatalogEntry.last_modified, RssCatalogEntry.last_fetched_at,
        )
        .where(RssCatalogEntry.active == True)
    )
    all_feeds = result.all()

    # ── Phase 0: Filter out feeds in error backoff ──
    feeds = []
    skipped = 0
    for f in all_feeds:
        feed_id, url, name, error_count, etag, last_modified, last_fetched = f
        if error_count >= ERROR_THRESHOLD and last_fetched:
            lf = last_fetched
            if isinstance(lf, str):
                try:
                    lf = datetime.fromisoformat(lf)
                except ValueError:
                    lf = None
            if lf and lf.tzinfo is None:
                lf = lf.replace(tzinfo=timezone.utc)
            if lf and (now - lf) < timedelta(hours=ERROR_BACKOFF_HOURS):
                skipped += 1
                continue
        feeds.append((feed_id, url, name, error_count, etag, last_modified))

    if db_session_factory is None:
        from app.db import async_session
        db_session_factory = async_session

    # ── Phase 1: Fetch all feeds in parallel (network only, no LLM) ──
    print(f"[INGEST] Phase 1: fetching {len(feeds)} feeds in batches of {BATCH_SIZE}...")
    all_results = []
    for batch_start in range(0, len(feeds), BATCH_SIZE):
        batch = feeds[batch_start:batch_start + BATCH_SIZE]
        tasks = [_fetch_one(f) for f in batch]
        all_results.extend(await asyncio.gather(*tasks, return_exceptions=True))
    print(f"[INGEST] Phase 1 done: {len(all_results)} results")

    # ── Phase 2: Collect all new rows + bulk dedup (1 DB query) ──
    total_304 = 0
    feed_updates = []
    feed_rows: list[tuple[str, list]] = []

    for res in all_results:
        if isinstance(res, Exception):
            continue

        feed_id, name, source_id, rows, success, new_etag, new_lm, error_count, error_msg = res
        feed_updates.append((feed_id, success, new_etag, new_lm, error_count, error_msg))

        if not success:
            continue
        if rows is None:
            total_304 += 1
            continue
        if rows:
            feed_rows.append((source_id, rows))

    total_rows = sum(len(rows) for _, rows in feed_rows)
    print(f"[INGEST] Phase 2: dedup {total_rows} articles from {len(feed_rows)} feeds...")
    all_prepared = await dedup_and_prepare_bulk(db, feed_rows)
    print(f"[INGEST] Phase 2 done: {len(all_prepared)} new articles to enrich")

    # ── Phase 3: One big batch LLM enrichment + store ──
    total_inserted = 0
    if all_prepared:
        print(f"[INGEST] Phase 3: enriching {len(all_prepared)} articles (batch={LLM_BATCH_SIZE})...")
        total_inserted = await enrich_and_store(db, all_prepared)
        print(f"[INGEST] Phase 3 done: {total_inserted} inserted")

    # ── Phase 4: Update feed metadata + auto-disable broken feeds ──
    print(f"[INGEST] Phase 4: updating {len(feed_updates)} feeds...")
    async with db_session_factory() as meta_db:
        try:
            # Success feeds: reset errors, update etag
            for fid, success, new_etag, new_lm, ec, err in feed_updates:
                if success:
                    vals: dict = {"last_fetched_at": now, "fetch_error_count": 0, "last_error": None}
                    if new_etag: vals["etag"] = new_etag
                    if new_lm: vals["last_modified"] = new_lm
                    await meta_db.execute(
                        update(RssCatalogEntry).where(RssCatalogEntry.id == fid).values(**vals)
                    )

            # Error feeds: increment count, store error, auto-disable if threshold reached
            disabled = 0
            for fid, success, _, _, ec, err in feed_updates:
                if not success:
                    new_count = ec + 1
                    vals = {"fetch_error_count": new_count, "last_error": err}
                    if new_count >= DISABLE_THRESHOLD:
                        vals["active"] = False
                        disabled += 1
                    await meta_db.execute(
                        update(RssCatalogEntry).where(RssCatalogEntry.id == fid).values(**vals)
                    )

            await meta_db.commit()
            if disabled:
                print(f"[INGEST] Auto-disabled {disabled} feeds (>{DISABLE_THRESHOLD} errors)")
        except Exception as e:
            print(f"[INGEST] Phase 4 error: {e}")
            await meta_db.rollback()

    global last_cycle_completed_at
    last_cycle_completed_at = datetime.now(timezone.utc)

    elapsed = (last_cycle_completed_at - now).total_seconds()
    llm_calls = (len(all_prepared) + LLM_BATCH_SIZE - 1) // LLM_BATCH_SIZE if all_prepared else 0
    print(
        f"[INGEST] {total_inserted} new articles, {len(feeds)} feeds fetched, "
        f"{total_304} unchanged (304), {skipped} backoff-skipped, "
        f"{llm_calls} LLM calls, {elapsed:.1f}s"
    )
    return total_inserted
