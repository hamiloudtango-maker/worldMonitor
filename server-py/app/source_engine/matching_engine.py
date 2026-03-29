"""
Unified matching engine: FlashText + MiniLM + RapidFuzz search.

One strategy for the entire platform:
  - FlashText: exact word-boundary matching (aliases in article text) — 0 false positives
  - MiniLM: semantic cosine similarity on full text — catches related articles
  - Union of both → article_models junction table
  - RapidFuzz: fuzzy search for the search bar (model suggestions)

Loaded once at startup. Called at ingestion for each new article batch.
"""

import json
import logging
import numpy as np
from flashtext import KeywordProcessor
from rapidfuzz import fuzz, process

logger = logging.getLogger(__name__)

# ── Lazy-loaded encoder ──
_encoder = None
_model_vectors: dict[str, np.ndarray] = {}   # model_id_hex → vector
_model_kp: KeywordProcessor | None = None     # FlashText processor
_model_names: dict[str, str] = {}             # model_id_hex → model name
_model_meta: dict[str, dict] = {}             # model_id_hex → {family, section}
_search_choices: list[str] = []               # flat list for search bar
_search_to_model: dict[str, str] = {}         # choice → model_id_hex

EMBED_MODEL = "google/embeddinggemma-300m"
MIN_COSINE_SCORE = 0.35  # validated: Gemma vrais > 0.43, faux < 0.21


def _get_encoder():
    global _encoder
    if _encoder is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading MiniLM encoder...")
        _encoder = SentenceTransformer(EMBED_MODEL, trust_remote_code=True)
        logger.info("MiniLM encoder loaded")
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


def _article_metadata_text(article) -> str:
    """Title + description for EmbeddingGemma (best signal for entity matching)."""
    return (article.title or '') + ' ' + (article.description or '')


def match_articles(articles: list) -> list[tuple[str, str, float, str]]:
    """Match a batch of articles against all Intel Models.

    Returns list of (article_id_hex, model_id_hex, score, method).
    Uses RapidFuzz (partial_ratio >= 90) + MiniLM (cosine >= 0.50).
    """
    if not articles or not _model_kp:
        return []

    encoder = _get_encoder()
    results: list[tuple[str, str, float, str]] = []

    # ── Phase 1: FlashText match (exact word-boundary in full text) ──
    flash_matches: set[tuple[str, str]] = set()
    for a in articles:
        aid = a.id.hex if hasattr(a.id, 'hex') else str(a.id).replace('-', '')
        full_text = _article_full_text(a)
        found_mids = _model_kp.extract_keywords(full_text)
        for mid in set(found_mids):
            pair = (aid, mid)
            if pair not in flash_matches:
                flash_matches.add(pair)
                results.append((aid, mid, 1.0, "flash"))

    # ── Phase 2: EmbeddingGemma semantic match on title+description ──
    if _model_vectors:
        full_texts = []
        art_ids = []
        for a in articles:
            aid = a.id.hex if hasattr(a.id, 'hex') else str(a.id).replace('-', '')
            full_texts.append(_article_full_text(a))
            art_ids.append(aid)

        art_vecs = encoder.encode(full_texts, normalize_embeddings=True, batch_size=64)

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
    logger.info(f"match_articles: {len(articles)} articles -> {len(results)} matches "
                f"({n_flash} flash + {n_embed} embed)")
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
