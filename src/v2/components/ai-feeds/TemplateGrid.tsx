// src/v2/components/ai-feeds/TemplateGrid.tsx
import { Sparkles } from 'lucide-react';
import type { FeedTemplate } from './feed-templates';

interface Props {
  templates: FeedTemplate[];
  onSelect: (template: FeedTemplate) => void;
}

export default function TemplateGrid({ templates, onSelect }: Props) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-600 mb-3">Commencer avec un template</h2>
      <div className="grid grid-cols-2 gap-3">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="text-left p-4 rounded-xl border border-slate-200 hover:border-[#42d3a5]/40 hover:shadow-sm transition-all group"
          >
            <div className="text-[13px] font-semibold text-slate-700 mb-3">{t.name}</div>
            <div className="space-y-1.5">
              {/* Chip 1 */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <Sparkles size={12} className="text-[#42d3a5]" />
                <span className="text-[11px] font-medium text-slate-700">{t.chip1.label}</span>
                <span className="text-[8px] font-bold text-[#42d3a5] bg-[#42d3a5]/10 px-1 py-0.5 rounded">AI</span>
              </div>
              {/* AND separator */}
              <div className="text-[10px] font-semibold text-slate-400 pl-2">AND</div>
              {/* Chip 2 */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <Sparkles size={12} className="text-[#42d3a5]" />
                <span className="text-[11px] font-medium text-slate-700">{t.chip2.label}</span>
                <span className="text-[8px] font-bold text-[#42d3a5] bg-[#42d3a5]/10 px-1 py-0.5 rounded">AI</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
