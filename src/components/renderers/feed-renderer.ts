/**
 * Feed renderer — scrollable list of items (news, RSS).
 * Shows: title, date, description snippet, link, optional thumbnail.
 */

import type { SourceTemplate } from '@/services/template-store';

export function renderFeed(
  container: HTMLElement,
  rows: Record<string, unknown>[],
  template: SourceTemplate,
): void {
  const list = document.createElement('div');
  list.className = 'wm-feed-list';

  for (const row of rows.slice(0, 50)) {
    const item = document.createElement('a');
    item.className = 'wm-feed-item';
    item.target = '_blank';
    item.rel = 'noopener';

    // Find link field
    const linkField = template.fields.find((f) => f.type === 'url');
    if (linkField) item.href = String(row[linkField.name] ?? '#');

    // Thumbnail
    const thumbField = template.fields.find(
      (f) => f.type === 'url' && f.name.includes('thumb'),
    );
    if (thumbField && row[thumbField.name]) {
      const img = document.createElement('img');
      img.className = 'wm-feed-thumb';
      img.src = String(row[thumbField.name]);
      img.loading = 'lazy';
      img.alt = '';
      item.appendChild(img);
    }

    const text = document.createElement('div');
    text.className = 'wm-feed-text';

    // Title
    const titleField = template.fields.find(
      (f) => f.name === 'title' || template.panel.columns[0] === f.name,
    );
    if (titleField) {
      const h = document.createElement('div');
      h.className = 'wm-feed-title';
      h.textContent = String(row[titleField.name] ?? '');
      text.appendChild(h);
    }

    // Date
    const dateField = template.fields.find(
      (f) => f.type === 'date_iso' || f.type === 'date_ms' || f.name.includes('date') || f.name.includes('Date'),
    );
    if (dateField && row[dateField.name]) {
      const d = document.createElement('time');
      d.className = 'wm-feed-date';
      const val = row[dateField.name];
      try {
        const date = typeof val === 'number' ? new Date(val) : new Date(String(val));
        d.textContent = date.toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
      } catch {
        d.textContent = String(val);
      }
      text.appendChild(d);
    }

    // Description snippet
    const descField = template.fields.find(
      (f) => f.name === 'description' || f.name === 'summary',
    );
    if (descField && row[descField.name]) {
      const p = document.createElement('div');
      p.className = 'wm-feed-desc';
      const raw = String(row[descField.name]);
      // Strip HTML tags
      p.textContent = raw.replace(/<[^>]+>/g, '').slice(0, 150);
      text.appendChild(p);
    }

    item.appendChild(text);
    list.appendChild(item);
  }

  container.appendChild(list);
}
