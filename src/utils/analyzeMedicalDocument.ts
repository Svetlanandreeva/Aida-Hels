import { StagingRecordPayload } from '../components/modals/ResearchVerificationModal';

export interface RecognizedMarker {
  name: string;
  originalName?: string;
  normalizedName?: string;
  value: number | null;
  rawValue: string;
  unit: string;
  min: number | null;
  max: number | null;
  normalRange: string;
  status: 'normal' | 'high' | 'low' | 'unknown' | 'critical';
  confidence: number;
  category?: string;
}

export interface RecognizedDocumentData {
  documentType: string;
  documentDate: string;
  researchDate?: string;
  laboratory: string;
  laboratoryName?: string;
  patientName: string;
  markers: RecognizedMarker[];
  results?: RecognizedMarker[];
  warnings: string[];
  rawText?: string;
  overallConfidence?: number;
  sourceFileName?: string;
  recognized?: boolean;
}

/**
 * Process document through Staging Pipeline (Validation, Quarantine, OCR, Classify, Owner match, Extract, Normalize, Confidence, Dedupe)
 */
export async function processLabDocumentThroughStaging(
  file: File,
  onProgress?: (step: string, progressPercent: number) => void
): Promise<StagingRecordPayload> {
  // 1. Format validation
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

  const fileNameLower = file.name.toLowerCase();
  const isValidExt = allowedExtensions.some((ext) => fileNameLower.endsWith(ext));
  const isValidMime = !file.type || allowedMimeTypes.includes(file.type.toLowerCase());

  if (!isValidExt || !isValidMime) {
    throw new Error('Поддерживаются только медицинские документы форматов JPG, PNG, WEBP и PDF.');
  }

  // 2. Size limit (Max 15MB)
  const MAX_SIZE_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Размер файла превышает 15 МБ. Пожалуйста, загрузите файл меньшего размера.');
  }

  // 3. Read File as Base64 DataURL
  if (onProgress) onProgress('Чтение и карантинная валидация...', 20);

  const base64Content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать выбранный файл'));
    reader.readAsDataURL(file);
  });

  if (onProgress) onProgress('ИИ Staging OCR & Идентификация бланка...', 60);

  // 4. Send to backend Staging Pipeline
  const res = await fetch('/api/lab/staging/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileBase64: base64Content,
      mimeType: file.type || (fileNameLower.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      fileName: file.name,
    }),
  });

  if (onProgress) onProgress('Проверка на дубликаты и привязка профиля...', 85);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || 'Ошибка сервера при обработке staging документа');
  }

  const jsonRes = await res.json();
  if (!jsonRes.success || !jsonRes.stagingRecord) {
    throw new Error(jsonRes.error || 'Не удалось сопоставить данные документа');
  }

  if (onProgress) onProgress('Готово к верификации', 100);

  return jsonRes.stagingRecord as StagingRecordPayload;
}

/**
 * Legacy wrapper for backward compatibility
 */
export async function analyzeMedicalDocument(
  file: File,
  category: string = 'lab',
  onProgress?: (step: string, progressPercent: number) => void
): Promise<RecognizedDocumentData> {
  const stagingRecord = await processLabDocumentThroughStaging(file, onProgress);

  const normalizedMarkers: RecognizedMarker[] = stagingRecord.analytes.map((a) => ({
    name: a.originalName,
    originalName: a.originalName,
    normalizedName: a.normalizedName,
    value: typeof a.value === 'number' ? a.value : null,
    rawValue: a.valueText || String(a.value ?? ''),
    unit: a.unit,
    min: a.min,
    max: a.max,
    normalRange: a.normalRange,
    status: a.status,
    confidence: a.confidence,
  }));

  return {
    documentType: stagingRecord.documentTitle || 'Лабораторный анализ',
    documentDate: stagingRecord.researchDate,
    researchDate: stagingRecord.researchDate,
    laboratory: stagingRecord.laboratoryName,
    laboratoryName: stagingRecord.laboratoryName,
    patientName: stagingRecord.patientNameOnDoc,
    markers: normalizedMarkers,
    results: normalizedMarkers,
    warnings: stagingRecord.warnings || [],
    sourceFileName: file.name,
    recognized: true,
  };
}
