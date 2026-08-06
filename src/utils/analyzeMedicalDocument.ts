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
 * Analyzes a medical document (JPG, PNG, PDF) using the server Gemini API / Apps Script endpoint.
 * Validates file format and size, converts to base64, and returns recognized structured medical markers.
 */
export async function analyzeMedicalDocument(
  file: File,
  category: string = 'lab',
  onProgress?: (step: string, progressPercent: number) => void
): Promise<RecognizedDocumentData> {
  // 1. Check supported format
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  
  const fileNameLower = file.name.toLowerCase();
  const isValidExt = allowedExtensions.some((ext) => fileNameLower.endsWith(ext));
  const isValidMime = !file.type || allowedMimeTypes.includes(file.type.toLowerCase());

  if (!isValidExt || !isValidMime) {
    throw new Error('Поддерживаются только медицинские документы форматов JPG, JPEG, PNG и PDF.');
  }

  // 2. Check file size (Max 15MB)
  const MAX_SIZE_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Размер файла превышает 15 МБ. Пожалуйста, загрузите скан меньшего размера.');
  }

  // 3. Read file as Base64 DataURL
  if (onProgress) onProgress('Чтение файла...', 20);

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

  if (onProgress) onProgress('Отправка на ИИ-распознавание (Gemini OCR)...', 55);

  // 4. Send to server endpoint
  const res = await fetch('/api/research/recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileBase64: base64Content,
      mimeType: file.type || (fileNameLower.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      fileName: file.name,
      category,
    }),
  });

  if (onProgress) onProgress('Анализ структуры показателей...', 85);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || 'Ошибка сервера при обработке документа');
  }

  const jsonRes = await res.json();
  if (!jsonRes.success || !jsonRes.data) {
    throw new Error(jsonRes.error || jsonRes.message || 'Не удалось распознать данные в документе');
  }

  const data = jsonRes.data;

  // 5. Normalize response to ensure schema compatibility
  const rawMarkers = Array.isArray(data.markers)
    ? data.markers
    : Array.isArray(data.results)
    ? data.results
    : [];

  const normalizedMarkers: RecognizedMarker[] = rawMarkers.map((m: any) => {
    const name = m.name || m.originalName || 'Показатель';
    const val = m.value !== undefined && m.value !== null ? m.value : null;
    const rawVal = m.rawValue || (val !== null ? String(val) : '');
    const unit = m.unit || '';
    const min = m.min !== undefined && m.min !== null ? m.min : (m.referenceMin !== undefined ? m.referenceMin : null);
    const max = m.max !== undefined && m.max !== null ? m.max : (m.referenceMax !== undefined ? m.referenceMax : null);
    const normalRange = m.normalRange || m.referenceText || (min !== null || max !== null ? `${min ?? ''} - ${max ?? ''} ${unit}`.trim() : '');
    
    let status: RecognizedMarker['status'] = 'normal';
    if (m.status === 'low' || m.status === 'high' || m.status === 'critical' || m.status === 'unknown') {
      status = m.status;
    } else if (val !== null && typeof val === 'number') {
      if (min !== null && val < min) status = 'low';
      if (max !== null && val > max) status = 'high';
    }

    return {
      name,
      originalName: m.originalName || name,
      normalizedName: m.normalizedName || name,
      value: typeof val === 'number' && !isNaN(val) ? val : null,
      rawValue: rawVal,
      unit,
      min,
      max,
      normalRange,
      status,
      confidence: typeof m.confidence === 'number' ? m.confidence : 0.9,
      category: m.category || category,
    };
  });

  const docType = data.documentType || 'Лабораторный анализ';
  const docDate = data.documentDate || data.researchDate || new Date().toISOString().split('T')[0];
  const lab = data.laboratory || data.laboratoryName || '';
  const patient = data.patientName || '';
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];

  if (onProgress) onProgress('Готово!', 100);

  const recognizedResult: RecognizedDocumentData = {
    documentType: docType,
    documentDate: docDate,
    researchDate: docDate,
    laboratory: lab,
    laboratoryName: lab,
    patientName: patient,
    markers: normalizedMarkers,
    results: normalizedMarkers,
    warnings,
    sourceFileName: file.name,
    recognized: true,
  };

  return recognizedResult;
}
