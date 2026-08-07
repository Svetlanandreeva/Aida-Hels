import React, { useState } from 'react';
import { RecommendedTest, Reminder } from '../../types';
import { Microscope, CheckCircle2, AlertCircle, Plus, Calendar, ArrowRight, Sparkles } from 'lucide-react';

interface RecommendedNextTestsSectionProps {
  recommendedTests: RecommendedTest[];
  onAddReminder?: (testName: string) => void;
  onNavigateToLab?: () => void;
}

export const RecommendedNextTestsSection: React.FC<RecommendedNextTestsSectionProps> = ({
  recommendedTests,
  onAddReminder,
  onNavigateToLab,
}) => {
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  const handleAdd = (test: RecommendedTest) => {
    setAddedIds((prev) => ({ ...prev, [test.id]: true }));
    if (onAddReminder) {
      onAddReminder(test.name);
    }
  };

  if (recommendedTests.length === 0) {
    return (
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#34F5A4]/10 border border-[#34F5A4]/20 text-[#34F5A4] flex items-center justify-center shrink-0">
            <Microscope className="w-4 h-4" />
          </div>
          <h2 className="font-extrabold text-white text-sm sm:text-base tracking-tight">
            Рекомендации по дообследованию
          </h2>
        </div>
        <div className="p-4 bg-[#101A28] border border-white/[0.06] rounded-xl text-xs text-white/70 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-[#34F5A4] shrink-0" />
          <span>
            У вас собран исчерпывающий набор исследований! Все ключевые функциональные системы имеют подтвержденные данные.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0B1320] border border-emerald-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Microscope className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-black text-white text-sm sm:text-base tracking-tight">
                Что ещё сдать для полного анализа ({recommendedTests.length})
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 shrink-0">
                100% полнота карты
              </span>
            </div>
            <p className="text-[11px] text-white/60">
              Дополнительные лабораторные и инструментальные тесты для уточнения выявленных отклонений
            </p>
          </div>
        </div>

        {onNavigateToLab && (
          <button
            onClick={onNavigateToLab}
            className="px-3 py-1.5 bg-[#8E74FF]/15 hover:bg-[#8E74FF]/25 border border-[#8E74FF]/30 rounded-xl text-xs font-bold text-[#8E74FF] hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span>Загрузить готовый бланк</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recommendedTests.map((test) => {
          const isAdded = addedIds[test.id];

          return (
            <div
              key={test.id}
              className="bg-[#101A28] hover:bg-[#132033] border border-white/[0.06] hover:border-emerald-500/40 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all space-y-2"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {test.category}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      test.urgency === 'Срочно'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {test.urgency}
                  </span>
                </div>

                <h4 className="font-extrabold text-white text-xs sm:text-sm leading-snug">
                  {test.name}
                </h4>

                <p className="text-[11px] text-white/70 leading-relaxed bg-[#0B1320] p-2.5 rounded-lg border border-white/[0.04]">
                  {test.reason}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                <span className="text-[10px] text-white/40">
                  Система: <strong className="text-white/80">{test.targetSystem}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => handleAdd(test)}
                  disabled={isAdded}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isAdded
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-[#8E74FF]/20 hover:bg-[#8E74FF]/30 text-[#8E74FF] border border-[#8E74FF]/30'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>В напоминаниях</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Добавить в напоминания</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
