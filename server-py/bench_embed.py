"""
Benchmark: google/embeddinggemma-300m vs codefuse-ai/F2LLM-v2-80M
on 100 real articles from the WorldMonitor DB.

Compares: load time, encode speed, matching quality (cosine vs current threshold).
"""
import sys, os, time, json
sys.path.insert(0, os.path.dirname(__file__))

import numpy as np
from sqlalchemy import create_engine, text

DB_PATH = os.path.join(os.path.dirname(__file__), "worldmonitor.db")
engine = create_engine(f"sqlite:///{DB_PATH}")

# -- 1. Load 100 articles + 10 models from DB ------------------
print("=" * 60)
print("Loading 100 articles + 10 models from DB...")
with engine.connect() as conn:
    rows = conn.execute(text(
        "SELECT id, title, description FROM articles ORDER BY pub_date DESC LIMIT 100"
    )).fetchall()
    articles = [{"id": r[0], "title": r[1] or "", "desc": r[2] or ""} for r in rows]

    mrows = conn.execute(text(
        "SELECT id, name, aliases FROM intel_models ORDER BY article_count DESC LIMIT 10"
    )).fetchall()
    models = [{"id": r[0], "name": r[1], "aliases": r[2]} for r in mrows]

print(f"  {len(articles)} articles, {len(models)} models loaded")

art_texts = [(a["title"] + " " + a["desc"]).strip() for a in articles]
model_texts = []
for m in models:
    aliases = []
    if m["aliases"]:
        try:
            aliases = json.loads(m["aliases"])
        except:
            pass
    model_texts.append(m["name"] + " " + " ".join(aliases))

print(f"  Model names: {[m['name'] for m in models]}")
print()

# -- 2. Benchmark function -------------------------------------
def benchmark(model_name: str):
    from sentence_transformers import SentenceTransformer

    print(f"{'-' * 60}")
    print(f"MODEL: {model_name}")
    print(f"{'-' * 60}")

    # Load
    t0 = time.perf_counter()
    encoder = SentenceTransformer(model_name, trust_remote_code=True)
    load_time = time.perf_counter() - t0
    print(f"  Load time:      {load_time:.2f}s")

    # Model size
    n_params = sum(p.numel() for p in encoder[0].auto_model.parameters()) / 1e6
    print(f"  Parameters:     {n_params:.0f}M")

    # Encode articles
    t0 = time.perf_counter()
    art_vecs = encoder.encode(art_texts, normalize_embeddings=True, batch_size=32)
    encode_art_time = time.perf_counter() - t0
    print(f"  Encode 100 art: {encode_art_time:.3f}s ({100/encode_art_time:.0f} art/s)")

    # Encode models
    t0 = time.perf_counter()
    mod_vecs = encoder.encode(model_texts, normalize_embeddings=True, batch_size=32)
    encode_mod_time = time.perf_counter() - t0
    print(f"  Encode 10 mod:  {encode_mod_time:.3f}s")

    # Embedding dimension
    print(f"  Embed dim:      {art_vecs.shape[1]}")

    # Cosine similarity matrix
    sim_matrix = np.dot(art_vecs, mod_vecs.T)  # (100, 10)

    # Stats
    print(f"\n  Similarity stats:")
    print(f"    Mean:   {sim_matrix.mean():.4f}")
    print(f"    Std:    {sim_matrix.std():.4f}")
    print(f"    Min:    {sim_matrix.min():.4f}")
    print(f"    Max:    {sim_matrix.max():.4f}")
    print(f"    Median: {np.median(sim_matrix):.4f}")

    # Matches at various thresholds
    for threshold in [0.20, 0.25, 0.30, 0.35, 0.40, 0.50]:
        n_matches = (sim_matrix >= threshold).sum()
        n_articles = (sim_matrix >= threshold).any(axis=1).sum()
        print(f"    >= {threshold:.2f}: {n_matches:4d} matches across {n_articles:3d}/100 articles")

    # Top 5 highest-scoring matches
    print(f"\n  Top 5 matches:")
    flat = sim_matrix.flatten()
    top_idx = np.argsort(flat)[-5:][::-1]
    for idx in top_idx:
        ai = idx // len(models)
        mi = idx % len(models)
        score = flat[idx]
        print(f"    [{score:.3f}] \"{articles[ai]['title'][:60]}\" → {models[mi]['name']}")

    print()
    return {
        "model": model_name,
        "params_m": n_params,
        "load_s": load_time,
        "encode_100_s": encode_art_time,
        "art_per_s": 100 / encode_art_time,
        "dim": art_vecs.shape[1],
        "mean_sim": float(sim_matrix.mean()),
        "matches_030": int((sim_matrix >= 0.30).sum()),
        "coverage_030": int((sim_matrix >= 0.30).any(axis=1).sum()),
    }


# -- 3. Run benchmarks -----------------------------------------
results = []
for model in [
    "google/embeddinggemma-300m",          # Current: 303M
    "BAAI/bge-small-en-v1.5",             # 33M, very fast
    "sentence-transformers/all-MiniLM-L6-v2",  # 22M, classic lightweight
]:
    try:
        r = benchmark(model)
        results.append(r)
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback; traceback.tb = traceback.format_exc(); print(traceback.tb)

# -- 4. Comparison ---------------------------------------------
if len(results) == 2:
    a, b = results
    print("=" * 60)
    print("COMPARISON SUMMARY")
    print("=" * 60)
    print(f"{'':30s} {'Gemma 300M':>15s} {'F2LLM 80M':>15s} {'Winner':>10s}")
    print("-" * 72)

    def row(label, key, fmt=".2f", lower_better=True):
        va, vb = a[key], b[key]
        winner = "F2LLM" if (vb < va if lower_better else vb > va) else "Gemma"
        print(f"  {label:28s} {va:>15{fmt}} {vb:>15{fmt}} {winner:>10s}")

    row("Parameters (M)", "params_m", ".0f", True)
    row("Load time (s)", "load_s", ".2f", True)
    row("Encode 100 art (s)", "encode_100_s", ".3f", True)
    row("Throughput (art/s)", "art_per_s", ".0f", False)
    row("Embed dimension", "dim", ".0f", True)
    row("Mean cosine sim", "mean_sim", ".4f", False)
    row("Matches @0.30", "matches_030", ".0f", False)
    row("Coverage @0.30 (/100)", "coverage_030", ".0f", False)
