// src/v2/components/ApiServices.tsx
import { useState, useEffect } from 'react';
import {
  Globe, TrendingUp, AlertTriangle, Ship, Plane, Satellite,
  Users, Radiation, Shield, Cloud, BookOpen, Database,
  CheckCircle, XCircle, MinusCircle, ChevronDown, ChevronRight,
  Loader2, RefreshCw, Trash2, X,
} from 'lucide-react';
import { api } from '@/v2/lib/api';

interface ServiceInfo {
  name: string;
  description: string;
  url: string;
  auth: 'none' | 'key_required' | 'key_optional';
  keyName?: string;
  healthEndpoint?: string;
}

interface ServiceCategory {
  name: string;
  icon: typeof Globe;
  services: ServiceInfo[];
}

const CATEGORIES: ServiceCategory[] = [
  {
    name: 'Actualites & Articles',
    icon: Globe,
    services: [
      { name: 'GDELT', description: 'Index global articles 3 jours, 250 articles/requete', url: 'api.gdeltproject.org', auth: 'none', healthEndpoint: '/conflict/v1/get-humanitarian-summary?country=France' },
      { name: 'Google News RSS', description: 'Recherche dynamique avec fallback GDELT', url: 'news.google.com', auth: 'none' },
      { name: 'Hacker News', description: 'Top stories tech/startup', url: 'hacker-news.firebaseio.com', auth: 'none', healthEndpoint: '/research/v1/list-hackernews-items?feed=top&limit=1' },
      { name: 'arXiv', description: 'Articles scientifiques (IA, physique, bio...)', url: 'export.arxiv.org', auth: 'none', healthEndpoint: '/research/v1/list-arxiv-papers?category=cs.AI&max_results=1' },
    ],
  },
  {
    name: 'Finance & Economie',
    icon: TrendingUp,
    services: [
      { name: 'FRED', description: 'Indicateurs economiques US (Fed Reserve)', url: 'api.stlouisfed.org', auth: 'key_optional', keyName: 'FRED_API_KEY', healthEndpoint: '/economic/v1/get-fred-series?series_id=DGS10' },
      { name: 'World Bank', description: 'Indicateurs economiques par pays', url: 'api.worldbank.org', auth: 'none', healthEndpoint: '/economic/v1/list-world-bank-indicators?indicator=NY.GDP.MKTP.CD&country=FR' },
      { name: 'CoinGecko', description: 'Crypto: prix, volume, market cap', url: 'api.coingecko.com', auth: 'none', healthEndpoint: '/market/v1/list-stablecoin-markets' },
      { name: 'Polymarket', description: 'Marches predictifs geopolitiques', url: 'gamma-api.polymarket.com', auth: 'none', healthEndpoint: '/prediction/v1/list-prediction-markets?limit=1' },
      { name: 'UN Comtrade', description: 'Statistiques commerce international', url: 'comtradeapi.un.org', auth: 'none', healthEndpoint: '/trade/v1/list-comtrade-flows?reporter=250&partner=276&commodity=TOTAL' },
    ],
  },
  {
    name: 'Catastrophes naturelles',
    icon: AlertTriangle,
    services: [
      { name: 'USGS Earthquakes', description: 'Seismes temps reel (M4.5+)', url: 'earthquake.usgs.gov', auth: 'none', healthEndpoint: '/seismology/v1/list-earthquakes' },
      { name: 'NASA EONET', description: 'Evenements naturels (volcans, feux, tempetes)', url: 'eonet.gsfc.nasa.gov', auth: 'none', healthEndpoint: '/natural/v1/list-natural-events?limit=1' },
      { name: 'NASA FIRMS', description: 'Detection incendies satellite VIIRS', url: 'firms.modaps.eosdis.nasa.gov', auth: 'key_optional', keyName: 'NASA_FIRMS_API_KEY', healthEndpoint: '/wildfire/v1/list-fire-detections' },
    ],
  },
  {
    name: 'Maritime & Aviation',
    icon: Ship,
    services: [
      { name: 'NGA Maritime Safety', description: 'Avertissements navigation (US Navy)', url: 'msi.nga.mil', auth: 'none', healthEndpoint: '/maritime/v1/list-navigational-warnings' },
      { name: 'FlightRadar24 RSS', description: 'Actualites aviation', url: 'flightradar24.com', auth: 'none', healthEndpoint: '/aviation/v1/list-aviation-news' },
    ],
  },
  {
    name: 'Imagerie satellite',
    icon: Satellite,
    services: [
      { name: 'Sentinel-2 (Element84)', description: 'Imagerie optique 10m via AWS STAC', url: 'earth-search.aws.element84.com', auth: 'none', healthEndpoint: '/imagery/v1/search-imagery?lat=48.85&lon=2.35&limit=1' },
    ],
  },
  {
    name: 'Humanitaire & Conflits',
    icon: Users,
    services: [
      { name: 'UNHCR', description: 'Statistiques refugies et deplaces', url: 'api.unhcr.org', auth: 'none', healthEndpoint: '/displacement/v1/get-displacement-summary?year=2024&coa=FRA' },
      { name: 'HDX HAPI', description: 'Evenements conflits et victimes', url: 'hapi.humdata.org', auth: 'none', healthEndpoint: '/conflict/v1/get-humanitarian-summary?country=France' },
    ],
  },
  {
    name: 'Radiation',
    icon: Radiation,
    services: [
      { name: 'Safecast', description: 'Mesures radioactivite communautaires', url: 'api.safecast.org', auth: 'none', healthEndpoint: '/radiation/v1/list-radiation-observations?lat=48.85&lon=2.35&distance=100' },
    ],
  },
  {
    name: 'Cybersecurite',
    icon: Shield,
    services: [
      { name: 'Feodo Tracker', description: 'Serveurs C2 botnet (abuse.ch)', url: 'feodotracker.abuse.ch', auth: 'none', healthEndpoint: '/cyber/v1/list-cyber-threats' },
    ],
  },
  {
    name: 'Meteo & Climat',
    icon: Cloud,
    services: [
      { name: 'Open-Meteo', description: 'Previsions meteo villes majeures', url: 'api.open-meteo.com', auth: 'none', healthEndpoint: '/climate/v1/list-climate-anomalies' },
    ],
  },
  {
    name: 'IA & LLM',
    icon: BookOpen,
    services: [
      { name: 'Google Gemini', description: 'Detection/categorisation sources (Vertex AI)', url: 'us-central1-aiplatform.googleapis.com', auth: 'key_required', keyName: 'GCP_PROJECT' },
    ],
  },
];

type ServiceStatus = 'checking' | 'ok' | 'error' | 'no_key' | 'unknown';

const STATUS_ICON: Record<ServiceStatus, typeof CheckCircle> = {
  ok: CheckCircle,
  error: XCircle,
  no_key: MinusCircle,
  checking: Loader2,
  unknown: MinusCircle,
};
const STATUS_COLOR: Record<ServiceStatus, string> = {
  ok: 'text-green-500',
  error: 'text-red-500',
  no_key: 'text-amber-500',
  checking: 'text-slate-400 animate-spin',
  unknown: 'text-slate-300',
};
const STATUS_LABEL: Record<ServiceStatus, string> = {
  ok: 'Connecte',
  error: 'Erreur',
  no_key: 'Cle manquante',
  checking: 'Verification...',
  unknown: 'Non teste',
};

interface CustomSource {
  id: string;
  name: string;
  type: 'api' | 'file' | 'webhook';
  url: string;
  description: string;
  apiKey?: string;
}

const CUSTOM_SOURCES_KEY = 'wm_custom_sources';
function loadCustomSources(): CustomSource[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_SOURCES_KEY) || '[]'); } catch { return []; }
}
function saveCustomSources(sources: CustomSource[]) {
  localStorage.setItem(CUSTOM_SOURCES_KEY, JSON.stringify(sources));
}

export default function ApiServices() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customSources, setCustomSources] = useState<CustomSource[]>(loadCustomSources);

  async function checkService(service: ServiceInfo): Promise<ServiceStatus> {
    if (!service.healthEndpoint) return 'unknown';
    try {
      await api(service.healthEndpoint);
      return 'ok';
    } catch {
      return 'error';
    }
  }

  async function checkAll() {
    setChecking(true);
    const newStatuses: Record<string, ServiceStatus> = {};

    for (const cat of CATEGORIES) {
      for (const svc of cat.services) {
        newStatuses[svc.name] = 'checking';
      }
    }
    setStatuses({ ...newStatuses });

    for (const cat of CATEGORIES) {
      await Promise.all(
        cat.services.map(async (svc) => {
          const st = await checkService(svc);
          setStatuses(prev => ({ ...prev, [svc.name]: st }));
        })
      );
    }
    setChecking(false);
  }

  useEffect(() => { checkAll(); }, []);

  const toggle = (name: string) => setCollapsed(prev => ({ ...prev, [name]: !prev[name] }));

  const totalServices = CATEGORIES.reduce((n, c) => n + c.services.length, 0);
  const okCount = Object.values(statuses).filter(s => s === 'ok').length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-900">APIs & Services externes</h2>
          <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full">
            {okCount}/{totalServices} connectes
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={checkAll}
            disabled={checking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
            Tester tout
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg shadow-sm"
            style={{ background: '#42d3a5' }}
          >
            <Database size={12} />
            + Ajouter
          </button>
        </div>
      </div>

      {/* Categories */}
      {CATEGORIES.map(cat => {
        const Icon = cat.icon;
        const isCollapsed = collapsed[cat.name] ?? false;
        const catOk = cat.services.filter(s => statuses[s.name] === 'ok').length;

        return (
          <div key={cat.name} className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
            <button
              onClick={() => toggle(cat.name)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors"
            >
              {isCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              <Icon size={15} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-700 flex-1 text-left">{cat.name}</span>
              <span className="text-[10px] text-slate-400">{catOk}/{cat.services.length}</span>
            </button>

            {!isCollapsed && (
              <div className="border-t border-slate-100">
                {cat.services.map(svc => {
                  const st = statuses[svc.name] || 'unknown';
                  const StIcon = STATUS_ICON[st];
                  return (
                    <div key={svc.name} className="flex items-center gap-3 px-4 py-2.5 text-xs border-b border-slate-50 last:border-b-0">
                      <StIcon size={14} className={STATUS_COLOR[st]} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800">{svc.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{svc.description}</div>
                      </div>
                      <div className="text-[10px] text-slate-300 font-mono hidden sm:block">{svc.url}</div>
                      <span className={`text-[10px] font-medium ${st === 'ok' ? 'text-green-600' : st === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                        {STATUS_LABEL[st]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Custom Sources */}
      {customSources.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <Database size={15} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-700 flex-1">Sources personnalisees</span>
            <span className="text-[10px] text-slate-400">{customSources.length}</span>
          </div>
          <div className="border-t border-slate-100">
            {customSources.map(src => {
              const typeLabel = src.type === 'api' ? 'API' : src.type === 'file' ? 'Fichier' : 'Webhook';
              const typeBg = src.type === 'api' ? 'bg-blue-50 text-blue-700' : src.type === 'file' ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700';
              return (
                <div key={src.id} className="flex items-center gap-3 px-4 py-2.5 text-xs border-b border-slate-50 last:border-b-0">
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${typeBg}`}>{typeLabel}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800">{src.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{src.description || src.url}</div>
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono hidden sm:block truncate max-w-[200px]">{src.url}</div>
                  <button
                    onClick={() => {
                      const next = customSources.filter(s => s.id !== src.id);
                      setCustomSources(next);
                      saveCustomSources(next);
                    }}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && <AddSourceModal onClose={() => setShowAddModal(false)} onAdd={(src) => {
        const next = [...customSources, src];
        setCustomSources(next);
        saveCustomSources(next);
        setShowAddModal(false);
      }} />}
    </div>
  );
}


function AddSourceModal({ onClose, onAdd }: { onClose: () => void; onAdd: (src: CustomSource) => void }) {
  const [type, setType] = useState<'api' | 'file' | 'webhook'>('api');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [apiKey, setApiKey] = useState('');

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Ajouter une source</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        {/* Type */}
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-1 block">Type</label>
          <div className="flex gap-2">
            {([['api', 'API REST'], ['file', 'Fichier / CSV'], ['webhook', 'Webhook']] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
                  type === k ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-1 block">Nom</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Mon API interne"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {/* URL */}
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-1 block">
            {type === 'file' ? 'Chemin ou URL du fichier' : type === 'webhook' ? 'URL du webhook' : 'URL de base'}
          </label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder={type === 'file' ? '/data/export.csv ou https://...' : 'https://api.example.com/v1'}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono text-xs"
          />
        </div>

        {/* API Key (only for API type) */}
        {type === 'api' && (
          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-1 block">Cle API (optionnel)</label>
            <input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              type="password"
              placeholder="sk-..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono text-xs"
            />
          </div>
        )}

        {/* Description */}
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-1 block">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Que fournit cette source ?"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            Annuler
          </button>
          <button
            onClick={() => {
              if (!name.trim() || !url.trim()) return;
              onAdd({
                id: crypto.randomUUID(),
                name: name.trim(),
                type,
                url: url.trim(),
                description: description.trim(),
                apiKey: apiKey.trim() || undefined,
              });
            }}
            disabled={!name.trim() || !url.trim()}
            className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm disabled:opacity-50"
            style={{ background: '#42d3a5' }}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
