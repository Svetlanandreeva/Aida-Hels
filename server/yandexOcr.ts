import dotenv from 'dotenv';

dotenv.config();

export interface YandexOcrResult {
  category: string;
  originalName: string;
  normalizedName: string;
  value: number | string;
  unit: string | null;
  referenceMin: number | null;
  referenceMax: number | null;
  referenceText: string | null;
  status: 'normal' | 'low' | 'high' | 'unknown';
  confidence: number;
  lowConfidence: boolean;
}

export interface YandexOcrResponse {
  status: 'recognized' | 'unreadable';
  documentType: string;
  laboratoryName: string | null;
  researchDate: string | null;
  overallConfidence: number;
  warnings: string[];
  results: YandexOcrResult[];
  rawText?: string;
  sourceEngine: 'yandex_cloud_vision' | 'yandex_ocr_parser';
}

/**
 * Checks if Yandex Cloud Vision / OCR credentials are configured.
 */
export function isYandexCloudConfigured(): boolean {
  const apiKey = process.env.YANDEX_VISION_API_KEY || process.env.YANDEX_CLOUD_API_KEY;
  const folderId = process.env.YANDEX_CLOUD_FOLDER_ID;
  return Boolean((apiKey || process.env.YANDEX_IAM_TOKEN) && folderId);
}

/**
 * Parses raw text extracted by Yandex Vision OCR into structured medical laboratory results.
 */
export function parseMedicalTextToResults(text: string): YandexOcrResponse {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results: YandexOcrResult[] = [];
  const warnings: string[] = [];

  // Known Russian lab indicators dictionary
  const labPatterns = [
    { name: 'Гемоглобин', norm: 'hemoglobin', category: 'Гематология', min: 120, max: 150, unit: 'г/л' },
    { name: 'Эритроциты', norm: 'rbc', category: 'Гематология', min: 3.8, max: 5.1, unit: '10^12/л' },
    { name: 'Лейкоциты', norm: 'wbc', category: 'Гематология', min: 4.0, max: 9.0, unit: '10^9/л' },
    { name: 'Тромбоциты', norm: 'platelets', category: 'Гематология', min: 150, max: 400, unit: '10^9/л' },
    { name: 'СОЭ', norm: 'esr', category: 'Гематология', min: 2, max: 20, unit: 'мм/ч' },
    { name: 'Ферритин', norm: 'ferritin', category: 'Биохимия', min: 20, max: 120, unit: 'мкг/л' },
    { name: 'Глюкоза', norm: 'glucose', category: 'Биохимия', min: 3.9, max: 6.1, unit: 'ммоль/л' },
    { name: 'Холестерин', norm: 'cholesterol', category: 'Биохимия', min: 3.2, max: 5.2, unit: 'ммоль/л' },
    { name: 'АЛТ', norm: 'alt', category: 'Биохимия', min: 0, max: 35, unit: 'Ед/л' },
    { name: 'АСТ', norm: 'ast', category: 'Биохимия', min: 0, max: 35, unit: 'Ед/л' },
    { name: 'Креатинин', norm: 'creatinine', category: 'Биохимия', min: 44, max: 80, unit: 'мкмоль/л' },
    { name: 'Мочевина', norm: 'urea', category: 'Биохимия', min: 2.5, max: 6.4, unit: 'ммоль/л' },
    { name: 'ТТГ', norm: 'tsh', category: 'Гормоны', min: 0.4, max: 4.0, unit: 'мкЕд/мл' },
    { name: 'Витамин D', norm: 'vitamin_d', category: 'Витамины', min: 30, max: 100, unit: 'нг/мл' },
    { name: 'Витамин B12', norm: 'vitamin_b12', category: 'Витамины', min: 190, max: 900, unit: 'пг/мл' },
    { name: 'Железо', norm: 'iron', category: 'Микроэлементы', min: 9, max: 30, unit: 'мкмоль/л' },
  ];

  let labName: string | null = null;
  let researchDate: string | null = null;

  // Extract lab name if present in header lines
  for (const line of lines.slice(0, 10)) {
    if (/Инвитро|Гемотест|KDL|Helix|Хеликс|Медси|CMD|Лаборатория/i.test(line)) {
      labName = line;
      break;
    }
  }

  // Extract date if present
  const dateMatch = text.match(/\b(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[012])\.(202[0-9])\b/);
  if (dateMatch) {
    researchDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  for (const pattern of labPatterns) {
    const regex = new RegExp(`${pattern.name}[^\\d]*?([0-9]+(?:[.,][0-9]+)?)`, 'i');
    const match = text.match(regex);
    if (match) {
      const val = parseFloat(match[1].replace(',', '.'));
      let status: 'normal' | 'low' | 'high' = 'normal';
      if (val < pattern.min) status = 'low';
      if (val > pattern.max) status = 'high';

      results.push({
        category: pattern.category,
        originalName: pattern.name,
        normalizedName: pattern.norm,
        value: val,
        unit: pattern.unit,
        referenceMin: pattern.min,
        referenceMax: pattern.max,
        referenceText: `${pattern.min} - ${pattern.max} ${pattern.unit}`,
        status,
        confidence: 0.95,
        lowConfidence: false,
      });
    }
  }

  if (results.length === 0) {
    warnings.push('Текст распознан Yandex OCR, но стандартизированные лабораторные маркеры не найдены.');
    return {
      status: 'unreadable',
      documentType: 'Лабораторный бланк',
      laboratoryName: labName,
      researchDate,
      overallConfidence: 0.3,
      warnings,
      results: [],
      rawText: text,
      sourceEngine: 'yandex_ocr_parser',
    };
  }

  return {
    status: 'recognized',
    documentType: 'Лабораторное исследование',
    laboratoryName: labName || 'Лаборатория РФ',
    researchDate: researchDate || new Date().toISOString().split('T')[0],
    overallConfidence: 0.94,
    warnings,
    results,
    rawText: text,
    sourceEngine: 'yandex_cloud_vision',
  };
}

/**
 * Call Yandex Cloud Vision OCR API directly.
 */
export async function recognizeWithYandexCloudVision(
  fileBase64: string,
  mimeType: string
): Promise<YandexOcrResponse | null> {
  const folderId = process.env.YANDEX_CLOUD_FOLDER_ID;
  const apiKey = process.env.YANDEX_VISION_API_KEY || process.env.YANDEX_CLOUD_API_KEY;
  const iamToken = process.env.YANDEX_IAM_TOKEN;

  if (!folderId || (!apiKey && !iamToken)) {
    return null;
  }

  try {
    const authHeader = apiKey ? `Api-Key ${apiKey}` : `Bearer ${iamToken}`;
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');

    const requestBody = {
      folderId,
      analyze_specs: [
        {
          content: cleanBase64,
          features: [
            {
              type: 'TEXT_DETECTION',
              text_detection_config: {
                language_codes: ['ru', 'en'],
                model: 'page',
              },
            },
          ],
        },
      ],
    };

    const response = await fetch('https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`Yandex Cloud Vision API returned HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const textSegments: string[] = [];

    const resultsArr = data.results || [];
    for (const resItem of resultsArr) {
      const resultsSpecs = resItem.results || [];
      for (const spec of resultsSpecs) {
        const textDetection = spec.textDetection || spec.text_detection;
        if (textDetection?.pages) {
          for (const page of textDetection.pages) {
            for (const block of page.blocks || []) {
              for (const line of block.lines || []) {
                const lineText = (line.words || []).map((w: any) => w.text).join(' ');
                if (lineText) textSegments.push(lineText);
              }
            }
          }
        }
      }
    }

    const extractedText = textSegments.join('\n');
    if (!extractedText.trim()) {
      return null;
    }

    return parseMedicalTextToResults(extractedText);
  } catch (err: any) {
    console.error('Yandex Cloud Vision OCR execution error:', err?.message || err);
    return null;
  }
}
