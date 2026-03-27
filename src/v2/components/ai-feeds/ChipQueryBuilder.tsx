// src/v2/components/ai-feeds/ChipQueryBuilder.tsx
import { useState, useRef, useEffect } from 'react';
import { X, Trash2, ChevronDown, ChevronRight, ChevronLeft, Plus, Minus, Filter, Sparkles, Loader2, Tags } from 'lucide-react';
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

const SCOPE_OPTIONS = [
  { value: 'title_and_content', label: 'Titre & Contenu' },
  { value: 'title', label: 'Titre uniquement' },
] as const;

export default function ChipQueryBuilder({ query, onChange, tree = [], treeLoading = false }: Props) {
  const [addingOrTo, setAddingOrTo] = useState<number | null>(null);
  const [orValue, setOrValue] = useState('');
  const [editingAliases, setEditingAliases] = useState<string | null>(null); // "li-pi"

  // Add filter bar state
  const [showAddBar, setShowAddBar] = useState(false);
  const [addOperator, setAddOperator] = useState<'AND' | 'NOT'>('AND');
  const [addSearch, setAddSearch] = useState('');
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [drill, setDrill] = useState<DrillLevel>({ depth: 0 });

  const addBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addBarRef.current && !addBarRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false);
        setDrill({ depth: 0 });
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
    // Auto-open aliases editor for the new chip
    setEditingAliases(`${layerIdx}-${newPartIdx}`);
  }

  function updateAliases(layerIdx: number, partIdx: number, aliasText: string) {
    const layer = query.layers[layerIdx]!;
    const parts = [...layer.parts];
    const part = parts[partIdx]!;
    parts[partIdx] = { type: part.type, value: part.value, scope: part.scope, aliases: aliasText.split(',').map(a => a.trim()).filter(Boolean) };
    updateLayer(layerIdx, { ...layer, parts });
  }

  function updateScope(layerIdx: number, scope: QueryPart['scope']) {
    const layer = query.layers[layerIdx]!;
    updateLayer(layerIdx, { ...layer, parts: layer.parts.map(p => ({ ...p, scope })) });
  }

  function addFilterFromLeaf(leaf: CategoryLeaf) {
    const allKeywords = [...leaf.keywords_strong, ...leaf.keywords_weak];
    onChange({
      layers: [
        ...query.layers,
        { operator: addOperator, parts: [{ type: 'entity', value: leaf.label, aliases: allKeywords, scope: 'title_and_content' }] },
      ],
    });
    resetAddBar();
  }

  function addFilterFromText(value: string) {
    if (!value.trim()) return;
    const newLayerIdx = query.layers.length;
    onChange({
      layers: [
        ...query.layers,
        { operator: addOperator, parts: [{ type: 'keyword', value: value.trim(), scope: 'title_and_content' }] },
      ],
    });
    resetAddBar();
    // Auto-open aliases editor for the new chip
    setEditingAliases(`${newLayerIdx}-0`);
  }

  function resetAddBar() {
    setShowAddBar(false);
    setShowAddDropdown(false);
    setAddSearch('');
    setDrill({ depth: 0 });
  }

  // ── Tree dropdown (shared with FeedCreator pattern) ──
  const treeDropdown = (
    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
      {treeLoading ? (
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 size={14} className="animate-spin text-[#42d3a5]" />
          <span className="text-[11px] text-slate-400">Chargement...</span>
        </div>
      ) : tree.length === 0 ? (
        <div className="py-4 text-center text-[11px] text-slate-400">Tapez un terme et appuyez Entrée</div>
      ) : drill.depth === 0 ? (
        <>
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Catégories</div>
          {tree
            .filter(c => !addSearch || c.label.toLowerCase().includes(addSearch.toLowerCase()))
            .map((l1, i) => (
              <button key={i} onClick={() => setDrill({ depth: 1, l1 })}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left transition-colors">
                <Filter size={13} className="text-[#42d3a5] shrink-0" />
                <span className="text-[12px] font-medium text-slate-700 flex-1">{l1.label}</span>
                <span className="text-[9px] text-slate-400">{l1.children.length}</span>
                <ChevronRight size={13} className="text-slate-300" />
              </button>
            ))}
        </>
      ) : drill.depth === 1 ? (
        <>
          <button onClick={() => setDrill({ depth: 0 })}
            className="w-full flex items-center gap-2 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 text-left sticky top-0 bg-white">
            <ChevronLeft size={13} className="text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-600">{drill.l1.label}</span>
          </button>
          {drill.l1.children
            .filter(c => !addSearch || c.label.toLowerCase().includes(addSearch.toLowerCase()))
            .map((l2, i) => (
              <button key={i} onClick={() => setDrill({ depth: 2, l1: drill.l1, l2 })}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left transition-colors">
                <Filter size={13} className="text-slate-400 shrink-0" />
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
          <button onClick={() => setDrill({ depth: 1, l1: drill.l1 })}
            className="w-full flex items-center gap-2 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 text-left sticky top-0 bg-white">
            <ChevronLeft size={13} className="text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-600 truncate">{drill.l1.label} › {drill.l2.label}</span>
          </button>
          {drill.l2.children
            .filter(c => !addSearch || c.label.toLowerCase().includes(addSearch.toLowerCase()))
            .map((leaf, i) => (
              <button key={i} onClick={() => addFilterFromLeaf(leaf)}
                className="w-full flex items-start gap-3 px-3 py-2 hover:bg-slate-50 text-left transition-colors">
                <Sparkles size={13} className="text-[#42d3a5] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-slate-700">{leaf.label}</div>
                  {leaf.description && <div className="text-[10px] text-slate-400">{leaf.description}</div>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {leaf.keywords_strong.slice(0, 3).map((kw, ki) => (
                      <span key={ki} className="text-[8px] bg-[#42d3a5]/15 text-[#2a9d7e] font-bold px-1.5 py-0.5 rounded">{kw}</span>
                    ))}
                    {leaf.keywords_weak.slice(0, 2).map((kw, ki) => (
                      <span key={ki} className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{kw}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
        </>
      )}
    </div>
  );

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-600 mb-3">Filtres</h2>

      {/* Existing layers */}
      <div className="space-y-0">
        {query.layers.map((layer, li) => (
          <div key={li}>
            {li > 0 && (
              <div className="py-1.5 text-[11px] font-bold text-slate-400">{layer.operator}</div>
            )}
            <div className="flex items-center gap-2 py-1.5">
              <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                {layer.parts.map((part, pi) => (
                  <div key={pi} className="inline-flex flex-col">
                    <div className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                      <Filter size={11} className="text-[#42d3a5]" />
                      <span className="text-[11px] font-medium text-slate-700">{part.value}</span>
                      {/* Aliases badge */}
                      <button
                        onClick={() => setEditingAliases(editingAliases === `${li}-${pi}` ? null : `${li}-${pi}`)}
                        className="text-[8px] font-bold text-blue-500 hover:text-blue-700 bg-blue-50 px-1 py-0.5 rounded"
                        title="Éditer les aliases / mots-clés"
                      >
                        <Tags size={9} className="inline" /> {part.aliases?.length || 0}
                      </button>
                      <button onClick={() => removePart(li, pi)} className="p-0.5 text-slate-400 hover:text-red-500 transition-colors">
                        <X size={11} />
                      </button>
                    </div>
                    {/* Aliases editor */}
                    {editingAliases === `${li}-${pi}` && (
                      <div className="mt-1 p-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                        <label className="text-[8px] font-bold text-blue-600 uppercase block mb-0.5">Aliases / mots-clés</label>
                        <input
                          autoFocus
                          value={(part.aliases || []).join(', ')}
                          onChange={e => updateAliases(li, pi, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingAliases(null); }}
                          placeholder="war, conflict, strike..."
                          className="w-full text-[10px] px-2 py-1 border border-blue-200 rounded bg-white focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    )}
                  </div>
                ))}
                {addingOrTo === li ? (
                  <input autoFocus value={orValue}
                    onChange={e => setOrValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addOrPart(li, orValue); if (e.key === 'Escape') { setAddingOrTo(null); setOrValue(''); } }}
                    onBlur={() => { if (orValue.trim()) addOrPart(li, orValue); else { setAddingOrTo(null); setOrValue(''); } }}
                    placeholder="Ajouter..."
                    className="px-2.5 py-1 text-[11px] border border-[#42d3a5] rounded-lg focus:outline-none w-32" />
                ) : (
                  <button onClick={() => setAddingOrTo(li)}
                    className="text-[11px] font-semibold text-[#42d3a5] hover:text-[#38b891] flex items-center gap-0.5">
                    <Plus size={11} /> OR
                  </button>
                )}
              </div>
              <div className="relative shrink-0">
                <select value={layer.parts[0]?.scope || 'title_and_content'}
                  onChange={e => updateScope(li, e.target.value as QueryPart['scope'])}
                  className="appearance-none text-[10px] text-slate-500 pr-5 pl-2 py-1 border border-slate-200 rounded-lg bg-white cursor-pointer focus:outline-none focus:border-[#42d3a5]">
                  {SCOPE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <button onClick={() => removeLayer(li)} className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add filter bar with tree dropdown */}
      {showAddBar ? (
        <div className="mt-3" ref={addBarRef}>
          <div className="text-[11px] font-bold text-slate-400 py-1.5">{addOperator}</div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input autoFocus value={addSearch}
              onChange={e => { setAddSearch(e.target.value); setShowAddDropdown(true); }}
              onFocus={() => setShowAddDropdown(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') addFilterFromText(addSearch);
                if (e.key === 'Escape') resetAddBar();
              }}
              placeholder="Rechercher ou naviguer dans les catégories..."
              className="w-full pl-9 pr-4 py-2 text-[12px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#42d3a5] bg-white" />
            {showAddDropdown && treeDropdown}
          </div>
          <button onClick={resetAddBar} className="mt-2 text-[11px] text-slate-400 hover:text-slate-600">Annuler</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => { setAddOperator('AND'); setShowAddBar(true); }}
            className="text-[11px] font-semibold text-[#42d3a5] hover:text-[#38b891] flex items-center gap-0.5">
            <Plus size={11} /> AND
          </button>
          <span className="text-slate-300">/</span>
          <button onClick={() => { setAddOperator('NOT'); setShowAddBar(true); }}
            className="text-[11px] font-semibold text-[#42d3a5] hover:text-[#38b891] flex items-center gap-0.5">
            <Minus size={11} /> NOT
          </button>
        </div>
      )}
    </div>
  );
}
