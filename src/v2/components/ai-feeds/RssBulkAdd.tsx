// src/v2/components/ai-feeds/RssBulkAdd.tsx
import { useState } from 'react';
import { Rss, Loader2, ChevronDown, ChevronUp, Check, AlertCircle } from 'lucide-react';
import { bulkAddSources } from '@/v2/lib/ai-feeds-api';

export default function RssBulkAdd() {
  const [expanded, setExpanded] = useState(false);
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ added: number; errors: string[] } | null>(null);

  async function handleSubmit() {
    const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (!urlList.length) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await bulkAddSources(urlList);
      setResult({
        added: res.total_added,
        errors: res.errors.map(e => `${e.url.slice(0, 40)}... — ${e.error}`),
      });
      if (res.total_added > 0) setUrls('');
    } catch {
      setResult({ added: 0, errors: ['Erreur serveur'] });
    }
    setLoading(false);
  }

  return (
    <div className="border-t border-slate-200/60">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50/50 transition-colors"
      >
        <Rss size={13} className="text-[#42d3a5]" />
        <span className="text-[11px] font-semibold text-slate-600 flex-1">Ajouter des sources RSS</span>
        {expanded ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-[9px] text-slate-400">
            Collez une liste d'URLs RSS (une par ligne). L'IA catégorise automatiquement chaque source.
          </p>
          <textarea
            value={urls}
            onChange={e => setUrls(e.target.value)}
            placeholder={"https://example.com/rss\nhttps://news.site/feed.xml\nhttps://blog.com/atom.xml"}
            rows={5}
            className="w-full px-2.5 py-2 text-[10px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#42d3a5] bg-slate-50 resize-none font-mono"
          />
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400">
              {urls.split('\n').filter(u => u.trim().startsWith('http')).length} URLs détectées
            </span>
            <button
              onClick={handleSubmit}
              disabled={loading || !urls.trim()}
              className="px-3 py-1.5 text-[10px] font-semibold text-white rounded-lg bg-[#42d3a5] hover:bg-[#38b891] disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Catégorisation IA...</span>
              ) : (
                'Ajouter au catalogue'
              )}
            </button>
          </div>

          {result && (
            <div className="space-y-1">
              {result.added > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-green-600">
                  <Check size={11} /> {result.added} source(s) ajoutée(s) au catalogue global
                </div>
              )}
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-orange-500">
                  <AlertCircle size={11} /> {err}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
