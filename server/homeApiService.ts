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
   * Generates a complete aggregated payload for Home API GET /profiles/:id/home
   */
  public async getHomePayload(userId: string, targetProfileId?: string): Promise<HomeAggregatedPayload> {
    // Fetch canonical user data
    const userData: CanonicalUserData | null = await canonicalDataLayer.getUserData(userId);

    const activeProfileId = targetProfileId || userId;
    const profile = userData?.profile || {};
    const profileName = profile.fullName || 'Пользователь';

    // 1. Get puzzle config (enabled modules)
    const puzzleConfig = await puzzleService.getUserPuzzleConfig(userId);
    const enabledModules = puzzleConfig.filter((m) => m.enabled);

    // Prepare date calculation helpers
    const now = new Date();
    const todayIso = now.toISOString().split('T')[0];
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    const calcFreshness = (dateStr?: string | null): HomeWidgetFreshness => {
      if (!dateStr) return { lastUpdated: null, freshnessLevel: 'none' };
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { lastUpdated: null, freshnessLevel: 'none' };
      const diff = now.getTime() - d.getTime();
      if (diff < THREE_DAYS_MS) {
        return { lastUpdated: d.toISOString(), freshnessLevel: 'fresh' };
      }
      return { lastUpdated: d.toISOString(), freshnessLevel: 'stale' };
    };

    // Extract arrays from canonical user data
    const pressureLogs = Array.isArray(userData?.pressureLogs) ? userData.pressureLogs : [];
    const dailyLogs = Array.isArray(userData?.dailyLogs) ? userData.dailyLogs : [];
    const diaryEntries = Array.isArray(userData?.diaryEntries) ? userData.diaryEntries : [];
    const documents = Array.isArray(userData?.documents) ? userData.documents : [];
    const reminders = Array.isArray(userData?.reminders) ? userData.reminders : [];
    const wearablesSyncs = Array.isArray(userData?.wearablesSyncs) ? userData.wearablesSyncs : [];

    const widgets: HomeWidget[] = [];
    let staleWidgetsCount = 0;
    let totalDataEntries = 0;

    // Filter relevant module configs enabled for home
    const homeModules = enabledModules.filter((m) => m.show_on_home).sort((a, b) => (a.order || 0) - (b.order || 0));

    for (const mod of homeModules) {
      switch (mod.moduleId) {
        case 'pressure': {
          const hasLogs = pressureLogs.length > 0;
          if (!hasLogs) {
            widgets.push({
              id: 'pressure',
              title: mod.title || 'Артериальное давление и пульс',
              category: 'core',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Добавить первое измерение давления', targetScreen: 'pressure_diary' },
            });
          } else {
            totalDataEntries += pressureLogs.length;
            const latest = [...pressureLogs].sort(
              (a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime()
            )[0];
            const freshness = calcFreshness(latest.timestamp || latest.date);
            if (freshness.freshnessLevel === 'stale') staleWidgetsCount++;

            widgets.push({
              id: 'pressure',
              title: mod.title || 'Артериальное давление и пульс',
              category: 'core',
              state: freshness.freshnessLevel === 'stale' ? 'stale' : 'has_data',
              freshness,
              data: {
                systolic: latest.systolic,
                diastolic: latest.diastolic,
                pulse: latest.pulse,
                timestamp: latest.timestamp || latest.date,
                totalReadings: pressureLogs.length,
              },
              cta: { label: 'Записать новое измерение', targetScreen: 'pressure_diary' },
            });
          }
          break;
        }

        case 'energy': {
          const logsWithEnergy = dailyLogs.filter((l) => l.energyLevel !== undefined && l.energyLevel !== null);
          const hasEnergy = logsWithEnergy.length > 0;
          if (!hasEnergy) {
            widgets.push({
              id: 'energy',
              title: mod.title || 'Энергия и жизненный тонус',
              category: 'core',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Оценить энергию за сегодня', targetScreen: 'daily_checkin' },
            });
          } else {
            totalDataEntries += logsWithEnergy.length;
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
                date: latest.date || latest.timestamp,
              },
              cta: { label: 'Отметить за сегодня', targetScreen: 'daily_checkin' },
            });
          }
          break;
        }

        case 'sleep': {
          const logsWithSleep = dailyLogs.filter((l) => l.sleepHours !== undefined && l.sleepHours !== null);
          const hasSleep = logsWithSleep.length > 0;
          if (!hasSleep) {
            widgets.push({
              id: 'sleep',
              title: mod.title || 'Качество сна',
              category: 'core',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Внести данные о сне', targetScreen: 'mental_diary' },
            });
          } else {
            totalDataEntries += logsWithSleep.length;
            const latest = [...logsWithSleep].sort(
              (a, b) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime()
            )[0];
            const freshness = calcFreshness(latest.date || latest.timestamp);
            if (freshness.freshnessLevel === 'stale') staleWidgetsCount++;

            widgets.push({
              id: 'sleep',
              title: mod.title || 'Качество сна',
              category: 'core',
              state: freshness.freshnessLevel === 'stale' ? 'stale' : 'has_data',
              freshness,
              data: {
                sleepHours: latest.sleepHours,
                sleepQuality: latest.sleepQuality,
                date: latest.date || latest.timestamp,
              },
              cta: { label: 'Обновить данные сна', targetScreen: 'mental_diary' },
            });
          }
          break;
        }

        case 'mental': {
          const hasMental = diaryEntries.length > 0 || dailyLogs.some((l) => l.mood !== undefined);
          if (!hasMental) {
            widgets.push({
              id: 'mental',
              title: mod.title || 'Настроение и Ментальный баланс',
              category: 'sensitive',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Заполнить дневник настроения', targetScreen: 'mental_diary' },
            });
          } else {
            totalDataEntries += diaryEntries.length;
            const latest = [...diaryEntries].sort(
              (a, b) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime()
            )[0];
            const freshness = calcFreshness(latest?.date || latest?.timestamp);
            if (freshness.freshnessLevel === 'stale') staleWidgetsCount++;

            widgets.push({
              id: 'mental',
              title: mod.title || 'Настроение и Ментальный баланс',
              category: 'sensitive',
              state: freshness.freshnessLevel === 'stale' ? 'stale' : 'has_data',
              freshness,
              data: {
                mood: latest?.mood || 'Нормальное',
                note: latest?.text || latest?.note,
                date: latest?.date || latest?.timestamp,
              },
              cta: { label: 'Записать мысль или эмоцию', targetScreen: 'mental_diary' },
            });
          }
          break;
        }

        case 'extended_analysis': {
          const hasDocs = documents.length > 0;
          if (!hasDocs) {
            widgets.push({
              id: 'extended_analysis',
              title: mod.title || 'Медицинские документы и анализы',
              category: 'analytics',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Загрузить первый документ или результат анализов', targetScreen: 'lab' },
            });
          } else {
            totalDataEntries += documents.length;
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
                latestDocumentTitle: latest.title || latest.fileName,
                latestUploadDate: latest.uploadDate || latest.date,
              },
              cta: { label: 'Просмотреть картотеку анализов', targetScreen: 'lab' },
            });
          }
          break;
        }

        case 'aida_insights': {
          const hasAnyEvidence = totalDataEntries > 0 || documents.length > 0 || pressureLogs.length > 0;
          if (!hasAnyEvidence) {
            widgets.push({
              id: 'aida_insights',
              title: mod.title || 'ИИ-обзор состояния (Аида)',
              category: 'ai',
              state: 'no_data',
              freshness: { lastUpdated: null, freshnessLevel: 'none' },
              data: null,
              cta: { label: 'Заполнить дневник для активации Аиды', targetScreen: 'daily_checkin' },
            });
          } else {
            widgets.push({
              id: 'aida_insights',
              title: mod.title || 'ИИ-обзор состояния (Аида)',
              category: 'ai',
              state: 'has_data',
              freshness: { lastUpdated: new Date().toISOString(), freshnessLevel: 'fresh' },
              data: {
                aiSummary: userData?.aiAnalysis?.summaryText || 'Аида проанализировала сохраненные показатели.',
                bullets: userData?.aiAnalysis?.keyRecommendations || [
                  'Показатели стабильны.',
                  'Рекомендуется плановый приём витаминов.',
                ],
              },
              cta: { label: 'Задать вопрос Аиде в чате', targetScreen: 'ai_chat' },
            });
          }
          break;
        }

        default: {
          // Generic module fallback
          widgets.push({
            id: mod.moduleId,
            title: mod.title,
            category: mod.category || 'specialized',
            state: 'no_data',
            freshness: { lastUpdated: null, freshnessLevel: 'none' },
            data: null,
            cta: { label: `Открыть модуль «${mod.title}»`, targetScreen: 'dashboard' },
          });
          break;
        }
      }
    }

    // 2. Medication Tasks
    const medicationTasks: HomeMedicationTask[] = reminders.map((r: any) => ({
      id: r.id || String(Math.random()),
      title: r.title || r.medicationName || 'Препарат',
      time: r.time || '09:00',
      dosage: r.dosage || r.dosageText,
      isEnabled: r.isEnabled !== false,
      status: r.takenToday ? 'taken' : 'pending',
    }));

    // 3. Alerts Calculation
    const alerts: HomeAlert[] = [];
    if (pressureLogs.length > 0) {
      const latestBp = pressureLogs[pressureLogs.length - 1];
      if (latestBp.systolic >= 140 || latestBp.diastolic >= 90) {
        alerts.push({
          id: 'bp_warning',
          type: 'warning',
          title: 'Повышенное артериальное давление',
          message: `Зафиксировано ${latestBp.systolic}/${latestBp.diastolic} мм рт. ст. Рекомендуется отдых и повторное измерение.`,
          timestamp: latestBp.timestamp || latestBp.date || new Date().toISOString(),
          actionCta: { label: 'Записать повторно', targetScreen: 'pressure_diary' },
        });
      }
    }

    if (reminders.length === 0) {
      alerts.push({
        id: 'no_med_reminders',
        type: 'info',
        title: 'График приёма лекарств',
        message: 'У вас не настроены напоминания о регулярном приёме витаминов и лекарств.',
        timestamp: new Date().toISOString(),
        actionCta: { label: 'Добавить напоминания', targetScreen: 'reminders' },
      });
    }

    // 4. Today Summary (ONLY IF EVIDENCE EXISTS TODAY!)
    const todayPressureLogs = pressureLogs.filter(
      (p) => (p.timestamp || p.date || '').startsWith(todayIso)
    );
    const todayDailyLogs = dailyLogs.filter(
      (d) => (d.date || d.timestamp || '').startsWith(todayIso)
    );
    const todayDiary = diaryEntries.filter(
      (e) => (e.date || e.timestamp || '').startsWith(todayIso)
    );

    const todayEvidenceCount =
      todayPressureLogs.length + todayDailyLogs.length + todayDiary.length;

    let todaySummary: HomeAggregatedPayload['todaySummary'] = null;

    if (todayEvidenceCount > 0) {
      const metricsSummary: Record<string, any> = {};
      if (todayPressureLogs.length > 0) {
        const lastBp = todayPressureLogs[todayPressureLogs.length - 1];
        metricsSummary.pressure = `${lastBp.systolic}/${lastBp.diastolic} мм рт. ст.`;
      }
      if (todayDailyLogs.length > 0) {
        const lastDaily = todayDailyLogs[todayDailyLogs.length - 1];
        if (lastDaily.energyLevel) metricsSummary.energy = `${lastDaily.energyLevel}/10`;
        if (lastDaily.sleepHours) metricsSummary.sleep = `${lastDaily.sleepHours} ч`;
      }

      todaySummary = {
        hasEvidence: true,
        summaryText: `Сегодня зафиксировано ${todayEvidenceCount} измерений.`,
        evidenceCount: todayEvidenceCount,
        metricsSummary,
      };
    } else {
      // Strictly null when no evidence recorded today!
      todaySummary = null;
    }

    // 5. Data Freshness Meta
    const lastGlobalSync = userData?.updatedAt || new Date().toISOString();
    const hasAnyData = totalDataEntries > 0;
    const overallStatus = !hasAnyData ? 'empty' : staleWidgetsCount > 0 ? 'stale' : 'fresh';

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
