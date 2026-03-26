import { useState } from 'react';
import { X, Building, Users, Flag, Hash, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, type: string) => Promise<void>;
}

const TYPES = [
  { key: 'company',  label: 'Entreprise', desc: 'Surveiller une organisation', Icon: Building },
  { key: 'person',   label: 'Personne',   desc: 'Suivre un individu clé',     Icon: Users },
  { key: 'country',  label: 'Pays',       desc: 'Veille géopolitique',         Icon: Flag },
  { key: 'thematic', label: 'Thématique', desc: 'Sujet transversal',           Icon: Hash },
] as const;

export default function CreateCaseModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('company');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleSubmit() {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onCreate(name.trim(), type);
      setName('');
      setType('company');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">Créer un case</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Name input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom du case</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: TotalEnergies, Emmanuel Macron..."
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-[#42d3a5] focus:ring-2 focus:ring-[#42d3a5]/10 focus:bg-white"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleSubmit(); }}
          />
        </div>

        {/* Type selector — 2x2 grid */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  type === t.key
                    ? 'border-[#42d3a5] bg-[#42d3a5]/5'
                    : 'border-slate-100 hover:border-slate-200 bg-white'
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

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-xl border text-sm bg-red-50 border-red-200 text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md shadow-[#42d3a5]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#42d3a5' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Création...
              </>
            ) : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
