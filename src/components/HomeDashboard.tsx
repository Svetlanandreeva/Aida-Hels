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

  // Medication interactive check state
  const [medsState, setMedsState] = useState<{ [key: string]: boolean }>({
    'omega-3': true,
    'magnesium': false,
  });

  const toggleMed = (medKey: string) => {
    setMedsState((prev) => ({
      ...prev,
      [medKey]: !prev[medKey],
    }));
  };

  const healthProfile = calculateHealthProfile(user, documents, dailyLogs, pressureLogs);

  // Active ring metrics navigation tooltip state
  const [hoveredRingItem, setHoveredRingItem] = useState<string | null>(null);

  // Formatted date for AI analysis
  const analysisDateFormatted = React.useMemo(() => {
    const latestDoc = documents[0]?.date;
    if (latestDoc) {
      return `${latestDoc} (по документам)`;
    }
    return '7 августа 2026, 14:30';
  }, [documents]);

  return (
    <div className="w-full bg-[#090B10] min-h-screen py-4 px-3 sm:px-4 text-white font-sans antialiased">
      {/* IPHONE 16 PRO SCREEN CONTAINER (393px width feel, max 430px centered) */}
      <div className="max-w-[393px] mx-auto space-y-4">

        {/* TOP DASHBOARD UTILITY HEADER (Settings & Refresh Analysis) */}
        <div className="flex items-center justify-between pb-1 px-0.5 gap-2">
          <div className="flex items-center gap-1.5 bg-[#111827] border border-white/[0.08] px-2.5 py-1.5 rounded-full shadow-sm shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#3DD9C5] animate-pulse shrink-0" />
            <span className="text-[11px] font-bold text-white/90 tracking-wide uppercase flex items-center gap-1 whitespace-nowrap">
              ИИ-Мониторинг
              <Sparkles className="w-3 h-3 text-[#8B5CF6] shrink-0" />
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* REFRESH AI ANALYSIS BUTTON */}
            <button
              onClick={() => fetchHealthAnalysis?.()}
              disabled={isLoadingAnalysis}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#111827] border border-[#3DD9C5]/30 hover:border-[#3DD9C5] text-[#3DD9C5] hover:bg-[#3DD9C5]/10 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
              title="Обновить ИИ-анализ"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isLoadingAnalysis ? 'animate-spin' : ''}`} />
              <span>{isLoadingAnalysis ? 'Обновление...' : 'Обновить'}</span>
            </button>

            {/* SETTINGS BUTTON */}
            <button
              onClick={() => onNavigate('settings')}
              className="p-1.5 rounded-xl bg-[#111827] border border-white/[0.08] hover:border-white/25 text-white/80 hover:text-white transition-all cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
              title="Настройки"
            >
              <Settings className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>

        {/* 1. HERO BLOCK: BIG INTERACTIVE CIRCLE (260px) WITH ANIMATED SATELLITE MENU */}
        <div className="relative flex flex-col items-center justify-center pt-2 pb-1">
          {/* Active Hover / Focus Tooltip indicator with AnimatePresence */}
          <div className="h-6 flex items-center justify-center mb-1">
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
          <div className="relative w-[260px] h-[260px] flex items-center justify-center">
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

            {/* INNER CENTER CONTENT (Organically spaced inside the circle boundary) */}
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

              {/* Organism Age vs Passport Age (Compact & perfectly fitting inside the lower circle curve) */}
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

            {/* 5 ANIMATED SATELLITE ICON BUTTONS (Placed directly ON the circle ring line) */}

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
        </div>

        {/* AI ANALYSIS DATE BADGE */}
        <div className="flex items-center justify-center gap-2 py-1.5 px-3.5 bg-[#111827]/90 border border-white/10 rounded-full w-fit mx-auto shadow-md">
          <Clock className="w-3.5 h-3.5 text-[#3DD9C5] animate-pulse shrink-0" />
          <span className="text-[11px] font-medium text-white/70">
            Дата анализа: <span className="text-white font-bold">{analysisDateFormatted}</span>
          </span>
          <Sparkles className="w-3 h-3 text-[#8B5CF6] shrink-0" />
        </div>

        {/* 2. UNDER THE CIRCLE: 4 COMPACT CARDS (2x2 GRID) */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Card 1: Энергия */}
          <div
            onClick={() => onNavigate('daily_checkin')}
            className="bg-[#111827] border border-white/[0.06] hover:border-white/20 rounded-2xl p-3 flex flex-col justify-between h-[96px] transition-all cursor-pointer group"
          >
            <div className="space-y-1">
              <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#3DD9C5] shrink-0" />
                <span className="truncate">Энергия</span>
              </div>
              <span className="inline-block text-[10px] font-bold text-[#3DD9C5] bg-[#3DD9C5]/10 border border-[#3DD9C5]/20 px-1.5 py-0.5 rounded-md w-fit">
                Хорошая
              </span>
            </div>
            <div className="text-xl font-black text-white tracking-tight">
              70%
            </div>
          </div>

          {/* Card 2: Сон */}
          <div
            onClick={() => onNavigate('mental_diary')}
            className="bg-[#111827] border border-white/[0.06] hover:border-white/20 rounded-2xl p-3 flex flex-col justify-between h-[96px] transition-all cursor-pointer group"
          >
            <div className="space-y-1">
              <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                <span className="truncate">Сон</span>
              </div>
              <span className="inline-block text-[10px] font-bold text-white/70 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md w-fit">
                Норма
              </span>
            </div>
            <div className="text-lg font-black text-white tracking-tight">
              7 ч 32 мин
            </div>
          </div>

          {/* Card 3: Давление */}
          <div
            onClick={() => onNavigate('pressure_diary')}
            className="bg-[#111827] border border-white/[0.06] hover:border-white/20 rounded-2xl p-3 flex flex-col justify-between h-[96px] transition-all cursor-pointer group"
          >
            <div className="space-y-1">
              <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">Давление</span>
              </div>
              <span className="inline-block text-[10px] font-bold text-[#3DD9C5] bg-[#3DD9C5]/10 border border-[#3DD9C5]/20 px-1.5 py-0.5 rounded-md w-fit">
                Норма
              </span>
            </div>
            <div className="text-lg font-black text-white tracking-tight">
              118/74
            </div>
          </div>

          {/* Card 4: Настроение */}
          <div
            onClick={() => onNavigate('mental_diary')}
            className="bg-[#111827] border border-white/[0.06] hover:border-white/20 rounded-2xl p-3 flex flex-col justify-between h-[96px] transition-all cursor-pointer group"
          >
            <div className="space-y-1">
              <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                <Smile className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">Настроение</span>
              </div>
              <span className="inline-block text-[10px] font-bold text-[#3DD9C5] bg-[#3DD9C5]/10 border border-[#3DD9C5]/20 px-1.5 py-0.5 rounded-md w-fit">
                Хорошее
              </span>
            </div>
            <div className="text-lg font-black text-white tracking-tight">
              Спокойное
            </div>
          </div>
        </div>

        {/* 3. AIDA INSIGHT BLOCK (БЛОК АИДЫ) */}
        <div className="bg-[#111827] border border-white/[0.06] rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            {/* Aida Avatar */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#3DD9C5] text-[#090B10] flex items-center justify-center font-black shrink-0 shadow-md">
              <Sparkles className="w-5 h-5 text-[#090B10]" />
            </div>

            {/* Aida Text Content */}
            <div className="flex-1 space-y-1.5">
              <div className="text-xs font-bold text-white leading-tight">
                Сегодня есть два момента, на которые стоит обратить внимание:
              </div>
              <ul className="text-xs text-white/70 space-y-1 font-medium">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                  <span>Сон уменьшился</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3DD9C5]" />
                  <span>Давление в норме</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={() => onNavigate('ai_chat')}
            className="w-full py-2.5 bg-white/5 hover:bg-[#8B5CF6]/15 border border-white/10 hover:border-[#8B5CF6]/30 text-xs font-bold text-white hover:text-[#8B5CF6] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Подробнее</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 4. MEDICATIONS BLOCK (ЛЕКАРСТВА - МАКСИМУМ 2 ПРЕПАРАТА) */}
        <div className="bg-[#111827] border border-white/[0.06] rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#8B5CF6]" />
              Приём препаратов
            </span>
            <span className="text-[10px] text-white/50 font-medium">Сегодня</span>
          </div>

          <div className="space-y-2">
            {/* Med 1: Омега-3 */}
            <div
              onClick={() => toggleMed('omega-3')}
              className="flex items-center justify-between p-2.5 bg-[#090B10] border border-white/[0.04] rounded-xl cursor-pointer hover:border-white/15 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">💊</span>
                <div>
                  <div className="text-xs font-bold text-white">Омега-3</div>
                  <div className="text-[10px] text-white/50">1 капсула (1000 мг)</div>
                </div>
              </div>
              {medsState['omega-3'] ? (
                <span className="px-2.5 py-1 rounded-lg bg-[#3DD9C5]/10 border border-[#3DD9C5]/30 text-[#3DD9C5] text-xs font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Выпито
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/60 text-xs font-medium">
                  Отметить
                </span>
              )}
            </div>

            {/* Med 2: Магний */}
            <div
              onClick={() => toggleMed('magnesium')}
              className="flex items-center justify-between p-2.5 bg-[#090B10] border border-white/[0.04] rounded-xl cursor-pointer hover:border-white/15 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">💊</span>
                <div>
                  <div className="text-xs font-bold text-white">Магний B6</div>
                  <div className="text-[10px] text-white/50">400 мг перед сном</div>
                </div>
              </div>
              {medsState['magnesium'] ? (
                <span className="px-2.5 py-1 rounded-lg bg-[#3DD9C5]/10 border border-[#3DD9C5]/30 text-[#3DD9C5] text-xs font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Выпито
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-[#8B5CF6] text-xs font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Через 2 часа
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 5. COLLAPSIBLE EXTENDED HEALTH SECTIONS (Deep analysis when needed) */}
        <div className="space-y-3 pt-2">
          {/* Toggle Button for Detailed Medical Sections */}
          <button
            type="button"
            onClick={() => setIsAttentionOpen(!isAttentionOpen)}
            className="w-full py-2.5 bg-[#111827] border border-white/[0.06] rounded-xl text-xs font-bold text-white/70 hover:text-white flex items-center justify-between px-4 cursor-pointer transition-colors"
          >
            <span>Расширенный медицинский анализ</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isAttentionOpen ? 'rotate-180' : ''}`} />
          </button>

          {isAttentionOpen && (
            <div className="space-y-3 animate-fadeIn">
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
  );
}
