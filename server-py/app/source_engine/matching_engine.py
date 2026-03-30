"""
Unified matching engine: FlashText + MiniLM-L6 + RapidFuzz.

Ingestion pipeline:
  - FlashText: exact word-boundary matching (aliases in article text) — 0 false positives
  - MiniLM-L6-v2: semantic cosine similarity for what FlashText missed (threshold 0.25)
  - RapidFuzz: fuzzy search for the search bar (model suggestions)

Loaded once at startup. Called at ingestion for each new article batch.
"""

import json
import logging
import numpy as np
from datetime import datetime, timezone
from flashtext import KeywordProcessor
from rapidfuzz import fuzz, process

logger = logging.getLogger(__name__)

_encoder = None
_model_vectors: dict[str, np.ndarray] = {}   # model_id_hex → vector
_model_kp: KeywordProcessor | None = None     # FlashText processor
_model_names: dict[str, str] = {}             # model_id_hex → model name
_model_meta: dict[str, dict] = {}             # model_id_hex → {family, section}
_search_choices: list[str] = []               # flat list for search bar
_search_to_model: dict[str, str] = {}         # choice → model_id_hex

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
MIN_COSINE_SCORE = 0.25


def _get_encoder():
    global _encoder
    if _encoder is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading MiniLM-L6-v2...")
        _encoder = SentenceTransformer(EMBED_MODEL)
        logger.info("MiniLM-L6-v2 loaded")
    return _encoder


def load_models(models: list) -> None:
    """Pre-compute model vectors, FlashText processor, and search index."""
    global _model_vectors, _model_kp, _model_names, _model_meta, _search_choices, _search_to_model
    encoder = _get_encoder()

    _model_kp = KeywordProcessor(case_sensitive=False)
    _model_names.clear()
    _model_meta.clear()
    _search_choices.clear()
    _search_to_model.clear()

    texts = []
    ids = []
    n_keywords = 0
    for m in models:
        mid = m.id.hex if hasattr(m.id, 'hex') else str(m.id).replace('-', '')
        aliases = m.aliases or []
        all_terms = [m.name] + aliases
        _model_names[mid] = m.name
        _model_meta[mid] = {'family': getattr(m, 'family', ''), 'section': getattr(m, 'section', '')}

        # FlashText: add aliases >= 4 chars as keywords → returns model_id on match
        for term in all_terms:
            if len(term) >= 4:
                _model_kp.add_keyword(term, mid)
                n_keywords += 1

        # Search bar: all terms >= 3 chars
        for term in all_terms:
            if len(term) >= 3:
                _search_choices.append(term)
                _search_to_model[term] = mid

        text = m.name + " " + " ".join(aliases[:15])
        texts.append(text)
        ids.append(mid)

    if texts:
        vecs = encoder.encode(texts, normalize_embeddings=True, batch_size=64)
        _model_vectors = {ids[i]: vecs[i] for i in range(len(ids))}
    else:
        _model_vectors = {}
    logger.info(f"Loaded {len(ids)} Intel Models ({n_keywords} FlashText keywords, {len(_search_choices)} search terms)")


def _article_full_text(article) -> str:
    """Build full searchable text from article fields."""
    parts = [article.title or "", article.description or ""]
    for field in [article.tags_json, article.orgs_json, article.persons_json,
                  article.entities_json, article.countries_mentioned_json]:
        if field:
            try:
                vals = json.loads(field)
                if isinstance(vals, list):
                    for v in vals:
                        parts.append(str(v))
            except (json.JSONDecodeError, TypeError):
                pass
    if article.summary:
        parts.append(article.summary)
    return " ".join(parts)


def match_articles(articles: list) -> list[tuple[str, str, float, str]]:
    """Match a batch of articles against all Intel Models.
    Phase 1: FlashText (exact keyword match).
    Phase 2: EmbeddingGemma (semantic, threshold 0.30, for what FlashText missed).

    Returns list of (article_id_hex, model_id_hex, score, method).
    """
    if not articles or not _model_kp:
        return []

    encoder = _get_encoder()
    results: list[tuple[str, str, float, str]] = []
    flash_matches: set[tuple[str, str]] = set()

    # Phase 1: FlashText
    for a in articles:
        aid = a.id.hex if hasattr(a.id, 'hex') else str(a.id).replace('-', '')
        full_text = _article_full_text(a)
        found_mids = _model_kp.extract_keywords(full_text)
        for mid in set(found_mids):
            pair = (aid, mid)
            if pair not in flash_matches:
                flash_matches.add(pair)
                results.append((aid, mid, 1.0, "flash"))

    # Phase 2: EmbeddingGemma for articles not fully matched
    if _model_vectors:
        art_texts = []
        art_ids = []
        for a in articles:
            aid = a.id.hex if hasattr(a.id, 'hex') else str(a.id).replace('-', '')
            art_texts.append(_article_full_text(a))
            art_ids.append(aid)

        art_vecs = encoder.encode(art_texts, normalize_embeddings=True, batch_size=64)
        model_ids = list(_model_vectors.keys())
        model_matrix = np.array([_model_vectors[mid] for mid in model_ids])
        sim_matrix = np.dot(art_vecs, model_matrix.T)

        for j, mid in enumerate(model_ids):
            col = sim_matrix[:, j]
            for i in range(len(articles)):
                if col[i] >= MIN_COSINE_SCORE:
                    aid = art_ids[i]
                    pair = (aid, mid)
                    if pair not in flash_matches:
                        results.append((aid, mid, float(col[i]), "embed"))

    n_flash = len(flash_matches)
    n_embed = len(results) - n_flash
    logger.info(f"match_articles: {len(articles)} articles -> {len(results)} matches ({n_flash} flash + {n_embed} embed)")
    return results


# ── Search bar (FuzzyWuzzy-style suggestions) ──

def search_models(query: str, limit: int = 10) -> list[dict]:
    """Fuzzy search for Intel Models by name or alias. For the search bar."""
    if not query or len(query) < 2 or not _search_choices:
        return []

    results = process.extract(query, _search_choices, scorer=fuzz.token_set_ratio, limit=limit)
    seen_models: set[str] = set()
    out = []
    for match_tuple in results:
        term = match_tuple[0]
        score = int(match_tuple[1])
        if score < 50:
            continue
        mid = _search_to_model.get(term, "")
        if not mid or mid in seen_models:
            continue
        seen_models.add(mid)
        meta = _model_meta.get(mid, {})
        out.append({
            "model_id": mid,
            "model_name": _model_names.get(mid, term),
            "family": meta.get("family", ""),
            "section": meta.get("section", ""),
            "matched_term": term,
            "score": score,
        })
    return out


def flash_match_targeted(articles: list, model_ids: list[str]) -> tuple[list[tuple[str, str, float, str]], list]:
    """Phase 1: FlashText against specific models.
    Returns (matches, unmatched_articles)."""
    if not articles or not model_ids or not _model_kp:
        return [], list(articles)

    target_set = set(model_ids)
    results: list[tuple[str, str, float, str]] = []
    matched_aids: set[str] = set()

    for a in articles:
        aid = a.id.hex if hasattr(a.id, 'hex') else str(a.id).replace('-', '')
        full_text = _article_full_text(a)
        found_mids = _model_kp.extract_keywords(full_text)
        for mid in set(found_mids):
            if mid in target_set:
                results.append((aid, mid, 1.0, "flash"))
                matched_aids.add(aid)

    unmatched = [a for a in articles if (a.id.hex if hasattr(a.id, 'hex') else str(a.id).replace('-', '')) not in matched_aids]
    logger.info(f"flash_targeted: {len(articles)} articles -> {len(results)} matches, {len(unmatched)} unmatched")
    return results, unmatched


def gemma_match_targeted(articles: list, model_ids: list[str]) -> tuple[list[tuple[str, str, float, str]], list]:
    """Phase 2: Gemma 0.30 against specific models. Only on articles FlashText missed.
    Returns (matches, still_unmatched_articles)."""
    if not articles or not model_ids:
        return [], list(articles)

    target_vectors = {mid: _model_vectors[mid] for mid in model_ids if mid in _model_vectors}
    if not target_vectors:
        return [], list(articles)

    encoder = _get_encoder()
    art_texts = []
    art_ids = []
    for a in articles:
        aid = a.id.hex if hasattr(a.id, 'hex') else str(a.id).replace('-', '')
        art_texts.append(_article_full_text(a))
        art_ids.append(aid)

    art_vecs = encoder.encode(art_texts, normalize_embeddings=True, batch_size=64)
    t_mids = list(target_vectors.keys())
    t_matrix = np.array([target_vectors[mid] for mid in t_mids])
    sim_matrix = np.dot(art_vecs, t_matrix.T)

    results: list[tuple[str, str, float, str]] = []
    matched_aids: set[str] = set()

    for j, mid in enumerate(t_mids):
        col = sim_matrix[:, j]
        for i in range(len(articles)):
            if col[i] >= MIN_COSINE_SCORE:
                aid = art_ids[i]
                results.append((aid, mid, float(col[i]), "embed"))
                matched_aids.add(aid)

    unmatched = [a for a in articles if (a.id.hex if hasattr(a.id, 'hex') else str(a.id).replace('-', '')) not in matched_aids]
    logger.info(f"gemma_targeted: {len(articles)} articles -> {len(results)} matches, {len(unmatched)} still unmatched")
    return results, unmatched


async def match_articles_gemini(articles: list, model_ids: list[str], db) -> list[tuple[str, str, float, str]]:
    """Semantic matching via Gemini Flash for recent articles (< 1 week).
    Sends article titles + model names/aliases to Gemini, asks which models match.

    Returns list of (article_id_hex, model_id_hex, score, method).
    """
    if not articles or not model_ids:
        return []

    from app.source_engine.detector import call_gemini, get_gemini_token
    import httpx

    # Build model catalog for the prompt
    model_catalog = []
    for mid in model_ids:
        name = _model_names.get(mid, mid[:8])
        meta = _model_meta.get(mid, {})
        model_catalog.append(f"{mid[:12]}|{meta.get('family','')}/{meta.get('section','')}|{name}")
    catalog_text = "\n".join(model_catalog)

    results: list[tuple[str, str, float, str]] = []
    token = await get_gemini_token()

    # Process in batches of 15 articles
    async with httpx.AsyncClient(timeout=120) as client:
        for batch_start in range(0, len(articles), 15):
            batch = articles[batch_start:batch_start + 15]
            headlines = "\n".join(
                f"{i}. {(a.title or '')[:120]}"
                for i, a in enumerate(batch)
            )

            prompt = f"""Match these news headlines to relevant Intel Models from the catalog below.

Headlines:
{headlines}

Intel Models catalog (id|family/section|name):
{catalog_text}

For each headline, return the IDs of ALL matching models (0 to many).
A model matches if the headline is clearly about that model's topic.

Return ONLY valid JSON (no markdown):
{{"matches": [{{"index": 0, "model_ids": ["id1", "id2"]}}, ...]}}

Rules:
- Only match if clearly relevant — no guessing
- Use the 12-char IDs from the catalog
- Empty model_ids [] if no model matches"""

            try:
                import re
                raw = await call_gemini(prompt, client=client, token=token)
                cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
                cleaned = re.sub(r"\s*```$", "", cleaned)
                import json as _json
                data = _json.loads(cleaned)

                id_map = {mid[:12]: mid for mid in model_ids}
                for m in data.get("matches", []):
                    idx = m.get("index", -1)
                    if 0 <= idx < len(batch):
                        a = batch[idx]
                        aid = a.id.hex if hasattr(a.id, 'hex') else str(a.id).replace('-', '')
                        for short_id in m.get("model_ids", []):
                            full_id = id_map.get(short_id[:12])
                            if full_id:
                                results.append((aid, full_id, 0.9, "gemini"))
            except Exception as e:
                logger.warning(f"Gemini matching batch failed: {e}")

    logger.info(f"match_gemini: {len(articles)} articles x {len(model_ids)} models -> {len(results)} matches")
    return results


def classify_article_by_flashtext(article) -> tuple[str, str] | None:
    """Classify an article into family/section using FlashText.
    Finds which models match, takes the most frequent family/section.
    Returns (family, section) or None if no match.
    """
    if not _model_kp:
        return None
    full_text = _article_full_text(article)
    found_mids = set(_model_kp.extract_keywords(full_text))
    if not found_mids:
        return None

    # Count family/section occurrences from matched models
    from collections import Counter
    pairs = Counter()
    for mid in found_mids:
        meta = _model_meta.get(mid, {})
        fam = meta.get("family", "")
        sec = meta.get("section", "")
        if fam and sec and fam not in ("mute", "foundation"):
            pairs[(fam, sec)] += 1

    if not pairs:
        return None
    return pairs.most_common(1)[0][0]


async def classify_unclassified_articles(db) -> int:
    """Backfill classification for articles > 1 day old with no family/section.
    Phase 1: FlashText (exact keywords).
    Phase 2: EmbeddingGemma 300m (semantic, for what FlashText missed).
    """
    from sqlalchemy import select
    from app.models.article import Article
    from datetime import timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

    articles = (await db.execute(
        select(Article).where(
            Article.created_at < cutoff,
            (Article.family == None) | (Article.family == ""),
        ).limit(500)
    )).scalars().all()
    if not articles:
        return 0

    classified = 0
    remaining = []

    # Phase 1: FlashText
    for a in articles:
        result = classify_article_by_flashtext(a)
        if result:
            a.family, a.section = result
            classified += 1
        else:
            remaining.append(a)

    # Phase 2: Gemma for articles FlashText missed
    if remaining:
        gemma_classified = _classify_by_gemma(remaining)
        classified += gemma_classified

    if classified:
        await db.commit()
    logger.info(f"classify_unclassified: {classified}/{len(articles)} (FlashText: {classified - len([a for a in remaining if a.family])}, Gemma: {len([a for a in remaining if a.family])})")
    return classified


# ── Lazy-loaded encoder for background classification ──
# Reuses the same MiniLM-L6 encoder as targeted matching
_bg_encoder = None
_section_vectors: dict[tuple[str, str], 'numpy.ndarray'] = {}

MIN_SECTION_SCORE = 0.15  # threshold for section classification (MiniLM distribution is lower)


def _get_bg_encoder():
    """Lazy-load encoder + section vectors for background classification."""
    global _bg_encoder, _section_vectors
    if _bg_encoder is not None:
        return _bg_encoder

    import numpy as np
    from app.domains.ai_feeds.taxonomy import SECTION_DESCRIPTIONS

    # Reuse the same encoder instance
    _bg_encoder = _get_encoder()

    # Embed section descriptions once
    keys = list(SECTION_DESCRIPTIONS.keys())
    texts = list(SECTION_DESCRIPTIONS.values())
    vecs = _bg_encoder.encode(texts, normalize_embeddings=True, batch_size=64)
    _section_vectors = {keys[i]: vecs[i] for i in range(len(keys))}

    logger.info(f"BG classifier ready, {len(_section_vectors)} section vectors")
    return _bg_encoder


def _classify_by_gemma(articles: list) -> int:
    """Classify articles by cosine similarity against section description embeddings."""
    import numpy as np

    encoder = _get_bg_encoder()
    if not _section_vectors:
        return 0

    # Skip geo/mute/foundation — not useful for thematic classification
    thematic = {k: v for k, v in _section_vectors.items() if k[0] not in ("geo", "mute", "foundation")}
    keys = list(thematic.keys())
    sec_matrix = np.array([thematic[k] for k in keys])

    art_texts = [(a.title or "") + " " + (a.description or "")[:200] for a in articles]
    art_vecs = encoder.encode(art_texts, normalize_embeddings=True, batch_size=64)

    sim = np.dot(art_vecs, sec_matrix.T)

    classified = 0
    for i, a in enumerate(articles):
        best_idx = int(np.argmax(sim[i]))
        best_score = float(sim[i][best_idx])
        if best_score >= MIN_SECTION_SCORE:
            a.family, a.section = keys[best_idx]
            classified += 1

    return classified


async def store_matches(db, matches: list[tuple[str, str, float, str]]) -> int:
    """Bulk insert matches into article_models. Returns count inserted."""
    if not matches:
        return 0

    from sqlalchemy import text as sa_text
    values = []
    params = {}
    for i, (aid, mid, score, method) in enumerate(matches):
        values.append(f"(:a{i}, :m{i}, :s{i}, :mt{i})")
        params[f"a{i}"] = aid
        params[f"m{i}"] = mid
        params[f"s{i}"] = score
        params[f"mt{i}"] = method

    total = 0
    for chunk_start in range(0, len(values), 100):
        chunk = values[chunk_start:chunk_start + 100]
        chunk_params = {k: v for k, v in params.items()
                        if any(k.startswith(prefix) for prefix in
                               [f"a{j}" for j in range(chunk_start, chunk_start + len(chunk))] +
                               [f"m{j}" for j in range(chunk_start, chunk_start + len(chunk))] +
                               [f"s{j}" for j in range(chunk_start, chunk_start + len(chunk))] +
                               [f"mt{j}" for j in range(chunk_start, chunk_start + len(chunk))])}
        sql = f"INSERT OR IGNORE INTO article_models (article_id, model_id, score, method) VALUES {', '.join(chunk)}"
        result = await db.execute(sa_text(sql), chunk_params)
        total += result.rowcount or 0

    await db.flush()
    return total
