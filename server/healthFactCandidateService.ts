import { aiToolsService, generateConfirmationToken, CandidateRecord } from './aiToolsService';
import { canonicalDataLayer } from './canonicalDataLayer';
import { auditProvenanceService } from './auditProvenanceService';

export interface HealthFactExtractionResult {
  hasFact: boolean;
  factCategory?: 'measurement' | 'symptom' | 'medication' | 'cycle_event' | 'lab_result';
  rawInput: string;
  title: string;
  description: string;
  subject: {
    id: string; // 'self' or relative id
    name: string; // 'Я (владелец)', 'Мама', 'Сын'
  };
  dateResolution: {
    raw: string; // e.g., "вчера"
    resolvedIso: string; // e.g., "2026-08-11T20:00:00.000Z"
    isRelative: boolean;
  };
  extractedFields: Record<string, any>;
  schemaValidation: {
    isValid: boolean;
    statusText: string;
    needsClarification: boolean;
    clarificationPrompt?: string;
    fieldValidations: Array<{ field: string; value: any; valid: boolean; note?: string }>;
  };
}

export const healthFactCandidateService = {
  /**
   * Natural Language Health Fact Parser & Schema Validator
   * Implements Requirement 16 Flow:
   * natural language → candidate → schema validation → уточнение даты/subject при необходимости → preview/confirmation → canonical write
   */
  parseFactFromMessage(message: string, baseTimeIso?: string): HealthFactExtractionResult | null {
    if (!message || typeof message !== 'string') return null;

    const lower = message.toLowerCase().trim();
    const now = baseTimeIso ? new Date(baseTimeIso) : new Date();

    // 1. RESOLVE DATE/TIME FROM NATURAL LANGUAGE
    let dateRaw = 'сегодня';
    let isRelativeDate = false;
    const targetDate = new Date(now);

    if (lower.includes('позавчера')) {
      dateRaw = 'позавчера';
      isRelativeDate = true;
      targetDate.setDate(targetDate.getDate() - 2);
    } else if (lower.includes('вчера')) {
      dateRaw = 'вчера';
      isRelativeDate = true;
      targetDate.setDate(targetDate.getDate() - 1);
    } else if (lower.includes('дней назад') || lower.includes('дня назад')) {
      const match = lower.match(/(\d+)\s*(дней|дня)\s*назад/);
      if (match) {
        const days = parseInt(match[1], 10);
        dateRaw = `${days} дн. назад`;
        isRelativeDate = true;
        targetDate.setDate(targetDate.getDate() - days);
      }
    } else if (lower.includes('утром')) {
      dateRaw = 'сегодня утром';
      targetDate.setHours(9, 0, 0, 0);
    } else if (lower.includes('вечером')) {
      dateRaw = 'сегодня вечером';
      targetDate.setHours(20, 0, 0, 0);
    }

    const resolvedIso = targetDate.toISOString();

    // 2. RESOLVE SUBJECT PROFILE
    let subjectId = 'self';
    let subjectName = 'Я (владелец)';
    let subjectNeedsClarification = false;

    if (lower.includes('у мамы') || lower.includes('мама')) {
      subjectId = 'mother';
      subjectName = 'Мама';
    } else if (lower.includes('у папы') || lower.includes('папа')) {
      subjectId = 'father';
      subjectName = 'Папа';
    } else if (lower.includes('у сына') || lower.includes('сын') || lower.includes('ребенок')) {
      subjectId = 'son';
      subjectName = 'Сын';
    } else if (lower.includes('у дочери') || lower.includes('дочь')) {
      subjectId = 'daughter';
      subjectName = 'Дочь';
    } else if (lower.includes('у мужа') || lower.includes('муж')) {
      subjectId = 'husband';
      subjectName = 'Муж';
    } else if (lower.includes('у жены') || lower.includes('жена')) {
      subjectId = 'wife';
      subjectName = 'Жена';
    }

    // 3. FACT CATEGORY EXTRACTION & SCHEMA VALIDATION

    // --- CATEGORY A: MEASUREMENT (BP, Pulse, Glucose, Temp, Weight) ---
    // A1: Blood Pressure e.g. "145/90", "145 на 90", "давление 130/80"
    const bpMatch = lower.match(/(\d{2,3})[\s\/\\]+(на\s+)?(\d{2,3})/);
    const hasBpKeyword = lower.includes('давлен') || lower.includes('ад') || lower.includes('замер') || lower.includes('мм рт');
    
    if (bpMatch && (hasBpKeyword || bpMatch[1].length >= 2)) {
      const systolic = parseInt(bpMatch[1], 10);
      const diastolic = parseInt(bpMatch[3], 10);

      // Pulse check in same string
      const pulseMatch = lower.match(/(пульс|чсс|сердце)\s*(\d{2,3})/);
      const pulse = pulseMatch ? parseInt(pulseMatch[2], 10) : undefined;

      // Schema Validation
      const sysValid = systolic >= 60 && systolic <= 260;
      const diaValid = diastolic >= 40 && diastolic <= 160 && diastolic < systolic;
      const pulseValid = pulse ? pulse >= 35 && pulse <= 220 : true;

      const isValid = sysValid && diaValid && pulseValid;

      return {
        hasFact: true,
        factCategory: 'measurement',
        rawInput: message,
        title: `Артериальное давление: ${systolic}/${diastolic} мм рт. ст.`,
        description: `Зафиксировано из чата (${dateRaw}). Субъект: ${subjectName}.`,
        subject: { id: subjectId, name: subjectName },
        dateResolution: { raw: dateRaw, resolvedIso, isRelative: isRelativeDate },
        extractedFields: {
          metricType: 'bp',
          systolic,
          diastolic,
          pulse,
          unit: 'мм рт. ст.',
        },
        schemaValidation: {
          isValid,
          statusText: isValid ? 'Схема валидна (100% сопоставимость)' : 'Требует уточнения показателей',
          needsClarification: !isValid || subjectNeedsClarification,
          clarificationPrompt: !isValid
            ? 'Систолическое давление должно быть выше диастолического в физиологических пределах.'
            : undefined,
          fieldValidations: [
            { field: 'systolic', value: systolic, valid: sysValid, note: sysValid ? 'Норма диапозона' : 'Аномальное значение' },
            { field: 'diastolic', value: diastolic, valid: diaValid, note: diaValid ? 'Норма диапазона' : 'Должно быть ниже систолического' },
            ...(pulse ? [{ field: 'pulse', value: pulse, valid: pulseValid, note: pulseValid ? 'Пульс в пределах нормы' : 'Проверьте пульс' }] : []),
          ],
        },
      };
    }

    // A2: Glucose / Blood Sugar e.g., "сахар 6.2", "глюкоза 5.8"
    const glucoseMatch = lower.match(/(сахар|глюкоз\w*)\s*(\d+([.,]\d+)?)/);
    if (glucoseMatch) {
      const value = parseFloat(glucoseMatch[2].replace(',', '.'));
      const isValid = value >= 1.0 && value <= 35.0;

      return {
        hasFact: true,
        factCategory: 'measurement',
        rawInput: message,
        title: `Уровень глюкозы крови: ${value} ммоль/л`,
        description: `Зафиксировано из чата (${dateRaw}). Субъект: ${subjectName}.`,
        subject: { id: subjectId, name: subjectName },
        dateResolution: { raw: dateRaw, resolvedIso, isRelative: isRelativeDate },
        extractedFields: {
          metricType: 'glucose',
          value,
          unit: 'ммоль/л',
          context: lower.includes('натощак') ? 'fasting' : lower.includes('после еды') ? 'postprandial' : 'random',
        },
        schemaValidation: {
          isValid,
          statusText: isValid ? 'Схема валидна (Глюкоза)' : 'Выход за пределы физиологической нормы',
          needsClarification: !isValid,
          fieldValidations: [
            { field: 'glucose', value, valid: isValid, note: isValid ? 'Допустимый диапазон 1.0 - 35.0 ммоль/л' : 'Критический показатель' },
          ],
        },
      };
    }

    // A3: Temperature e.g., "температура 37.8", "38.2 с утра"
    const tempMatch = lower.match(/(температур\w*|темп\.?)\s*(\d{2}([.,]\d+)?)/) || lower.match(/(\d{2}[.,]\d)\s*(град|градус|°c|c)?/);
    if (tempMatch && (lower.includes('темпер') || lower.includes('град') || lower.includes('°'))) {
      const valStr = tempMatch[2] || tempMatch[1];
      const value = parseFloat(valStr.replace(',', '.'));
      if (value >= 34.0 && value <= 42.5) {
        return {
          hasFact: true,
          factCategory: 'measurement',
          rawInput: message,
          title: `Температура тела: ${value} °C`,
          description: `Зафиксировано из чата (${dateRaw}). Субъект: ${subjectName}.`,
          subject: { id: subjectId, name: subjectName },
          dateResolution: { raw: dateRaw, resolvedIso, isRelative: isRelativeDate },
          extractedFields: {
            metricType: 'temperature',
            value,
            unit: '°C',
          },
          schemaValidation: {
            isValid: true,
            statusText: 'Схема валидна (Температура)',
            needsClarification: false,
            fieldValidations: [
              { field: 'temperature', value, valid: true, note: 'Норма диапазона 34.0 - 42.5 °C' },
            ],
          },
        };
      }
    }

    // A4: Weight e.g., "вес 74.5", "похудел до 72 кг"
    const weightMatch = lower.match(/(вес|похудел|набрал)\s*(до\s*)?(\d{2,3}([.,]\d+)?)\s*(кг|кило)?/);
    if (weightMatch && (lower.includes('вес') || lower.includes('кг') || lower.includes('похудел') || lower.includes('набрал'))) {
      const value = parseFloat(weightMatch[3].replace(',', '.'));
      if (value >= 20.0 && value <= 300.0) {
        return {
          hasFact: true,
          factCategory: 'measurement',
          rawInput: message,
          title: `Масса тела (Вес): ${value} кг`,
          description: `Зафиксировано из чата (${dateRaw}). Субъект: ${subjectName}.`,
          subject: { id: subjectId, name: subjectName },
          dateResolution: { raw: dateRaw, resolvedIso, isRelative: isRelativeDate },
          extractedFields: {
            metricType: 'weight',
            value,
            unit: 'кг',
          },
          schemaValidation: {
            isValid: true,
            statusText: 'Схема валидна (Вес)',
            needsClarification: false,
            fieldValidations: [
              { field: 'weight', value, valid: true, note: 'Норма диапозона' },
            ],
          },
        };
      }
    }

    // --- CATEGORY B: SYMPTOM (Headache, Pain, Nausea, Fatigue) ---
    const symptomKeywords = ['боль', 'болит', 'тошнот', 'изжог', 'слабость', 'головокружен', 'озноб', 'кашель', 'одышка', 'спазм'];
    const matchedKeyword = symptomKeywords.find((kw) => lower.includes(kw));

    if (matchedKeyword) {
      // Look for pain severity rating e.g., "7 из 10", "5/10", "сильная"
      const scaleMatch = lower.match(/(\d{1,2})\s*(из|\/)\s*10/);
      let severity = scaleMatch ? parseInt(scaleMatch[1], 10) : 5;
      if (lower.includes('сильн') || lower.includes('острой')) severity = Math.max(severity, 7);
      if (lower.includes('слаб') || lower.includes('легк')) severity = Math.min(severity, 3);

      const symptomTitle = lower.includes('головн')
        ? 'Головная боль'
        : lower.includes('тошнот')
        ? 'Тошнота'
        : lower.includes('живот') || lower.includes('желуд')
        ? 'Боль в животе'
        : lower.includes('спин') || lower.includes('поясниц')
        ? 'Боль в спине'
        : `Симптом: ${matchedKeyword}`;

      return {
        hasFact: true,
        factCategory: 'symptom',
        rawInput: message,
        title: `Симптом: ${symptomTitle} (${severity}/10)`,
        description: `Зафиксирован симптом из сообщения (${dateRaw}). Субъект: ${subjectName}.`,
        subject: { id: subjectId, name: subjectName },
        dateResolution: { raw: dateRaw, resolvedIso, isRelative: isRelativeDate },
        extractedFields: {
          symptomName: symptomTitle,
          severity,
          notes: message,
        },
        schemaValidation: {
          isValid: severity >= 1 && severity <= 10,
          statusText: 'Схема валидна (Шкала интенсивности симптома)',
          needsClarification: false,
          fieldValidations: [
            { field: 'severity', value: `${severity}/10`, valid: true, note: 'Индивидуальная шкала боли' },
          ],
        },
      };
    }

    // --- CATEGORY C: MEDICATION (Taken Meds) ---
    const medKeywords = ['принял', 'выпил', 'приняла', 'выпила', 'таблетк', 'доза', 'капотен', 'нурофен', 'парацетамол', 'цитрамон', 'аспирин', 'но-шпа'];
    const matchedMed = medKeywords.find((kw) => lower.includes(kw));

    if (matchedMed) {
      // Try extracting medication name and dosage
      const doseMatch = lower.match(/(\d+)\s*(мг|г|мл|табл|капсул)/);
      const dose = doseMatch ? `${doseMatch[1]} ${doseMatch[2]}` : '1 доза';

      let medName = 'Лекарственный препарат';
      if (lower.includes('капотен')) medName = 'Капотен';
      else if (lower.includes('нурофен')) medName = 'Нурофен';
      else if (lower.includes('парацетамол')) medName = 'Парацетамол';
      else if (lower.includes('цитрамон')) medName = 'Цитрамон';
      else if (lower.includes('аспирин')) medName = 'Аспирин';
      else if (lower.includes('но-шпа') || lower.includes('ношпа')) medName = 'Но-Шпа';
      else {
        const words = message.split(' ');
        const keywordIdx = words.findIndex((w) => w.toLowerCase().includes(matchedMed));
        if (keywordIdx !== -1 && words[keywordIdx + 1]) {
          medName = words[keywordIdx + 1].replace(/[^a-zA-Zа-яА-Я0-9-]/g, '');
        }
      }

      return {
        hasFact: true,
        factCategory: 'medication',
        rawInput: message,
        title: `Прием лекарства: ${medName} (${dose})`,
        description: `Зафиксирован прием медикамента (${dateRaw}). Субъект: ${subjectName}.`,
        subject: { id: subjectId, name: subjectName },
        dateResolution: { raw: dateRaw, resolvedIso, isRelative: isRelativeDate },
        extractedFields: {
          medicationName: medName,
          dosage: dose,
          status: 'taken',
        },
        schemaValidation: {
          isValid: true,
          statusText: 'Схема валидна (Прием лекарства)',
          needsClarification: false,
          fieldValidations: [
            { field: 'medicationName', value: medName, valid: true },
            { field: 'dosage', value: dose, valid: true },
          ],
        },
      };
    }

    // --- CATEGORY D: CYCLE EVENT (Menstrual Cycle) ---
    if (lower.includes('месячн') || lower.includes('менструац') || lower.includes('первый день цикла') || lower.includes('начало цикла')) {
      return {
        hasFact: true,
        factCategory: 'cycle_event',
        rawInput: message,
        title: `Женский календарь: Начало менструации`,
        description: `Отметка первого дня цикла (${dateRaw}). Субъект: ${subjectName}.`,
        subject: { id: subjectId, name: subjectName },
        dateResolution: { raw: dateRaw, resolvedIso, isRelative: isRelativeDate },
        extractedFields: {
          eventType: 'period_start',
          cycleDay: 1,
          flowIntensity: lower.includes('обильн') ? 'heavy' : lower.includes('скудн') ? 'light' : 'medium',
        },
        schemaValidation: {
          isValid: true,
          statusText: 'Схема валидна (Цикл)',
          needsClarification: false,
          fieldValidations: [
            { field: 'eventType', value: 'period_start', valid: true, note: 'Первый день цикла' },
          ],
        },
      };
    }

    return null;
  },

  /**
   * Stage a CandidateRecord from extracted Health Fact and return it for Chat UI preview & token verification
   */
  async stageHealthFactCandidate(
    fact: HealthFactExtractionResult,
    userId: string
  ): Promise<CandidateRecord> {
    const candidateId = `cand_fact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const confirmationToken = generateConfirmationToken(userId, candidateId);

    const record: CandidateRecord = {
      id: candidateId,
      userId,
      toolName: 'candidate.create',
      actionClass: 'STAGE',
      type: 'candidate',
      title: fact.title,
      description: fact.description,
      payload: {
        factCategory: fact.factCategory,
        rawInput: fact.rawInput,
        subject: fact.subject,
        dateResolution: fact.dateResolution,
        extractedFields: fact.extractedFields,
        schemaValidation: fact.schemaValidation,
      },
      status: 'STAGED',
      confirmationToken,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      aiReasoning: `Автоматически распознано из сообщения пользователя «${fact.rawInput}». Помещено в карантин STAGED согласно Правилу 16.`,
    };

    // Save to typed tools internal candidates store
    await aiToolsService.executeTool(
      'candidate.create',
      {
        userId,
        category: fact.factCategory,
        title: fact.title,
        data: record.payload,
        reasoning: record.aiReasoning,
      },
      { id: userId, email: '' }
    );

    return record;
  },

  /**
   * Commit confirmed candidate health fact to canonical data layer
   */
  async commitFactToCanonical(candidate: CandidateRecord, userId: string): Promise<boolean> {
    const payload = candidate.payload || {};
    const category = payload.factCategory || 'measurement';
    const fields = payload.extractedFields || {};
    const dateIso = payload.dateResolution?.resolvedIso || new Date().toISOString();

    const current = await canonicalDataLayer.getUserData(userId);

    if (category === 'measurement') {
      if (fields.metricType === 'bp') {
        const currentBp = current.pressureLogs || [];
        const newLog = {
          id: `BP_MEASURE_${Date.now()}`,
          timestamp: dateIso,
          systolic: fields.systolic,
          diastolic: fields.diastolic,
          pulse: fields.pulse || 72,
          notes: `Подтверждено пользователем из чата (${candidate.description})`,
        };
        await canonicalDataLayer.saveUserData(userId, {
          pressureLogs: [newLog, ...currentBp],
        });

        await auditProvenanceService.recordCriticalChange({
          userId,
          subjectProfileId: candidate.payload?.subject?.id,
          resourceType: 'measurement',
          resourceId: newLog.id,
          action: 'CREATE',
          oldValue: null,
          newValue: newLog,
          actor: { id: userId, role: 'user', name: 'Пользователь (Чат)' },
          reasonSource: 'AI_STAGED_CONFIRMATION',
        });
      } else {
        // Glucose, weight, temperature -> update dailyLogs
        const currentDaily = current.dailyLogs || [];
        const dateStr = dateIso.split('T')[0];
        let todayLog = currentDaily.find((l) => l.date === dateStr);

        const recordId = todayLog?.id || `DAILY_LOG_${Date.now()}`;

        if (todayLog) {
          todayLog = {
            ...todayLog,
            metrics: {
              ...(todayLog.metrics || {}),
              [fields.metricType]: fields.value,
            },
          };
        } else {
          todayLog = {
            id: recordId,
            date: dateStr,
            metrics: {
              [fields.metricType]: fields.value,
            },
          };
          currentDaily.unshift(todayLog);
        }

        await canonicalDataLayer.saveUserData(userId, {
          dailyLogs: currentDaily,
        });

        await auditProvenanceService.recordCriticalChange({
          userId,
          subjectProfileId: candidate.payload?.subject?.id,
          resourceType: 'measurement',
          resourceId: recordId,
          action: 'CREATE',
          oldValue: null,
          newValue: todayLog,
          actor: { id: userId, role: 'user', name: 'Пользователь (Чат)' },
          reasonSource: 'AI_STAGED_CONFIRMATION',
        });
      }
    } else if (category === 'symptom') {
      const currentDiary = current.diaryEntries || [];
      const newSymptomEntry = {
        id: `SYMPTOM_${Date.now()}`,
        date: dateIso.split('T')[0],
        time: new Date(dateIso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        text: `Симптом: ${fields.symptomName} (Интенсивность ${fields.severity}/10). ${fields.notes || ''}`,
        mood: 'neutral',
        source: 'ai_chat_confirmed',
      };
      await canonicalDataLayer.saveUserData(userId, {
        diaryEntries: [newSymptomEntry, ...currentDiary],
      });

      await auditProvenanceService.recordCriticalChange({
        userId,
        subjectProfileId: candidate.payload?.subject?.id,
        resourceType: 'symptom',
        resourceId: newSymptomEntry.id,
        action: 'CREATE',
        oldValue: null,
        newValue: newSymptomEntry,
        actor: { id: userId, role: 'user', name: 'Пользователь (Чат)' },
        reasonSource: 'AI_STAGED_CONFIRMATION',
      });
    } else if (category === 'medication') {
      const rawAny = current as any;
      const currentMedLogs = rawAny.medicationLogs || [];
      const newMedLog = {
        id: `MED_LOG_${Date.now()}`,
        medicationName: fields.medicationName,
        dosage: fields.dosage,
        status: fields.status || 'taken',
        timestamp: dateIso,
        source: 'ai_chat_confirmed',
      };
      await canonicalDataLayer.saveUserData(userId, {
        medicationLogs: [newMedLog, ...currentMedLogs],
      } as any);

      await auditProvenanceService.recordCriticalChange({
        userId,
        subjectProfileId: candidate.payload?.subject?.id,
        resourceType: 'medication',
        resourceId: newMedLog.id,
        action: 'CREATE',
        oldValue: null,
        newValue: newMedLog,
        actor: { id: userId, role: 'user', name: 'Пользователь (Чат)' },
        reasonSource: 'AI_STAGED_CONFIRMATION',
      });
    } else if (category === 'cycle_event') {
      const currentDaily = current.dailyLogs || [];
      const dateStr = dateIso.split('T')[0];
      const recordId = `CYCLE_LOG_${Date.now()}`;
      const todayLog = currentDaily.find((l) => l.date === dateStr) || {
        id: recordId,
        date: dateStr,
      };

      todayLog.cycleEvent = {
        eventType: fields.eventType,
        flowIntensity: fields.flowIntensity,
        timestamp: dateIso,
      };

      const updatedDaily = [todayLog, ...currentDaily.filter((l) => l.date !== dateStr)];
      await canonicalDataLayer.saveUserData(userId, {
        dailyLogs: updatedDaily,
      });

      await auditProvenanceService.recordCriticalChange({
        userId,
        subjectProfileId: candidate.payload?.subject?.id,
        resourceType: 'measurement',
        resourceId: todayLog.id,
        action: 'CREATE',
        oldValue: null,
        newValue: todayLog,
        actor: { id: userId, role: 'user', name: 'Пользователь (Чат)' },
        reasonSource: 'AI_STAGED_CONFIRMATION',
      });
    }

    return true;
  },
};
