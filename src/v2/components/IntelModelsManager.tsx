/**
 * IntelModelsManager — 3-level tree: Family → Section → Models.
 * Each level: expandable, editable, with IA alias enrichment button.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Search, Trash2, Save, Pencil, Loader2, Sparkles,
  ChevronDown, ChevronRight, X, Plus, FolderOpen, Layers
} from 'lucide-react';
import { api } from '@/v2/lib/api';

interface Model {
  id: string; name: string; family: string; section: string;
  aliases: string[]; article_count: number; origin: string;
}
interface FamilyMeta { label: string; aliases: string[] }
interface SectionMeta { aliases: string[] }

interface Draft { name: string; aliases: string; family: string; section: string }
const EMPTY_DRAFT: Draft = { name: '', aliases: '', family: 'market', section: '' };
const ACCENT = '#42d3a5';
const FAMILY_LABELS: Record<string, string> = {
  market: 'Market Intelligence', threat: 'Threat Intelligence', risk: 'Risk Intelligence',
  foundation: 'Foundation', biopharma: 'Biopharma Research', geopolitical: 'Geopolitical', mute: 'Mute Filters',
};

export default function IntelModelsManager() {
  const [models, setModels] = useState<Model[]>([]);
  const [famMeta, setFamMeta] = useState<Record<string, FamilyMeta>>({});
  const [secMeta, setSecMeta] = useState<Record<string, SectionMeta>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  // Category editing (L1/L2): key being edited, e.g. "fam:market" or "sec:market:Technologies"
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [catDraft, setCatDraft] = useState<{ label: string; aliases: string }>({ label: '', aliases: '' });

  async function load() {
    setLoading(true);
    try {
      // Use tree endpoint which returns aliases at all levels
      const res = await api<{ families: any[] }>('/ai-feeds/intel-models/tree');
      const all: Model[] = [];
      const fm: Record<string, FamilyMeta> = {};
      const sm: Record<string, SectionMeta> = {};
      for (const fam of res.families) {
        fm[fam.key] = { label: fam.label, aliases: fam.aliases || [] };
        for (const sec of fam.sections) {
          sm[`${fam.key}:${sec.name}`] = { aliases: sec.aliases || [] };
          for (const m of sec.models) {
            all.push({ ...m, family: fam.key, section: sec.name, origin: m.origin || 'seed' });
          }
        }
      }
      setModels(all);
      setFamMeta(fm);
      setSecMeta(sm);
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return models;
    const q = search.toLowerCase();
    return models.filter(m =>
      m.name.toLowerCase().includes(q) || m.aliases.some(a => a.toLowerCase().includes(q)) ||
      m.section.toLowerCase().includes(q) || m.family.toLowerCase().includes(q)
    );
  }, [models, search]);

  const tree = useMemo(() => {
    const fams = new Map<string, Map<string, Model[]>>();
    for (const m of filtered) {
      if (!fams.has(m.family)) fams.set(m.family, new Map());
      const secs = fams.get(m.family)!;
      if (!secs.has(m.section)) secs.set(m.section, []);
      secs.get(m.section)!.push(m);
    }
    return fams;
  }, [filtered]);

  // ── CRUD ──
  function startEdit(m: Model) { setEditing(m.id); setDraft({ name: m.name, aliases: m.aliases.join(', '), family: m.family, section: m.section }); }
  function startCreate(family: string, section: string) { setEditing('__new__'); setDraft({ ...EMPTY_DRAFT, family, section }); }
  function cancelEdit() { setEditing(null); }

  async function saveEdit() {
    if (!editing || !draft.name.trim()) return;
    setSaving(true);
    const aliases = draft.aliases.split(',').map(a => a.trim()).filter(a => a.length >= 2);
    try {
      if (editing === '__new__') {
        await api('/ai-feeds/intel-models/resolve', { method: 'POST', body: JSON.stringify({ term: draft.name, family: draft.family, section: draft.section || 'Custom', aliases }) });
      } else {
        await api(`/ai-feeds/intel-models/${editing}`, { method: 'PUT', body: JSON.stringify({ name: draft.name, aliases, family: draft.family, section: draft.section }) });
      }
      cancelEdit(); await load();
    } catch { /* silent */ }
    setSaving(false);
  }

  async function deleteModel(id: string) {
    try { await api(`/ai-feeds/intel-models/${id}`, { method: 'DELETE' }); setModels(prev => prev.filter(m => m.id !== id)); if (editing === id) cancelEdit(); } catch {}
  }

  async function enrichAliases(level: 'family' | 'section' | 'model', id: string, familyKey: string, sectionName?: string) {
    const key = `${level}:${id}`;
    setEnriching(key);
    try {
      const res = await api<{ aliases: string[] }>('/ai-feeds/intel-enrich-aliases', {
        method: 'POST', body: JSON.stringify({ level, id, family_key: familyKey, section_name: sectionName || '' }),
      });
      if (editing === id) setDraft(d => ({ ...d, aliases: res.aliases.join(', ') }));
      // Also update catDraft if editing a category
      if (editingCat) setCatDraft(d => ({ ...d, aliases: res.aliases.join(', ') }));
      await load();
    } catch { /* silent */ }
    setEnriching(null);
  }

  function startEditCat(level: 'family' | 'section', key: string, parentKey?: string) {
    const catKey = level === 'family' ? `fam:${key}` : `sec:${parentKey}:${key}`;
    setEditingCat(catKey);
    if (level === 'family') {
      const meta = famMeta[key];
      setCatDraft({ label: meta?.label || key, aliases: (meta?.aliases || []).join(', ') });
    } else {
      const meta = secMeta[`${parentKey}:${key}`];
      setCatDraft({ label: key, aliases: (meta?.aliases || []).join(', ') });
    }
  }

  async function saveCat() {
    if (!editingCat) return;
    setSaving(true);
    const aliases = catDraft.aliases.split(',').map(a => a.trim()).filter(a => a.length >= 2);
    try {
      if (editingCat.startsWith('fam:')) {
        const famKey = editingCat.slice(4);
        await api(`/ai-feeds/intel-categories/family/${encodeURIComponent(famKey)}`, {
          method: 'PUT', body: JSON.stringify({ label: catDraft.label, aliases }),
        });
      } else {
        // sec:famKey:secName
        const parts = editingCat.slice(4).split(':');
        const famKey = parts[0]!;
        const secName = parts.slice(1).join(':');
        await api(`/ai-feeds/intel-categories/section/${encodeURIComponent(secName)}?parent_key=${encodeURIComponent(famKey)}`, {
          method: 'PUT', body: JSON.stringify({ label: catDraft.label, aliases }),
        });
      }
      setEditingCat(null);
      await load();
    } catch { /* silent */ }
    setSaving(false);
  }

  function toggleFamily(f: string) { setExpandedFamilies(prev => { const n = new Set(prev); if (n.has(f)) n.delete(f); else n.add(f); return n; }); }
  function toggleSection(k: string) { setExpandedSections(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; }); }

  function AliasChips({ aliases, max = 8 }: { aliases: string[]; max?: number }) {
    if (!aliases.length) return <span className="text-[9px] text-slate-300 italic">pas d'aliases</span>;
    return (
      <div className="flex flex-wrap gap-1 mt-0.5">
        {aliases.slice(0, max).map(a => <span key={a} className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">{a}</span>)}
        {aliases.length > max && <span className="text-[9px] text-slate-400">+{aliases.length - max}</span>}
      </div>
    );
  }

  /* ── Category edit form (L1/L2) ── */
  function CatEditForm({ level, catKey, familyKey }: { level: 'family' | 'section'; catKey: string; familyKey: string }) {
    const enrichKey = `${level}:${catKey}`;
    return (
      <div className="space-y-2 p-3 bg-amber-50/50 rounded-lg border border-amber-200/50 mx-4 my-1">
        <input value={catDraft.label} onChange={e => setCatDraft(d => ({ ...d, label: e.target.value }))} autoFocus
          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-[12px] font-semibold outline-none focus:border-[#42d3a5]"
          placeholder={level === 'family' ? 'Nom de la famille' : 'Nom de la section'} />
        <input value={catDraft.aliases} onChange={e => setCatDraft(d => ({ ...d, aliases: e.target.value }))}
          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-[#42d3a5]"
          placeholder="Aliases (séparés par virgule)" />
        <div className="flex gap-1.5">
          <button onClick={saveCat} disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded disabled:opacity-50" style={{ background: ACCENT }}>
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Sauver
          </button>
          <button onClick={() => { enrichAliases(level, catKey, familyKey, level === 'section' ? catKey : undefined); }}
            disabled={enriching === enrichKey}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded border border-amber-200 text-amber-600 hover:bg-amber-50 disabled:opacity-50">
            {enriching === enrichKey ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} IA
          </button>
          <button onClick={() => setEditingCat(null)} className="px-3 py-1.5 text-[11px] text-slate-500 border border-slate-200 rounded hover:bg-white">Annuler</button>
        </div>
      </div>
    );
  }

  function DraftForm() {
    return (
      <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-[#42d3a5]/30">
        <div className="flex gap-2">
          <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} autoFocus
            className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded text-[12px] outline-none focus:border-[#42d3a5]" placeholder="Nom" />
          <select value={draft.family} onChange={e => setDraft(d => ({ ...d, family: e.target.value }))}
            className="w-32 px-2 py-1.5 bg-white border border-slate-200 rounded text-[12px] outline-none focus:border-[#42d3a5]">
            {Object.keys(FAMILY_LABELS).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <input value={draft.section} onChange={e => setDraft(d => ({ ...d, section: e.target.value }))}
            className="w-40 px-2 py-1.5 bg-white border border-slate-200 rounded text-[12px] outline-none focus:border-[#42d3a5]" placeholder="Section" />
        </div>
        <input value={draft.aliases} onChange={e => setDraft(d => ({ ...d, aliases: e.target.value }))}
          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-[#42d3a5]" placeholder="Aliases (virgule)" />
        <div className="flex gap-1.5">
          <button onClick={saveEdit} disabled={saving || !draft.name.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded disabled:opacity-50" style={{ background: ACCENT }}>
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} {editing === '__new__' ? 'Créer' : 'Sauver'}
          </button>
          {editing && editing !== '__new__' && (
            <button onClick={() => enrichAliases('model', editing, draft.family, draft.section)}
              disabled={enriching === `model:${editing}`}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded border border-amber-200 text-amber-600 hover:bg-amber-50 disabled:opacity-50">
              {enriching === `model:${editing}` ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} IA
            </button>
          )}
          <button onClick={cancelEdit} className="px-3 py-1.5 text-[11px] text-slate-500 border border-slate-200 rounded hover:bg-white">Annuler</button>
        </div>
      </div>
    );
  }

  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichAllResult, setEnrichAllResult] = useState<string | null>(null);

  async function enrichAll() {
    setEnrichingAll(true);
    setEnrichAllResult(null);
    try {
      const res = await api<{ families: number; sections: number; models: number; errors: number }>(
        '/ai-feeds/intel-enrich-all', { method: 'POST' }
      );
      setEnrichAllResult(
        `${res.families} familles, ${res.sections} sections, ${res.models} modèles enrichis` +
        (res.errors > 0 ? ` (${res.errors} erreurs)` : '')
      );
      await load();
    } catch {
      setEnrichAllResult('Erreur lors de l\'enrichissement');
    }
    setEnrichingAll(false);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[#42d3a5]" />
        </div>
        <button onClick={() => { setEditing('__new__'); setDraft(EMPTY_DRAFT); }} disabled={editing === '__new__'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: ACCENT }}>
          <Plus size={13} /> Nouveau
        </button>
        <button onClick={enrichAll} disabled={enrichingAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50">
          {enrichingAll ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {enrichingAll ? 'Enrichissement IA en cours...' : 'IA : Enrichir tout'}
        </button>
        <span className="text-[11px] text-slate-400">{filtered.length} modèles</span>
      </div>

      {enrichAllResult && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[12px] text-amber-700">
          <Sparkles size={13} /> {enrichAllResult}
          <button onClick={() => setEnrichAllResult(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      {editing === '__new__' && <DraftForm />}
      {loading && <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-slate-400" /></div>}

      {/* Tree */}
      {!loading && (
        <div className="space-y-2">
          {[...tree.entries()].map(([family, sections]) => {
            const famOpen = expandedFamilies.has(family);
            const meta = famMeta[family];
            const famCount = [...sections.values()].reduce((s, m) => s + m.length, 0);
            return (
              <div key={family} className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
                {/* ── LEVEL 1: Family ── */}
                {editingCat === `fam:${family}` ? (
                  <CatEditForm level="family" catKey={family} familyKey={family} />
                ) : (
                <div className="px-4 py-2.5 hover:ring-1 hover:ring-[#42d3a5]/30 transition-all">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFamily(family)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                      {famOpen ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                      <FolderOpen size={15} className="text-[#42d3a5] shrink-0" />
                      <span className="text-[13px] font-bold text-slate-800">{meta?.label || FAMILY_LABELS[family] || family}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{famCount}</span>
                    </button>
                    <button onClick={e => { e.stopPropagation(); enrichAliases('family', family, family); }}
                      disabled={enriching === `family:${family}`}
                      className="p-1 rounded text-slate-300 hover:text-amber-500 transition-colors disabled:opacity-50" title="IA: aliases">
                      {enriching === `family:${family}` ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); startEditCat('family', family); }}
                      className="p-1 rounded text-slate-300 hover:text-[#42d3a5] transition-colors" title="Modifier">
                      <Pencil size={12} />
                    </button>
                  </div>
                  <div className="ml-9 mt-0.5"><AliasChips aliases={meta?.aliases || []} max={12} /></div>
                </div>
                )}

                {/* ── LEVEL 2: Sections ── */}
                {famOpen && (
                  <div className="border-t border-slate-100">
                    {[...sections.entries()].map(([section, sectionModels]) => {
                      const secKey = `${family}:${section}`;
                      const secOpen = expandedSections.has(secKey);
                      const sMeta = secMeta[secKey];
                      return (
                        <div key={secKey}>
                          {editingCat === `sec:${family}:${section}` ? (
                            <CatEditForm level="section" catKey={section} familyKey={family} />
                          ) : (
                          <div className="pl-8 pr-4 py-2 hover:ring-1 hover:ring-[#42d3a5]/30 transition-all border-b border-slate-50">
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleSection(secKey)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                                {secOpen ? <ChevronDown size={13} className="text-slate-400 shrink-0" /> : <ChevronRight size={13} className="text-slate-400 shrink-0" />}
                                <Layers size={13} className="text-slate-400 shrink-0" />
                                <span className="text-[12px] font-semibold text-slate-700">{section}</span>
                                <span className="text-[10px] text-slate-400 shrink-0">({sectionModels.length})</span>
                              </button>
                              <button onClick={e => { e.stopPropagation(); enrichAliases('section', section, family, section); }}
                                disabled={enriching === `section:${section}`}
                                className="p-1 rounded text-slate-300 hover:text-amber-500 transition-colors disabled:opacity-50" title="IA: aliases">
                                {enriching === `section:${section}` ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                              </button>
                              <button onClick={e => { e.stopPropagation(); startEditCat('section', section, family); }}
                                className="p-1 rounded text-slate-300 hover:text-[#42d3a5] transition-colors" title="Modifier">
                                <Pencil size={11} />
                              </button>
                              <button onClick={e => { e.stopPropagation(); startCreate(family, section); }}
                                className="p-1 rounded text-slate-300 hover:text-[#42d3a5] transition-colors" title="Ajouter">
                                <Plus size={11} />
                              </button>
                            </div>
                            <div className="ml-8 mt-0.5"><AliasChips aliases={sMeta?.aliases || []} max={10} /></div>
                          </div>
                          )}

                          {/* ── LEVEL 3: Models ── */}
                          {secOpen && sectionModels.map(m => (
                            <div key={m.id} className="pl-16 pr-4 py-2 border-b border-slate-50 last:border-b-0">
                              {editing === m.id ? <DraftForm /> : (
                                <div className="flex items-start gap-2 group">
                                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEdit(m)}>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[12px] font-medium text-slate-800">{m.name}</span>
                                      <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{m.origin}</span>
                                      {m.article_count > 0 && <span className="text-[9px] text-slate-400">{m.article_count} art.</span>}
                                    </div>
                                    <AliasChips aliases={m.aliases} max={10} />
                                  </div>
                                  <div className="flex gap-0.5 shrink-0 pt-0.5">
                                    <button onClick={() => enrichAliases('model', m.id, family, section)}
                                      disabled={enriching === `model:${m.id}`}
                                      className="p-1 rounded text-slate-300 hover:text-amber-500 transition-colors disabled:opacity-50" title="IA: aliases">
                                      {enriching === `model:${m.id}` ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                    </button>
                                    <button onClick={() => startEdit(m)}
                                      className="p-1 rounded text-slate-300 hover:text-[#42d3a5] transition-colors" title="Modifier">
                                      <Pencil size={11} />
                                    </button>
                                    <button onClick={() => deleteModel(m.id)}
                                      className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Supprimer">
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
