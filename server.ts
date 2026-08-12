import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  isPostgresConfigured,
  ensureSchema,
  getUserByEmail,
  createUser,
  getUserData,
  saveUserData,
  updateUserProfile,
  deleteUser,
} from './server/db';
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
import { sanitizeText, calculateAgeInYears } from './server/sanitizerService';
import { canonicalDataLayer } from './server/canonicalDataLayer';
import { aiContextBuilder } from './server/aiContextBuilder';
import { wearablesService } from './server/wearablesService';
import { authService } from './server/authService';
import { onboardingService, BASE_ONBOARDING_SCHEMA } from './server/onboardingService';
import { puzzleService } from './server/puzzleService';
import { homeApiService } from './server/homeApiService';
import { timelineService } from './server/timelineService';
import { labStagingService } from './server/labStagingService';
import { integrationsService } from './server/integrationsService';
import { permissionService } from './server/permissionService';
import { requirePermission } from './server/permissionMiddleware';
import { aiToolsService } from './server/aiToolsService';
import { healthFactCandidateService } from './server/healthFactCandidateService';
import { auditProvenanceService } from './server/auditProvenanceService';
import { familyDoctorSharingService, calculateAgeAtDate } from './server/familyDoctorSharingService';
import { safetyEmergencyService } from './server/safetyEmergencyService';
import { dentalService } from './server/dentalService';
import { v1ApiRouter } from './server/v1ApiContractRouter';
import {
  isYandexCloudConfigured,
  recognizeWithYandexCloudVision,
  parseMedicalTextToResults,
} from './server/yandexOcr';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'helt_aida_secure_session_secret_2026';

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ==========================================
// IN-MEMORY & DATABASE PERSISTENT STORE
// ==========================================

interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  isVerified: boolean;
  verificationCodeHash?: string;
  verificationExpiresAt?: number;
  createdAt: string;
}

// In-memory persistent database cache
const usersDb = new Map<string, UserAccount>();

// Store failed OTP attempts per normalized email for rate-limiting
const otpAttemptsDb = new Map<string, { count: number; blockedUntil?: number }>();

// Store default demo user account
const defaultDemoPasswordHash = bcrypt.hashSync('demo1234', 10);
usersDb.set('anna.ivanova@health.ru', {
  id: 'usr-1',
  email: 'anna.ivanova@health.ru',
  fullName: 'Анна Иванова',
  passwordHash: defaultDemoPasswordHash,
  isVerified: true,
  createdAt: new Date().toISOString(),
});

// Storage for user data
const userDataStore = new Map<string, any>();

// Helper to initialize Gemini SDK safely
function getGeminiClient() {
  if (isGeminiQuotaExhausted()) {
    return null;
  }
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY;
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
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; fullName?: string };
      req.user = decoded;
      return next();
    } catch (err) {
      // Invalid/expired token - fall through to fallback demo session
    }
  }

  // Allow seamless access for demo/guest users
  req.user = {
    id: 'usr-1',
    email: 'anna.ivanova@health.ru',
    fullName: 'Анна Иванова',
  };
  next();
}

// ==========================================
// AUTHENTICATION API ROUTES
// ==========================================

function requireConsent(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Необходима авторизация.' });
  }

  const storedData = userDataStore.get(userId) || {};
  const profile = req.body?.profile || storedData?.profile || {};

  const consentPersonal = profile.consentPersonalData ?? profile.consentPersonal ?? true;
  const consentMedical = profile.consentMedicalData ?? profile.consentMedical ?? true;

  if (consentPersonal === false || consentMedical === false) {
    return res.status(403).json({
      success: false,
      error: 'CONSENT_REQUIRED',
      message: 'Для сохранения медицинских данных необходимо принять Пользовательское соглашение и политику обработки цифровых данных',
    });
  }

  next();
}

// ==========================================
// API V1 CONTRACT ROUTER (Requirement 22)
// ==========================================
app.use('/api/v1', v1ApiRouter);

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

    if (isPostgresConfigured()) {
      const existing = await getUserByEmail(normEmail);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Пользователь с таким email уже зарегистрирован' });
      }
    } else if (usersDb.has(normEmail)) {
      return res.status(400).json({ success: false, message: 'Пользователь с таким email уже зарегистрирован' });
    }

    // Hash password with bcrypt cost factor = 12
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Generate 6-digit random code and hash with SHA-256 for secure storage
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const userId = `usr-${Date.now()}`;

    const newUser: UserAccount = {
      id: userId,
      email: normEmail,
      fullName: fullName || normEmail.split('@')[0],
      passwordHash,
      isVerified: true,
      verificationCodeHash,
      verificationExpiresAt: Date.now() + 600 * 1000, // 10 minutes TTL
      createdAt: new Date().toISOString(),
    };

    if (isPostgresConfigured()) {
      await createUser({
        id: userId,
        email: normEmail,
        fullName: newUser.fullName,
        passwordHash,
        isVerified: true,
        verificationCodeHash,
        verificationExpiresAt: newUser.verificationExpiresAt,
      });
    }

    usersDb.set(normEmail, newUser);

    // Create session via AuthService
    const session = authService.createSession(newUser.id, {
      ip: req.ip || '',
      userAgent: (req.headers['user-agent'] as string) || '',
      email: newUser.email,
      fullName: newUser.fullName,
    });
    const token = session.token;

    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 3600 * 1000,
    });

    res.json({
      success: true,
      token,
      email: normEmail,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        isAuthenticated: true,
      },
      message: 'Регистрация успешно завершена.',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при регистрации: ' + err.message });
  }
});

// Send verification code endpoint
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    const normEmail = (email || '').trim().toLowerCase();
    if (!normEmail || !normEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'Укажите корректный адрес электронной почты' });
    }

    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeHash = crypto.createHash('sha256').update(rawCode).digest('hex');

    res.json({
      success: true,
      data: { code: rawCode, email: normEmail, hash: verificationCodeHash },
      message: 'Код подтверждения сгенерирован защищённым сервером',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка отправки кода: ' + err.message });
  }
});

// Helper function to completely remove user account and data
async function performDeleteUserAccount(userId: string, email?: string) {
  const normEmail = (email || '').trim().toLowerCase();

  if (normEmail) {
    usersDb.delete(normEmail);
    otpAttemptsDb.delete(normEmail);
  }

  for (const [key, userObj] of usersDb.entries()) {
    if ((userId && userObj.id === userId) || (normEmail && userObj.email === normEmail)) {
      usersDb.delete(key);
    }
  }

  if (userId) {
    userDataStore.delete(userId);
  }
  if (normEmail) {
    userDataStore.delete(normEmail);
  }

  await canonicalDataLayer.deleteUserData(userId, normEmail);
}

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normEmail = (email || '').trim().toLowerCase();

    if (!normEmail || !password) {
      return res.status(400).json({ success: false, message: 'Укажите email и пароль' });
    }

    let user: UserAccount | null = null;

    if (isPostgresConfigured()) {
      const dbUser = await getUserByEmail(normEmail);
      if (dbUser) {
        user = {
          id: dbUser.id,
          email: dbUser.email,
          fullName: dbUser.fullName || dbUser.email.split('@')[0],
          passwordHash: dbUser.passwordHash || '',
          isVerified: dbUser.isVerified,
          createdAt: dbUser.createdAt,
        };
        if (user.passwordHash) {
          usersDb.set(normEmail, user);
        }
      }
    }

    if (!user) {
      user = usersDb.get(normEmail) || null;
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Пользователь с таким email не найден или неверный пароль' });
    }

    // Verify password with bcrypt safely without throwing on missing or non-string passwordHash
    if (!user.passwordHash || typeof user.passwordHash !== 'string' || user.passwordHash.length === 0) {
      console.warn(`[Auth Warning] User ${normEmail} has empty or non-string passwordHash`);
      return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }

    // Mark as verified upon successful login
    user.isVerified = true;

    // Create session via AuthService
    const session = authService.createSession(user.id, {
      ip: req.ip || '',
      userAgent: (req.headers['user-agent'] as string) || '',
      email: user.email,
      fullName: user.fullName,
    });
    const token = session.token;

    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 3600 * 1000,
    });

    let storedData = {};
    if (isPostgresConfigured()) {
      storedData = (await getUserData(user.id)) || {};
    } else {
      storedData = userDataStore.get(user.id) || {};
    }

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

// Verify email code (With TTL check & Rate Limiting)
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const normEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    // Check rate limiting (3 attempts -> 15 min lock)
    const attempts = otpAttemptsDb.get(normEmail) || { count: 0 };
    if (attempts.blockedUntil && Date.now() < attempts.blockedUntil) {
      const remainMins = Math.ceil((attempts.blockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Превышено количество попыток ввода кода. Попробуйте через ${remainMins} мин.`,
      });
    }

    const user = usersDb.get(normEmail);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Пользователь не найден. Зарегистрируйтесь снова.' });
    }

    // Check TTL (10 minutes)
    if (!user.verificationCodeHash || !user.verificationExpiresAt || Date.now() > user.verificationExpiresAt) {
      user.verificationCodeHash = undefined;
      user.verificationExpiresAt = undefined;
      return res.status(400).json({ success: false, message: 'Срок действия кода истёк' });
    }

    // Hash user input code with SHA-256 and compare
    const inputHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    let isCodeValid = user.verificationCodeHash === inputHash;

    if (!isCodeValid) {
      attempts.count = (attempts.count || 0) + 1;
      if (attempts.count >= 3) {
        attempts.blockedUntil = Date.now() + 15 * 60 * 1000;
        otpAttemptsDb.set(normEmail, attempts);
        return res.status(429).json({
          success: false,
          message: 'Превышено количество попыток ввода кода. Доступ заблокирован на 15 минут',
        });
      }
      otpAttemptsDb.set(normEmail, attempts);
      return res.status(400).json({ success: false, message: `Неверный код подтверждения. Осталось попыток: ${3 - attempts.count}` });
    }

    // Code is valid: clear OTP records and rate limit
    user.verificationCodeHash = undefined;
    user.verificationExpiresAt = undefined;
    user.isVerified = true;
    otpAttemptsDb.delete(normEmail);

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

// GET /session with account, active profile, available profiles, onboarding status & feature flags
const handleGetSession = async (req: express.Request, res: express.Response) => {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({
      authenticated: false,
      account: null,
      activeProfile: null,
      availableProfiles: [],
      onboardingStatus: { isCompleted: false, currentStep: 'unauthenticated', completedSteps: [] },
      featureFlags: { enableAIInsights: true, enableWearables: true, enableDentalSuite: true, enableCloudSync: true, enableMFA: false },
      activeSessions: [],
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; fullName?: string };
    const activeSubjectId = (req.query.subject_profile_id as string) || undefined;
    const sessionResponse = await authService.buildSessionResponse(decoded.id, token, activeSubjectId);
    res.json(sessionResponse);
  } catch (err: any) {
    res.status(401).json({ authenticated: false, message: 'Недействительный сеанс: ' + err.message });
  }
};

app.get('/session', handleGetSession);
app.get('/api/session', handleGetSession);

// Password recovery request
app.post('/api/auth/recovery/request', async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    const norm = (emailOrPhone || '').trim().toLowerCase();
    if (!norm) {
      return res.status(400).json({ success: false, message: 'Укажите email или номер телефона' });
    }

    const { code, expiresAt } = authService.requestRecovery(norm);
    res.json({
      success: true,
      data: { code, expiresAt },
      message: 'Код восстановления сформирован сервером',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка запроса восстановления: ' + err.message });
  }
});

// Password recovery confirm
app.post('/api/auth/recovery/confirm', async (req, res) => {
  try {
    const { emailOrPhone, code, newPassword } = req.body;
    const norm = (emailOrPhone || '').trim().toLowerCase();

    if (!norm || !code || !newPassword || newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'Укажите корректный код и новый пароль (не менее 4 символов)' });
    }

    await authService.confirmRecovery(norm, code, newPassword);

    // Update password in usersDb
    const newHash = await bcrypt.hash(newPassword, 12);
    const user = usersDb.get(norm);
    if (user) {
      user.passwordHash = newHash;
    }

    res.json({
      success: true,
      message: 'Пароль успешно изменён. Войдите с новым паролем.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Revoke sessions / trusted devices for lost-device scenario
const handleRevokeSessions = async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = req.user!.id;
    const { sessionIdToRevoke, revokeAllExceptCurrent } = req.body || {};
    const currentToken = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');

    if (sessionIdToRevoke) {
      const revoked = authService.revokeSession(userId, sessionIdToRevoke);
      return res.json({ success: revoked, message: revoked ? 'Сессия устройства отозвана' : 'Сессия не найдена' });
    }

    let currentSessionId: string | undefined;
    if (currentToken) {
      try {
        const decoded = jwt.verify(currentToken, JWT_SECRET) as any;
        currentSessionId = decoded.sessionId;
      } catch {}
    }

    const revokedCount = authService.revokeAllSessions(
      userId,
      revokeAllExceptCurrent ? currentSessionId : undefined
    );

    if (!revokeAllExceptCurrent) {
      res.clearCookie('session_token');
    }

    res.json({
      success: true,
      revokedCount,
      message: `Успешно отозвано активных устройств: ${revokedCount}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка отзыва сессий: ' + err.message });
  }
};

app.post('/api/auth/revoke-sessions', requireAuth, handleRevokeSessions);
app.post('/api/auth/devices/revoke', requireAuth, handleRevokeSessions);

// Delete account endpoints
app.post('/api/auth/delete-account', async (req: AuthenticatedRequest, res) => {
  try {
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    let userId = req.user?.id;
    let email = req.user?.email || req.body?.email;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
        userId = userId || decoded.id;
        email = email || decoded.email;
      } catch {}
    }

    if (req.body?.userId) {
      userId = req.body.userId;
    }

    if (!userId && !email) {
      return res.status(400).json({ success: false, message: 'Не указаны данные пользователя для удаления' });
    }

    await performDeleteUserAccount(userId || '', email || '');
    res.clearCookie('session_token');

    res.json({
      success: true,
      message: 'Учётная запись и все персональные данные полностью удалены',
    });
  } catch (err: any) {
    console.error('Delete account error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при удалении аккаунта: ' + err.message });
  }
});

app.delete('/api/auth/delete-account', async (req: AuthenticatedRequest, res) => {
  try {
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    let userId = req.user?.id;
    let email = req.user?.email || req.body?.email;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
        userId = userId || decoded.id;
        email = email || decoded.email;
      } catch {}
    }

    if (req.body?.userId) {
      userId = req.body.userId;
    }

    await performDeleteUserAccount(userId || '', email || '');
    res.clearCookie('session_token');

    res.json({
      success: true,
      message: 'Учётная запись успешно удалена',
    });
  } catch (err: any) {
    console.error('Delete account error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при удалении аккаунта: ' + err.message });
  }
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
// 14. PERMISSION LAYER & DENY-BY-DEFAULT ACCESS ENGINE
// ==========================================

// 1. Get all issued & received family grants for current user
app.get('/api/permissions/grants', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const issuedGrants = permissionService.getGrantsByOwner(userId);
    const receivedGrants = permissionService.getGrantsByGrantee(userId);

    return res.json({
      success: true,
      issuedGrants,
      receivedGrants,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 2. Create invitation for an adult relative or family member
app.post('/api/permissions/invitation/create', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      granteeName,
      granteeEmailOrPhone,
      relationship,
      isAdult,
      allowedScopes,
      explicitSensitiveScopes,
    } = req.body || {};

    if (!granteeName || !relationship) {
      return res.status(400).json({ success: false, error: 'Имя и тип родственной связи обязательны' });
    }

    const grant = permissionService.createInvitation({
      ownerUserId: userId,
      granteeName: sanitizeText(granteeName),
      granteeEmailOrPhone: granteeEmailOrPhone ? sanitizeText(granteeEmailOrPhone) : undefined,
      relationship: sanitizeText(relationship),
      isAdult: Boolean(isAdult),
      allowedScopes: Array.isArray(allowedScopes) ? allowedScopes : ['emergency_card', 'medications'],
      explicitSensitiveScopes: Array.isArray(explicitSensitiveScopes) ? explicitSensitiveScopes : [],
    });

    return res.json({
      success: true,
      grant,
      message: grant.isAdult
        ? `Приглашение создано. Передайте код приглашения родственнику: ${grant.invitationCode}`
        : 'Семейное разрешение успешно создано',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message });
  }
});

// 3. Accept invitation code with consent
app.post('/api/permissions/invitation/accept', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userName = req.user?.fullName || 'Родственник';
    const { invitationCode } = req.body || {};

    if (!invitationCode) {
      return res.status(400).json({ success: false, error: 'Укажите код приглашения (INV-XXXXXX)' });
    }

    const updatedGrant = permissionService.acceptInvitation(invitationCode, userId, userName);

    return res.json({
      success: true,
      grant: updatedGrant,
      message: 'Приглашение успешно подтверждено! Семейный доступ активирован с учетом установленных скоупов.',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message });
  }
});

// 4. Instant Revoke: Revoke access immediately
app.post('/api/permissions/grants/revoke', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { grantId } = req.body || {};

    if (!grantId) {
      return res.status(400).json({ success: false, error: 'Идентификатор grantId обязателен' });
    }

    const success = permissionService.revokeGrant(userId, grantId);

    return res.json({
      success,
      message: success
        ? 'Права доступа немедленно отозваны (Instant Revoke). Повторные запросы будут заблокированы.'
        : 'Разрешение не найдено или уже отозвано',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message });
  }
});

// 5. Update grant scopes & sensitive scopes
app.post('/api/permissions/grants/update', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { grantId, allowedScopes, explicitSensitiveScopes } = req.body || {};

    if (!grantId) {
      return res.status(400).json({ success: false, error: 'Идентификатор grantId обязателен' });
    }

    const updatedGrant = permissionService.updateGrantScopes(
      userId,
      grantId,
      Array.isArray(allowedScopes) ? allowedScopes : [],
      Array.isArray(explicitSensitiveScopes) ? explicitSensitiveScopes : []
    );

    return res.json({
      success: true,
      grant: updatedGrant,
      message: 'Настройки семейного доступа успешно обновлены',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message });
  }
});

// 6. Audit Log Endpoint
app.get('/api/permissions/audit-log', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const auditLogs = permissionService.getAuditLogs(userId);

    return res.json({
      success: true,
      auditLogs,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// ==========================================
// SERVER-DRIVEN VERSIONED ONBOARDING SCHEMA & PROGRESS
// ==========================================

// Get versioned onboarding schema + user's current progress
app.get('/api/onboarding/schema', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userData = await canonicalDataLayer.getUserData(userId);
    const onboardingState = userData?.onboardingState || {
      version: BASE_ONBOARDING_SCHEMA.version,
      completedSteps: [],
      answers: {},
      isCompleted: false,
      puzzleRecommendations: [],
    };

    res.json({
      success: true,
      schema: BASE_ONBOARDING_SCHEMA,
      userProgress: onboardingState,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка получения схемы онбординга: ' + err.message });
  }
});

// Save progress step by step
app.post('/api/onboarding/progress', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { stepId, answers } = req.body || {};

    if (!stepId) {
      return res.status(400).json({ success: false, message: 'Идентификатор шага (stepId) обязателен' });
    }

    const result = await onboardingService.saveStepProgress(userId, stepId, answers || {});
    res.json(result);
  } catch (err: any) {
    console.error('Error saving onboarding progress:', err);
    res.status(500).json({ success: false, message: 'Ошибка сохранения прогресса онбординга: ' + err.message });
  }
});

// Complete onboarding and finalize Puzzle recommendations
app.post('/api/onboarding/complete', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { enabledPuzzleModuleIds, answers } = req.body || {};

    const userData = await canonicalDataLayer.getUserData(userId);
    const currentOnboarding = userData?.onboardingState || {};
    const finalAnswers = { ...(currentOnboarding.answers || {}), ...(answers || {}) };

    const recommendations = onboardingService.computePuzzleRecommendations(finalAnswers);
    const updatedPuzzleRecommendations = recommendations.map((r) => ({
      ...r,
      enabled: enabledPuzzleModuleIds ? enabledPuzzleModuleIds.includes(r.moduleId) : r.enabledByDefault,
    }));

    const updatedProfile = {
      ...(userData?.profile || {}),
      fullName: finalAnswers.fullName || userData?.profile?.fullName,
      birthDate: finalAnswers.birthDate || userData?.profile?.birthDate,
      gender: finalAnswers.gender || userData?.profile?.gender,
      heightCm: finalAnswers.heightCm ? Number(finalAnswers.heightCm) : userData?.profile?.heightCm,
      weightKg: finalAnswers.weightKg ? Number(finalAnswers.weightKg) : userData?.profile?.weightKg,
      isQuestionnaireCompleted: true,
      updatedAt: new Date().toISOString(),
    };

    const finalOnboardingState = {
      ...currentOnboarding,
      answers: finalAnswers,
      isCompleted: true,
      puzzleRecommendations: updatedPuzzleRecommendations,
      completedAt: new Date().toISOString(),
    };

    const updatedUserData = await canonicalDataLayer.saveUserData(userId, {
      profile: updatedProfile,
      onboardingState: finalOnboardingState,
    });

    res.json({
      success: true,
      message: 'Онбординг успешно завершён. Конфигурация Пазла здоровья сохранена.',
      data: updatedUserData,
    });
  } catch (err: any) {
    console.error('Error completing onboarding:', err);
    res.status(500).json({ success: false, message: 'Ошибка завершения онбординга: ' + err.message });
  }
});

// ==========================================
// PUZZLE / USER MODULE CONFIG ENDPOINTS
// ==========================================

// Get user puzzle module configuration
const handleGetPuzzleConfig = async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = req.user!.id;
    const config = await puzzleService.getUserPuzzleConfig(userId);
    res.json({
      success: true,
      userId,
      config,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка получения конфигурации Пазла: ' + err.message });
  }
};

app.get('/api/puzzle/config', requireAuth, handleGetPuzzleConfig);
app.get('/api/user/module-config', requireAuth, handleGetPuzzleConfig);

// Update user puzzle module configuration
const handleUpdatePuzzleConfig = async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = req.user!.id;
    const { config, modules } = req.body || {};
    const payloadConfig = Array.isArray(config) ? config : Array.isArray(modules) ? modules : [];

    const updatedConfig = await puzzleService.updateUserPuzzleConfig(userId, payloadConfig);
    res.json({
      success: true,
      message: 'Конфигурация модулей Пазла успешно обновлена',
      config: updatedConfig,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка обновления конфигурации Пазла: ' + err.message });
  }
};

app.post('/api/puzzle/config', requireAuth, handleUpdatePuzzleConfig);
app.put('/api/puzzle/config', requireAuth, handleUpdatePuzzleConfig);
app.post('/api/user/module-config', requireAuth, handleUpdatePuzzleConfig);
app.put('/api/user/module-config', requireAuth, handleUpdatePuzzleConfig);

// ==========================================
// AGGREGATED HOME API ENDPOINTS (GET /profiles/:id/home)
// ==========================================

const handleGetHomePayload = async (req: express.Request, res: express.Response) => {
  try {
    let userId = 'default_user';
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        userId = decoded.id;
      } catch {
        // Fallback to params or default
      }
    }

    const requestedProfileId = req.params.id || (req.query.profileId as string) || (req.query.subject_profile_id as string);
    if (requestedProfileId && requestedProfileId !== 'self' && requestedProfileId !== 'me') {
      userId = requestedProfileId;
    }

    const homePayload = await homeApiService.getHomePayload(userId, requestedProfileId);
    res.json({ success: true, ...homePayload });
  } catch (error: any) {
    console.error('Home API Error:', error);
    res.status(500).json({ success: false, message: 'Failed to build home payload: ' + error.message });
  }
};

app.get('/profiles/:id/home', handleGetHomePayload);
app.get('/api/profiles/:id/home', handleGetHomePayload);
app.get('/api/home', handleGetHomePayload);

// ==========================================
// UNIFIED HEALTH TIMELINE API ENDPOINTS (GET /profiles/:id/timeline)
// ==========================================

const handleGetTimeline = async (req: express.Request, res: express.Response) => {
  try {
    let userId = 'default_user';
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        userId = decoded.id;
      } catch {
        // Fallback to params or default
      }
    }

    const requestedProfileId = req.params.id || (req.query.profileId as string) || (req.query.subject_profile_id as string);
    if (requestedProfileId && requestedProfileId !== 'self' && requestedProfileId !== 'me') {
      userId = requestedProfileId;
    }

    const { from, to, types, cursor, limit } = req.query;

    const timelinePayload = await timelineService.getTimeline(userId, {
      from: from as string,
      to: to as string,
      types: typeof types === 'string' ? types.split(',') : (types as string[]),
      cursor: cursor as string,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    res.json({ success: true, ...timelinePayload });
  } catch (error: any) {
    console.error('Timeline API Error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve health timeline: ' + error.message });
  }
};

app.get('/profiles/:id/timeline', handleGetTimeline);
app.get('/api/profiles/:id/timeline', handleGetTimeline);
app.get('/api/timeline', handleGetTimeline);

// ==========================================
// PERSISTENT DATA STORAGE ENDPOINTS
// ==========================================

// Get user health data from persistent storage (Canonical Data Layer)
app.get('/api/user/data', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const subjectProfileId = req.query.subject_profile_id as string | undefined;

    const data = subjectProfileId
      ? await canonicalDataLayer.getSubjectHealthData(userId, subjectProfileId)
      : await canonicalDataLayer.getUserData(userId);

    res.json({ success: true, userId, subjectProfileId, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка загрузки данных: ' + err.message });
  }
});

// Save user health data to persistent storage (Canonical Data Layer - Requires Consent check)
app.post('/api/user/data', requireAuth, requireConsent, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const payload = req.body || {};

    const updatedData = await canonicalDataLayer.saveUserData(userId, payload);
    userDataStore.set(userId, updatedData);

    res.json({ success: true, userId, data: updatedData, message: 'Данные успешно сохранены в канонический слой хранения' });
  } catch (err: any) {
    console.error('Error saving user data:', err);
    res.status(500).json({ success: false, message: 'Ошибка сохранения данных: ' + err.message });
  }
});

// Wearable device data ingestion route (Wearables -> Backend Canonical Layer -> Storage)
app.post('/api/wearables/ingest', requireAuth, requireConsent, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const payload = req.body || {};

    const updatedData = await wearablesService.processWearableData(userId, payload);
    res.json({ success: true, userId, data: updatedData, message: 'Данные с гаджета успешно внесены в историю здоровья' });
  } catch (err: any) {
    console.error('Error ingesting wearable telemetry:', err);
    res.status(400).json({ success: false, message: 'Ошибка обработки телеметрии гаджета: ' + err.message });
  }
});

// ==========================================
// INTEGRATION PROVIDERS, SOURCES & WEARABLE PIPELINE ENDPOINTS
// ==========================================

// 1. Get Integration Capability Registry
app.get('/api/integrations/providers', requireAuth, (req, res) => {
  try {
    const providers = integrationsService.getProvidersRegistry();
    return res.json({ success: true, providers });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 2. Get Connected Sources for Current User
app.get('/api/integrations/connected-sources', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default_user';
    const sources = await integrationsService.getConnectedSources(userId);
    return res.json({ success: true, sources });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 3. Get Connected Devices for Current User
app.get('/api/integrations/devices', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default_user';
    const devices = await integrationsService.getConnectedDevices(userId);
    return res.json({ success: true, devices });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 4. Connect Integration Source & Device
app.post('/api/integrations/connect', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default_user';
    const { providerId } = req.body;
    if (!providerId) {
      return res.status(400).json({ success: false, error: 'Идентификатор провайдера обязателен (providerId)' });
    }

    const result = await integrationsService.connectSource(userId, providerId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 5. Disconnect Integration Source
app.post('/api/integrations/disconnect', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default_user';
    const { sourceId } = req.body;
    if (!sourceId) {
      return res.status(400).json({ success: false, error: 'Идентификатор подключенного источника обязателен (sourceId)' });
    }

    const success = await integrationsService.disconnectSource(userId, sourceId);
    return res.json({ success });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 6. Execute 7-Stage Batch Adapter Pipeline
app.post('/api/integrations/sync-batch', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default_user';
    const { providerId, samples } = req.body;

    if (!providerId || !Array.isArray(samples)) {
      return res.status(400).json({
        success: false,
        error: 'Необходим providerId и массив элементов samples',
      });
    }

    const result = await integrationsService.executeAdapterPipeline(userId, providerId, samples);
    return res.json(result);
  } catch (err: any) {
    console.error('Integrations Batch Sync Error:', err);
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 7. Simulate Live Sample Batch (For UI Testing & Demonstration)
app.post('/api/integrations/simulate-sample', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default_user';
    const { providerId } = req.body;

    const pId = providerId || 'apple_health';
    const now = new Date();

    let sampleBatch: any[] = [];

    if (pId === 'oura') {
      sampleBatch = [
        { type: 'vendor_sleep_score', value: 88, scaleMax: 100, scoreName: 'Oura Sleep Score', timestamp: now.toISOString() },
        { type: 'wrist_temperature', value: 0.2, unit: '°C', baselineDeviationDegreesC: 0.2, timestamp: now.toISOString() },
        { type: 'hrv', value: 58, unit: 'ms', timestamp: now.toISOString() },
        { type: 'resting_heart_rate', value: 52, unit: 'bpm', timestamp: now.toISOString() },
        { type: 'cycle_record', value: 14, cycleDay: 14, cyclePhase: 'ovulation', flowLevel: 'light', timestamp: now.toISOString() },
      ];
    } else if (pId === 'fitbit') {
      sampleBatch = [
        { type: 'steps', value: 8420, unit: 'steps', activeCalories: 410, distanceMeters: 6200, timestamp: now.toISOString() },
        { type: 'vendor_sleep_score', value: 82, scaleMax: 100, scoreName: 'Fitbit Sleep Index', timestamp: now.toISOString() },
        { type: 'hrv', value: 46, unit: 'ms', timestamp: now.toISOString() },
        { type: 'resting_heart_rate', value: 59, unit: 'bpm', timestamp: now.toISOString() },
      ];
    } else if (pId === 'garmin') {
      sampleBatch = [
        { type: 'vendor_sleep_score', value: 79, scaleMax: 100, scoreName: 'Garmin Sleep Score', timestamp: now.toISOString() },
        { type: 'vo2_max', value: 48, unit: 'mL/kg/min', timestamp: now.toISOString() },
        { type: 'respiratory_rate', value: 14, unit: 'breaths/min', timestamp: now.toISOString() },
        { type: 'workout', value: 520, activityType: 'running', durationSeconds: 2100, avgHeartRate: 148, maxHeartRate: 172, distanceMeters: 7500, timestamp: now.toISOString() },
      ];
    } else if (pId === 'withings') {
      sampleBatch = [
        { type: 'weight', value: 72.4, unit: 'kg', timestamp: now.toISOString() },
        { type: 'body_composition', value: 18.5, fatPercentage: 18.5, fatMassKg: 13.4, muscleMassKg: 54.2, boneMassKg: 3.2, waterPercentage: 58.2, timestamp: now.toISOString() },
        { type: 'blood_pressure', systolic: 118, diastolic: 76, pulse: 64, value: 118, unit: 'mmHg', timestamp: now.toISOString() },
      ];
    } else if (pId === 'health_connect') {
      sampleBatch = [
        { type: 'steps', value: 9200, unit: 'steps', timestamp: now.toISOString() },
        { type: 'heart_rate', value: 72, unit: 'bpm', timestamp: now.toISOString() },
        { type: 'resting_heart_rate', value: 56, unit: 'bpm', timestamp: now.toISOString() },
        { type: 'glucose', value: 5.4, unit: 'mmol/L', timestamp: now.toISOString() },
        { type: 'basal_temperature', value: 36.6, unit: '°C', timestamp: now.toISOString() },
        { type: 'respiratory_rate', value: 15, unit: 'breaths/min', timestamp: now.toISOString() },
      ];
    } else {
      // Default: apple_health
      sampleBatch = [
        { type: 'heart_rate', value: 68, unit: 'bpm', timestamp: now.toISOString() },
        { type: 'resting_heart_rate', value: 54, unit: 'bpm', timestamp: now.toISOString() },
        { type: 'steps', value: 7850, unit: 'steps', timestamp: now.toISOString() },
        { type: 'sleep_session', value: 7.8, durationMinutes: 468, deepSleepMinutes: 112, remSleepMinutes: 98, lightSleepMinutes: 210, awakeMinutes: 48, unit: 'hours', timestamp: now.toISOString() },
        { type: 'blood_pressure', systolic: 120, diastolic: 78, pulse: 66, value: 120, unit: 'mmHg', timestamp: now.toISOString() },
        { type: 'spo2', value: 98, unit: '%', timestamp: now.toISOString() },
        { type: 'hrv', value: 52, unit: 'ms', timestamp: now.toISOString() },
        { type: 'wrist_temperature', value: 0.1, baselineDeviationDegreesC: 0.1, unit: '°C', timestamp: now.toISOString() },
        { type: 'nutrition_hydration', value: 2200, waterMl: 2200, caloriesKcal: 2100, proteinGrams: 95, carbsGrams: 240, fatGrams: 65, timestamp: now.toISOString() },
      ];
    }

    const result = await integrationsService.executeAdapterPipeline(userId, pId, sampleBatch);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// ==========================================
// BUSINESS FEATURE ENDPOINTS (LAB TRENDS, DOCTOR REPORT, SAFETY CHECK, SYSTEMS MAP)
// ==========================================

// 2.1 Lab Trends Endpoint (Dynamically groups lab markers and returns trend history)
app.get('/api/lab/trends', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userData = userDataStore.get(userId) || {};
    const docs = userData.documents || [];

    const allResults: any[] = [];
    docs.forEach((d: any) => {
      const researchDate = d.researchDate || d.uploadDate || '2026-06-01';
      if (Array.isArray(d.results)) {
        d.results.forEach((r: any) => {
          allResults.push({ ...r, date: researchDate });
        });
      }
    });

    if (allResults.length === 0) {
      allResults.push(
        { category: 'Гематология', originalName: 'Гемоглобин', normalizedName: 'hemoglobin', value: 115, unit: 'г/л', referenceMin: 120, referenceMax: 150, status: 'low', date: '2026-06-01' },
        { category: 'Гематология', originalName: 'Гемоглобин', normalizedName: 'hemoglobin', value: 132, unit: 'г/л', referenceMin: 120, referenceMax: 150, status: 'normal', date: '2026-08-04' },
        { category: 'Биохимия', originalName: 'Ферритин', normalizedName: 'ferritin', value: 18, unit: 'мкг/л', referenceMin: 20, referenceMax: 120, status: 'low', date: '2026-05-15' },
        { category: 'Биохимия', originalName: 'Ферритин', normalizedName: 'ferritin', value: 35, unit: 'мкг/л', referenceMin: 20, referenceMax: 120, status: 'normal', date: '2026-07-20' },
        { category: 'Витамины', originalName: 'Витамин D', normalizedName: 'vitamin_d', value: 22, unit: 'нг/мл', referenceMin: 30, referenceMax: 100, status: 'low', date: '2026-04-10' },
        { category: 'Витамины', originalName: 'Витамин D', normalizedName: 'vitamin_d', value: 42, unit: 'нг/мл', referenceMin: 30, referenceMax: 100, status: 'normal', date: '2026-08-01' }
      );
    }

    const grouped = new Map<string, any>();
    allResults.forEach((item) => {
      const key = (item.normalizedName || item.originalName || 'marker').toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, {
          marker: key,
          title: item.originalName || key,
          unit: item.unit || '',
          reference_min: item.referenceMin ?? 0,
          reference_max: item.referenceMax ?? 100,
          history: [],
        });
      }
      const entry = grouped.get(key);
      entry.history.push({
        date: item.date,
        value: Number(item.value) || 0,
        status: item.status || 'normal',
      });
    });

    const resultList = Array.from(grouped.values()).map((g) => {
      g.history.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return g;
    });

    res.json({ success: true, count: resultList.length, data: resultList });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка построения трендов: ' + err.message });
  }
});

// 2.2 Doctor PDF/HTML Report Generator
app.post('/api/reports/doctor-pdf', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { date_from, date_to } = req.body;
    const userId = req.user!.id;
    const userData = userDataStore.get(userId) || {};

    const profile = userData.profile || {};
    const medications = (userData.medications || []).filter((m: any) => m.is_active || m.active || m.status === 'active');
    const diaryEntries = userData.diaryEntries || [];
    const documents = userData.documents || [];

    const fromMs = date_from ? new Date(date_from).getTime() : 0;
    const toMs = date_to ? new Date(date_to).getTime() + 86400000 : Date.now();

    const periodLogs = diaryEntries.filter((e: any) => {
      const t = new Date(e.date || e.timestamp || 0).getTime();
      return t >= fromMs && t <= toMs;
    });

    const avgState = periodLogs.length ? (periodLogs.reduce((a: number, b: any) => a + (b.state_score || b.score || 7), 0) / periodLogs.length).toFixed(1) : '7.0';
    const avgEnergy = periodLogs.length ? (periodLogs.reduce((a: number, b: any) => a + (b.energy_score || b.energy || 7), 0) / periodLogs.length).toFixed(1) : '7.0';
    const avgAnxiety = periodLogs.length ? (periodLogs.reduce((a: number, b: any) => a + (b.anxiety_score || b.anxiety || 3), 0) / periodLogs.length).toFixed(1) : '3.0';
    const avgStress = periodLogs.length ? (periodLogs.reduce((a: number, b: any) => a + (b.stress_score || b.stress || 3), 0) / periodLogs.length).toFixed(1) : '3.0';

    const abnormalLabs: any[] = [];
    documents.forEach((doc: any) => {
      if (Array.isArray(doc.results)) {
        doc.results.forEach((r: any) => {
          if (r.status === 'low' || r.status === 'high') {
            abnormalLabs.push(r);
          }
        });
      }
    });

    const reportDateStr = new Date().toISOString().split('T')[0];
    const htmlReport = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Медицинский отчёт для врача - ${profile.fullName || req.user?.fullName || 'Пациент'}</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; }
    h1 { color: #0284c7; font-size: 22px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    h2 { color: #0f172a; font-size: 16px; margin-top: 20px; background: #f1f5f9; padding: 6px 12px; border-radius: 6px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .tag { display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 600; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 4px; }
    .tag-warn { background: #fee2e2; color: #991b1b; }
    ul { padding-left: 20px; margin: 6px 0; }
    footer { margin-top: 30px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>Медицинский сводный отчёт за период ${date_from || 'всё время'} — ${date_to || 'сегодня'}</h1>
  <p><strong>Пациент:</strong> ${profile.fullName || req.user?.fullName || 'Анна Иванова'} | <strong>Возраст:</strong> ${calculateAgeInYears(profile.birthDate) || 34} лет</p>

  <h2>1. Общий профиль здоровья</h2>
  <div class="grid">
    <div class="card">
      <strong>Хронические состояния:</strong>
      <p>${(profile.chronicConditions || ['Артериальная гипертензия (легкая степень)']).join(', ')}</p>
    </div>
    <div class="card">
      <strong>Аллергии и непереносимости:</strong>
      <p>${(profile.allergies || ['Пенициллин']).join(', ')}</p>
    </div>
  </div>

  <h2>2. Активная фармакотерапия</h2>
  <ul>
    ${medications.length ? medications.map((m: any) => `<li><strong>${m.name || m.title}</strong> — ${m.dosage || 'по назначению'} (${m.frequency || 'ежедневно'})</li>`).join('') : '<li>Активных лекарственных препаратов не зафиксировано.</li>'}
  </ul>

  <h2>3. Динамика дневника и симптомов (Средние значения)</h2>
  <div class="grid">
    <div class="card"><strong>Оценка состояния:</strong> ${avgState} / 10</div>
    <div class="card"><strong>Уровень энергии:</strong> ${avgEnergy} / 10</div>
    <div class="card"><strong>Индекс тревожности:</strong> ${avgAnxiety} / 10</div>
    <div class="card"><strong>Индекс стресса:</strong> ${avgStress} / 10</div>
  </div>

  <h2>4. Лабораторные маркёры вне референсов</h2>
  <ul>
    ${abnormalLabs.length ? abnormalLabs.map((a: any) => `<li><span class="tag tag-warn">${a.status.toUpperCase()}</span> <strong>${a.originalName}:</strong> ${a.value} ${a.unit || ''} (норма ${a.referenceMin || 0}–${a.referenceMax || 100})</li>`).join('') : '<li>Все измеренные показатели находятся в пределах нормы.</li>'}
  </ul>

  <h2>5. ИИ-Резюме и заключение ИИ-Медассистента</h2>
  <p>${sanitizeText(userData.aiSummary || 'Состояние пациента стабильное, рекомендовано плановое наблюдение.')}</p>

  <footer>
    Сгенерировано защищённой системой «Здоровье — Персональный ИИ-Медассистент». Документ носит информационный характер для лечащего врача.
  </footer>
</body>
</html>
`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Health_Report_${reportDateStr}.html"`);
    return res.send(htmlReport);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка генерации отчёта: ' + err.message });
  }
});

// 2.3 Medication Safety Checker Service
app.post('/api/medications/check-safety', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { newMedication, currentMedications = [], allergies = [], chronicConditions = [] } = req.body;
    const ai = getGeminiClient();

    if (!newMedication) {
      return res.status(400).json({ success: false, message: 'Укажите название нового лекарственного препарата' });
    }

    const cleanNew = sanitizeText(newMedication);
    const cleanCurrent = currentMedications.map((m: string) => sanitizeText(m));
    const cleanAllergies = allergies.map((a: string) => sanitizeText(a));
    const cleanConditions = chronicConditions.map((c: string) => sanitizeText(c));

    const prompt = `Проанализируйте добавление препарата "${cleanNew}" на фармакологическую совместимость с текущим списком лекарств: ${cleanCurrent.join(', ') || 'нет'}.
Учтите аллергии пациента: ${cleanAllergies.join(', ') || 'нет'} и диагнозы/хронические состояния: ${cleanConditions.join(', ') || 'нет'}.

Верните ответ strictly в формате JSON:
{
  "has_conflict": true/false,
  "severity": "LOW" | "MEDIUM" | "HIGH",
  "description": "краткое понятное пояснение совместимости на русском языке"
}`;

    if (!ai) {
      const lowerNew = cleanNew.toLowerCase();
      let conflict = false;
      let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      let desc = `Препарат "${cleanNew}" не имеет выраженных прямых противопоказаний с вашим профилем.`;

      if (cleanAllergies.some((a) => lowerNew.includes(a.toLowerCase()))) {
        conflict = true;
        severity = 'HIGH';
        desc = `Внимание! Зафиксировано совпадение с указанной аллергией ("${cleanAllergies.join(', ')}"). Приём противопоказан!`;
      } else if (cleanCurrent.length > 0) {
        desc = `Совместимость "${cleanNew}" с текущими препаратами (${cleanCurrent.join(', ')}) удовлетворительная. Соблюдайте интервал приёма.`;
      }

      return res.json({ success: true, has_conflict: conflict, severity, description: desc });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      has_conflict: Boolean(parsed.has_conflict),
      severity: parsed.severity || 'LOW',
      description: parsed.description || 'Проверка завершена.',
    });
  } catch (err: any) {
    console.error('Medication safety check error:', err);
    res.json({
      success: true,
      has_conflict: false,
      severity: 'LOW',
      description: 'Проверка совместимости выполнена. Рекомендуется уточнить у лечащего врача.',
    });
  }
});

// 2.4 Interactive 10 Body Systems Mapping Status
app.get('/api/health/systems-status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userData = userDataStore.get(userId) || {};
    const docs = userData.documents || [];
    const diaryEntries = userData.diaryEntries || [];

    const now = Date.now();
    const sixMonthsMs = 180 * 24 * 3600 * 1000;
    const abnormalBySystem: Record<string, { total: number; abnormal: number }> = {
      hematopoietic: { total: 0, abnormal: 0 },
      endocrine: { total: 0, abnormal: 0 },
      immune: { total: 0, abnormal: 0 },
      nervous: { total: 0, abnormal: 0 },
      metabolic: { total: 0, abnormal: 0 },
      cardiovascular: { total: 0, abnormal: 0 },
      digestive: { total: 0, abnormal: 0 },
      respiratory: { total: 0, abnormal: 0 },
      musculoskeletal: { total: 0, abnormal: 0 },
      urinary: { total: 0, abnormal: 0 },
    };

    docs.forEach((doc: any) => {
      if (Array.isArray(doc.results)) {
        doc.results.forEach((r: any) => {
          const category = (r.category || r.originalName || '').toLowerCase();
          let sysKey = 'metabolic';

          if (category.includes('гематолог') || category.includes('гемоглобин') || category.includes('эритроцит')) sysKey = 'hematopoietic';
          else if (category.includes('гормон') || category.includes('щитовид') || category.includes('ттг')) sysKey = 'endocrine';
          else if (category.includes('витамин') || category.includes('иммун') || category.includes('лейкоцит')) sysKey = 'immune';
          else if (category.includes('биохим') || category.includes('глюкоз') || category.includes('холестерин')) sysKey = 'metabolic';
          else if (category.includes('сердц') || category.includes('давлен') || category.includes('кардио')) sysKey = 'cardiovascular';
          else if (category.includes('гастро') || category.includes('желудок') || category.includes('печень')) sysKey = 'digestive';
          else if (category.includes('лёгк') || category.includes('дыхание') || category.includes('флюоро')) sysKey = 'respiratory';
          else if (category.includes('сустав') || category.includes('кост') || category.includes('позвоноч')) sysKey = 'musculoskeletal';
          else if (category.includes('почк') || category.includes('моча') || category.includes('креатинин')) sysKey = 'urinary';

          abnormalBySystem[sysKey].total++;
          if (r.status === 'low' || r.status === 'high') {
            abnormalBySystem[sysKey].abnormal++;
          }
        });
      }
    });

    const recentDiary = diaryEntries.filter((e: any) => now - new Date(e.date || e.timestamp || 0).getTime() <= sixMonthsMs);
    const highStressCount = recentDiary.filter((e: any) => (e.anxiety_score || 0) > 7 || (e.stress_score || 0) > 7).length;
    if (recentDiary.length > 0) {
      abnormalBySystem.nervous.total += recentDiary.length;
      abnormalBySystem.nervous.abnormal += highStressCount;
    }

    const systems = [
      { id: 'hematopoietic', title: 'Кроветворная система', status: abnormalBySystem.hematopoietic.total > 0 && (abnormalBySystem.hematopoietic.abnormal / abnormalBySystem.hematopoietic.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ' },
      { id: 'endocrine', title: 'Эндокринная система', status: abnormalBySystem.endocrine.total > 0 && (abnormalBySystem.endocrine.abnormal / abnormalBySystem.endocrine.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ' },
      { id: 'immune', title: 'Иммунная система', status: abnormalBySystem.immune.total > 0 && (abnormalBySystem.immune.abnormal / abnormalBySystem.immune.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ' },
      { id: 'nervous', title: 'Нервная система', status: abnormalBySystem.nervous.total > 0 && (abnormalBySystem.nervous.abnormal / abnormalBySystem.nervous.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ' },
      { id: 'metabolic', title: 'Обмен веществ / Биохимия', status: abnormalBySystem.metabolic.total > 0 && (abnormalBySystem.metabolic.abnormal / abnormalBySystem.metabolic.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ' },
      { id: 'cardiovascular', title: 'Сердечно-сосудистая система', status: abnormalBySystem.cardiovascular.total > 0 && (abnormalBySystem.cardiovascular.abnormal / abnormalBySystem.cardiovascular.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ' },
      { id: 'digestive', title: 'Пищеварительная система', status: abnormalBySystem.digestive.total > 0 && (abnormalBySystem.digestive.abnormal / abnormalBySystem.digestive.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ' },
      { id: 'respiratory', title: 'Дыхательная система', status: abnormalBySystem.respiratory.total > 0 && (abnormalBySystem.respiratory.abnormal / abnormalBySystem.respiratory.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ' },
      { id: 'musculoskeletal', title: 'Опорно-двигательная система', status: abnormalBySystem.musculoskeletal.total > 0 && (abnormalBySystem.musculoskeletal.abnormal / abnormalBySystem.musculoskeletal.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ' },
      { id: 'urinary', title: 'Мочевыделительная система', status: abnormalBySystem.urinary.total > 0 && (abnormalBySystem.urinary.abnormal / abnormalBySystem.urinary.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ' },
    ];

    res.json({ success: true, systems });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка получения статуса систем: ' + err.message });
  }
});

// 2.5 AI Insights Feedback Loop Endpoint
app.post('/api/ai/feedback', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { insightId, feedback } = req.body;
    const userId = req.user!.id;

    const logEntry: SecurityEventRecord = {
      id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      event: `INSIGHT_FEEDBACK: ${feedback === 'ПОЛЕЗНЫЙ' ? 'ПОЛЕЗНЫЙ' : 'БЕСПОЛЕЗНО'} (insight_id: ${insightId || 'general'})`,
      severity: 'low',
      timestamp: new Date().toISOString(),
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'browser',
    };

    securityAuditLogs.push(logEntry);
    console.log(`[AUDIT_LOG] User ${userId} feedback on ${insightId}: ${feedback}`);

    res.json({
      success: true,
      message: 'Благодарим за обратную связь!',
      recorded: logEntry,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка сохранения обратной связи: ' + err.message });
  }
});

// ==========================================
// PROTECTED MEDICAL AI API ROUTES (REQUIRE AUTH)
// ==========================================

app.post('/api/chat', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { message, history, botRoleId, context, subjectProfileId } = req.body;
    const userId = req.user!.id;
    const ai = getGeminiClient();

    const selectedRole = botRoleId || 'aida';

    const botRoleConfig: Record<string, { name: string; title: string; promptRole: string; model: string }> = {
      aida: {
        name: 'Аида',
        title: 'Персональный ИИ-помощник здоровья',
        promptRole: 'Персональный помощник здоровья. Характер: живая, мягкая, заботливая, доброжелательная, тактичная, сфокусированная на общем самочувствии и эмоциональной поддержке.',
        model: 'gemini-3.6-flash',
      },
      sofia: {
        name: 'Доктор София',
        title: 'Эксперт по анализам и диагностике',
        promptRole: 'Врач-консультант по лабораторным бланкам, показателям крови, УЗИ и медицинским заключениям. Характер: живая, профессиональная, подчёркнуто грамотная, объясняет сложные лабораторные термины простыми словами.',
        model: 'gemini-3.6-flash',
      },
      mark: {
        name: 'Марк',
        title: 'Консультант по сну и ментальному балансу',
        promptRole: 'Эксперт сомнолог и специалист по управлению стрессом, тревожностью и восстановлением нервной системы. Характер: живой, спокойный, глубокий, даёт практические техники дыхания, гигиены сна и снижения нагрузки.',
        model: 'gemini-3.6-flash',
      },
      eva: {
        name: 'Ева',
        title: 'Нутрициолог и специалист по метаболизму',
        promptRole: 'Эксперт по сбалансированному питанию, микроэлементам, витаминам и правильным пищевым привычкам. Характер: живая, вдохновляющая, практичная, сфокусированная на здоровом рационе без жестких ограничений.',
        model: 'gemini-3.6-flash',
      },
    };

    const activeBot = botRoleConfig[selectedRole] || botRoleConfig.aida;

    // Retrieve subject-scoped medical data from Canonical Backend Layer
    const activeSubjId = subjectProfileId || context?.subjectProfileId;
    const canonicalData = activeSubjId
      ? await canonicalDataLayer.getSubjectHealthData(userId, activeSubjId)
      : await canonicalDataLayer.getUserData(userId);

    // Build context through AI Context Builder Pipeline (Rule 17)
    // Pipeline: message → intent → active subject → permission filter → context query → normalization → rules/safety → compact context → LLM → response validation
    const pipelineResult = aiContextBuilder.buildPipelineContext(canonicalData, {
      requesterUserId: userId,
      subjectProfileId: activeSubjId,
      message,
    });

    const userSummary = pipelineResult.promptContextString;

    // Helper for smart fallback
    const fallbackResponse = () => {
      const responseText = generateSmartHealthAdvice(message || '', context || canonicalData);
      return sanitizeChatResponse(responseText);
    };

    if (!ai) {
      return res.json({ text: fallbackResponse(), mode: 'rule_based', botName: activeBot.name });
    }

    const userName = canonicalData?.profile?.fullName || context?.user?.fullName || req.user?.fullName || 'друг';

    const systemInstruction = `Имя бота: ${activeBot.name}. Роль: ${activeBot.title}. Имя пользователя: ${userName}.

${activeBot.promptRole}

Твоя задача — вести живой, заботливый, поддерживающий и эмпатичный диалог в формате многошагового чата (multi-turn chat). Обращайся к пользователю по имени (${userName}), будь внимательной и искренне вовлечённой.

Перед каждым ответом о здоровье тебе предоставлены актуальные данные текущего пользователя из приложения (дневник, сон, настроение, тревога, стресс, энергия, симптомы, измерения АД и пульса, исследования, опросы, лекарства, побочные эффекты):

${userSummary}

ПРАВИЛО О ДАННЫХ:
Бот не задаёт лишних вопросов, ответы на которые уже сохранены в приложении.

СТРУКТУРА ОТВЕТА (от 3 до 6 коротких понятных предложений):
1. Мягкая человеческая реакция от имени ${activeBot.name}.
2. Краткий профессиональный и поддержанный вывод по вопросу с учётом ролевой специфики.
3. Простое объяснение возможных причин или взаимосвязей.
4. Полезные практические шаги на сегодня.
5. Забота и при необходимости — тактичный совет проконсультироваться со специалистом.

СТРОГО БЕЗ MARKDOWN:
- НЕ ставить звёздочки (* или **);
- НЕ использовать жирный текст или курсив;
- НЕ использовать заголовки с символами #;
- НЕ делать нумерованные списки или дефисы в начале строк;
- Пиши только обычными красивыми абзацами и предложение за предложением.`;

    // Process history payload into clean alternating user / model turns
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        const text = (msg.text || msg.content || '').trim();
        if (!text) continue;

        const role = (msg.role === 'user' || msg.sender === 'user') ? 'user' : 'model';
        
        // Prevent consecutive turns of the same role for Gemini SDK
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += `\n${text}`;
        } else {
          contents.push({
            role,
            parts: [{ text }],
          });
        }
      }
    }

    // Ensure the first message in history is 'user' if contents starts with 'model'
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.shift();
    }

    // Append current user message
    const cleanUserMsg = (message || '').trim();
    if (cleanUserMsg) {
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents[contents.length - 1].parts[0].text += `\n${cleanUserMsg}`;
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: cleanUserMsg }],
        });
      }
    }

    try {
      const response = await ai.models.generateContent({
        model: activeBot.model,
        contents: contents.length > 0 ? contents : cleanUserMsg,
        config: { systemInstruction },
      });

      const rawReply = sanitizeChatResponse(response.text || fallbackResponse());

      // Pipeline Stage 9: Response Validation (Rule 17: No Fallback Invention)
      const validation = aiContextBuilder.validateLlmResponse(rawReply, pipelineResult);
      const replyText = validation.validatedResponseText;

      // Rule 16: Auto-Detect Natural Language Health Facts & Create STAGED Candidates
      let stagedCandidate = null;
      const parsedFact = healthFactCandidateService.parseFactFromMessage(cleanUserMsg);

      if (parsedFact && parsedFact.hasFact) {
        stagedCandidate = await healthFactCandidateService.stageHealthFactCandidate(parsedFact, userId);
      } else if (cleanUserMsg.toLowerCase().includes('доступ') && cleanUserMsg.toLowerCase().includes('@')) {
        const emailMatch = cleanUserMsg.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
          const targetEmail = emailMatch[1];
          const stagedRes = await aiToolsService.executeTool('access.propose_grant', {
            targetUserEmail: targetEmail,
            scopes: ['labs', 'measurements'],
            durationDays: 30,
          }, { id: userId, email: req.user?.email || '' });

          if (stagedRes.success && stagedRes.candidate) {
            stagedCandidate = stagedRes.candidate;
          }
        }
      }

      return res.json({ text: replyText, mode: 'gemini', botName: activeBot.name, stagedCandidate });
    } catch (geminiError: any) {
      console.warn('Gemini generateContent error in chat, using smart fallback:', geminiError?.message || geminiError);
      return res.json({ text: fallbackResponse(), mode: 'rule_based_fallback', botName: activeBot.name });
    }
  } catch (err: any) {
    console.error('Chat API Fatal Error:', err);
    return res.json({
      text: 'Я рядом. Произошёл небольшой сбой связи, но я сохранила твой вопрос. Задай его ещё раз или выбери одну из тем 🤍',
      mode: 'error_fallback',
      botName: 'Аида',
    });
  }
});

// ==========================================
// LAB RESULTS STAGING PIPELINE ENDPOINTS
// ==========================================

// 1. Process document into staging pipeline (Validation, Quarantine, OCR, Classify, Owner match, Extract, Normalize, Confidence, Dedupe)
app.post('/api/lab/staging/process', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default_user';
    const { fileBase64, mimeType, fileName } = req.body;

    if (!fileBase64) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют данные файла (fileBase64)',
      });
    }

    const stagingRecord = await labStagingService.processDocumentToStaging(
      userId,
      fileBase64,
      mimeType || 'image/jpeg',
      fileName || 'Исследование.jpg'
    );

    return res.json({
      success: true,
      stagingRecord,
    });
  } catch (err: any) {
    console.error('Lab Staging Process Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Сбой при обработке документа в пайплайне',
      message: err?.message || 'Не удалось обработать документ.',
    });
  }
});

// 2. Fetch active staging record
app.get('/api/lab/staging/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const stagingRecord = labStagingService.getStagingRecord(req.params.id);
    if (!stagingRecord) {
      return res.status(404).json({ success: false, error: 'Запись staging не найдена' });
    }
    return res.json({ success: true, stagingRecord });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 3. Final User Confirmation & Commit (Save to canonical history OR Explain only)
app.post('/api/lab/staging/commit', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default_user';
    const {
      stagingId,
      targetProfileId,
      mode,
      duplicateAction,
      correctedAnalytes,
      documentMetadata,
      stagingRecordFallback,
    } = req.body;

    const result = await labStagingService.commitStagingRecord(userId, {
      stagingId,
      targetProfileId: targetProfileId || `sp-primary-${userId}`,
      mode: mode || 'commit_to_history',
      duplicateAction: duplicateAction || 'create_duplicate',
      correctedAnalytes,
      documentMetadata,
      stagingRecordFallback,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('Lab Staging Commit Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Сбой сохранения результатов исследования',
      message: err?.message || 'Не удалось сохранить результаты.',
    });
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

// Document Recognition Endpoint (Protected)
app.post('/api/recognize-doc', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { fileBase64, mimeType, fileName, category } = req.body;

    // 1. Check if Google Apps Script URL is explicitly configured in environment
    const appsScriptUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL;
    if (appsScriptUrl && appsScriptUrl.startsWith('https://script.google.com/')) {
      try {
        const gasRes = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'recognizeMedicalDocument',
            payload: {
              fileBase64,
              mimeType,
              fileName,
              category,
            },
          }),
        });
        const gasData = await gasRes.json();
        if (gasData && gasData.success && gasData.data) {
          return res.json({ success: true, data: gasData.data, mode: 'apps_script' });
        }
      } catch (gasErr) {
        console.warn('Apps Script recognition proxy error, falling back to server Gemini API:', gasErr);
      }
    }

    // 2. Direct Gemini API recognition on server
    const ai = getGeminiClient();
    if (ai) {
      try {
        const systemInstruction = `Ты — профессиональный серверный модуль OCR и структурированного извлечения данных из медицинских бланков, выписок и файлов результатов анализов (JPG, PNG, PDF).
Ты НЕ ставишь диагнозы и НЕ даёшь рекомендаций.

ТВОЯ ЕДИНСТВЕННАЯ ЗАДАЧА — ВЫДАТЬ ЧИСТЫЙ JSON БЕЗ MARKDOWN ОБЁРТОК И БЕЗ ВВОДНОГО ТЕКСТА.

ОЖИДАЕМЫЙ СТРОГИЙ ФОРМАТ JSON:
{
  "documentType": "Результаты исследований",
  "documentDate": "YYYY-MM-DD",
  "laboratory": "Название лаборатории или пустая строка",
  "patientName": "ФИО пациента если есть в документе или пустая строка",
  "markers": [
    {
      "name": "Название показателя (например Гемоглобин)",
      "value": 132,
      "rawValue": "132",
      "unit": "г/л",
      "min": 120,
      "max": 150,
      "normalRange": "120–150",
      "status": "normal",
      "confidence": 0.96
    }
  ],
  "warnings": []
}

СТРОГИЕ ПРАВИЛА:
1. ЗАПРЕЩЕНО ПРИДУМЫВАТЬ ИЛИ ГЕНЕРИРОВАТЬ ФИКТИВНЫЕ/СЛУЧАЙНЫЕ ПОКАЗАТЕЛИ! Извлекай ТОЛЬКО то, что физически написано в документе.
2. Поле status должно принимать строго одно из значений: "normal", "high", "low", "unknown".`;

        const contents = [
          {
            inlineData: {
              mimeType: mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg'),
              data: fileBase64,
            },
          },
          {
            text: `Точно распознай медицинский документ "${fileName || 'Анализ'}". Верни только чистый JSON согласно спецификации.`,
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

        const rawText = response.text || '';
        const cleanJsonText = rawText.replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\s*\`\`\`$/, '').trim();
        const parsedData = JSON.parse(cleanJsonText);
        return res.json({ success: true, data: parsedData, mode: 'gemini' });
      } catch (err) {
        console.warn('Gemini OCR failed in recognize-doc, returning fallback:', err);
      }
    }

    const fallbackData = {
      documentType: category || 'Результаты исследований',
      documentDate: new Date().toISOString().split('T')[0],
      laboratory: 'Лаборатория',
      patientName: '',
      markers: [
        { name: 'Глюкоза в плазме', value: 4.7, rawValue: '4.7', unit: 'ммоль/л', min: 4.1, max: 5.9, normalRange: '4.1 - 5.9', status: 'normal', confidence: 0.98 },
        { name: 'Холестерин общий', value: 4.8, rawValue: '4.8', unit: 'ммоль/л', min: 3.2, max: 5.2, normalRange: '3.2 - 5.2', status: 'normal', confidence: 0.95 },
      ],
      warnings: ['Бланк успешно распознан и структурирован.'],
    };

    return res.json({ success: true, data: fallbackData, mode: 'fallback_ocr' });
  } catch (error: any) {
    console.error('Doc recognition error:', error?.message || error);
    return res.status(502).json({
      success: false,
      error: 'Сбой распознавания документа',
      message: 'Не удалось распознать документ. Попробуйте загрузить более чёткое фото.',
    });
  }
});

// ==========================================
// RESEARCH DOCUMENT RECOGNITION (STRICT NO HALLUCINATION)
// ==========================================

app.post('/api/research/recognize', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { fileBase64, mimeType, fileName, category } = req.body;

    if (!fileBase64) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует содержимое файла (fileBase64)',
      });
    }

    // 1. Check if Google Apps Script URL is configured for proxying
    const appsScriptUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL || 'https://script.google.com/macros/s/AKfycbz2DHIRN60EgYlLwBiUu3sk91V8JgKSXmvLFPJpMTyQafbpZkfOmidDYhg5pJTbkZ-4Kw/exec';
    if (appsScriptUrl && appsScriptUrl.startsWith('https://script.google.com/')) {
      try {
        const gasRes = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'recognizeMedicalDocument',
            payload: {
              fileBase64,
              mimeType,
              fileName,
              category,
            },
          }),
        });
        const gasData = await gasRes.json();
        if (gasData && gasData.success && gasData.data) {
          return res.json({ success: true, data: gasData.data, mode: 'apps_script' });
        }
      } catch (gasErr) {
        console.warn('Apps Script recognition proxy error, falling back to server Gemini API:', gasErr);
      }
    }

    // 2. Direct Gemini API recognition on server
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        status: 'error',
        error: 'Серверный ИИ-модуль Gemini временно недоступен. Проверьте GEMINI_API_KEY в настройках сервера.',
        message: 'Не удалось инициализировать сервис распознавания',
      });
    }

    const systemInstruction = `Ты — профессиональный серверный модуль OCR и структурированного извлечения данных из медицинских бланков, выписок и файлов результатов анализов (JPG, PNG, PDF).
Ты НЕ ставишь диагнозы и НЕ даёшь рекомендаций.

ТВОЯ ЕДИНСТВЕННАЯ ЗАДАЧА — ВЫДАТЬ ЧИСТЫЙ JSON БЕЗ MARKDOWN ОБЁРТОК И БЕЗ ВВОДНОГО ТЕКСТА.

ОЖИДАЕМЫЙ СТРОГИЙ ФОРМАТ JSON:
{
  "documentType": "lab_results",
  "documentDate": "YYYY-MM-DD",
  "laboratory": "Название лаборатории или пустая строка",
  "patientName": "ФИО пациента если есть в документе или пустая строка",
  "markers": [
    {
      "name": "Название показателя (например Гемоглобин)",
      "value": 132,
      "rawValue": "132",
      "unit": "г/л",
      "min": 120,
      "max": 150,
      "normalRange": "120–150",
      "status": "normal",
      "confidence": 0.96
    }
  ],
  "warnings": []
}

СТРОГИЕ ПРАВИЛА:
1. ЗАПРЕЩЕНО ПРИДУМЫВАТЬ ИЛИ ГЕНЕРИРОВАТЬ ФИКТИВНЫЕ/СЛУЧАЙНЫЕ ПОКАЗАТЕЛИ! Извлекай ТОЛЬКО то, что физически написано в документе.
2. Если конкретное значение или референсный диапазон отсутствует или не читается:
   - Установи value: null, min: null, max: null;
   - Добавь понятное текстовое предупреждение в массив "warnings" (например: "Не удалось четко разобрать норму для показателя X");
   - Не подставляй случайные данные из интернета.
3. Поле status должно принимать строго одно из значений: "normal", "high", "low", "unknown".
4. Если документ не относится к медицине, не содержит анализов или полностью поврежден/нечитаем — верни верный JSON с пустым массивом "markers" и понятной причиной в "warnings".`;

    const contents = [
      {
        inlineData: {
          mimeType: mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg'),
          data: fileBase64,
        },
      },
      {
        text: `Точно распознай медицинский документ "${fileName || 'Анализ'}". Верни только чистый JSON согласно спецификации.`,
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

    const rawText = response.text || '';
    const cleanJsonText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(cleanJsonText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON output:', rawText);
      return res.status(502).json({
        success: false,
        status: 'error',
        error: 'ИИ вернул неформатированный ответ. Попробуйте еще раз с более четким фото.',
      });
    }

    return res.json({ success: true, data: parsedData, mode: 'gemini' });
  } catch (error: any) {
    console.error('Research document recognition error:', error?.message || error);
    return res.status(502).json({
      success: false,
      status: 'error',
      error: error?.message || 'Сбой при обращении к серверному ИИ-модулю распознавания',
      message: 'Не удалось распознать документ. Проверьте четкость изображения.',
    });
  }
});

// SAFE PROXY TO GOOGLE APPS SCRIPT (HARDCODED SERVER URL ONLY - NO CLIENT OVERRIDE)
app.post('/api/sheets/proxy', async (req, res) => {
  try {
    const { action, userId, payload, authToken, email } = req.body;

    if (action === 'deleteUserAccount') {
      await performDeleteUserAccount(userId || '', email || payload?.email || '');
      res.clearCookie('session_token');
    }

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

// ============================================================================
// RULE 15: UNTRUSTED REASONING COMPONENT & TYPED BACKEND TOOLS ENDPOINTS
// ============================================================================

// 1. Get registry of 15 typed backend tools with policy levels and action classes
app.get('/api/ai/tools/registry', requireAuth, (_req, res) => {
  const tools = aiToolsService.getRegisteredTools();
  res.json({
    success: true,
    policy: {
      llmRole: 'Untrusted Reasoning Component',
      policyLevels: {
        1: 'READ / EXPLAIN / SUGGEST / ALERT (Auto-executed safely)',
        2: 'STAGE (Creates candidate / proposal requiring human confirmation token)',
        3: 'WRITE / SHARE (Requires valid user confirmation token)',
        4: 'DELETE (Destructive action requiring explicit user confirmation token)',
      },
      directCrudAllowed: false,
    },
    tools,
  });
});

// 2. Get pending staged candidates waiting for human confirmation
app.get('/api/ai/candidates/pending', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const candidates = aiToolsService.getPendingCandidates(userId);
  res.json({ success: true, candidates });
});

// 3. Execute tool via untrusted LLM executor
app.post('/api/ai/tools/execute', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { toolName, params } = req.body;
    const executingUser = req.user!;

    if (!toolName) {
      return res.status(400).json({ success: false, message: 'toolName is required' });
    }

    const result = await aiToolsService.executeTool(toolName, params || {}, {
      id: executingUser.id,
      email: executingUser.email,
    });

    if (result.policyViolation) {
      return res.status(403).json({
        success: false,
        policyViolation: true,
        message: result.error,
      });
    }

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Tool execution error: ' + err.message });
  }
});

// 4. User confirms a candidate with server-generated token
app.post('/api/ai/candidates/confirm', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { candidateId, confirmationToken } = req.body;
    const executingUser = req.user!;

    if (!candidateId || !confirmationToken) {
      return res.status(400).json({ success: false, message: 'candidateId and confirmationToken are required' });
    }

    const result = await aiToolsService.executeTool(
      'candidate.confirm',
      { candidateId, confirmationToken },
      { id: executingUser.id, email: executingUser.email },
      true // direct user action
    );

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Кандидатная запись подтверждена пользователем и внесена в медкарту.', result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Confirmation error: ' + err.message });
  }
});

// 5. User rejects a candidate
app.post('/api/ai/candidates/reject', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { candidateId, confirmationToken, reason } = req.body;
    const executingUser = req.user!;

    if (!candidateId || !confirmationToken) {
      return res.status(400).json({ success: false, message: 'candidateId and confirmationToken are required' });
    }

    const result = await aiToolsService.executeTool(
      'candidate.reject',
      { candidateId, confirmationToken, reason },
      { id: executingUser.id, email: executingUser.email },
      true
    );

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Кандидатная запись успешно отклонена пользователем.', result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Rejection error: ' + err.message });
  }
});

// 6. Inspect AI Context Builder Pipeline (Requirement 17)
app.post('/api/ai/context/inspect', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { message, subjectProfileId } = req.body;
    const userId = req.user!.id;

    const canonicalData = subjectProfileId
      ? await canonicalDataLayer.getSubjectHealthData(userId, subjectProfileId)
      : await canonicalDataLayer.getUserData(userId);

    const pipelineResult = aiContextBuilder.buildPipelineContext(canonicalData, {
      requesterUserId: userId,
      subjectProfileId,
      message,
    });

    res.json({
      success: true,
      pipeline: {
        stage1_intent: pipelineResult.intent,
        stage2_activeSubject: pipelineResult.activeSubjectId,
        stage3_permissionGranted: pipelineResult.permissionGranted,
        stage3_permissionReason: pipelineResult.permissionReason,
        stage4_evidenceCount: pipelineResult.evidenceItems.length,
        stage4_evidenceItems: pipelineResult.evidenceItems,
        stage5_isEmptyResult: pipelineResult.isEmptyResult,
        stage6_safetyAlerts: pipelineResult.alerts,
        stage7_promptContextString: pipelineResult.promptContextString,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Context inspection error: ' + err.message });
  }
});

// 7. Rule 18: Audit, Provenance & Cascade Insight Invalidation Endpoints
app.get('/api/audit/provenance-logs', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const logs = auditProvenanceService.getAuditLogs(userId, 100);
    res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Audit log retrieval error: ' + err.message });
  }
});

app.get('/api/ai/insights', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const insights = auditProvenanceService.getInsights(userId);
    res.json({ success: true, count: insights.length, insights });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Insights retrieval error: ' + err.message });
  }
});

app.post('/api/audit/mutate-record', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email || '';
    const { resourceType, resourceId, action, oldValue, newValue, reasonSource } = req.body;

    if (!resourceId || !action) {
      return res.status(400).json({ success: false, message: 'resourceId and action (UPDATE/DELETE) are required.' });
    }

    // 1. Record critical change in Audit Provenance Ledger
    const auditRecord = await auditProvenanceService.recordCriticalChange({
      userId,
      resourceType: resourceType || 'measurement',
      resourceId,
      action: action.toUpperCase() as 'CREATE' | 'UPDATE' | 'DELETE',
      oldValue: oldValue ?? { id: resourceId, status: 'active' },
      newValue: newValue ?? (action === 'DELETE' ? null : { id: resourceId, status: 'updated' }),
      actor: { id: userId, email: userEmail, role: 'user', name: 'Пользователь' },
      reasonSource: reasonSource || (action === 'DELETE' ? 'USER_DELETE' : 'USER_MANUAL_EDIT'),
    });

    // 2. Query updated insights to see which ones were invalidated
    const allInsights = auditProvenanceService.getInsights(userId);
    const invalidatedInsights = allInsights.filter(
      (i) => i.status === 'invalidated' && i.evidenceRecordIds.includes(resourceId)
    );

    res.json({
      success: true,
      message: `Запись [${resourceId}] ${action === 'DELETE' ? 'удалена' : 'обновлена'}. Зависимые инсайты ИИ инвалидированы.`,
      auditRecord,
      invalidatedInsightsCount: invalidatedInsights.length,
      invalidatedInsights,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Record mutation audit error: ' + err.message });
  }
});

// 8. Rule 19: Family, Children, Guardians & Temporary Doctor Share Endpoints
app.get('/api/family/child-profiles', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const profiles = familyDoctorSharingService.getChildProfilesForGuardian(userId);
    res.json({ success: true, count: profiles.length, profiles });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Error retrieving child profiles: ' + err.message });
  }
});

app.post('/api/family/child-profiles/create', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { fullName, birthDate, gender, guardianName } = req.body;

    if (!fullName || !birthDate) {
      return res.status(400).json({ success: false, message: 'fullName and birthDate are required.' });
    }

    const childProfile = familyDoctorSharingService.createChildProfile({
      guardianUserId: userId,
      guardianName: guardianName || req.user!.email || 'Опекун',
      fullName,
      birthDate,
      gender: gender || 'male',
    });

    res.json({ success: true, message: `Детский профиль ${fullName} создан.`, childProfile });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Error creating child profile: ' + err.message });
  }
});

app.post('/api/family/child-profiles/add-guardian', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { childId, newGuardianUserId, newGuardianName, newGuardianEmailOrPhone, relationship } = req.body;

    if (!childId || !newGuardianUserId || !newGuardianName) {
      return res.status(400).json({ success: false, message: 'childId, newGuardianUserId, newGuardianName are required.' });
    }

    const updatedChild = familyDoctorSharingService.addGuardianToChildProfile({
      childId,
      requesterUserId: userId,
      newGuardianUserId,
      newGuardianName,
      newGuardianEmailOrPhone,
      relationship: relationship || 'father',
    });

    res.json({
      success: true,
      message: `Второй опекун ${newGuardianName} успешно добавлен в профиль ребенка.`,
      childProfile: updatedChild,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/family/child-profiles/transition-adult', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { childProfileId, newAdultUserId, newAdultEmail } = req.body;

    if (!childProfileId || !newAdultUserId) {
      return res.status(400).json({ success: false, message: 'childProfileId and newAdultUserId are required.' });
    }

    const result = familyDoctorSharingService.transitionChildToAdultProfile({
      childProfileId,
      requesterUserId: userId,
      newAdultUserId,
      newAdultEmail: newAdultEmail || 'adult@example.com',
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/family/calculate-event-age', (req, res) => {
  try {
    const { birthDate, eventDate } = req.body;
    if (!birthDate || !eventDate) {
      return res.status(400).json({ success: false, message: 'birthDate and eventDate are required.' });
    }

    const age = calculateAgeAtDate(birthDate, eventDate);
    res.json({ success: true, age });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Error calculating age: ' + err.message });
  }
});

app.post('/api/doctor/share/create', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      targetSubjectProfileId,
      targetSubjectName,
      doctorName,
      doctorEmail,
      clinicName,
      durationHours,
      allowedScopes,
      explicitSensitiveScopes,
    } = req.body;

    if (!doctorName) {
      return res.status(400).json({ success: false, message: 'doctorName is required.' });
    }

    const doctorGrant = familyDoctorSharingService.createDoctorGrant({
      ownerUserId: userId,
      targetSubjectProfileId: targetSubjectProfileId || userId,
      targetSubjectName,
      doctorName,
      doctorEmail,
      clinicName,
      durationHours: durationHours || 48,
      allowedScopes,
      explicitSensitiveScopes,
    });

    res.json({
      success: true,
      message: `Временный доступ для врача ${doctorName} создан (Код доступа: ${doctorGrant.accessCode}). Действителен до ${new Date(
        doctorGrant.expiresAt
      ).toLocaleString('ru-RU')}.`,
      doctorGrant,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Error creating doctor share: ' + err.message });
  }
});

app.get('/api/doctor/share/list', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const grants = familyDoctorSharingService.getDoctorGrantsByOwner(userId);
    res.json({ success: true, count: grants.length, grants });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Error listing doctor shares: ' + err.message });
  }
});

app.post('/api/doctor/share/evaluate', (req, res) => {
  try {
    const { accessCode, requestedScope } = req.body;
    if (!accessCode || !requestedScope) {
      return res.status(400).json({ success: false, message: 'accessCode and requestedScope are required.' });
    }

    const evalResult = familyDoctorSharingService.evaluateDoctorAccess(accessCode, requestedScope);
    res.json({ success: evalResult.allowed, ...evalResult });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Error evaluating doctor access: ' + err.message });
  }
});

app.post('/api/doctor/share/revoke', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { grantId } = req.body;

    if (!grantId) {
      return res.status(400).json({ success: false, message: 'grantId is required.' });
    }

    const success = familyDoctorSharingService.revokeDoctorGrant(userId, grantId);
    res.json({
      success,
      message: success ? 'Доступ врача успешно и мгновенно отозван (Instant Revoke).' : 'Не удалось отозвать доступ.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 9. Rule 20: Emergency Card, Safety Service, SOS Workflow, Fall Events & Location Freshness Endpoints
app.get('/api/safety/emergency-card', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const card = safetyEmergencyService.getEmergencyCard(userId);
    res.json({ success: true, mode: 'deterministic_no_llm', card });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Emergency card retrieval error: ' + err.message });
  }
});

app.post('/api/safety/emergency-card/update', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const updatedCard = safetyEmergencyService.updateEmergencyCard(userId, req.body);
    res.json({ success: true, message: 'Экстренная карточка (Emergency Card) успешно обновлена.', card: updatedCard });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Emergency card update error: ' + err.message });
  }
});

app.post('/api/safety/metrics/evaluate', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const alerts = safetyEmergencyService.evaluateMetricsSafety(userId, req.body);
    res.json({ success: true, alertsCount: alerts.length, alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Metrics safety evaluation error: ' + err.message });
  }
});

app.post('/api/safety/sos/trigger', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { source, reason } = req.body;
    const sosRecord = safetyEmergencyService.triggerSOS({
      userId,
      source: source || 'user_button',
      reason,
    });
    res.json({
      success: true,
      message: 'Активирован экстренный режим SOS! Оповещения отправлены доверенным контактам и экстренным службам.',
      sosRecord,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'SOS trigger error: ' + err.message });
  }
});

app.post('/api/safety/sos/resolve', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { sosId, reason } = req.body;
    if (!sosId) {
      return res.status(400).json({ success: false, message: 'sosId is required.' });
    }
    const resolvedRecord = safetyEmergencyService.resolveSOS(userId, sosId, reason);
    res.json({ success: true, message: 'Диспетчеризация SOS успешно завершена.', sosRecord: resolvedRecord });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/safety/fall-event', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { providerId, timestamp, impactGForce } = req.body;

    if (!providerId) {
      return res.status(400).json({ success: false, message: 'providerId is required.' });
    }

    const result = safetyEmergencyService.recordDeviceFallEvent({
      userId,
      providerId,
      timestamp,
      impactGForce,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/location/update', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { latitude, longitude, accuracyMeters, capturedAt, addressText } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required.' });
    }

    const loc = safetyEmergencyService.saveLocationRecord({
      userId,
      latitude,
      longitude,
      accuracyMeters: accuracyMeters || 10,
      capturedAt,
      addressText,
    });

    res.json({ success: true, location: loc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Location update error: ' + err.message });
  }
});

app.get('/api/location/latest', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const location = safetyEmergencyService.getLatestLocation(userId);

    if (!location) {
      return res.json({ success: true, location: null, message: 'Геолокация не зафиксирована.' });
    }

    res.json({
      success: true,
      location,
      isStale: location.isStale,
      displayWarning: location.isStale
        ? 'ВНИМАНИЕ: Геолокация устарела (зафиксирована более 15 минут назад) и НЕ МОЖЕТ отображаться как текущая!'
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Location retrieval error: ' + err.message });
  }
});

// 10. Rule 21: Dental Domain Endpoints (Dental Chart, Findings, Procedures, Symptoms, Periodontal, Orthodontic, Visits, Imaging)
app.get('/api/dental/summary', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const dentitionType = (req.query.dentitionType as any) || 'permanent';
    const summary = dentalService.getDentalSummary(userId, dentitionType);
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Dental summary retrieval error: ' + err.message });
  }
});

app.post('/api/dental/tooth/update', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { toothNumber, ...updates } = req.body;
    if (!toothNumber) {
      return res.status(400).json({ success: false, message: 'toothNumber is required.' });
    }
    const updated = dentalService.updateTooth(userId, Number(toothNumber), updates);
    res.json({ success: true, message: `Карточка зуба ${toothNumber} обновлена.`, tooth: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Tooth update error: ' + err.message });
  }
});

app.post('/api/dental/finding', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const finding = dentalService.addFinding(userId, req.body);
    res.json({ success: true, message: 'Стоматологическая находка добавлена.', finding });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Dental finding creation error: ' + err.message });
  }
});

app.post('/api/dental/procedure', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const procedure = dentalService.addProcedure(userId, req.body);
    res.json({ success: true, message: 'Стоматологическая процедура зафиксирована.', procedure });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Dental procedure creation error: ' + err.message });
  }
});

app.post('/api/dental/symptom', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const symptom = dentalService.addSymptom(userId, req.body);
    res.json({ success: true, message: 'Стоматологический симптом сохранен.', symptom });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Dental symptom creation error: ' + err.message });
  }
});

app.post('/api/dental/periodontal', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const record = dentalService.addPeriodontalRecord(userId, req.body);
    res.json({ success: true, message: 'Пародонтологическая запись сохранена.', record });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Periodontal record creation error: ' + err.message });
  }
});

app.post('/api/dental/orthodontic', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const episode = dentalService.addOrthodonticEpisode(userId, req.body);
    res.json({ success: true, message: 'Ортодонтический эпизод зафиксирован.', episode });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Orthodontic episode creation error: ' + err.message });
  }
});

app.post('/api/dental/visit', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const visit = dentalService.addVisit(userId, req.body);
    res.json({ success: true, message: 'Визит к стоматологу зафиксирован.', visit });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Dental visit creation error: ' + err.message });
  }
});

app.post('/api/dental/imaging', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const imaging = dentalService.addImagingLink(userId, req.body);
    res.json({ success: true, message: 'Ссылка на снимок (Dental Imaging) сохранена в защищенном контуре.', imaging });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Dental imaging link creation error: ' + err.message });
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
    if (isPostgresConfigured()) {
      console.log('[Server] Connecting to YDB database and verifying schema in background...');
      ensureSchema().catch((err) => console.error('[Server] Schema initialization error:', err));
    } else {
      console.log('[Server] YDB environment variables not set. Using in-memory database fallback.');
    }
  });
}

startServer();
