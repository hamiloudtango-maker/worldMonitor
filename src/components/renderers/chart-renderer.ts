/**
 * Chart renderer — simple sparkline/bar chart using canvas.
 * Requires a date field + at least one number field.
 * No external chart library — pure canvas.
 */

import type { SourceTemplate } from '@/services/template-store';

export function renderChart(
  container: HTMLElement,
  rows: Record<string, unknown>[],
  template: SourceTemplate,
): void {
  // Find date field and value field
  const dateField = template.fields.find(
    (f) => f.type === 'date_iso' || f.type === 'date_ms',
  );
  const valueField = template.fields.find(
    (f) => f.type === 'number' && f.name !== dateField?.name,
  );

  if (!valueField) {
    container.innerHTML = '<div class="wm-empty">No numeric field for chart</div>';
    return;
  }

  const values = rows
    .map((r) => {
      const v = r[valueField.name];
      return typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    })
    .filter((v) => !isNaN(v));

  if (values.length === 0) {
    container.innerHTML = '<div class="wm-empty">No data for chart</div>';
    return;
  }

  // Label
  const label = document.createElement('div');
  label.className = 'wm-chart-label';
  label.textContent = valueField.name.replace(/_/g, ' ');
  container.appendChild(label);

  // Canvas — HiDPI aware
  const canvas = document.createElement('canvas');
  canvas.className = 'wm-chart-canvas';
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = container.clientWidth || 400;
  const cssHeight = 100;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const min = Math.min(...values) ?? 0;
  const max = Math.max(...values) ?? 1;
  const range = (max - min) || 1;
  const padding = 4;
  const w = cssWidth - padding * 2;
  const h = cssHeight - padding * 2;

  // Draw line chart
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < values.length; i++) {
    const x = padding + (i / Math.max(values.length - 1, 1)) * w;
    const y = padding + h - (((values[i] ?? 0) - min) / range) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fill under the line
  ctx.lineTo(padding + w, padding + h);
  ctx.lineTo(padding, padding + h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.fill();

  // Current value badge
  const current = document.createElement('div');
  current.className = 'wm-chart-current';
  const last = values[values.length - 1] ?? 0;
  current.textContent = Number.isInteger(last) ? last.toLocaleString() : last.toFixed(2);
  container.appendChild(current);
}
