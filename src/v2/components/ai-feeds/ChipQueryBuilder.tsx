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

const OP_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  OR:  { label: 'OU — élargir', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  AND: { label: 'ET — affiner', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  NOT: { label: 'SAUF — exclure', color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
};

export default function ChipQueryBuilder({ query, onChange, tree = [], treeLoading = false }: Props) {
  const [addingOrTo, setAddingOrTo] = useState<number | null>(null);
  const [orValue, setOrValue] = useState('');
  const [editingAliases, setEditingAliases] = useState<string | null>(null);
  const [showAddBar, setShowAddBar] = useState(false);
  const [addOperator, setAddOperator] = useState<'OR' | 'AND' | 'NOT'>('OR');
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

  function updateLayer(idx: number, layer: QueryLayer) {
    const updated = [...query.layers];
    updated[idx] = layer;
    onChange({ layers: updated });
  }

  function _autoGenerateAliases(layerIdx: number, partIdx: number, term: string, type: string) {
    import('@/v2/lib/ai-feeds-api').then(({ generateAliases }) =>
      generateAliases(term, type).then(({ aliases }) => {
        if (aliases.length > 0) {
          updateAliases(layerIdx, partIdx, aliases.join(', '));
        }
      })
    ).catch(() => {});
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
    _autoGenerateAliases(newLayerIdx, 0, value.trim(), 'keyword');
  }

  function resetAddBar() {
    setShowAddBar(false);
    setShowAddDropdown(false);
    setAddSearch('');
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
            <span className="text-[12px] font-semibold text-slate-600 truncate">{drill.l1.label} &gt; {drill.l2.label}</span>
          </button>
          {drill.l2.children
            .filter(c => !addSearch || c.label.toLowerCase().includes(addSearch.toLowerCase()))
            .map((leaf, i) => (
              <button key={i} onClick={() => addFilterFromLeaf(leaf)}
                className="w-full flex items-start gap-3 px-3 py-2 hover:bg-slate-50 text-left transition-colors">
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

  return (
    <div>
      <h2 className="text-[13px] font-bold text-slate-800 mb-3">Construisez votre requete avec des filtres combines (AND/OR/NOT)</h2>

      {/* Layers */}
      <div className="space-y-2">
        {query.layers.map((layer, li) => {
          const opStyle = OP_LABELS[layer.operator] || OP_LABELS.OR;
          return (
            <div key={li}>
              {/* Operator separator */}
              {li > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className={`text-[10px] font-bold uppercase ${opStyle.color}`}>{layer.operator}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              )}
              {li === 0 && (
                <div className="text-[10px] font-medium text-slate-400 mb-1">Filtre {li + 1}</div>
              )}

              {/* Layer card */}
              <div className={`rounded-xl border p-3 ${li === 0 ? 'bg-white border-slate-200' : opStyle.bg}`}>
                {/* Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {layer.parts.map((part, pi) => (
                    <div key={pi} className="group relative">
                      {/* Chip */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <span className="text-[9px] font-bold uppercase text-slate-400">{part.type === 'entity' ? 'Entite' : part.type === 'topic' ? 'Topic' : 'Mot-cle'}</span>
                        <span className="text-[12px] font-semibold text-slate-800">{part.value}</span>
                        {/* Aliases count */}
                        <button
                          onClick={() => setEditingAliases(editingAliases === `${li}-${pi}` ? null : `${li}-${pi}`)}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                            (part.aliases?.length || 0) > 0
                              ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title="Synonymes / traductions"
                        >
                          +{part.aliases?.length || 0}
                        </button>
                        <button onClick={() => removePart(li, pi)} className="p-0.5 text-slate-300 hover:text-red-500 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                      {/* Aliases editor (expandable) */}
                      {editingAliases === `${li}-${pi}` && (
                        <div className="mt-1.5 p-2 bg-blue-50/80 border border-blue-100 rounded-lg">
                          <label className="text-[9px] font-bold text-blue-600 block mb-1">Synonymes, traductions, abbreviations</label>
                          <textarea
                            autoFocus
                            value={(part.aliases || []).join(', ')}
                            onChange={e => updateAliases(li, pi, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Escape') setEditingAliases(null); }}
                            placeholder="war, guerre, conflict, война..."
                            rows={2}
                            className="w-full text-[11px] px-2 py-1.5 border border-blue-200 rounded bg-white focus:outline-none focus:border-blue-400 resize-none"
                          />
                          <button onClick={() => setEditingAliases(null)} className="mt-1 text-[9px] text-blue-500 hover:text-blue-700">Fermer</button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add term to this layer */}
                  {addingOrTo === li ? (
                    <input autoFocus value={orValue}
                      onChange={e => setOrValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addOrPart(li, orValue); if (e.key === 'Escape') { setAddingOrTo(null); setOrValue(''); } }}
                      onBlur={() => { if (orValue.trim()) addOrPart(li, orValue); else { setAddingOrTo(null); setOrValue(''); } }}
                      placeholder="Ajouter un terme..."
                      className="px-3 py-1.5 text-[11px] border border-dashed border-slate-300 rounded-lg focus:outline-none focus:border-[#42d3a5] w-40" />
                  ) : (
                    <button onClick={() => setAddingOrTo(li)}
                      className="text-[11px] text-slate-400 hover:text-[#42d3a5] flex items-center gap-1 px-2 py-1.5 border border-dashed border-slate-200 rounded-lg hover:border-[#42d3a5]/40 transition-colors">
                      <Plus size={11} /> Ajouter
                    </button>
                  )}
                </div>

                {/* Scope selector */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                  <select value={layer.parts[0]?.scope || 'title_and_content'}
                    onChange={e => updateScope(li, e.target.value as QueryPart['scope'])}
                    className="text-[10px] text-slate-500 pr-5 pl-2 py-1 border border-slate-200 rounded bg-white cursor-pointer focus:outline-none">
                    <option value="title_and_content">Titre & Contenu</option>
                    <option value="title">Titre uniquement</option>
                  </select>
                  <button onClick={() => removeLayer(li)} className="text-[10px] text-slate-300 hover:text-red-500 flex items-center gap-1 transition-colors">
                    <Trash2 size={11} /> Supprimer
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new layer */}
      {showAddBar ? (
        <div className="mt-3" ref={addBarRef}>
          <div className="flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-slate-200" />
            <span className={`text-[10px] font-bold uppercase ${(OP_LABELS[addOperator] || OP_LABELS.OR).color}`}>{addOperator}</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input autoFocus value={addSearch}
              onChange={e => { setAddSearch(e.target.value); setShowAddDropdown(true); }}
              onFocus={() => setShowAddDropdown(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') addFilterFromText(addSearch);
                if (e.key === 'Escape') resetAddBar();
              }}
              placeholder="Tapez un terme ou choisissez dans les categories..."
              className="w-full pl-9 pr-4 py-2.5 text-[12px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#42d3a5] bg-white" />
            {showAddDropdown && treeDropdown}
          </div>
          <button onClick={resetAddBar} className="mt-2 text-[11px] text-slate-400 hover:text-slate-600">Annuler</button>
        </div>
      ) : (
        <div className="mt-4">
          <div className="text-[10px] text-slate-400 mb-2">Ajouter un filtre</div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setAddOperator('AND'); setShowAddBar(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-lg border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors">
              <Plus size={12} /> ET (affiner)
            </button>
            <button onClick={() => { setAddOperator('NOT'); setShowAddBar(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-lg border border-dashed border-red-300 text-red-500 hover:bg-red-50 transition-colors">
              <Minus size={12} /> SAUF (exclure)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
