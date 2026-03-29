/**
 * ModelQueryBuilder — unified query builder working with model_layers.
 *
 * Format: [{ operator: "OR"|"AND"|"NOT", model_ids: ["hex1", "hex2"] }]
 *
 * Logic:
 * - Line 1 (OR): base set — articles matching any model in this line
 * - Line N (AND): intersection with result of all lines above
 * - Line N (NOT): exclusion from result of line above
 * - OR within a line: union of models
 *
 * Used by: Cases, Feeds, anywhere filters are needed.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Minus, Sparkles, Loader2, Search } from 'lucide-react';
import { api } from '@/v2/lib/api';

export interface ModelLayer {
  operator: 'OR' | 'AND' | 'NOT';
  model_ids: string[];
}

interface Props {
  layers: ModelLayer[];
  onChange: (layers: ModelLayer[]) => void;
}

interface ModelInfo {
  model_id: string;
  model_name: string;
  family: string;
  section: string;
}

interface SearchResult extends ModelInfo {
  matched_term: string;
  score: number;
}

const ACCENT = '#42d3a5';

export default function ModelQueryBuilder({ layers, onChange }: Props) {
  const [modelCache, setModelCache] = useState<Map<string, ModelInfo>>(new Map());
  const [showAddBar, setShowAddBar] = useState(false);
  const [addIsNot, setAddIsNot] = useState(false);
  const [addingOrTo, setAddingOrTo] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const addBarRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addBarRef.current && !addBarRef.current.contains(e.target as Node)) {
        resetAddBar();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Resolve model names — single lightweight POST with just the IDs needed
  useEffect(() => {
    const allIds = layers.flatMap(l => l.model_ids);
    const missing = allIds.filter(id => !modelCache.has(id));
    if (!missing.length) return;
    api<{ models: Record<string, { name: string; family: string; section: string }> }>(
      '/ai-feeds/intel-models/resolve-ids',
      { method: 'POST', body: JSON.stringify({ ids: missing }) }
    ).then(res => {
      const cache = new Map(modelCache);
      for (const [mid, info] of Object.entries(res.models)) {
        cache.set(mid, { model_id: mid, model_name: info.name, family: info.family, section: info.section });
      }
      setModelCache(cache);
    }).catch(() => {});
  }, [layers]);

  // Fuzzy search
  const fetchSuggestions = useCallback((q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      api<{ results: SearchResult[] }>(`/ai-feeds/intel-models/search?q=${encodeURIComponent(q)}&limit=8`)
        .then(r => { setSuggestions(r.results); setSearching(false); })
        .catch(() => setSearching(false));
    }, 200);
  }, []);

  // ── Mutations ──

  function addModelToLayer(layerIdx: number, modelId: string) {
    const updated = [...layers];
    const layer = updated[layerIdx]!;
    if (layer.model_ids.includes(modelId)) return;
    updated[layerIdx] = { ...layer, model_ids: [...layer.model_ids, modelId] };
    onChange(updated);
    resetAddBar();
  }

  function addNewLayer(modelId: string, isNot: boolean) {
    const op: ModelLayer['operator'] = isNot ? 'NOT' : (layers.length === 0 ? 'OR' : 'AND');
    onChange([...layers, { operator: op, model_ids: [modelId] }]);
    resetAddBar();
  }

  function removeModel(layerIdx: number, modelId: string) {
    const layer = layers[layerIdx]!;
    const newIds = layer.model_ids.filter(id => id !== modelId);
    if (newIds.length === 0) {
      onChange(layers.filter((_, i) => i !== layerIdx));
    } else {
      const updated = [...layers];
      updated[layerIdx] = { operator: layer.operator, model_ids: newIds };
      onChange(updated);
    }
  }

  function removeLayer(idx: number) {
    onChange(layers.filter((_, i) => i !== idx));
  }

  function selectSuggestion(result: SearchResult) {
    // Cache the model info
    setModelCache(prev => {
      const next = new Map(prev);
      next.set(result.model_id, result);
      return next;
    });
    if (addingOrTo !== null) {
      addModelToLayer(addingOrTo, result.model_id);
    } else {
      addNewLayer(result.model_id, addIsNot);
    }
  }

  function resetAddBar() {
    setShowAddBar(false);
    setAddIsNot(false);
    setAddingOrTo(null);
    setSearchInput('');
    setSuggestions([]);
  }

  function getModelName(id: string): string {
    return modelCache.get(id)?.model_name || modelCache.get(id.replace(/-/g, ''))?.model_name || id.slice(0, 8) + '...';
  }

  function getModelMeta(id: string): string {
    const info = modelCache.get(id) || modelCache.get(id.replace(/-/g, ''));
    return info ? `${info.family}/${info.section}` : '';
  }

  // ── Render ──

  const OP_STYLE: Record<string, { bg: string; text: string; label: string }> = {
    OR:  { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'OR' },
    AND: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'AND' },
    NOT: { bg: 'bg-red-50', text: 'text-red-700', label: 'NOT' },
  };

  return (
    <div className="space-y-2">
      {/* Layers */}
      {layers.map((layer, li) => {
        const style = OP_STYLE[layer.operator] ?? OP_STYLE.OR!;
        return (
          <div key={li} className={`rounded-xl border p-2.5 ${style.bg} border-opacity-50`}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-bold ${style.text} px-1.5 py-0.5 rounded`}>{style.label}</span>
              {li > 0 && (
                <button onClick={() => removeLayer(li)} className="ml-auto p-0.5 text-slate-400 hover:text-red-500">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {layer.model_ids.map(mid => (
                <div key={mid} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                  layer.operator === 'NOT' ? 'bg-red-100 text-red-700' : 'bg-white text-slate-700 border border-slate-200'
                }`}>
                  <Sparkles size={10} className={layer.operator === 'NOT' ? 'text-red-400' : 'text-[#42d3a5]'} />
                  <span>{getModelName(mid)}</span>
                  <span className="text-[8px] text-slate-400">{getModelMeta(mid)}</span>
                  <button onClick={() => removeModel(li, mid)} className="p-0.5 text-slate-400 hover:text-red-500">
                    <X size={10} />
                  </button>
                </div>
              ))}
              {/* +OR button to add more models to this layer */}
              <button
                onClick={() => { setAddingOrTo(li); setShowAddBar(true); }}
                className="text-[10px] text-slate-400 hover:text-[#42d3a5] px-2 py-1 border border-dashed border-slate-300 rounded-lg hover:border-[#42d3a5]/50"
              >
                +OR
              </button>
            </div>
          </div>
        );
      })}

      {/* Add bar (fuzzy search) */}
      {showAddBar ? (
        <div ref={addBarRef} className="border border-slate-200 rounded-xl p-3 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              addingOrTo !== null ? 'bg-emerald-50 text-emerald-700' : addIsNot ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
            }`}>
              {addingOrTo !== null ? '+OR' : addIsNot ? 'NOT' : layers.length === 0 ? 'OR' : 'AND'}
            </span>
            <span className="text-[10px] text-slate-400">
              {addingOrTo !== null ? 'Ajouter un modèle à cette ligne' : 'Nouvelle ligne de filtre'}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              autoFocus
              value={searchInput}
              onChange={e => { setSearchInput(e.target.value); fetchSuggestions(e.target.value); }}
              placeholder="Rechercher un modèle..."
              className="w-full pl-9 pr-4 py-2 text-[12px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#42d3a5] bg-white"
            />
          </div>
          {/* Suggestions */}
          {searching && (
            <div className="flex items-center gap-2 py-3 justify-center">
              <Loader2 size={14} className="animate-spin text-[#42d3a5]" />
              <span className="text-[11px] text-slate-400">Recherche...</span>
            </div>
          )}
          {!searching && searchInput.length >= 2 && suggestions.length === 0 && (
            <div className="py-3 text-center text-[11px] text-slate-400">Aucun modèle trouvé</div>
          )}
          {suggestions.length > 0 && (
            <div className="border border-slate-200 rounded-xl mt-2 overflow-hidden max-h-48 overflow-y-auto">
              {suggestions.map(s => {
                const alreadyInLayer = addingOrTo !== null && layers[addingOrTo]?.model_ids.includes(s.model_id);
                return (
                  <button
                    key={s.model_id}
                    onClick={() => selectSuggestion(s)}
                    disabled={!!alreadyInLayer}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] border-b border-slate-100 last:border-b-0 ${
                      alreadyInLayer ? 'opacity-40' : 'hover:ring-1 hover:ring-[#42d3a5]/30'
                    }`}
                  >
                    <Sparkles size={12} className="text-[#42d3a5] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-700">{s.model_name}</span>
                      <span className="text-[9px] text-slate-400 ml-1.5">{s.family}/{s.section}</span>
                    </div>
                    {s.matched_term !== s.model_name && (
                      <span className="text-[9px] text-slate-400 truncate max-w-[80px]">via "{s.matched_term}"</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={resetAddBar} className="mt-2 text-[11px] text-slate-400 hover:text-slate-600">Annuler</button>
        </div>
      ) : (
        <div className="flex items-center gap-3 mt-1">
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
