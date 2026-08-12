import { canonicalDataLayer, CanonicalUserData } from './canonicalDataLayer';

export interface TimelineEventItem {
  id: string;
  type:
    | 'lab_result'
    | 'symptom'
    | 'medication'
    | 'diagnosis'
    | 'measurement'
    | 'sleep'
    | 'workout'
    | 'pregnancy'
    | 'dental'
    | 'appointment';
  timestamp: string; // ISO 8601 string
  title: string;
  subtitle?: string;
  description?: string;
  category: string;
  severity?: 'normal' | 'attention' | 'warning' | 'critical';
  details?: Record<string, any>;
  sourceEntityId?: string;
  sourceType: string;
  cta?: {
    label: string;
    targetScreen?: string;
    targetId?: string;
  };
}

export interface TimelineQueryParams {
  from?: string;
  to?: string;
  types?: string[];
  cursor?: string;
  limit?: number;
}

export interface TimelineResponsePayload {
  profileId: string;
  totalEvents: number;
  filteredEventsCount: number;
  from?: string;
  to?: string;
  types?: string[];
  nextCursor: string | null;
  hasMore: boolean;
  events: TimelineEventItem[];
}

export class TimelineService {
  /**
   * Aggregates canonical health entities into a single unified chronological timeline
   */
  public async getTimeline(userId: string, params: TimelineQueryParams = {}): Promise<TimelineResponsePayload> {
    const userData: CanonicalUserData | null = await canonicalDataLayer.getUserData(userId);

    const profile = userData?.profile || {};
    const events: TimelineEventItem[] = [];

    // Safe array access
    const documents = Array.isArray(userData?.documents) ? userData.documents : [];
    const appointments = Array.isArray(userData?.appointments) ? userData.appointments : [];
    const dailyLogs = Array.isArray(userData?.dailyLogs) ? userData.dailyLogs : [];
    const diaryEntries = Array.isArray(userData?.diaryEntries) ? userData.diaryEntries : [];
    const pressureLogs = Array.isArray(userData?.pressureLogs) ? userData.pressureLogs : [];
    const reminders = Array.isArray(userData?.reminders) ? userData.reminders : [];
    const wearablesSyncs = Array.isArray(userData?.wearablesSyncs) ? userData.wearablesSyncs : [];

    // 1. Documents / Lab Results / Imaging
    for (const doc of documents) {
      const ts = this.normalizeDate(doc.date || doc.uploadDate || doc.createdAt);
      if (!ts) continue;

      const isLab = doc.category === 'lab' || doc.category === 'анализы' || doc.type === 'lab';
      const eventType = isLab ? 'lab_result' : doc.category === 'appointment' ? 'appointment' : 'diagnosis';

      events.push({
        id: `doc_${doc.id || Math.random()}`,
        type: eventType,
        timestamp: ts,
        title: doc.title || doc.fileName || 'Медицинский документ',
        subtitle: doc.categoryName || doc.category || 'Результаты обследования',
        description: doc.summary || doc.aiSummary || doc.notes,
        category: 'documents',
        severity: doc.hasAbnormalities || doc.flag === 'warning' ? 'warning' : 'normal',
        details: {
          fileUrl: doc.fileUrl,
          indicators: doc.indicators || doc.metrics,
          doctorName: doc.doctorName,
        },
        sourceEntityId: doc.id,
        sourceType: 'documents',
        cta: {
          label: 'Просмотреть документ',
          targetScreen: 'lab',
          targetId: doc.id,
        },
      });
    }

    // 2. Pressure Logs
    for (const bp of pressureLogs) {
      const ts = this.normalizeDate(bp.timestamp || bp.date);
      if (!ts) continue;

      let severity: TimelineEventItem['severity'] = 'normal';
      if (bp.systolic >= 180 || bp.diastolic >= 120) severity = 'critical';
      else if (bp.systolic >= 140 || bp.diastolic >= 90) severity = 'warning';

      events.push({
        id: `bp_${bp.id || Math.random()}`,
        type: 'measurement',
        timestamp: ts,
        title: `АД ${bp.systolic}/${bp.diastolic} мм рт. ст.`,
        subtitle: `Пульс ${bp.pulse || '—'} уд/мин`,
        description: bp.notes ? `Заметка: ${bp.notes}` : undefined,
        category: 'vitals',
        severity,
        details: {
          systolic: bp.systolic,
          diastolic: bp.diastolic,
          pulse: bp.pulse,
          arm: bp.arm,
        },
        sourceEntityId: bp.id,
        sourceType: 'pressureLogs',
        cta: {
          label: 'Дневник давления',
          targetScreen: 'pressure_diary',
        },
      });
    }

    // 3. Daily Logs (Sleep, Energy, Symptoms)
    for (const log of dailyLogs) {
      const ts = this.normalizeDate(log.date || log.timestamp);
      if (!ts) continue;

      if (log.sleepHours !== undefined && log.sleepHours !== null) {
        events.push({
          id: `sleep_${log.id || Math.random()}`,
          type: 'sleep',
          timestamp: ts,
          title: `Сон: ${log.sleepHours} ч.`,
          subtitle: log.sleepQuality ? `Качество: ${log.sleepQuality}` : 'Запись о сне',
          category: 'sleep',
          severity: log.sleepHours < 6 ? 'warning' : 'normal',
          details: { sleepHours: log.sleepHours, sleepQuality: log.sleepQuality },
          sourceEntityId: log.id,
          sourceType: 'dailyLogs',
          cta: { label: 'Подробнее о сне', targetScreen: 'mental_diary' },
        });
      }

      if (log.energyLevel !== undefined && log.energyLevel !== null) {
        events.push({
          id: `energy_${log.id || Math.random()}`,
          type: 'measurement',
          timestamp: ts,
          title: `Уровень энергии: ${log.energyLevel}/10`,
          subtitle: log.energyLevel < 4 ? 'Низкий уровень энергии' : 'Оценка тонуса',
          category: 'energy',
          severity: log.energyLevel < 4 ? 'warning' : 'normal',
          details: { energyLevel: log.energyLevel },
          sourceEntityId: log.id,
          sourceType: 'dailyLogs',
          cta: { label: 'Чек-ин', targetScreen: 'daily_checkin' },
        });
      }

      if (Array.isArray(log.symptoms) && log.symptoms.length > 0) {
        events.push({
          id: `symptom_${log.id || Math.random()}`,
          type: 'symptom',
          timestamp: ts,
          title: `Симптомы: ${log.symptoms.join(', ')}`,
          subtitle: log.severity ? `Тяжесть: ${log.severity}` : 'Отметка симптомов',
          category: 'symptoms',
          severity: log.severity === 'severe' || log.severity === 'high' ? 'warning' : 'normal',
          details: { symptoms: log.symptoms, notes: log.notes },
          sourceEntityId: log.id,
          sourceType: 'dailyLogs',
          cta: { label: 'Дневник симптомов', targetScreen: 'mental_diary' },
        });
      }
    }

    // 4. Mood & Emotional Diary Entries
    for (const entry of diaryEntries) {
      const ts = this.normalizeDate(entry.date || entry.timestamp);
      if (!ts) continue;

      events.push({
        id: `diary_${entry.id || Math.random()}`,
        type: 'symptom',
        timestamp: ts,
        title: `Настроение: ${entry.mood || 'Запись в дневнике'}`,
        description: entry.text || entry.note,
        category: 'mental',
        severity: entry.mood === 'Ужасно' || entry.mood === 'Тревожно' ? 'warning' : 'normal',
        details: { mood: entry.mood, tags: entry.tags },
        sourceEntityId: entry.id,
        sourceType: 'diaryEntries',
        cta: { label: 'Открыть дневник', targetScreen: 'mental_diary' },
      });
    }

    // 5. Appointments & Doctor Visits
    for (const apt of appointments) {
      const ts = this.normalizeDate(apt.date || apt.appointmentDate || apt.timestamp);
      if (!ts) continue;

      events.push({
        id: `apt_${apt.id || Math.random()}`,
        type: 'appointment',
        timestamp: ts,
        title: `Приём врача: ${apt.doctorName || apt.specialty || 'Консультация'}`,
        subtitle: apt.clinicName || apt.location,
        description: apt.reason || apt.summary || apt.recommendations,
        category: 'appointments',
        severity: 'normal',
        details: { doctorName: apt.doctorName, specialty: apt.specialty, status: apt.status },
        sourceEntityId: apt.id,
        sourceType: 'appointments',
        cta: { label: 'Карточка визита', targetScreen: 'appointments' },
      });
    }

    // 6. Medication Reminders & Intake Logs
    for (const rem of reminders) {
      const ts = this.normalizeDate(rem.lastTakenAt || rem.createdAt || new Date().toISOString());
      if (!ts) continue;

      events.push({
        id: `med_${rem.id || Math.random()}`,
        type: 'medication',
        timestamp: ts,
        title: `Назначение: ${rem.title || rem.medicationName || 'Препарат'}`,
        subtitle: `${rem.time || ''} • ${rem.dosage || 'По схеме'}`,
        description: rem.instructions,
        category: 'medications',
        severity: 'normal',
        details: { isEnabled: rem.isEnabled, dosage: rem.dosage },
        sourceEntityId: rem.id,
        sourceType: 'reminders',
        cta: { label: 'Расписание препаратов', targetScreen: 'reminders' },
      });
    }

    // 7. Wearables & Telemetry
    for (const wSync of wearablesSyncs) {
      const ts = this.normalizeDate(wSync.timestamp);
      if (!ts) continue;

      const metrics = wSync.metrics || {};
      const summaryParts: string[] = [];
      if (metrics.stepsCount) summaryParts.push(`${metrics.stepsCount} шагов`);
      if (metrics.heartRateBpm) summaryParts.push(`ЧСС ${metrics.heartRateBpm} уд/мин`);
      if (metrics.spo2Percentage) summaryParts.push(`SpO2 ${metrics.spo2Percentage}%`);

      events.push({
        id: `wearable_${wSync.id || Math.random()}`,
        type: metrics.stepsCount ? 'workout' : 'measurement',
        timestamp: ts,
        title: `Синхронизация ${wSync.source || 'устройства'}`,
        subtitle: summaryParts.join(' • ') || 'Показатели трекера',
        category: 'telemetry',
        severity: 'normal',
        details: metrics,
        sourceEntityId: wSync.id,
        sourceType: 'wearablesSyncs',
      });
    }

    // 8. Women's Health & Pregnancy (if available in profile)
    if (profile.womenHealth) {
      const wh = profile.womenHealth;
      if (wh.lastPeriodDate) {
        const ts = this.normalizeDate(wh.lastPeriodDate);
        if (ts) {
          events.push({
            id: `wh_period_${wh.lastPeriodDate}`,
            type: 'pregnancy',
            timestamp: ts,
            title: 'Женский календарь: Начало цикла',
            subtitle: wh.cycleLength ? `Длительность цикла: ${wh.cycleLength} дн.` : undefined,
            category: 'female_health',
            severity: 'normal',
            sourceType: 'profile.womenHealth',
            cta: { label: 'Календарь здоровья', targetScreen: 'daily_checkin' },
          });
        }
      }
      if (wh.isPregnant && wh.dueDate) {
        const ts = this.normalizeDate(wh.dueDate);
        if (ts) {
          events.push({
            id: `wh_pregnancy_${wh.dueDate}`,
            type: 'pregnancy',
            timestamp: ts,
            title: 'Планируемая дата родов (ПДР)',
            subtitle: wh.currentWeek ? `Текущая неделя: ${wh.currentWeek}` : 'Беременность',
            category: 'pregnancy',
            severity: 'normal',
            sourceType: 'profile.womenHealth',
            cta: { label: 'Профиль беременности', targetScreen: 'profile' },
          });
        }
      }
    }

    // 9. Chronic Conditions / Diagnoses from Profile
    if (Array.isArray(profile.chronicConditions)) {
      for (const cond of profile.chronicConditions) {
        events.push({
          id: `diag_${cond.replace(/\s+/g, '_')}`,
          type: 'diagnosis',
          timestamp: this.normalizeDate(profile.createdAt || new Date().toISOString())!,
          title: `Диагноз / Состояние: ${cond}`,
          subtitle: 'Указано в медицинской карте',
          category: 'diagnoses',
          severity: 'attention',
          sourceType: 'profile.chronicConditions',
          cta: { label: 'Медицинский профиль', targetScreen: 'profile' },
        });
      }
    }

    // SORT ALL EVENTS CHRONOLOGICALLY DESCENDING (NEWEST FIRST)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const totalEvents = events.length;

    // FILTERING LOGIC
    let filtered = events;

    // Filter by Date Range `from`
    if (params.from) {
      const fromTime = new Date(params.from).getTime();
      if (!isNaN(fromTime)) {
        filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
      }
    }

    // Filter by Date Range `to`
    if (params.to) {
      const toTime = new Date(params.to).getTime();
      if (!isNaN(toTime)) {
        filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= toTime);
      }
    }

    // Filter by Event Types
    if (params.types && params.types.length > 0) {
      const validTypes = new Set(
        params.types.flatMap((t) => t.split(',').map((s) => s.trim().toLowerCase()))
      );
      filtered = filtered.filter((e) => validTypes.has(e.type.toLowerCase()));
    }

    const filteredEventsCount = filtered.length;

    // PAGINATION LOGIC
    const limit = Math.min(Math.max(params.limit || 20, 1), 100);
    let offset = 0;

    if (params.cursor) {
      const parsedOffset = parseInt(params.cursor, 10);
      if (!isNaN(parsedOffset) && parsedOffset >= 0) {
        offset = parsedOffset;
      }
    }

    const paginatedEvents = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < filteredEventsCount;
    const nextCursor = hasMore ? String(offset + limit) : null;

    return {
      profileId: userId,
      totalEvents,
      filteredEventsCount,
      from: params.from,
      to: params.to,
      types: params.types,
      nextCursor,
      hasMore,
      events: paginatedEvents,
    };
  }

  private normalizeDate(val?: string | number | Date | null): string | null {
    if (!val) return null;
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  }
}

export const timelineService = new TimelineService();
