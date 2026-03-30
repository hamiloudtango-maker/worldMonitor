// src/v2/components/ai-feeds/FeedCreator.tsx
import { useState, useRef, useEffect } from 'react';
import { Filter, TrendingUp, Shield, ChevronRight, ChevronLeft, Sparkles, X, Loader2 } from 'lucide-react';
import { TABS } from './feed-templates';
import type { FeedTemplate } from './feed-templates';
import type { FeedQuery } from '@/v2/lib/ai-feeds-api';
import { fetchCategoryTree, fetchLeaves } from '@/v2/lib/ai-feeds-api';
import type { CategoryL1, CategoryL2, CategoryLeaf } from '@/v2/lib/ai-feeds-api';
import TemplateGrid from './TemplateGrid';
import ModelQueryBuilder, { type ModelLayer } from '../shared/ModelQueryBuilder';
import FeedPreview from './FeedPreview';
import SourceSelector from './SourceSelector';

type CreationState =
  | { step: 'browse' }
  | { step: 'refine'; template: FeedTemplate }
  | { step: 'build' };

// Drill-down depth: L1 categories → L2 subcategories → L3 leaves
type DrillLevel =
  | { depth: 0 }                                   // show L1 list
  | { depth: 1; l1: CategoryL1 }                   // show L2 list
  | { depth: 2; l1: CategoryL1; l2: CategoryL2 };  // show L3 leaves

interface Props {
  onSave: (name: string, query: FeedQuery) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export default function FeedCreator({ onSave, onCancel, saving }: Props) {
  const [activeTab, setActiveTab] = useState(TABS[0]!.id);
  const [state, setState] = useState<CreationState>({ step: 'browse' });
  const [searchValue, setSearchValue] = useState('');
  const [query, setQuery] = useState<FeedQuery>({ layers: [] });
  const [feedName, setFeedName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Batch category tree
  const [tree, setTree] = useState<CategoryL1[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeCache, setTreeCache] = useState<Record<string, CategoryL1[]>>({});
  const [drill, setDrill] = useState<DrillLevel>({ depth: 0 });
  // L3 leaves (AI-generated on demand)
  const [leaves, setLeaves] = useState<CategoryLeaf[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesCache, setLeavesCache] = useState<Record<string, CategoryLeaf[]>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const tab = TABS.find(t => t.id === activeTab) || TABS[0]!;

  // Load category tree when tab changes
  useEffect(() => {
    if (treeCache[activeTab]) {
      setTree(treeCache[activeTab]);
      return;
    }
    setTreeLoading(true);
    fetchCategoryTree(activeTab)
      .then(res => {
        const cats = res.categories || [];
        setTree(cats);
        setTreeCache(prev => ({ ...prev, [activeTab]: cats }));
      })
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false));
  }, [activeTab]);

  // Close dropdown on outside click — keep drill-down state so user can resume
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        // Don't reset drill — user can reopen and continue where they left off
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleTemplateSelect(template: FeedTemplate) {
    setFeedName(template.name);
    setState({ step: 'refine', template });
    // Fetch intel model by exact name to get aliases
    import('@/v2/lib/ai-feeds-api').then(({ fetchIntelTree }) =>
      fetchIntelTree().then(({ families }) => {
        // Find model matching chip1 label exactly
        for (const fam of families) {
          for (const sec of fam.sections) {
            const model = sec.models.find(m => m.name === template.chip1.label);
            if (model) {
              setQuery({
                layers: [
                  { operator: 'OR', parts: [{ type: template.chip1.type, value: model.name, aliases: model.aliases, scope: 'title_and_content' }] },
                ],
                model_layers: [{ operator: 'OR', model_ids: [model.id] }],
              });
              return;
            }
          }
        }
        // Not found in DB — add without aliases
        setQuery({
          layers: [
            { operator: 'OR', parts: [{ type: template.chip1.type, value: template.chip1.label, scope: 'title_and_content' }] },
          ],
        });
      })
    ).catch(() => {
      setQuery({
        layers: [
          { operator: 'OR', parts: [{ type: template.chip1.type, value: template.chip1.label, scope: 'title_and_content' }] },
        ],
      });
    });
  }

  function handleSearchSubmit() {
    if (!searchValue.trim()) return;
    setQuery({
      layers: [
        { operator: 'OR', parts: [{ type: 'keyword', value: searchValue.trim(), scope: 'title_and_content' }] },
      ],
    });
    setFeedName(searchValue.trim());
    setState({ step: 'build' });
    setSearchValue('');
  }

  function handleSelectLeaf(leaf: CategoryLeaf) {
    const allKeywords = [...leaf.keywords_strong, ...leaf.keywords_weak];
    setQuery(prev => ({
      layers: [
        ...prev.layers,
        { operator: 'OR', parts: [{ type: 'entity', value: leaf.label, aliases: allKeywords, scope: 'title_and_content' }] },
      ],
    }));
    // Auto-name feed from last filter selected
    setFeedName(leaf.label);
    setShowDropdown(false);
    setDrill({ depth: 0 });
    setState({ step: 'build' });
  }

  async function handleRefineSkip() {
    // If query is empty or too thin (single keyword, no aliases), auto-bootstrap via LLM
    const isThin = query.layers.length === 0 ||
      (query.layers.length === 1 && query.layers[0].parts.length <= 2 &&
       query.layers[0].parts.every(p => !p.aliases || p.aliases.length === 0));

    if (isThin && state.step === 'refine' && 'template' in state) {
      const { bootstrapFeed } = await import('@/v2/lib/ai-feeds-api');
      const name = feedName || state.template.name;
      setBootstrapping(true);
      try {
        const result = await bootstrapFeed(name, state.template.description || name);
        if (result.query && result.query.layers.length > 0) {
          setQuery(result.query);
        }
        if (!feedName && result.name) setFeedName(result.name);
      } catch { /* silent */ }
      setBootstrapping(false);
    }
    setState({ step: 'build' });
  }

  function handleClear() {
    setState({ step: 'browse' });
    setQuery({ layers: [] });
    setFeedName('');
    setSearchValue('');
    setDrill({ depth: 0 });
  }

  async function handleSave() {
    const name = feedName || `Feed ${new Date().toLocaleDateString('fr-FR')}`;
    await onSave(name, query);
  }

  // ── Tabs bar ──
  const tabsBar = (
    <div className="flex items-center gap-4 mb-5 border-b border-slate-100 pb-3">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => { setActiveTab(t.id); setDrill({ depth: 0 }); }}
          className={`flex items-center gap-1.5 text-[12px] font-medium transition-colors pb-1 ${
            activeTab === t.id
              ? 'text-slate-900 border-b-2 border-[#42d3a5]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {t.icon === 'strategy' ? <TrendingUp size={14} /> : <Shield size={14} />}
          {t.label}
        </button>
      ))}
    </div>
  );

  // ── Shared dropdown (3-level tree navigation) ──
  const categoryDropdown = (
    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
      {treeLoading ? (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 size={14} className="animate-spin text-[#42d3a5]" />
          <span className="text-[11px] text-slate-400">L'IA génère les catégories...</span>
        </div>
      ) : tree.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-slate-400">Aucune catégorie disponible</div>
      ) : drill.depth === 0 ? (
        // ── Level 1: top categories ──
        <>
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Catégories</div>
          {tree
            .filter(c => !searchValue || c.label.toLowerCase().includes(searchValue.toLowerCase()))
            .map((l1, i) => (
              <button
                key={i}
                onClick={() => setDrill({ depth: 1, l1 })}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
              >
                <Filter size={13} className="text-[#42d3a5] shrink-0" />
                <span className="text-[12px] font-medium text-slate-700 flex-1">{l1.label}</span>
                <span className="text-[9px] text-slate-400">{l1.children.length}</span>
                <ChevronRight size={13} className="text-slate-300" />
              </button>
            ))}
        </>
      ) : drill.depth === 1 ? (
        // ── Level 2: subcategories ──
        <>
          <button
            onClick={() => setDrill({ depth: 0 })}
            className="w-full flex items-center gap-2 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 text-left sticky top-0 bg-white"
          >
            <ChevronLeft size={13} className="text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-600">{drill.l1.label}</span>
          </button>
          {drill.l1.children
            .filter(c => !searchValue || c.label.toLowerCase().includes(searchValue.toLowerCase()))
            .map((l2, i) => (
              <button
                key={i}
                onClick={() => {
                  setDrill({ depth: 2, l1: drill.l1, l2 });
                  // Load L3 leaves on demand
                  const cacheKey = `${activeTab}:${drill.l1.label}:${l2.label}`;
                  if (leavesCache[cacheKey]) {
                    setLeaves(leavesCache[cacheKey]);
                  } else {
                    setLeavesLoading(true);
                    setLeaves([]);
                    fetchLeaves({ tab: activeTab, l1: drill.l1.label, l2: l2.label, l2_keywords_strong: l2.keywords_strong })
                      .then(res => {
                        const items = res.children || [];
                        setLeaves(items);
                        setLeavesCache(prev => ({ ...prev, [cacheKey]: items }));
                      })
                      .catch(() => setLeaves([]))
                      .finally(() => setLeavesLoading(false));
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
              >
                <Filter size={13} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-slate-700">{l2.label}</div>
                  {l2.description && <div className="text-[10px] text-slate-400 truncate">{l2.description}</div>}
                </div>
                <span className="text-[9px] text-slate-400">{l2.children.length}</span>
                <ChevronRight size={13} className="text-slate-300" />
              </button>
            ))}
        </>
      ) : (
        // ── Level 3: leaves with keywords ──
        <>
          <button
            onClick={() => { setDrill({ depth: 1, l1: drill.l1 }); setLeaves([]); }}
            className="w-full flex items-center gap-2 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 text-left sticky top-0 bg-white"
          >
            <ChevronLeft size={13} className="text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-600 truncate">{drill.l1.label} › {drill.l2.label}</span>
          </button>
          {leavesLoading ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 size={14} className="animate-spin text-[#42d3a5]" />
              <span className="text-[11px] text-slate-400">L'IA génère les items...</span>
            </div>
          ) : leaves.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-slate-400">Aucun item généré</div>
          ) : (
            leaves
              .filter(c => !searchValue || c.label.toLowerCase().includes(searchValue.toLowerCase()))
              .map((leaf, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectLeaf(leaf)}
                  className="w-full flex items-start gap-3 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
                >
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
              ))
          )}
        </>
      )}
    </div>
  );

  // ── STEP: Browse ──
  if (state.step === 'browse') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h1 className="text-base font-bold text-slate-900">AI Feed</h1>
          <button onClick={onCancel} className="text-[12px] font-medium text-slate-400 hover:text-slate-600">Annuler</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
          <h1 className="text-lg font-semibold text-slate-700 italic mb-4">Collecter articles et rapports</h1>
          {tabsBar}

          <h2 className="text-sm font-semibold text-slate-600 mb-2">Filtres</h2>
          <div className="relative mb-6">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
              placeholder={tab.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#42d3a5] bg-white"
            />
          </div>

          <TemplateGrid templates={tab.templates} onSelect={handleTemplateSelect} />
        </div>
      </div>
    );
  }

  // ── STEP: Refine — 3-level Intel Models drill-down ──
  if (state.step === 'refine') {
    const template = state.template;

    function addModel(m: { id: string; name: string; aliases: string[] }) {
      const newPart = { type: 'entity' as const, value: m.name, aliases: m.aliases, scope: 'title_and_content' as const };
      if (query.layers.length === 0) {
        setQuery({ layers: [{ operator: 'OR', parts: [newPart] }], model_layers: [{ operator: 'OR', model_ids: [m.id] }] });
      } else {
        setQuery({
          layers: [...query.layers, { operator: 'AND', parts: [newPart] }],
          model_layers: [...(query.model_layers || []), { operator: 'AND', model_ids: [m.id] }],
        });
      }
    }

    function removeChip(li: number, pi: number) {
      const parts = query.layers[li].parts.filter((_, i) => i !== pi);
      if (parts.length === 0) {
        setQuery({ layers: query.layers.filter((_, i) => i !== li), model_layers: (query.model_layers || []).filter((_, i) => i !== li) });
      } else {
        const updated = [...query.layers]; updated[li] = { ...query.layers[li], parts }; setQuery({ ...query, layers: updated });
      }
    }

    const selectedValues = new Set(query.layers.flatMap(l => l.parts.map(p => p.value)));

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h1 className="text-base font-bold text-slate-900">AI Feed — {template.name}</h1>
          <button onClick={onCancel} className="text-[12px] font-medium text-slate-400 hover:text-slate-600">Annuler</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">

          {/* Current chips */}
          {query.layers.some(l => l.parts.length > 0) && (
            <div className="mb-4">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Filtres selectionnes</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {query.layers.flatMap((l, li) => l.parts.map((p, pi) => (
                  <div key={`${li}-${pi}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg">
                    <Filter size={11} className="text-[#42d3a5]" />
                    <span className="text-[12px] font-medium text-white">{p.value}</span>
                    {(p.aliases?.length || 0) > 0 && (
                      <span className="text-[9px] font-bold text-blue-400 bg-blue-900/30 px-1 py-0.5 rounded">+{p.aliases!.length}</span>
                    )}
                    <button onClick={() => removeChip(li, pi)} className="p-0.5 text-slate-400 hover:text-white"><X size={12} /></button>
                  </div>
                )))}
              </div>
            </div>
          )}

          {/* Search bar + resolve */}
          <div className="mb-4">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && searchValue.trim()) {
                    const { resolveIntelModel } = await import('@/v2/lib/ai-feeds-api');
                    const { model } = await resolveIntelModel(searchValue.trim());
                    addModel({ id: model.id, name: model.name, aliases: model.aliases });
                    setSearchValue('');
                  }
                }}
                placeholder="Tapez un terme et Entree (ex: OPEC, ransomware, Tesla...)"
                className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#42d3a5] bg-white"
              />
            </div>
          </div>

          {/* 3-level drill-down from Intel Models */}
          <IntelModelBrowser onSelect={addModel} selectedValues={selectedValues} />

          {/* Actions */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setState({ step: 'build' })}
              className="px-4 py-2 text-[12px] font-semibold text-white rounded-lg bg-[#42d3a5] hover:bg-[#38b891] transition-colors"
            >
              {query.layers.length > 0 ? 'Continuer' : 'Passer'}
            </button>
            <button onClick={handleClear} className="text-[12px] font-medium text-slate-500 hover:text-slate-700">Effacer</button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: Build ──
  const modelLayers: ModelLayer[] = (query.model_layers || []).map(l => ({
    operator: l.operator as ModelLayer['operator'],
    model_ids: l.model_ids || [],
  }));

  function handleModelLayersChange(layers: ModelLayer[]) {
    setQuery(prev => ({ ...prev, model_layers: layers }));
  }

  const hasFilters = modelLayers.length > 0 || query.layers.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h1 className="text-base font-bold text-slate-900">AI Feed — {feedName || 'Nouveau'}</h1>
        <div className="flex items-center gap-3">
          <button onClick={handleClear} className="text-[12px] font-medium text-slate-500 hover:text-slate-700">Effacer</button>
          <button
            onClick={handleSave}
            disabled={saving || !hasFilters}
            className="px-4 py-1.5 text-[12px] font-semibold text-white rounded-lg bg-[#42d3a5] hover:bg-[#38b891] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Création...' : 'Créer le Feed'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <ModelQueryBuilder layers={modelLayers} onChange={handleModelLayersChange} />
        </div>

        <div className="w-72 shrink-0 border-l border-slate-200/60 bg-white">
          <SourceSelector feedId={null} />
        </div>
      </div>
    </div>
  );
}


/* ═══ Intel Model Browser — 3-level drill-down ═══ */
function IntelModelBrowser({ onSelect, selectedValues }: {
  onSelect: (m: { id: string; name: string; aliases: string[] }) => void;
  selectedValues: Set<string>;
}) {
  const [families, setFamilies] = useState<import('@/v2/lib/ai-feeds-api').IntelFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<
    | { depth: 0 }
    | { depth: 1; familyIdx: number }
    | { depth: 2; familyIdx: number; sectionIdx: number }
  >({ depth: 0 });

  useEffect(() => {
    import('@/v2/lib/ai-feeds-api').then(({ fetchIntelTree }) =>
      fetchIntelTree().then(d => { setFamilies(d.families); setLoading(false); })
    ).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 size={14} className="animate-spin text-[#42d3a5]" />
        <span className="text-[11px] text-slate-400">Chargement des modeles...</span>
      </div>
    );
  }

  // Level 0: families
  if (level.depth === 0) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {families.map((fam, fi) => (
          <button key={fi} onClick={() => setLevel({ depth: 1, familyIdx: fi })}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-100 last:border-b-0 transition-colors">
            <Filter size={14} className="text-[#42d3a5]" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-slate-700">{fam.label}</div>
              <div className="text-[10px] text-slate-400">{fam.sections.length} categories</div>
            </div>
            <ChevronRight size={14} className="text-slate-300" />
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
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button onClick={() => setLevel({ depth: 0 })}
          className="w-full flex items-center gap-2 px-4 py-3 border-b border-slate-200 hover:bg-slate-50 text-left bg-slate-50">
          <ChevronLeft size={14} className="text-slate-400" />
          <span className="text-[13px] font-semibold text-slate-600">{family.label}</span>
        </button>
        {family.sections.map((sec, si) => (
          <button key={si} onClick={() => setLevel({ depth: 2, familyIdx: level.familyIdx, sectionIdx: si })}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-100 last:border-b-0 transition-colors">
            <Filter size={14} className="text-slate-400" />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-slate-700">{sec.name}</div>
              <div className="text-[10px] text-slate-400">{sec.models.length} modeles</div>
            </div>
            <ChevronRight size={14} className="text-slate-300" />
          </button>
        ))}
      </div>
    );
  }

  // Level 2: models
  const section = family.sections[level.sectionIdx];
  if (!section) return null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setLevel({ depth: 1, familyIdx: level.familyIdx })}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-slate-200 hover:bg-slate-50 text-left bg-slate-50">
        <ChevronLeft size={14} className="text-slate-400" />
        <span className="text-[13px] font-semibold text-slate-600">{family.label} &gt; {section.name}</span>
      </button>
      {section.models.map((m, mi) => {
        const isSelected = selectedValues.has(m.name);
        return (
          <button key={mi}
            disabled={isSelected}
            onClick={() => { if (!isSelected) onSelect({ id: m.id, name: m.name, aliases: m.aliases }); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-b-0 transition-colors ${
              isSelected ? 'bg-emerald-50 opacity-60' : 'hover:bg-slate-50'
            }`}>
            <Sparkles size={14} className={isSelected ? 'text-emerald-500' : 'text-[#42d3a5]'} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-slate-700">{m.name}</div>
              {m.description && <div className="text-[10px] text-slate-400 truncate">{m.description}</div>}
              <div className="text-[9px] text-slate-300 truncate mt-0.5">{m.aliases.slice(0, 5).join(', ')}{m.aliases.length > 5 ? ` +${m.aliases.length - 5}` : ''}</div>
            </div>
            {m.article_count > 0 && <span className="text-[9px] text-slate-400">{m.article_count} articles</span>}
            {isSelected && <span className="text-[10px] font-bold text-emerald-600">Ajoute</span>}
          </button>
        );
      })}
    </div>
  );
}
