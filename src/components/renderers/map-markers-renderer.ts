/**
 * Map markers renderer — emits geo data as CustomEvent for MapContainer.
 * The panel itself shows a compact summary table.
 */

import type { SourceTemplate } from '@/services/template-store';
import { escapeHtml } from './format-utils';

export interface MapMarker {
  lat: number;
  lon: number;
  label: string;
  value?: string | number;
}

export function renderMapMarkers(
  container: HTMLElement,
  rows: Record<string, unknown>[],
  template: SourceTemplate,
): void {
  const latField = template.fields.find((f) => f.type === 'geo_lat');
  const lonField = template.fields.find((f) => f.type === 'geo_lon');
  const labelField = template.fields.find(
    (f) => f.name === 'title' || f.name === 'place' || f.name === 'name',
  ) ?? template.fields.find((f) => f.type === 'string');

  if (!latField || !lonField) {
    container.innerHTML = '<div class="wm-empty">No geo fields (geo_lat/geo_lon) found</div>';
    return;
  }

  // Extract markers
  const markers: MapMarker[] = [];
  for (const row of rows) {
    const lat = Number(row[latField.name]);
    const lon = Number(row[lonField.name]);
    if (isNaN(lat) || isNaN(lon)) continue;

    markers.push({
      lat,
      lon,
      label: String(row[labelField?.name ?? ''] ?? ''),
      value: (template.panel.columns[0] ? row[template.panel.columns[0]] : undefined) as string | number | undefined,
    });
  }

  // Emit event for map integration
  container.dispatchEvent(
    new CustomEvent('wm:map-markers', {
      bubbles: true,
      detail: { source_id: template.source_id, markers },
    }),
  );

  // Render compact summary table
  const summary = document.createElement('div');
  summary.className = 'wm-map-summary';

  const header = document.createElement('div');
  header.className = 'wm-map-summary-header';
  header.textContent = `${markers.length} locations`;
  summary.appendChild(header);

  const list = document.createElement('div');
  list.className = 'wm-map-summary-list';

  for (const marker of markers.slice(0, 20)) {
    const item = document.createElement('div');
    item.className = 'wm-map-summary-item';
    item.innerHTML = `
      <span class="wm-map-label">${escapeHtml(marker.label.slice(0, 60))}</span>
      ${marker.value != null ? `<span class="wm-map-value">${escapeHtml(String(marker.value))}</span>` : ''}
    `;
    // Click to center map
    item.addEventListener('click', () => {
      container.dispatchEvent(
        new CustomEvent('wm:map-focus', {
          bubbles: true,
          detail: { lat: marker.lat, lon: marker.lon, zoom: 8 },
        }),
      );
    });
    list.appendChild(item);
  }

  if (markers.length > 20) {
    const more = document.createElement('div');
    more.className = 'wm-map-more';
    more.textContent = `+${markers.length - 20} more`;
    list.appendChild(more);
  }

  summary.appendChild(list);
  container.appendChild(summary);
}

