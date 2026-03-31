// src/v2/components/ai-feeds/FeedCreator.tsx
// Wizard = browse taxonomy (family → section → models) + ModelQueryBuilder
import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, Loader2, Search } from 'lucide-react';
import type { FeedQuery } from '@/v2/lib/ai-feeds-api';
import { fetchIntelTree } from '@/v2/lib/ai-feeds-api';
import type { IntelFamily, IntelSection, IntelModelData } from '@/v2/lib/ai-feeds-api';
import { api } from '@/v2/lib/api';
import ModelQueryBuilder, { type ModelLayer } from '../shared/ModelQueryBuilder';

interface Props {
  onSave: (name: string, query: FeedQuery) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export default function FeedCreator({ onSave, onCancel, saving }: Props) {
  const [feedName, setFeedName] = useState('');
  const [modelLayers, setModelLayers] = useState<ModelLayer[]>([]);

  // Tree browser state
  const [families, setFamilies] = useState<IntelFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<
    | { depth: 0 }
    | { depth: 1; familyIdx: number }
    | { depth: 2; familyIdx: number; sectionIdx: number }
  >({ depth: 0 });
  const [search, setSearch] = useState('');
  const [fuzzyResults, setFuzzyResults] = useState<{ model_id: string; model_name: string; family: string; section: string; score: number }[]>([]);
  const [fuzzySearching, setFuzzySearching] = useState(false);
  const fuzzyRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetchIntelTree()
      .then(d => { setFamilies(d.families); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Fuzzy search via API when typing
  useEffect(() => {
    if (search.length < 2) { setFuzzyResults([]); return; }
    clearTimeout(fuzzyRef.current);
    setFuzzySearching(true);
    fuzzyRef.current = setTimeout(() => {
      api<{ results: typeof fuzzyResults }>(`/ai-feeds/intel-models/search?q=${encodeURIComponent(search)}&limit=8`)
        .then(r => { setFuzzyResults(r.results); setFuzzySearching(false); })
        .catch(() => setFuzzySearching(false));
    }, 250);
    return () => clearTimeout(fuzzyRef.current);
  }, [search]);

  function addModel(model: IntelModelData) {
    // Check if already added
    const allIds = modelLayers.flatMap(l => l.model_ids);
    if (allIds.includes(model.id)) return;

    if (modelLayers.length === 0) {
      setModelLayers([{ operator: 'OR', model_ids: [model.id] }]);
    } else {
      // Add to first OR layer
      const updated = [...modelLayers];
      updated[0] = { ...updated[0], model_ids: [...updated[0].model_ids, model.id] };
      setModelLayers(updated);
    }
    if (!feedName) setFeedName(model.name);
  }

  async function handleSave() {
    const name = feedName.trim() || `Feed ${new Date().toLocaleDateString('fr-FR')}`;
    await onSave(name, { layers: [], model_layers: modelLayers });
  }

  const allSelectedIds = new Set(modelLayers.flatMap(l => l.model_ids));

  // Search filter
  const searchLower = search.toLowerCase();
  function matchesSearch(text: string) {
    return !search || text.toLowerCase().includes(searchLower);
  }

  // ── Tree browser ──
  function renderBrowser() {
    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 size={14} className="animate-spin text-[#42d3a5]" />
          <span className="text-[11px] text-[#556677]">Chargement des modèles...</span>
        </div>
      );
    }

    // Level 0: families
    if (level.depth === 0) {
      return (
        <div className="border border-[#1e2d3d] rounded-xl overflow-hidden">
          {families
            .filter(f => f.key !== 'mute')
            .filter(f => matchesSearch(f.label) || f.sections.some(s => matchesSearch(s.name)))
            .map((fam, fi) => (
              <button key={fi} onClick={() => setLevel({ depth: 1, familyIdx: fi })}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#162230] text-left border-b border-[#1e2d3d] last:border-b-0 transition-colors">
                <div className="w-2 h-2 rounded-full bg-[#42d3a5]" />
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-[#8899aa]">{fam.label}</div>
                  <div className="text-[10px] text-[#556677]">{fam.sections.length} sections · {fam.sections.reduce((n, s) => n + s.models.length, 0)} modèles</div>
                </div>
                <ChevronRight size={14} className="text-[#3a4f63]" />
              </button>
            ))}
        </div>
      );
    }

    const family = families[level.familyIdx];
    if (!family) return null;

    // Level 1: sections
    if (level.depth === 1) {
      return (
        <div className="border border-[#1e2d3d] rounded-xl overflow-hidden">
          <button onClick={() => setLevel({ depth: 0 })}
            className="w-full flex items-center gap-2 px-4 py-3 border-b border-[#1e2d3d] hover:bg-[#162230] text-left bg-[#0f1923]">
            <ChevronLeft size={14} className="text-[#556677]" />
            <span className="text-[13px] font-semibold text-[#8899aa]">{family.label}</span>
          </button>
          {family.sections
            .filter(s => matchesSearch(s.name) || s.models.some(m => matchesSearch(m.name)))
            .map((sec, si) => (
              <button key={si} onClick={() => setLevel({ depth: 2, familyIdx: level.familyIdx, sectionIdx: si })}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#162230] text-left border-b border-[#1e2d3d] last:border-b-0 transition-colors">
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-[#8899aa]">{sec.name}</div>
                  <div className="text-[10px] text-[#556677]">{sec.models.length} modèles</div>
                </div>
                <ChevronRight size={14} className="text-[#3a4f63]" />
              </button>
            ))}
        </div>
      );
    }

    // Level 2: models
    const section = family.sections[level.sectionIdx];
    if (!section) return null;

    return (
      <div className="border border-[#1e2d3d] rounded-xl overflow-hidden">
        <button onClick={() => setLevel({ depth: 1, familyIdx: level.familyIdx })}
          className="w-full flex items-center gap-2 px-4 py-3 border-b border-[#1e2d3d] hover:bg-[#162230] text-left bg-[#0f1923]">
          <ChevronLeft size={14} className="text-[#556677]" />
          <span className="text-[13px] font-semibold text-[#8899aa]">{family.label} &gt; {section.name}</span>
        </button>
        {section.models
          .filter(m => matchesSearch(m.name) || (m.aliases || []).some(a => matchesSearch(a)))
          .map((m, mi) => {
            const isSelected = allSelectedIds.has(m.id);
            return (
              <button key={mi}
                onClick={() => { if (!isSelected) addModel(m); }}
                disabled={isSelected}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#1e2d3d] last:border-b-0 transition-colors ${
                  isSelected ? 'bg-emerald-500/10 opacity-60' : 'hover:bg-[#162230]'
                }`}>
                <Sparkles size={14} className={isSelected ? 'text-emerald-500' : 'text-[#42d3a5]'} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[#8899aa]">{m.name}</div>
                  {m.description && <div className="text-[10px] text-[#556677] truncate">{m.description}</div>}
                  <div className="text-[9px] text-[#3a4f63] truncate mt-0.5">
                    {(m.aliases || []).slice(0, 5).join(', ')}{(m.aliases || []).length > 5 ? ` +${m.aliases.length - 5}` : ''}
                  </div>
                </div>
                {m.article_count > 0 && <span className="text-[9px] text-[#556677]">{m.article_count} articles</span>}
                {isSelected && <span className="text-[10px] font-bold text-emerald-600">Ajouté</span>}
              </button>
            );
          })}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#1e2d3d] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            value={feedName}
            onChange={e => setFeedName(e.target.value)}
            placeholder="Nom du feed..."
            className="text-sm font-bold text-[#b0bec9] bg-transparent border-b border-[#1e2d3d] focus:border-[#42d3a5] focus:outline-none px-0 py-1 w-64"
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-[12px] font-medium text-[#6b7d93] hover:text-[#8899aa]">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving || modelLayers.length === 0}
            className="px-4 py-1.5 text-[12px] font-semibold text-white rounded-lg bg-[#42d3a5] hover:bg-[#38b891] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Création...' : 'Créer le Feed'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Taxonomy browser */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#556677]" size={13} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une famille, section ou modèle..."
              className="w-full pl-9 pr-4 py-2 text-[12px] border border-[#1e2d3d] rounded-xl focus:outline-none focus:border-[#42d3a5] bg-[#1a2836]"
            />
          </div>

          {/* Fuzzy search results */}
          {search.length >= 2 && (fuzzySearching || fuzzyResults.length > 0) && (
            <div className="border border-[#42d3a5]/30 rounded-xl overflow-hidden bg-emerald-500/5">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[#42d3a5] uppercase tracking-wider border-b border-[#42d3a5]/10">
                Recherche fuzzy
              </div>
              {fuzzySearching && (
                <div className="flex items-center gap-2 px-4 py-3 justify-center">
                  <Loader2 size={12} className="animate-spin text-[#42d3a5]" />
                  <span className="text-[11px] text-[#556677]">Recherche...</span>
                </div>
              )}
              {fuzzyResults.map(r => {
                const isSelected = allSelectedIds.has(r.model_id);
                return (
                  <button key={r.model_id}
                    onClick={() => { if (!isSelected) addModel({ id: r.model_id, name: r.model_name, aliases: [], description: null, article_count: 0 }); }}
                    disabled={isSelected}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-[#1e2d3d] last:border-b-0 ${isSelected ? 'opacity-40' : 'hover:bg-[#1a2836]'}`}>
                    <Sparkles size={12} className="text-[#42d3a5]" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-medium text-[#8899aa]">{r.model_name}</span>
                      <span className="text-[9px] text-[#556677] ml-1.5">{r.family}/{r.section}</span>
                    </div>
                    {isSelected && <span className="text-[9px] font-bold text-emerald-600">Ajout</span>}
                  </button>
                );
              })}
              {!fuzzySearching && fuzzyResults.length === 0 && (
                <div className="px-4 py-2.5 text-[11px] text-[#556677]">Aucun resultat</div>
              )}
            </div>
          )}

          {renderBrowser()}
        </div>

        {/* Right: Current filters */}
        <div className="w-80 shrink-0 border-l border-[#1e2d3d]/60 bg-[#1a2836] p-4 overflow-y-auto">
          <h3 className="text-[12px] font-bold text-[#b0bec9] mb-3">Filtres sélectionnés</h3>
          {modelLayers.length === 0 ? (
            <p className="text-[11px] text-[#556677]">Parcourez la taxonomie et cliquez sur un modèle pour l'ajouter comme filtre.</p>
          ) : (
            <ModelQueryBuilder layers={modelLayers} onChange={setModelLayers} />
          )}
        </div>
      </div>
    </div>
  );
}
