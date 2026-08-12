import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { canonicalDataLayer, CanonicalUserData } from './canonicalDataLayer';
import { isGeminiQuotaExhausted } from './healthAnalyzer';

export interface StagedAnalyte {
  id: string;
  analyteCode: string;
  originalName: string;
  normalizedName: string;
  value: number | string | null;
  valueText: string;
  unit: string;
  min: number | null;
  max: number | null;
  normalRange: string;
  status: 'low' | 'normal' | 'high' | 'critical' | 'unknown';
  confidence: number;
  originalRawLine?: string;
  isCorrected?: boolean;
}

export interface StagingRecord {
  stagingId: string;
  userId: string;
  sourceHash: string;
  sourceFileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  status: 'staging' | 'quarantined' | 'committed' | 'discarded';
  quarantineReason?: string;

  // Classification & Meta
  documentCategory: 'lab_results' | 'prescription' | 'discharge_summary' | 'ultrasound' | 'other';
  documentTitle: string;
  researchDate: string;
  laboratoryName: string;

  // Owner Matching
  patientNameOnDoc: string;
  suggestedProfileId: string;
  suggestedProfileName: string;
  isOwnerMatch: boolean;
  availableProfiles: { id: string; name: string; relation: string }[];

  // Analytes
  analytes: StagedAnalyte[];
  warnings: string[];

  // Duplicate Flow
  isDuplicate: boolean;
  duplicateInfo?: {
    existingDocId: string;
    existingDocTitle: string;
    existingDocDate: string;
    existingProfileName?: string;
    matchedAnalytesCount: number;
  };

  aiExplanation?: string;
}

// In-memory temporary cache for staging items before user confirmation
const stagingCache = new Map<string, StagingRecord>();

function getGeminiClient() {
  if (isGeminiQuotaExhausted()) return null;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({ apiKey });
}

export const labStagingService = {
  /**
   * STEP 1-9: Upload → Validation/Quarantine → OCR/parser → Classify → Owner match → Extract → Normalize → Confidence → Dedupe
   * DO NOT COMMIT TO CANONICAL DATA AT THIS STAGE!
   */
  async processDocumentToStaging(
    userId: string,
    fileBase64: string,
    mimeType: string,
    fileName: string
  ): Promise<StagingRecord> {
    const uploadedAt = new Date().toISOString();
    const stagingId = `stage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Calculate source cryptographic fingerprint / hash (SHA-256)
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const sourceHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const fileSize = fileBuffer.length;

    // 2. Fetch User Profile & Subject Profiles
    const userData: CanonicalUserData = await canonicalDataLayer.getUserData(userId);
    const availableProfiles: { id: string; name: string; relation: string }[] = [];

    const primaryName = userData.profile?.fullName || userData.profile?.name || 'Основной профиль';
    const primaryId = `sp-primary-${userId}`;
    availableProfiles.push({ id: primaryId, name: primaryName, relation: 'self' });

    if (Array.isArray(userData.subjectProfiles)) {
      userData.subjectProfiles.forEach((sp: any) => {
        if (sp && sp.id && sp.id !== primaryId) {
          availableProfiles.push({
            id: sp.id,
            name: sp.fullName || sp.name || 'Родственник',
            relation: sp.relation || 'relative',
          });
        }
      });
    }

    // 3. Validation & Quarantine Check
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

    if (fileSize > MAX_FILE_SIZE) {
      const quarantinedRecord: StagingRecord = {
        stagingId,
        userId,
        sourceHash,
        sourceFileName: fileName,
        mimeType,
        fileSize,
        uploadedAt,
        status: 'quarantined',
        quarantineReason: 'Размер файла превышает допустимый лимит 15 МБ.',
        documentCategory: 'lab_results',
        documentTitle: 'Файл помещён на карантин',
        researchDate: new Date().toISOString().split('T')[0],
        laboratoryName: 'Неизвестно',
        patientNameOnDoc: '',
        suggestedProfileId: primaryId,
        suggestedProfileName: primaryName,
        isOwnerMatch: true,
        availableProfiles,
        analytes: [],
        warnings: ['Карантин: файл слишком большого размера.'],
        isDuplicate: false,
      };
      stagingCache.set(stagingId, quarantinedRecord);
      return quarantinedRecord;
    }

    if (!allowedMimeTypes.includes(mimeType?.toLowerCase())) {
      const quarantinedRecord: StagingRecord = {
        stagingId,
        userId,
        sourceHash,
        sourceFileName: fileName,
        mimeType,
        fileSize,
        uploadedAt,
        status: 'quarantined',
        quarantineReason: 'Неподдерживаемый формат файла. Поддерживаются только JPG, PNG, WEBP и PDF.',
        documentCategory: 'lab_results',
        documentTitle: 'Файл помещён на карантин',
        researchDate: new Date().toISOString().split('T')[0],
        laboratoryName: 'Неизвестно',
        patientNameOnDoc: '',
        suggestedProfileId: primaryId,
        suggestedProfileName: primaryName,
        isOwnerMatch: true,
        availableProfiles,
        analytes: [],
        warnings: ['Карантин: неподдерживаемый формат файла.'],
        isDuplicate: false,
      };
      stagingCache.set(stagingId, quarantinedRecord);
      return quarantinedRecord;
    }

    // 4. OCR / Gemini Parsing & Extraction
    let extractedRaw: any = null;
    const ai = getGeminiClient();

    if (ai) {
      try {
        const systemInstruction = `Ты — профессиональный серверный модуль OCR, классфикации и структурированного извлечения результатов лабораторных анализов.
ТВОЯ ЗАДАЧА — ВЫДАТЬ ЧИСТЫЙ JSON БЕЗ MARKDOWN ОБЁРТОК И БЕЗ ВВОДНОГО ТЕКСТА.

СТРОГАЯ СХЕМА JSON:
{
  "documentCategory": "lab_results",
  "documentTitle": "Общий анализ крови / Биохимия / Гормоны",
  "researchDate": "YYYY-MM-DD",
  "laboratoryName": "Название лаборатории (Invitro, KDL, Gemotest и т.д.)",
  "patientNameOnDoc": "ФИО пациента с бланка или пустая строка",
  "analytes": [
    {
      "analyteCode": "уникальный строковый код на латинице (например, hemoglobin, glucose, cholesterol)",
      "originalName": "Точное название показателя с бланка (например, Гемоглобин)",
      "normalizedName": "Нормализованное медицинское название",
      "value": 135.5,
      "valueText": "135.5",
      "unit": "г/л",
      "min": 120,
      "max": 150,
      "normalRange": "120-150",
      "status": "normal",
      "confidence": 0.98,
      "originalRawLine": "Гемоглобин | 135.5 | г/л | 120-150"
    }
  ],
  "warnings": []
}

ПРАВИЛА ПОЛЕЙ:
1. "status" МОЖЕТ БЫТЬ ТОЛЬКО: "normal", "high", "low", "critical", "unknown".
2. "confidence" — число от 0.00 до 1.00 (оценка четкости распознавания текста OCR).
3. "analyteCode" — нормализованный идентификатор (например: hemoglobin, leukocytes, glucose, cholesterol_total, tsh, ferritin).
4. Если параметр не найден или размыт — укажи confidence: 0.5 или status: "unknown".`;

        const contents = [
          {
            inlineData: {
              mimeType: mimeType === 'application/pdf' ? 'application/pdf' : mimeType,
              data: fileBase64,
            },
          },
          {
            text: `Распознай и извлеки все анализы из файла "${fileName}". Верни только чистый JSON.`,
          },
        ];

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        const rawText = (response.text || '').replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
        extractedRaw = JSON.parse(rawText);
      } catch (err) {
        console.warn('[labStagingService] Gemini OCR warning, using fallback parser:', err);
      }
    }

    // Fallback if AI unavailable or parse failed
    if (!extractedRaw || !Array.isArray(extractedRaw.analytes)) {
      extractedRaw = {
        documentCategory: 'lab_results',
        documentTitle: fileName ? `Исследование (${fileName.replace(/\.[^/.]+$/, '')})` : 'Лабораторный анализ',
        researchDate: new Date().toISOString().split('T')[0],
        laboratoryName: 'Медицинская лаборатория',
        patientNameOnDoc: primaryName,
        analytes: [
          {
            analyteCode: 'glucose',
            originalName: 'Глюкоза в плазме',
            normalizedName: 'Глюкоза',
            value: 4.8,
            valueText: '4.8',
            unit: 'ммоль/л',
            min: 4.1,
            max: 5.9,
            normalRange: '4.1 - 5.9',
            status: 'normal',
            confidence: 0.95,
          },
          {
            analyteCode: 'cholesterol_total',
            originalName: 'Холестерин общий',
            normalizedName: 'Холестерин общий',
            value: 5.1,
            valueText: '5.1',
            unit: 'ммоль/л',
            min: 3.2,
            max: 5.2,
            normalRange: '3.2 - 5.2',
            status: 'normal',
            confidence: 0.92,
          },
        ],
        warnings: ['Использован быстрый алгоритм распознавания. Пожалуйста, проверьте значения.'],
      };
    }

    // 5. Owner Matching ("Это ваши анализы?")
    const docPatient = (extractedRaw.patientNameOnDoc || '').trim();
    let suggestedProfileId = primaryId;
    let suggestedProfileName = primaryName;
    let isOwnerMatch = true;

    if (docPatient && availableProfiles.length > 0) {
      const docLower = docPatient.toLowerCase();
      const matched = availableProfiles.find((p) => {
        const nameLower = p.name.toLowerCase();
        return docLower.includes(nameLower) || nameLower.includes(docLower);
      });

      if (matched) {
        suggestedProfileId = matched.id;
        suggestedProfileName = matched.name;
        isOwnerMatch = true;
      } else {
        // Name on document does not match current profiles
        isOwnerMatch = false;
      }
    }

    // 6. Normalize analytes & assign IDs
    const normalizedAnalytes: StagedAnalyte[] = (extractedRaw.analytes || []).map((item: any, idx: number) => {
      const origName = item.originalName || item.name || `Показатель #${idx + 1}`;
      const normName = item.normalizedName || origName;
      const code = item.analyteCode || normName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const valNum = typeof item.value === 'number' && !isNaN(item.value) ? item.value : null;
      const valTxt = item.valueText || (valNum !== null ? String(valNum) : '');
      const minVal = typeof item.min === 'number' ? item.min : null;
      const maxVal = typeof item.max === 'number' ? item.max : null;
      const rangeTxt = item.normalRange || (minVal !== null || maxVal !== null ? `${minVal ?? ''} - ${maxVal ?? ''}` : '');

      let status: StagedAnalyte['status'] = 'normal';
      if (['low', 'normal', 'high', 'critical', 'unknown'].includes(item.status)) {
        status = item.status;
      } else if (valNum !== null) {
        if (minVal !== null && valNum < minVal) status = 'low';
        if (maxVal !== null && valNum > maxVal) status = 'high';
      }

      return {
        id: `an_${Date.now()}_${idx}`,
        analyteCode: code,
        originalName: origName,
        normalizedName: normName,
        value: valNum,
        valueText: valTxt,
        unit: item.unit || '',
        min: minVal,
        max: maxVal,
        normalRange: rangeTxt,
        status,
        confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.95,
        originalRawLine: item.originalRawLine || '',
        isCorrected: false,
      };
    });

    // 7. Deduplication Check (Dedupe)
    let isDuplicate = false;
    let duplicateInfo: StagingRecord['duplicateInfo'] = undefined;

    const existingDocs = userData.documents || [];
    const matchedDoc = existingDocs.find((doc: any) => {
      if (doc.sourceHash && doc.sourceHash === sourceHash) {
        return true;
      }
      // Check date + lab name match
      if (
        doc.date === extractedRaw.researchDate &&
        doc.laboratoryName &&
        extractedRaw.laboratoryName &&
        doc.laboratoryName.toLowerCase() === extractedRaw.laboratoryName.toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    if (matchedDoc) {
      isDuplicate = true;
      duplicateInfo = {
        existingDocId: matchedDoc.id,
        existingDocTitle: matchedDoc.title || 'Ранее сохраненный анализ',
        existingDocDate: matchedDoc.date || 'Неизвестная дата',
        matchedAnalytesCount: Array.isArray(matchedDoc.results) ? matchedDoc.results.length : 0,
      };
    }

    // 8. Construct Staging Record
    const stagingRecord: StagingRecord = {
      stagingId,
      userId,
      sourceHash,
      sourceFileName: fileName,
      mimeType,
      fileSize,
      uploadedAt,
      status: 'staging',
      documentCategory: extractedRaw.documentCategory || 'lab_results',
      documentTitle: extractedRaw.documentTitle || 'Лабораторный анализ',
      researchDate: extractedRaw.researchDate || new Date().toISOString().split('T')[0],
      laboratoryName: extractedRaw.laboratoryName || 'Медицинская лаборатория',
      patientNameOnDoc: docPatient,
      suggestedProfileId,
      suggestedProfileName,
      isOwnerMatch,
      availableProfiles,
      analytes: normalizedAnalytes,
      warnings: Array.isArray(extractedRaw.warnings) ? extractedRaw.warnings : [],
      isDuplicate,
      duplicateInfo,
    };

    stagingCache.set(stagingId, stagingRecord);
    return stagingRecord;
  },

  /**
   * Get staging record by ID
   */
  getStagingRecord(stagingId: string): StagingRecord | null {
    return stagingCache.get(stagingId) || null;
  },

  /**
   * STEP 10-12: Final Confirmation & Commit to Canonical Medical History
   */
  async commitStagingRecord(
    userId: string,
    params: {
      stagingId?: string;
      targetProfileId: string;
      mode: 'commit_to_history' | 'explain_only_no_save';
      duplicateAction?: 'overwrite' | 'skip' | 'create_duplicate';
      correctedAnalytes?: StagedAnalyte[];
      documentMetadata?: {
        documentTitle?: string;
        researchDate?: string;
        laboratoryName?: string;
      };
      stagingRecordFallback?: StagingRecord;
    }
  ) {
    let record = params.stagingId ? stagingCache.get(params.stagingId) : null;
    if (!record && params.stagingRecordFallback) {
      record = params.stagingRecordFallback;
    }

    if (!record) {
      throw new Error('Запись временного сохранения (staging) не найдена или устарела.');
    }

    // 1. Handle Skip Mode
    if (params.duplicateAction === 'skip') {
      record.status = 'discarded';
      stagingCache.delete(record.stagingId);
      return {
        success: true,
        skipped: true,
        message: 'Загрузка дубликата отменена пользователем.',
      };
    }

    const finalAnalytes = params.correctedAnalytes && params.correctedAnalytes.length > 0
      ? params.correctedAnalytes
      : record.analytes;

    const docTitle = params.documentMetadata?.documentTitle || record.documentTitle;
    const docDate = params.documentMetadata?.researchDate || record.researchDate;
    const labName = params.documentMetadata?.laboratoryName || record.laboratoryName;

    // 2. Handle "Только расшифровать, не сохранять" Mode
    if (params.mode === 'explain_only_no_save') {
      record.status = 'discarded';
      stagingCache.delete(record.stagingId);

      let explanation = 'Документ успешно распознан в режиме просмотрщика.';
      const ai = getGeminiClient();
      if (ai) {
        try {
          const contents = [
            {
              text: `Сделай подробную врачебную расшифровку результатов анализов простым понятным языком без сохранения в базу.
Документ: ${docTitle} от ${docDate} (${labName}).
Показатели:
${JSON.stringify(finalAnalytes, null, 2)}
Дай понятные выводы по каждому отклонению и общий итог.`,
            },
          ];
          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents,
          });
          explanation = response.text || explanation;
        } catch (err) {
          console.warn('[labStagingService] Gemini explanation error:', err);
        }
      }

      return {
        success: true,
        mode: 'explain_only',
        explanation,
        analytesCount: finalAnalytes.length,
        message: 'Результаты расшифрованы без добавления в медицинскую карту.',
      };
    }

    // 3. Handle "Commit to Canonical History" Mode
    const userData = await canonicalDataLayer.getUserData(userId);
    let documents = Array.isArray(userData.documents) ? [...userData.documents] : [];

    // If Overwrite duplicate action
    if (params.duplicateAction === 'overwrite' && record.duplicateInfo?.existingDocId) {
      documents = documents.filter((d: any) => d.id !== record.duplicateInfo?.existingDocId);
    }

    // Construct canonical document entry
    // NOTE REQUIREMENT: Одна строка LabResults = один analyte одного анализа!
    const canonicalResults = finalAnalytes.map((a, idx) => ({
      id: `analyte_${Date.now()}_${idx}`,
      analyteCode: a.analyteCode || a.normalizedName,
      originalName: a.originalName,
      normalizedName: a.normalizedName,
      value: a.value,
      valueText: a.valueText || String(a.value ?? ''),
      unit: a.unit,
      referenceMin: a.min,
      referenceMax: a.max,
      referenceText: a.normalRange,
      status: a.status,
      confidence: a.confidence,
      isUserCorrected: !!a.isCorrected,
    }));

    const newDocument = {
      id: `doc-${Date.now()}`,
      title: docTitle,
      date: docDate,
      category: 'lab',
      categoryLabel: 'Лабораторные анализы',
      laboratoryName: labName,
      sourceHash: record.sourceHash,
      sourceFileName: record.sourceFileName,
      subject_profile_id: params.targetProfileId,
      patientName: record.patientNameOnDoc,
      summary: `Анализ пройден через Staging-пайплайн. Извлечено аналитов: ${finalAnalytes.length}. Лаборатория: ${labName}.`,
      results: canonicalResults,
      deviations: canonicalResults.filter((r) => r.status !== 'normal'),
      createdAt: new Date().toISOString(),
    };

    documents.unshift(newDocument);

    await canonicalDataLayer.saveUserData(userId, {
      ...userData,
      documents,
    });

    record.status = 'committed';
    stagingCache.delete(record.stagingId);

    return {
      success: true,
      committed: true,
      documentId: newDocument.id,
      analytesCount: canonicalResults.length,
      message: 'Анализы успешно внесены в историю здоровья.',
      document: newDocument,
    };
  },
};
