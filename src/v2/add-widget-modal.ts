/**
 * Add Widget Modal — browse catalog presets or detect custom URL.
 */

import { addPanelWidget, templateCache } from '@/app/dashboard-engine';
import { apiFetch } from '@/services/api-client';
import { detectSource, createTemplate, validateTemplate } from '@/services/template-store';
import type { SourceTemplate } from '@/services/template-store';
import { WIDGET_CATALOG, getWidgetsByCategory, type WidgetPreset } from '@/config/widget-catalog';

export function showAddWidgetModal(dashboardId: string): void {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'wm-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'wm-modal';
  modal.innerHTML = `
    <div class="wm-modal-header">
      <h2>Add Widget</h2>
      <button class="wm-modal-close">&times;</button>
    </div>
    <div class="wm-modal-body" id="widget-modal-body"></div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close handlers
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  modal.querySelector('.wm-modal-close')!.addEventListener('click', close);
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
  });

  // Render catalog
  const body = document.getElementById('widget-modal-body')!;
  renderCatalog(body, dashboardId, close);
}

function renderCatalog(container: HTMLElement, dashboardId: string, close: () => void): void {
  const grouped = getWidgetsByCategory();

  let html = '';

  // Custom URL input at top
  html += `
    <div class="wm-widget-category">
      <h3>Custom Source</h3>
      <div class="wm-detect-row">
        <input id="custom-url" type="url" placeholder="Paste any RSS feed or JSON API URL..." />
        <button id="detect-btn" class="wm-btn wm-btn-primary">Detect</button>
      </div>
      <div id="detect-status" style="margin-top:8px; font-size:12px;"></div>
    </div>
  `;

  // Catalog categories
  for (const [category, widgets] of Object.entries(grouped)) {
    if (category === 'custom') continue;
    html += `
      <div class="wm-widget-category">
        <h3>${category}</h3>
        <div class="wm-widget-grid">
          ${widgets.map((w) => `
            <div class="wm-widget-card" data-widget-id="${w.id}">
              <div class="wm-widget-card-icon">${w.icon}</div>
              <div class="wm-widget-card-name">${w.name}</div>
              <div class="wm-widget-card-desc">${w.description}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Wire catalog card clicks
  const statusEl = document.getElementById('detect-status')!;
  container.querySelectorAll('.wm-widget-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const widgetId = (card as HTMLElement).dataset.widgetId;
      const preset = WIDGET_CATALOG.find((w) => w.id === widgetId);
      if (!preset || !preset.sourceUrl) return;

      (card as HTMLElement).style.opacity = '0.5';
      statusEl.textContent = `Adding ${preset.name}...`;

      try {
        await addPresetWidget(dashboardId, preset);
        close();
      } catch (e) {
        (card as HTMLElement).style.opacity = '1';
        statusEl.innerHTML = `<span style="color:var(--wm-error)">${e instanceof Error ? e.message : 'Failed to add widget'}</span>`;
      }
    });
  });

  // Wire custom URL detect
  document.getElementById('detect-btn')!.addEventListener('click', async () => {
    const url = (document.getElementById('custom-url') as HTMLInputElement).value.trim();
    if (!url) return;

    const status = document.getElementById('detect-status')!;
    const btn = document.getElementById('detect-btn') as HTMLButtonElement;
    btn.disabled = true;
    status.textContent = 'Detecting source format...';

    try {
      // Step 1: Detect
      const template = await detectSource(url);
      status.textContent = `Detected: ${template.panel.title} (${template.source_type}). Validating...`;

      // Step 2: Validate
      const validation = await validateTemplate(template);
      if (!validation.valid) {
        status.innerHTML = `<span style="color:var(--wm-error)">Validation failed: ${validation.errors.join(', ')}</span>`;
        btn.disabled = false;
        return;
      }
      status.textContent = `Valid! ${validation.row_count} rows. Saving...`;

      // Step 3: Save template
      const saved = await createTemplate(template);

      // Step 4: Add panel to dashboard
      await addPanelToDashboard(dashboardId, saved.id, template);
      close();
    } catch (e) {
      status.innerHTML = `<span style="color:var(--wm-error)">${e instanceof Error ? e.message : 'Detection failed'}</span>`;
      btn.disabled = false;
    }
  });
}

async function addPresetWidget(dashboardId: string, preset: WidgetPreset): Promise<void> {
  if (!preset.sourceUrl || preset.fields.length === 0) {
    throw new Error(`Preset "${preset.name}" has no source URL or fields`);
  }

  const template: SourceTemplate = {
    source_id: preset.id.replace(/-/g, '_'),
    source_type: preset.sourceType,
    category: preset.category,
    url: preset.sourceUrl,
    refresh_seconds: 300,
    enabled: true,
    fields: preset.fields,
    panel: {
      title: preset.name,
      display: preset.display,
      columns: preset.columns,
    },
  };

  // Validate — fail fast with clear error
  const validation = await validateTemplate(template);
  if (!validation.valid) {
    throw new Error(`Validation failed for "${preset.name}": ${validation.errors.join(', ')}`);
  }

  const saved = await createTemplate(template);
  // Populate the renderer cache so refreshPanel can find the template
  templateCache[template.source_id] = template;
  await addPanelToDashboard(dashboardId, saved.id, template);
}

async function addPanelToDashboard(
  dashboardId: string,
  templateId: string,
  template: SourceTemplate,
): Promise<void> {
  const panel = await apiFetch<{
    id: string;
    template_id: string;
    panel_type: string;
    config: Record<string, unknown>;
    position: { x: number; y: number; w: number; h: number };
    created_at: string;
  }>(`/dashboards/${dashboardId}/panels`, {
    method: 'POST',
    body: JSON.stringify({
      template_id: templateId,
      panel_type: 'dynamic_source',
      config: {
        title: template.panel.title,
        display: template.panel.display,
        source_id: template.source_id,
      },
      position: { x: 0, y: 0, w: 4, h: 3 },
    }),
  });

  // Add to the live grid
  addPanelWidget({
    id: panel.id,
    template_id: panel.template_id,
    panel_type: 'dynamic_source',
    hardcoded_key: null,
    config: panel.config,
    position: panel.position,
  });
}
