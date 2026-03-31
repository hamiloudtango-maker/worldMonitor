"""
Semantic duplicate detection — detect same news from different sources.
Uses MiniLM-L6-v2 embeddings + cosine similarity.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

import numpy as np
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article

logger = logging.getLogger(__name__)

DEDUP_WINDOW_HOURS = 48
DEDUP_SIMILARITY_THRESHOLD = 0.85


async def compute_embeddings_batch(articles: list[Article]) -> dict[str, np.ndarray]:
    """Compute MiniLM embeddings for a batch of articles."""
    from app.source_engine.matching_engine import _get_encoder

    encoder = _get_encoder()
    if encoder is None:
        return {}

    texts = [f"{a.title or ''} {a.description or ''}" for a in articles]
    vectors = encoder.encode(texts, normalize_embeddings=True, batch_size=64)
    return {str(a.id): vectors[i] for i, a in enumerate(articles)}


async def find_semantic_duplicates(
    db: AsyncSession,
    new_articles: list[Article],
    window_hours: int = DEDUP_WINDOW_HOURS,
    threshold: float = DEDUP_SIMILARITY_THRESHOLD,
) -> list[tuple[str, str, float]]:
    """Find semantic duplicates between new articles and recent articles.
    Returns list of (new_article_id, existing_article_id, similarity_score)."""

    if not new_articles:
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    new_ids = {str(a.id) for a in new_articles}

    # Load recent articles (excluding the new ones)
    result = await db.execute(
        select(Article)
        .where(Article.created_at >= cutoff, Article.id.notin_([a.id for a in new_articles]))
        .limit(5000)
    )
    existing_articles = result.scalars().all()

    if not existing_articles:
        return []

    # Compute embeddings
    new_embeddings = await compute_embeddings_batch(new_articles)
    existing_embeddings = await compute_embeddings_batch(existing_articles)

    if not new_embeddings or not existing_embeddings:
        return []

    # Matrix multiplication for cosine similarity
    new_ids_list = list(new_embeddings.keys())
    existing_ids_list = list(existing_embeddings.keys())

    new_matrix = np.array([new_embeddings[nid] for nid in new_ids_list])
    existing_matrix = np.array([existing_embeddings[eid] for eid in existing_ids_list])

    sim_matrix = np.dot(new_matrix, existing_matrix.T)

    duplicates = []
    for i, nid in enumerate(new_ids_list):
        for j, eid in enumerate(existing_ids_list):
            if sim_matrix[i, j] >= threshold:
                duplicates.append((nid, eid, float(sim_matrix[i, j])))

    if duplicates:
        logger.info(f"Semantic dedup: found {len(duplicates)} duplicates in {len(new_articles)} new articles")

    return duplicates


async def tag_duplicates(
    db: AsyncSession,
    duplicates: list[tuple[str, str, float]],
) -> int:
    """Tag duplicate articles with _duplicate tag."""
    import json

    tagged = 0
    for new_id, existing_id, sim in duplicates:
        article = await db.get(Article, uuid.UUID(new_id))
        if not article:
            continue
        tags = []
        if article.tags_json:
            try:
                tags = json.loads(article.tags_json)
            except Exception:
                tags = []
        if "_duplicate" not in tags:
            tags.append("_duplicate")
            article.tags_json = json.dumps(tags)
            tagged += 1

    if tagged:
        await db.flush()
    return tagged
