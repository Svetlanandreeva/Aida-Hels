import React from 'react';
import {
  Sparkles,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Pill,
  Check,
  Calendar,
  Activity,
  RefreshCw,
  Flame,
  Brain,
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
import { deduplicateMarkers } from '../utils/markerUtils';
import { StateConnectionsSection } from './dashboard/StateConnectionsSection';
import { RecommendedNextTestsSection } from './dashboard/RecommendedNextTestsSection';
import { MaturityStageIndicator } from './dashboard/MaturityStageIndicator';
import { AiMetricsTopSection } from './dashboard/AiMetricsTopSection';
import { MedicationTodaySection } from './dashboard/MedicationTodaySection';

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
  reminders = [],
  setReminders,
  dailyLogs = [],
  diaryEntries = [],
  pressureLogs = [],
  isLoadingAnalysis = false,
  fetchHealthAnalysis,
  aiAnalysis,
}: HomeDashboardProps) {
  const firstName = user?.fullName
    ? user.fullName.split(' ')[0]
    : 'Пользователь';

  const todayStr = new Date().toISOString().slice(0, 10);
  const formattedDate = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Check if any user health data exists
  const hasUserData = Boolean(
    aiAnalysis?.overallScore ||
    documents.length > 0 ||
    dailyLogs.length > 0 ||
    diaryEntries.length > 0 ||
    pressureLogs.length > 0
  );

  const isDemoUser = (u: UserProfile) => u.email === 'anna.ivanova@health.ru' || u.id === 'usr-1' || Boolean((u as any).isDemoUser);

  // Calculate full dynamic profile and inter-system chains
  const healthProfile = calculateHealthProfile(user, documents, dailyLogs, pressureLogs);

  const displayHealthScore = documents.length > 0 || isDemoUser(user)
    ? healthProfile.overallHealthScore
    : (aiAnalysis?.overallScore ? Math.round(aiAnalysis.overallScore * 10) : healthProfile.overallHealthScore);

  const displayStatusLabel = displayHealthScore !== null
    ? (displayHealthScore >= 80 ? 'Отличное' : displayHealthScore >= 60 ? 'В норме' : 'Требует внимания')
    : 'Недостаточно данных';

  const displaySummary = healthProfile.summaryText || aiAnalysis?.summary || 'Состояние стабильное.';

  const handleAddTestReminder = (testName: string) => {
    if (!setReminders) return;
    const newRem: Reminder = {
      id: `rem-test-${Date.now()}`,
      title: `Сдать анализ: ${testName}`,
      time: '09:00',
      category: 'custom',
      frequency: 'once',
      isEnabled: true,
      notes: 'Запланировано из рекомендаций по дообследованию',
    };
    setReminders((prev) => [newRem, ...prev]);
  };

  // 1. "Что требует внимания" (max 3 items)
  const rawDeviations = documents.flatMap((d) => d.deviations || []);
  const allDeviations = deduplicateMarkers(rawDeviations);
  const attentionItems: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'risk' | 'warning';
    action: () => void;
  }> = [];

  // Add lab deviations
  allDeviations.forEach((dev, idx) => {
    attentionItems.push({
      id: `dev-${idx}`,
      title: `${dev.marker}: ${dev.value}`,
      description: dev.explanation || `Статус: ${dev.status} (Норма: ${dev.norm})`,
      severity: dev.status === 'Внимание' ? 'risk' : 'warning',
      action: () => setActiveTab('lab'),
    });
  });

  // Check pressure logs for high readings
  const latestPressure = pressureLogs[0];
  if (latestPressure && (latestPressure.systolic >= 140 || latestPressure.diastolic >= 90)) {
    attentionItems.push({
      id: 'press-high',
      title: `АД ${latestPressure.systolic}/${latestPressure.diastolic} мм рт. ст.`,
      description: 'Повышенное артериальное давление',
      severity: 'risk',
      action: () => onNavigate('pressure_diary'),
    });
  }

  const activeAttentionItems = attentionItems.slice(0, 3);

  // 2. "Лекарства сегодня"
  const medReminders = reminders.filter((r) => r.category === 'medication' && r.isEnabled);
  const completedMeds = medReminders.filter((r) => r.lastCompletedDate === todayStr);
  const nextMed = medReminders.find((r) => r.lastCompletedDate !== todayStr) || medReminders[0];

  const handleToggleMed = (e: React.MouseEvent, medId: string) => {
    e.stopPropagation();
    if (!setReminders) return;
    setReminders((prev) =>
      prev.map((rem) => {
        if (rem.id === medId) {
          const isDone = rem.lastCompletedDate === todayStr;
          return {
            ...rem,
            lastCompletedDate: isDone ? undefined : todayStr,
          };
        }
        return rem;
      })
    );
  };

  // 3. "Женское здоровье"
  const isWomenHealthConfigured = Boolean(user.womenHealth?.lastPeriodDate);
  const isFemaleUser = user.gender === 'female' || Boolean(user.womenHealth);
  let cycleDay = 1;
  let cyclePhase = 'Не настроено';
  let daysToPeriod = 0;
  let cycleNote = '';

  if (user.womenHealth?.lastPeriodDate) {
    const cycleLength = user.womenHealth.cycleLength || 28;
    const lastDate = new Date(user.womenHealth.lastPeriodDate);
    const diffDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 3600 * 24));
    cycleDay = (Math.abs(diffDays) % cycleLength) + 1;
    daysToPeriod = cycleLength - cycleDay + 1;

    if (cycleDay <= 5) {
      cyclePhase = 'Фолликулярная фаза (менструация)';
      cycleNote = 'Рекомендуется отдых и щадящий режим';
    } else if (cycleDay <= 12) {
      cyclePhase = 'Фолликулярная фаза';
      cycleNote = 'Постепенный подъём выносливости и энергии';
    } else if (cycleDay <= 16) {
      cyclePhase = 'Овуляторная фаза';
      cycleNote = 'Максимальная физическая и ментальная продуктивность';
    } else {
      cyclePhase = 'Лютеиновая фаза';
      cycleNote = 'Важен полноценный сон и контроль потребления сахара';
    }
  }

  // 4. "Компактный ежедневный чек-ин"
  const todayLog = dailyLogs[0];
  const isCheckinFilledToday = Boolean(todayLog);

  // 5. "Блок Сегодня" (Tasks for today, max 3)
  const todayTasks: Array<{
    id: string;
    category: 'medication' | 'pressure' | 'diary' | 'lab';
    title: string;
    time: string;
    isCompleted: boolean;
    action: () => void;
  }> = [];

  // Task 1: Next Medication
  if (nextMed) {
    todayTasks.push({
      id: `task-med-${nextMed.id}`,
      category: 'medication',
      title: `${nextMed.title} ${nextMed.dosage ? `(${nextMed.dosage})` : ''}`,
      time: nextMed.time || '20:00',
      isCompleted: nextMed.lastCompletedDate === todayStr,
      action: () => onNavigate('reminders'),
    });
  }

  // Task 2: Pressure measurement
  const hasPressureLogToday = pressureLogs.some((p) => p.date === todayStr);
  todayTasks.push({
    id: 'task-pressure',
    category: 'pressure',
    title: 'Вечерний замер давления',
    time: '20:30',
    isCompleted: hasPressureLogToday,
    action: () => onNavigate('pressure_diary'),
  });

  // Task 3: Mental Diary
  const hasDiaryEntryToday = diaryEntries.some(
    (d) => d.created_at && d.created_at.slice(0, 10) === todayStr
  );
  todayTasks.push({
    id: 'task-diary',
    category: 'diary',
    title: 'Запись эмоций и состояния',
    time: '21:00',
    isCompleted: hasDiaryEntryToday,
    action: () => onNavigate('mental_diary'),
  });

  const activeTodayTasks = todayTasks.slice(0, 3);

  // 6. "Совет Аиды" (Single Recommendation)
  const singleTip =
    aiAnalysis?.dailyRecommendations?.[0] ||
    (hasUserData
      ? 'Поддерживайте комфортный водный баланс и уделяйте 30 минут пешим прогулкам на свежем воздухе.'
      : 'Загрузите результаты анализов или заполните дневник самочувствия, чтобы получить ваш первый персональный совет от Аиды.');

  const tipBasis = documents.length > 0
    ? `Сформировано на основе анализа лабораторных бланков от ${documents[0]?.date || 'недавней даты'} и показателей активности`
    : hasUserData
    ? 'Сформировано на основе анкеты и дневника самочувствия'
    : 'Персональный совет появится после добавления ваших первых данных';

  return (
    <div className="w-full max-w-[1000px] mx-auto space-y-3.5 sm:space-y-4 px-1.5 sm:px-0">
      {/* 1. COMPACT TOP BANNER */}
      <div className="flex items-center justify-between bg-[#0B1320]/60 border border-white/[0.06] rounded-2xl p-3.5 sm:p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#8E74FF]/15 border border-[#8E74FF]/30 text-[#8E74FF] flex items-center justify-center font-bold text-sm shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-tight">
              Добрый день, {firstName}
            </h1>
            <p className="text-[11px] text-white/50 capitalize mt-0.5">{formattedDate}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchHealthAnalysis}
          disabled={isLoadingAnalysis}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/80 hover:text-white text-xs font-semibold transition-all cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalysis ? 'animate-spin text-[#8E74FF]' : ''}`} />
          <span className="hidden sm:inline">Обновить анализ</span>
        </button>
      </div>

      {/* AI STATUS TOP BAR & 4 METRIC CARDS GRID (ОБЩЕЕ СОСТОЯНИЕ, ЭНЕРГИЯ, СОН, ПРОГНОЗ) */}
      <AiMetricsTopSection
        user={user}
        aiAnalysis={aiAnalysis}
        documents={documents}
        dailyLogs={dailyLogs}
        diaryEntries={diaryEntries}
        onNavigate={onNavigate}
        displayHealthScore={displayHealthScore}
      />

      {/* MEDICATION SCHEDULE SECTION */}
      <MedicationTodaySection
        user={user}
        reminders={reminders}
        onNavigate={onNavigate}
        onOpenAddMedication={() => onNavigate('reminders')}
      />

      {/* MATURITY STAGE INDICATOR (ACCURATE DATA SUFFICIENCY BANNER) */}
      <MaturityStageIndicator
        daysSinceRegistration={1}
        hasSurvey={Boolean(user.isQuestionnaireCompleted)}
        documentsCount={documents.length}
        diaryEntriesCount={(diaryEntries?.length || 0) + (dailyLogs?.length || 0)}
        onOpenProposal={() => onNavigate('settings')}
      />

      {/* 3. БЛОК «ЧТО ТРЕБУЕТ ВНИМАНИЯ» */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF8C42]/10 border border-[#FF8C42]/20 text-[#FF8C42] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="font-extrabold text-white text-sm sm:text-base tracking-tight">
              Что требует внимания ({activeAttentionItems.length})
            </h2>
          </div>
        </div>

        {activeAttentionItems.length === 0 ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-[#101A28] border border-white/[0.06] rounded-xl text-white/80 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#34F5A4] shrink-0" />
              <span>
                {hasUserData
                  ? 'Все ключевые показатели в норме, рисков и отклонений не обнаружено'
                  : 'Загрузите результаты анализов или пройдите ежедневный чек-ин, чтобы Аида могла выявить риски.'}
              </span>
            </div>
            {!hasUserData && (
              <button
                type="button"
                onClick={() => setActiveTab('lab')}
                className="px-3 py-1.5 rounded-lg bg-[#8E74FF]/20 hover:bg-[#8E74FF]/30 text-[#8E74FF] font-bold text-xs shrink-0 cursor-pointer"
              >
                + Добавить данные
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {activeAttentionItems.map((item) => (
              <div
                key={item.id}
                onClick={item.action}
                className="w-full p-3 bg-[#101A28] hover:bg-[#142133] border border-white/[0.06] hover:border-[#FF8C42]/40 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      item.severity === 'risk' ? 'bg-[#FF5252]' : 'bg-[#FF8C42]'
                    }`}
                  />
                  <div>
                    <span className="font-bold text-white text-xs sm:text-sm block">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-white/50 block mt-0.5">
                      {item.description}
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. СВЯЗИ СОСТОЯНИЙ И МЕЖСИСТЕМНЫЙ АНАЛИЗ */}
      <StateConnectionsSection
        connections={healthProfile.stateConnections}
        onOpenDoctorReport={() => onNavigate('body_map')}
      />

      {/* 5. ЧТО ЕЩЁ НАДО СДАТЬ ДЛЯ ПОЛНОГО АНАЛИЗА */}
      <RecommendedNextTestsSection
        recommendedTests={healthProfile.recommendedNextTests}
        onAddReminder={handleAddTestReminder}
        onNavigateToLab={() => setActiveTab('lab')}
      />



      {/* GRID FOR MEDICATION & WOMEN's HEALTH */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {/* 4. КАРТОЧКА «ЛЕКАРСТВА И ВИТАМИНЫ» */}
        <div
          onClick={() => onNavigate('reminders')}
          className="bg-[#0B1320] hover:bg-[#0E182A] border border-white/[0.08] hover:border-[#8E74FF]/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#8E74FF]/10 border border-[#8E74FF]/20 text-[#8E74FF] flex items-center justify-center shrink-0">
                <Pill className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-sm">Лекарства сегодня</h3>
                <p className="text-[10px] text-white/50">
                  {medReminders.length > 0
                    ? `${completedMeds.length} из ${medReminders.length} принято`
                    : 'График приёма не настроен'}
                </p>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>

          {medReminders.length === 0 ? (
            <div className="p-3 bg-[#101A28] border border-white/[0.06] rounded-xl flex items-center justify-between gap-2 text-xs text-white/60">
              <span>Добавить график приёма лекарств или витаминов</span>
              <span className="text-[#8E74FF] font-bold shrink-0">+ Добавить</span>
            </div>
          ) : nextMed ? (
            <div className="p-3 bg-[#101A28] border border-white/[0.06] rounded-xl flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-xs sm:text-sm">
                    {nextMed.title}
                  </span>
                  {nextMed.dosage && (
                    <span className="text-[10px] text-[#8E74FF] font-semibold bg-[#8E74FF]/10 px-2 py-0.5 rounded-md">
                      {nextMed.dosage}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-white/50 block mt-0.5">
                  Время приёма: {nextMed.time || '20:00'}
                </span>
              </div>

              <button
                type="button"
                onClick={(e) => handleToggleMed(e, nextMed.id)}
                className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  nextMed.lastCompletedDate === todayStr
                    ? 'bg-[#34F5A4]/10 border-[#34F5A4]/30 text-[#34F5A4]'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {nextMed.lastCompletedDate === todayStr ? 'Принято' : 'Отметить'}
                </span>
              </button>
            </div>
          ) : (
            <div className="text-xs text-white/50 py-2">Все лекарства на сегодня приняты</div>
          )}
        </div>

        {/* 5. КАРТОЧКА «ЖЕНСКОЕ ЗДОРОВЬЕ» */}
        {isFemaleUser && (
          <div
            onClick={() => onNavigate('settings')}
            className="bg-[#0B1320] hover:bg-[#0E182A] border border-white/[0.08] hover:border-pink-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm">Женское здоровье</h3>
                  <p className="text-[10px] text-pink-400 font-medium">
                    {isWomenHealthConfigured ? cyclePhase : 'Трекер цикла'}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>

            {isWomenHealthConfigured ? (
              <div className="p-3 bg-[#101A28] border border-white/[0.06] rounded-xl flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-black text-white text-sm block">{cycleDay}-й день цикла</span>
                  <span className="text-[11px] text-white/50 block mt-0.5">
                    Следующий цикл: через {daysToPeriod} дней
                  </span>
                </div>

                <span className="text-[10px] text-pink-300 bg-pink-500/10 px-2.5 py-1 rounded-lg border border-pink-500/20 font-semibold max-w-[140px] text-right">
                  {cycleNote}
                </span>
              </div>
            ) : (
              <div className="p-3 bg-[#101A28] border border-white/[0.06] rounded-xl flex items-center justify-between gap-2 text-xs text-white/60">
                <span>Укажите дату последнего цикла в настройках</span>
                <span className="text-pink-400 font-bold shrink-0">Настроить</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. КОМПАКТНЫЙ ЕЖЕДНЕВНЫЙ ЧЕК-ИН */}
      <div
        onClick={() => onNavigate('daily_checkin')}
        className="bg-[#0B1320] hover:bg-[#0E182A] border border-white/[0.08] hover:border-[#8E74FF]/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl transition-all cursor-pointer space-y-3 group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#4DEBFF]/10 border border-[#4DEBFF]/20 text-[#4DEBFF] flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm">Ежедневный чек-ин</h3>
              <p className="text-[10px] text-white/50">
                {isCheckinFilledToday ? 'Заполнен на сегодня' : 'Отметьте самочувствие'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('daily_checkin');
            }}
            className="px-3 py-1.5 rounded-xl bg-[#8E74FF]/15 hover:bg-[#8E74FF]/25 border border-[#8E74FF]/30 text-[#8E74FF] text-xs font-bold transition-all cursor-pointer"
          >
            {isCheckinFilledToday ? 'Изменить' : 'Заполнить'}
          </button>
        </div>

        {isCheckinFilledToday ? (
          <div className="p-3 bg-[#101A28] border border-white/[0.06] rounded-xl text-xs text-white/90 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Энергия:</span>
              <span className="font-bold text-[#34F5A4]">{(todayLog?.energy || 8) * 10}%</span>
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Сон:</span>
              <span className="font-bold text-[#4DEBFF]">{todayLog?.sleep || 8} ч</span>
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Стресс:</span>
              <span className="font-bold text-[#8E74FF]">{todayLog?.stress || 3}/10</span>
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Боль:</span>
              <span className="font-bold text-white/80">Нет</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-[#101A28] rounded-xl border border-white/[0.04] text-center">
              <span className="text-white/40 text-[10px] block">Настроение</span>
              <span className="font-bold text-white mt-0.5 block">Не заполнено</span>
            </div>
            <div className="p-2.5 bg-[#101A28] rounded-xl border border-white/[0.04] text-center">
              <span className="text-white/40 text-[10px] block">Энергия</span>
              <span className="font-bold text-white mt-0.5 block">Не заполнено</span>
            </div>
            <div className="p-2.5 bg-[#101A28] rounded-xl border border-white/[0.04] text-center">
              <span className="text-white/40 text-[10px] block">Стресс</span>
              <span className="font-bold text-white mt-0.5 block">Не заполнено</span>
            </div>
            <div className="p-2.5 bg-[#101A28] rounded-xl border border-white/[0.04] text-center">
              <span className="text-white/40 text-[10px] block">Боль</span>
              <span className="font-bold text-white mt-0.5 block">Не заполнено</span>
            </div>
          </div>
        )}
      </div>

      {/* 7. БЛОК «СЕГОДНЯ» (Max 3 tasks) */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#8E74FF]/10 border border-[#8E74FF]/20 text-[#8E74FF] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <h2 className="font-extrabold text-white text-sm sm:text-base tracking-tight">
              Сегодня ({activeTodayTasks.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('reminders')}
            className="text-xs text-[#8E74FF] font-bold hover:underline cursor-pointer"
          >
            Все задачи →
          </button>
        </div>

        <div className="space-y-2">
          {activeTodayTasks.map((task) => (
            <div
              key={task.id}
              onClick={task.action}
              className="p-3 bg-[#101A28] hover:bg-[#142133] border border-white/[0.06] hover:border-[#8E74FF]/40 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs transition-colors shrink-0 ${
                    task.isCompleted
                      ? 'bg-[#34F5A4]/20 border-[#34F5A4] text-[#34F5A4]'
                      : 'border-white/20 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </div>

                <div>
                  <span
                    className={`font-bold text-xs sm:text-sm block ${
                      task.isCompleted ? 'line-through text-white/40' : 'text-white'
                    }`}
                  >
                    {task.title}
                  </span>
                  <span className="text-[10px] text-white/50 block mt-0.5">
                    Время: {task.time}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* 8. ОДНА КАРТОЧКА «СОВЕТ АИДЫ» */}
      <div
        onClick={() => onNavigate('ai_chat')}
        className="bg-[#0B1320] hover:bg-[#0E182A] border border-[#8E74FF]/30 hover:border-[#8E74FF]/60 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl transition-all cursor-pointer space-y-2.5 group relative overflow-hidden"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#8E74FF]/15 border border-[#8E74FF]/30 text-[#8E74FF] flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold text-[#8E74FF] tracking-tight">
              Совет Аиды
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold text-[#8E74FF] group-hover:translate-x-1 transition-transform">
            <span>Подробнее</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
          {singleTip}
        </p>

        <p className="text-[11px] text-white/40 border-t border-white/[0.06] pt-2">
          {tipBasis}
        </p>
      </div>
    </div>
  );
}
