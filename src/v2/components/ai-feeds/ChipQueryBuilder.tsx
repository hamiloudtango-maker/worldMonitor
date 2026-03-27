// src/v2/components/ai-feeds/ChipQueryBuilder.tsx
// Feedly-style query builder: OR within rows, AND between rows, NOT to exclude
import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, ChevronLeft, Plus, Minus, Filter, Sparkles, Loader2, Tags } from 'lucide-react';
import type { FeedQuery, QueryLayer, QueryPart } from '@/v2/lib/ai-feeds-api';
import type { CategoryL1, CategoryL2, CategoryLeaf } from '@/v2/lib/ai-feeds-api';

interface Props {
  query: FeedQuery;
  onChange: (query: FeedQuery) => void;
  tree?: CategoryL1[];
  treeLoading?: boolean;
}

type DrillLevel =
  | { depth: 0 }
  | { depth: 1; l1: CategoryL1 }
  | { depth: 2; l1: CategoryL1; l2: CategoryL2 };

export default function ChipQueryBuilder({ query, onChange, tree = [], treeLoading = false }: Props) {
  const [addingOrTo, setAddingOrTo] = useState<number | null>(null);
  const [orValue, setOrValue] = useState('');
  const [editingAliases, setEditingAliases] = useState<string | null>(null);
  const [showAddBar, setShowAddBar] = useState(false);
  const [addIsNot, setAddIsNot] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [drill, setDrill] = useState<DrillLevel>({ depth: 0 });
  const addBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addBarRef.current && !addBarRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Mutations ──

  function updateLayer(idx: number, layer: QueryLayer) {
    const updated = [...query.layers];
    updated[idx] = layer;
    onChange({ layers: updated });
  }

  function removeLayer(idx: number) {
    onChange({ layers: query.layers.filter((_, i) => i !== idx) });
  }

  function removePart(layerIdx: number, partIdx: number) {
    const layer = query.layers[layerIdx]!;
    const parts = layer.parts.filter((_, i) => i !== partIdx);
    if (parts.length === 0) removeLayer(layerIdx);
    else updateLayer(layerIdx, { ...layer, parts });
  }

  function addOrPart(layerIdx: number, value: string) {
    if (!value.trim()) return;
    const layer = query.layers[layerIdx]!;
    const newPartIdx = layer.parts.length;
    updateLayer(layerIdx, { ...layer, parts: [...layer.parts, { type: 'keyword', value: value.trim(), scope: 'title_and_content' }] });
    setOrValue('');
    setAddingOrTo(null);
    _autoGenerateAliases(layerIdx, newPartIdx, value.trim(), 'keyword');
  }

  function updateAliases(layerIdx: number, partIdx: number, aliasText: string) {
    const layer = query.layers[layerIdx]!;
    const parts = [...layer.parts];
    const part = parts[partIdx]!;
    parts[partIdx] = { ...part, aliases: aliasText.split(',').map(a => a.trim()).filter(Boolean) };
    updateLayer(layerIdx, { ...layer, parts });
  }

  function updateScope(layerIdx: number, scope: QueryPart['scope']) {
    const layer = query.layers[layerIdx]!;
    updateLayer(layerIdx, { ...layer, parts: layer.parts.map(p => ({ ...p, scope })) });
  }

  function addNewLayer(value: string, isNot: boolean) {
    if (!value.trim()) return;
    const newIdx = query.layers.length;
    const op = isNot ? 'NOT' : (query.layers.length === 0 ? 'OR' : 'AND');
    onChange({
      layers: [...query.layers, { operator: op, parts: [{ type: 'keyword', value: value.trim(), scope: 'title_and_content' }] }],
    });
    resetAddBar();
    _autoGenerateAliases(newIdx, 0, value.trim(), 'keyword');
  }

  function addLayerFromLeaf(leaf: CategoryLeaf) {
    const allKeywords = [...leaf.keywords_strong, ...leaf.keywords_weak];
    const op = addIsNot ? 'NOT' : (query.layers.length === 0 ? 'OR' : 'AND');
    onChange({
      layers: [...query.layers, { operator: op, parts: [{ type: 'entity', value: leaf.label, aliases: allKeywords, scope: 'title_and_content' }] }],
    });
    resetAddBar();
  }

  function _autoGenerateAliases(layerIdx: number, partIdx: number, term: string, type: string) {
    import('@/v2/lib/ai-feeds-api').then(({ generateAliases }) =>
      generateAliases(term, type).then(({ aliases }) => {
        if (aliases.length > 0) updateAliases(layerIdx, partIdx, aliases.join(', '));
      })
    ).catch(() => {});
  }

  function resetAddBar() {
    setShowAddBar(false);
    setShowAddDropdown(false);
    setAddSearch('');
    setAddIsNot(false);
    setDrill({ depth: 0 });
  }

  // ── Tree dropdown ──
  const treeDropdown = (
    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
      {treeLoading ? (
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 size={14} className="animate-spin text-[#42d3a5]" />
          <span className="text-[11px] text-slate-400">Chargement...</span>
        </div>
      ) : tree.length === 0 ? (
        <div className="py-4 text-center text-[11px] text-slate-400">Tapez un terme et appuyez Entree</div>
      ) : drill.depth === 0 ? (
        <>
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Categories</div>
          {tree.filter(c => !addSearch || c.label.toLowerCase().includes(addSearch.toLowerCase())).map((l1, i) => (
            <button key={i} onClick={() => setDrill({ depth: 1, l1 })}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left">
              <Filter size={13} className="text-[#42d3a5]" />
              <span className="text-[12px] font-medium text-slate-700 flex-1">{l1.label}</span>
              <span className="text-[9px] text-slate-400">{l1.children.length}</span>
              <ChevronRight size={13} className="text-slate-300" />
            </button>
          ))}
        </>
      ) : drill.depth === 1 ? (
        <>
          <button onClick={() => setDrill({ depth: 0 })} className="w-full flex items-center gap-2 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 text-left sticky top-0 bg-white">
            <ChevronLeft size={13} className="text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-600">{drill.l1.label}</span>
          </button>
          {drill.l1.children.filter(c => !addSearch || c.label.toLowerCase().includes(addSearch.toLowerCase())).map((l2, i) => (
            <button key={i} onClick={() => setDrill({ depth: 2, l1: drill.l1, l2 })}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left">
              <Filter size={13} className="text-slate-400" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-slate-700">{l2.label}</div>
                {l2.description && <div className="text-[10px] text-slate-400 truncate">{l2.description}</div>}
              </div>
              <ChevronRight size={13} className="text-slate-300" />
            </button>
          ))}
        </>
      ) : (
        <>
          <button onClick={() => setDrill({ depth: 1, l1: drill.l1 })} className="w-full flex items-center gap-2 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 text-left sticky top-0 bg-white">
            <ChevronLeft size={13} className="text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-600 truncate">{drill.l1.label} &gt; {drill.l2.label}</span>
          </button>
          {drill.l2.children.filter(c => !addSearch || c.label.toLowerCase().includes(addSearch.toLowerCase())).map((leaf, i) => (
            <button key={i} onClick={() => addLayerFromLeaf(leaf)}
              className="w-full flex items-start gap-3 px-3 py-2 hover:bg-slate-50 text-left">
              <Sparkles size={13} className="text-[#42d3a5] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-slate-700">{leaf.label}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {leaf.keywords_strong.slice(0, 3).map((kw, ki) => (
                    <span key={ki} className="text-[8px] bg-[#42d3a5]/15 text-[#2a9d7e] font-bold px-1.5 py-0.5 rounded">{kw}</span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );

  // ── Render ──
  return (
    <div>
      <p className="text-[11px] text-slate-400 mb-3">Construisez votre requete avec des filtres combines (AND/OR/NOT)</p>

      {/* Layers */}
      {query.layers.map((layer, li) => (
        <div key={li}>
          {/* AND/NOT separator between rows */}
          {li > 0 && (
            <div className="flex items-center gap-3 my-2">
              <span className={`text-[11px] font-bold ${layer.operator === 'NOT' ? 'text-red-500' : 'text-slate-400'}`}>
                {layer.operator === 'NOT' ? 'NOT' : 'AND'}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          )}

          {/* Row: chips (OR) + scope + delete */}
          <div className="flex items-start gap-3">
            {/* Chips area */}
            <div className="flex-1 flex items-center gap-2 flex-wrap min-h-[36px]">
              {layer.parts.map((part, pi) => (
                <div key={pi} className="flex flex-col">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                    layer.operator === 'NOT' ? 'bg-red-50 border-red-200' : 'bg-slate-800 border-slate-700'
                  }`}>
                    <Filter size={11} className={layer.operator === 'NOT' ? 'text-red-400' : 'text-[#42d3a5]'} />
                    <span className={`text-[12px] font-medium ${layer.operator === 'NOT' ? 'text-red-700' : 'text-white'}`}>{part.value}</span>
                    {(part.aliases?.length || 0) > 0 && (
                      <button
                        onClick={() => setEditingAliases(editingAliases === `${li}-${pi}` ? null : `${li}-${pi}`)}
                        className="text-[9px] font-bold text-blue-400 hover:text-blue-300 bg-blue-900/30 px-1 py-0.5 rounded"
                      >
                        +{part.aliases!.length}
                      </button>
                    )}
                    <button onClick={() => removePart(li, pi)} className={`p-0.5 transition-colors ${
                      layer.operator === 'NOT' ? 'text-red-300 hover:text-red-600' : 'text-slate-400 hover:text-white'
                    }`}>
                      <X size={12} />
                    </button>
                  </div>
                  {/* Aliases editor */}
                  {editingAliases === `${li}-${pi}` && (
                    <div className="mt-1 p-2 bg-blue-50 border border-blue-100 rounded-lg max-w-sm">
                      <label className="text-[9px] font-bold text-blue-600 block mb-1">Synonymes / traductions</label>
                      <textarea
                        autoFocus
                        value={(part.aliases || []).join(', ')}
                        onChange={e => updateAliases(li, pi, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setEditingAliases(null); }}
                        placeholder="war, guerre, война..."
                        rows={2}
                        className="w-full text-[10px] px-2 py-1 border border-blue-200 rounded bg-white focus:outline-none resize-none"
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* + OR button */}
              {addingOrTo === li ? (
                <input autoFocus value={orValue}
                  onChange={e => setOrValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addOrPart(li, orValue); if (e.key === 'Escape') { setAddingOrTo(null); setOrValue(''); } }}
                  onBlur={() => { if (orValue.trim()) addOrPart(li, orValue); else { setAddingOrTo(null); setOrValue(''); } }}
                  placeholder="Terme..."
                  className="px-3 py-1.5 text-[11px] border border-dashed border-slate-400 rounded-lg focus:outline-none focus:border-[#42d3a5] w-36 bg-transparent" />
              ) : (
                <button onClick={() => setAddingOrTo(li)}
                  className="text-[11px] font-medium text-[#42d3a5] hover:text-[#38b891] flex items-center gap-1">
                  <Plus size={12} /> OR
                </button>
              )}
            </div>

            {/* Scope + delete */}
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <select value={layer.parts[0]?.scope || 'title_and_content'}
                onChange={e => updateScope(li, e.target.value as QueryPart['scope'])}
                className="text-[10px] text-slate-500 pr-5 pl-2 py-1.5 border border-slate-200 rounded-lg bg-white cursor-pointer focus:outline-none">
                <option value="title_and_content">Find in Title &amp; Content</option>
                <option value="title">Find in Title</option>
              </select>
              <button onClick={() => removeLayer(li)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* + AND / — NOT buttons */}
      {showAddBar ? (
        <div className="mt-3" ref={addBarRef}>
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-[11px] font-bold ${addIsNot ? 'text-red-500' : 'text-slate-400'}`}>{addIsNot ? 'NOT' : query.layers.length === 0 ? '' : 'AND'}</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input autoFocus value={addSearch}
              onChange={e => { setAddSearch(e.target.value); setShowAddDropdown(true); }}
              onFocus={() => setShowAddDropdown(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') addNewLayer(addSearch, addIsNot);
                if (e.key === 'Escape') resetAddBar();
              }}
              placeholder="Tapez un terme ou choisissez dans les categories..."
              className="w-full pl-9 pr-4 py-2.5 text-[12px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#42d3a5] bg-white" />
            {showAddDropdown && treeDropdown}
          </div>
          <button onClick={resetAddBar} className="mt-2 text-[11px] text-slate-400 hover:text-slate-600">Annuler</button>
        </div>
      ) : (
        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => { setAddIsNot(false); setShowAddBar(true); }}
            className="text-[12px] font-semibold text-slate-500 hover:text-[#42d3a5] flex items-center gap-1">
            <Plus size={13} /> AND
          </button>
          <span className="text-slate-300">/</span>
          <button onClick={() => { setAddIsNot(true); setShowAddBar(true); }}
            className="text-[12px] font-semibold text-red-400 hover:text-red-500 flex items-center gap-1">
            <Minus size={13} /> NOT
          </button>
        </div>
      )}
    </div>
  );
}
