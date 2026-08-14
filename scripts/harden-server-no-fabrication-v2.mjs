import fs from 'node:fs';

const file = 'server.ts';
let source = fs.readFileSync(file, 'utf8');
const original = source;

function replaceOrFail(label, search, replacement) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`No-fabrication hardening step did not match: ${label}`);
  source = next;
  console.log(`patched no-fabrication: ${label}`);
}

replaceOrFail(
  'lab trend dates must not be invented',
  "      const researchDate = d.researchDate || d.uploadDate || '2026-06-01';",
  "      const researchDate = d.researchDate || d.uploadDate || null;"
);

replaceOrFail(
  'remove synthetic lab trend dataset',
  /\n    if \(allResults\.length === 0\) \{[\s\S]*?\n    \}\n\n    const grouped = new Map<string, any>\(\);/,
  "\n    const grouped = new Map<string, any>();"
);

replaceOrFail(
  'lab trend references must not default to fake ranges',
  "          reference_min: item.referenceMin ?? 0,\n          reference_max: item.referenceMax ?? 100,",
  "          reference_min: item.referenceMin ?? null,\n          reference_max: item.referenceMax ?? null,"
);

replaceOrFail(
  'lab trend values/statuses must preserve unknown state',
  "        value: Number(item.value) || 0,\n        status: item.status || 'normal',",
  "        value: Number.isFinite(Number(item.value)) ? Number(item.value) : null,\n        status: item.status || 'unknown',"
);

replaceOrFail(
  'doctor report diary averages must not invent scores',
  "    const avgState = periodLogs.length ? (periodLogs.reduce((a: number, b: any) => a + (b.state_score || b.score || 7), 0) / periodLogs.length).toFixed(1) : '7.0';\n    const avgEnergy = periodLogs.length ? (periodLogs.reduce((a: number, b: any) => a + (b.energy_score || b.energy || 7), 0) / periodLogs.length).toFixed(1) : '7.0';\n    const avgAnxiety = periodLogs.length ? (periodLogs.reduce((a: number, b: any) => a + (b.anxiety_score || b.anxiety || 3), 0) / periodLogs.length).toFixed(1) : '3.0';\n    const avgStress = periodLogs.length ? (periodLogs.reduce((a: number, b: any) => a + (b.stress_score || b.stress || 3), 0) / periodLogs.length).toFixed(1) : '3.0';",
  "    const averageKnown = (rows: any[], keys: string[]) => {\n      const values = rows.map((row) => {\n        for (const key of keys) {\n          const value = row?.[key];\n          if (value !== undefined && value !== null && Number.isFinite(Number(value))) return Number(value);\n        }\n        return null;\n      }).filter((value): value is number => value !== null);\n      return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : null;\n    };\n    const avgState = averageKnown(periodLogs, ['state_score', 'score']);\n    const avgEnergy = averageKnown(periodLogs, ['energy_score', 'energy']);\n    const avgAnxiety = averageKnown(periodLogs, ['anxiety_score', 'anxiety']);\n    const avgStress = averageKnown(periodLogs, ['stress_score', 'stress']);"
);

replaceOrFail(
  'doctor report patient identity/age must not be invented',
  "  <p><strong>Пациент:</strong> ${profile.fullName || req.user?.fullName || 'Анна Иванова'} | <strong>Возраст:</strong> ${calculateAgeInYears(profile.birthDate) || 34} лет</p>",
  "  <p><strong>Пациент:</strong> ${profile.fullName || req.user?.fullName || 'Не указано'} | <strong>Возраст:</strong> ${profile.birthDate ? (calculateAgeInYears(profile.birthDate) + ' лет') : 'Нет данных'}</p>"
);

replaceOrFail(
  'doctor report chronic conditions must not be invented',
  "      <p>${(profile.chronicConditions || ['Артериальная гипертензия (легкая степень)']).join(', ')}</p>",
  "      <p>${Array.isArray(profile.chronicConditions) && profile.chronicConditions.length ? profile.chronicConditions.join(', ') : 'Нет данных'}</p>"
);

replaceOrFail(
  'doctor report allergies must not be invented',
  "      <p>${(profile.allergies || ['Пенициллин']).join(', ')}</p>",
  "      <p>${Array.isArray(profile.allergies) && profile.allergies.length ? profile.allergies.join(', ') : 'Нет данных'}</p>"
);

replaceOrFail(
  'doctor report averages must show no-data',
  "    <div class=\"card\"><strong>Оценка состояния:</strong> ${avgState} / 10</div>\n    <div class=\"card\"><strong>Уровень энергии:</strong> ${avgEnergy} / 10</div>\n    <div class=\"card\"><strong>Индекс тревожности:</strong> ${avgAnxiety} / 10</div>\n    <div class=\"card\"><strong>Индекс стресса:</strong> ${avgStress} / 10</div>",
  "    <div class=\"card\"><strong>Оценка состояния:</strong> ${avgState ? avgState + ' / 10' : 'Нет данных'}</div>\n    <div class=\"card\"><strong>Уровень энергии:</strong> ${avgEnergy ? avgEnergy + ' / 10' : 'Нет данных'}</div>\n    <div class=\"card\"><strong>Индекс тревожности:</strong> ${avgAnxiety ? avgAnxiety + ' / 10' : 'Нет данных'}</div>\n    <div class=\"card\"><strong>Индекс стресса:</strong> ${avgStress ? avgStress + ' / 10' : 'Нет данных'}</div>"
);

replaceOrFail(
  'doctor report must not claim all labs normal when none are known',
  "    ${abnormalLabs.length ? abnormalLabs.map((a: any) => `<li><span class=\"tag tag-warn\">${a.status.toUpperCase()}</span> <strong>${a.originalName}:</strong> ${a.value} ${a.unit || ''} (норма ${a.referenceMin || 0}–${a.referenceMax || 100})</li>`).join('') : '<li>Все измеренные показатели находятся в пределах нормы.</li>'}",
  "    ${abnormalLabs.length ? abnormalLabs.map((a: any) => `<li><span class=\"tag tag-warn\">${String(a.status || 'unknown').toUpperCase()}</span> <strong>${a.originalName || 'Показатель'}:</strong> ${a.value ?? 'Нет данных'} ${a.unit || ''}${a.referenceMin != null || a.referenceMax != null ? ' (референс ' + (a.referenceMin ?? '—') + '–' + (a.referenceMax ?? '—') + ')' : ''}</li>`).join('') : '<li>Подтверждённых отклонений в доступных данных не найдено. Это не означает, что все показатели в норме.</li>'}"
);

replaceOrFail(
  'doctor report AI summary must not be invented',
  "  <p>${sanitizeText(userData.aiSummary || 'Состояние пациента стабильное, рекомендовано плановое наблюдение.')}</p>",
  "  <p>${userData.aiSummary ? sanitizeText(userData.aiSummary) : 'ИИ-резюме недоступно: недостаточно подтверждённых данных.'}</p>"
);

replaceOrFail(
  'medication safety must fail closed when AI unavailable',
  /    if \(!ai\) \{[\s\S]*?      return res\.json\(\{ success: true, has_conflict: conflict, severity, description: desc \}\);\n    \}/,
  "    if (!ai) {\n      return res.status(503).json({\n        success: false,\n        status: 'unavailable',\n        message: 'Проверка лекарственной совместимости сейчас недоступна. Не считайте отсутствие ответа подтверждением безопасности.',\n      });\n    }"
);

replaceOrFail(
  'medication safety errors must fail closed',
  /  \} catch \(err: any\) \{\n    console\.error\('Medication safety check error:', err\);\n    res\.json\(\{[\s\S]*?\n    \}\);\n  \}\n\}\);/,
  "  } catch (err: any) {\n    console.error('Medication safety check error:', err);\n    return res.status(503).json({\n      success: false,\n      status: 'unavailable',\n      message: 'Не удалось проверить совместимость препаратов. Уточните совместимость у врача или фармацевта.',\n    });\n  }\n});"
);

const systemStatusRegex = /status: abnormalBySystem\.([a-z]+)\.total > 0 && \(abnormalBySystem\.\1\.abnormal \/ abnormalBySystem\.\1\.total\) > 0\.3 \? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ'/g;
let systemStatusReplacements = 0;
source = source.replace(systemStatusRegex, (_match, key) => {
  systemStatusReplacements += 1;
  return `status: abnormalBySystem.${key}.total === 0 ? 'НЕТ ДАННЫХ' : (abnormalBySystem.${key}.abnormal / abnormalBySystem.${key}.total) > 0.3 ? 'ТРЕБУЕТСЯ ВНИМАНИЕ' : 'НОРМАЛЬНЫЙ'`;
});
if (systemStatusReplacements < 10) throw new Error(`Expected 10 system status replacements, got ${systemStatusReplacements}`);
console.log('patched no-fabrication: body-system unknown states');

replaceOrFail(
  'legacy recognize-doc must not return fake OCR markers',
  /\n    const fallbackData = \{[\s\S]*?\n    return res\.json\(\{ success: true, data: fallbackData, mode: 'fallback_ocr' \}\);/,
  "\n    return res.status(503).json({\n      success: false,\n      status: 'unavailable',\n      message: 'Не удалось распознать документ. Никакие показатели не были созданы автоматически.',\n    });"
);

replaceOrFail(
  'research recognizer must not use hardcoded external backend URL',
  "    const appsScriptUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL || 'https://script.google.com/macros/s/AKfycbz2DHIRN60EgYlLwBiUu3sk91V8JgKSXmvLFPJpMTyQafbpZkfOmidDYhg5pJTbkZ-4Kw/exec';",
  "    const appsScriptUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL;"
);

replaceOrFail(
  'sheets proxy must not claim success without backend',
  "    res.json({\n      success: true,\n      data: { message: 'Запрос обработан защищённым внутренним сервером', action, userId },\n      error: null,\n    });",
  "    return res.status(503).json({\n      success: false,\n      data: null,\n      error: { code: 'SHEETS_BACKEND_NOT_CONFIGURED', message: 'Сервис синхронизации сейчас недоступен.' },\n    });"
);

replaceOrFail(
  'mental diary must not fabricate analysis when AI unavailable',
  "    if (!ai) {\n      const fallbackAnalysis = analyzeMentalDiaryFallback(entries || [], newEntry, isCrisis);\n      return res.json({ analysis: fallbackAnalysis, mode: 'simulated' });\n    }",
  "    if (!ai) {\n      return res.status(503).json({\n        success: false,\n        status: 'unavailable',\n        message: 'ИИ-анализ дневника сейчас недоступен. Сохранённые записи остаются без автоматических выводов.',\n        crisisKeywordDetected: isCrisis,\n      });\n    }"
);

replaceOrFail(
  'mental diary errors must not fall back to simulated analysis',
  "  } catch (error: any) {\n    const fallback = analyzeMentalDiaryFallback(req.body.entries || [], req.body.newEntry, false);\n    res.json({ analysis: fallback, mode: 'simulated_fallback' });\n  }",
  "  } catch (error: any) {\n    return res.status(503).json({\n      success: false,\n      status: 'unavailable',\n      message: 'Не удалось выполнить ИИ-анализ дневника. Автоматические выводы не сформированы.',\n    });\n  }"
);

replaceOrFail(
  'health analysis route errors must not generate fallback medical conclusions',
  /  \} catch \(error: any\) \{\n    console\.warn\('API health-analysis route fallback triggered:', error\?\.message \|\| error\);\n    const \{ generateFallbackHealthAnalysis \} = await import\('\.\/server\/healthAnalyzer'\);\n    return res\.json\(\{ success: true, analysis: generateFallbackHealthAnalysis\(req\.body\), mode: 'rule_fallback' \}\);\n  \}/,
  "  } catch (error: any) {\n    console.warn('API health-analysis unavailable:', error?.message || error);\n    return res.status(503).json({\n      success: false,\n      status: 'unavailable',\n      message: 'Персональный анализ сейчас недоступен. Медицинские выводы не сформированы.',\n    });\n  }"
);

replaceOrFail(
  'home API must require authenticated identity',
  "const handleGetHomePayload = async (req: express.Request, res: express.Response) => {\n  try {\n    let userId = 'default_user';",
  "const handleGetHomePayload = async (req: AuthenticatedRequest, res: express.Response) => {\n  try {\n    let userId = req.user!.id;"
);

replaceOrFail(
  'timeline API must require authenticated identity',
  "const handleGetTimeline = async (req: express.Request, res: express.Response) => {\n  try {\n    let userId = 'default_user';",
  "const handleGetTimeline = async (req: AuthenticatedRequest, res: express.Response) => {\n  try {\n    let userId = req.user!.id;"
);

const requestedProfileOverride = "    if (requestedProfileId && requestedProfileId !== 'self' && requestedProfileId !== 'me') {\n      userId = requestedProfileId;\n    }";
const requestedProfileGuard = "    if (requestedProfileId && requestedProfileId !== 'self' && requestedProfileId !== 'me' && requestedProfileId !== req.user!.id) {\n      return res.status(403).json({ success: false, message: 'Нет доступа к данным этого профиля.' });\n    }";
let profileGuardCount = 0;
while (source.includes(requestedProfileOverride) && profileGuardCount < 2) {
  source = source.replace(requestedProfileOverride, requestedProfileGuard);
  profileGuardCount += 1;
}
if (profileGuardCount !== 2) throw new Error(`Expected 2 profile override guards, got ${profileGuardCount}`);
console.log('patched no-fabrication: home/timeline cross-profile overrides');

replaceOrFail(
  'home routes must be authenticated',
  "app.get('/profiles/:id/home', handleGetHomePayload);\napp.get('/api/profiles/:id/home', handleGetHomePayload);\napp.get('/api/home', handleGetHomePayload);",
  "app.get('/profiles/:id/home', requireAuth, handleGetHomePayload);\napp.get('/api/profiles/:id/home', requireAuth, handleGetHomePayload);\napp.get('/api/home', requireAuth, handleGetHomePayload);"
);

replaceOrFail(
  'timeline routes must be authenticated',
  "app.get('/profiles/:id/timeline', handleGetTimeline);\napp.get('/api/profiles/:id/timeline', handleGetTimeline);\napp.get('/api/timeline', handleGetTimeline);",
  "app.get('/profiles/:id/timeline', requireAuth, handleGetTimeline);\napp.get('/api/profiles/:id/timeline', requireAuth, handleGetTimeline);\napp.get('/api/timeline', requireAuth, handleGetTimeline);"
);

source = source.replace(/req\.user\?\.id \|\| 'default_user'/g, 'req.user!.id');

replaceOrFail(
  'integration simulator disabled in production',
  "app.post('/api/integrations/simulate-sample', requireAuth, async (req: AuthenticatedRequest, res) => {",
  "app.post('/api/integrations/simulate-sample', requireAuth, async (req: AuthenticatedRequest, res) => {\n  if (process.env.NODE_ENV === 'production') {\n    return res.status(404).json({ success: false, message: 'Недоступно' });\n  }"
);

replaceOrFail(
  'adult transition email must not be invented',
  "      newAdultEmail: newAdultEmail || 'adult@example.com',",
  "      newAdultEmail,"
);

replaceOrFail(
  'SOS must not claim unverified notifications were delivered',
  "      message: 'Активирован экстренный режим SOS! Оповещения отправлены доверенным контактам и экстренным службам.',",
  "      message: 'Событие SOS создано. Статус фактической доставки уведомлений необходимо проверять отдельно.',"
);

if (source === original) throw new Error('No no-fabrication changes were produced');
fs.writeFileSync(file, source);
console.log('server.ts scoped no-fabrication hardening completed');
