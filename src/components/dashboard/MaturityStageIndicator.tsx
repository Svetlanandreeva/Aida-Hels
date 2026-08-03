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
  // Determine level
  let levelText = 'Начинаем знакомство';
  let levelPercent = 20;
  let missingHint = 'Для анализа сна, стресса и показателей здоровья добавьте первые записи в дневник или загрузите исследование.';

  const hasRealData = diaryEntriesCount > 0 || documentsCount > 0;

  if (hasRealData && (hasSurvey || (diaryEntriesCount >= 8 && documentsCount >= 1) || daysSinceRegistration >= 30)) {
    if (daysSinceRegistration >= 30 && diaryEntriesCount < 3 && documentsCount === 0) {
      levelText = 'Начальный уровень (прошёл месяц)';
      levelPercent = 30;
      missingHint = 'Прошёл месяц, но данных пока недостаточно для полной картины. Добавляйте записи тогда, когда вам удобно.';
    } else {
      levelText = 'Данных достаточно для персональной картины';
      levelPercent = 100;
      missingHint = 'Картина регулярно обновляется по мере добавления дневниковых записей и исследований.';
    }
  } else if (hasRealData && (daysSinceRegistration >= 15 || diaryEntriesCount >= 5)) {
    levelText = 'Формируется динамика';
    levelPercent = 70;
    missingHint = 'Для точного прогноза ресурса добавьте ещё несколько записей о качестве сна и нагрузках.';
  } else if (hasRealData && (daysSinceRegistration >= 4 || diaryEntriesCount >= 1)) {
    levelText = 'Появляются первые наблюдения';
    levelPercent = 45;
    missingHint = 'Наблюдения пока носят предварительный характер. Продолжайте вести дневник.';
  }

  return (
    <div className="bg-[#14171C] border border-gray-800 rounded-2xl p-4 space-y-3 my-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-gray-400 font-medium">Данных для персональной картины:</span>
          <span className="font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
            {levelText}
          </span>
        </div>

        {!hasSurvey && (
          <button
            onClick={onOpenProposal}
            className="text-[11px] text-teal-400 hover:text-teal-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Ускорить через опрос</span>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${levelPercent}%` }}
        />
      </div>

      {/* Missing hint text */}
      <div className="flex items-start gap-2 text-xs text-gray-400">
        <Info className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
        <p className="leading-snug">{missingHint}</p>
      </div>
    </div>
  );
};
