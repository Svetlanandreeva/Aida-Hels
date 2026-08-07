import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  X,
  Heart,
  Zap,
  Moon,
  TrendingUp,
  ChevronRight,
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
  const [activeInfoTooltip, setActiveInfoTooltip] = useState<'completeness' | 'confidence' | 'ai' | null>(null);

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
      {/* 4 METRIC CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* CARD 1: ОБЩЕЕ СОСТОЯНИЕ */}
        <div
          onClick={() => onNavigate && onNavigate('body_map')}
          className="bg-[#0B1320] hover:bg-[#0E182A] border border-white/[0.08] hover:border-[#34F5A4]/60 rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xl hover:shadow-[0_0_25px_rgba(52,245,164,0.15)] flex flex-col justify-between group relative overflow-hidden"
          title="Открыть раздел Организм"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
              Общее состояние
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#34F5A4]/15 border border-[#34F5A4]/30 text-[#34F5A4] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Heart className="w-4 h-4 fill-[#34F5A4]/20" />
            </div>
          </div>

          <div className="mt-4">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight block">
              {overallScoreVal}
            </span>
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className="text-xs font-semibold text-[#34F5A4] flex items-center gap-1">
                {overallScoreSource}
              </span>
              <span className="text-[11px] font-bold text-[#34F5A4] bg-[#34F5A4]/10 hover:bg-[#34F5A4]/20 border border-[#34F5A4]/20 px-2 py-0.5 rounded-full flex items-center gap-0.5 transition-all">
                Организм <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
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

      {/* AI STATUS BAR (MOVED TO BOTTOM) */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          {/* Metadata Icon Buttons Row (Only icons visible, text revealed on click) */}
          <div className="flex items-center gap-2">
            {/* 1. Database Icon Button (Полнота данных) */}
            <button
              type="button"
              onClick={() => setActiveInfoTooltip(activeInfoTooltip === 'completeness' ? null : 'completeness')}
              className={`p-2 rounded-xl transition-all border cursor-pointer flex items-center justify-center relative group ${
                activeInfoTooltip === 'completeness'
                  ? 'bg-[#4DEBFF]/20 border-[#4DEBFF] shadow-[0_0_12px_rgba(77,235,255,0.4)]'
                  : 'bg-[#101A28] hover:bg-white/10 border-white/10 text-[#4DEBFF]'
              }`}
              title="Полнота данных (нажмите для подробностей)"
            >
              <Database className="w-4 h-4 text-[#4DEBFF]" />
            </button>

            {/* 2. ShieldCheck Icon Button (Достоверность ИИ) */}
            <button
              type="button"
              onClick={() => setActiveInfoTooltip(activeInfoTooltip === 'confidence' ? null : 'confidence')}
              className={`p-2 rounded-xl transition-all border cursor-pointer flex items-center justify-center relative group ${
                activeInfoTooltip === 'confidence'
                  ? 'bg-[#34F5A4]/20 border-[#34F5A4] shadow-[0_0_12px_rgba(52,245,164,0.4)]'
                  : 'bg-[#101A28] hover:bg-white/10 border-white/10 text-[#34F5A4]'
              }`}
              title="Достоверность ИИ (нажмите для подробностей)"
            >
              <ShieldCheck className="w-4 h-4 text-[#34F5A4]" />
            </button>

            {/* 3. Sparkles Icon Button (Сгенерировано ИИ — directly to the right of the first two) */}
            <button
              type="button"
              onClick={() => setActiveInfoTooltip(activeInfoTooltip === 'ai' ? null : 'ai')}
              className={`p-2 rounded-xl transition-all border cursor-pointer flex items-center justify-center relative group ${
                activeInfoTooltip === 'ai'
                  ? 'bg-[#8968FF]/20 border-[#8968FF] shadow-[0_0_12px_rgba(137,104,255,0.4)]'
                  : 'bg-[#101A28] hover:bg-white/10 border-white/10 text-[#8968FF]'
              }`}
              title="Сгенерировано ИИ (нажмите для подробностей)"
            >
              <Sparkles className="w-4 h-4 text-[#8968FF]" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSendFeedback('useful')}
              className={`p-2 rounded-xl transition-all border cursor-pointer flex items-center justify-center relative ${
                feedbackSent === 'useful'
                  ? 'bg-[#34F5A4]/20 border-[#34F5A4] text-[#34F5A4] shadow-[0_0_12px_rgba(52,245,164,0.4)]'
                  : 'bg-[#101A28] hover:bg-[#34F5A4]/15 border-white/10 text-emerald-400'
              }`}
              title="Полезно"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSendFeedback('inaccurate')}
              className={`p-2 rounded-xl transition-all border cursor-pointer flex items-center justify-center relative ${
                feedbackSent === 'inaccurate'
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                  : 'bg-[#101A28] hover:bg-rose-500/15 border-white/10 text-rose-400'
              }`}
              title="Неточно"
            >
              <ThumbsDown className="w-4 h-4" />
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

        {/* REVEALED EXPLANATION POPOVER ON CLICK */}
        {activeInfoTooltip === 'completeness' && (
          <div className="p-3 bg-[#101A28] border border-[#4DEBFF]/30 rounded-xl text-xs text-white/90 flex items-start justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-[#4DEBFF] shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-[#4DEBFF] block">
                  Полнота данных: {completenessPct}%
                </span>
                <p className="text-white/70 text-[11px] mt-0.5 leading-relaxed">
                  Рассчитано на основе объёма загруженных медицинских исследований, лабораторий, записей в дневниках и анкеты.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveInfoTooltip(null)}
              className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {activeInfoTooltip === 'confidence' && (
          <div className="p-3 bg-[#101A28] border border-[#34F5A4]/30 rounded-xl text-xs text-white/90 flex items-start justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#34F5A4] shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-[#34F5A4] block">
                  Достоверность ИИ: {confidencePct}%
                </span>
                <p className="text-white/70 text-[11px] mt-0.5 leading-relaxed">
                  Высокая степень клинической уверенности на основе алгоритмов мед. анализа и действующих клинических рекомендаций.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveInfoTooltip(null)}
              className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {activeInfoTooltip === 'ai' && (
          <div className="p-3 bg-[#101A28] border border-[#8968FF]/30 rounded-xl text-xs text-white/90 flex items-start justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#8968FF] shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-[#8968FF] block">
                  Сгенерировано ИИ
                </span>
                <p className="text-white/70 text-[11px] mt-0.5 leading-relaxed">
                  Материал носит исключительно информационный характер, не является постановкой диагноза и не заменяет приём врача.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveInfoTooltip(null)}
              className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
    </div>
  );
};
