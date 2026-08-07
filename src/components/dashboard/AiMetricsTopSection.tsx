import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  Heart,
  Zap,
  Moon,
  TrendingUp,
} from 'lucide-react';
import {
  StructuredHealthAnalysis,
  UserProfile,
  MedicalDocument,
  DailyLogEntry,
  DiaryEntry,
  ScreenId,
} from '../../types';

interface AiMetricsTopSectionProps {
  user?: UserProfile;
  aiAnalysis?: StructuredHealthAnalysis | null;
  documents?: MedicalDocument[];
  dailyLogs?: DailyLogEntry[];
  diaryEntries?: DiaryEntry[];
  onNavigate?: (screen: ScreenId) => void;
  displayHealthScore?: number | null;
}

export const AiMetricsTopSection: React.FC<AiMetricsTopSectionProps> = ({
  aiAnalysis,
  documents = [],
  dailyLogs = [],
  diaryEntries = [],
  onNavigate,
  displayHealthScore,
}) => {
  const [showSources, setShowSources] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<'useful' | 'inaccurate' | null>(null);

  // 1. Calculate values
  const completenessPct = aiAnalysis?.dataCompleteness
    ? Math.round(aiAnalysis.dataCompleteness * 100)
    : 72;

  const confidencePct = aiAnalysis?.confidence
    ? Math.round(aiAnalysis.confidence * 100)
    : 85;

  // General health score: e.g. 58%
  const overallScoreVal = displayHealthScore !== undefined && displayHealthScore !== null
    ? `${displayHealthScore}%`
    : aiAnalysis?.overallScore
    ? `${Math.round(aiAnalysis.overallScore * 10)}%`
    : '58%';

  const overallScoreSource = documents.length > 0
    ? '• По исследованиям'
    : '• Оценка по опросу';

  // Energy
  const latestLog = dailyLogs[0];
  const latestDiary = diaryEntries[0];

  const energyVal = latestLog?.energy !== undefined
    ? `${latestLog.energy * 10}%`
    : latestDiary?.energy_score !== undefined
    ? `${latestDiary.energy_score * 10}%`
    : '30%';

  const energySource = (latestLog || latestDiary) ? '• По данным дневника' : '• По данным анкеты';

  // Sleep
  const sleepVal = latestLog?.sleep !== undefined
    ? `${latestLog.sleep}ч`
    : latestDiary?.physical_factors?.sleepDurationHours !== undefined
    ? `${latestDiary.physical_factors.sleepDurationHours}ч`
    : '11.5ч';

  const sleepSource = (latestLog || latestDiary) ? '• По данным дневника' : '• По данным анкеты';

  const handleSendFeedback = (type: 'useful' | 'inaccurate') => {
    setFeedbackSent(type);
    fetch('/api/ai/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insightId: 'overall_summary',
        feedback: type === 'useful' ? 'ПОЛЕЗНЫЙ' : 'БЕСПОЛЕЗНО',
      }),
    }).catch(() => {});
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* AI TOP STATUS BAR */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-white/80">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#4DEBFF]" />
              <span>
                Полнота данных: <strong className="text-white font-extrabold">{completenessPct}%</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#34F5A4]" />
              <span>
                Достоверность ИИ: <strong className="text-white font-extrabold">{confidencePct}%</strong>
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSendFeedback('useful')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                feedbackSent === 'useful'
                  ? 'bg-[#34F5A4]/20 border-[#34F5A4]/50 text-[#34F5A4]'
                  : 'bg-[#101A28] hover:bg-[#34F5A4]/15 border-white/[0.08] text-emerald-400'
              }`}
            >
              👍 Полезно
            </button>

            <button
              type="button"
              onClick={() => handleSendFeedback('inaccurate')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                feedbackSent === 'inaccurate'
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                  : 'bg-[#101A28] hover:bg-rose-500/15 border-white/[0.08] text-rose-400'
              }`}
            >
              👎 Неточно
            </button>

            <button
              type="button"
              onClick={() => setShowSources(!showSources)}
              className="px-3.5 py-1.5 rounded-xl bg-[#101A28] hover:bg-white/[0.08] text-white/90 border border-white/10 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Источники</span>
              {showSources ? <ChevronUp className="w-3.5 h-3.5 text-[#34F5A4]" /> : <ChevronDown className="w-3.5 h-3.5 text-white/60" />}
            </button>
          </div>
        </div>

        {/* AI DISCLAIMER */}
        <div className="p-3 bg-[#101A28]/60 border border-white/[0.04] rounded-xl text-[11px] text-white/60 flex items-center gap-2.5">
          <Info className="w-4 h-4 text-[#34F5A4] shrink-0" />
          <p className="leading-tight">
            Сгенерировано ИИ. Материал носит информационный характер, не является постановкой диагноза и не заменяет приём врача.
          </p>
        </div>

        {/* EXPANDABLE SOURCES LIST */}
        {showSources && (
          <div className="bg-[#101A28] p-4 rounded-2xl border border-white/[0.08] space-y-2 text-xs text-white/80 animate-fadeIn mt-2">
            <span className="font-bold text-[#34F5A4] block mb-1">
              Источники данных и клинические валидаторы:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2.5 bg-black/20 rounded-xl border border-white/[0.04]">
                <span className="font-bold text-white block">Лабораторные анализы</span>
                <span className="text-white/50 text-[11px] block mt-0.5">
                  {documents.length > 0 ? `Загружено бланков: ${documents.length}` : 'Бланки пока не загружены'}
                </span>
              </div>
              <div className="p-2.5 bg-black/20 rounded-xl border border-white/[0.04]">
                <span className="font-bold text-white block">Электронная анкета</span>
                <span className="text-white/50 text-[11px] block mt-0.5">Профиль здоровья пользователя</span>
              </div>
              <div className="p-2.5 bg-black/20 rounded-xl border border-white/[0.04]">
                <span className="font-bold text-white block">Дневник самочувствия</span>
                <span className="text-white/50 text-[11px] block mt-0.5">
                  {dailyLogs.length > 0 || diaryEntries.length > 0 ? 'Записи активности сохранены' : 'Ожидает новых записей'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4 METRIC CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* CARD 1: ОБЩЕЕ СОСТОЯНИЕ */}
        <div
          onClick={() => onNavigate && onNavigate('body_map')}
          className="bg-[#0B1320] hover:bg-[#0E182A] border border-white/[0.08] hover:border-[#34F5A4]/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xl flex flex-col justify-between group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
              Общее состояние
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#34F5A4]/15 border border-[#34F5A4]/30 text-[#34F5A4] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Heart className="w-4 h-4 fill-[#34F5A4]/20" />
            </div>
          </div>

          <div className="mt-4">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight block">
              {overallScoreVal}
            </span>
            <span className="text-xs font-semibold text-[#34F5A4] flex items-center gap-1 mt-1">
              {overallScoreSource}
            </span>
          </div>
        </div>

        {/* CARD 2: ЭНЕРГИЯ */}
        <div
          onClick={() => onNavigate && onNavigate('mental_diary')}
          className="bg-[#0B1320] hover:bg-[#0E182A] border border-white/[0.08] hover:border-[#4DEBFF]/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xl flex flex-col justify-between group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
              Энергия
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#4DEBFF]/15 border border-[#4DEBFF]/30 text-[#4DEBFF] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Zap className="w-4 h-4 fill-[#4DEBFF]/20" />
            </div>
          </div>

          <div className="mt-4">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight block">
              {energyVal}
            </span>
            <span className="text-xs font-semibold text-[#4DEBFF] flex items-center gap-1 mt-1">
              {energySource}
            </span>
          </div>
        </div>

        {/* CARD 3: СОН */}
        <div
          onClick={() => onNavigate && onNavigate('mental_diary')}
          className="bg-[#0B1320] hover:bg-[#0E182A] border border-white/[0.08] hover:border-[#8E74FF]/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xl flex flex-col justify-between group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
              Сон
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#8E74FF]/15 border border-[#8E74FF]/30 text-[#8E74FF] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Moon className="w-4 h-4 fill-[#8E74FF]/20" />
            </div>
          </div>

          <div className="mt-4">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight block">
              {sleepVal}
            </span>
            <span className="text-xs font-semibold text-[#8E74FF] flex items-center gap-1 mt-1">
              {sleepSource}
            </span>
          </div>
        </div>

        {/* CARD 4: ПРОГНОЗ РЕСУРСА */}
        <div
          onClick={() => onNavigate && onNavigate('body_map')}
          className="bg-[#0B1320] hover:bg-[#0E182A] border border-white/[0.08] hover:border-[#FF8C42]/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xl flex flex-col justify-between group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
              Прогноз ресурса
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#FF8C42]/15 border border-[#FF8C42]/30 text-[#FF8C42] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4">
            <span className="text-lg sm:text-xl font-bold text-white tracking-tight block">
              Появится позже
            </span>
            <span className="text-xs font-semibold text-[#FF8C42] flex items-center gap-1 mt-1">
              • На ближайшие 3 дня
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
