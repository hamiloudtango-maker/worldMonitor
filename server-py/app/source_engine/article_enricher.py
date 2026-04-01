"""
Article content enricher using crawl4ai.
- On-demand: fetch article → PruningContentFilter → fit_markdown + og:image
- Background: enrich Feed/Case articles → file cache
"""
import asyncio
import logging
import os
import re
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.case import CaseArticle

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent.parent / "data" / "articles"

_JS_NOISE = re.compile(
    r"(?:enable javascript|javascript is required|javascript to proceed|"
    r"couldn.t load|browser extension|ad blocker|different browser|"
    r"activate javascript|requires javascript)",
    re.IGNORECASE,
)


def _ensure_cache_dir():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_path(article_id: str) -> Path:
    return CACHE_DIR / f"{article_id}.md"


def has_cached_content(article_id: str) -> bool:
    return _cache_path(article_id).exists()


def read_cached_content(article_id: str) -> str | None:
    p = _cache_path(article_id)
    if p.exists():
        return p.read_text(encoding="utf-8")
    return None


def _is_valid_article(md: str | None) -> bool:
    if not md:
        return False
    if _JS_NOISE.search(md):
        return False
    paragraphs = [line for line in md.split("\n") if len(line.strip()) > 50]
    return len(paragraphs) >= 3


_NAV_NOISE = re.compile(
    r"^.*(?:Publicité|Nous contacter|Se connecter|S'inscrire|Subscribe|Newsletter|"
    r"Sign [Ii]n|Log [Ii]n|Menu|Search|Recherche|Cookie|Accept|Privacy|"
    r"Skip to|Navigation|Footer|Sidebar|Advertisement|Suivez nous|"
    r"Share this|Follow us|Social Media|Terms of|© 20).*$",
    re.MULTILINE | re.IGNORECASE,
)

_SHORT_NAV_LINE = re.compile(r"^\s*\*\s*\[.{1,30}\]\(.+\)\s*$", re.MULTILINE)


_END_MARKERS = re.compile(
    r"^(?:\*\*Lien permanent|Espace abonn|TSA \+|Partager cet|Share this|"
    r"Related (?:articles|posts)|Articles? li[ée]s|Laisser un comment|"
    r"Voir aussi|Read more articles|Newsletter|Tags?\s*:|"
    r"©\s*20|Tous droits r[ée]serv[ée]s)",
    re.MULTILINE | re.IGNORECASE,
)


def _clean_markdown(md: str) -> str:
    """Remove navigation, menu, footer noise from crawl4ai markdown."""
    lines = md.split("\n")

    # --- Find START: first real paragraph (> 80 chars, not nav/link list) ---
    start = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if len(stripped) > 80 and not stripped.startswith("*") and not stripped.startswith("[") and "cookie" not in stripped.lower():
            # Keep heading above if present
            if i > 0 and lines[i - 1].strip().startswith("#"):
                start = i - 1
            else:
                start = i
            break

    # --- Find END: footer/related articles ---
    end = len(lines)
    for i in range(start + 3, len(lines)):
        line = lines[i].strip()
        if _END_MARKERS.match(line):
            end = i
            break
        # Related articles section: ## followed by linked title
        if line.startswith("## ") and "[" in line and "](" in line and i > start + 10:
            end = i
            break

    md = "\n".join(lines[start:end])

    # Remove inline noise
    md = _NAV_NOISE.sub("", md)
    md = re.sub(r"A lire aussi\s*:\s*\[.*?\]\(.*?\)\s*", "", md)
    md = re.sub(r"Suivez nous.*$", "", md, flags=re.MULTILINE)
    md = re.sub(r"^\d+ minutes? de lecture$", "", md, flags=re.MULTILINE)
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def _fix_win_encoding():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass


async def _crawl4ai_fetch(url: str) -> dict | None:
    """Fetch article with crawl4ai: fit_markdown + og:image + author."""
    try:
        _fix_win_encoding()
        from crawl4ai import AsyncWebCrawler
        from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig, CacheMode
        from crawl4ai.content_filter_strategy import PruningContentFilter
        from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

        md_generator = DefaultMarkdownGenerator(
            content_filter=PruningContentFilter(
                threshold=0.45, threshold_type="fixed", min_word_threshold=0
            )
        )
        bc = BrowserConfig(headless=True, verbose=False, text_mode=True)
        rc = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            wait_until="domcontentloaded",
            page_timeout=30000,
            markdown_generator=md_generator,
        )
        async with AsyncWebCrawler(config=bc) as crawler:
            result = await asyncio.wait_for(crawler.arun(url, config=rc), timeout=35)

        if not result.success:
            return None

        # fit_markdown = article only (no nav/footer)
        md = result.markdown.fit_markdown if result.markdown else ""
        if not _is_valid_article(md):
            md = result.markdown.raw_markdown if result.markdown else ""
            if not _is_valid_article(md):
                return None

        # Clean nav/menu noise from top of markdown
        md = _clean_markdown(md)

        if not _is_valid_article(md):
            return None

        meta = result.metadata or {}
        image = (
            meta.get("og:image")
            or meta.get("og:image:url")
            or meta.get("twitter:image")
            or ""
        )
        author = meta.get("author") or meta.get("article:author") or ""

        logger.info(f"crawl4ai OK: {url} ({len(md)} chars, img={'yes' if image else 'no'})")
        return {"content_md": md, "image": image, "author": author}

    except Exception as e:
        logger.warning(f"crawl4ai failed: {url} — {e}")
        return None


async def fetch_article_content(url: str) -> dict | None:
    """On-demand: crawl4ai fetch → clean markdown + image + author."""
    return await _crawl4ai_fetch(url)


async def fetch_and_cache(article_id: str, url: str) -> dict | None:
    """Fetch + save to file cache."""
    data = await _crawl4ai_fetch(url)
    if data and data["content_md"]:
        _ensure_cache_dir()
        _cache_path(article_id).write_text(data["content_md"], encoding="utf-8")
    return data


async def enrich_feed_case_articles(
    db: AsyncSession,
    *,
    batch_size: int = 10,
    max_concurrent: int = 3,
) -> int:
    """Background: enrich articles in Cases that don't have cached files yet."""
    case_article_ids = select(CaseArticle.article_id)

    result = await db.execute(
        select(Article)
        .where(Article.id.in_(case_article_ids))
        .where(Article.content_md.is_(None) | (Article.content_md == ""))
        .where(Article.link.isnot(None))
        .order_by(Article.pub_date.desc().nullslast())
        .limit(batch_size)
    )
    articles = list(result.scalars().all())
    if not articles:
        return 0

    _ensure_cache_dir()
    to_process = [a for a in articles if not _cache_path(str(a.id)).exists()]
    if not to_process:
        return 0

    sem = asyncio.Semaphore(max_concurrent)

    async def _process(article: Article) -> bool:
        async with sem:
            data = await _crawl4ai_fetch(article.link)
        if not data or not data["content_md"]:
            article.content_md = ""
            return False

        _cache_path(str(article.id)).write_text(data["content_md"], encoding="utf-8")
        article.content_md = "file"
        if data["image"] and not article.image_url:
            article.image_url = data["image"]
        if data["author"] and not article.author:
            article.author = data["author"]
        return True

    tasks = [_process(a) for a in to_process]
    results = await asyncio.gather(*tasks)
    updated = sum(1 for r in results if r)

    await db.commit()
    logger.info(f"enrichment: {updated}/{len(to_process)} cached")
    return updated
