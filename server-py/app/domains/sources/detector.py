"""
Source auto-detection — paste a URL, detect source type automatically.
Like Inoreader: one URL field → auto-detect RSS, Facebook, Telegram, Twitter, Bluesky, web page.
"""
import re
from urllib.parse import urlparse

import httpx


async def detect_source_type(url: str) -> dict:
    """Detect source type from a URL. Returns {type, config, name, icon}."""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    # Facebook page
    if "facebook.com" in domain or "fb.com" in domain:
        page = parsed.path.strip("/").split("/")[0] if parsed.path else ""
        return {
            "type": "facebook",
            "config": {"page_name": page},
            "name": f"Facebook: {page}",
            "icon": "facebook",
        }

    # Telegram
    if "t.me" in domain:
        channel = parsed.path.strip("/").split("/")[0] if parsed.path else ""
        channel = channel.replace("s/", "")
        return {
            "type": "telegram",
            "config": {"channel": channel},
            "name": f"Telegram: @{channel}",
            "icon": "send",
        }

    # Twitter/X
    if "twitter.com" in domain or "x.com" in domain:
        parts = parsed.path.strip("/").split("/")
        username = parts[0] if parts else ""
        if username and not username.startswith("search"):
            return {
                "type": "twitter",
                "config": {"mode": "user", "username": username},
                "name": f"Twitter: @{username}",
                "icon": "twitter",
            }
        return {
            "type": "twitter",
            "config": {"mode": "search", "query": parsed.path},
            "name": f"Twitter Search",
            "icon": "twitter",
        }

    # Bluesky
    if "bsky.app" in domain or "bsky.social" in domain:
        parts = parsed.path.strip("/").split("/")
        if "profile" in parts:
            idx = parts.index("profile")
            handle = parts[idx + 1] if idx + 1 < len(parts) else ""
            return {
                "type": "bluesky",
                "config": {"mode": "user", "handle": handle},
                "name": f"Bluesky: @{handle}",
                "icon": "cloud",
            }
        return {
            "type": "bluesky",
            "config": {"mode": "search", "query": ""},
            "name": "Bluesky",
            "icon": "cloud",
        }

    # YouTube
    if "youtube.com" in domain or "youtu.be" in domain:
        # Convert to RSS feed
        if "/channel/" in parsed.path:
            channel_id = parsed.path.split("/channel/")[1].split("/")[0]
            rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        elif "/@" in parsed.path:
            handle = parsed.path.split("/@")[1].split("/")[0]
            rss_url = f"https://www.youtube.com/feeds/videos.xml?user={handle}"
        else:
            rss_url = url
        return {
            "type": "rss",
            "config": {"url": rss_url},
            "name": f"YouTube: {parsed.path.strip('/')}",
            "icon": "youtube",
        }

    # Try RSS detection
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url, headers={"Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"})
            ct = resp.headers.get("content-type", "").lower()
            text = resp.text[:2000]

            # Direct RSS/Atom feed
            if "xml" in ct or "<rss" in text or "<feed" in text or "<channel" in text:
                # Extract feed title
                title_match = re.search(r"<title[^>]*>([^<]+)</title>", text)
                title = title_match.group(1).strip() if title_match else domain
                return {
                    "type": "rss",
                    "config": {"url": url},
                    "name": title,
                    "icon": "rss",
                }

            # HTML page — look for RSS link
            if "html" in ct:
                rss_link = re.search(
                    r'<link[^>]+type=["\']application/(rss|atom)\+xml["\'][^>]+href=["\']([^"\']+)["\']',
                    text,
                )
                if rss_link:
                    feed_url = rss_link.group(2)
                    if feed_url.startswith("/"):
                        feed_url = f"{parsed.scheme}://{parsed.netloc}{feed_url}"
                    return {
                        "type": "rss",
                        "config": {"url": feed_url},
                        "name": domain,
                        "icon": "rss",
                        "discovered_from": url,
                    }

                # No RSS found — offer web scraper
                title_match = re.search(r"<title[^>]*>([^<]+)</title>", text)
                title = title_match.group(1).strip() if title_match else domain
                return {
                    "type": "web_scraper",
                    "config": {"url": url},
                    "name": title,
                    "icon": "globe",
                }

    except Exception:
        pass

    # Fallback — web scraper
    return {
        "type": "web_scraper",
        "config": {"url": url},
        "name": domain or url[:60],
        "icon": "globe",
    }
