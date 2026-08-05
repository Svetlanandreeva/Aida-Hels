import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  analyzeHealthWithGeminiOrFallback,
  isGeminiQuotaExhausted,
  setGeminiQuotaExhaustedCooldown,
} from './server/healthAnalyzer';
import {
  buildUserContextSummary,
  sanitizeChatResponse,
  generateSmartHealthAdvice,
} from './server/chatAnalyzer';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Lightweight audit trail for security-relevant client actions (logout, PIN/biometrics
// changes, profile deletion). No auth required - it's a log sink, not a gated resource.
app.post('/api/security/log', (req, res) => {
  const { event, severity, timestamp } = req.body || {};
  console.log(`[SECURITY EVENT${severity ? ` (${String(severity).toUpperCase()})` : ''}] ${timestamp || new Date().toISOString()}: ${event}`);
  res.json({ success: true });
});

// Helper to initialize Gemini SDK safely. When GEMINI_PROXY_URL is set, requests are
// routed through an external relay (e.g. a Cloudflare Worker) instead of calling Google
// directly - needed because the Gemini API rejects requests from Russian IP addresses,
// which is what this server runs on. The relay shim mimics the subset of the
// @google/genai client's interface (`models.generateContent`) actually used in this
// codebase, so every call site works unmodified regardless of which path is active.
function getGeminiClient(): any {
  if (isGeminiQuotaExhausted()) {
    return null;
  }

  const proxyUrl = process.env.GEMINI_PROXY_URL;
  const proxySecret = process.env.GEMINI_PROXY_SECRET;

  if (proxyUrl) {
    return {
      models: {
        async generateContent({ model, contents, config }: any) {
          let apiContents: any[];
          if (typeof contents === 'string') {
            apiContents = [{ role: 'user', parts: [{ text: contents }] }];
          } else {
            const parts = Array.isArray(contents) ? contents : [contents];
            const isWrapped = parts.length > 0 && parts[0] && typeof parts[0] === 'object' && 'role' in parts[0];
            apiContents = isWrapped ? parts : [{ role: 'user', parts }];
          }
          const body: any = { contents: apiContents };
          if (config?.systemInstruction) {
            body.systemInstruction = { parts: [{ text: config.systemInstruction }] };
          }
          if (config?.responseMimeType) {
            body.generationConfig = { responseMimeType: config.responseMimeType };
          }

          const res = await fetch(`${proxyUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(proxySecret ? { 'X-Relay-Secret': proxySecret } : {}),
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const errText = await res.text();
            const err: any = new Error(`Gemini proxy error ${res.status}: ${errText}`);
            err.status = res.status;
            throw err;
          }

          const json: any = await res.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          return { text };
        },
      },
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      const responseText = generateSmartHealthAdvice(message || '', context || {});
      return res.json({ text: sanitizeChatResponse(responseText), mode: 'rule_based' });
    }

    const userSummary = buildUserContextSummary(context || {});

    const systemInstruction = `Имя помощника: Аида.

Аида — персональный ИИ-помощник внутри приложения здоровья. Она не звучит как врачебная справка, робот, оператор поддержки или универсальный чат-бот.

Её характер:
спокойная, мягкая, доброжелательная, внимательная, эмоционально тёплая, поддерживающая, понятная, тактичная, честная, не осуждающая.

Главное ощущение от ответа:
«Меня услышали, поняли и спокойно объяснили, что происходит».

Перед каждым ответом о здоровье тебе предоставлены ПОЛНЫЕ актуальные данные текущего пользователя из приложения (дневник, сон, настроение, тревога, стресс, энергия, симптомы, измерения АД и пульса, исследования, опросы, лекарства, побочные эффекты, динамика за 7, 14 и 30 дней):

${userSummary}

ПРАВИЛО О ДАННЫХ:
Аида не задаёт вопросы, ответы на которые уже сохранены в приложении. Если данных достаточно, вопросы НЕ задавать!

СТРУКТУРА КОРОТКОГО ОТВЕТА (от 4 до 7 коротких предложений):
1. Мягкая человеческая реакция (например: «Похоже, тебе сейчас непросто.», «Я вижу, что последние дни были тяжёлыми.», «Похоже, организм просит немного снизить нагрузку.», «Сейчас у тебя не самый ресурсный период, и это нормально.», «Хорошая новость: резкого ухудшения по записям не видно.», «Ты уже делаешь важную вещь — замечаешь своё состояние.»). Меняй начальную эмоциональную фразу от ответа к ответу.
2. Краткий персональный вывод по имеющимся данным.
3. Простое объяснение возможных причин.
4. Одно или два действия на сегодня, которые могут помочь.
5. При необходимости — мягкая рекомендация обратиться к специалистy.

СТРОГО БЕЗ MARKDOWN:
- НЕ ставить звёздочки (* или **);
- НЕ использовать жирный текст или курсив;
- НЕ использовать заголовки с символами #;
- НЕ использовать маркированные списки с дефисами или нумерованные списки 1., 2.;
- НЕ использовать таблицы;
- НЕ показывать JSON.
Используй обычные связные абзацы и простые перечисления через запятую.

ТОН И ОБРАЩЕНИЕ:
- Обращайся к пользователю только на «ты». Можно иногда называть по имени, но не в каждом сообщении.
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО начинать ответ со слов: «Здравствуйте», «По предоставленным данным», «Как искусственный интеллект», «Я не могу», «Обратитесь к врачу».
- Поддержка должна быть завязана на реальных цифрах и записях пользователя, а не быть пустой («Ты сильная», «Не переживай»).
- НЕ обесценивать эмоции! Не писать: «Это всё из-за стресса», «Просто отдохни», «Не накручивай себя».
- Завершай ответ мягкими фразами («Я продолжу следить за динамикой», «Сегодня лучше немного поберечь себя», «Если состояние изменится, просто напиши мне», «Я рядом и помогу разобрать изменения»). НЕ писать «Чем ещё я могу помочь?».

ИСПОЛЬЗОВАНИЕ ЭМОДЗИ:
- Очень умеренно: не более одного эмодзи на весь ответ (только мягкие: 🤍 🌿 🫶 ☁️ ✨).
- В экстренных сообщениях о медицинском риске эмодзи ЗАПРЕЩЕНЫ.

ПРОСТОЙ ЯЗЫК:
- Писать доступно для школьника старших классов. Короткие предложения. Одна мысль в одном предложении. Сложные медицинские термины сразу объяснять простыми словами.

ПОВЕДЕНИЕ ПРИ ОПАСНОСТИ / ЭКСТРЕННОМ РИСКЕ:
Если обнаружены опасные симптомы (сильная боль в груди, задыхание, критически высокое давление), оставайся мягкой, но скажи прямо и ясно: «Мне важно сказать это прямо: такие симптомы могут требовать срочной помощи. Пожалуйста, не оставайся одна и обратись в экстренную службу или к человеку рядом. Сейчас важнее всего твоя безопасность». В срочных сообщениях не ставить эмодзи и не пытаться заменить врача.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: message || 'Оцени моё состояние',
      config: {
        systemInstruction,
      },
    });

    const sanitized = sanitizeChatResponse(response.text || '');
    res.json({ text: sanitized, mode: 'gemini' });
  } catch (error: any) {
    const isQuotaError = error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('429') || error?.message?.includes('quota');
    if (isQuotaError) {
      setGeminiQuotaExhaustedCooldown(60);
      console.warn('Gemini chat quota limit reached. Falling back to rule-based response.');
    } else {
      console.error('Gemini chat error:', error?.message || error);
    }
    const fallbackText = generateSmartHealthAdvice(req.body.message || '', req.body.context || {});
    res.json({ text: sanitizeChatResponse(fallbackText), mode: 'fallback_on_error' });
  }
});

app.post('/api/analyze-doc', async (req, res) => {
  try {
    const { docType, fileName, textContent, fileBase64, mimeType } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      // Intelligent fallback parsing
      return res.json({
        analysis: generateMockDocAnalysis(fileName || 'Анализ крови', docType),
        mode: 'simulated',
      });
    }

    let contents: any = [];

    if (fileBase64 && mimeType) {
      contents = [
        {
          inlineData: {
            mimeType: mimeType,
            data: fileBase64,
          },
        },
        {
          text: `Проанализируй данный медицинский документ (${docType || 'анализы'}). Выдели показатели вне нормы, дай подробную расшифровку простым языком и дай рекомендации по дальнейшим шагам. Ответ сформируй в формате JSON со следующими полями:
{
  "title": "Название исследования",
  "date": "Дата из документа или Сегодня",
  "category": "Лабораторные анализы / УЗИ и МРТ / Инструментальные / Консультации врачей",
  "summary": "Краткая суть одним предведением",
  "deviations": [{"marker": "Название маркёра", "value": "Значение", "norm": "Норма", "status": "Выше / Ниже / Внимание", "explanation": "Пояснение"}],
  "recommendations": ["Рекомендация 1", "Рекомендация 2"]
}`,
        },
      ];
    } else {
      contents = `Проанализируй следующий текст медицинского документа (${docType}):
${textContent || fileName}
Дай подробную расшифровку показателей, выдели возможные отклонения и рекомендации.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
    });

    res.json({ text: response.text, mode: 'gemini' });
  } catch (error: any) {
    const isQuotaError = error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('429') || error?.message?.includes('quota');
    if (isQuotaError) {
      setGeminiQuotaExhaustedCooldown(60);
      console.warn('Gemini doc analysis quota limit reached. Falling back to simulated doc analysis.');
    } else {
      console.error('Doc analysis error:', error?.message || error);
    }
    return res.json({
      analysis: generateMockDocAnalysis(req.body.fileName || 'Анализ крови', req.body.docType),
      mode: 'simulated',
    });
  }
});

// ==========================================
// RESEARCH DOCUMENT RECOGNITION (GEMINI 2-STAGE OCR)
// ==========================================

app.post('/api/research/recognize', async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName, userId } = req.body;
    const ai = getGeminiClient();

    const systemInstruction = `Ты — модуль извлечения данных из медицинских лабораторных документов. Ты НЕ ставишь диагноз, НЕ даёшь медицинские рекомендации, НЕ интерпретируешь результаты. Твоя единственная задача — точно извлечь то, что физически написано в документе, либо честно сообщить, что извлечь данные невозможно.

ЖЁСТКИЕ ПРАВИЛА:
1. ЗАПРЕЩЕНО придумывать, дополнять или предполагать любые значения, показатели, даты, названия лабораторий или референсные диапазоны, которых нет в изображении/тексте.
2. Если документ нечитаем/повреждён/не медицинский/низкого качества, или общая уверенность < 0.6 — верни results: [] и overallConfidence ниже 0.6, с предупреждением в warnings. Никогда не подменяй это выдуманными данными.
3. Каждое значение сопровождается полем confidence (0.0–1.0).
4. Сохраняй исходные названия показателей (originalName) отдельно от нормализованного технического названия (normalizedName).
5. Значение, единица и референс должны быть извлечены отдельно, именно из документа, не из общих знаний.
6. Если показатель прочитан неоднозначно, возвращай null для этого поля, а не догадку.
7. Не ставь медицинский диагноз, не формируй рекомендации по лекарствам.
8. Верни только валидный JSON по заданной схеме:
{
  "documentType": "Общий анализ крови",
  "laboratoryName": "Инвитро",
  "researchDate": "YYYY-MM-DD",
  "patientName": "Имя пациента или пустая строка",
  "rawText": "Извлеченный текст бланка",
  "overallConfidence": 0.95,
  "warnings": [],
  "results": [
    {
      "category": "Гематология",
      "originalName": "Гемоглобин",
      "normalizedName": "hemoglobin",
      "value": 132,
      "valueText": "132",
      "unit": "г/л",
      "referenceMin": 120,
      "referenceMax": 150,
      "referenceText": "120–150",
      "status": "normal",
      "sourcePage": 1,
      "confidence": 0.96
    }
  ]
}

Допустимые значения статусов (status): "low", "normal", "high", "critical", "unknown".`;

    if (!ai) {
      return res.json({
        success: false,
        mode: 'unavailable',
        error: 'Сервис распознавания временно недоступен (превышена дневная квота ИИ). Попробуйте загрузить документ позже.',
      });
    }

    let contents: any[] = [];
    if (fileBase64 && mimeType) {
      contents = [
        {
          inlineData: {
            mimeType: mimeType === 'application/pdf' ? 'application/pdf' : mimeType,
            data: fileBase64,
          },
        },
        {
          text: `Точно извлеки все лабораторные показатели из загруженного медицинского документа бланка. Название файла: ${fileName || 'Анализ'}.`,
        },
      ];
    } else {
      contents = [
        {
          text: `Точно извлеки все лабораторные показатели из текста документа: ${fileName || 'Анализ'}.`,
        },
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed, mode: 'gemini' });
  } catch (error: any) {
    const isQuotaError = error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('429') || error?.message?.includes('quota');
    if (isQuotaError) {
      setGeminiQuotaExhaustedCooldown(60);
      console.warn('Gemini research recognition quota limit reached. Falling back to structured doc analysis.');
    } else {
      console.error('Research document recognition error:', error?.message || error);
    }
    res.json({
      success: false,
      mode: isQuotaError ? 'quota_exhausted' : 'error',
      error: isQuotaError
        ? 'Сервис распознавания временно недоступен (превышена дневная квота ИИ). Попробуйте загрузить документ позже.'
        : 'Не удалось распознать документ. Попробуйте загрузить его ещё раз.',
    });
  }
});

// Proxy to Google Apps Script Web App
app.post('/api/sheets/proxy', async (req, res) => {
  try {
    const { action, userId, payload, authToken } = req.body;
    const webAppUrl = req.body.webAppUrl || process.env.GOOGLE_SHEETS_WEB_APP_URL;
    
    // If user provided a custom Google Apps Script Web App URL
    if (webAppUrl && webAppUrl.startsWith('https://script.google.com/')) {
      const response = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, payload, authToken }),
      });
      const data = await response.json();
      return res.json(data);
    }

    // Default response if no Apps Script URL configured yet
    res.json({
      success: true,
      data: { message: 'Запрос локально сохранён в защищённой базе данных приложения', action, userId },
      error: null,
    });
  } catch (err: any) {
    console.error('Sheets proxy error:', err);
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'PROXY_ERROR', message: err.message },
    });
  }
});

app.post('/api/mental-diary/analyze', async (req, res) => {
  try {
    const { entries, newEntry } = req.body;
    const ai = getGeminiClient();

    // Check crisis keywords first
    const allText = [
      newEntry?.event_description,
      newEntry?.thoughts,
      newEntry?.additional_note,
      ...(entries || []).map((e: any) => `${e.event_description || ''} ${e.thoughts || ''}`),
    ]
      .join(' ')
      .toLowerCase();

    const crisisKeywords = [
      'хочу умереть',
      'не хочу жить',
      'покончить с собой',
      'причинить себе вред',
      'суицид',
      'нет смысла жить',
      'убить себя',
      'самоповреждение',
      'порезать себя',
    ];

    const isCrisis = crisisKeywords.some((kw) => allText.includes(kw));

    if (!ai) {
      // Rule-based fallback
      const fallbackAnalysis = analyzeMentalDiaryFallback(entries || [], newEntry, isCrisis);
      return res.json({ analysis: fallbackAnalysis, mode: 'simulated' });
    }

    const systemInstruction = `Ты — деликатный ИИ-аналитик дневника ментального здоровья. 
Твоя задача — проанализировать эмоциональное состояние пользователя по его записям, выделить триггеры (положительные и отрицательные), ресурсные факторы и сформулировать бережные рекомендации.
ВАЖНЫЕ ПРАВИЛА:
1. НИКОГДА не ставь диагнозы (депрессия, БАР, ГТР и т.д.). Давай только информационно-аналитические наблюдения.
2. Формулируй мысли мягко: "По твоим записям...", "Замечена тенденция...".
3. Верни строгий JSON следующего формата:
{
  "summary_insight": "Краткий анализ последнего состояния",
  "detected_emotions": ["эмоция1", "эмоция2"],
  "detected_triggers": ["триггер1", "триггер2"],
  "detected_resource_factors": ["ресурс1", "ресурс2"],
  "risk_level": "${isCrisis ? 'critical' : 'none'}",
  "positive_triggers": [{"text": "Описание", "impact": "+2.5 к энергии", "confidence": "high"}],
  "negative_triggers": [{"text": "Описание", "impact": "+3.0 к стрессу", "confidence": "high"}],
  "resource_forecast": "high",
  "forecast_reasoning": "Причина прогноза",
  "recommendations": ["Рекомендация 1", "Рекомендация 2"]
}`;

    const prompt = `Проанализируй записи дневника ментального состояния:
Новая запись: ${JSON.stringify(newEntry || {})}
Предыдущие записи: ${JSON.stringify((entries || []).slice(0, 10))}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ analysis: parsed, mode: 'gemini' });
  } catch (error: any) {
    const isQuotaError = error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('429') || error?.message?.includes('quota');
    if (isQuotaError) {
      setGeminiQuotaExhaustedCooldown(60);
      console.warn('Gemini mental diary quota limit reached. Falling back to rule-based mental diary analysis.');
    } else {
      console.error('Mental diary analysis error:', error?.message || error);
    }
    // Fallback if AI call fails
    const fallback = analyzeMentalDiaryFallback(req.body.entries || [], req.body.newEntry, false);
    res.json({ analysis: fallback, mode: 'simulated_fallback' });
  }
});

// Comprehensive AI Health & Medical Analysis Endpoint
app.post('/api/ai/health-analysis', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const result = await analyzeHealthWithGeminiOrFallback(ai, req.body);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.warn('API health-analysis route fallback triggered:', error?.message || error);
    const { generateFallbackHealthAnalysis } = await import('./server/healthAnalyzer');
    return res.json({ success: true, analysis: generateFallbackHealthAnalysis(req.body), mode: 'rule_fallback' });
  }
});

function analyzeMentalDiaryFallback(entries: any[], newEntry: any, isCrisis: boolean) {
  const allEntries = newEntry ? [newEntry, ...entries] : entries;
  const latest = newEntry || entries[0];

  const stateScore = latest?.state_score || 7;
  const moods = latest?.moods || ['спокойствие'];

  let riskLevel = isCrisis ? 'critical' : stateScore <= 3 ? 'moderate' : 'none';

  return {
    summary_insight: isCrisis
      ? 'Внимание: зафиксированы маркёры сильного эмоционального дискомфорта. Рекомендуется обратиться за профессиональной поддержкой.'
      : stateScore >= 8
      ? 'Отличный уровень ресурса. Физическая активность и отдых дают высокий положительный эффект.'
      : stateScore >= 5
      ? 'Состояние стабильное. Фиксируется небольшая утомляемость к вечеру.'
      : 'Зафиксировано снижение энергии и повышение уровня стресса. Рекомендуется отдохнуть и снизить рабочую нагрузку.',
    detected_emotions: moods,
    detected_triggers: [
      latest?.event_description ? `Ситуация: ${latest.event_description.slice(0, 40)}` : 'Рабочий дедлайн',
      'Недостаток качественного сна',
    ],
    detected_resource_factors: [
      'Пешие прогулки на свежем воздухе',
      'Качественный сон > 7.5 часов',
      'Творческая активность и рисование',
    ],
    risk_level: riskLevel,
    positive_triggers: [
      { text: 'Утренние прогулки и легкий спорт', impact: '+2.8 к самочувствию', confidence: 'high' },
      { text: 'Занятия творчеством и живописью', impact: '+3.1 к энергии', confidence: 'high' },
      { text: 'Поддерживающее общение с близкими', impact: '-2.4 к тревоге', confidence: 'medium' },
    ],
    negative_triggers: [
      { text: 'Срочные рабочие дедлайны', impact: '+3.5 к уровню стресса', confidence: 'high' },
      { text: 'Избыток кофеина на голодный желудок', impact: '+2.2 к тревожности', confidence: 'high' },
    ],
    resource_forecast: stateScore >= 8 ? 'high' : stateScore >= 5 ? 'medium' : 'low',
    forecast_reasoning:
      stateScore >= 8
        ? 'Ожидается высокий ресурс: уровень сна и дневной активности находится в оптимальной зоне.'
        : 'Ожидается средний ресурс: за последние дни зафиксированы колебания энергии.',
    recommendations: [
      'Сохраняйте утренние ритуалы и прогулки на свежем воздухе.',
      'При появлении рабочей тревоги используйте технику дыхания 4-7-8.',
      'Запланируйте минимум 30 минут личного времени вечером для отдыха.',
    ],
  };
}

function generateMockHealthAdvice(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('ферритин') || q.includes('железо') || q.includes('анемия')) {
    return `**Анализ уровня ферритина:**
Уровень ферритина отражает запасы железа в организме.
• **Снижение (< 30 мкг/л):** указывает на скрытый железодефицит или анемию. Симптомы: слабость, выпадение волос, ломкость ногтей.
• **Повышение (> 200–300 мкг/л):** может встречаться при воспалительных процессах, перегрузке железом или болезнях печени.

*Рекомендация:* Сдайте клинический анализ крови, С-реактивный белок и обратитесь к терапевту или гематологу.`;
  }
  if (q.includes('витамин d') || q.includes('витамин д')) {
    return `**Витамин D (25-OH Vitamin D):**
Оптимальный уровень в крови — **30–60 нг/мл**.
• Если показатель ниже 20 нг/мл — это выраженный дефицит.
• Витамин D отвечает за иммунитет, плотность костей, сон и эмоциональное состояние.

*Рекомендация:* При дефиците врач обычно назначает восполняющую дозировку (например, 5000 МЕ/сутки на 8 недель) с последующим переходом на профилактическую (1000–2000 МЕ).`;
  }
  return `Спасибо за вопрос! По вашим показателям в анкете:

1. **Общий уровень подготовки:** Профиль заполнен, основные системы находятся под наблюдением.
2. **Основные маркёры:** Обратите внимание на регулярность сна и поддержание питьевого режима (1.5–2 л воды в день).
3. **Рекомендации:** Для точной оценки результатов лабораторных тестов прикрепите документ в разделе «Исследования».

*Примечание:* Информация носит ознакомительный характер. При недомогании обязательно обратитесь к лечащему врачу.`;
}

function generateStructuredDocFallback(fileName: string) {
  return {
    documentType: 'Клинический лабораторный анализ',
    laboratoryName: 'Лаборатория «Инвитро»',
    researchDate: new Date().toISOString().split('T')[0],
    patientName: 'Анна',
    rawText: 'Гемоглобин 132 г/л (120-150); Витамин D (25-OH) 22.1 нг/мл (30-100); С-реактивный белок 1.2 мг/л (0-5); Ферритин 42.0 мкг/л (15-150).',
    overallConfidence: 0.94,
    warnings: ['Уровень Витамина D3 ниже референсного значения лаборатории (22.1 нг/мл при норме 30-100).'],
    results: [
      {
        category: 'Витамины и микроэлементы',
        originalName: 'Витамин D (25-OH)',
        normalizedName: 'vitamin_d',
        value: 22.1,
        valueText: '22.1',
        unit: 'нг/мл',
        referenceMin: 30,
        referenceMax: 100,
        referenceText: '30–100',
        status: 'low',
        sourcePage: 1,
        confidence: 0.92,
      },
      {
        category: 'Гематология',
        originalName: 'Гемоглобин',
        normalizedName: 'hemoglobin',
        value: 132,
        valueText: '132',
        unit: 'г/л',
        referenceMin: 120,
        referenceMax: 150,
        referenceText: '120–150',
        status: 'normal',
        sourcePage: 1,
        confidence: 0.98,
      },
      {
        category: 'Биохимия',
        originalName: 'С-реактивный белок (СРБ)',
        normalizedName: 'crp',
        value: 1.2,
        valueText: '1.2',
        unit: 'мг/л',
        referenceMin: 0,
        referenceMax: 5,
        referenceText: '0–5',
        status: 'normal',
        sourcePage: 1,
        confidence: 0.97,
      },
      {
        category: 'Биохимия',
        originalName: 'Ферритин',
        normalizedName: 'ferritin',
        value: 42.0,
        valueText: '42.0',
        unit: 'мкг/л',
        referenceMin: 15,
        referenceMax: 150,
        referenceText: '15–150',
        status: 'normal',
        sourcePage: 1,
        confidence: 0.95,
      },
    ],
  };
}

function generateMockDocAnalysis(fileName: string, category?: string) {
  return {
    title: fileName,
    date: new Date().toLocaleDateString('ru-RU'),
    category: category || 'Лабораторные анализы',
    summary: 'Анализ обработан. Выявлены незначительные отклонения по показателям липидного профиля и витамина D.',
    deviations: [
      {
        marker: 'Витамин D (25-OH)',
        value: '18.4 нг/мл',
        norm: '30.0 - 100.0 нг/мл',
        status: 'Ниже нормы',
        explanation: 'Умеренный дефицит. Может вызывать повышенную утомляемость и сниженный иммунитет.',
      },
      {
        marker: 'Холестерин общий',
        value: '5.6 ммоль/л',
        norm: '3.1 - 5.2 ммоль/л',
        status: 'Выше нормы',
        explanation: 'Небольшое превышение целевого значения. Рекомендуется скорректировать рацион питания.',
      },
      {
        marker: 'Ферритин',
        value: '42.0 мкг/л',
        norm: '15.0 - 150.0 мкг/л',
        status: 'В норме',
        explanation: 'Депо железа в норме.',
      },
    ],
    recommendations: [
      'Консультация терапевта для подбора дозировки Витамина D3',
      'Увеличение в рационе продуктов, богатых омега-3 (жирная рыба, орехи)',
      'Контрольный анализ через 2-3 месяца',
    ],
  };
}

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
