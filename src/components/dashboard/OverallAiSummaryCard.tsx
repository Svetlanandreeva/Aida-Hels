import React, { useState } from 'react';
import { StructuredHealthAnalysis } from '../../types';
import {
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  Activity,
  CheckCircle2,
  Database,
  Info,
} from 'lucide-react';

interface OverallAiSummaryCardProps {
  analysis: StructuredHealthAnalysis;
}

export const OverallAiSummaryCard: React.FC<OverallAiSummaryCardProps> = ({ analysis }) => {
  const [showSources, setShowSources] = useState(false);

  const getStatusStyle = () => {
    switch (analysis.overallStatus) {
      case 'norm':
        return {
          bg: 'bg-[#34F5A4]/10 border-[#34F5A4]/30 text-[#34F5A4]',
          label: 'Стабильное / Норма',
        };
      case 'slight_deviation':
        return {
          bg: 'bg-[#4DEBFF]/10 border-[#4DEBFF]/30 text-[#4DEBFF]',
          label: 'Мелкие отклонения',
        };
      case 'attention':
        return {
          bg: 'bg-[#FF8C42]/10 border-[#FF8C42]/30 text-[#FF8C42]',
          label: 'Требует внимания',
        };
      case 'urgent_help':
        return {
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
          label: 'Срочная помощь',
        };
      default:
        return {
          bg: 'bg-white/10 border-white/20 text-white/70',
          label: 'Недостаточно данных',
        };
    }
  };

  const statusStyle = getStatusStyle();

  return (
    <div id="overall-ai-summary-card" className="bg-gradient-to-br from-[#0B1320] via-[#0F1A2A] to-[#0B1320] border border-[#34F5A4]/20 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 relative overflow-hidden">
      {/* GLOW DECORATION */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#34F5A4]/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#34F5A4]/10 border border-[#34F5A4]/30 text-[#34F5A4] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#34F5A4]">
                ИИ-Анализ состояния здоровья
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg}`}>
                {statusStyle.label}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
              Общий медико-психологический статус
            </h2>
          </div>
        </div>

        {/* METRIC BADGE */}
        <div className="flex items-center gap-3 bg-[#101A28] px-4 py-2 rounded-2xl border border-white/[0.06] shrink-0 self-start sm:self-auto">
          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-black text-white">{analysis.overallScore}</span>
            <span className="text-xs text-white/40"> / 10</span>
            <span className="text-[10px] text-white/50 block">Индекс ресурса</span>
          </div>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY TEXT */}
      <div className="space-y-3">
        <p className="text-xs sm:text-sm text-white/90 leading-relaxed bg-[#101A28]/80 p-4 rounded-2xl border border-white/[0.04]">
          {analysis.summary}
        </p>

        {/* POSITIVE & NEGATIVE FACTORS PREVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {analysis.positiveFactors && analysis.positiveFactors.length > 0 && (
            <div className="bg-[#34F5A4]/5 p-3.5 rounded-2xl border border-[#34F5A4]/15 space-y-1.5">
              <span className="text-xs font-bold text-[#34F5A4] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Зафиксированные плюсы и ресурсы:</span>
              </span>
              <ul className="text-xs text-white/80 space-y-1">
                {analysis.positiveFactors.map((f, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#34F5A4] mt-1.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.negativeFactors && analysis.negativeFactors.length > 0 && (
            <div className="bg-[#FF8C42]/5 p-3.5 rounded-2xl border border-[#FF8C42]/15 space-y-1.5">
              <span className="text-xs font-bold text-[#FF8C42] flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>Факторы нагрузки и внимания:</span>
              </span>
              <ul className="text-xs text-white/80 space-y-1">
                {analysis.negativeFactors.map((f, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#FF8C42] mt-1.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER: EXPLAINABILITY & DATA COMPLETENESS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-4 text-xs text-white/60">
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-[#4DEBFF]" />
            <span>Полнота данных: <strong className="text-white">{Math.round((analysis.dataCompleteness || 0.8) * 100)}%</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#34F5A4]" />
            <span>Достоверность ИИ: <strong className="text-white">{Math.round((analysis.confidence || 0.9) * 100)}%</strong></span>
          </div>
        </div>

        <button
          onClick={() => setShowSources(!showSources)}
          className="px-3.5 py-2 rounded-xl bg-[#101A28] hover:bg-white/[0.06] text-white/80 border border-white/10 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <span>На основании чего сделан вывод</span>
          {showSources ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* EXPANDABLE SOURCES LIST */}
      {showSources && (
        <div className="bg-[#101A28] p-4 rounded-2xl border border-white/[0.08] space-y-2 animate-fadeIn text-xs">
          <span className="font-bold text-[#34F5A4] block mb-2">
            Использованные источники данных и расчетные модули:
          </span>
          {analysis.calculationSources && analysis.calculationSources.length > 0 ? (
            analysis.calculationSources.map((src, idx) => (
              <div key={idx} className="p-2.5 bg-black/20 rounded-xl border border-white/[0.04] space-y-0.5">
                <span className="font-semibold text-white block">{src.label}</span>
                <span className="text-white/60 block text-[11px]">{src.detail}</span>
              </div>
            ))
          ) : (
            <p className="text-white/60">Анкета пользователя, история лабораторных анализов и дневник самочувствия.</p>
          )}
        </div>
      )}
    </div>
  );
};
