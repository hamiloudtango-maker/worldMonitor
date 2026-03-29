"""
Shared HTTP client and helpers for domain routers.
Single place for timeout, user-agent, error handling.
"""

from datetime import datetime, timezone

import httpx

USER_AGENT = "WorldMonitor/2.0"
DEFAULT_TIMEOUT = 15


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def fetch_json(url: str, *, params: dict | None = None, timeout: int = DEFAULT_TIMEOUT) -> dict:
    """Fetch JSON from a URL. Raises on HTTP errors."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url, params=params, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        return resp.json()


async def fetch_xml(url: str, *, timeout: int = DEFAULT_TIMEOUT) -> bytes:
    """Fetch XML/RSS from a URL. Returns raw bytes for lxml."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        return resp.content


async def fetch_xml_conditional(
    url: str,
    *,
    etag: str | None = None,
    last_modified: str | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> tuple[bytes | None, str | None, str | None]:
    """Fetch XML with ETag/Last-Modified conditional request.
    Returns (content, new_etag, new_last_modified).
    content is None on 304 Not Modified."""
    headers = {"User-Agent": USER_AGENT}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 304:
            return None, etag, last_modified
        resp.raise_for_status()
        return resp.content, resp.headers.get("etag"), resp.headers.get("last-modified")


async def fetch_text(url: str, *, params: dict | None = None, timeout: int = DEFAULT_TIMEOUT) -> str:
    """Fetch raw text from a URL."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url, params=params, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        return resp.text
