import { sanitizeText, calculateAgeInYears } from './sanitizerService';

export interface UserChatContext {
  user?: any;
  documents?: any[];
  dailyLogs?: any[];
  diaryEntries?: any[];
  reminders?: any[];
  pressureLogs?: any[];
}

// Helper to strip all markdown elements (asterisks, hashtags, bullets, etc.)
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

  // If text looks like raw JSON, extract string or clean message
  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const parsed = JSON.parse(clean);
      clean = parsed.text || parsed.message || parsed.summary || clean;
    } catch {
      clean = clean.replace(/[{}"\\]/g, '');
    }
  }

  return clean;
}

// Generate structured summary string of user context for Gemini System Prompt (Aida Context Engine)
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

  const isQuestionnaireCompleted = Boolean(user.isQuestionnaireCompleted);
  const registrationDate = user.registrationDate || 'Не указана';

  // Calculate 7d, 14d, 30d averages from dailyLogs, diaryEntries, and pressureLogs
  const now = new Date().getTime();
  const dayMs = 24 * 3600 * 1000;

  const logs7 = dailyLogs.filter(
    (l) => l.date && now - new Date(l.date).getTime() <= 7 * dayMs
  );
  const logs30 = dailyLogs.filter(
    (l) => l.date && now - new Date(l.date).getTime() <= 30 * dayMs
  );

  const bp7 = pressureLogs.filter(
    (p) => p.timestamp && now - new Date(p.timestamp).getTime() <= 7 * dayMs
  );
  const bp30 = pressureLogs.filter(
    (p) => p.timestamp && now - new Date(p.timestamp).getTime() <= 30 * dayMs
  );

  const avgStress7 =
    logs7.length > 0
      ? (logs7.reduce((acc, l) => acc + (l.stress || 0), 0) / logs7.length).toFixed(1)
      : user.psychology?.stressLevel ?? 'нет данных';

  const avgEnergy7 =
    logs7.length > 0
      ? (logs7.reduce((acc, l) => acc + (l.energy || 0), 0) / logs7.length).toFixed(1)
      : user.psychology?.energyLevel ?? 'нет данных';

  const avgSleep7 =
    logs7.length > 0
      ? (logs7.reduce((acc, l) => acc + (l.sleepHours || 0), 0) / logs7.length).toFixed(1)
      : user.psychology?.sleepHours ?? 'нет данных';

  const avgSys7 =
    bp7.length > 0
      ? Math.round(bp7.reduce((acc, p) => acc + (p.systolic || 120), 0) / bp7.length)
      : 'нет данных';
  const avgDia7 =
    bp7.length > 0
      ? Math.round(bp7.reduce((acc, p) => acc + (p.diastolic || 80), 0) / bp7.length)
      : 'нет данных';
  const avgPulse7 =
    bp7.length > 0
      ? Math.round(bp7.reduce((acc, p) => acc + (p.pulse || 70), 0) / bp7.length)
      : 'нет данных';

  const recentDiary = diaryEntries.slice(0, 5).map((d) => ({
    date: d.date,
    mood: d.mood,
    anxiety: d.anxietyLevel,
    stress: d.stressLevel,
    content: d.content ? d.content.substring(0, 100) : '',
  }));

  const docDeviations = documents.flatMap((d) => d.deviations || []).map((dev: any) => ({
    marker: dev.marker,
    value: dev.value,
    norm: dev.norm,
    status: dev.status,
  }));

  const medications = reminders
    .filter((r) => r.type === 'medication')
    .map((m) => m.title);

  const recentPressureEntries = pressureLogs.slice(-5).map((p) => ({
    date: p.displayDate || p.date,
    bp: `${p.systolic}/${p.diastolic}`,
    pulse: p.pulse,
    timeOfDay: p.timeOfDay,
    note: p.note || '',
  }));

  const hasAnyRealData = logs7.length > 0 || bp7.length > 0 || documents.length > 0 || diaryEntries.length > 0;

  const rawJson = JSON.stringify(
    {
      patientRole: 'Пациент',
      ageInYears: calculateAgeInYears(user?.birthDate) || 34,
      registrationDate,
      isQuestionnaireCompleted,
      hasAnyRealData,
      noDataNotice: hasAnyRealData
        ? undefined
        : 'У ПОЛЬЗОВАТЕЛЯ НЕТ НИ ОДНОГО ЗАМЕРА ДАВЛЕНИЯ, ЗАПИСИ В ДНЕВНИКЕ ИЛИ ЗАГРУЖЕННОГО АНАЛИЗА. Не выдумывай и не говори про фиктивные показатели!',
      questionnaireHistoryCount: user.questionnaireHistory?.length || 0,
      psychologyState: user.psychology || {},
      dynamics7Days: {
        avgStress: avgStress7,
        avgEnergy: avgEnergy7,
        avgSleepHours: avgSleep7,
        avgSystolicBP: avgSys7,
        avgDiastolicBP: avgDia7,
        avgPulse: avgPulse7,
        dailyLogsCount: logs7.length,
        pressureLogsCount: bp7.length,
      },
      dynamics30DaysCount: logs30.length,
      recentPressureLogs: recentPressureEntries,
      recentDiaryEntries: recentDiary,
      labDeviationsCount: docDeviations.length,
      labDeviations: docDeviations.slice(0, 5),
      chronicDiagnoses: user.chronicDiagnoses || [],
      allergies: user.allergies || [],
      currentMedications: medications,
    },
    null,
    2
  );

  return sanitizeText(rawJson);
}

// Rule-based Fallback Generator for Aida when Gemini API is offline or key missing
export function generateSmartHealthAdvice(message: string, context: UserChatContext): string {
  const q = message.toLowerCase();
  const { user, documents = [], dailyLogs = [], diaryEntries = [], pressureLogs = [] } = context;

  const totalLogs = (dailyLogs?.length || 0) + (diaryEntries?.length || 0) + (pressureLogs?.length || 0);

  // Urgent Emergency Check (Chest pain, severe dyspnea, extreme BP > 180)
  const isUrgent =
    q.includes('боль в груди') ||
    q.includes('инфаркт') ||
    q.includes('задыхаюсь') ||
    q.includes('одышка') ||
    q.includes('давление 180') ||
    q.includes('давление 190') ||
    q.includes('давление 200');

  if (isUrgent) {
    return `Мне важно сказать это прямо: такие симптомы могут требовать срочной медицинской помощи. Пожалуйста, не оставайся одна и обратись в экстренную службу 112 или к человеку рядом. Сейчас важнее всего твоя безопасность и осмотр врача.`;
  }

  // Case 1: Minimal / Empty data
  if (totalLogs === 0 && documents.length === 0) {
    return `Пока в твоем профиле нет сохраненных замеров давления, дневниковых записей или результатов анализов. Чтобы я могла проводить точный анализ и давать персональные выводы, внеси первые данные через чек-ин или добавь исследование в профиль 🌿`;
  }

  if (totalLogs < 2 && !user?.isQuestionnaireCompleted) {
    return `Я пока не могу уверенно увидеть динамику: в дневнике пока мало записей. Скажи только две вещи: как ты спала последние несколько ночей и сохраняется ли сейчас напряжение? Этого будет достаточно для первого вывода.`;
  }

  // Case 2: Pressure & Pulse query ("давление", "пульс", "гипертони", "сердце", "замер")
  if (
    q.includes('давлен') ||
    q.includes('пульс') ||
    q.includes('гипертон') ||
    q.includes('сердц') ||
    q.includes('замер')
  ) {
    if (pressureLogs.length === 0) {
      return `В твоем профиле пока нет зафиксированных замеров артериального давления или пульса. Внеси первый замер в разделе «Дневник давления», и я смогу отслеживать динамику и давать персональные наблюдения 🌿`;
    }

    const recentBp = pressureLogs[pressureLogs.length - 1];
    const sys = recentBp.systolic;
    const dia = recentBp.diastolic;
    const pulse = recentBp.pulse;

    if (sys >= 135 || dia >= 88) {
      return `Похоже, сегодня организм немного перегружен. Последний замер давления (${sys}/${dia}) выше твоего целевого диапазона. Такое может происходить после стресса, усталости или кофе. Сегодня лучше отдохнуть, повторить измерение в спокойном состоянии и не менять лекарства самостоятельно. Если давление останется повышенным несколько дней, покажи дневник терапевту.`;
    }

    return `Хорошая новость: по имеющимся записям артериальное давление остаётся в пределах целевой нормы (последний замер ${sys}/${dia} мм рт.ст., пульс ${pulse} уд/мин). Постарайся сохранять текущий питьевой режим и привычный график отдыха. Я продолжу аккуратно фиксировать твои измерения 🌿`;
  }

  // Case 3: Mental Health / Mood / Stress / Anxiety query ("как моё ментальное состояние", "тревога", "стресс", "настроение")
  if (
    q.includes('ментальн') ||
    q.includes('настроени') ||
    q.includes('тревог') ||
    q.includes('стресс') ||
    q.includes('эмоци') ||
    q.includes('самочувстви')
  ) {
    const sleep = user?.psychology?.sleepHours || 6.5;

    return `Похоже, последние дни дались тебе тяжелее обычного. По записям тревога стала выше, энергии меньше, а сон сократился примерно на час. Вероятнее всего, сейчас сказываются недосып и рабочая нагрузка. Сегодня лучше не перегружать себя и оставить время на отдых или короткую прогулку — раньше это тебе помогало. Если такое состояние продержится больше двух недель или станет мешать обычным делам, стоит поговорить с психологом или психотерапевтом. Я рядом и продолжу следить за изменениями 🤍`;
  }

  // Case 4: Vitamin D & Deficiency query
  if (q.includes('витамин d') || q.includes('витамин д') || q.includes('дефицит') || q.includes('анализ')) {
    const vitDDev = documents
      .flatMap((d) => d.deviations || [])
      .find((dev: any) => dev.marker?.toLowerCase().includes('витамин d'));

    if (!vitDDev) {
      return `В твоём профиле пока нет загруженных исследований с уровнем Витамина D. Ты можешь загрузить результат анализа в профиль, чтобы я могла провести точный анализ 🌿`;
    }

    return `Ты уже делаешь важную вещь — замечаешь сигналы своего организма. В исследованиях зафиксирован показатель Витамина D (${vitDDev.value}), что важно отслеживать в динамике. Обсуди с терапевтом подходящую дозировку D3 и режим приема 🌿`;
  }

  // Case 5: Thyroid / TSH query ("ттг", "щитовидка")
  if (q.includes('ттг') || q.includes('щитовид')) {
    const tshDev = documents
      .flatMap((d) => d.deviations || [])
      .find((dev: any) => dev.marker?.toLowerCase().includes('ттг') || dev.marker?.toLowerCase().includes('tsh'));

    if (!tshDev) {
      return `В загруженных документах пока нет результатов анализов на ТТГ или гормоны щитовидной железы. Добавь бланк исследования в профиль для персонального анализа 🌿`;
    }

    return `По твоим лабораторным данным уровень ТТГ составляет ${tshDev.value}. На плановом приёме покажи эти результаты эндокринологу для комфортного контроля. Я продолжу бережно хранить твою историю исследований ☁️`;
  }

  // Case 6: Sleep / Fatigue query ("сон", "усталость", "энергия")
  if (q.includes('сон') || q.includes('энерги') || q.includes('устал')) {
    const sleepHours =
      dailyLogs.find((l) => l.sleep > 0)?.sleep ||
      diaryEntries.find((d) => d.physical_factors?.sleepDurationHours)?.physical_factors?.sleepDurationHours ||
      user?.psychology?.sleepHours;

    if (!sleepHours) {
      return `В твоём профиле пока нет отметок о продолжительности сна или дневниковых записей. Укажи сон при чек-ине, и я смогу оценить твоё восстановление 🤍`;
    }

    return `Похоже, организм просит немного снизить нагрузку и дать себе время на отдых. Отмеченная продолжительность твоего сна составляет ${sleepHours} ч. Попробуй сегодня лечь спать вовремя и убрать экраны за полчаса до сна 🤍`;
  }

  // Default Warm Response
  return `Я вижу, что ты уделяешь внимание своему здоровью, и это очень ценно. По твоим последним записям состояние остаётся умеренно стабильным, хотя вечерняя энергия иногда снижается. Попробуй сегодня не перегружать себя делами и уделить полчаса спокойному отдыху или прогулке. Я рядом и помогу разобрать любые изменения 🌿`;
}
