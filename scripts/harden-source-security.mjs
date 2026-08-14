import fs from 'node:fs';

const file = 'server.ts';
let source = fs.readFileSync(file, 'utf8');
let changes = 0;

function replaceExact(from, to, label) {
  if (!source.includes(from)) {
    if (source.includes(to)) {
      console.log(`SKIP ${label}: already hardened`);
      return;
    }
    throw new Error(`Expected source block not found for ${label}`);
  }
  source = source.replace(from, to);
  changes++;
  console.log(`FIX ${label}`);
}

replaceExact(
  "const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'helt_aida_secure_session_secret_2026';",
  "const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET;\nif (!JWT_SECRET) {\n  throw new Error('SESSION_SECRET or JWT_SECRET must be configured.');\n}",
  'remove hard-coded JWT/session secret fallback'
);

replaceExact(
  "  const consentPersonal = profile.consentPersonalData ?? profile.consentPersonal ?? true;\n  const consentMedical = profile.consentMedicalData ?? profile.consentMedical ?? true;\n\n  if (consentPersonal === false || consentMedical === false) {",
  "  const consentPersonal = profile.consentPersonalData ?? profile.consentPersonal ?? false;\n  const consentMedical = profile.consentMedicalData ?? profile.consentMedical ?? false;\n\n  if (consentPersonal !== true || consentMedical !== true) {",
  'require explicit personal and medical consent'
);

replaceExact(
  "app.use('/api/v1', v1ApiRouter);",
  "app.use('/api/v1', requireAuth, v1ApiRouter);",
  'protect v1 API router'
);

replaceExact(
  "    if (!password || password.length < 4) {\n      return res.status(400).json({ success: false, message: 'Пароль должен содержать не менее 4 символов' });\n    }",
  "    if (!password || password.length < 8) {\n      return res.status(400).json({ success: false, message: 'Пароль должен содержать не менее 8 символов' });\n    }",
  'raise registration password minimum to 8 characters'
);

replaceExact(
  "  } catch (err) {\n    const message = err instanceof Error ? err.message : String(err);\n    console.error('Registration error:', err);\n    res.status(500).json({ success: false, message: 'Ошибка при регистрации: ' + message });\n  }\n});",
  "  } catch (err) {\n    console.error('Registration error:', err);\n    res.status(500).json({ success: false, message: 'Не удалось завершить регистрацию. Попробуйте ещё раз.' });\n  }\n});",
  'hide internal registration errors from clients'
);

replaceExact(
  "  } catch (err) {\n    const message = err instanceof Error ? err.message : String(err);\n    res.status(500).json({ success: false, message: 'Ошибка отправки кода: ' + message });\n  }\n});",
  "  } catch (err) {\n    console.error('Verification code send error:', err);\n    res.status(500).json({ success: false, message: 'Не удалось отправить код. Попробуйте позже.' });\n  }\n});",
  'hide internal verification-mail errors from clients'
);

replaceExact(
  "    user.isVerified = true;\n\n    // Create session via AuthService",
  "    // Verification was confirmed by the mail backend above; no local trust escalation is needed.\n\n    // Create session via AuthService",
  'remove local verification trust escalation on login'
);

replaceExact(
  "  } catch (err: any) {\n    console.error('Login error:', err);\n    res.status(500).json({ success: false, message: 'Ошибка при входе: ' + err.message });\n  }\n});",
  "  } catch (err) {\n    console.error('Login error:', err);\n    res.status(500).json({ success: false, message: 'Не удалось выполнить вход. Попробуйте ещё раз.' });\n  }\n});",
  'hide internal login errors from clients'
);

replaceExact(
  "      const backendMessage = verifyResult?.data?.message || verifyResult?.error?.message;\n      return res.status(400).json({\n        success: false,\n        message: backendMessage || `Неверный код подтверждения. Осталось попыток: ${3 - attempts.count}`,\n      });",
  "      return res.status(400).json({\n        success: false,\n        message: `Неверный код подтверждения. Осталось попыток: ${3 - attempts.count}`,\n      });",
  'do not expose verification backend messages'
);

replaceExact(
  "  } catch (err) {\n    const message = err instanceof Error ? err.message : String(err);\n    console.error('Verify code error:', err);\n    res.status(500).json({ success: false, message: 'Ошибка проверки кода: ' + message });\n  }\n});",
  "  } catch (err) {\n    console.error('Verify code error:', err);\n    res.status(500).json({ success: false, message: 'Не удалось проверить код. Попробуйте ещё раз.' });\n  }\n});",
  'hide internal verification errors from clients'
);

replaceExact(
  "    const { code, expiresAt } = authService.requestRecovery(norm);\n    res.json({\n      success: true,\n      data: { code, expiresAt },\n      message: 'Код восстановления сформирован сервером',\n    });",
  "    const { expiresAt, deliveryRequired } = authService.requestRecovery(norm);\n    res.status(503).json({\n      success: false,\n      error: 'RECOVERY_DELIVERY_NOT_CONFIGURED',\n      data: { expiresAt, deliveryRequired },\n      message: 'Восстановление пароля временно недоступно: безопасная доставка кода не настроена.',\n    });",
  'never return password recovery code to client'
);

replaceExact(
  "    if (!norm || !code || !newPassword || newPassword.length < 4) {\n      return res.status(400).json({ success: false, message: 'Укажите корректный код и новый пароль (не менее 4 символов)' });\n    }",
  "    if (!norm || !code || !newPassword || newPassword.length < 8) {\n      return res.status(400).json({ success: false, message: 'Укажите корректный код и новый пароль (не менее 8 символов)' });\n    }",
  'raise recovery password minimum to 8 characters'
);

const forbidden = [
  'helt_aida_secure_session_secret_2026',
  'consentPersonalData ?? profile.consentPersonal ?? true',
  'consentMedicalData ?? profile.consentMedical ?? true',
  "app.use('/api/v1', v1ApiRouter);",
  'Пароль должен содержать не менее 4 символов',
  "'Ошибка при регистрации: ' + message",
  "'Ошибка отправки кода: ' + message",
  "'Ошибка при входе: ' + err.message",
  "'Ошибка проверки кода: ' + message",
  'const { code, expiresAt } = authService.requestRecovery(norm)',
  'новый пароль (не менее 4 символов)',
];

for (const marker of forbidden) {
  if (source.includes(marker)) throw new Error(`Forbidden marker remains after hardening: ${marker}`);
}

fs.writeFileSync(file, source);
console.log(`Source security hardening complete: ${changes} change(s).`);
