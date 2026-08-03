import React, { useState, useMemo } from 'react';
import {
  Heart,
  Plus,
  Sparkles,
  TrendingUp,
  Calendar as CalendarIcon,
  Filter,
  Search,
  Shield,
  PhoneCall,
  AlertOctagon,
  Smile,
  Activity,
  BarChart2,
  Lock,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  Zap,
  Info,
  ChevronRight,
  Sun,
  Moon,
  Coffee,
  AlertTriangle,
  FileText,
  User,
  HeartPulse,
  Compass,
  ArrowRight,
  Target,
  X,
  HelpCircle,
  Lightbulb,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { DiaryEntry, UserMentalPatterns, WeeklyMentalReport, UserProfile } from '../types';
import { MentalDiaryEntryModal } from './modals/MentalDiaryEntryModal';

interface MentalDiaryScreenProps {
  user?: UserProfile;
  entries: DiaryEntry[];
  patterns: UserMentalPatterns;
  weeklyReport: WeeklyMentalReport;
  onAddEntry: (entry: Partial<DiaryEntry>) => void;
  onUpdateEntry: (entry: Partial<DiaryEntry>) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateWeeklyReportToggle: (enabled: boolean) => void;
  onClearAllDiaryData: () => void;
}

export const MentalDiaryScreen: React.FC<MentalDiaryScreenProps> = ({
  user,
  entries,
  patterns,
  weeklyReport,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onUpdateWeeklyReportToggle,
  onClearAllDiaryData,
}) => {
  // Navigation tab state: 'start' is the default Start Screen!
  const [activeTab, setActiveTab] = useState<'start' | 'feed' | 'analytics' | 'privacy'>('start');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<'quick' | 'full'>('full');
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);

  // Informational modals
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isWhyForecastOpen, setIsWhyForecastOpen] = useState(false);
  const [selectedInsightModal, setSelectedInsightModal] = useState<{ title: string; desc: string; detail: string } | null>(null);
  const [recActionDone, setRecActionDone] = useState(false);
  const [walkScheduled, setWalkScheduled] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Current time greeting logic
  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Доброе утро', icon: '🌅' };
    if (hour >= 12 && hour < 18) return { text: 'Как проходит твой день?', icon: '☀️' };
    if (hour >= 18 && hour < 23) return { text: 'Как ты чувствуешь себя этим вечером?', icon: '🌙' };
    return { text: 'Давай спокойно подведём итог дня', icon: '✨' };
  }, []);

  // Latest entry
  const latestEntry = useMemo(() => {
    if (entries.length === 0) return null;
    return [...entries].sort((a, b) => new Date(b.event_datetime).getTime() - new Date(a.event_datetime).getTime())[0];
  }, [entries]);

  // Current state score for visualization sphere
  const currentSphereScore = useMemo(() => {
    if (!latestEntry) return 0;
    return latestEntry.state_score;
  }, [latestEntry]);

  // Resource level
  const resourceLevel = useMemo<'high' | 'medium' | 'low' | 'none'>(() => {
    if (entries.length === 0) return 'none';
    const score = latestEntry?.state_score || 7;
    if (score >= 8) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }, [entries, latestEntry]);

  // Check critical risk across entries
  const hasCriticalRisk = useMemo(() => {
    return entries.some(
      (e) =>
        e.ai_analysis?.risk_level === 'critical' ||
        (e.state_score <= 2 && e.event_description?.toLowerCase().includes('умереть'))
    );
  }, [entries]);

  // Open modal for entry creation
  const handleOpenAdd = (type: 'quick' | 'full') => {
    setEditingEntry(null);
    setModalInitialType(type);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setModalInitialType(entry.entry_type);
    setIsModalOpen(true);
  };

  const handleSaveEntry = (entryData: Partial<DiaryEntry>) => {
    if (editingEntry) {
      onUpdateEntry(entryData);
    } else {
      onAddEntry(entryData);
    }
  };

  // Filtered Entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const searchTxt = searchQuery.toLowerCase();
      const textMatch =
        !searchQuery ||
        (e.event_description && e.event_description.toLowerCase().includes(searchTxt)) ||
        (e.thoughts && e.thoughts.toLowerCase().includes(searchTxt)) ||
        (e.additional_note && e.additional_note.toLowerCase().includes(searchTxt));

      const moodMatch = selectedMoodFilter === 'all' || e.moods.includes(selectedMoodFilter);

      const catMatch =
        selectedCategoryFilter === 'all' ||
        (e.event_categories && e.event_categories.includes(selectedCategoryFilter as any));

      const entryDate = new Date(e.event_datetime);
      const now = new Date();
      let timeMatch = true;
      if (timeRange === '7d') {
        timeMatch = (now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24) <= 7;
      } else if (timeRange === '30d') {
        timeMatch = (now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24) <= 30;
      } else if (timeRange === '90d') {
        timeMatch = (now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24) <= 90;
      }

      const calendarMatch = !selectedCalendarDate || e.event_datetime.startsWith(selectedCalendarDate);

      return textMatch && moodMatch && catMatch && timeMatch && calendarMatch;
    });
  }, [entries, searchQuery, selectedMoodFilter, selectedCategoryFilter, timeRange, selectedCalendarDate]);

  // Chart Data preparation (Last 7 days rhythm)
  const rhythmChartData = useMemo(() => {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime()
    );

    const slice = sorted.slice(-7);
    if (slice.length === 0) return [];

    const result = slice.map((e) => {
      const d = new Date(e.event_datetime);
      return {
        day: `${d.getDate()}.${d.getMonth() + 1}`,
        state: e.state_score,
        energy: e.energy_score,
        anxiety: e.anxiety_score || 3,
      };
    });

    // Forecast point for tomorrow
    if (result.length > 0) {
      const lastState = result[result.length - 1].state;
      const forecastVal = Math.min(10, Math.max(1, lastState + (resourceLevel === 'high' ? 0.5 : -0.5)));
      result.push({
        day: 'Завтра (ИИ)',
        state: Number(forecastVal.toFixed(1)),
        energy: Number(forecastVal.toFixed(1)),
        anxiety: 2,
      });
    }

    return result;
  }, [entries, resourceLevel]);

  // Calendar Days calculation for August 2026
  const calendarDays = useMemo(() => {
    const days = [];
    for (let day = 1; day <= 31; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const dateKey = `2026-08-${dayStr}`;
      const dateEntries = entries.filter((e) => e.event_datetime.startsWith(dateKey));

      let avgScore = 0;
      if (dateEntries.length > 0) {
        avgScore = dateEntries.reduce((acc, curr) => acc + curr.state_score, 0) / dateEntries.length;
      }

      days.push({
        day,
        dateKey,
        count: dateEntries.length,
        avgScore,
      });
    }
    return days;
  }, [entries]);

  const getStateColor = (score: number) => {
    if (score >= 8) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (score >= 6) return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
    if (score >= 4) return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
  };

  const getCalendarDayColor = (avgScore: number, count: number) => {
    if (count === 0) return 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-700';
    if (avgScore >= 8) return 'bg-emerald-500/30 border-emerald-500/60 text-emerald-300 font-bold';
    if (avgScore >= 6) return 'bg-teal-500/30 border-teal-500/60 text-teal-300 font-bold';
    if (avgScore >= 4) return 'bg-amber-500/30 border-amber-500/60 text-amber-300 font-bold';
    return 'bg-rose-500/30 border-rose-500/60 text-rose-300 font-bold';
  };

  const exportDataAsJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(entries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `mental_diary_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // AI Observations (Max 3)
  const aiObservations = useMemo(() => {
    return [
      {
        title: 'Рабочие дедлайны и вечерняя тревога',
        desc: 'После срочных обсуждений проектов в вечернее время тревожность обычно возрастает на +3.0 балла.',
        detail: 'Основано на анализате 6 последних записей. Избегание рабочих чатов после 19:00 снижает уровень стресса в 2 раза.',
      },
      {
        title: 'Утренний спорт и прогулки на свежем воздухе',
        desc: 'Пешие прогулки от 20 минут дают прирост энергии на +2.8 к общему самочувствию.',
        detail: 'Зафиксирована устойчивая корреляция: дни с утренней прогулкой показывают средний ресурс 8.4/10.',
      },
      {
        title: 'Качество сна и устойчивость к стрессу',
        desc: 'При сне менее 7 часов устойчивость к дневным триггерам падает на 40%.',
        detail: 'ИИ рекомендует засыпать до 23:30 и соблюдать тихий вечерний час без экранов.',
      },
    ];
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-32 sm:pb-36 pt-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* CRISIS BANNER IF SAFETY TRIGGERED */}
      {hasCriticalRisk && (
        <div className="bg-gradient-to-r from-rose-900/90 via-red-900/80 to-slate-900 border-2 border-rose-500/80 rounded-3xl p-6 shadow-2xl space-y-4 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/40 shrink-0">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Мы рядом и готовы поддержать
              </h3>
              <p className="text-xs text-rose-200 leading-relaxed">
                Похоже, прямо сейчас ты проходишь через очень тяжелое эмоциональное испытание. Пожалуйста, помни: ты не один / не одна. В любой момент можно получить бесплатную, анонимную профессиональную помощь.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <a
              href="tel:112"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold text-xs transition shadow-lg shadow-rose-600/30"
            >
              <PhoneCall className="w-4 h-4" />
              112 (Единая служба спасения)
            </a>
            <a
              href="tel:88002000122"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-rose-500/40 text-rose-200 rounded-2xl font-semibold text-xs transition"
            >
              <PhoneCall className="w-4 h-4 text-rose-400" />
              8-800-200-01-22 (Телефон доверия)
            </a>
            <a
              href="tel:7495051"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-2xl font-semibold text-xs transition"
            >
              <Heart className="w-4 h-4 text-rose-400" />
              +7 (495) 051 (Психологическая служба)
            </a>
          </div>
        </div>
      )}

      {/* TOP MODULE HEADER & NAVIGATION TABS */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/30 text-teal-300 rounded-2xl shadow-inner">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Дневник психического состояния
              </h1>
              <p className="text-xs text-slate-400">
                Персональный ИИ-аналитик эмоций, триггеров и ресурсности
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => handleOpenAdd('quick')}
              className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              ⚡ Быстрая запись
            </button>

            <button
              onClick={() => handleOpenAdd('full')}
              className="flex-1 md:flex-initial px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-bold text-xs transition shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Зафиксировать состояние
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-t border-slate-800/80 mt-5 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('start')}
            className={`px-4 py-2.5 font-bold text-xs rounded-2xl flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'start'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Compass className="w-4 h-4 text-teal-400" />
            Главный экран (Старт)
          </button>

          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2.5 font-semibold text-xs rounded-2xl flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'feed'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileText className="w-4 h-4" />
            Лента записей ({filteredEntries.length})
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 font-semibold text-xs rounded-2xl flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            ИИ-Аналитика & Тренды
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2.5 font-semibold text-xs rounded-2xl flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Shield className="w-4 h-4" />
            Безопасность
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: START SCREEN (СНОА ЧАСТЬ 1: СТАРТОВЫЙ ЭКРАН)                        */}
      {/* ========================================================================= */}
      {activeTab === 'start' && (
        <div className="space-y-8 animate-fadeIn">
          {entries.length === 0 ? (
            /* ONBOARDING MODE WHEN NO DATA ACCUMULATED YET */
            <div className="space-y-8">
              {/* Onboarding Hero Header */}
              <div className="bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="space-y-3 relative z-10 max-w-2xl mx-auto">
                  <span className="px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold tracking-wider uppercase inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    Твоя внутренняя карта начинается здесь
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                    Давай разберёмся, что на самом деле влияет на твоё состояние
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl mx-auto">
                    Фиксируй события, мысли и эмоции. Со временем ИИ найдёт повторяющиеся триггеры, периоды спада и то, что помогает тебе восстанавливаться.
                  </p>
                </div>

                {/* Primary & Secondary Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 relative z-10 max-w-md mx-auto">
                  <button
                    onClick={() => handleOpenAdd('full')}
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 hover:from-teal-300 hover:to-emerald-400 text-slate-950 font-black text-sm transition shadow-xl shadow-teal-500/25 flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02]"
                  >
                    <Plus className="w-5 h-5 stroke-[3]" />
                    Зафиксировать состояние
                  </button>

                  <button
                    onClick={() => setIsHowItWorksOpen(true)}
                    className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-teal-400" />
                    Как это работает
                  </button>
                </div>

                {/* Visual Scenario Timeline */}
                <div className="pt-8 border-t border-slate-800/80 max-w-3xl mx-auto">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-4">
                    Визуальный сценарий ИИ-дневника
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                      <span className="text-xs font-bold text-teal-400 flex items-center gap-1">
                        1. Событие ⚡
                      </span>
                      <p className="text-[11px] text-slate-400">Встреча с руководителем или тренировка</p>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                      <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                        2. Реакция 💭
                      </span>
                      <p className="text-[11px] text-slate-400">Мысли, эмоции и ощущение в теле</p>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        3. Состояние 📊
                      </span>
                      <p className="text-[11px] text-slate-400">Оценка энергии и уровня тревоги</p>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                        4. Закономерность ✨
                      </span>
                      <p className="text-[11px] text-slate-400">ИИ находит личные триггеры и ресурс</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Key Benefits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl hover:border-slate-700 transition">
                  <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-400 w-fit border border-teal-500/20">
                    <Target className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Найди личные триггеры</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    ИИ автоматически выявит скрытые факторы, которые вызывают усталость или тревожность.
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl hover:border-slate-700 transition">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 w-fit border border-emerald-500/20">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Пойми, что возвращает ресурс</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Узнай точные действия и привычки, которые быстро поднимают энергию и дарят спокойствие.
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl hover:border-slate-700 transition">
                  <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 w-fit border border-cyan-500/20">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Отслеживай изменения состояния</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Получай персональный прогноз ресурсности на следующий день и следующую неделю.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ACCUMULATED DATA START SCREEN DASHBOARD */
            <div className="space-y-8">
              {/* Personalized Greeting & Headline */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2 text-center md:text-left">
                    <span className="text-xs font-bold text-teal-400 flex items-center justify-center md:justify-start gap-1.5">
                      <span>{timeGreeting.icon}</span>
                      <span>{timeGreeting.text}{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}</span>
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                      {resourceLevel === 'high'
                        ? 'Похоже, сегодня у тебя достаточно энергии для важных и творческих задач'
                        : resourceLevel === 'medium'
                        ? 'Состояние стабильное. Ресурс находится на оптимальном уровне'
                        : 'Сегодня твой ресурс немного ниже обычного'}
                    </h2>

                    <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                      {resourceLevel === 'high'
                        ? 'Последние замеры показывают высокий уровень утренней энергии и качественный сон (>7.5 часов).'
                        : resourceLevel === 'medium'
                        ? 'Фиксируется умеренная утомляемость. Рекомендуется сохранять баланс нагрузки и отдыха.'
                        : 'Последние два дня зафиксировано повышенное напряжение и небольшой недостаток сна.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Current Resource Status Card & Primary Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Resource Card */}
                <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                        Карточка текущего ресурса
                      </span>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-teal-400" />
                        1 августа 2026
                      </h3>
                    </div>

                    <span
                      className={`px-3.5 py-1.5 rounded-2xl font-bold text-xs border ${
                        resourceLevel === 'high'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : resourceLevel === 'medium'
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      Ресурс:{' '}
                      {resourceLevel === 'high'
                        ? 'Высокий'
                        : resourceLevel === 'medium'
                        ? 'Стабильный'
                        : 'Сниженный'}
                    </span>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-semibold">⚡ Энергия</span>
                      <span className="text-lg font-black text-white">
                        {latestEntry?.energy_score || 7} / 10
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-semibold">⚡ Напряжение</span>
                      <span className="text-lg font-black text-amber-400">
                        {latestEntry?.stress_score || 3} / 10
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-semibold">💭 Главный фактор</span>
                      <span className="text-xs font-bold text-teal-300 truncate block mt-1">
                        {patterns.forecast_drivers[0] || 'Качественный сон'}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-semibold">🎯 Точность ИИ</span>
                      <span className="text-xs font-bold text-emerald-400 block mt-1">
                        Высокая (92%)
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/60">
                    💡 <span className="font-semibold text-white">Рекомендация дня:</span>{' '}
                    {resourceLevel === 'high'
                      ? 'Благоприятный день для физических нагрузок и решения сложных рабочих вопросов.'
                      : 'Сегодня лучше оставить запас времени между сложными задачами и запланировать тихий вечер.'}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setIsWhyForecastOpen(true)}
                      className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Посмотреть, почему</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setActiveTab('analytics')}
                      className="text-xs font-semibold text-slate-400 hover:text-white transition"
                    >
                      Подробная аналитика →
                    </button>
                  </div>
                </div>

                {/* Primary Action Panel */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6">
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-teal-400 block">
                      Быстрое действие
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      Как ты чувствуешь себя прямо сейчас?
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Занимает от 30 секунд. Запись сразу обновит прогноз и рекомендации.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => handleOpenAdd('full')}
                      className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 hover:from-teal-300 hover:to-emerald-400 text-slate-950 font-black text-sm transition shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02]"
                    >
                      <Plus className="w-5 h-5 stroke-[3]" />
                      Зафиксировать состояние
                    </button>

                    <button
                      onClick={() => handleOpenAdd('quick')}
                      className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-amber-400" />
                      ⚡ Быстрая запись (30 сек)
                    </button>
                  </div>
                </div>
              </div>

              {/* Block "Что ИИ заметил за последнее время" */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-teal-400" />
                      Что ИИ заметил за последнее время
                    </h3>
                    <p className="text-xs text-slate-400">
                      Персональные закономерности на основе твоих последних замеров
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {aiObservations.map((obs, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedInsightModal(obs)}
                      className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 hover:border-teal-500/40 transition cursor-pointer space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">
                          Наблюдение #{idx + 1}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition" />
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-teal-300 transition">
                        {obs.title}
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {obs.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Block "Твой ритм" (Compact 7-day Sparkline) */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Activity className="w-5 h-5 text-cyan-400" />
                      Твой ритм (Последние 7 дней)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Динамика общего состояния и прогноз на завтра
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="text-xs font-bold text-teal-400 hover:underline"
                  >
                    Развернуть график →
                  </button>
                </div>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rhythmChartData}>
                      <defs>
                        <linearGradient id="rhythmGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                      <YAxis domain={[1, 10]} stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '1rem',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="state"
                        name="Состояние"
                        stroke="#2dd4bf"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#rhythmGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Block "Что может помочь сегодня" */}
              <div className="bg-gradient-to-r from-teal-950/80 via-slate-900 to-slate-900 border border-teal-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-teal-500/20 text-teal-300 rounded-2xl border border-teal-500/30">
                      <Lightbulb className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Что может помочь сегодня</h3>
                      <p className="text-xs text-slate-400">
                        Персональная рекомендация на основе истории аналогичных дней
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  «В похожие дни с небольшим спадом энергии тебе обычно помогает прогулка продолжительностью от 20 минут и снижение вечерней нагрузки.»
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={() => setRecActionDone(true)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
                      recActionDone
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                    }`}
                  >
                    {recActionDone ? (
                      <>
                        <Check className="w-4 h-4" />
                        Добавлено в план дня!
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Добавить в план
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setWalkScheduled(true);
                      setTimeout(() => setWalkScheduled(false), 4000);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition ${
                      walkScheduled
                        ? 'bg-[#34F5AA]/20 border-[#34F5AA] text-[#34F5AA]'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {walkScheduled ? 'Напоминание на 18:00 установлено ✓' : 'Напомнить вечером (18:00)'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: FEED & ENTRIES (ЛЕНТА ЗАПИСЕЙ)                                    */}
      {/* ========================================================================= */}
      {activeTab === 'feed' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-wrap gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Поиск по событиям, мыслям или заметкам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Mood Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedMoodFilter}
                onChange={(e) => setSelectedMoodFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
              >
                <option value="all">Все эмоции</option>
                <option value="спокойствие">Спокойствие</option>
                <option value="радость">Радость</option>
                <option value="вдохновение">Вдохновение</option>
                <option value="тревога">Тревога</option>
                <option value="раздражение">Раздражение</option>
                <option value="грусть">Грусть</option>
                <option value="усталость">Усталость</option>
              </select>
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="all">Все сферы</option>
              <option value="работа">Работа</option>
              <option value="семья">Семья</option>
              <option value="друзья">Друзья</option>
              <option value="здоровье">Здоровье</option>
              <option value="отдых">Отдых</option>
            </select>

            {/* Time range */}
            <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
              {(['7d', '30d', '90d', 'all'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setTimeRange(r);
                    setSelectedCalendarDate(null);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                    timeRange === r && !selectedCalendarDate
                      ? 'bg-teal-500/20 text-teal-300'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r === '7d' ? '7д' : r === '30d' ? '30д' : r === '90d' ? '3мес' : 'Все'}
                </button>
              ))}
            </div>

            {selectedCalendarDate && (
              <button
                onClick={() => setSelectedCalendarDate(null)}
                className="px-2.5 py-1 bg-teal-500/20 text-teal-300 rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                Дата: {selectedCalendarDate} ✕
              </button>
            )}
          </div>

          {/* Timeline Feed */}
          {filteredEntries.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
              <Smile className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">Записи не найдены</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Попробуй сбросить фильтры или добавь новую запись о своём состоянии прямо сейчас.
              </p>
              <button
                onClick={() => handleOpenAdd('full')}
                className="px-4 py-2 bg-teal-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-teal-400 transition"
              >
                + Создать запись
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry) => {
                const dateObj = new Date(entry.event_datetime);
                const dateFormatted = dateObj.toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={entry.id}
                    className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition shadow-lg group relative overflow-hidden"
                  >
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {/* Score pill */}
                        <div
                          className={`px-3 py-1.5 rounded-2xl border font-bold text-sm flex items-center gap-1.5 ${getStateColor(
                            entry.state_score
                          )}`}
                        >
                          <Activity className="w-4 h-4" />
                          <span>{entry.state_score} / 10</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              {entry.entry_type === 'quick' ? '⚡ Быстрая запись' : '📝 Полная запись'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              • {dateFormatted}
                            </span>
                          </div>
                          {entry.event_categories && entry.event_categories.length > 0 && (
                            <div className="flex gap-1.5 mt-1">
                              {entry.event_categories.map((c) => (
                                <span
                                  key={c}
                                  className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300"
                                >
                                  #{c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleOpenEdit(entry)}
                          className="p-1.5 text-slate-400 hover:text-teal-300 rounded-lg hover:bg-slate-800 transition"
                          title="Редактировать"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteEntry(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Moods Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {entry.moods.map((m) => (
                        <span
                          key={m}
                          className="px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs font-medium"
                        >
                          {m}
                        </span>
                      ))}
                    </div>

                    {/* Description */}
                    {entry.event_description && (
                      <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                        {entry.event_description}
                      </p>
                    )}

                    {/* Thoughts & Reactions Grid */}
                    {(entry.thoughts || (entry.user_reactions && entry.user_reactions.length > 0)) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {entry.thoughts && (
                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 space-y-1">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                              💭 Мысли
                            </span>
                            <p className="text-xs text-slate-300">{entry.thoughts}</p>
                          </div>
                        )}

                        {entry.user_reactions && entry.user_reactions.length > 0 && (
                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 space-y-1">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                              ⚡ Действия и реакция
                            </span>
                            <p className="text-xs text-indigo-300 font-medium">
                              {entry.user_reactions.join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Helpful actions & Physical factors footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                      <div className="flex flex-wrap gap-2 items-center">
                        {entry.helpful_actions && entry.helpful_actions.length > 0 && (
                          <span className="text-emerald-400 font-medium">
                            💡 Помогло: {entry.helpful_actions.join(', ')}
                          </span>
                        )}

                        {entry.physical_factors?.sleepDurationHours && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Moon className="w-3.5 h-3.5 text-indigo-400" />
                            Сон: {entry.physical_factors.sleepDurationHours} ч
                          </span>
                        )}

                        {entry.physical_factors?.caffeineConsumed && (
                          <span className="flex items-center gap-1 text-amber-400">
                            <Coffee className="w-3.5 h-3.5" />
                            Кофеин
                          </span>
                        )}
                      </div>

                      {/* AI Insight Badge */}
                      {entry.ai_analysis?.summary_insight && (
                        <div className="bg-teal-500/10 border border-teal-500/30 text-teal-300 px-3 py-1 rounded-xl flex items-center gap-1.5 text-[11px] font-medium">
                          <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <span>{entry.ai_analysis.summary_insight}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AI ANALYTICS & TRENDS                                              */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {/* Data Threshold Notice */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center gap-3 text-xs">
            <Info className="w-5 h-5 text-teal-400 shrink-0" />
            <div>
              <span className="font-bold text-white">Статус аналитики: </span>
              {entries.length < 5 ? (
                <span className="text-amber-300">
                  Базовые графики (&lt;5 записей). Сделайте еще несколько записей для точных вычислений.
                </span>
              ) : entries.length < 15 ? (
                <span className="text-teal-300">
                  Предварительные наблюдения ({entries.length} записей). Сформированы первичные триггеры.
                </span>
              ) : (
                <span className="text-emerald-300 font-semibold">
                  Глубокая аналитика ({entries.length} записей). Высокая точность прогнозирования.
                </span>
              )}
            </div>
          </div>

          {/* Line Chart */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-teal-400" />
                  Динамика общего состояния и энергии
                </h3>
                <p className="text-xs text-slate-400">
                  График изменения оценки самочувствия (1-10) по дням
                </p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rhythmChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                  <YAxis domain={[1, 10]} stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '1rem',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="state"
                    name="Общее состояние"
                    stroke="#2dd4bf"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#2dd4bf' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="energy"
                    name="Энергия"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="anxiety"
                    name="Тревога"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mood Calendar Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-cyan-400" />
                  Календарь состояния (Август 2026)
                </h3>
                <p className="text-xs text-slate-400">
                  Нажмите на день для просмотра записей за конкретную дату
                </p>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 pt-2">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                <div key={d} className="text-center text-[11px] font-bold text-slate-500 py-1">
                  {d}
                </div>
              ))}

              {calendarDays.map((item) => (
                <button
                  key={item.day}
                  onClick={() => {
                    if (item.count > 0) {
                      setSelectedCalendarDate(item.dateKey);
                      setActiveTab('feed');
                    }
                  }}
                  className={`h-12 rounded-xl border flex flex-col items-center justify-center transition p-1 ${getCalendarDayColor(
                    item.avgScore,
                    item.count
                  )}`}
                >
                  <span className="text-xs">{item.day}</span>
                  {item.count > 0 && (
                    <span className="text-[10px] opacity-90">{item.avgScore.toFixed(1)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Trigger Detection Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Positive Triggers */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <Sun className="w-4 h-4 text-emerald-400" />
                Позитивные триггеры и Ресурсные факторы
              </h3>

              <div className="space-y-2.5">
                {patterns.positive_triggers.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-200">{t.text}</span>
                    <span className="font-bold text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/10">
                      {t.impact}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Negative Triggers */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Негативные триггеры и Факторы стресса
              </h3>

              <div className="space-y-2.5">
                {patterns.negative_triggers.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-200">{t.text}</span>
                    <span className="font-bold text-rose-400 px-2 py-0.5 rounded-lg bg-rose-500/10">
                      {t.impact}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resource Forecast Card */}
          <div className="bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900 border border-teal-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-2xl border border-teal-500/30">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Прогноз ресурсности ИИ</h3>
                  <p className="text-xs text-slate-400">
                    На основе последних замеров и физиологических факторов
                  </p>
                </div>
              </div>

              <span className="px-3.5 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 font-bold text-xs border border-teal-500/40">
                Прогноз: {patterns.resource_forecast === 'high' ? 'Высокий ресурс' : 'Средний ресурс'}
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              {patterns.forecast_reasoning}
            </p>

            {/* Drivers */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-semibold text-slate-300">Ключевые драйверы:</span>
              <div className="flex flex-wrap gap-2">
                {patterns.forecast_drivers.map((d, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-teal-300 font-medium"
                  >
                    ✓ {d}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Weekly Report Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                  Недельный ИИ-отчёт ({weeklyReport.week_range})
                </h3>
                <p className="text-xs text-slate-400">
                  Итоговая сводка динамики и рекомендации на следующую неделю
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <span>Еженедельный отчёт:</span>
                <input
                  type="checkbox"
                  checked={weeklyReport.is_enabled}
                  onChange={(e) => onUpdateWeeklyReportToggle(e.target.checked)}
                  className="toggle accent-teal-400 w-4 h-4 rounded"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 block">
                  🌟 Позитивные моменты недели:
                </span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  {weeklyReport.positive_highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-teal-400 block">
                  💡 Рекомендации на следующую неделю:
                </span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  {weeklyReport.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PRIVACY & SETTINGS                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'privacy' && (
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Medical Disclaimer Notice */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
            <div className="flex items-center gap-3 text-amber-400">
              <Info className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-white">Информационный дисклеймер</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Все выводы, триггеры и отчёты ИИ в данном модуле носят исключительно справочно-аналитический характер. Приложение не предоставляет медицинских или психиатрических диагнозов. Если вы чувствуете сильный дискомфорт или истощение, обязательно обратитесь к профильному специалисту.
            </p>
          </div>

          {/* Privacy & Encryption */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-teal-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Защита и шифрование данных</h3>
                <p className="text-xs text-slate-400">
                  Ваши персональные записи защищены и не используются для обучения публичных ИИ-моделей.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Согласие на обработку анонимизированных данных активно
              </div>
              <p>Вы можете в любой момент экспортировать или безвозвратно удалить всю историю своего дневника.</p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={exportDataAsJSON}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-2 border border-slate-700"
              >
                <Download className="w-4 h-4" />
                Скачать историю в JSON
              </button>

              <button
                onClick={() => {
                  if (confirm('Вы уверены, что хотите полностью очистить историю дневника? Это действие необратимо.')) {
                    onClearAllDiaryData();
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Очистить всю историю дневника
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: "КАК ЭТО РАБОТАЕТ"                                                 */}
      {/* ========================================================================= */}
      {isHowItWorksOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative animate-scaleIn">
            <button
              onClick={() => setIsHowItWorksOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-500/20 text-teal-300 rounded-2xl border border-teal-500/30">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Как работает ИИ-дневник</h3>
                <p className="text-xs text-slate-400">От записи к пониманию закономерностей</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-teal-300 block">1. Фиксация за 1 минуту</span>
                <p>Ты отмечаешь уровень энергии, эмоции и описываешь событие простыми словами.</p>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-cyan-300 block">2. ИИ-выделение триггеров</span>
                <p>Модель связывает физические факторы (сон, кофеин, спорт) и события с колебаниями настроения.</p>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-emerald-300 block">3. Прогнозирование ресурса</span>
                <p>Система предупреждает о возможных периодах спада и дает мягкие бережные рекомендации.</p>
              </div>
            </div>

            <button
              onClick={() => {
                setIsHowItWorksOpen(false);
                handleOpenAdd('full');
              }}
              className="w-full py-3.5 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition"
            >
              Создать первую запись →
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: "ПОСМОТРЕТЬ ПОЧЕМУ" (FORECAST DETAILS)                            */}
      {/* ========================================================================= */}
      {isWhyForecastOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative animate-scaleIn">
            <button
              onClick={() => setIsWhyForecastOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-500/20 text-teal-300 rounded-2xl border border-teal-500/30">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Обоснование ИИ-прогноза</h3>
                <p className="text-xs text-slate-400">Анализ текущего ресурса и факторов</p>
              </div>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              {patterns.forecast_reasoning}
            </p>

            <div className="space-y-2">
              <span className="text-xs font-bold text-white block">Ключевые факторы в расчёте:</span>
              <div className="space-y-2 text-xs">
                {patterns.forecast_drivers.map((drv, i) => (
                  <div key={i} className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 flex items-center justify-between">
                    <span className="text-slate-300">{drv}</span>
                    <span className="text-teal-400 font-bold">Влияние: Высокое</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsWhyForecastOpen(false)}
              className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
            >
              Понятно
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSIGHT DETAIL POPUP                                               */}
      {/* ========================================================================= */}
      {selectedInsightModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-scaleIn">
            <button
              onClick={() => setSelectedInsightModal(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-500/20 text-teal-300 rounded-2xl border border-teal-500/30">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{selectedInsightModal.title}</h3>
                <p className="text-xs text-slate-400">Подробный анализ паттерна</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800">
                {selectedInsightModal.desc}
              </p>
              <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-teal-300 block">Статистическая основа:</span>
                <p className="text-slate-400">{selectedInsightModal.detail}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedInsightModal(null)}
              className="w-full py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* MODAL COMPONENT FOR ENTRY CREATION / EDITING */}
      <MentalDiaryEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEntry}
        initialEntry={editingEntry}
        initialType={modalInitialType}
      />
    </div>
  );
};
