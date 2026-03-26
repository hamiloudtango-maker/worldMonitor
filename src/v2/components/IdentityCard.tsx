import { Building, MapPin, Briefcase, Globe, Calendar, Users, Link as LinkIcon } from 'lucide-react';
import { FLAGS } from '@/v2/lib/constants';

interface Props {
  card: Record<string, any> | null;
  caseName: string;
}

export default function IdentityCard({ card, caseName }: Props) {
  if (!card) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/60 p-5 flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">Fiche d'identité en cours de génération...</p>
      </div>
    );
  }

  const fields: { icon: typeof Building; label: string; value: string | undefined }[] = [
    { icon: MapPin, label: 'Siège', value: card.headquarters },
    { icon: Briefcase, label: 'Secteur', value: card.sector },
    { icon: Globe, label: 'Pays', value: card.country_code ? `${FLAGS[card.country_code] || ''} ${card.country_code}` : undefined },
    { icon: Calendar, label: 'Fondé', value: card.founded },
    { icon: LinkIcon, label: 'Site web', value: card.website },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#42d3a5]/10 flex items-center justify-center text-[#42d3a5] shrink-0">
          <Building size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 text-sm truncate">{card.name || caseName}</h3>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Fiche d'identité</p>
        </div>
      </div>

      {/* Description */}
      {card.description && (
        <p className="text-[12px] text-slate-600 leading-relaxed mb-3">{card.description}</p>
      )}

      {/* Fields */}
      <div className="space-y-2 flex-1">
        {fields.map(f => f.value ? (
          <div key={f.label} className="flex items-center gap-2">
            <f.icon size={13} className="text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500 w-12 shrink-0">{f.label}</span>
            <span className="text-[11px] font-medium text-slate-700 truncate">
              {f.label === 'Site web' ? (
                <a href={f.value.startsWith('http') ? f.value : `https://${f.value}`} target="_blank" rel="noopener noreferrer" className="text-[#42d3a5] hover:underline">{f.value}</a>
              ) : f.value}
            </span>
          </div>
        ) : null)}
      </div>

      {/* Key people */}
      {card.key_people && card.key_people.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users size={12} className="text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Personnes clés</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {card.key_people.map((p: any, i: number) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{typeof p === 'string' ? p : p.name || String(p)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
