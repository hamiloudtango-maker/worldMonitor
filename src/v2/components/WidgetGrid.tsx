/**
 * WidgetGrid — Free positioning with react-grid-layout.
 * Drag anywhere, resize from corners/edges, auto-compact.
 */
import { useState, useCallback } from 'react';
// @ts-ignore — CJS module, default import for Vite compat
import RGL from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { X, Plus, RefreshCw } from 'lucide-react';

const ACCENT = '#42d3a5';
const ReactGridLayout = RGL.WidthProvider ? RGL.WidthProvider(RGL) : RGL;

/* ═══ Types ═══ */
export interface WidgetDef {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  category: string;
  defaultW: number;   // grid units (out of 12)
  defaultH: number;   // grid units
  minW?: number;
  minH?: number;
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
  renderContent: (id: string) => React.ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
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

/* ═══ Component ═══ */
export default function WidgetGrid({ catalog, storageKey, defaultWidgets, renderContent, onRefresh, loading }: Props) {
  const catalogMap = Object.fromEntries(catalog.map(w => [w.id, w]));
  const [layout, setLayout] = useState<LayoutItem[]>(() => loadLayout(storageKey, defaultWidgets, catalogMap));
  const [showCatalog, setShowCatalog] = useState(false);

  const onLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    // Merge positions from react-grid-layout with our state to preserve
    // widget selection and minW/minH constraints
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

  function addWidget(id: string) {
    if (layout.some(l => l.i === id)) return;
    const def = catalogMap[id]; if (!def) return;
    const maxY = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    const next: LayoutItem[] = [...layout, {
      i: id, x: 0, y: maxY, w: def.defaultW, h: def.defaultH,
      minW: def.minW ?? 2, minH: def.minH ?? 2,
    }];
    setLayout(next); saveLayout(storageKey, next); setShowCatalog(false);
  }

  function removeWidget(id: string) {
    const next = layout.filter(l => l.i !== id);
    setLayout(next); saveLayout(storageKey, next);
  }

  function resetLayout() {
    const next = toLayout(defaultWidgets, catalogMap);
    setLayout(next); saveLayout(storageKey, next);
  }

  const activeSet = new Set(layout.map(l => l.i));
  const available = catalog.filter(w => !activeSet.has(w.id));
  const categories = [...new Set(available.map(w => w.category))];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {loading && <RefreshCw size={14} className="animate-spin text-slate-400" />}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCatalog(!showCatalog)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#42d3a5] hover:border-[#42d3a5]/30 transition-all">
            <Plus size={14} /> Widget
          </button>
          {onRefresh && (
            <button onClick={onRefresh} className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-[#42d3a5] transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Catalog */}
      {showCatalog && (
        <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Ajouter un widget</h3>
            <button onClick={() => setShowCatalog(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          {available.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Tous les widgets sont affichés</p>
          ) : (
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{cat}</div>
                  <div className="flex flex-wrap gap-2">
                    {available.filter(w => w.category === cat).map(w => (
                      <button key={w.id} onClick={() => addWidget(w.id)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 hover:border-[#42d3a5]/30 hover:bg-[#42d3a5]/5 text-sm text-slate-600 hover:text-[#2a9d7e] transition-all">
                        <w.icon size={14} /> {w.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      {layout.length > 0 ? (
        <ReactGridLayout
          layout={layout}
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
          {layout.map(item => {
            const def = catalogMap[item.i];
            if (!def) return <div key={item.i} style={{ display: 'none' }} />;
            const Icon = def.icon;
            return (
              <div key={item.i} className="bg-white rounded-xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden">
                {/* Header — drag handle */}
                <div className="wg-drag px-3 py-1.5 border-b border-slate-100 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none">
                  <div className="flex items-center gap-2">
                    <Icon size={13} style={{ color: ACCENT }} />
                    <span className="text-[12px] font-bold text-slate-900">{def.title}</span>
                  </div>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => removeWidget(item.i)}
                    className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
                {/* Content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {renderContent(item.i)}
                </div>
              </div>
            );
          })}
        </ReactGridLayout>
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
