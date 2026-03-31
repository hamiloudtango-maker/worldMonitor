/**
 * WidgetGrid — Free positioning with react-grid-layout.
 * Drag anywhere, resize from corners/edges, auto-compact.
 * Per-widget settings panel (⚙) Inoreader-style.
 *
 * Widget content is rendered via React portals to bypass
 * react-grid-layout's shouldComponentUpdate which only compares
 * children keys, not content.
 */
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
// @ts-ignore — CJS module, default import for Vite compat
import RGL from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { X, Plus, Search, Settings, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import ErrorBoundary from './shared/ErrorBoundary';

const ACCENT = '#42d3a5';
const ReactGridLayout = RGL.WidthProvider ? RGL.WidthProvider(RGL) : RGL;

/* ═══ Types ═══ */

export interface WidgetConfigField {
  key: string;
  label: string;
  type: 'select' | 'number' | 'toggle' | 'text';
  options?: { value: string; label: string }[];
  default?: any;
  min?: number;
  max?: number;
}

export interface WidgetDef {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  category: string;
  defaultW: number;   // grid units (out of 12)
  defaultH: number;   // grid units
  minW?: number;
  minH?: number;
  configFields?: WidgetConfigField[];
}

export interface WidgetState {
  id: string;
  w: number;
  h: number;
}

interface LayoutItem {
  i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number;
}

interface Props {
  catalog: WidgetDef[];
  storageKey: string;
  defaultWidgets: WidgetState[];
  renderContent: (id: string, config?: Record<string, any>) => React.ReactNode;
}

/* ═══ Persistence ═══ */
function toLayout(widgets: WidgetState[], catalog: Record<string, WidgetDef>): LayoutItem[] {
  let x = 0, y = 0;
  return widgets.map(ws => {
    const def = catalog[ws.id];
    const w = ws.w, h = ws.h;
    if (x + w > 12) { x = 0; y += h; }
    const item: LayoutItem = { i: ws.id, x, y, w, h, minW: def?.minW ?? 2, minH: def?.minH ?? 2 };
    x += w;
    return item;
  });
}

function loadLayout(key: string, defaults: WidgetState[], catalog: Record<string, WidgetDef>): LayoutItem[] {
  try {
    const r = localStorage.getItem(key);
    if (r) return JSON.parse(r);
  } catch {/**/}
  return toLayout(defaults, catalog);
}
function saveLayout(key: string, layout: LayoutItem[]) {
  localStorage.setItem(key, JSON.stringify(layout));
}

function loadWidgetConfigs(key: string): Record<string, Record<string, any>> {
  try {
    const r = localStorage.getItem(`${key}_configs`);
    if (r) return JSON.parse(r);
  } catch {/**/}
  return {};
}
function saveWidgetConfigs(key: string, configs: Record<string, Record<string, any>>) {
  localStorage.setItem(`${key}_configs`, JSON.stringify(configs));
}

/* ═══ Portal-based widget content ═══ */
function WidgetPortal({ id, renderContent, config }: {
  id: string;
  renderContent: (id: string, config?: Record<string, any>) => React.ReactNode;
  config?: Record<string, any>;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById(`wg-content-${id}`);
    if (el) setTarget(el);
  }, [id]);

  if (!target) return null;
  return createPortal(
    <ErrorBoundary label={id}>{renderContent(id, config)}</ErrorBoundary>,
    target,
  );
}

/* ═══ Widget Settings Panel ═══ */
function WidgetSettingsPanel({ def, config, onChange, onClose }: {
  def: WidgetDef;
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onClose: () => void;
}) {
  if (!def.configFields?.length) return null;

  return (
    <div className="absolute top-10 right-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-30 overflow-hidden" onMouseDown={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/80">
        <span className="text-[11px] font-bold text-slate-700">Configuration</span>
        <button onClick={onClose} className="p-0.5 text-slate-400 hover:text-slate-600 rounded">
          <X size={12} />
        </button>
      </div>
      <div className="p-3 space-y-3">
        {def.configFields.map(field => (
          <div key={field.key}>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
              {field.label}
            </label>
            {field.type === 'select' && (
              <select
                value={config[field.key] ?? field.default ?? ''}
                onChange={e => onChange(field.key, e.target.value)}
                className="w-full text-[12px] px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#42d3a5] text-slate-700"
              >
                {field.options?.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
            {field.type === 'number' && (
              <input
                type="number"
                value={config[field.key] ?? field.default ?? ''}
                onChange={e => onChange(field.key, parseInt(e.target.value) || field.default)}
                min={field.min}
                max={field.max}
                className="w-full text-[12px] px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#42d3a5] text-slate-700"
              />
            )}
            {field.type === 'toggle' && (
              <button
                onClick={() => onChange(field.key, !(config[field.key] ?? field.default))}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  (config[field.key] ?? field.default) ? 'bg-[#42d3a5]' : 'bg-slate-200'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  (config[field.key] ?? field.default) ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </button>
            )}
            {field.type === 'text' && (
              <input
                type="text"
                value={config[field.key] ?? field.default ?? ''}
                onChange={e => onChange(field.key, e.target.value)}
                className="w-full text-[12px] px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#42d3a5] text-slate-700"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ Component ═══ */
export default function WidgetGrid({ catalog, storageKey, defaultWidgets, renderContent }: Props) {
  const catalogMap = Object.fromEntries(catalog.map(w => [w.id, w]));
  const [layout, setLayout] = useState<LayoutItem[]>(() => loadLayout(storageKey, defaultWidgets, catalogMap));
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState<string | null>(null);
  const [widgetConfigs, setWidgetConfigs] = useState<Record<string, Record<string, any>>>(() => loadWidgetConfigs(storageKey));

  const onLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    setLayout(prev => {
      const posMap = new Map(newLayout.map(l => [l.i, l]));
      const merged = prev.map(item => {
        const pos = posMap.get(item.i);
        return pos ? { ...item, x: pos.x, y: pos.y, w: pos.w, h: pos.h } : item;
      });
      saveLayout(storageKey, merged);
      return merged;
    });
  }, [storageKey]);

  const updateWidgetConfig = useCallback((widgetId: string, key: string, value: any) => {
    setWidgetConfigs(prev => {
      const next = { ...prev, [widgetId]: { ...(prev[widgetId] || {}), [key]: value } };
      saveWidgetConfigs(storageKey, next);
      return next;
    });
  }, [storageKey]);

  function addWidget(id: string) {
    if (layout.some(l => l.i === id)) return;
    const def = catalogMap[id]; if (!def) return;
    const maxY = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    const next: LayoutItem[] = [...layout, {
      i: id, x: 0, y: maxY, w: def.defaultW, h: def.defaultH,
      minW: def.minW ?? 2, minH: def.minH ?? 2,
    }];
    setLayout(next); saveLayout(storageKey, next);
  }

  function removeWidget(id: string) {
    const next = layout.filter(l => l.i !== id);
    setLayout(next); saveLayout(storageKey, next);
    setSettingsOpen(null);
  }

  function resetLayout() {
    const next = toLayout(defaultWidgets, catalogMap);
    setLayout(next); saveLayout(storageKey, next);
  }

  const activeSet = new Set(layout.map(l => l.i));
  const available = catalog.filter(w => !activeSet.has(w.id));

  const activeItems = layout.filter(item => catalogMap[item.i]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {layout.length > 0 && (
            <button onClick={resetLayout} className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600 rounded transition-colors" title="Réinitialiser">
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>
        <button onClick={() => setShowCatalog(!showCatalog)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#42d3a5] hover:border-[#42d3a5]/30 transition-all">
          <Plus size={14} /> Widget
        </button>
      </div>

      {/* Catalog */}
      {showCatalog && (
        <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-lg max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2 sticky top-0 bg-white pb-2 z-10">
            <h3 className="text-sm font-bold text-slate-900">Ajouter un widget</h3>
            <button onClick={() => { setShowCatalog(false); setCatalogSearch(''); }} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <div className="relative mb-3 sticky top-8 bg-white z-10">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} placeholder="Rechercher..."
              className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#42d3a5]" autoFocus />
          </div>
          {available.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Tous les widgets sont affichés</p>
          ) : (() => {
            const q = catalogSearch.toLowerCase();
            const filtered = q ? available.filter(w => w.title.toLowerCase().includes(q) || w.category.toLowerCase().includes(q)) : available;
            const filteredCats = [...new Set(filtered.map(w => w.category))];
            const coreCategories = filteredCats.filter(c => !c.startsWith('RSS'));
            const rssCategories = filteredCats.filter(c => c.startsWith('RSS'));
            if (filtered.length === 0) return <p className="text-sm text-slate-400 text-center py-4">Aucun widget trouvé</p>;
            return (
              <>
                {/* Core widgets */}
                <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
                  {coreCategories.map(cat => (
                    <div key={cat} className="break-inside-avoid mb-3">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{cat}</div>
                      <div className="space-y-0.5">
                        {filtered.filter(w => w.category === cat).map(w => (
                          <button key={w.id} onClick={() => addWidget(w.id)} className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] text-slate-600 hover:bg-[#42d3a5]/5 hover:text-[#2a9d7e] transition-colors">
                            <w.icon size={12} className="shrink-0" /> <span className="truncate">{w.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* RSS sources */}
                {rssCategories.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 border-t border-slate-200" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sources RSS</span>
                      <div className="flex-1 border-t border-slate-200" />
                    </div>
                    <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
                      {rssCategories.map(cat => (
                        <div key={cat} className="break-inside-avoid mb-3">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{cat.replace('RSS ', '')}</div>
                          <div className="space-y-0.5">
                            {filtered.filter(w => w.category === cat).map(w => (
                              <button key={w.id} onClick={() => addWidget(w.id)} className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] text-slate-600 hover:bg-[#42d3a5]/5 hover:text-[#2a9d7e] transition-colors">
                                <w.icon size={12} className="shrink-0" /> <span className="truncate">{w.title}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Grid */}
      {activeItems.length > 0 ? (
        <>
          <ReactGridLayout
            layout={activeItems}
            cols={12}
            rowHeight={50}
            onLayoutChange={onLayoutChange}
            draggableHandle=".wg-drag"
            compactType="vertical"
            isResizable
            isDraggable
            margin={[12, 12]}
            containerPadding={[0, 0]}
            useCSSTransforms
          >
            {activeItems.map(item => {
              const def = catalogMap[item.i];
              const Icon = def.icon;
              const hasConfig = def.configFields && def.configFields.length > 0;
              return (
                <div key={item.i} className="bg-white rounded-xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden group relative">
                  {/* Header — drag handle */}
                  <div className="wg-drag px-3 py-1.5 border-b border-slate-100 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none">
                    <div className="flex items-center gap-2">
                      <Icon size={13} style={{ color: ACCENT }} />
                      <span className="text-[12px] font-bold text-slate-900">{def.title}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {hasConfig && (
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => setSettingsOpen(settingsOpen === item.i ? null : item.i)}
                          className={`p-1 rounded transition-all ${
                            settingsOpen === item.i
                              ? 'text-[#42d3a5] bg-teal-50'
                              : 'text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100'
                          }`}
                          title="Configurer"
                        >
                          <Settings size={12} />
                        </button>
                      )}
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => removeWidget(item.i)}
                        className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                  {/* Settings panel */}
                  {settingsOpen === item.i && hasConfig && (
                    <WidgetSettingsPanel
                      def={def}
                      config={widgetConfigs[item.i] || {}}
                      onChange={(key, value) => updateWidgetConfig(item.i, key, value)}
                      onClose={() => setSettingsOpen(null)}
                    />
                  )}
                  {/* Portal target — content rendered outside RGL's tree */}
                  <div id={`wg-content-${item.i}`} className="flex-1 min-h-0 overflow-hidden" />
                </div>
              );
            })}
          </ReactGridLayout>
          {/* Portals: render widget content independently of RGL's SCU */}
          {activeItems.map(item => (
            <WidgetPortal key={item.i} id={item.i} renderContent={renderContent} config={widgetConfigs[item.i]} />
          ))}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/60 p-12 text-center">
          <p className="text-sm text-slate-500 mb-4">Aucun widget.</p>
          <button onClick={() => setShowCatalog(true)} className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl" style={{ background: ACCENT }}>
            <Plus size={16} /> Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
