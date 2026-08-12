import { CanonicalUserData } from './canonicalDataLayer';
import { sanitizeText, calculateAgeInYears } from './sanitizerService';
import { permissionService, PermissionScope } from './permissionService';

export type QueryIntent =
  | 'vitals_bp'
  | 'labs'
  | 'medications'
  | 'symptoms'
  | 'daily_checkin'
  | 'cycle'
  | 'access'
  | 'general_health';

export interface NormalizedEvidenceItem {
  evidenceId: string;
  category: string;
  summary: string;
  provenance: 'YANDEX_VISION_OCR' | 'MANUAL_USER_ENTRY' | 'WEARABLE_DEVICE_SYNC' | 'AI_CHAT_CONFIRMED' | 'SYSTEM_DEFAULT';
  freshness: string; // e.g. "2026-08-11T20:00:00Z (1 день назад)"
  rawTimestamp: string;
  verificationStatus: 'VERIFIED' | 'STAGED' | 'UNVERIFIED_OCR';
  payload: Record<string, any>;
}

export interface MedicalSafetyRuleAlert {
  level: 'info' | 'warning' | 'critical';
  code: string;
  title: string;
  message: string;
}

export interface PipelineContextResult {
  requesterUserId: string;
  activeSubjectId: string;
  intent: QueryIntent;
  permissionGranted: boolean;
  permissionReason?: string;
  evidenceItems: NormalizedEvidenceItem[];
  isEmptyResult: boolean;
  alerts: MedicalSafetyRuleAlert[];
  promptContextString: string;
  sanitizedProfile: any;
}

export interface AiContextOptions {
  requesterUserId?: string;
  subjectProfileId?: string;
  queryTopic?: string;
  message?: string;
  includeRulesCheck?: boolean;
}

export class AiContextBuilder {
  /**
   * Requirement 17 Pipeline:
   * message → intent → active subject → permission filter → context query → normalization → rules/safety → compact context → LLM → response validation
   */
  public buildPipelineContext(data: CanonicalUserData, options: AiContextOptions = {}): PipelineContextResult {
    const requesterUserId = options.requesterUserId || 'user_demo_me';
    const rawMessage = options.message || options.queryTopic || '';

    // Stage 1: Detect Intent
    const intent = this.detectIntent(rawMessage);

    // Stage 2: Active Subject Determination
    const activeSubjectId = this.determineActiveSubject(rawMessage, options.subjectProfileId);

    // Stage 3: Permission Filter
    const targetScope = this.mapIntentToScope(intent);
    const permEval = permissionService.evaluateAccess({
      requesterUserId,
      targetSubjectProfileId: activeSubjectId,
      scope: targetScope,
      action: 'read',
    });

    if (!permEval.allowed) {
      const deniedContext = `[ОГРАНИЧЕНИЕ ДОСТУПА СЕМЕЙНОГО ШЕРИНГА (Permission Filter)]:
Запрос заблокирован. У вас (ID: ${requesterUserId}) нет действующих прав на просмотр данных субъекта "${activeSubjectId}".
Причина: ${permEval.reason}.
Инструкция ИИ: Сообщите пользователю, что для просмотра данных родственника требуется отправить запрос доступа в разделе «Семейный доступ».`;

      return {
        requesterUserId,
        activeSubjectId,
        intent,
        permissionGranted: false,
        permissionReason: permEval.reason,
        evidenceItems: [],
        isEmptyResult: true,
        alerts: [
          {
            level: 'critical',
            code: 'PERMISSION_DENIED',
            title: 'Доступ заблокирован фильтром разрешений',
            message: permEval.reason,
          },
        ],
        promptContextString: deniedContext,
        sanitizedProfile: data?.profile || {},
      };
    }

    // Stage 4 & 5: Context Query & Normalization
    const evidenceItems = this.queryAndNormalizeContext(data, intent, activeSubjectId);
    const isEmptyResult = evidenceItems.length === 0;

    // Stage 6: Rules & Safety Check
    const alerts = this.evaluateMedicalRules(data);

    // Stage 7: Build Compact Context String with Evidence Metadata (Provenance, Freshness, Verification Status, Evidence IDs)
    const promptContextString = this.assembleCompactContextString({
      data,
      activeSubjectId,
      intent,
      evidenceItems,
      isEmptyResult,
      alerts,
    });

    return {
      requesterUserId,
      activeSubjectId,
      intent,
      permissionGranted: true,
      evidenceItems,
      isEmptyResult,
      alerts,
      promptContextString,
      sanitizedProfile: data?.profile || {},
    };
  }

  /**
   * Compatibility wrapper for existing legacy calls
   */
  public buildContext(data: CanonicalUserData, options: AiContextOptions = {}) {
    const result = this.buildPipelineContext(data, options);
    return {
      promptContextString: result.promptContextString,
      alerts: result.alerts,
      sanitizedProfile: result.sanitizedProfile,
      pipelineResult: result,
    };
  }

  /**
   * Pipeline Stage 1: Detect Query Intent
   */
  public detectIntent(message: string): QueryIntent {
    if (!message) return 'general_health';
    const lower = message.toLowerCase();

    if (lower.includes('давлен') || lower.includes('пульс') || lower.includes('замер') || lower.includes('ад ') || lower.includes('систолич')) {
      return 'vitals_bp';
    }
    if (lower.includes('анализ') || lower.includes('кров') || lower.includes('гемоглоб') || lower.includes('биохими') || lower.includes('исслед') || lower.includes('лаборатор')) {
      return 'labs';
    }
    if (lower.includes('лекарст') || lower.includes('препарат') || lower.includes('таблет') || lower.includes('прием') || lower.includes('рецепт') || lower.includes('дозировк')) {
      return 'medications';
    }
    if (lower.includes('симптом') || lower.includes('боль') || lower.includes('болит') || lower.includes('тошнот') || lower.includes('слабост')) {
      return 'symptoms';
    }
    if (lower.includes('сон') || lower.includes('стресс') || lower.includes('настроен') || lower.includes('энерги') || lower.includes('дневник') || lower.includes('самочувств')) {
      return 'daily_checkin';
    }
    if (lower.includes('месячн') || lower.includes('цикл') || lower.includes('менструац')) {
      return 'cycle';
    }
    if (lower.includes('доступ') || lower.includes('шеринг') || lower.includes('разрешен') || lower.includes('права')) {
      return 'access';
    }

    return 'general_health';
  }

  /**
   * Pipeline Stage 2: Active Subject Identification
   */
  public determineActiveSubject(message: string, explicitSubjectId?: string): string {
    if (explicitSubjectId && explicitSubjectId !== 'self' && explicitSubjectId !== 'me') {
      return explicitSubjectId;
    }

    if (!message) return 'self';
    const lower = message.toLowerCase();

    if (lower.includes('мама') || lower.includes('мамы') || lower.includes('маме')) return 'mother';
    if (lower.includes('папа') || lower.includes('папы') || lower.includes('папе')) return 'father';
    if (lower.includes('сын') || lower.includes('сына') || lower.includes('сыну')) return 'son';
    if (lower.includes('дочь') || lower.includes('дочери')) return 'daughter';
    if (lower.includes('муж') || lower.includes('мужа')) return 'husband';
    if (lower.includes('жена') || lower.includes('жены')) return 'wife';

    return 'self';
  }

  private mapIntentToScope(intent: QueryIntent): PermissionScope {
    switch (intent) {
      case 'labs': return 'labs';
      case 'vitals_bp': return 'measurements';
      case 'medications': return 'medications';
      case 'symptoms': return 'conditions';
      case 'daily_checkin': return 'mental';
      case 'cycle': return 'cycle';
      case 'access': return 'safety';
      default: return 'measurements';
    }
  }

  /**
   * Pipeline Stage 4 & 5: Context Query & Normalization
   */
  private queryAndNormalizeContext(data: CanonicalUserData, intent: QueryIntent, activeSubjectId: string): NormalizedEvidenceItem[] {
    const items: NormalizedEvidenceItem[] = [];
    if (!data) return items;

    const { pressureLogs = [], documents = [], dailyLogs = [], diaryEntries = [], reminders = [] } = data;

    // Vitals (Pressure Logs)
    if (intent === 'vitals_bp' || intent === 'general_health') {
      pressureLogs.slice(0, 5).forEach((p, idx) => {
        const timestamp = p.timestamp || `${p.date || new Date().toISOString().split('T')[0]}T10:00:00.000Z`;
        items.push({
          evidenceId: p.id || `BP_MEASURE_${idx + 1}`,
          category: 'Измерение АД',
          summary: `АД: ${p.systolic}/${p.diastolic} мм рт. ст., Пульс: ${p.pulse || 72} уд/мин ${p.notes ? `(${sanitizeText(p.notes)})` : ''}`,
          provenance: p.source === 'wearable' ? 'WEARABLE_DEVICE_SYNC' : p.source === 'ai_chat_confirmed' ? 'AI_CHAT_CONFIRMED' : 'MANUAL_USER_ENTRY',
          freshness: this.calculateFreshness(timestamp),
          rawTimestamp: timestamp,
          verificationStatus: 'VERIFIED',
          payload: { systolic: p.systolic, diastolic: p.diastolic, pulse: p.pulse },
        });
      });
    }

    // Labs & Documents
    if (intent === 'labs' || intent === 'general_health') {
      documents.slice(0, 5).forEach((doc, idx) => {
        const timestamp = doc.createdAt || `${doc.date || new Date().toISOString().split('T')[0]}T12:00:00.000Z`;
        const hasDeviations = Array.isArray(doc.deviations) && doc.deviations.length > 0;
        const devSummary = hasDeviations
          ? doc.deviations.map((d: any) => `${d.marker}: ${d.value} ${d.unit || ''} (норма: ${d.referenceRange || 'н/д'})`).join('; ')
          : 'Отклонений не выявлено';

        items.push({
          evidenceId: doc.id || `DOC_LAB_${idx + 1}`,
          category: 'Лабораторный документ',
          summary: `${sanitizeText(doc.title)}: ${devSummary}`,
          provenance: doc.source === 'yandex_vision_ocr' ? 'YANDEX_VISION_OCR' : 'MANUAL_USER_ENTRY',
          freshness: this.calculateFreshness(timestamp),
          rawTimestamp: timestamp,
          verificationStatus: doc.status === 'processed' ? 'VERIFIED' : 'UNVERIFIED_OCR',
          payload: { title: doc.title, deviations: doc.deviations },
        });
      });
    }

    // Medications
    if (intent === 'medications' || intent === 'general_health') {
      reminders.filter((r) => r.isEnabled).forEach((m, idx) => {
        items.push({
          evidenceId: m.id || `MED_REMINDER_${idx + 1}`,
          category: 'Назначенный препарат',
          summary: `${sanitizeText(m.title)} (${m.dosage || 'дозировка не указана'}) в ${m.time || 'расписание'}`,
          provenance: 'MANUAL_USER_ENTRY',
          freshness: 'Активное назначение',
          rawTimestamp: new Date().toISOString(),
          verificationStatus: 'VERIFIED',
          payload: { title: m.title, dosage: m.dosage, time: m.time },
        });
      });
    }

    // Daily Logs & Symptoms
    if (intent === 'daily_checkin' || intent === 'symptoms' || intent === 'general_health') {
      dailyLogs.slice(0, 3).forEach((log, idx) => {
        const timestamp = `${log.date || new Date().toISOString().split('T')[0]}T20:00:00.000Z`;
        items.push({
          evidenceId: log.id || `DAILY_LOG_${idx + 1}`,
          category: 'Дневной самоконтроль',
          summary: `Энергия: ${log.energy}/10, Сон: ${log.sleep}ч, Стресс: ${log.stress}/10, Настроение: ${sanitizeText(log.mood || 'нормальное')}`,
          provenance: 'MANUAL_USER_ENTRY',
          freshness: this.calculateFreshness(timestamp),
          rawTimestamp: timestamp,
          verificationStatus: 'VERIFIED',
          payload: { energy: log.energy, sleep: log.sleep, stress: log.stress },
        });
      });
    }

    return items;
  }

  private calculateFreshness(timestampIso: string): string {
    if (!timestampIso) return 'Дата неизвестна';
    try {
      const now = new Date();
      const past = new Date(timestampIso);
      const diffMs = now.getTime() - past.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffHours < 1) return `Только что (${past.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})`;
      if (diffHours < 24) return `${diffHours} ч. назад (${past.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})`;

      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} дн. назад (${past.toISOString().split('T')[0]})`;
    } catch {
      return timestampIso;
    }
  }

  /**
   * Pipeline Stage 7: Assemble Compact Context String
   */
  private assembleCompactContextString(params: {
    data: CanonicalUserData;
    activeSubjectId: string;
    intent: QueryIntent;
    evidenceItems: NormalizedEvidenceItem[];
    isEmptyResult: boolean;
    alerts: MedicalSafetyRuleAlert[];
  }): string {
    const { data, activeSubjectId, intent, evidenceItems, isEmptyResult, alerts } = params;
    const profile = data?.profile || {};
    const age = calculateAgeInYears(profile.birthDate);
    const name = sanitizeText(profile.fullName || (activeSubjectId === 'self' ? 'Пациент' : activeSubjectId));

    let ctx = `=== AI CONTEXT BUILDER (PIPELINE STEP: COMPACT CONTEXT) ===\n`;
    ctx += `• Активный субъект: ${name} (ID: ${activeSubjectId})\n`;
    ctx += `• Возраст/пол: ${age ? `${age} лет` : 'Не указан'}, ${profile.gender === 'female' ? 'Женский' : 'Мужской'}\n`;
    ctx += `• Интенты запроса (Intent): ${intent.toUpperCase()}\n`;

    if (Array.isArray(profile.allergies) && profile.allergies.length > 0) {
      ctx += `• Аллергоанамнез (Аллергии): ${profile.allergies.map((a: string) => sanitizeText(a)).join(', ')}\n`;
    }

    ctx += `\n--- ДОКАЗАТЕЛЬНЫЕ ЗАПИСИ (EVIDENCE ITEMS: ${evidenceItems.length}) ---\n`;

    if (isEmptyResult) {
      ctx += `[ПУСТОЙ РЕЗУЛЬТАТ / EMPTY RESULT]: В канонической медкарте зафиксировано 0 записей по запросу "${intent}".\n`;
      ctx += `[СТРОГОЕ ПРАВИЛО ОТВЕТА (NO FALLBACK INVENTION - RULE 17)]:
ЗАПРЕЩЕНО выдумывать или подставлять "типичные", "средние" или предполагаемые значения от себя (например, запрещено писать "обычно у людей давление 120/80").
Ответь пользователю явно: «В вашей медкарте пока нет сохраненных записей по данному запросу. Вы можете внести их через дневник или чат.»\n`;
    } else {
      evidenceItems.forEach((item, idx) => {
        ctx += `${idx + 1}. [EVIDENCE_ID: ${item.evidenceId}] [КАТЕГОРИЯ: ${item.category}]\n`;
        ctx += `   - Данные: ${item.summary}\n`;
        ctx += `   - Provenance (Источник): ${item.provenance}\n`;
        ctx += `   - Freshness (Свежесть): ${item.freshness}\n`;
        ctx += `   - Verification Status: ${item.verificationStatus}\n\n`;
      });
    }

    if (alerts.length > 0) {
      ctx += `--- МЕДИЦИНСКИЕ ПРАВИЛА И КРИТИЧЕСКИЕ АЛЕРТЫ (${alerts.length}) ---\n`;
      alerts.forEach((alert) => {
        ctx += `[${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}\n`;
      });
    }

    return ctx;
  }

  /**
   * Pipeline Stage 9: Response Validation & Hallucination Guard
   * Ensures empty tool/query results were NOT replaced with invented fallback values "from oneself".
   */
  public validateLlmResponse(llmResponseText: string, pipelineResult: PipelineContextResult): {
    isValid: boolean;
    validatedResponseText: string;
    actionTaken?: string;
  } {
    if (!pipelineResult || !llmResponseText) {
      return { isValid: true, validatedResponseText: llmResponseText };
    }

    // Check if the context result was empty for vitals/labs/meds
    if (pipelineResult.isEmptyResult) {
      const lowerResp = llmResponseText.toLowerCase();

      // Check if response erroneously injected hallucinated specific numbers when data was empty
      const hasInventedBpNumber = pipelineResult.intent === 'vitals_bp' && /\b(1[0-9]{2}|2[0-0]{2})\/[6-9][0-9]\b/.test(llmResponseText);
      const hasInventedLabNumber = pipelineResult.intent === 'labs' && (lowerResp.includes('у вас гемоглобин') || lowerResp.includes('ваши анализы показывают'));

      if (hasInventedBpNumber || hasInventedLabNumber) {
        const correctedText = `По вашему запросу («${pipelineResult.intent}») записи в вашей медкарте пока отсутствуют. Пожалуйста, внесите последние результаты через дневник измерений или загрузите бланк исследования.`;
        return {
          isValid: false,
          validatedResponseText: correctedText,
          actionTaken: 'HALLUCINATED_FALLBACK_STRIPPED_RULE_17',
        };
      }
    }

    return { isValid: true, validatedResponseText: llmResponseText };
  }

  /**
   * Evaluates medical safety rules & alert triggers
   */
  public evaluateMedicalRules(data: CanonicalUserData): MedicalSafetyRuleAlert[] {
    const alerts: MedicalSafetyRuleAlert[] = [];
    if (!data) return alerts;

    const { pressureLogs = [], documents = [], profile = {} } = data;

    // Rule 1: High Hypertension Warning (>160/100)
    if (pressureLogs.length > 0) {
      const latestBp = pressureLogs[0];
      if ((latestBp.systolic && latestBp.systolic >= 160) || (latestBp.diastolic && latestBp.diastolic >= 100)) {
        alerts.push({
          level: 'critical',
          code: 'HYPERTENSION_CRITICAL',
          title: 'Высокое артериальное давление',
          message: `Зафиксировано АД ${latestBp.systolic}/${latestBp.diastolic} мм рт. ст. Требуется соблюдение покоя и рекомендаций врача.`,
        });
      }
    }

    // Rule 2: Severe Hemoglobin / Anemia Warning (<90 g/L)
    documents.forEach((doc) => {
      if (Array.isArray(doc.deviations)) {
        doc.deviations.forEach((dev: any) => {
          const markerLower = (dev.marker || '').toLowerCase();
          const valNum = parseFloat(dev.value);
          if ((markerLower.includes('гемоглобин') || markerLower.includes('hemoglobin')) && !isNaN(valNum) && valNum < 90) {
            alerts.push({
              level: 'warning',
              code: 'ANEMIA_SEVERE',
              title: 'Выраженное снижение гемоглобина',
              message: `Показатель гемоглобина ${valNum} г/л ниже допустимого уровня. Рекомендуется консультация терапевта/гематолога.`,
            });
          }
        });
      }
    });

    // Rule 3: Known Allergy Multi-Check
    if (Array.isArray(profile.allergies) && profile.allergies.length > 0) {
      alerts.push({
        level: 'info',
        code: 'ALLERGY_NOTICE',
        title: 'Учёт аллергоанамнеза',
        message: `У субъекта зарегистрированы аллергии: ${profile.allergies.join(', ')}. Учитывать при рекомендациях.`,
      });
    }

    return alerts;
  }
}

export const aiContextBuilder = new AiContextBuilder();
