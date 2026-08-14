import { Router, Request, Response, NextFunction } from 'express';
import { canonicalDataLayer } from './canonicalDataLayer';
import { permissionService, PermissionScope } from './permissionService';
import { familyDoctorSharingService } from './familyDoctorSharingService';
import { safetyEmergencyService } from './safetyEmergencyService';
import { dentalService } from './dentalService';
import { puzzleService } from './puzzleService';
import { onboardingService, BASE_ONBOARDING_SCHEMA } from './onboardingService';
import { labStagingService } from './labStagingService';
import { timelineService } from './timelineService';
import { homeApiService } from './homeApiService';
import { auditProvenanceService } from './auditProvenanceService';

export const v1ApiRouter = Router();

const activeProfileSessionMap = new Map<string, string>();

type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR'
  | 'PERMISSION_DENIED'
  | 'INVALID_INPUT'
  | 'NOT_IMPLEMENTED'
  | 'SUBJECT_STORAGE_NOT_READY';

export function sendSuccess(res: Response, data: any, meta: any = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: 'v1',
      ...meta,
    },
  });
}

export function sendError(
  res: Response,
  message: string,
  code: ApiErrorCode = 'INTERNAL_ERROR',
  statusCode = 500,
  details: any = null
) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message, details },
    timestamp: new Date().toISOString(),
    requestId: `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
  });
}

function requireV1Auth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user?.id) {
    return sendError(res, 'Требуется авторизация пользователя.', 'UNAUTHORIZED', 401);
  }
  return next();
}

function isSelfProfile(userId: string, profileId: string | null | undefined) {
  return !profileId || profileId === userId || profileId === 'self' || profileId === `sp-primary-${userId}`;
}

function evaluateProfileAccess(req: Request, profileId: string, scope: PermissionScope, action: 'read' | 'write' | 'delete' | 'manage_grants' = 'read') {
  const userId = (req as any).user?.id || '';
  return permissionService.evaluateAccess({
    requesterUserId: userId,
    targetSubjectProfileId: profileId,
    scope,
    action,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || '',
  });
}

function requireProfileAccess(scope: PermissionScope, action: 'read' | 'write' | 'delete' | 'manage_grants' = 'read') {
  return (req: Request, res: Response, next: NextFunction) => {
    const profileId = req.params.id || req.params.profileId || req.body?.subject_profile_id || req.body?.subjectProfileId || req.body?.profileId;
    if (!profileId) {
      return sendError(res, 'subject_profile_id/profile id обязателен.', 'INVALID_INPUT', 400);
    }
    const evaluation = evaluateProfileAccess(req, profileId, scope, action);
    if (!evaluation.allowed) {
      return sendError(res, evaluation.reason, 'PERMISSION_DENIED', 403, {
        scope,
        action,
        stage: evaluation.stage,
        auditLogId: evaluation.auditEntry.id,
      });
    }
    (req as any).permissionEvaluation = evaluation;
    return next();
  };
}

function canOpenProfile(req: Request, profileId: string): boolean {
  const scopes: PermissionScope[] = ['emergency_card', 'labs', 'measurements', 'medications', 'conditions', 'allergies', 'documents', 'dental', 'mental', 'cycle', 'pregnancy', 'safety', 'location'];
  return scopes.some((scope) => evaluateProfileAccess(req, profileId, scope, 'read').allowed);
}

v1ApiRouter.get('/architecture/readiness', (_req, res) => {
  const subsystems = [
    { id: 'canonical_normalization', status: 'READY', service: 'server/canonicalDataLayer.ts' },
    { id: 'permission_service', status: 'READY', service: 'server/permissionService.ts' },
    { id: 'audit_log', status: 'READY', service: 'server/auditProvenanceService.ts' },
    { id: 'upload_staging_architecture', status: 'PARTIAL', service: 'server/labStagingService.ts', note: 'Binary upload transport still requires production storage adapter.' },
    { id: 'auth_session', status: 'PARTIAL', service: '/api/auth/*', note: 'Canonical auth exists outside /api/v1; v1 aliases intentionally disabled until safely wired.' },
    { id: 'account_profile_separation', status: 'PARTIAL', service: 'familyDoctorSharingService + permissionService', note: 'Some legacy stores are still user-keyed and cannot safely serve non-self profiles.' },
    { id: 'integration_adapters', status: 'PARTIAL', service: 'server/integrationsService.ts', note: 'Registry/ingestion layer exists; native HealthKit/Health Connect bridges are not considered production-ready yet.' },
    { id: 'empty_data_state_contract', status: 'IN_PROGRESS', service: 'API/UI safety audit', note: 'No endpoint may substitute missing medical values with defaults.' },
  ];
  return sendSuccess(res, {
    readyForFrontendDevelopment: false,
    productionReady: false,
    requiresUIWaiting: true,
    message: 'Часть контрактов и legacy stores ещё не готовы для безопасного использования во всех профилях. UI должен уважать not-ready/empty states.',
    subsystems,
  });
});

v1ApiRouter.get('/session', (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    return sendSuccess(res, { isAuthenticated: false, user: null, activeProfileId: null });
  }
  const activeProfileId = activeProfileSessionMap.get(user.id) || `sp-primary-${user.id}`;
  return sendSuccess(res, {
    isAuthenticated: true,
    user: {
      id: user.id,
      email: user.email ?? null,
      name: user.fullName ?? user.name ?? null,
      role: user.role ?? null,
    },
    activeProfileId,
  });
});

v1ApiRouter.get('/session/active-profile', requireV1Auth, (req, res) => {
  const userId = (req as any).user.id;
  return sendSuccess(res, { activeProfileId: activeProfileSessionMap.get(userId) || `sp-primary-${userId}` });
});

v1ApiRouter.post('/session/active-profile', requireV1Auth, (req, res) => {
  const userId = (req as any).user.id;
  const profileId = req.body?.subject_profile_id || req.body?.subjectProfileId || req.body?.profileId;
  if (!profileId) return sendError(res, 'subject_profile_id обязателен.', 'INVALID_INPUT', 400);
  if (!canOpenProfile(req, profileId)) {
    return sendError(res, 'Нет разрешения на открытие указанного профиля.', 'PERMISSION_DENIED', 403);
  }
  activeProfileSessionMap.set(userId, profileId);
  return sendSuccess(res, { activeProfileId: profileId });
});

// Legacy fake /api/v1 auth endpoints are disabled. Canonical auth currently lives at /api/auth/*.
for (const route of ['/auth/register', '/auth/send-code', '/auth/verify-code', '/auth/login']) {
  v1ApiRouter.post(route, (_req, res) =>
    sendError(res, 'Этот v1 auth endpoint временно отключён до безопасной привязки к canonical auth service. Используйте /api/auth/*.', 'NOT_IMPLEMENTED', 501)
  );
}

v1ApiRouter.get('/auth/me', requireV1Auth, (req, res) => sendSuccess(res, { user: (req as any).user }));
v1ApiRouter.post('/auth/logout', requireV1Auth, (_req, res) => sendSuccess(res, { message: 'Запрос на завершение сессии принят canonical auth layer.' }));

v1ApiRouter.get('/profiles', requireV1Auth, async (req, res) => {
  const userId = (req as any).user.id;
  const canonicalData = await canonicalDataLayer.getUserData(userId);
  const primaryProfile = {
    id: `sp-primary-${userId}`,
    userId,
    relationship: 'self',
    name: canonicalData?.profile?.fullName ?? canonicalData?.profile?.name ?? null,
    isChild: false,
    birthDate: canonicalData?.profile?.birthDate ?? null,
  };
  const childProfiles = familyDoctorSharingService.getChildProfilesForGuardian(userId);
  return sendSuccess(res, { profiles: [primaryProfile, ...childProfiles] });
});

v1ApiRouter.post('/profiles', requireV1Auth, (req, res) => {
  const userId = (req as any).user.id;
  const { name, isChild, birthDate, relationship, gender } = req.body || {};
  if (!name) return sendError(res, 'Имя профиля обязательно.', 'INVALID_INPUT', 400);

  if (isChild) {
    if (!birthDate || !['female', 'male'].includes(gender)) {
      return sendError(res, 'Для детского профиля нужны реальная дата рождения и пол; значения по умолчанию запрещены.', 'INVALID_INPUT', 400);
    }
    const child = familyDoctorSharingService.createChildProfile({
      guardianUserId: userId,
      guardianName: (req as any).user.fullName ?? (req as any).user.name ?? '',
      fullName: name,
      birthDate,
      gender,
    });
    return sendSuccess(res, { profile: child }, {}, 201);
  }

  return sendError(
    res,
    'Создание взрослого родственника должно идти через invitation/consent flow, а не создавать локальный псевдопрофиль.',
    'NOT_IMPLEMENTED',
    501,
    { relationship: relationship ?? null }
  );
});

v1ApiRouter.get('/onboarding/schema', requireV1Auth, (_req, res) => sendSuccess(res, { schema: BASE_ONBOARDING_SCHEMA }));
v1ApiRouter.post('/onboarding/progress', requireV1Auth, async (req, res) => {
  const userId = (req as any).user.id;
  const { stepId, answers } = req.body || {};
  if (!stepId || !answers || typeof answers !== 'object') return sendError(res, 'stepId и answers обязательны.', 'INVALID_INPUT', 400);
  return sendSuccess(res, await onboardingService.saveStepProgress(userId, stepId, answers));
});
v1ApiRouter.post('/onboarding/complete', requireV1Auth, async (req, res) => {
  const userId = (req as any).user.id;
  const result = await onboardingService.saveStepProgress(userId, 'complete', req.body || {});
  return sendSuccess(res, { ...result, completed: true });
});

v1ApiRouter.get('/profiles/:id/modules', requireV1Auth, requireProfileAccess('measurements'), async (req, res) => {
  const config = await puzzleService.getUserPuzzleConfig((req as any).user.id);
  return sendSuccess(res, { profileId: req.params.id, modules: config });
});
v1ApiRouter.post('/profiles/:id/modules', requireV1Auth, requireProfileAccess('measurements', 'write'), async (req, res) => {
  const { modules } = req.body || {};
  if (!Array.isArray(modules)) return sendError(res, 'Массив modules обязателен.', 'INVALID_INPUT', 400);
  const updatedConfig = await puzzleService.updateUserPuzzleConfig((req as any).user.id, modules);
  return sendSuccess(res, { profileId: req.params.id, modules: updatedConfig });
});

v1ApiRouter.get('/profiles/:id/home', requireV1Auth, requireProfileAccess('measurements'), async (req, res) => {
  return sendSuccess(res, await homeApiService.getHomePayload((req as any).user.id, req.params.id));
});
v1ApiRouter.get('/profiles/:id/timeline', requireV1Auth, requireProfileAccess('measurements'), async (req, res) => {
  const timelineResponse = await timelineService.getTimeline((req as any).user.id, {});
  return sendSuccess(res, { profileId: req.params.id, ...timelineResponse });
});

v1ApiRouter.get('/profiles/:id/measurements', requireV1Auth, requireProfileAccess('measurements'), async (req, res) => {
  const data = await canonicalDataLayer.getSubjectHealthData((req as any).user.id, req.params.id);
  return sendSuccess(res, { profileId: req.params.id, dailyLogs: data.dailyLogs || [] });
});
v1ApiRouter.post('/profiles/:id/measurements', requireV1Auth, requireProfileAccess('measurements', 'write'), async (req, res) => {
  const userId = (req as any).user.id;
  if (!req.body || Object.keys(req.body).length === 0) return sendError(res, 'Измерение не может быть пустым.', 'INVALID_INPUT', 400);
  const current = await canonicalDataLayer.getUserData(userId);
  const newLog = {
    ...req.body,
    id: `log-${Date.now()}`,
    subject_profile_id: req.params.id,
    timestamp: req.body.timestamp || new Date().toISOString(),
  };
  await canonicalDataLayer.saveUserData(userId, { dailyLogs: [newLog, ...(current.dailyLogs || [])] });
  await auditProvenanceService.recordCriticalChange({ userId, subjectProfileId: req.params.id, resourceType: 'measurement', resourceId: newLog.id, action: 'CREATE', oldValue: null, newValue: newLog, actor: { id: userId, role: 'user', name: (req as any).user?.name }, reasonSource: 'USER_MANUAL_EDIT' });
  return sendSuccess(res, { measurement: newLog }, {}, 201);
});

v1ApiRouter.get('/profiles/:id/blood-pressure', requireV1Auth, requireProfileAccess('measurements'), async (req, res) => {
  const data = await canonicalDataLayer.getSubjectHealthData((req as any).user.id, req.params.id);
  return sendSuccess(res, { profileId: req.params.id, pressureLogs: data.pressureLogs || [] });
});
v1ApiRouter.post('/profiles/:id/blood-pressure', requireV1Auth, requireProfileAccess('measurements', 'write'), async (req, res) => {
  const userId = (req as any).user.id;
  const { systolic, diastolic, pulse, notes, observed_at } = req.body || {};
  if (!Number.isFinite(Number(systolic)) || !Number.isFinite(Number(diastolic))) return sendError(res, 'systolic и diastolic обязательны и должны быть числами.', 'INVALID_INPUT', 400);
  const nowIso = observed_at || new Date().toISOString();
  const newBp = {
    id: `press-${Date.now()}`,
    subject_profile_id: req.params.id,
    timestamp: nowIso,
    systolic: Number(systolic),
    diastolic: Number(diastolic),
    ...(pulse !== undefined && pulse !== null ? { pulse: Number(pulse) } : {}),
    ...(notes ? { notes } : {}),
  };
  const current = await canonicalDataLayer.getUserData(userId);
  await canonicalDataLayer.saveUserData(userId, { pressureLogs: [newBp, ...(current.pressureLogs || [])] });
  await auditProvenanceService.recordCriticalChange({ userId, subjectProfileId: req.params.id, resourceType: 'measurement', resourceId: newBp.id, action: 'CREATE', oldValue: null, newValue: newBp, actor: { id: userId, role: 'user', name: (req as any).user?.name }, reasonSource: 'USER_MANUAL_EDIT' });
  safetyEmergencyService.evaluateMetricsSafety(userId, { systolic: Number(systolic), diastolic: Number(diastolic), ...(pulse !== undefined ? { heartRate: Number(pulse) } : {}) });
  return sendSuccess(res, { bloodPressureLog: newBp }, {}, 201);
});

v1ApiRouter.post('/uploads', requireV1Auth, (req, res) => {
  const { fileName, mimeType } = req.body || {};
  if (!fileName || !mimeType) return sendError(res, 'fileName и mimeType обязательны для upload session.', 'INVALID_INPUT', 400);
  const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return sendSuccess(res, {
    uploadId,
    fileName,
    mimeType,
    protectedStorageRef: `protected://uploads/${uploadId}`,
    status: 'awaiting_binary_upload',
  }, {}, 201);
});

v1ApiRouter.post('/lab-imports/process', requireV1Auth, async (req, res) => {
  const { fileBase64, mimeType, fileName } = req.body || {};
  if (!fileBase64 || !mimeType || !fileName) return sendError(res, 'fileBase64, mimeType и fileName обязательны; тестовые файлы по умолчанию запрещены.', 'INVALID_INPUT', 400);
  const staging = await labStagingService.processDocumentToStaging((req as any).user.id, fileBase64, mimeType, fileName);
  return sendSuccess(res, { stagingRecord: staging }, {}, 201);
});
v1ApiRouter.get('/lab-imports/staging/:id', requireV1Auth, (req, res) => {
  const staging = labStagingService.getStagingRecord(req.params.id);
  if (!staging) return sendError(res, `Черновик импорта ${req.params.id} не найден.`, 'NOT_FOUND', 404);
  return sendSuccess(res, { stagingRecord: staging });
});
v1ApiRouter.post('/lab-imports/commit', requireV1Auth, async (req, res) => {
  const userId = (req as any).user.id;
  const { stagingId, targetProfileId } = req.body || {};
  if (!stagingId || !targetProfileId) return sendError(res, 'stagingId и подтверждённый targetProfileId обязательны.', 'INVALID_INPUT', 400);
  if (!evaluateProfileAccess(req, targetProfileId, 'labs', 'write').allowed) return sendError(res, 'Нет доступа к лабораторным данным этого профиля.', 'PERMISSION_DENIED', 403);
  const result = await labStagingService.commitStagingRecord(userId, { stagingId, targetProfileId, mode: 'commit_to_history' });
  return sendSuccess(res, result);
});

v1ApiRouter.get('/profiles/:id/lab-reports', requireV1Auth, requireProfileAccess('labs'), async (req, res) => {
  const data = await canonicalDataLayer.getSubjectHealthData((req as any).user.id, req.params.id);
  return sendSuccess(res, { profileId: req.params.id, documents: data.documents || [] });
});
v1ApiRouter.post('/profiles/:id/lab-reports', requireV1Auth, requireProfileAccess('labs', 'write'), (_req, res) =>
  sendError(res, 'Прямая запись лабораторного отчёта запрещена: используйте staging → preview → commit.', 'NOT_IMPLEMENTED', 501)
);

v1ApiRouter.get('/profiles/:id/symptoms', requireV1Auth, requireProfileAccess('measurements'), async (req, res) => {
  const data = await canonicalDataLayer.getSubjectHealthData((req as any).user.id, req.params.id);
  return sendSuccess(res, { profileId: req.params.id, symptoms: (data.dailyLogs || []).filter((l: any) => l.symptoms || l.symptomType) });
});
v1ApiRouter.post('/profiles/:id/symptoms', requireV1Auth, requireProfileAccess('measurements', 'write'), async (req, res) => {
  const userId = (req as any).user.id;
  const symptoms = Array.isArray(req.body?.symptoms) ? req.body.symptoms.filter(Boolean) : req.body?.symptomName ? [req.body.symptomName] : [];
  if (symptoms.length === 0) return sendError(res, 'Нужно указать реальный симптом.', 'INVALID_INPUT', 400);
  const newSymptomLog = { id: `symptom-${Date.now()}`, subject_profile_id: req.params.id, timestamp: req.body?.observed_at || new Date().toISOString(), symptoms, ...(req.body?.severity ? { severity: req.body.severity } : {}), ...(req.body?.notes ? { notes: req.body.notes } : {}) };
  const current = await canonicalDataLayer.getUserData(userId);
  await canonicalDataLayer.saveUserData(userId, { dailyLogs: [newSymptomLog, ...(current.dailyLogs || [])] });
  await auditProvenanceService.recordCriticalChange({ userId, subjectProfileId: req.params.id, resourceType: 'symptom', resourceId: newSymptomLog.id, action: 'CREATE', oldValue: null, newValue: newSymptomLog, actor: { id: userId, role: 'user', name: (req as any).user?.name }, reasonSource: 'USER_MANUAL_EDIT' });
  return sendSuccess(res, { symptomLog: newSymptomLog }, {}, 201);
});

function ensureSelfBackedLegacyStore(req: Request, res: Response): boolean {
  const userId = (req as any).user.id;
  if (isSelfProfile(userId, req.params.id)) return true;
  sendError(res, 'Этот legacy store пока хранится по account_id и не может безопасно обслуживать чужой/детский subject_profile_id. Возвращаем честный not-ready вместо смешивания данных.', 'SUBJECT_STORAGE_NOT_READY', 501);
  return false;
}

v1ApiRouter.get('/profiles/:id/conditions', requireV1Auth, requireProfileAccess('conditions'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { profileId: req.params.id, conditions: safetyEmergencyService.getEmergencyCard((req as any).user.id).criticalConditions });
});
v1ApiRouter.post('/profiles/:id/conditions', requireV1Auth, requireProfileAccess('conditions', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  if (!req.body?.conditionName) return sendError(res, 'conditionName обязателен.', 'INVALID_INPUT', 400);
  const userId = (req as any).user.id;
  const card = safetyEmergencyService.getEmergencyCard(userId);
  const newCond = { conditionName: req.body.conditionName, ...(req.body.icdCode ? { icdCode: req.body.icdCode } : {}), ...(req.body.notes ? { notes: req.body.notes } : {}) };
  const updatedCard = safetyEmergencyService.updateEmergencyCard(userId, { criticalConditions: [...card.criticalConditions, newCond] });
  return sendSuccess(res, { conditions: updatedCard.criticalConditions }, {}, 201);
});

v1ApiRouter.get('/profiles/:id/allergies', requireV1Auth, requireProfileAccess('allergies'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { allergies: safetyEmergencyService.getEmergencyCard((req as any).user.id).allergies });
});
v1ApiRouter.post('/profiles/:id/allergies', requireV1Auth, requireProfileAccess('allergies', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  if (!req.body?.allergyName) return sendError(res, 'allergyName обязателен.', 'INVALID_INPUT', 400);
  const userId = (req as any).user.id;
  const card = safetyEmergencyService.getEmergencyCard(userId);
  const newAllergy = { allergyName: req.body.allergyName, ...(req.body.severity ? { severity: req.body.severity } : {}), ...(req.body.notes ? { notes: req.body.notes } : {}) };
  const updatedCard = safetyEmergencyService.updateEmergencyCard(userId, { allergies: [...card.allergies, newAllergy] });
  return sendSuccess(res, { allergies: updatedCard.allergies }, {}, 201);
});

v1ApiRouter.get('/profiles/:id/medications', requireV1Auth, requireProfileAccess('medications'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { medications: safetyEmergencyService.getEmergencyCard((req as any).user.id).activeMedications });
});
v1ApiRouter.post('/profiles/:id/medications', requireV1Auth, requireProfileAccess('medications', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  if (!req.body?.medicationName) return sendError(res, 'medicationName обязателен.', 'INVALID_INPUT', 400);
  const userId = (req as any).user.id;
  const card = safetyEmergencyService.getEmergencyCard(userId);
  const newMed = { medicationName: req.body.medicationName, ...(req.body.dosage ? { dosage: req.body.dosage } : {}), ...(req.body.schedule ? { schedule: req.body.schedule } : {}) };
  const updatedCard = safetyEmergencyService.updateEmergencyCard(userId, { activeMedications: [...card.activeMedications, newMed] });
  return sendSuccess(res, { medications: updatedCard.activeMedications }, {}, 201);
});

v1ApiRouter.get('/profiles/:id/sleep', requireV1Auth, requireProfileAccess('measurements'), async (req, res) => {
  const data = await canonicalDataLayer.getSubjectHealthData((req as any).user.id, req.params.id);
  return sendSuccess(res, { profileId: req.params.id, sleepLogs: (data.dailyLogs || []).filter((l: any) => l.sleepHours !== undefined && l.sleepHours !== null) });
});
v1ApiRouter.post('/profiles/:id/sleep', requireV1Auth, requireProfileAccess('measurements', 'write'), async (req, res) => {
  const sleepHours = Number(req.body?.sleepHours);
  if (!Number.isFinite(sleepHours) || sleepHours <= 0) return sendError(res, 'sleepHours обязателен и должен быть реальным положительным числом.', 'INVALID_INPUT', 400);
  const userId = (req as any).user.id;
  const current = await canonicalDataLayer.getUserData(userId);
  const newSleep = { id: `sleep-${Date.now()}`, subject_profile_id: req.params.id, timestamp: req.body?.observed_at || new Date().toISOString(), sleepHours, ...(req.body?.sleepQuality ? { sleepQuality: req.body.sleepQuality } : {}), ...(req.body?.notes ? { notes: req.body.notes } : {}) };
  await canonicalDataLayer.saveUserData(userId, { dailyLogs: [newSleep, ...(current.dailyLogs || [])] });
  return sendSuccess(res, { sleepLog: newSleep }, {}, 201);
});

v1ApiRouter.get('/profiles/:id/activity', requireV1Auth, requireProfileAccess('measurements'), async (req, res) => {
  const data = await canonicalDataLayer.getSubjectHealthData((req as any).user.id, req.params.id);
  return sendSuccess(res, { profileId: req.params.id, activityLogs: (data.dailyLogs || []).filter((l: any) => l.steps !== undefined || l.workoutMinutes !== undefined || l.caloriesBurned !== undefined) });
});
v1ApiRouter.post('/profiles/:id/activity', requireV1Auth, requireProfileAccess('measurements', 'write'), async (req, res) => {
  const { steps, workoutMinutes, caloriesBurned } = req.body || {};
  if ([steps, workoutMinutes, caloriesBurned].every((v) => v === undefined || v === null)) return sendError(res, 'Нужно передать хотя бы один реальный показатель активности.', 'INVALID_INPUT', 400);
  const userId = (req as any).user.id;
  const current = await canonicalDataLayer.getUserData(userId);
  const newActivity = { id: `activity-${Date.now()}`, subject_profile_id: req.params.id, timestamp: req.body?.observed_at || new Date().toISOString(), ...(steps !== undefined ? { steps: Number(steps) } : {}), ...(workoutMinutes !== undefined ? { workoutMinutes: Number(workoutMinutes) } : {}), ...(caloriesBurned !== undefined ? { caloriesBurned: Number(caloriesBurned) } : {}) };
  await canonicalDataLayer.saveUserData(userId, { dailyLogs: [newActivity, ...(current.dailyLogs || [])] });
  return sendSuccess(res, { activityLog: newActivity }, {}, 201);
});

v1ApiRouter.get('/profiles/:id/mental/entries', requireV1Auth, requireProfileAccess('mental'), async (req, res) => {
  const data = await canonicalDataLayer.getSubjectHealthData((req as any).user.id, req.params.id);
  return sendSuccess(res, { profileId: req.params.id, diaryEntries: data.diaryEntries || [] });
});
v1ApiRouter.post('/profiles/:id/mental/entries', requireV1Auth, requireProfileAccess('mental', 'write'), async (req, res) => {
  const { text, state_score, emotions } = req.body || {};
  if (!text && state_score === undefined && (!Array.isArray(emotions) || emotions.length === 0)) return sendError(res, 'Пустая запись ментального дневника запрещена.', 'INVALID_INPUT', 400);
  const userId = (req as any).user.id;
  const current = await canonicalDataLayer.getUserData(userId);
  const newEntry = { id: `mental-${Date.now()}`, subject_profile_id: req.params.id, created_at: new Date().toISOString(), ...(text ? { text } : {}), ...(state_score !== undefined ? { state_score: Number(state_score) } : {}), ...(Array.isArray(emotions) ? { emotions } : {}) };
  await canonicalDataLayer.saveUserData(userId, { diaryEntries: [newEntry, ...(current.diaryEntries || [])] });
  return sendSuccess(res, { mentalEntry: newEntry }, {}, 201);
});
v1ApiRouter.post('/profiles/:id/mental/analyze', requireV1Auth, requireProfileAccess('mental'), async (req, res) => {
  const data = await canonicalDataLayer.getSubjectHealthData((req as any).user.id, req.params.id);
  if (!data.diaryEntries?.length) return sendSuccess(res, { profileId: req.params.id, state: 'no_data', analysis: null });
  return sendSuccess(res, { profileId: req.params.id, state: 'requires_ai_pipeline', analysis: null, evidenceCount: data.diaryEntries.length });
});

v1ApiRouter.get('/profiles/:id/cycle/summary', requireV1Auth, requireProfileAccess('cycle'), async (req, res) => {
  const data = await canonicalDataLayer.getSubjectHealthData((req as any).user.id, req.params.id);
  const cycle = (data as any)?.profile?.womenHealth?.cycle ?? (data as any)?.womenHealth?.cycle ?? null;
  return sendSuccess(res, { profileId: req.params.id, state: cycle ? 'available' : 'no_data', cycle });
});
v1ApiRouter.post('/profiles/:id/cycle/log', requireV1Auth, requireProfileAccess('cycle', 'write'), async (req, res) => {
  const { flow, symptoms, observed_at } = req.body || {};
  if (!flow && (!Array.isArray(symptoms) || symptoms.length === 0)) return sendError(res, 'Нужно передать реальное событие цикла.', 'INVALID_INPUT', 400);
  const userId = (req as any).user.id;
  const current = await canonicalDataLayer.getUserData(userId);
  const event = { id: `cycle-${Date.now()}`, subject_profile_id: req.params.id, event_type: 'cycle', observed_at: observed_at || new Date().toISOString(), ...(flow ? { flow } : {}), ...(Array.isArray(symptoms) ? { symptoms } : {}) };
  await canonicalDataLayer.saveUserData(userId, { dailyLogs: [event, ...(current.dailyLogs || [])] });
  return sendSuccess(res, { loggedEvent: event }, {}, 201);
});

v1ApiRouter.get('/profiles/:id/pregnancies/summary', requireV1Auth, requireProfileAccess('pregnancy'), async (req, res) => {
  const data = await canonicalDataLayer.getSubjectHealthData((req as any).user.id, req.params.id);
  const pregnancy = (data as any)?.profile?.womenHealth?.pregnancy ?? (data as any)?.womenHealth?.pregnancy ?? null;
  return sendSuccess(res, { profileId: req.params.id, state: pregnancy ? 'available' : 'no_data', activePregnancy: pregnancy, history: [] });
});
v1ApiRouter.post('/profiles/:id/pregnancies/log', requireV1Auth, requireProfileAccess('pregnancy', 'write'), async (req, res) => {
  if (req.body?.gestatingWeeks === undefined && !req.body?.notes) return sendError(res, 'Нельзя создавать пустую pregnancy-запись.', 'INVALID_INPUT', 400);
  const userId = (req as any).user.id;
  const current = await canonicalDataLayer.getUserData(userId);
  const event = { id: `preg-${Date.now()}`, subject_profile_id: req.params.id, event_type: 'pregnancy', loggedAt: new Date().toISOString(), ...(req.body?.gestatingWeeks !== undefined ? { gestatingWeeks: Number(req.body.gestatingWeeks) } : {}), ...(req.body?.notes ? { notes: req.body.notes } : {}) };
  await canonicalDataLayer.saveUserData(userId, { dailyLogs: [event, ...(current.dailyLogs || [])] });
  return sendSuccess(res, { pregnancyLog: event }, {}, 201);
});

v1ApiRouter.get('/profiles/:id/access-grants', requireV1Auth, requireProfileAccess('documents', 'manage_grants'), (req, res) => {
  if (!isSelfProfile((req as any).user.id, req.params.id)) return sendError(res, 'Управлять grants может только владелец профиля.', 'PERMISSION_DENIED', 403);
  return sendSuccess(res, { grants: permissionService.getGrantsByOwner((req as any).user.id) });
});
v1ApiRouter.post('/profiles/:id/access-grants/create', requireV1Auth, requireProfileAccess('documents', 'manage_grants'), (req, res) => {
  const userId = (req as any).user.id;
  if (!isSelfProfile(userId, req.params.id)) return sendError(res, 'Управлять grants может только владелец профиля.', 'PERMISSION_DENIED', 403);
  const { recipientName, scopes, relationship } = req.body || {};
  if (!recipientName || !relationship || !Array.isArray(scopes) || scopes.length === 0) return sendError(res, 'recipientName, relationship и явный непустой scopes обязательны. Автоматические scopes запрещены.', 'INVALID_INPUT', 400);
  const grant = permissionService.createInvitation({ ownerUserId: userId, granteeName: recipientName, relationship, isAdult: true, allowedScopes: scopes });
  return sendSuccess(res, { grant }, {}, 201);
});
v1ApiRouter.post('/profiles/:id/access-grants/revoke', requireV1Auth, requireProfileAccess('documents', 'manage_grants'), (req, res) => {
  const userId = (req as any).user.id;
  if (!isSelfProfile(userId, req.params.id)) return sendError(res, 'Управлять grants может только владелец профиля.', 'PERMISSION_DENIED', 403);
  if (!req.body?.grantId) return sendError(res, 'grantId обязателен.', 'INVALID_INPUT', 400);
  return sendSuccess(res, { revoked: permissionService.revokeGrant(userId, req.body.grantId), grantId: req.body.grantId });
});

v1ApiRouter.get('/profiles/:id/emergency-card', requireV1Auth, requireProfileAccess('emergency_card'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { card: safetyEmergencyService.getEmergencyCard((req as any).user.id) });
});
v1ApiRouter.post('/profiles/:id/emergency-card/update', requireV1Auth, requireProfileAccess('emergency_card', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { card: safetyEmergencyService.updateEmergencyCard((req as any).user.id, req.body || {}) });
});

v1ApiRouter.get('/profiles/:id/dental/summary', requireV1Auth, requireProfileAccess('dental'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  const dentitionType = req.query.dentitionType === 'primary' ? 'primary' : 'permanent';
  return sendSuccess(res, { summary: dentalService.getDentalSummary((req as any).user.id, dentitionType) });
});
v1ApiRouter.post('/profiles/:id/dental/tooth/update', requireV1Auth, requireProfileAccess('dental', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  if (!req.body?.toothNumber) return sendError(res, 'toothNumber обязателен.', 'INVALID_INPUT', 400);
  const { toothNumber, ...updates } = req.body;
  return sendSuccess(res, { tooth: dentalService.updateTooth((req as any).user.id, Number(toothNumber), updates) });
});
v1ApiRouter.post('/profiles/:id/dental/finding', requireV1Auth, requireProfileAccess('dental', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { finding: dentalService.addFinding((req as any).user.id, req.body) }, {}, 201);
});
v1ApiRouter.post('/profiles/:id/dental/procedure', requireV1Auth, requireProfileAccess('dental', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { procedure: dentalService.addProcedure((req as any).user.id, req.body) }, {}, 201);
});
v1ApiRouter.post('/profiles/:id/dental/symptom', requireV1Auth, requireProfileAccess('dental', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { symptom: dentalService.addSymptom((req as any).user.id, req.body) }, {}, 201);
});
v1ApiRouter.post('/profiles/:id/dental/periodontal', requireV1Auth, requireProfileAccess('dental', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { periodontalRecord: dentalService.addPeriodontalRecord((req as any).user.id, req.body) }, {}, 201);
});
v1ApiRouter.post('/profiles/:id/dental/orthodontic', requireV1Auth, requireProfileAccess('dental', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { orthodonticEpisode: dentalService.addOrthodonticEpisode((req as any).user.id, req.body) }, {}, 201);
});
v1ApiRouter.post('/profiles/:id/dental/visit', requireV1Auth, requireProfileAccess('dental', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { visit: dentalService.addVisit((req as any).user.id, req.body) }, {}, 201);
});
v1ApiRouter.post('/profiles/:id/dental/imaging', requireV1Auth, requireProfileAccess('dental', 'write'), (req, res) => {
  if (!ensureSelfBackedLegacyStore(req, res)) return;
  return sendSuccess(res, { imaging: dentalService.addImagingLink((req as any).user.id, req.body) }, {}, 201);
});

// Error handler must be last.
v1ApiRouter.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  console.error('[API v1 Error]', err);
  if (res.headersSent) return next(err);
  return sendError(res, 'Внутренняя ошибка сервера', 'INTERNAL_ERROR', 500);
});
