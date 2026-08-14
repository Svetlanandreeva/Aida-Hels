import { sanitizeText, calculateAgeInYears } from './sanitizerService';

export interface UserChatContext {
  user?: any;
  documents?: any[];
  dailyLogs?: any[];
  diaryEntries?: any[];
  reminders?: any[];
  pressureLogs?: any[];
}

export function sanitizeChatResponse(text: string): string {
  if (!text) return '';

  let clean = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/###/g, '')
    .replace(/##/g, '')
    .replace(/#/g, '')
    .replace(/```[a-z]*/g, '')
    .replace(/```/g, '')
    .replace(/^[\s]*[-•*][\s]+/gm, '')
    .replace(/^[\s]*\d+\.[\s]+/gm, '')
    .replace(/---/g, '')
    .replace(/_/g, '')
    .replace(/`/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const parsed = JSON.parse(clean);
      clean = parsed.text || parsed.message || parsed.summary || '';
    } catch {
      clean = '';
    }
  }

  return clean;
}

const knownAverage = (rows: any[], keys: string[]): number | null => {
  const values = rows
    .map((row) => {
      for (const key of keys) {
        const value = row?.[key];
        if (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))) {
          return Number(value);
        }
      }
      return null;
    })
    .filter((value): value is number => value !== null);

  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
};

export function buildUserContextSummary(context: UserChatContext): string {
  const {
    user,
    documents = [],
    dailyLogs = [],
    diaryEntries = [],
    reminders = [],
    pressureLogs = [],
  } = context;

  if (!user) return 'Данные пользователя отсутствуют.';

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const recentByDays = (rows: any[], days: number, getDate: (row: any) => unknown) =>
    rows.filter((row) => {
      const raw = getDate(row);
      if (!raw) return false;
      const ts = new Date(String(raw)).getTime();
      return Number.isFinite(ts) && now - ts <= days * dayMs;
    });

  const logs7 = recentByDays(dailyLogs, 7, (row) => row.date || row.timestamp);
  const logs30 = recentByDays(dailyLogs, 30, (row) => row.date || row.timestamp);
  const bp7 = recentByDays(pressureLogs, 7, (row) => row.timestamp || row.date);
  const bp30 = recentByDays(pressureLogs, 30, (row) => row.timestamp || row.date);

  const recentDiary = diaryEntries.slice(0, 5).map((entry) => ({
    date: entry?.date || entry?.timestamp || null,
    mood: entry?.mood ?? null,
    anxiety: entry?.anxietyLevel ?? null,
    stress: entry?.stressLevel ?? null,
    content: typeof entry?.content === 'string' ? entry.content.substring(0, 100) : '',
  }));

  const labItems = documents.flatMap((doc) =>
    (doc?.deviations || []).map((dev: any) => ({
      marker: dev?.marker || null,
      value: dev?.value ?? null,
      norm: dev?.norm ?? null,
      status: dev?.status || null,
      sourceDate: doc?.researchDate || doc?.uploadDate || doc?.date || null,
    }))
  );

  const medications = reminders
    .filter((reminder) => reminder?.type === 'medication' && reminder?.title)
    .map((reminder) => reminder.title);

  const recentPressureEntries = pressureLogs.slice(-5).map((entry) => ({
    date: entry?.displayDate || entry?.date || entry?.timestamp || null,
    systolic: Number.isFinite(Number(entry?.systolic)) ? Number(entry.systolic) : null,
    diastolic: Number.isFinite(Number(entry?.diastolic)) ? Number(entry.diastolic) : null,
    pulse: Number.isFinite(Number(entry?.pulse)) ? Number(entry.pulse) : null,
    timeOfDay: entry?.timeOfDay || null,
    note: entry?.note || '',
  }));

  const hasAnyRealData =
    dailyLogs.length > 0 ||
    pressureLogs.length > 0 ||
    documents.length > 0 ||
    diaryEntries.length > 0 ||
    reminders.length > 0;

  const age = user?.birthDate ? calculateAgeInYears(user.birthDate) : null;

  const rawJson = JSON.stringify({
    patientRole: 'Пациент',
    ageInYears: Number.isFinite(Number(age)) ? Number(age) : null,
    registrationDate: user?.registrationDate || null,
    isQuestionnaireCompleted: Boolean(user?.isQuestionnaireCompleted),
    hasAnyRealData,
    dataPolicy: 'Любое отсутствующее значение считать неизвестным. Нельзя заменять null/нет данных на норму, среднее, типичное значение или предположение.',
    questionnaireHistoryCount: Array.isArray(user?.questionnaireHistory) ? user.questionnaireHistory.length : 0,
    psychologyState: user?.psychology || null,
    dynamics7Days: {
      avgStress: knownAverage(logs7, ['stress', 'stressLevel']),
      avgEnergy: knownAverage(logs7, ['energy', 'energyLevel']),
      avgSleepHours: knownAverage(logs7, ['sleepHours']),
      avgSystolicBP: knownAverage(bp7, ['systolic']),
      avgDiastolicBP: knownAverage(bp7, ['diastolic']),
      avgPulse: knownAverage(bp7, ['pulse']),
      dailyLogsCount: logs7.length,
      pressureLogsCount: bp7.length,
    },
    dynamics30Days: {
      dailyLogsCount: logs30.length,
      pressureLogsCount: bp30.length,
    },
    recentPressureLogs: recentPressureEntries,
    recentDiaryEntries: recentDiary,
    labItemsCount: labItems.length,
    labItems: labItems.slice(0, 10),
    chronicDiagnoses: Array.isArray(user?.chronicDiagnoses) ? user.chronicDiagnoses : [],
    allergies: Array.isArray(user?.allergies) ? user.allergies : [],
    currentMedications: medications,
  }, null, 2);

  return sanitizeText(rawJson);
}

/**
 * Safe local fallback used only when the AI service is unavailable.
 * It intentionally does not infer diagnoses, normality, causes, treatment,
 * target ranges, trends, or personalized medical recommendations.
 */
export function generateSmartHealthAdvice(_message: string, context: UserChatContext): string {
  const knownRecords =
    (context.documents?.length || 0) +
    (context.dailyLogs?.length || 0) +
    (context.diaryEntries?.length || 0) +
    (context.pressureLogs?.length || 0) +
    (context.reminders?.length || 0);

  if (knownRecords === 0) {
    return 'Сейчас ИИ-анализ недоступен, а в профиле пока недостаточно подтверждённых данных для персонального вывода. Добавьте измерение, запись дневника или исследование и попробуйте позже.';
  }

  return 'Сейчас ИИ-анализ временно недоступен. Ваши сохранённые данные остаются в профиле, но я не буду формировать медицинские выводы или рекомендации без работающего ИИ и достаточного контекста. Попробуйте ещё раз позже.';
}
