/**
 * Renderer registry — maps display types to render functions.
 */

export { renderFeed } from './feed-renderer';
export { renderTable } from './table-renderer';
export { renderMetricCards } from './metric-cards-renderer';
export { renderChart } from './chart-renderer';
export { renderMapMarkers } from './map-markers-renderer';

import { registerRenderer } from '@/app/dashboard-engine';
import { renderChart } from './chart-renderer';
import { renderFeed } from './feed-renderer';
import { renderMapMarkers } from './map-markers-renderer';
import { renderMetricCards } from './metric-cards-renderer';
import { renderTable } from './table-renderer';

/**
 * Register all built-in renderers with the dashboard engine.
 * Call this once at app startup.
 */
export function registerAllRenderers(): void {
  registerRenderer('feed', renderFeed);
  registerRenderer('table', renderTable);
  registerRenderer('metric_cards', renderMetricCards);
  registerRenderer('chart', renderChart);
  registerRenderer('map_markers', renderMapMarkers);
}
