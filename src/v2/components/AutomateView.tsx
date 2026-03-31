// src/v2/components/AutomateView.tsx
// Inoreader-style Automate section: Rules, Filters, Spotlights, Digests, OPML, Reports
import { useState } from 'react';
import { Zap, Filter, Sparkles, Mail, FileText, Rss, Plus, ChevronRight, Eye } from 'lucide-react';

const SECTIONS = [
  {
    id: 'rules',
    icon: Zap,
    color: '#4d8cf5',
    title: 'Rules',
    desc: 'Assigner des tags automatiquement, sauvegarder, envoyer des notifications push, et plus.',
  },
  {
    id: 'filters',
    icon: Filter,
    color: '#f97316',
    title: 'Filtres',
    desc: 'Supprimer les doublons ou filtrer les articles selon des conditions spécifiques.',
  },
  {
    id: 'spotlights',
    icon: Sparkles,
    color: '#8b5cf6',
    title: 'Spotlights',
    desc: 'Colorier automatiquement les mots-clés importants dans les articles pour une lecture rapide.',
  },
  {
    id: 'digests',
    icon: Mail,
    color: '#42d3a5',
    title: 'Email Digests',
    desc: 'Créer des digests personnalisés à partir de vos feeds, dossiers et articles sauvegardés.',
  },
  {
    id: 'opml',
    icon: Rss,
    color: '#f59e0b',
    title: 'Abonnements OPML',
    desc: 'Suivre une liste de feeds publiée sous forme de fichier OPML.',
  },
  {
    id: 'reports',
    icon: FileText,
    color: '#ec4899',
    title: 'Rapports automatisés',
    desc: 'Recevoir des rapports quotidiens ou hebdomadaires à partir du contenu sélectionné.',
  },
];

export default function AutomateView() {
  const [activeSection, setActiveSection] = useState('rules');

  return (
    <div className="flex h-full -m-5 overflow-hidden" style={{ background: '#131d2a' }}>
      {/* Left sidebar */}
      <div className="w-72 shrink-0 overflow-y-auto py-4 px-3" style={{ borderRight: '1px solid #1e2d3d', background: '#0f1923' }}>
        <h3 className="text-[13px] font-bold mb-4 px-2" style={{ color: '#b0bec9' }}>Automate</h3>
        <div className="space-y-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className="w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors"
              style={{
                background: activeSection === s.id ? '#1a2836' : 'transparent',
                border: activeSection === s.id ? '1px solid #1e2d3d' : '1px solid transparent',
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${s.color}15` }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold" style={{ color: activeSection === s.id ? '#b0bec9' : '#8899aa' }}>{s.title}</div>
                <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: '#556677' }}>{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeSection === 'rules' && <RulesSection />}
        {activeSection === 'filters' && <FiltersSection />}
        {activeSection === 'spotlights' && <SpotlightsSection />}
        {activeSection === 'digests' && <DigestsSection />}
        {activeSection === 'opml' && <OpmlSection />}
        {activeSection === 'reports' && <ReportsSection />}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, color, title, desc }: { icon: typeof Zap; color: string; title: string; desc: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={20} style={{ color }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: '#b0bec9' }}>{title}</h2>
      </div>
      <p className="text-[13px]" style={{ color: '#6b7d93' }}>{desc}</p>
    </div>
  );
}

function EmptyState({ text, buttonLabel, onAction }: { text: string; buttonLabel: string; onAction?: () => void }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: '#1a2836', border: '1px solid #1e2d3d' }}>
      <p className="text-[13px] mb-4" style={{ color: '#6b7d93' }}>{text}</p>
      <button
        onClick={onAction}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition-colors"
        style={{ background: '#4d8cf5' }}
      >
        <Plus size={14} /> {buttonLabel}
      </button>
    </div>
  );
}

function RulesSection() {
  return (
    <>
      <SectionHeader icon={Zap} color="#4d8cf5" title="Rules" desc="Exécuter des actions automatiques sur les articles entrants. Assigner des tags, notifier, envoyer des webhooks." />
      <EmptyState text="Aucune rule configurée. Créez votre première rule d'automatisation." buttonLabel="Créer une rule" />
      <div className="mt-6 space-y-3">
        <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: '#556677' }}>Templates</h3>
        {[
          { name: 'Alerte menace critique', desc: 'Notifier quand un article a un threat_level critical' },
          { name: 'Veille pays', desc: 'Tagger les articles mentionnant des pays spécifiques' },
          { name: 'Breaking news', desc: 'Notifier sur les articles breaking avec menace high+' },
          { name: 'Filtre bruit', desc: 'Supprimer les articles info/low d\'opinion' },
        ].map((t, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors" style={{ background: '#1a2836', border: '1px solid #1e2d3d' }}>
            <Zap size={14} style={{ color: '#4d8cf5' }} />
            <div className="flex-1">
              <div className="text-[12px] font-semibold" style={{ color: '#b0bec9' }}>{t.name}</div>
              <div className="text-[10px]" style={{ color: '#556677' }}>{t.desc}</div>
            </div>
            <ChevronRight size={14} style={{ color: '#556677' }} />
          </div>
        ))}
      </div>
    </>
  );
}

function FiltersSection() {
  return (
    <>
      <SectionHeader icon={Filter} color="#f97316" title="Filtres" desc="Supprimer les doublons sémantiques ou filtrer les articles selon des conditions." />
      <EmptyState text="Aucun filtre configuré." buttonLabel="Créer un filtre" />
    </>
  );
}

function SpotlightsSection() {
  return (
    <>
      <SectionHeader icon={Sparkles} color="#8b5cf6" title="Spotlights" desc="Colorier automatiquement des mots-clés dans les articles pour accélérer votre lecture." />
      <EmptyState text="Aucun spotlight configuré." buttonLabel="Créer un spotlight" />
      <div className="mt-6 rounded-xl p-5" style={{ background: '#1a2836', border: '1px solid #1e2d3d' }}>
        <h4 className="text-[12px] font-bold mb-3" style={{ color: '#b0bec9' }}>Exemple</h4>
        <p className="text-[13px] leading-relaxed" style={{ color: '#8899aa' }}>
          Les pays comme la <span className="px-1 rounded" style={{ background: '#4d8cf520', color: '#4d8cf5' }}>France</span> et
          l'<span className="px-1 rounded" style={{ background: '#ef444420', color: '#ef4444' }}>Iran</span> sont au centre des discussions sur
          le <span className="px-1 rounded" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>nucléaire</span> civil.
        </p>
      </div>
    </>
  );
}

function DigestsSection() {
  return (
    <>
      <SectionHeader icon={Mail} color="#42d3a5" title="Email Digests" desc="Créer des digests récurrents avec les articles de vos feeds, dossiers et cases." />
      <EmptyState text="Aucun digest configuré." buttonLabel="Créer un digest" />
    </>
  );
}

function OpmlSection() {
  return (
    <>
      <SectionHeader icon={Rss} color="#f59e0b" title="Abonnements OPML" desc="Importer ou exporter vos sources au format OPML." />
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-5 cursor-pointer transition-colors" style={{ background: '#1a2836', border: '1px solid #1e2d3d' }}>
          <h4 className="text-[13px] font-bold mb-2" style={{ color: '#b0bec9' }}>Importer OPML</h4>
          <p className="text-[11px]" style={{ color: '#6b7d93' }}>Charger un fichier OPML pour importer toutes vos sources d'un coup.</p>
        </div>
        <div className="rounded-xl p-5 cursor-pointer transition-colors" style={{ background: '#1a2836', border: '1px solid #1e2d3d' }}>
          <h4 className="text-[13px] font-bold mb-2" style={{ color: '#b0bec9' }}>Exporter OPML</h4>
          <p className="text-[11px]" style={{ color: '#6b7d93' }}>Télécharger toutes vos sources au format OPML pour backup ou migration.</p>
        </div>
      </div>
    </>
  );
}

function ReportsSection() {
  return (
    <>
      <SectionHeader icon={FileText} color="#ec4899" title="Rapports automatisés" desc="Recevoir des rapports quotidiens ou hebdomadaires générés par IA." />
      <EmptyState text="Aucun rapport automatisé configuré." buttonLabel="Créer un rapport" />
    </>
  );
}
