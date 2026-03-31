"""
Email digests — scheduled recurring summaries of articles.
Like Inoreader: create and schedule recurring digests per folder/case/feed.
"""
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.article import Article

logger = logging.getLogger(__name__)


class EmailDigest(Base):
    __tablename__ = "email_digests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(nullable=False)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    recipients: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # email addresses

    # Scope: folder_id, case_id, feed_id, or "all"
    scope_type: Mapped[str] = mapped_column(String(20), nullable=False, default="all")
    scope_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Schedule: daily, weekly, hourly
    frequency: Mapped[str] = mapped_column(String(20), nullable=False, default="daily")
    send_hour: Mapped[int] = mapped_column(Integer, default=8)  # UTC hour
    send_day: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0=Mon for weekly

    # Filters
    min_threat: Mapped[str | None] = mapped_column(String(10), nullable=True)  # only high+ articles
    max_articles: Mapped[int] = mapped_column(Integer, default=20)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


async def generate_digest_content(
    db: AsyncSession,
    digest: EmailDigest,
) -> dict:
    """Generate digest content — articles matching the digest scope since last send."""
    since = digest.last_sent_at or (datetime.now(timezone.utc) - timedelta(hours=24))

    stmt = select(Article).where(Article.created_at >= since)

    # Scope filtering
    if digest.scope_type == "folder":
        from app.models.folder import Folder
        folder = await db.get(Folder, uuid.UUID(digest.scope_id)) if digest.scope_id else None
        if folder and folder.source_ids:
            stmt = stmt.where(Article.source_id.in_(folder.source_ids))

    # Threat filter
    if digest.min_threat:
        threat_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
        min_val = threat_order.get(digest.min_threat, 0)
        valid_threats = [k for k, v in threat_order.items() if v >= min_val]
        stmt = stmt.where(Article.threat_level.in_(valid_threats))

    stmt = stmt.order_by(Article.created_at.desc()).limit(digest.max_articles)
    result = await db.execute(stmt)
    articles = result.scalars().all()

    return {
        "digest_name": digest.name,
        "period_start": since.isoformat(),
        "period_end": datetime.now(timezone.utc).isoformat(),
        "article_count": len(articles),
        "articles": [
            {
                "title": a.title,
                "url": a.link,
                "source": a.source_id,
                "threat_level": a.threat_level,
                "summary": a.summary,
                "pub_date": a.pub_date.isoformat() if a.pub_date else None,
            }
            for a in articles
        ],
    }


def render_digest_html(content: dict) -> str:
    """Render digest as HTML email."""
    articles_html = ""
    for a in content["articles"]:
        threat_color = {"critical": "#ef4444", "high": "#f97316", "medium": "#eab308"}.get(a.get("threat_level", ""), "#94a3b8")
        articles_html += f"""
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:{threat_color}; margin-right:8px;"></span>
            <a href="{a['url']}" style="color:#1e293b; text-decoration:none; font-weight:500; font-size:14px;">{a['title']}</a>
            <br>
            <span style="color:#94a3b8; font-size:11px;">{a.get('source', '')} · {a.get('pub_date', '')}</span>
            {f'<br><span style="color:#64748b; font-size:12px; line-height:1.5;">{a["summary"]}</span>' if a.get('summary') else ''}
          </td>
        </tr>"""

    return f"""
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width:600px; margin:0 auto; padding:20px;">
      <div style="border-bottom: 3px solid #42d3a5; padding-bottom:15px; margin-bottom:20px;">
        <h1 style="font-size:20px; color:#1e293b; margin:0;">📋 {content['digest_name']}</h1>
        <p style="font-size:12px; color:#94a3b8; margin:5px 0 0;">{content['article_count']} articles · WorldMonitor Digest</p>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        {articles_html}
      </table>
      <p style="text-align:center; color:#94a3b8; font-size:11px; margin-top:30px;">
        Généré par WorldMonitor · <a href="#" style="color:#42d3a5;">Gérer mes digests</a>
      </p>
    </body>
    </html>"""
