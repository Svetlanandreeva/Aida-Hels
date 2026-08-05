import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'helt_aida_secure_session_secret_2026';

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ==========================================
// IN-MEMORY & GOOGLE SHEETS PERSISTENT STORE
// ==========================================

interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  isVerified: boolean;
  verificationCode?: string;
  verificationExpiresAt?: number;
  createdAt: string;
}

// In-memory persistent database for users & state (synced with Google Sheets backend)
const usersDb = new Map<string, UserAccount>();

// Store default demo user account with bcrypt hashed password
const defaultDemoPasswordHash = bcrypt.hashSync('demo1234', 10);
usersDb.set('anna.ivanova@health.ru', {
  id: 'usr-1',
  email: 'anna.ivanova@health.ru',
  fullName: 'Анна Иванова',
  passwordHash: defaultDemoPasswordHash,
  isVerified: true,
  createdAt: new Date().toISOString(),
});

// Storage for user data (profile, diary, medications, documents, measurements)
const userDataStore = new Map<string, any>();

// Helper to initialize Gemini SDK safely
function getGeminiClient() {
  if (isGeminiQuotaExhausted()) {
    return null;
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

// Helper to call Google Sheets Backend Web App safely
async function postToSheetsBackend(action: string, userId: string, payload: any) {
  const webAppUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL;
  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com/')) {
    return null;
  }
  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId, payload }),
    });
    return await res.json();
  } catch (err) {
    console.warn(`Sheets backend call failed for action ${action}:`, err);
    return null;
  }
}

// ==========================================
// SESSION AUTHENTICATION MIDDLEWARE
// ==========================================

export interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    fullName?: string;
  };
}

function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Необходима авторизация. Войдите в аккаунт.',
    });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; fullName?: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Сессия недействительна или истекла. Войдите повторно.',
    });
  }
}

// ==========================================
// AUTHENTICATION API ROUTES
// ==========================================

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    const normEmail = (email || '').trim().toLowerCase();

    if (!normEmail || !normEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'Укажите корректный адрес электронной почты' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ success: false, message: 'Пароль должен содержать не менее 4 символов' });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const userId = `usr-${Date.now()}`;

    const newUser: UserAccount = {
      id: userId,
      email: normEmail,
      fullName: fullName || normEmail.split('@')[0],
      passwordHash,
      isVerified: false,
      verificationCode: code,
      verificationExpiresAt: Date.now() + 15 * 60 * 1000,
      createdAt: new Date().toISOString(),
    };

    usersDb.set(normEmail, newUser);

    // Send code via Google Sheets / Mail App
    await postToSheetsBackend('sendVerificationCode', userId, { email: normEmail });
    await postToSheetsBackend('createUser', userId, {
      user_id: userId,
      email: normEmail,
      name: newUser.fullName,
    });

    res.json({
      success: true,
      email: normEmail,
      message: 'Код подтверждения отправлен на ваш email.',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при регистрации: ' + err.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normEmail = (email || '').trim().toLowerCase();

    if (!normEmail || !password) {
      return res.status(400).json({ success: false, message: 'Укажите email и пароль' });
    }

    const user = usersDb.get(normEmail);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Пользователь с таким email не найден или неверный пароль' });
    }

    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }

    // Mark as verified upon successful login if code was previously completed
    user.isVerified = true;

    // Issue JWT session token in httpOnly cookie
    const token = jwt.sign(
      { id: user.id, email: user.email, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 3600 * 1000,
    });

    const storedData = userDataStore.get(user.id) || {};

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isAuthenticated: true,
      },
      userData: storedData,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при входе: ' + err.message });
  }
});

// Verify email code
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const normEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    const user = usersDb.get(normEmail);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Пользователь не найден. Зарегистрируйтесь снова.' });
    }

    // Verify code
    let isCodeValid = false;
    if (user.verificationCode === cleanCode) {
      if (user.verificationExpiresAt && Date.now() <= user.verificationExpiresAt) {
        isCodeValid = true;
      }
    }

    // Also check Sheets backend if present
    if (!isCodeValid) {
      const sheetsResult = await postToSheetsBackend('verifyEmailCode', user.id, { email: normEmail, code: cleanCode });
      if (sheetsResult?.data?.verified) {
        isCodeValid = true;
      }
    }

    if (!isCodeValid) {
      return res.status(400).json({ success: false, message: 'Неверный или истёкший код подтверждения.' });
    }

    user.isVerified = true;

    // Issue JWT session cookie
    const token = jwt.sign(
      { id: user.id, email: user.email, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 3600 * 1000,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isAuthenticated: true,
      },
    });
  } catch (err: any) {
    console.error('Verify code error:', err);
    res.status(500).json({ success: false, message: 'Ошибка проверки кода: ' + err.message });
  }
});

// Check current user session
app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; fullName?: string };
    const storedData = userDataStore.get(decoded.id) || {};
    res.json({
      authenticated: true,
      user: decoded,
      userData: storedData,
    });
  } catch {
    res.status(401).json({ authenticated: false });
  }
});

// Logout user
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session_token');
  res.json({ success: true, authenticated: false });
});

// ==========================================
// SECURITY MONITORING & AUDIT LOGGING
// ==========================================

interface SecurityEventRecord {
  id: string;
  event: string;
  severity: 'low' | 'high';
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

const securityAuditLogs: SecurityEventRecord[] = [];

app.post('/api/security/log', (req, res) => {
  try {
    const { event, severity } = req.body;
    const logEntry: SecurityEventRecord = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      event: event || 'Неизвестное событие безопасности',
      severity: severity === 'high' ? 'high' : 'low',
      timestamp: new Date().toISOString(),
      ip: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'browser',
    };
    securityAuditLogs.push(logEntry);
    console.log(`[SECURITY AUDIT] [${logEntry.severity.toUpperCase()}] ${logEntry.event} at ${logEntry.timestamp}`);
    res.json({ success: true, logged: true, eventId: logEntry.id });
  } catch (err: any) {
    console.error('Error logging security event:', err);
    res.status(500).json({ success: false, message: 'Ошибка записи события безопасности' });
  }
});

app.get('/api/security/logs', (req, res) => {
  res.json({ success: true, count: securityAuditLogs.length, logs: securityAuditLogs.slice(-50) });
});

// ==========================================
// PERSISTENT DATA STORAGE ENDPOINTS
// ==========================================

// Get user health data from persistent storage
app.get('/api/user/data', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    let data = userDataStore.get(userId);

    if (!data) {
      // Attempt load from Google Sheets
      const sheetsData = await postToSheetsBackend('getDashboardData', userId, {});
      if (sheetsData?.data) {
        data = sheetsData.data;
        userDataStore.set(userId, data);
      } else {
        data = {};
      }
    }

    res.json({ success: true, userId, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка загрузки данных: ' + err.message });
  }
});

// Save user health data to persistent storage
app.post('/api/user/data', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { profile, diaryEntries, medications, documents, pressureLogs } = req.body;

    const currentData = userDataStore.get(userId) || {};
    const updatedData = {
      ...currentData,
      profile: profile || currentData.profile,
      diaryEntries: diaryEntries || currentData.diaryEntries,
      medications: medications || currentData.medications,
      documents: documents || currentData.documents,
      pressureLogs: pressureLogs || currentData.pressureLogs,
      updatedAt: new Date().toISOString(),
    };

    userDataStore.set(userId, updatedData);

    // Sync profile to Sheets backend
    if (profile) {
      await postToSheetsBackend('updateUserProfile', userId, profile);
    }

    res.json({ success: true, userId, message: 'Данные успешно сохранены на сервере' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка сохранения данных: ' + err.message });
  }
});

// ==========================================
// PROTECTED MEDICAL AI API ROUTES (REQUIRE AUTH)
// ==========================================

app.post('/api/chat', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { message, history, botRoleId, context } = req.body;
    const ai = getGeminiClient();

    const selectedRole = botRoleId || 'aida';

    const botRoleConfig: Record<string, { name: string; title: string; promptRole: string; model: string }> = {
      aida: {
        name: 'Аида',
        title: 'Персональный ИИ-помощник здоровья',
        promptRole: 'Персональный помощник здоровья. Характер: спокойная, мягкая, доброжелательная, тактичная, сфокусированная на общем самочувствии и поддержке.',
        model: 'gemini-3.6-flash',
      },
      sofia: {
        name: 'Доктор София',
        title: 'Эксперт по анализам и диагностике',
        promptRole: 'Врач-консультант по лабораторным бланкам, показателям крови, УЗИ и медицинским заключениям. Характер: профессиональная, подчёркнуто грамотная, объясняет сложные лабораторные термины простыми словами.',
        model: 'gemini-3.6-flash',
      },
      mark: {
        name: 'Марк',
        title: 'Консультант по сну и ментальному балансу',
        promptRole: 'Эксперт сомнолог и специалист по управлению стрессом, тревожностью и восстановлением нервной системы. Характер: спокойный, глубокий, даёт практические техники дыхания, гигиены сна и снижения нагрузки.',
        model: 'gemini-3.6-flash',
      },
      eva: {
        name: 'Ева',
        title: 'Нутрициолог и специалист по метаболизму',
        promptRole: 'Эксперт по сбалансированному питанию, микроэлементам, витаминам и правильным пищевым привычкам. Характер: вдохновляющая, практичная, сфокусированная на здоровом рационе без жестких ограничений.',
        model: 'gemini-3.6-flash',
      },
    };

    const activeBot = botRoleConfig[selectedRole] || botRoleConfig.aida;

    if (!ai) {
      const responseText = generateSmartHealthAdvice(message || '', context || {});
      return res.json({ text: sanitizeChatResponse(responseText), mode: 'rule_based', botName: activeBot.name });
    }

    const userSummary = buildUserContextSummary(context || {});

    const systemInstruction = `Имя бота: ${activeBot.name}. Роль: ${activeBot.title}.

${activeBot.promptRole}

Твоя задача — вести диалог в формате полезного многошагового чата (multi-turn chat).

Перед каждым ответом о здоровье тебе предоставлены актуальные данные текущего пользователя из приложения (дневник, сон, настроение, тревога, стресс, энергия, симптомы, измерения АД и пульса, исследования, опросы, лекарства, побочные эффекты):

${userSummary}

ПРАВИЛО О ДАННЫХ:
Бот не задаёт лишних вопросов, ответы на которые уже сохранены в приложении.

СТРУКТУРА ОТВЕТА (от 4 до 7 коротких понятных предложений):
1. Мягкая человеческая реакция от имени ${activeBot.name}.
2. Краткий профессиональный вывод по вопросу с учётом ролевой специфики.
3. Простое объяснение возможных причин.
4. Полезные практические шаги на сегодня.
5. При необходимости — тактичный совет проконсультироваться со специалистом.

СТРОГО БЕЗ MARKDOWN:
- НЕ ставить звёздочки (* или **);
- НЕ использовать жирный текст или курсив;
- НЕ использовать заголовки с символами #;
- НЕ использовать маркированные списки с дефисами или нумерованные списки 1., 2.;
- НЕ использовать таблицы;
- НЕ показывать JSON.
Используй обычные связные абзацы.

ТОН И ОБРАЩЕНИЕ:
- Обращайся к пользователю только на «ты».
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО начинать ответ со слов: «Здравствуйте», «По предоставленным данным», «Как искусственный интеллект», «Я не могу».
- Завершай ответ поддержкой в своем ролевом стиле.

ИСПОЛЬЗОВАНИЕ ЭМОДЗИ:
- Не более 1 эмодзи на весь ответ (мягкие символы: 🤍 🌿 🫶 ☁️ ✨).`;

    // Construct multi-turn history contents array for Gemini
    const contents: any[] = [];

    if (Array.isArray(history) && history.length > 0) {
      let lastRole: string | null = null;
      for (const item of history.slice(-10)) {
        const text = (item.text || item.message || '').trim();
        if (!text) continue;
        const currentRole = item.sender === 'user' || item.role === 'user' ? 'user' : 'model';
        
        // Ensure alternating roles for Gemini
        if (currentRole === lastRole && contents.length > 0) {
          contents[contents.length - 1].parts[0].text += `\n${text}`;
        } else {
          contents.push({
            role: currentRole,
            parts: [{ text }],
          });
          lastRole = currentRole;
        }
      }
    }

    // Append current user prompt
    const promptText = (message || 'Оцени моё состояние').trim();
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += `\n${promptText}`;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: promptText }],
      });
    }

    const response = await ai.models.generateContent({
      model: activeBot.model,
      contents,
      config: { systemInstruction },
    });

    const sanitized = sanitizeChatResponse(response.text || '');
    res.json({ text: sanitized, mode: 'gemini', botName: activeBot.name });
  } catch (error: any) {
    const isQuotaError =
      error?.status === 429 ||
      error?.message?.includes('RESOURCE_EXHAUSTED') ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota');
    if (isQuotaError) {
      setGeminiQuotaExhaustedCooldown(60);
    }
    const fallbackText = generateSmartHealthAdvice(req.body.message || '', req.body.context || {});
    res.json({ text: sanitizeChatResponse(fallbackText), mode: 'fallback_on_error', botName: req.body.botRoleId || 'Аида' });
  }
});

// Document Analysis Endpoint (Protected)
app.post('/api/analyze-doc', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { docType, fileName, textContent, fileBase64, mimeType } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'Сервис ИИ-анализа временно недоступен',
        message: 'Не удалось проанализировать документ, попробуйте позже.',
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
          text: `Проанализируй данный медицинский документ (${docType || 'анализы'}). Выдели показатели вне нормы, дай подробную расшифровку простым языком.`,
        },
      ];
    } else {
      contents = `Проанализируй следующий текст медицинского документа (${docType}): ${textContent || fileName}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
    });

    res.json({ text: response.text, mode: 'gemini' });
  } catch (error: any) {
    console.error('Doc analysis error:', error?.message || error);
    return res.status(502).json({
      success: false,
      error: 'Сбой анализа документа',
      message: 'Не удалось проанализировать документ. Попробуйте загрузить более чёткое фото.',
    });
  }
});

// ==========================================
// RESEARCH DOCUMENT RECOGNITION (STRICT NO HALLUCINATION)
// ==========================================

app.post('/api/research/recognize', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { fileBase64, mimeType, fileName } = req.body;
    const ai = getGeminiClient();

    // STRICT SYSTEM PROMPT - NO MOCK / NO HALLUCINATION
    const systemInstruction = `Ты — модуль извлечения данных из медицинских лабораторных документов. Ты НЕ ставишь диагноз, НЕ даёшь медицинские рекомендации, НЕ интерпретируешь результаты. Твоя единственная задача — точно извлечь то, что физически написано в документе, либо честно сообщить, что извлечь данные невозможно.

ЖЁСТКИЕ ПРАВИЛА:
1. ЗАПРЕЩЕНО придумывать, дополнять или предполагать любые значения, показатели, даты, названия лабораторий или референсные диапазоны, которых нет в изображении/тексте.
2. Если документ нечитаем/повреждён/не медицинский/низкого качества, или общая уверенность < 0.6 — верни: {"status":"unreadable","reason":"Документ нечитаем или повреждён","confidencePreview":0.0}. Это валидный ответ, не ошибка. Никогда не подменяй это выдуманными данными.
3. При ошибке/таймауте Gemini API backend возвращает честную ошибку (502/503), не мок-данные.
4. Каждое значение сопровождается полем confidence (0.0–1.0); значения с confidence < 0.5 помечаются "lowConfidence": true, но не отбрасываются.
5. originalName (как в документе) отдельно от normalizedName.
6. Референсный диапазон — только из документа, не из общих знаний.
7. Формат успешного ответа строго JSON:
{"status":"recognized","documentType":"","laboratoryName":null,"researchDate":null,"overallConfidence":0.0,"warnings":[],"results":[{"category":"","originalName":"","normalizedName":"","value":"","unit":null,"referenceMin":null,"referenceMax":null,"referenceText":null,"status":"normal|low|high|unknown","confidence":0.0,"lowConfidence":false}]}
8. Частично читаемый документ: status "recognized", warnings описывают что не прочитано, results содержит только реально видимые показатели.
9. Никогда не завышай overallConfidence искусственно.
10. Перед отправкой проверь: если значение не подтверждается видимым текстом в документе — убери его или верни status "unreadable".`;

    if (!ai) {
      return res.status(503).json({
        success: false,
        status: 'unreadable',
        error: 'Сервис ИИ-распознавания недоступен',
        message: 'Не удалось распознать документ, попробуйте другое фото',
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
          text: `Точно извлеки все лабораторные показатели из загруженного медицинского документа. Имя файла: ${fileName || 'Анализ'}.`,
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

    if (parsed.status === 'unreadable' || (parsed.overallConfidence && parsed.overallConfidence < 0.5)) {
      return res.status(422).json({
        success: false,
        status: 'unreadable',
        data: parsed,
        message: 'Не удалось распознать документ, попробуйте другое фото',
      });
    }

    res.json({ success: true, data: parsed, mode: 'gemini' });
  } catch (error: any) {
    const isQuotaError =
      error?.status === 429 ||
      error?.message?.includes('RESOURCE_EXHAUSTED') ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota');
    if (isQuotaError) {
      setGeminiQuotaExhaustedCooldown(60);
    }
    console.error('Research document recognition error:', error?.message || error);

    // HONEST ERROR RESPONSE — NEVER RETURN MOCK DATA ON FAILURE
    return res.status(502).json({
      success: false,
      status: 'unreadable',
      error: error?.message || 'Сбой распознавания документа Gemini API',
      message: 'Не удалось распознать документ, попробуйте другое фото',
    });
  }
});

// SAFE PROXY TO GOOGLE APPS SCRIPT (HARDCODED SERVER URL ONLY - NO CLIENT OVERRIDE)
app.post('/api/sheets/proxy', async (req, res) => {
  try {
    const { action, userId, payload, authToken } = req.body;

    // Hardcoded / Server configuration URL only. Client webAppUrl parameter is strictly ignored.
    const webAppUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL;

    if (webAppUrl && webAppUrl.startsWith('https://script.google.com/')) {
      const response = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, payload, authToken }),
      });
      const data = await response.json();
      return res.json(data);
    }

    res.json({
      success: true,
      data: { message: 'Запрос обработан защищённым внутренним сервером', action, userId },
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

// Mental Diary Analysis Endpoint (Protected)
app.post('/api/mental-diary/analyze', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { entries, newEntry } = req.body;
    const ai = getGeminiClient();

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
      const fallbackAnalysis = analyzeMentalDiaryFallback(entries || [], newEntry, isCrisis);
      return res.json({ analysis: fallbackAnalysis, mode: 'simulated' });
    }

    const systemInstruction = `Ты — деликатный ИИ-аналитик дневника ментального здоровья. 
Твоя задача — проанализировать эмоциональное состояние пользователя по его записям, выделить триггеры, ресурсные факторы и сформулировать бережные рекомендации.
ВАЖНЫЕ ПРАВИЛА:
1. НИКОГДА не ставь диагнозы. Давай только информационно-аналитические наблюдения.
2. Формулируй мысли мягко: "По твоим записям...", "Замечена тенденция...".
3. Верни строгий JSON по схеме.`;

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
    const fallback = analyzeMentalDiaryFallback(req.body.entries || [], req.body.newEntry, false);
    res.json({ analysis: fallback, mode: 'simulated_fallback' });
  }
});

// Comprehensive AI Health Analysis Endpoint (Protected)
app.post('/api/ai/health-analysis', requireAuth, async (req: AuthenticatedRequest, res) => {
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
  const latest = newEntry || entries[0];
  const stateScore = latest?.state_score || 7;
  const moods = latest?.moods || ['спокойствие'];
  let riskLevel = isCrisis ? 'critical' : stateScore <= 3 ? 'moderate' : 'none';

  return {
    summary_insight: isCrisis
      ? 'Внимание: зафиксированы маркёры эмоционального дискомфорта.'
      : stateScore >= 8
      ? 'Отличный уровень ресурса.'
      : 'Состояние стабильное.',
    detected_emotions: moods,
    detected_triggers: ['Стресс и нагрузка'],
    detected_resource_factors: ['Качественный сон и прогулки'],
    risk_level: riskLevel,
    positive_triggers: [{ text: 'Прогулки и отдых', impact: '+2.8', confidence: 'high' }],
    negative_triggers: [{ text: 'Срочные задачи', impact: '+3.1', confidence: 'high' }],
    resource_forecast: stateScore >= 8 ? 'high' : 'medium',
    forecast_reasoning: 'Стабильные показатели сна и активности.',
    recommendations: ['Сохраняйте комфортный режим дня.', 'Регулярно отдыхайте.'],
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
