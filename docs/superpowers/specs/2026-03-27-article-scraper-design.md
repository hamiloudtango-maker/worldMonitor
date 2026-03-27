# Article Scraping & Markdown Visualization

## Goal

Scrape full article content on-demand (user click) or automatically (case alerts), store as markdown files on disk, display in a slide-in reader panel.

## Architecture

User clicks article → `GET /api/articles/v1/{id}/content` → if cached .md exists, return it; otherwise crawl4ai scrape → save .md → return content. For case alerts (critical/high), scrape automatically at ingestion time.

## Storage

```
data/scraped/{source_id}/{YYYY-MM-DD}/{hash}.md
```

Permanent cache — once scraped, never re-scraped.

## Backend

### Module: `server-py/app/source_engine/scraper.py`

- `async def scrape_url(url: str) -> str` — crawl4ai AsyncWebCrawler → markdown
- `def get_article_path(source_id: str, pub_date: str | None, hash: str) -> Path`
- `async def scrape_and_save(article_row) -> str | None` — scrape + write file, return content
- `async def scrape_alerts(db) -> int` — find articles with threat_level critical/high that have no .md file, scrape them

### Endpoint: `GET /api/articles/v1/{article_id}/content`

Response: `{ "content_md": "...", "url": "...", "title": "...", "scraped_at": "...", "cached": bool }`

If scraping fails: `{ "content_md": null, "error": "...", "url": "..." }`

### Auto-scrape alerts

In `_auto_ingest_catalog` and `_auto_refresh_cases` (main.py), after ingestion completes, call `scrape_alerts(db)` to scrape new critical/high articles.

## Frontend

### Component: `src/v2/components/ArticleReader.tsx`

Slide-in panel from right (~50% width). Props: `{ articleId: string | null, onClose: () => void }`.

- Opens with skeleton loader
- Calls `GET /articles/v1/{id}/content`
- Renders markdown with react-markdown
- Header: title, source, date, link to original, close button
- Overlay backdrop that closes on click

### API client: `src/v2/lib/article-api.ts`

`getArticleContent(id: string) -> Promise<{ content_md, url, title, scraped_at, cached }>`

### Integration points

- FeedPreview.tsx: article click → open reader
- Dashboard news widget: article click → open reader
- CaseBoard: article click → open reader
- ArticleReader mounted once at Dashboard level, controlled by state

## Dependencies

- `crawl4ai` (pip install)
- `react-markdown` (npm install)

## Files

| Action | File |
|--------|------|
| Create | `server-py/app/source_engine/scraper.py` |
| Modify | `server-py/app/domains/articles/router.py` — add content endpoint |
| Modify | `server-py/app/main.py` — call scrape_alerts after ingestion |
| Create | `src/v2/components/ArticleReader.tsx` |
| Create | `src/v2/lib/article-api.ts` |
| Modify | `src/v2/components/ai-feeds/FeedPreview.tsx` — click opens reader |
| Modify | `src/v2/components/Dashboard.tsx` — mount ArticleReader + state |
