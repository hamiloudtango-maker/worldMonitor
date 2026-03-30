"""
Article scraper — fetches full article content as markdown.
Uses Crawl4AI with stealth mode, fallback to HTTP + BeautifulSoup.
Scraped content cached on disk: data/scraped/{source_id}/{date}/{hash}.md
"""
import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple

logger = logging.getLogger(__name__)

SCRAPED_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "scraped"

# Singleton crawler instance
_crawler_instance = None
_crawler_lock = asyncio.Lock()


async def _get_crawler():
    """Get or create a singleton AsyncWebCrawler with stealth enabled."""
    if sys.platform == "win32":
        return None
    global _crawler_instance
    async with _crawler_lock:
        if _crawler_instance is None:
            try:
                from crawl4ai import AsyncWebCrawler
                from crawl4ai.async_configs import BrowserConfig

                browser_config = BrowserConfig(
                    headless=True, verbose=False, enable_stealth=True,
                )
                _crawler_instance = AsyncWebCrawler(config=browser_config)
                await _crawler_instance.__aenter__()
                logger.info("Crawl4AI browser initialized (stealth mode)")
            except Exception as e:
                logger.warning(f"Crawl4AI init failed: {e}")
                _crawler_instance = None
    return _crawler_instance


async def _http_fallback(url: str) -> str:
    """Fallback: fetch HTML via aiohttp."""
    import aiohttp
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15), allow_redirects=True) as resp:
                if resp.status == 200:
                    return await resp.text()
    except Exception as e:
        logger.debug(f"HTTP fallback failed for {url}: {e}")
    return ""


async def scrape_url(url: str, timeout: int = 30) -> Tuple[str, str]:
    """Scrape a URL and return (markdown_content, title).

    Strategy chain:
    1. Crawl4AI with stealth + magic + retries (non-Windows)
    2. HTTP fallback via aiohttp + BeautifulSoup
    """
    # Try Crawl4AI
    try:
        crawler = await _get_crawler()
        if crawler:
            try:
                from crawl4ai.async_configs import CrawlerRunConfig, CacheMode

                run_config = CrawlerRunConfig(
                    cache_mode=CacheMode.BYPASS,
                    magic=True,
                    wait_until="load",
                    max_retries=2,
                    fallback_fetch_function=_http_fallback,
                )
                result = await asyncio.wait_for(
                    crawler.arun(url, config=run_config), timeout=timeout,
                )
            except (TypeError, ImportError):
                result = await asyncio.wait_for(crawler.arun(url), timeout=timeout)

            content = result.markdown or ""
            # Clean navigation cruft
            lines = content.split('\n')
            start_idx = 0
            for i, line in enumerate(lines):
                if line.strip().startswith('#') or (len(line.strip()) > 50 and not line.strip().startswith('[')):
                    start_idx = i
                    break
            clean_content = '\n'.join(lines[start_idx:])

            title = ""
            if hasattr(result, 'metadata') and result.metadata:
                title = result.metadata.get('title', '') or result.metadata.get('og:title', '')

            # Detect error pages
            error_titles = ['404', 'page not found', 'access denied', 'forbidden', 'error']
            if title and any(err in title.lower() for err in error_titles):
                logger.warning(f"Error page detected for {url}: title='{title}'")
                return "", ""

            status_code = getattr(result, 'status_code', None)
            if status_code and status_code >= 400:
                return "", ""

            if not title:
                for line in lines:
                    if line.strip().startswith('# '):
                        title = line.strip().lstrip('# ').strip()
                        break

            if len(clean_content) > 100:
                logger.info(f"Crawl4AI scraped {url}: {len(clean_content)} chars")
                return clean_content[:100_000], title or url
    except asyncio.TimeoutError:
        logger.warning(f"Crawl4AI timeout for {url}")
    except Exception as e:
        logger.warning(f"Crawl4AI failed for {url}: {e}")

    # Fallback: aiohttp + BeautifulSoup
    try:
        import aiohttp
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
        }
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15), allow_redirects=True) as resp:
                if resp.status != 200:
                    return "", ""
                html = await resp.text()

        soup = BeautifulSoup(html, "html.parser")
        title = ""
        if soup.title:
            title = soup.title.string or ""
        og_title = soup.find("meta", property="og:title")
        if og_title:
            title = og_title.get("content", title)

        for tag in soup(["script", "style", "nav", "footer", "aside", "header"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        content = '\n'.join(lines)

        logger.info(f"HTTP fallback scraped {url}: {len(content)} chars")
        return content[:100_000], title or url
    except Exception as e:
        logger.error(f"All scraping methods failed for {url}: {e}")
        return "", ""


# ── File storage helpers ──────────────────────────────────────

def get_article_path(source_id: str, pub_date: str | None, article_hash: str) -> Path:
    """Build disk path: data/scraped/{source_id}/{YYYY-MM-DD}/{hash}.md"""
    if pub_date:
        try:
            dt = datetime.fromisoformat(str(pub_date).replace(" ", "T"))
            date_dir = dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            date_dir = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    else:
        date_dir = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    safe_source = source_id.replace(" ", "_").replace("/", "_")[:80]
    return SCRAPED_DIR / safe_source / date_dir / f"{article_hash}.md"


def is_scraped(source_id: str, pub_date: str | None, article_hash: str) -> bool:
    """Check if article is already scraped."""
    return get_article_path(source_id, pub_date, article_hash).exists()


def read_scraped(source_id: str, pub_date: str | None, article_hash: str) -> str | None:
    """Read cached markdown if it exists."""
    path = get_article_path(source_id, pub_date, article_hash)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def delete_scraped(source_id: str, pub_date: str | None, article_hash: str) -> bool:
    """Delete cached markdown file. Returns True if file existed."""
    path = get_article_path(source_id, pub_date, article_hash)
    if path.exists():
        path.unlink()
        return True
    return False


def _resolve_google_news_url(url: str) -> str:
    """Resolve Google News redirect URLs to the real article URL."""
    if 'news.google.com/rss/articles/' not in url:
        return url
    try:
        from googlenewsdecoder import new_decoderv1
        result = new_decoderv1(url)
        if result.get("status") and result.get("decoded_url"):
            return result["decoded_url"]
    except Exception:
        pass
    return url


async def scrape_and_save(url: str, source_id: str, pub_date: str | None, article_hash: str, title: str = "") -> str | None:
    """Scrape article and save to disk. Returns markdown or None on failure."""
    # Check cache first — but invalidate corrupted Google consent pages
    cached = read_scraped(source_id, pub_date, article_hash)
    if cached:
        if 'Before you continue' in cached[:200] or 'consent.google.com' in cached[:500]:
            # Corrupted cache from pre-resolver era — delete and re-scrape
            delete_scraped(source_id, pub_date, article_hash)
        else:
            return cached

    # Resolve Google News URLs to real article URLs
    real_url = _resolve_google_news_url(url)

    content, scraped_title = await scrape_url(real_url, timeout=30)
    if not content or len(content.strip()) < 50:
        return None

    # Reject Google consent/error pages
    if 'Before you continue' in content[:300] or 'consent.google.com' in content[:500]:
        return None

    # Build markdown with header
    header = f"# {scraped_title or title}\n\nSource: {real_url}\n\n---\n\n"
    full_md = header + content

    # Write to disk
    path = get_article_path(source_id, pub_date, article_hash)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(full_md, encoding="utf-8")

    logger.info(f"Scraped & saved: {path} ({len(full_md)} chars)")
    return full_md


async def scrape_alerts(db) -> int:
    """Scrape articles with threat_level critical/high that don't have cached .md files."""
    from sqlalchemy import select
    from app.models.article import Article

    result = await db.execute(
        select(Article)
        .where(Article.threat_level.in_(["critical", "high"]))
        .order_by(Article.pub_date.desc())
        .limit(50)
    )
    articles = result.scalars().all()

    scraped = 0
    for art in articles:
        if is_scraped(art.source_id, str(art.pub_date) if art.pub_date else None, art.hash):
            continue
        try:
            md = await scrape_and_save(
                url=art.link,
                source_id=art.source_id,
                pub_date=str(art.pub_date) if art.pub_date else None,
                article_hash=art.hash,
                title=art.title,
            )
            if md:
                scraped += 1
        except Exception as e:
            logger.warning(f"Alert scrape failed for {art.link}: {e}")
        await asyncio.sleep(1)  # rate limit

    if scraped:
        logger.info(f"Auto-scraped {scraped} alert articles")
    return scraped
