import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Zap,
  Moon,
  Heart,
  Smile,
  Brain,
  Dna,
  FlaskConical,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Pill,
  Check,
  Clock,
  ArrowDown,
  Info,
  AlertTriangle,
  Settings,
  RefreshCw,
  Calendar,
} from 'lucide-react';

import {
  UserProfile,
  MedicalDocument,
  Appointment,
  BodySystem,
  ScreenId,
  DashboardTab,
  Reminder,
  DailyLogEntry,
  DiaryEntry,
  PressureLogEntry,
  UserMentalPatterns,
  StructuredHealthAnalysis,
} from '../types';
import { calculateHealthProfile } from '../utils/calculateHealthProfile';
import { StateConnectionsSection } from './dashboard/StateConnectionsSection';
import { RecommendedNextTestsSection } from './dashboard/RecommendedNextTestsSection';

export interface HomeDashboardProps {
  user: UserProfile;
  documents?: MedicalDocument[];
  appointments?: Appointment[];
  bodySystems?: BodySystem[];
  onNavigate: (screen: ScreenId) => void;
  setActiveTab: (tab: DashboardTab) => void;
  onOpenDoctorReport?: () => void;
  reminders?: Reminder[];
  setReminders?: React.Dispatch<React.SetStateAction<Reminder[]>>;
  dailyLogs?: DailyLogEntry[];
  diaryEntries?: DiaryEntry[];
  pressureLogs?: PressureLogEntry[];
  mentalPatterns?: UserMentalPatterns;
  isLoadingAnalysis?: boolean;
  fetchHealthAnalysis?: () => void;
  aiAnalysis?: StructuredHealthAnalysis | null;
}

export default function HomeDashboard({
  user,
  documents = [],
  onNavigate,
  setActiveTab,
  onOpenDoctorReport,
  reminders = [],
  setReminders,
  dailyLogs = [],
  diaryEntries = [],
  pressureLogs = [],
  isLoadingAnalysis = false,
  fetchHealthAnalysis,
  aiAnalysis,
}: HomeDashboardProps) {
  // Collapsible state for extra detailed sections
  const [isAttentionOpen, setIsAttentionOpen] = useState(false);

  const healthProfile = calculateHealthProfile(user, documents, dailyLogs, pressureLogs);

  // Active ring metrics navigation tooltip state
  const [hoveredRingItem, setHoveredRingItem] = useState<string | null>(null);

  // Formatted date for AI analysis
  const analysisDateFormatted = React.useMemo(() => {
    const latestDoc = documents[0]?.date;
    if (latestDoc) {
      return `${latestDoc} (по документам)`;
    }
    if (dailyLogs.length > 0) {
      try {
        return new Date(dailyLogs[0].date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      } catch {}
    }
    return '—';
  }, [documents, dailyLogs]);

  // Data-driven latest metric values
  const latestDailyLog = dailyLogs[0];
  const latestPressure = pressureLogs[0];
  const latestDiaryEntry = diaryEntries[0];

  const energyVal = latestDailyLog?.energy !== undefined ? `${latestDailyLog.energy * 10}%` : '—';
  const energyStatus = latestDailyLog?.energy !== undefined
    ? (latestDailyLog.energy >= 7 ? 'Хорошая' : latestDailyLog.energy >= 5 ? 'Умеренная' : 'Низкая')
    : 'Нет данных';

  const sleepVal = latestDailyLog?.sleep !== undefined ? `${latestDailyLog.sleep} ч` : '—';
  const sleepStatus = latestDailyLog?.sleep !== undefined
    ? (latestDailyLog.sleep >= 7 ? 'Норма' : 'Дефицит')
    : 'Нет данных';

  const pressureVal = latestPressure ? `${latestPressure.systolic}/${latestPressure.diastolic}` : '—';
  const pressureStatus = latestPressure
    ? (latestPressure.systolic <= 129 && latestPressure.diastolic <= 84 ? 'Норма' : 'Повышено')
    : 'Нет данных';

  const moodVal = latestDailyLog?.mood || latestDiaryEntry?.moods?.[0] || '—';
  const moodStatus = (latestDailyLog?.mood || latestDiaryEntry?.moods?.[0]) ? 'Зафиксировано' : 'Нет данных';

  const insights = React.useMemo(() => {
    if (documents.length === 0 && dailyLogs.length === 0 && pressureLogs.length === 0) {
      return {
        title: 'Данные здоровья пока не внесены',
        bullets: [
          'Пройдите ежедневный чек-ин или внесите запись в дневник',
          'Загрузите результаты анализов для полной оценки 10 систем организма',
        ],
      };
    }

    const list: string[] = [];
    if (latestPressure) {
      list.push(`Последний замер давления: ${latestPressure.systolic}/${latestPressure.diastolic} мм рт. ст. (${latestPressure.systolic <= 129 ? 'норма' : 'требует внимания'})`);
    }
    if (latestDailyLog) {
      list.push(`Оценка энергии: ${latestDailyLog.energy}/10, продолжительность сна: ${latestDailyLog.sleep} ч`);
    }
    if (documents.length > 0) {
      list.push(`Загружено медицинских документов: ${documents.length}`);
    }

    return {
      title: 'Оперативный ИИ-обзор состояния:',
      bullets: list.length > 0 ? list : ['Данные обновлены. Внесите замеры для расширенного анализа.'],
    };
  }, [documents, dailyLogs, pressureLogs, latestPressure, latestDailyLog]);

  const activeMedReminders = reminders.filter((r) => r.isEnabled);

  return (
    <div className="w-full bg-[#090B10] min-h-screen py-4 px-3 sm:px-6 text-white font-sans antialiased">
      {/* RESPONSIVE CONTAINER: Centered mobile max-w-[420px], expanding to max-w-4xl/6xl on desktop */}
      <div className="max-w-[420px] md:max-w-4xl lg:max-w-6xl mx-auto space-y-6">

        {/* TOP DASHBOARD UTILITY HEADER (Settings & Refresh Analysis) */}
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] px-1 gap-2">
          <div className="flex items-center gap-2 bg-[#111827] border border-white/[0.08] px-3 py-1.5 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#3DD9C5] animate-pulse shrink-0" />
            <span className="text-[11px] font-bold text-white/90 tracking-wide uppercase flex items-center gap-1.5 whitespace-nowrap">
              ИИ-Мониторинг Здоровья
              <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* REFRESH AI ANALYSIS BUTTON */}
            <button
              onClick={() => fetchHealthAnalysis?.()}
              disabled={isLoadingAnalysis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111827] border border-[#3DD9C5]/30 hover:border-[#3DD9C5] text-[#3DD9C5] hover:bg-[#3DD9C5]/10 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
              title="Обновить ИИ-анализ"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isLoadingAnalysis ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoadingAnalysis ? 'Обновление...' : 'Обновить анализ'}</span>
              <span className="sm:hidden">{isLoadingAnalysis ? '...' : 'Обновить'}</span>
            </button>

            {/* SETTINGS BUTTON */}
            <button
              onClick={() => onNavigate('settings')}
              className="p-2 rounded-xl bg-[#111827] border border-white/[0.08] hover:border-white/25 text-white/80 hover:text-white transition-all cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
              title="Настройки"
            >
              <Settings className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>

        {/* HERO SECTION (STACKED ON MOBILE, 2-COLUMN GRID ON DESKTOP) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-start">

          {/* LEFT COLUMN: 260px RING CONTAINER + DATE BADGE */}
          <div className="md:col-span-5 lg:col-span-5 bg-[#111827]/70 border border-white/[0.06] rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center space-y-4 shadow-xl backdrop-blur-md">
            {/* Active Hover / Focus Tooltip indicator with AnimatePresence */}
            <div className="h-6 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {hoveredRingItem ? (
                  <motion.div
                    key="hover-badge"
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="px-3.5 py-0.5 bg-[#111827] border border-[#8B5CF6]/50 text-[#3DD9C5] text-[11px] font-bold rounded-full shadow-lg flex items-center gap-1.5 z-30"
                  >
                    <Sparkles className="w-3 h-3 text-[#8B5CF6] animate-pulse" />
                    <span>{hoveredRingItem}</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="default-hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[11px] font-medium text-white/40 tracking-wider uppercase"
                  >
                    Нажмите на систему для деталей
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* THE 260px RING CONTAINER */}
            <div className="relative w-[260px] h-[260px] flex items-center justify-center shrink-0">
              {/* Ambient Animated Glowing Pulse Halo */}
              <motion.div
                animate={{ opacity: [0.15, 0.35, 0.15], scale: [0.98, 1.02, 0.98] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#8B5CF6]/20 to-[#3DD9C5]/20 blur-xl pointer-events-none"
              />

              {/* SVG Progress Arc Gauge - Crisp, Vibrant & Bright */}
              <svg className="w-full h-full -rotate-90 transform z-10" viewBox="0 0 260 260">
                {/* Background Ring Track */}
                <circle
                  cx="130"
                  cy="130"
                  r="115"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="10"
                  fill="none"
                />
                {/* Active Purple/Turquoise Progress Arc */}
                <circle
                  cx="130"
                  cy="130"
                  r="115"
                  stroke="url(#purpleTurquoiseGlow)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray="722"
                  strokeDashoffset="231" // 68% filled
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="purpleTurquoiseGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#3DD9C5" />
                  </linearGradient>
                </defs>
              </svg>

              {/* INNER CENTER CONTENT */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 py-4 pointer-events-none z-10">
                {/* Big Stat Number (42px) */}
                <div className="text-[42px] font-black text-white tracking-tight leading-none">
                  68%
                </div>
                
                <div className="text-[12px] font-medium text-white/60 mt-1">
                  Общее состояние
                </div>

                {/* Status Badge */}
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#3DD9C5]/15 border border-[#3DD9C5]/30 text-[#3DD9C5] text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3DD9C5] animate-pulse" />
                  Хорошее
                </div>

                {/* Organism Age vs Passport Age */}
                <div className="mt-2.5 pt-2 border-t border-white/10 w-[130px] space-y-0.5">
                  <div className="text-[11px] flex items-center justify-between text-white/70">
                    <span className="text-white/50 text-[10px]">Организм</span>
                    <span className="font-extrabold text-white text-[11px]">29.8 года</span>
                  </div>
                  <div className="text-[10px] flex items-center justify-between text-white/40">
                    <span>Паспорт</span>
                    <span className="font-medium text-white/60 text-[10px]">28 лет</span>
                  </div>
                </div>
              </div>

              {/* 5 ANIMATED SATELLITE ICON BUTTONS */}
              {/* 1. 🧪 Анализы (Top Center - 0°) */}
              <motion.button
                type="button"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, -2, 0] }}
                transition={{
                  scale: { delay: 0.1, duration: 0.3, type: "spring" },
                  y: { repeat: Infinity, duration: 3, ease: "easeInOut" },
                }}
                whileHover={{ scale: 1.25, zIndex: 30 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  onNavigate('dashboard');
                  setActiveTab('lab');
                }}
                onMouseEnter={() => setHoveredRingItem('Анализы и лабораторные бланки')}
                onMouseLeave={() => setHoveredRingItem(null)}
                className="absolute top-[15px] left-[130px] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#111827] border border-[#3DD9C5]/40 hover:border-[#3DD9C5] text-white flex items-center justify-center shadow-[0_0_12px_rgba(61,217,197,0.2)] hover:shadow-[0_0_18px_rgba(61,217,197,0.5)] transition-shadow cursor-pointer group z-20"
                title="Анализы"
              >
                <FlaskConical className="w-4 h-4 text-[#3DD9C5] group-hover:scale-110 transition-transform" />
              </motion.button>

              {/* 2. 🧠 Психика (Top Left - 288°) */}
              <motion.button
                type="button"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, -2.5, 0] }}
                transition={{
                  scale: { delay: 0.2, duration: 0.3, type: "spring" },
                  y: { repeat: Infinity, duration: 3.2, ease: "easeInOut", delay: 0.4 },
                }}
                whileHover={{ scale: 1.25, zIndex: 30 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onNavigate('mental_diary')}
                onMouseEnter={() => setHoveredRingItem('Психика и ментальный баланс')}
                onMouseLeave={() => setHoveredRingItem(null)}
                className="absolute top-[94.5px] left-[20.6px] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#111827] border border-[#8B5CF6]/40 hover:border-[#8B5CF6] text-white flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.2)] hover:shadow-[0_0_18px_rgba(139,92,246,0.5)] transition-shadow cursor-pointer group z-20"
                title="Психика"
              >
                <Brain className="w-4 h-4 text-[#8B5CF6] group-hover:scale-110 transition-transform" />
              </motion.button>

              {/* 3. ❤️ Давление (Top Right - 72°) */}
              <motion.button
                type="button"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, -2, 0] }}
                transition={{
                  scale: { delay: 0.3, duration: 0.3, type: "spring" },
                  y: { repeat: Infinity, duration: 2.8, ease: "easeInOut", delay: 0.2 },
                }}
                whileHover={{ scale: 1.25, zIndex: 30 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onNavigate('pressure_diary')}
                onMouseEnter={() => setHoveredRingItem('Артериальное давление')}
                onMouseLeave={() => setHoveredRingItem(null)}
                className="absolute top-[94.5px] left-[239.4px] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#111827] border border-rose-400/40 hover:border-rose-400 text-white flex items-center justify-center shadow-[0_0_12px_rgba(251,113,133,0.2)] hover:shadow-[0_0_18px_rgba(251,113,133,0.5)] transition-shadow cursor-pointer group z-20"
                title="Давление"
              >
                <Heart className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              </motion.button>

              {/* 4. 🌙 Сон (Bottom Left - 216°) */}
              <motion.button
                type="button"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, -2.5, 0] }}
                transition={{
                  scale: { delay: 0.4, duration: 0.3, type: "spring" },
                  y: { repeat: Infinity, duration: 3.4, ease: "easeInOut", delay: 0.6 },
                }}
                whileHover={{ scale: 1.25, zIndex: 30 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onNavigate('mental_diary')}
                onMouseEnter={() => setHoveredRingItem('Качество и фазы сна')}
                onMouseLeave={() => setHoveredRingItem(null)}
                className="absolute top-[223px] left-[62.4px] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#111827] border border-indigo-400/40 hover:border-indigo-400 text-white flex items-center justify-center shadow-[0_0_12px_rgba(129,140,248,0.2)] hover:shadow-[0_0_18px_rgba(129,140,248,0.5)] transition-shadow cursor-pointer group z-20"
                title="Сон"
              >
                <Moon className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              </motion.button>

              {/* 5. 🧬 Организм (Bottom Right - 144°) */}
              <motion.button
                type="button"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, -2, 0] }}
                transition={{
                  scale: { delay: 0.5, duration: 0.3, type: "spring" },
                  y: { repeat: Infinity, duration: 3.1, ease: "easeInOut", delay: 0.8 },
                }}
                whileHover={{ scale: 1.25, zIndex: 30 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onNavigate('body_map')}
                onMouseEnter={() => setHoveredRingItem('Системы и биологический возраст')}
                onMouseLeave={() => setHoveredRingItem(null)}
                className="absolute top-[223px] left-[197.6px] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#111827] border border-[#3DD9C5]/40 hover:border-[#3DD9C5] text-white flex items-center justify-center shadow-[0_0_12px_rgba(61,217,197,0.2)] hover:shadow-[0_0_18px_rgba(61,217,197,0.5)] transition-shadow cursor-pointer group z-20"
                title="Организм"
              >
                <Dna className="w-4 h-4 text-[#3DD9C5] group-hover:scale-110 transition-transform" />
              </motion.button>
            </div>

            {/* AI ANALYSIS DATE BADGE */}
            <div className="flex items-center justify-center gap-2 py-1.5 px-3.5 bg-[#111827]/90 border border-white/10 rounded-full w-fit shadow-md">
              <Clock className="w-3.5 h-3.5 text-[#3DD9C5] animate-pulse shrink-0" />
              <span className="text-[11px] font-medium text-white/70">
                Дата анализа: <span className="text-white font-bold">{analysisDateFormatted}</span>
              </span>
              <Sparkles className="w-3 h-3 text-[#8B5CF6] shrink-0" />
            </div>
          </div>

          {/* RIGHT COLUMN: 4 COMPACT METRICS CARDS + AIDA INSIGHT BLOCK */}
          <div className="md:col-span-7 lg:col-span-7 space-y-4 flex flex-col justify-between">
            {/* 4 COMPACT CARDS (2x2 GRID) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Энергия */}
              <div
                onClick={() => onNavigate('daily_checkin')}
                className="bg-[#111827] border border-white/[0.06] hover:border-white/20 rounded-2xl p-3 flex flex-col justify-between h-[96px] transition-all cursor-pointer group shadow-sm"
              >
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#3DD9C5] shrink-0" />
                    <span className="truncate">Энергия</span>
                  </div>
                  <span className="inline-block text-[10px] font-bold text-[#3DD9C5] bg-[#3DD9C5]/10 border border-[#3DD9C5]/20 px-1.5 py-0.5 rounded-md w-fit">
                    {energyStatus}
                  </span>
                </div>
                <div className="text-xl font-black text-white tracking-tight">
                  {energyVal}
                </div>
              </div>

              {/* Card 2: Сон */}
              <div
                onClick={() => onNavigate('mental_diary')}
                className="bg-[#111827] border border-white/[0.06] hover:border-white/20 rounded-2xl p-3 flex flex-col justify-between h-[96px] transition-all cursor-pointer group shadow-sm"
              >
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                    <span className="truncate">Сон</span>
                  </div>
                  <span className="inline-block text-[10px] font-bold text-white/70 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md w-fit">
                    {sleepStatus}
                  </span>
                </div>
                <div className="text-lg font-black text-white tracking-tight">
                  {sleepVal}
                </div>
              </div>

              {/* Card 3: Давление */}
              <div
                onClick={() => onNavigate('pressure_diary')}
                className="bg-[#111827] border border-white/[0.06] hover:border-white/20 rounded-2xl p-3 flex flex-col justify-between h-[96px] transition-all cursor-pointer group shadow-sm"
              >
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">Давление</span>
                  </div>
                  <span className="inline-block text-[10px] font-bold text-[#3DD9C5] bg-[#3DD9C5]/10 border border-[#3DD9C5]/20 px-1.5 py-0.5 rounded-md w-fit">
                    {pressureStatus}
                  </span>
                </div>
                <div className="text-lg font-black text-white tracking-tight">
                  {pressureVal}
                </div>
              </div>

              {/* Card 4: Настроение */}
              <div
                onClick={() => onNavigate('mental_diary')}
                className="bg-[#111827] border border-white/[0.06] hover:border-white/20 rounded-2xl p-3 flex flex-col justify-between h-[96px] transition-all cursor-pointer group shadow-sm"
              >
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">Настроение</span>
                  </div>
                  <span className="inline-block text-[10px] font-bold text-[#3DD9C5] bg-[#3DD9C5]/10 border border-[#3DD9C5]/20 px-1.5 py-0.5 rounded-md w-fit">
                    {moodStatus}
                  </span>
                </div>
                <div className="text-lg font-black text-white tracking-tight truncate">
                  {moodVal}
                </div>
              </div>
            </div>

            {/* AIDA INSIGHT BLOCK */}
            <div className="bg-[#111827] border border-white/[0.06] rounded-2xl p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between shadow-lg">
              <div className="flex items-start gap-3.5">
                {/* Aida Avatar */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#3DD9C5] text-[#090B10] flex items-center justify-center font-black shrink-0 shadow-md">
                  <Sparkles className="w-5 h-5 text-[#090B10]" />
                </div>

                {/* Aida Text Content */}
                <div className="flex-1 space-y-2">
                  <div className="text-xs sm:text-sm font-bold text-white leading-tight">
                    {insights.title}
                  </div>
                  <ul className="text-xs sm:text-sm text-white/70 space-y-1.5 font-medium">
                    {insights.bullets.map((b, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#8B5CF6] shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => onNavigate('ai_chat')}
                className="w-full py-2.5 bg-white/5 hover:bg-[#8B5CF6]/15 border border-white/10 hover:border-[#8B5CF6]/30 text-xs sm:text-sm font-bold text-white hover:text-[#8B5CF6] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
              >
                <span>Задать вопрос Аиде в чате</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* SECOND ROW (GRID ON DESKTOP): MEDICATIONS & EXTENDED MEDICAL SECTIONS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-start pt-1">
          
          {/* LEFT COLUMN: MEDICATIONS BLOCK */}
          <div className="md:col-span-5 lg:col-span-5 bg-[#111827] border border-white/[0.06] rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Pill className="w-4 h-4 text-[#8B5CF6]" />
                Приём препаратов
              </span>
              <span className="text-[10px] sm:text-xs text-white/50 font-medium">Сегодня</span>
            </div>

            <div className="space-y-2.5">
              {activeMedReminders.length > 0 ? (
                activeMedReminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 bg-[#090B10] border border-white/[0.04] rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">💊</span>
                      <div>
                        <div className="text-xs font-bold text-white">{r.title}</div>
                        <div className="text-[10px] text-white/50">{r.time} • {r.dosage || 'По графику'}</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-[#3DD9C5]/10 border border-[#3DD9C5]/30 text-[#3DD9C5] text-xs font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {r.time}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-[#090B10] border border-white/[0.04] rounded-xl text-center space-y-2">
                  <p className="text-xs text-white/50">Напоминания о приёме препаратов пока не настроены.</p>
                  <button
                    type="button"
                    onClick={() => onNavigate('reminders')}
                    className="text-xs font-bold text-[#8B5CF6] hover:underline cursor-pointer"
                  >
                    + Настроить напоминания
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: COLLAPSIBLE EXTENDED HEALTH SECTIONS */}
          <div className="md:col-span-7 lg:col-span-7 space-y-3">
            <button
              type="button"
              onClick={() => setIsAttentionOpen(!isAttentionOpen)}
              className="w-full py-3 bg-[#111827] border border-white/[0.06] rounded-xl text-xs sm:text-sm font-bold text-white/80 hover:text-white flex items-center justify-between px-4 cursor-pointer transition-colors shadow-md"
            >
              <span>Расширенный медицинский анализ и рекомендации</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isAttentionOpen ? 'rotate-180' : ''}`} />
            </button>

            {isAttentionOpen && (
              <div className="space-y-3.5 animate-fadeIn">
                {/* State Connections Section */}
                <StateConnectionsSection
                  connections={healthProfile.stateConnections}
                  onOpenDoctorReport={onOpenDoctorReport}
                />

                {/* Recommended Next Tests */}
                <RecommendedNextTestsSection
                  recommendedTests={healthProfile.recommendedNextTests}
                  onNavigateToLab={() => {
                    onNavigate('dashboard');
                    setActiveTab('lab');
                  }}
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
