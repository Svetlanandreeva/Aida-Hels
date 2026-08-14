import { GoogleGenAI } from '@google/genai';

export interface UrgentRedFlagAlert {
  id: string;
  title: string;
  description: string;
  criticalSymptoms: string[];
  recommendedAction: string;
  emergencyNumber: string;
}

export type HealthStatusLevel =
  | 'norm'
  | 'slight_deviation'
  | 'attention'
  | 'consultation_recommended'
  | 'urgent_help'
  | 'insufficient_data';

export type UrgencyLevel = 'planned' | 'soon' | 'urgent' | 'emergency';

export interface PossibleCause {
  title: string;
  description: string;
  category: 'common' | 'lifestyle' | 'medication' | 'doctor_check';
}

export interface DoctorRecommendation {
  specialty: string;
  reason: string;
  urgency: UrgencyLevel;
  urgencyLabel: string;
  timeframe: string;
  prepareItems: string[];
}

export interface HealthAttentionItem {
  id: string;
  markerId?: string;
  title: string;
  value?: string;
  unit?: string;
  reference?: string;
  severity: 'mild' | 'moderate' | 'high' | 'critical';
  statusLevel: HealthStatusLevel;
  shortSummary: string;
  plainExplanation: string;
  possibleCauses: PossibleCause[];
  safeActionsNow: string[];
  doctor: DoctorRecommendation;
  emergencySigns?: string;
  confidence: number;
  reasoningSources: Array<{ label: string; detail: string }>;
}

export interface BodySystemReport {
  id: string;
  name: string;
  status: HealthStatusLevel;
  statusLabel: string;
  score: number;
  briefComment: string;
  influencingMarkers: string[];
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
  normItems: string[];
  attentionItems: string[];
  nextAction: string;
  hasSufficientData: boolean;
}

export interface StructuredHealthAnalysis {
  overallStatus: HealthStatusLevel;
  overallScore: number;
  summary: string;
  confidence: number;
  dataCompleteness: number;
  urgentAlert: UrgentRedFlagAlert | null;
  positiveFactors: string[];
  negativeFactors: string[];
  calculationSources: Array<{ label: string; detail: string }>;
  attentionItems: HealthAttentionItem[];
  systems: BodySystemReport[];
  dailyRecommendations: string[];
  resourceForecast: {
    level: 'high' | 'medium' | 'low' | 'insufficient_data';
    description: string;
    drivers: string[];
  };
  disclaimer: string;
}

const SYSTEMS = [
  ['cardiovascular', 'Сердечно-сосудистая система'],
  ['nervous', 'Нервная система'],
  ['respiratory', 'Дыхательная система'],
  ['digestive', 'Пищеварительная система'],
  ['endocrine', 'Эндокринная система'],
  ['immune', 'Иммунная система'],
  ['urinary', 'Мочевыделительная система'],
  ['reproductive', 'Репродуктивная система'],
  ['musculoskeletal', 'Опорно-двигательный аппарат'],
  ['hematopoietic', 'Кроветворная система'],
  ['psychoemotional', 'Психоэмоциональная сфера'],
  ['metabolic', 'Обмен веществ'],
] as const;

function textCorpusFromData(data: any): string {
  const diaryEntries = Array.isArray(data?.diaryEntries) ? data.diaryEntries : [];
  return [
    data?.newSymptoms,
    data?.user?.psychology?.psychiatricData?.symptoms?.join?.(' '),
    ...diaryEntries.map((entry: any) =>
      [entry?.event_description, entry?.thoughts, entry?.additional_note].filter(Boolean).join(' ')
    ),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function checkRedFlags(data: any): UrgentRedFlagAlert | null {
  const text = textCorpusFromData(data);

  if (
    text.includes('покончить с собой') ||
    text.includes('хочу умереть') ||
    text.includes('суицид') ||
    text.includes('причинить себе вред')
  ) {
    return {
      id: 'redflag-mental-crisis',
      title: 'Нужна срочная помощь',
      description: 'В данных обнаружены слова, связанные с возможным риском причинения вреда себе.',
      criticalSymptoms: ['Высказывания о возможном самоповреждении или суициде'],
      recommendedAction: 'Не используйте приложение как замену экстренной помощи. Обратитесь к экстренным службам или к человеку, который может быть рядом.',
      emergencyNumber: '112',
    };
  }

  if (
    text.includes('острая боль за грудиной') ||
    text.includes('давящая боль в сердце') ||
    text.includes('перекосило лицо') ||
    text.includes('онемела вся рука') ||
    text.includes('потеря речи')
  ) {
    return {
      id: 'redflag-cardio-neuro',
      title: 'Возможны признаки экстренного состояния',
      description: 'В тексте есть симптомы, при которых нельзя полагаться на автоматический анализ приложения.',
      criticalSymptoms: ['Острая боль в груди или возможные признаки инсульта'],
      recommendedAction: 'Обратитесь за экстренной медицинской помощью.',
      emergencyNumber: '103 / 112',
    };
  }

  const documents = Array.isArray(data?.documents) ? data.documents : [];
  for (const doc of documents) {
    const deviations = Array.isArray(doc?.deviations) ? doc.deviations : [];
    for (const deviation of deviations) {
      const marker = String(deviation?.marker || '').toLowerCase();
      const raw = String(deviation?.value ?? '').replace(',', '.');
      const value = Number.parseFloat(raw);
      if (!Number.isFinite(value)) continue;

      if (marker.includes('гемоглобин') && value < 70) {
        return {
          id: 'redflag-severe-anemia',
          title: 'Критически низкое значение гемоглобина в предоставленных данных',
          description: `В загруженных данных указано значение гемоглобина ${deviation.value}.`,
          criticalSymptoms: [`Гемоглобин ${deviation.value}`],
          recommendedAction: 'Не полагайтесь на автоматический анализ. Срочно обратитесь за медицинской помощью для подтверждения результата и оценки состояния.',
          emergencyNumber: '103 / 112',
        };
      }

      if (marker.includes('калий') && value > 6.2) {
        return {
          id: 'redflag-hyperkalemia',
          title: 'Критически высокое значение калия в предоставленных данных',
          description: `В загруженных данных указано значение калия ${deviation.value}.`,
          criticalSymptoms: [`Калий ${deviation.value}`],
          recommendedAction: 'Не полагайтесь на автоматический анализ. Срочно обратитесь за медицинской помощью для подтверждения результата и оценки состояния.',
          emergencyNumber: '103 / 112',
        };
      }
    }
  }

  return null;
}

function observedSourceCount(data: any): number {
  let count = 0;
  if (Array.isArray(data?.documents) && data.documents.length > 0) count += 1;
  if (Array.isArray(data?.diaryEntries) && data.diaryEntries.length > 0) count += 1;
  if (data?.user?.isQuestionnaireCompleted === true) count += 1;
  if (data?.user?.psychology && Object.keys(data.user.psychology).length > 0) count += 1;
  if (data?.user?.womenHealth && Object.keys(data.user.womenHealth).length > 0) count += 1;
  return count;
}

function insufficientSystems(): BodySystemReport[] {
  return SYSTEMS.map(([id, name]) => ({
    id,
    name,
    status: 'insufficient_data',
    statusLabel: 'Недостаточно данных',
    score: 0,
    briefComment: 'Недостаточно подтверждённых данных для оценки этой системы.',
    influencingMarkers: [],
    trend: 'unknown',
    normItems: [],
    attentionItems: [],
    nextAction: 'Добавьте подтверждённые измерения, результаты исследований или записи наблюдений.',
    hasSufficientData: false,
  }));
}

/**
 * Fail-closed fallback. It deliberately does not infer normality, diagnoses,
 * causes, scores, recommendations, trends or resource forecasts from missing
 * or incomplete data. The only exception is deterministic red-flag detection.
 */
export function generateFallbackHealthAnalysis(data: any): StructuredHealthAnalysis {
  const urgentAlert = checkRedFlags(data);
  const sourceCount = observedSourceCount(data);

  return {
    overallStatus: urgentAlert ? 'urgent_help' : 'insufficient_data',
    overallScore: 0,
    summary: urgentAlert
      ? urgentAlert.description
      : 'Автоматический персональный анализ сейчас недоступен или данных недостаточно. Приложение не будет подставлять предполагаемые нормы, диагнозы, причины или рекомендации.',
    confidence: urgentAlert ? 0.9 : 0,
    dataCompleteness: Math.min(1, sourceCount / 5),
    urgentAlert,
    positiveFactors: [],
    negativeFactors: [],
    calculationSources: [],
    attentionItems: [],
    systems: insufficientSystems(),
    dailyRecommendations: [],
    resourceForecast: {
      level: 'insufficient_data',
      description: 'Недостаточно подтверждённых данных для прогноза.',
      drivers: [],
    },
    disclaimer: 'Приложение не ставит диагнозы и не заменяет врача. При недостатке подтверждённых данных медицинские выводы не формируются.',
  };
}

let quotaCooldownUntil = 0;

export function isGeminiQuotaExhausted(): boolean {
  return Date.now() < quotaCooldownUntil;
}

export function setGeminiQuotaExhaustedCooldown(seconds = 60) {
  quotaCooldownUntil = Date.now() + Math.max(1, seconds) * 1000;
}

function hasObservedEvidence(data: any): boolean {
  return observedSourceCount(data) > 0;
}

function normalizeGeminiAnalysis(raw: any, data: any): StructuredHealthAnalysis | null {
  if (!raw || typeof raw !== 'object' || !raw.overallStatus || !Array.isArray(raw.systems)) return null;
  if (!hasObservedEvidence(data)) return null;

  const allowedStatuses = new Set<HealthStatusLevel>([
    'norm',
    'slight_deviation',
    'attention',
    'consultation_recommended',
    'urgent_help',
    'insufficient_data',
  ]);

  const systems: BodySystemReport[] = SYSTEMS.map(([id, name]) => {
    const candidate = raw.systems.find((system: any) => system?.id === id || system?.name === name);
    if (!candidate || candidate.hasSufficientData !== true) {
      return insufficientSystems().find((system) => system.id === id)!;
    }

    const status: HealthStatusLevel = allowedStatuses.has(candidate.status)
      ? candidate.status
      : 'insufficient_data';

    if (status === 'insufficient_data') {
      return insufficientSystems().find((system) => system.id === id)!;
    }

    return {
      id,
      name,
      status,
      statusLabel: String(candidate.statusLabel || status),
      score: Number.isFinite(Number(candidate.score)) ? Math.max(0, Math.min(10, Number(candidate.score))) : 0,
      briefComment: String(candidate.briefComment || 'Вывод сформирован только по предоставленным данным.'),
      influencingMarkers: Array.isArray(candidate.influencingMarkers) ? candidate.influencingMarkers.map(String) : [],
      trend: ['improving', 'stable', 'declining', 'unknown'].includes(candidate.trend) ? candidate.trend : 'unknown',
      normItems: Array.isArray(candidate.normItems) ? candidate.normItems.map(String) : [],
      attentionItems: Array.isArray(candidate.attentionItems) ? candidate.attentionItems.map(String) : [],
      nextAction: String(candidate.nextAction || ''),
      hasSufficientData: true,
    };
  });

  return {
    overallStatus: allowedStatuses.has(raw.overallStatus) ? raw.overallStatus : 'insufficient_data',
    overallScore: Number.isFinite(Number(raw.overallScore)) ? Math.max(0, Math.min(10, Number(raw.overallScore))) : 0,
    summary: String(raw.summary || ''),
    confidence: Number.isFinite(Number(raw.confidence)) ? Math.max(0, Math.min(1, Number(raw.confidence))) : 0,
    dataCompleteness: Number.isFinite(Number(raw.dataCompleteness)) ? Math.max(0, Math.min(1, Number(raw.dataCompleteness))) : 0,
    urgentAlert: checkRedFlags(data),
    positiveFactors: Array.isArray(raw.positiveFactors) ? raw.positiveFactors.map(String) : [],
    negativeFactors: Array.isArray(raw.negativeFactors) ? raw.negativeFactors.map(String) : [],
    calculationSources: Array.isArray(raw.calculationSources)
      ? raw.calculationSources
          .filter((source: any) => source && (source.label || source.detail))
          .map((source: any) => ({ label: String(source.label || ''), detail: String(source.detail || '') }))
      : [],
    attentionItems: Array.isArray(raw.attentionItems) ? raw.attentionItems : [],
    systems,
    dailyRecommendations: Array.isArray(raw.dailyRecommendations) ? raw.dailyRecommendations.map(String) : [],
    resourceForecast: raw.resourceForecast && typeof raw.resourceForecast === 'object'
      ? {
          level: ['high', 'medium', 'low', 'insufficient_data'].includes(raw.resourceForecast.level)
            ? raw.resourceForecast.level
            : 'insufficient_data',
          description: String(raw.resourceForecast.description || ''),
          drivers: Array.isArray(raw.resourceForecast.drivers) ? raw.resourceForecast.drivers.map(String) : [],
        }
      : { level: 'insufficient_data', description: 'Недостаточно подтверждённых данных для прогноза.', drivers: [] },
    disclaimer: String(raw.disclaimer || 'Информация не является медицинским диагнозом или назначением лечения.'),
  };
}

export async function analyzeHealthWithGeminiOrFallback(
  aiClient: GoogleGenAI | null,
  data: any
): Promise<{ analysis: StructuredHealthAnalysis; mode: 'gemini' | 'rule_fallback' }> {
  const urgentRedFlag = checkRedFlags(data);
  if (urgentRedFlag) {
    return { analysis: generateFallbackHealthAnalysis(data), mode: 'rule_fallback' };
  }

  if (!hasObservedEvidence(data) || !aiClient || isGeminiQuotaExhausted()) {
    return { analysis: generateFallbackHealthAnalysis(data), mode: 'rule_fallback' };
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Проанализируй только предоставленные данные пользователя. Не заполняй пропуски и не делай вывод о норме при отсутствии конкретного измерения. Данные: ${JSON.stringify(data)}`,
      config: {
        systemInstruction: `Ты — медицинский информационный ассистент. Используй только факты из входных данных. Нельзя придумывать значения, нормы, диагнозы, причины, лекарства, дозировки, результаты исследований, симптомы или историю. Для любой системы без достаточных подтверждённых данных укажи status="insufficient_data", score=0, hasSufficientData=false. Не трактуй отсутствие отклонений как норму. Верни строгий JSON StructuredHealthAnalysis.`,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const normalized = normalizeGeminiAnalysis(parsed, data);
    if (!normalized) {
      return { analysis: generateFallbackHealthAnalysis(data), mode: 'rule_fallback' };
    }
    return { analysis: normalized, mode: 'gemini' };
  } catch (err: any) {
    const message = String(err?.message || '');
    const isQuotaError = err?.status === 429 || /RESOURCE_EXHAUSTED|quota|429/i.test(message);
    if (isQuotaError) setGeminiQuotaExhaustedCooldown(60);
    console.warn('Gemini health analysis unavailable:', message || err);
    return { analysis: generateFallbackHealthAnalysis(data), mode: 'rule_fallback' };
  }
}
