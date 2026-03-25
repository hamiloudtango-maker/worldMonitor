/**
 * Dashboard Engine — Gridstack.js powered layout manager.
 * Replaces panel-layout.ts for v2 dynamic dashboards.
 * Loads dashboard config from API, renders panels via Gridstack grid.
 */

import { GridStack, type GridStackNode } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

import { apiFetch } from '@/services/api-client';
import type { SourceTemplate } from '@/services/template-store';

// --- Types ---

export interface DashboardPanel {
  id: string;
  template_id: string | null;
  panel_type: 'dynamic_source' | 'hardcoded';
  hardcoded_key: string | null;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface Dashboard {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
  is_public: boolean;
  layout: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  panels: DashboardPanel[];
}

export type PanelRenderer = (
  container: HTMLElement,
  rows: Record<string, unknown>[],
  template: SourceTemplate,
) => void;

// --- Engine ---

let grid: GridStack | null = null;
let currentDashboard: Dashboard | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

// Registry of renderers by display type
const renderers: Record<string, PanelRenderer> = {};

export function registerRenderer(displayType: string, renderer: PanelRenderer): void {
  renderers[displayType] = renderer;
}

export function getGrid(): GridStack | null {
  return grid;
}

export function getCurrentDashboard(): Dashboard | null {
  return currentDashboard;
}

/**
 * Initialize Gridstack on a container element.
 */
export function initGrid(container: HTMLElement, options?: { readOnly?: boolean }): GridStack {
  grid = GridStack.init(
    {
      column: 12,
      cellHeight: 80,
      animate: true,
      float: false,
      disableDrag: options?.readOnly ?? false,
      disableResize: options?.readOnly ?? false,
      removable: false,
    },
    container,
  );

  // Auto-save layout on change (debounced)
  grid.on('change', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => void saveLayout(), 500);
  });

  return grid;
}

/**
 * Load a dashboard from the API and render all its panels.
 */
export async function loadDashboard(dashboardId: string): Promise<Dashboard> {
  const [dashboard, templates] = await Promise.all([
    apiFetch<Dashboard>(`/dashboards/${dashboardId}`),
    apiFetch<Array<{ template: SourceTemplate }>>('/sources/v1/templates'),
  ]);

  // Populate template cache eagerly — avoids N+1 fetches during panel refresh
  for (const t of templates) {
    templateCache[t.template.source_id] = t.template;
  }

  currentDashboard = dashboard;

  if (!grid) throw new Error('Grid not initialized');
  grid.removeAll();

  for (const panel of dashboard.panels) {
    addPanelWidget(panel);
  }

  return dashboard;
}

/**
 * Load a public dashboard (no auth required).
 */
export async function loadPublicDashboard(slug: string): Promise<Dashboard> {
  const dashboard = await apiFetch<Dashboard>(`/dashboards/public/${slug}`);
  currentDashboard = dashboard;

  if (!grid) throw new Error('Grid not initialized');
  grid.removeAll();

  for (const panel of dashboard.panels) {
    addPanelWidget(panel);
  }

  return dashboard;
}

/**
 * Add a single panel widget to the grid.
 */
export function addPanelWidget(panel: DashboardPanel): void {
  if (!grid) return;

  // Panel header
  const header = document.createElement('div');
  header.classList.add('wm-panel-header');
  header.innerHTML = `
    <span class="wm-panel-title">${panel.config.title ?? panel.hardcoded_key ?? 'Panel'}</span>
    <div class="wm-panel-actions">
      <button class="wm-btn-icon wm-refresh-btn" title="Refresh">&#x21bb;</button>
      <button class="wm-btn-icon wm-config-btn" title="Configure">&#x2699;</button>
      <button class="wm-btn-icon wm-remove-btn" title="Remove">&#x2715;</button>
    </div>
  `;
  // Panel body (where renderer puts content)
  const body = document.createElement('div');
  body.classList.add('wm-panel-body');
  body.innerHTML = '<div class="wm-loading">Loading...</div>';

  // Gridstack v12: addWidget with object, then populate the content element
  const widget = grid.addWidget({
    id: panel.id,
    x: panel.position.x,
    y: panel.position.y,
    w: panel.position.w,
    h: panel.position.h,
    content: '',
  });

  // Replace the auto-generated content with our panel
  const gsContent = widget.querySelector('.grid-stack-item-content');
  if (gsContent) {
    gsContent.classList.add('wm-panel');
    gsContent.setAttribute('data-panel-id', panel.id);
    gsContent.setAttribute('data-panel-type', panel.panel_type);
    gsContent.innerHTML = '';
    gsContent.appendChild(header);
    gsContent.appendChild(body);
  }

  // Wire remove button
  widget.querySelector('.wm-remove-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    removePanel(panel.id);
  });

  // Wire refresh button
  widget.querySelector('.wm-refresh-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    body.innerHTML = '<div class="wm-loading">Loading...</div>';
    void refreshPanel(panel);
  });

  // Trigger initial data fetch for dynamic source panels
  if (panel.panel_type === 'dynamic_source' && panel.template_id) {
    void refreshPanel(panel);
  }
}

// Cache of loaded templates by source_id
const templateCache: Record<string, SourceTemplate> = {};

/**
 * Fetch data and render a panel.
 */
async function refreshPanel(panel: DashboardPanel): Promise<void> {
  if (panel.panel_type !== 'dynamic_source') return;

  const sourceId = panel.config.source_id as string;
  if (!sourceId) return;

  const el = document.querySelector(`[data-panel-id="${panel.id}"] .wm-panel-body`);
  if (!el || !(el instanceof HTMLElement)) return;

  try {
    const template = templateCache[sourceId];

    // Fetch data
    const data = await apiFetch<{
      rows: Record<string, unknown>[];
      source_id: string;
    }>(`/sources/v1/data/${sourceId}`);

    // Determine display type
    const displayType = template?.panel?.display ?? (panel.config.display as string) ?? 'table';
    const renderer = renderers[displayType];

    if (renderer && data.rows.length > 0 && template) {
      el.innerHTML = '';
      renderer(el, data.rows, template);
    } else if (data.rows.length > 0) {
      el.innerHTML = `<div class="wm-empty">${data.rows.length} rows loaded</div>`;
    } else {
      el.innerHTML = `<div class="wm-empty">No data</div>`;
    }
  } catch (err) {
    el.innerHTML = `<div class="wm-error">Error: ${err instanceof Error ? err.message : err}</div>`;
  }
}

/**
 * Remove a panel from the grid and API.
 */
async function removePanel(panelId: string): Promise<void> {
  if (!grid || !currentDashboard) return;

  const el = grid.getGridItems().find((item) => item.getAttribute('gs-id') === panelId);
  if (el) grid.removeWidget(el);

  try {
    await apiFetch(`/dashboards/${currentDashboard.id}/panels/${panelId}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.error('Failed to delete panel:', err);
  }
}

/**
 * Save current layout to the API.
 */
async function saveLayout(): Promise<void> {
  if (!grid || !currentDashboard) return;

  const items = grid.getGridItems();
  const layout = items
    .map((el) => {
      const node = el.gridstackNode as GridStackNode | undefined;
      const id = el.getAttribute('gs-id');
      if (!node || !id) return null;
      return { id, x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 4, h: node.h ?? 3 };
    })
    .filter(Boolean);

  try {
    await apiFetch(`/dashboards/${currentDashboard.id}`, {
      method: 'PUT',
      body: JSON.stringify({ layout }),
    });
  } catch (err) {
    // Show save failure indicator
    const header = document.querySelector('.wm-header');
    if (header && !header.querySelector('.wm-save-error')) {
      const badge = document.createElement('span');
      badge.className = 'wm-save-error';
      badge.textContent = 'Changes not saved';
      badge.style.cssText = 'color:var(--wm-error);font-size:11px;margin-left:8px;';
      header.querySelector('.wm-header-left')?.appendChild(badge);
      setTimeout(() => badge.remove(), 5000);
    }
    console.error('Failed to save layout:', err);
  }
}

/**
 * List user's dashboards.
 */
export async function listDashboards() {
  return apiFetch<Array<{
    id: string;
    name: string;
    slug: string;
    is_default: boolean;
    panel_count: number;
  }>>('/dashboards');
}

/**
 * Create a new dashboard.
 */
export async function createDashboard(name: string): Promise<Dashboard> {
  return apiFetch<Dashboard>('/dashboards', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

/**
 * Destroy the grid (cleanup).
 */
export function destroyGrid(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  grid?.destroy(false);
  grid = null;
  currentDashboard = null;
}
