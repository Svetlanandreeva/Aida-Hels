import React from 'react';
import { Calendar, CheckCircle2, Clock, Info, HelpCircle } from 'lucide-react';

interface MaturityStageIndicatorProps {
  daysSinceRegistration: number;
  hasSurvey: boolean;
  documentsCount: number;
  diaryEntriesCount: number;
  onOpenProposal: () => void;
}

export const MaturityStageIndicator: React.FC<MaturityStageIndicatorProps> = ({
  daysSinceRegistration,
  hasSurvey,
  documentsCount,
  diaryEntriesCount,
  onOpenProposal,
}) => {
  // Determine level strictly and accurately based on actual uploaded data
  let levelText = 'Недостаточно данных для персональной картины';
  let levelPercent = 20;
  let badgeStyle = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  let missingHint = 'Данных пока недостаточно. Загрузите бланки лабораторных анализов или заполняйте дневник самочувствия в течение 5–7 дней.';

  if (documentsCount >= 3 && diaryEntriesCount >= 10) {
    levelText = 'Данных достаточно для персональной картины';
    levelPercent = 100;
    badgeStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    missingHint = 'Персональный профиль полностью сформирован и регулярно обновляется по мере добавления данных.';
  } else if (documentsCount >= 2 || (documentsCount === 1 && diaryEntriesCount >= 7)) {
    levelText = 'Хорошая заполненность данных (75%)';
    levelPercent = 75;
    badgeStyle = 'bg-teal-500/15 text-teal-300 border-teal-500/30';
    missingHint = 'Сформирован основной профиль. Для полного анализа 10 систем организма рекомендуем сдать недостающие показатели.';
  } else if (documentsCount === 1 || diaryEntriesCount >= 3) {
    levelText = 'Формируется первичная динамика (данных мало)';
    levelPercent = 50;
    badgeStyle = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    missingHint = 'Появляются первые наблюдения. Наблюдения пока носят предварительный характер — добавьте ещё анализы или записи.';
  } else if (hasSurvey || diaryEntriesCount >= 1) {
    levelText = 'Первые шаги (недостаточно данных)';
    levelPercent = 30;
    badgeStyle = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    missingHint = 'Вы сделали первые шаги, но для формирования точного медицинского отчёта требуется больше данных.';
  }

  return (
    <div className="bg-[#101A28] border border-white/[0.08] rounded-2xl p-4 space-y-3 my-3 shadow-xl">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <Calendar className="w-4 h-4 text-[#8E74FF] shrink-0" />
            <span className="text-white/70 font-medium">Данных для персональной картины:</span>
          </div>
          <span className={`font-bold px-2.5 py-0.5 rounded-lg border text-[11px] sm:text-xs shrink-0 ${badgeStyle}`}>
            {levelText}
          </span>
        </div>

        {!hasSurvey && onOpenProposal && (
          <button
            type="button"
            onClick={onOpenProposal}
            className="text-[11px] text-[#4DEBFF] hover:text-[#4DEBFF]/80 font-semibold hover:underline flex items-center gap-1 cursor-pointer self-start xs:self-auto shrink-0"
          >
            <span>Ускорить через опрос</span>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full bg-gradient-to-r from-[#8E74FF] via-[#4DEBFF] to-[#34F5A4] transition-all duration-500"
          style={{ width: `${levelPercent}%` }}
        />
      </div>

      {/* Missing hint text */}
      <div className="flex items-start gap-2 text-xs text-white/60">
        <Info className="w-3.5 h-3.5 text-[#8E74FF] shrink-0 mt-0.5" />
        <p className="leading-snug">{missingHint}</p>
      </div>
    </div>
  );
};
