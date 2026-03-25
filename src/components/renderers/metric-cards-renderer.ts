/**
 * Metric cards renderer — grid of KPI cards.
 * For sources with 1 row (weather, single metrics) or summary data.
 * Shows: label + value + optional unit.
 */

import type { SourceTemplate } from '@/services/template-store';
import { formatNumber } from './format-utils';

export function renderMetricCards(
  container: HTMLElement,
  rows: Record<string, unknown>[],
  template: SourceTemplate,
): void {
  const grid = document.createElement('div');
  grid.className = 'wm-metric-grid';

  const row = rows[0] ?? {};
  const columns = template.panel.columns.length > 0
    ? template.panel.columns
    : template.fields.map((f) => f.name);
  const fieldMap = new Map(template.fields.map((f) => [f.name, f]));

  for (const col of columns) {
    const field = fieldMap.get(col);
    const val = row[col];

    const card = document.createElement('div');
    card.className = 'wm-metric-card';

    const label = document.createElement('div');
    label.className = 'wm-metric-label';
    label.textContent = col.replace(/_/g, ' ');
    card.appendChild(label);

    const value = document.createElement('div');
    value.className = 'wm-metric-value';

    if (val == null) {
      value.textContent = '—';
    } else if (field?.type === 'number' || typeof val === 'number') {
      value.textContent = formatNumber(Number(val));
    } else {
      value.textContent = String(val).slice(0, 50);
    }

    card.appendChild(value);
    grid.appendChild(card);
  }

  container.appendChild(grid);
}
