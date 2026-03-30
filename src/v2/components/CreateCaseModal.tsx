import { useState, useEffect, useRef } from 'react';
import { X, Building, Users, Flag, Hash, Sparkles } from 'lucide-react';
import { api } from '@/v2/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, type: string, description: string) => Promise<void>;
}

const TYPES = [
  { key: 'company',  label: 'Entreprise', desc: 'Surveiller une organisation', Icon: Building },
  { key: 'person',   label: 'Personne',   desc: 'Suivre un individu clé',     Icon: Users },
  { key: 'country',  label: 'Pays',       desc: 'Veille géopolitique',         Icon: Flag },
  { key: 'thematic', label: 'Thématique', desc: 'Sujet transversal',           Icon: Hash },
] as const;

interface Suggestion { model_id: string; model_name: string; family: string; section: string; score: number }

// Map intel model family to case type
const FAMILY_TO_TYPE: Record<string, string> = {
  geo: 'country', politics: 'country', defense: 'country',
  foundation: 'company', economy: 'company', energy: 'company',
  technology: 'thematic', cyber: 'thematic', health: 'thematic',
  environment: 'thematic', society: 'thematic',
};

export default function CreateCaseModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('company');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fuzzy search as user types the name
  useEffect(() => {
    if (!open) return;
    if (name.length < 2) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api<{ results: Suggestion[] }>(`/ai-feeds/intel-models/search?q=${encodeURIComponent(name)}&limit=8`)
        .then(r => setSuggestions(r.results))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [name, open]);

  if (!open) return null;

  function pickSuggestion(s: Suggestion) {
    setName(s.model_name);
    setSuggestions([]);
    // Auto-detect type from model family
    const guessedType = FAMILY_TO_TYPE[s.family] || 'thematic';
    setType(guessedType);
  }

  function handleSubmit() {
    if (!name.trim()) return;
    const n = name.trim(), d = description.trim(), t = type;
    setName('');
    setDescription('');
    setType('company');
    setSuggestions([]);
    onClose();
    onCreate(n, t, d).catch(err => console.error('[CreateCase] failed:', err));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">Créer un case</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Name + fuzzy suggestions */}
        <div className="mb-3 relative">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom du case</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="Ex: TotalEnergies, Mongolie, Cybersecurite..."
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-[#42d3a5] focus:ring-2 focus:ring-[#42d3a5]/10 focus:bg-white"
            autoFocus
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
              {suggestions.map(s => (
                <button key={s.model_id} onClick={() => pickSuggestion(s)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-emerald-50 border-b border-slate-50 last:border-b-0">
                  <Sparkles size={12} className="text-[#42d3a5] shrink-0" />
                  <span className="font-medium text-slate-700">{s.model_name}</span>
                  <span className="text-[9px] text-slate-400">{s.family}/{s.section}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Description <span className="text-slate-400 font-normal">(aide l'IA a comprendre le contexte)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Entreprise francaise du cycle du combustible nucleaire, filiale du CEA..."
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-[#42d3a5] focus:ring-2 focus:ring-[#42d3a5]/10 focus:bg-white resize-none"
          />
        </div>

        {/* Type */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  type === t.key ? 'border-[#42d3a5] bg-[#42d3a5]/5' : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  type === t.key ? 'bg-[#42d3a5]/10 text-[#42d3a5]' : 'bg-slate-100 text-slate-400'
                }`}>
                  <t.Icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${type === t.key ? 'text-[#2a9d7e]' : 'text-slate-700'}`}>{t.label}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md shadow-[#42d3a5]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#42d3a5' }}
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}
