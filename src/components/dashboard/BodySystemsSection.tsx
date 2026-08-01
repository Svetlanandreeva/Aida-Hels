import React, { useState } from 'react';
import { BodySystemReport } from '../../types';
import {
  Activity,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  FileQuestion,
  Info,
} from 'lucide-react';

interface BodySystemsSectionProps {
  systems: BodySystemReport[];
  onNavigateBodyMap: () => void;
}

export const BodySystemsSection: React.FC<BodySystemsSectionProps> = ({
  systems,
  onNavigateBodyMap,
}) => {
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'norm':
        return {
          bg: 'bg-[#34F5A4]/10 border-[#34F5A4]/30 text-[#34F5A4]',
          dot: 'bg-[#34F5A4]',
          label: 'Норма',
        };
      case 'slight_deviation':
        return {
          bg: 'bg-[#4DEBFF]/10 border-[#4DEBFF]/30 text-[#4DEBFF]',
          dot: 'bg-[#4DEBFF]',
          label: 'Мелкое отклонение',
        };
      case 'attention':
        return {
          bg: 'bg-[#FF8C42]/10 border-[#FF8C42]/30 text-[#FF8C42]',
          dot: 'bg-[#FF8C42]',
          label: 'Требует внимания',
        };
      case 'urgent_help':
        return {
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
          dot: 'bg-rose-400',
          label: 'Острая проблема',
        };
      case 'insufficient_data':
      default:
        return {
          bg: 'bg-white/10 border-white/20 text-white/60',
          dot: 'bg-white/40',
          label: 'Недостаточно данных',
        };
    }
  };

  return (
    <div id="body-systems-section" className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 text-[#34F5A4] flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-white text-base sm:text-xl tracking-tight">
              Отчёт по 12 системам организма
            </h3>
          </div>
          <p className="text-xs text-white/60 mt-1">
            Системный профиль здоровья, рассчитанный на основе медицинских исследований и анкетирования.
          </p>
        </div>

        <button
          onClick={onNavigateBodyMap}
          className="px-4 py-2.5 bg-[#101A28] hover:bg-white/[0.06] text-[#34F5A4] border border-[#34F5A4]/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <span>Интерактивная карта тела</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* SYSTEMS GRID (1 column on mobile, 2 on tablet, 3 on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {systems.map((sys) => {
          const badge = getStatusBadge(sys.status);
          const isSelected = selectedSystemId === sys.id;

          return (
            <div
              key={sys.id}
              onClick={() => setSelectedSystemId(isSelected ? null : sys.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative group ${
                isSelected
                  ? 'bg-[#101A28] border-[#34F5A4]/50 shadow-lg'
                  : 'bg-[#101A28]/60 hover:bg-[#101A28] border-white/[0.06] hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-xs sm:text-sm leading-snug group-hover:text-[#34F5A4] transition-colors">
                    {sys.name}
                  </h4>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                    <span>{sys.statusLabel || badge.label}</span>
                  </span>
                </div>

                {sys.hasSufficientData ? (
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-white">{sys.score}</span>
                    <span className="text-[10px] text-white/40 block">/ 100</span>
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-white/5 text-white/40 shrink-0" title="Недостаточно данных">
                    <FileQuestion className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* BRIEF COMMENT */}
              <p className="text-xs text-white/70 leading-relaxed line-clamp-2 bg-black/20 p-2.5 rounded-xl border border-white/[0.04]">
                {sys.briefComment}
              </p>

              {/* EXPANDABLE DETAILS */}
              {isSelected && (
                <div className="pt-2 border-t border-white/[0.06] space-y-2 text-xs animate-fadeIn">
                  {sys.influencingMarkers && sys.influencingMarkers.length > 0 && (
                    <div>
                      <span className="font-semibold text-white/60 block text-[10px] mb-1">
                        Влияющие маркёры:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {sys.influencingMarkers.map((m, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-white/5 text-white/80 rounded border border-white/10 text-[10px]">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {sys.nextAction && (
                    <div className="bg-[#34F5A4]/10 p-2.5 rounded-xl border border-[#34F5A4]/20 text-xs text-[#34F5A4] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{sys.nextAction}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
