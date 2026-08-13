import fs from 'node:fs';

const file = 'server.ts';
let source = fs.readFileSync(file, 'utf8');
const original = source;

function replaceOrFail(label, search, replacement) {
  const next = source.replace(search, replacement);
  if (next === source) {
    throw new Error(`Hardening step did not match: ${label}`);
  }
  source = next;
  console.log(`patched: ${label}`);
}

replaceOrFail(
  'JWT secret must be configured',
  "const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'helt_aida_secure_session_secret_2026';",
  "const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET;\nif (!JWT_SECRET) {\n  throw new Error('SESSION_SECRET or JWT_SECRET must be configured');\n}"
);

replaceOrFail(
  'remove seeded demo account',
  /\/\/ Store default demo user account[\s\S]*?createdAt: new Date\(\)\.toISOString\(\),\n\}\);\n\n/,
  "// Production starts without seeded/demo identities. Test fixtures belong in tests only.\n"
);

replaceOrFail(
  'deny unauthenticated requests instead of guest fallback',
  /function requireAuth\(req: AuthenticatedRequest, res: express\.Response, next: express\.NextFunction\) \{[\s\S]*?\n\}\n\n\/\/ ==========================================\n\/\/ AUTHENTICATION API ROUTES/,
  `function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Необходима авторизация.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; fullName?: string; sessionId?: string };
    if (!decoded?.id || !decoded?.email) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Недействительный сеанс.' });
    }
    if (decoded.sessionId && !authService.isSessionActive(decoded.sessionId, decoded.id)) {
      return res.status(401).json({ success: false, error: 'SESSION_REVOKED', message: 'Сеанс завершён или отозван.' });
    }
    if (decoded.sessionId) authService.touchSession(decoded.sessionId);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Недействительный или истёкший сеанс.' });
  }
}

// ==========================================
// AUTHENTICATION API ROUTES`
);

replaceOrFail(
  'consent must be explicit',
  "  const consentPersonal = profile.consentPersonalData ?? profile.consentPersonal ?? true;\n  const consentMedical = profile.consentMedicalData ?? profile.consentMedical ?? true;",
  "  const consentPersonal = profile.consentPersonalData ?? profile.consentPersonal ?? false;\n  const consentMedical = profile.consentMedicalData ?? profile.consentMedical ?? false;"
);

replaceOrFail(
  'protect v1 router with real auth',
  "app.use('/api/v1', v1ApiRouter);",
  "app.use('/api/v1', requireAuth, v1ApiRouter);"
);

replaceOrFail(
  'minimum password length',
  "    if (!password || password.length < 4) {\n      return res.status(400).json({ success: false, message: 'Пароль должен содержать не менее 4 символов' });\n    }",
  "    if (!password || password.length < 8) {\n      return res.status(400).json({ success: false, message: 'Пароль должен содержать не менее 8 символов' });\n    }"
);

replaceOrFail(
  'crypto OTP generator on registration',
  "    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();",
  "    const rawCode = crypto.randomInt(100000, 1000000).toString();"
);

replaceOrFail(
  'registration requires verification',
  "      isVerified: true,",
  "      isVerified: false,"
);

replaceOrFail(
  'database registration requires verification',
  "        isVerified: true,",
  "        isVerified: false,"
);

replaceOrFail(
  'do not create authenticated session before verification',
  /\n    \/\/ Create session via AuthService[\s\S]*?message: 'Регистрация успешно завершена\.',\n    \}\);/,
  `
    // Do not issue an authenticated session before ownership of the address is verified.
    res.status(201).json({
      success: true,
      requiresVerification: true,
      email: normEmail,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        isAuthenticated: false,
        isVerified: false,
      },
      message: 'Аккаунт создан. Требуется подтверждение адреса электронной почты.',
    });`
);

replaceOrFail(
  'verification endpoint must not return raw OTP',
  /\/\/ Send verification code endpoint\napp\.post\('\/api\/auth\/send-code',[\s\S]*?\n\}\);\n\n\/\/ Helper function to completely remove user account and data/,
  `// Send verification code endpoint.
// Until a real mail/SMS adapter is configured, never expose OTP in an API response.
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    const normEmail = (email || '').trim().toLowerCase();
    if (!normEmail || !normEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'Укажите корректный адрес электронной почты' });
    }

    const user = usersDb.get(normEmail) || (isPostgresConfigured() ? await getUserByEmail(normEmail) : null);
    if (!user) {
      // Do not disclose whether an account exists.
      return res.json({ success: true, deliveryRequired: true, message: 'Если аккаунт существует, код будет отправлен.' });
    }

    const rawCode = crypto.randomInt(100000, 1000000).toString();
    const verificationCodeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const cached = usersDb.get(normEmail);
    if (cached) {
      cached.verificationCodeHash = verificationCodeHash;
      cached.verificationExpiresAt = Date.now() + 10 * 60 * 1000;
    }

    // TODO: deliver rawCode through an approved mail/SMS provider. It is intentionally not returned here.
    return res.status(503).json({
      success: false,
      error: 'OTP_DELIVERY_NOT_CONFIGURED',
      deliveryRequired: true,
      message: 'Сервис доставки кода подтверждения пока не настроен.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Ошибка отправки кода: ' + err.message });
  }
});

// Helper function to completely remove user account and data`
);

replaceOrFail(
  'login must not auto-verify',
  "    // Mark as verified upon successful login\n    user.isVerified = true;\n\n    // Create session via AuthService",
  "    if (!user.isVerified) {\n      return res.status(403).json({ success: false, error: 'EMAIL_NOT_VERIFIED', message: 'Сначала подтвердите адрес электронной почты.' });\n    }\n\n    // Create session via AuthService"
);

replaceOrFail(
  'recovery request must not return raw code',
  "    const { code, expiresAt } = authService.requestRecovery(norm);\n    res.json({\n      success: true,\n      data: { code, expiresAt },\n      message: 'Код восстановления сформирован сервером',\n    });",
  "    const { expiresAt, deliveryRequired } = authService.requestRecovery(norm);\n    res.status(503).json({\n      success: false,\n      error: 'RECOVERY_DELIVERY_NOT_CONFIGURED',\n      data: { expiresAt, deliveryRequired },\n      message: 'Код восстановления создан, но сервис безопасной доставки пока не настроен.',\n    });"
);

replaceOrFail(
  'recovery password minimum length',
  "    if (!norm || !code || !newPassword || newPassword.length < 4) {\n      return res.status(400).json({ success: false, message: 'Укажите корректный код и новый пароль (не менее 4 символов)' });\n    }",
  "    if (!norm || !code || !newPassword || newPassword.length < 8) {\n      return res.status(400).json({ success: false, message: 'Укажите корректный код и новый пароль (не менее 8 символов)' });\n    }"
);

if (source === original) {
  throw new Error('No changes were produced');
}

fs.writeFileSync(file, source);
console.log('server.ts auth hardening completed');
