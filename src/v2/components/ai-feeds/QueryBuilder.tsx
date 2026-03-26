// src/v2/components/ai-feeds/QueryBuilder.tsx
import { useState } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';
import type { QueryLayer, QueryPart, FeedQuery } from '@/v2/lib/ai-feeds-api';

interface Props {
  query: FeedQuery;
  onChange: (query: FeedQuery) => void;
}

const OPERATORS = ['AND', 'OR', 'NOT'] as const;
const SCOPES = [
  { value: 'title_and_content', label: 'Titre & Contenu' },
  { value: 'title', label: 'Titre uniquement' },
] as const;
const PART_TYPES = [
  { value: 'topic', label: 'Topic' },
  { value: 'entity', label: 'Entité' },
  { value: 'keyword', label: 'Mot-clé' },
] as const;

export default function QueryBuilder({ query, onChange }: Props) {
  const [editingAliases, setEditingAliases] = useState<string | null>(null);

  function addLayer() {
    onChange({
      layers: [...query.layers, { operator: 'AND', parts: [] }],
    });
  }

  function removeLayer(idx: number) {
    onChange({ layers: query.layers.filter((_, i) => i !== idx) });
  }

  function updateLayer(idx: number, layer: QueryLayer) {
    const updated = [...query.layers];
    updated[idx] = layer;
    onChange({ layers: updated });
  }

  function addPart(layerIdx: number) {
    const layer = query.layers[layerIdx];
    updateLayer(layerIdx, {
      ...layer,
      parts: [...layer.parts, { type: 'topic', value: '', scope: 'title_and_content' }],
    });
  }

  function updatePart(layerIdx: number, partIdx: number, part: QueryPart) {
    const layer = query.layers[layerIdx];
    const parts = [...layer.parts];
    parts[partIdx] = part;
    updateLayer(layerIdx, { ...layer, parts });
  }

  function removePart(layerIdx: number, partIdx: number) {
    const layer = query.layers[layerIdx];
    updateLayer(layerIdx, {
      ...layer,
      parts: layer.parts.filter((_, i) => i !== partIdx),
    });
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-slate-900">Collect articles and reports</h4>
      <p className="text-[11px] text-slate-400">Construisez votre requête avec des filtres combinés (AND/OR/NOT)</p>

      {query.layers.map((layer, li) => (
        <div key={li} className="relative">
          {/* Operator badge between layers */}
          {li > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 border-t border-slate-200" />
              <select
                value={layer.operator}
                onChange={e => updateLayer(li, { ...layer, operator: e.target.value as QueryLayer['operator'] })}
                className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-[#42d3a5]"
              >
                {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <div className="flex-1 border-t border-slate-200" />
            </div>
          )}

          {/* Layer card */}
          <div className="bg-slate-50 rounded-lg border border-slate-200/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Filtre {li + 1}
              </span>
              <button onClick={() => removeLayer(li)} className="text-slate-400 hover:text-red-500 p-0.5">
                <X size={12} />
              </button>
            </div>

            {/* Parts (tags) */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {layer.parts.map((part, pi) => (
                <div key={pi} className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 group">
                  {/* Type selector */}
                  <select
                    value={part.type}
                    onChange={e => updatePart(li, pi, { ...part, type: e.target.value as QueryPart['type'] })}
                    className="text-[9px] font-bold uppercase text-[#42d3a5] bg-transparent border-none focus:outline-none cursor-pointer"
                  >
                    {PART_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>

                  {/* Value input */}
                  <input
                    value={part.value}
                    onChange={e => updatePart(li, pi, { ...part, value: e.target.value })}
                    placeholder="Valeur..."
                    className="text-[11px] text-slate-700 font-medium bg-transparent border-none focus:outline-none w-28"
                  />

                  {/* Scope dropdown */}
                  <select
                    value={part.scope}
                    onChange={e => updatePart(li, pi, { ...part, scope: e.target.value as QueryPart['scope'] })}
                    className="text-[9px] text-slate-400 bg-transparent border-none focus:outline-none cursor-pointer"
                  >
                    {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>

                  {/* Aliases (for entities) */}
                  {part.type === 'entity' && (
                    <button
                      onClick={() => setEditingAliases(editingAliases === `${li}-${pi}` ? null : `${li}-${pi}`)}
                      className="text-[9px] text-blue-500 hover:text-blue-700 font-medium"
                    >
                      {part.aliases?.length ? `+${part.aliases.length}` : 'aliases'}
                    </button>
                  )}

                  {/* Remove */}
                  <button
                    onClick={() => removePart(li, pi)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 ml-1"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              <button
                onClick={() => addPart(li)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-[#42d3a5] border border-dashed border-slate-200 rounded-lg hover:border-[#42d3a5] transition-colors"
              >
                <Plus size={10} /> Ajouter
              </button>
            </div>

            {/* Aliases editor (inline, shown when editing) */}
            {layer.parts.map((part, pi) =>
              editingAliases === `${li}-${pi}` && part.type === 'entity' ? (
                <div key={`alias-${pi}`} className="mt-2 p-2 bg-white rounded border border-blue-100">
                  <label className="text-[9px] font-bold text-blue-600 uppercase mb-1 block">
                    Aliases pour "{part.value}"
                  </label>
                  <input
                    value={(part.aliases || []).join(', ')}
                    onChange={e => updatePart(li, pi, {
                      ...part,
                      aliases: e.target.value.split(',').map(a => a.trim()).filter(Boolean),
                    })}
                    placeholder="Apple Inc., AAPL, Apple Computer"
                    className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-blue-400"
                  />
                </div>
              ) : null
            )}
          </div>
        </div>
      ))}

      <button
        onClick={addLayer}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-slate-400 hover:text-[#42d3a5] border border-dashed border-slate-200 rounded-lg hover:border-[#42d3a5] transition-colors"
      >
        <Plus size={12} /> Ajouter un filtre
      </button>
    </div>
  );
}
