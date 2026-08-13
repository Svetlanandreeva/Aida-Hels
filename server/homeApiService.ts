import { canonicalDataLayer, CanonicalUserData } from './canonicalDataLayer';
import { puzzleService } from './puzzleService';

export interface HomeWidgetCta {
  label: string;
  targetScreen: string;
}

export interface HomeWidgetFreshness {
  lastUpdated: string | null;
  freshnessLevel: 'fresh' | 'stale' | 'none';
}

export interface HomeWidget {
  id: string;
  title: string;
  category: string;
  state: 'has_data' | 'no_data' | 'stale';
  freshness: HomeWidgetFreshness;
  data: any;
  cta: HomeWidgetCta | null;
}

export interface HomeMedicationTask {
  id: string;
  title: string;
  time: string;
  dosage?: string;
  isEnabled: boolean;
  status: 'pending' | 'taken' | 'skipped';
}

export interface HomeAlert {
  id: string;
  type: 'info' | 'warning' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  actionCta?: HomeWidgetCta;
}

export interface HomeAggregatedPayload {
  profileId: string;
  profileName: string;
  enabledModules: any[];
  widgets: HomeWidget[];
  todaySummary: {
    hasEvidence: boolean;
    summaryText?: string;
    evidenceCount?: number;
    metricsSummary?: Record<string, any>;
  } | null;
  medicationTasks: HomeMedicationTask[];
  alerts: HomeAlert[];
  dataFreshness: {
    lastGlobalSync: string | null;
    overallStatus: 'fresh' | 'stale' | 'empty';
    staleWidgetsCount: number;
    hasAnyData: boolean;
  };
  noFakeScore: true;
}

export class HomeApiService {
  /**
   * Aggregated Home payload. Global invariant:
   * NO record in source -> NO value in UI.
   */
  public async getHomePayload(userId: string, targetProfileId?: string): Promise<HomeAggregatedPayload> {
    const userData: CanonicalUserData | null = await canonicalDataLayer.getUserData(userId);

    const activeProfileId = targetProfileId || userId;
    const profile = userData?.profile || {};
    const profileName = profile.fullName || profile.name || 'Профиль';

    const puzzleConfig = await puzzleService.getUserPuzzleConfig(userId);
    const enabledModules = puzzleConfig.filter((m) => m.enabled);

    const now = new Date();
    const todayIso = now.toISOString().split('T')[0];
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    const calcFreshness = (dateStr?: string | null): HomeWidgetFreshness => {
      if (!dateStr) return { lastUpdated: null, freshnessLevel: 'none' };
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return { lastUpdated: null, freshnessLevel: 'none' };
      const diff = now.getTime() - d.getTime();
      return {
        lastUpdated: d.toISOString(),
        freshnessLevel: diff < THREE_DAYS_MS ? 'fresh' : 'stale',
      };
    };

    const pressureLogs = Array.isArray(userData?.pressureLogs) ? userData.pressureLogs : [];
    const dailyLogs = Array.isArray(userData?.dailyLogs) ? userData.dailyLogs : [];
    const diaryEntries = Array.isArray(userData?.diaryEntries) ? userData.diaryEntries : [];
    const documents = Array.isArray(userData?.documents) ? userData.documents : [];
    const reminders = Array.isArray(userData?.reminders) ? userData.reminders : [];
    const wearablesSyncs = Array.isArray(userData?.wearablesSyncs) ? userData.wearablesSyncs : [];

    const widgets: HomeWidget[] = [];
    let staleWidgetsCount = 0;

    const homeModules = enabledModules
      .filter((m) => m.show_on_home)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    for (const mod of homeModules) {
      switch (mod.moduleId) {
        case 'pressure': {
          if (pressureLogs.length === 0) {
            widgets.push({
              id: 'pressure',
              title: mod.title || 'Артериальное давление и пульс',
              category: 'core',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Добавить первое измерение давления', targetScreen: 'pressure_diary' },
            });
            break;
          }

          const latest = [...pressureLogs].sort(
            (a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime()
          )[0];
          const freshness = calcFreshness(latest.timestamp || latest.date);
          if (freshness.freshnessLevel === 'stale') staleWidgetsCount++;

          const data: Record<string, any> = {
            timestamp: latest.timestamp || latest.date || null,
            totalReadings: pressureLogs.length,
          };
          if (latest.systolic !== undefined && latest.systolic !== null) data.systolic = latest.systolic;
          if (latest.diastolic !== undefined && latest.diastolic !== null) data.diastolic = latest.diastolic;
          if (latest.pulse !== undefined && latest.pulse !== null) data.pulse = latest.pulse;

          widgets.push({
            id: 'pressure',
            title: mod.title || 'Артериальное давление и пульс',
            category: 'core',
            state: freshness.freshnessLevel === 'stale' ? 'stale' : 'has_data',
            freshness,
            data,
            cta: { label: 'Записать новое измерение', targetScreen: 'pressure_diary' },
          });
          break;
        }

        case 'energy': {
          const logsWithEnergy = dailyLogs.filter((l) => l.energyLevel !== undefined && l.energyLevel !== null);
          if (logsWithEnergy.length === 0) {
            widgets.push({
              id: 'energy',
              title: mod.title || 'Энергия и жизненный тонус',
              category: 'core',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Оценить энергию за сегодня', targetScreen: 'daily_checkin' },
            });
            break;
          }

          const latest = [...logsWithEnergy].sort(
            (a, b) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime()
          )[0];
          const freshness = calcFreshness(latest.date || latest.timestamp);
          if (freshness.freshnessLevel === 'stale') staleWidgetsCount++;

          widgets.push({
            id: 'energy',
            title: mod.title || 'Энергия и жизненный тонус',
            category: 'core',
            state: freshness.freshnessLevel === 'stale' ? 'stale' : 'has_data',
            freshness,
            data: {
              energyLevel: latest.energyLevel,
              date: latest.date || latest.timestamp || null,
            },
            cta: { label: 'Отметить за сегодня', targetScreen: 'daily_checkin' },
          });
          break;
        }

        case 'sleep': {
          const logsWithSleep = dailyLogs.filter((l) => l.sleepHours !== undefined && l.sleepHours !== null);
          if (logsWithSleep.length === 0) {
            widgets.push({
              id: 'sleep',
              title: mod.title || 'Качество сна',
              category: 'core',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Внести данные о сне', targetScreen: 'mental_diary' },
            });
            break;
          }

          const latest = [...logsWithSleep].sort(
            (a, b) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime()
          )[0];
          const freshness = calcFreshness(latest.date || latest.timestamp);
          if (freshness.freshnessLevel === 'stale') staleWidgetsCount++;

          const data: Record<string, any> = {
            sleepHours: latest.sleepHours,
            date: latest.date || latest.timestamp || null,
          };
          if (latest.sleepQuality !== undefined && latest.sleepQuality !== null) {
            data.sleepQuality = latest.sleepQuality;
          }

          widgets.push({
            id: 'sleep',
            title: mod.title || 'Качество сна',
            category: 'core',
            state: freshness.freshnessLevel === 'stale' ? 'stale' : 'has_data',
            freshness,
            data,
            cta: { label: 'Обновить данные сна', targetScreen: 'mental_diary' },
          });
          break;
        }

        case 'mental': {
          const mentalDiaryEntries = diaryEntries.filter(
            (entry) => entry && (entry.mood !== undefined || entry.text || entry.note)
          );
          const mentalDailyLogs = dailyLogs.filter((entry) => entry?.mood !== undefined && entry?.mood !== null);

          if (mentalDiaryEntries.length === 0 && mentalDailyLogs.length === 0) {
            widgets.push({
              id: 'mental',
              title: mod.title || 'Настроение и ментальный баланс',
              category: 'sensitive',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Заполнить дневник настроения', targetScreen: 'mental_diary' },
            });
            break;
          }

          const candidates = [
            ...mentalDiaryEntries.map((entry) => ({ ...entry, __source: 'diary' })),
            ...mentalDailyLogs.map((entry) => ({ ...entry, __source: 'daily' })),
          ];
          const latest = candidates.sort(
            (a, b) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime()
          )[0];
          const freshness = calcFreshness(latest?.date || latest?.timestamp);
          if (freshness.freshnessLevel === 'stale') staleWidgetsCount++;

          const data: Record<string, any> = {
            source: latest.__source,
            date: latest?.date || latest?.timestamp || null,
          };
          if (latest?.mood !== undefined && latest?.mood !== null) data.mood = latest.mood;
          const note = latest?.text || latest?.note;
          if (note) data.note = note;

          widgets.push({
            id: 'mental',
            title: mod.title || 'Настроение и ментальный баланс',
            category: 'sensitive',
            state: freshness.freshnessLevel === 'stale' ? 'stale' : 'has_data',
            freshness,
            data,
            cta: { label: 'Записать мысль или эмоцию', targetScreen: 'mental_diary' },
          });
          break;
        }

        case 'extended_analysis': {
          if (documents.length === 0) {
            widgets.push({
              id: 'extended_analysis',
              title: mod.title || 'Медицинские документы и анализы',
              category: 'analytics',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Загрузить первый документ или результат анализов', targetScreen: 'lab' },
            });
            break;
          }

          const latest = [...documents].sort(
            (a, b) => new Date(b.uploadDate || b.date).getTime() - new Date(a.uploadDate || a.date).getTime()
          )[0];
          const freshness = calcFreshness(latest.uploadDate || latest.date);
          if (freshness.freshnessLevel === 'stale') staleWidgetsCount++;

          widgets.push({
            id: 'extended_analysis',
            title: mod.title || 'Медицинские документы и анализы',
            category: 'analytics',
            state: freshness.freshnessLevel === 'stale' ? 'stale' : 'has_data',
            freshness,
            data: {
              totalDocuments: documents.length,
              latestDocumentTitle: latest.title || latest.fileName || null,
              latestUploadDate: latest.uploadDate || latest.date || null,
            },
            cta: { label: 'Просмотреть картотеку анализов', targetScreen: 'lab' },
          });
          break;
        }

        case 'aida_insights': {
          const aiSummary = userData?.aiAnalysis?.summaryText;
          const keyRecommendations = Array.isArray(userData?.aiAnalysis?.keyRecommendations)
            ? userData.aiAnalysis.keyRecommendations.filter(Boolean)
            : [];
          const aiUpdatedAt = userData?.aiAnalysis?.updatedAt || userData?.aiAnalysis?.createdAt || null;

          if (!aiSummary && keyRecommendations.length === 0) {
            widgets.push({
              id: 'aida_insights',
              title: mod.title || 'ИИ-обзор состояния (Аида)',
              category: 'ai',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Добавить данные для анализа', targetScreen: 'daily_checkin' },
            });
            break;
          }

          const freshness = calcFreshness(aiUpdatedAt);
          if (freshness.freshnessLevel === 'stale') staleWidgetsCount++;

          widgets.push({
            id: 'aida_insights',
            title: mod.title || 'ИИ-обзор состояния (Аида)',
            category: 'ai',
            state: freshness.freshnessLevel === 'stale' ? 'stale' : 'has_data',
            freshness,
            data: {
              aiSummary: aiSummary || null,
              bullets: keyRecommendations,
            },
            cta: { label: 'Задать вопрос Аиде в чате', targetScreen: 'ai_chat' },
          });
          break;
        }

        default:
          widgets.push({
            id: mod.moduleId,
            title: mod.title,
            category: mod.category || 'specialized',
            state: 'no_data',
            freshness: { lastUpdated: null, freshnessLevel: 'none' },
            data: null,
            cta: { label: `Открыть модуль «${mod.title}»`, targetScreen: 'dashboard' },
          });
      }
    }

    // Only real medication reminders with enough source fields become tasks.
    const medicationTasks: HomeMedicationTask[] = reminders
      .filter((r: any) => r?.id && (r?.title || r?.medicationName) && r?.time)
      .map((r: any) => ({
        id: String(r.id),
        title: String(r.title || r.medicationName),
        time: String(r.time),
        dosage: r.dosage || r.dosageText || undefined,
        isEnabled: r.isEnabled !== false,
        status: r.skippedToday ? 'skipped' : r.takenToday ? 'taken' : 'pending',
      }));

    // Clinical/safety alerts must come from an approved rules service.
    // Home aggregation never invents medical alerts from ad-hoc thresholds.
    const alerts: HomeAlert[] = [];

    const todayPressureLogs = pressureLogs.filter((p) => (p.timestamp || p.date || '').startsWith(todayIso));
    const todayDailyLogs = dailyLogs.filter((d) => (d.date || d.timestamp || '').startsWith(todayIso));
    const todayDiary = diaryEntries.filter((e) => (e.date || e.timestamp || '').startsWith(todayIso));

    const todayEvidenceCount = todayPressureLogs.length + todayDailyLogs.length + todayDiary.length;
    let todaySummary: HomeAggregatedPayload['todaySummary'] = null;

    if (todayEvidenceCount > 0) {
      const metricsSummary: Record<string, any> = {};

      if (todayPressureLogs.length > 0) {
        const lastBp = todayPressureLogs[todayPressureLogs.length - 1];
        if (lastBp.systolic !== undefined && lastBp.diastolic !== undefined) {
          metricsSummary.pressure = `${lastBp.systolic}/${lastBp.diastolic} мм рт. ст.`;
        }
        if (lastBp.pulse !== undefined && lastBp.pulse !== null) {
          metricsSummary.pulse = `${lastBp.pulse} уд/мин`;
        }
      }

      if (todayDailyLogs.length > 0) {
        const lastDaily = todayDailyLogs[todayDailyLogs.length - 1];
        if (lastDaily.energyLevel !== undefined && lastDaily.energyLevel !== null) {
          metricsSummary.energy = `${lastDaily.energyLevel}/10`;
        }
        if (lastDaily.sleepHours !== undefined && lastDaily.sleepHours !== null) {
          metricsSummary.sleep = `${lastDaily.sleepHours} ч`;
        }
        if (lastDaily.mood !== undefined && lastDaily.mood !== null) {
          metricsSummary.mood = lastDaily.mood;
        }
      }

      todaySummary = {
        hasEvidence: true,
        summaryText: `Сегодня сохранено ${todayEvidenceCount} записей.`,
        evidenceCount: todayEvidenceCount,
        metricsSummary,
      };
    }

    const hasAnyData =
      pressureLogs.length > 0 ||
      dailyLogs.length > 0 ||
      diaryEntries.length > 0 ||
      documents.length > 0 ||
      reminders.length > 0 ||
      wearablesSyncs.length > 0;

    const lastGlobalSync = userData?.updatedAt || null;
    const overallStatus: 'fresh' | 'stale' | 'empty' = !hasAnyData
      ? 'empty'
      : staleWidgetsCount > 0
        ? 'stale'
        : 'fresh';

    return {
      profileId: activeProfileId,
      profileName,
      enabledModules,
      widgets,
      todaySummary,
      medicationTasks,
      alerts,
      dataFreshness: {
        lastGlobalSync,
        overallStatus,
        staleWidgetsCount,
        hasAnyData,
      },
      noFakeScore: true,
    };
  }
}

export const homeApiService = new HomeApiService();