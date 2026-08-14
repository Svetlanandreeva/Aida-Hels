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

const forbidden = [
  'helt_aida_secure_session_secret_2026',
  'consentPersonalData ?? profile.consentPersonal ?? true',
  'consentMedicalData ?? profile.consentMedical ?? true',
  'Пароль должен содержать не менее 4 символов',
  "'Ошибка при регистрации: ' + message",
  "'Ошибка отправки кода: ' + message",
];

for (const marker of forbidden) {
  if (source.includes(marker)) throw new Error(`Forbidden marker remains after hardening: ${marker}`);
}

fs.writeFileSync(file, source);
console.log(`Source security hardening complete: ${changes} change(s).`);
