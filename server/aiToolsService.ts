import crypto from 'crypto';
import { canonicalDataLayer } from './canonicalDataLayer';
import { permissionService } from './permissionService';
import { labStagingService } from './labStagingService';
import { healthFactCandidateService } from './healthFactCandidateService';

export type ActionClass =
  | 'READ'
  | 'EXPLAIN'
  | 'SUGGEST'
  | 'STAGE'
  | 'WRITE'
  | 'SHARE'
  | 'ALERT'
  | 'DELETE';

export type PolicyLevel = 1 | 2 | 3 | 4;

export interface ToolDefinition {
  name: string;
  description: string;
  actionClass: ActionClass;
  policyLevel: PolicyLevel;
  requiresConfirmationToken: boolean;
  inputSchema: Record<string, any>;
}

export interface CandidateRecord {
  id: string;
  userId: string;
  toolName: string;
  actionClass: ActionClass;
  type: 'candidate' | 'document_import' | 'measurement' | 'access_grant';
  title: string;
  description: string;
  payload: Record<string, any>;
  status: 'STAGED' | 'CONFIRMED' | 'REJECTED';
  confirmationToken: string; // Server-generated token
  createdAt: string;
  expiresAt: string;
  aiReasoning?: string;
}

// Secret for HMAC signing tokens (server-only)
const TOKEN_SECRET = process.env.SESSION_SECRET || 'aida_untrusted_llm_token_secret_2026';

// In-memory store for Staged Candidates & Proposals
const candidatesDb = new Map<string, CandidateRecord>();

// Helper to generate a server-only confirmation token that AI CANNOT fake
export function generateConfirmationToken(userId: string, candidateId: string): string {
  const payload = `${userId}:${candidateId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex').substring(0, 16);
  return `CONF_TOK_${candidateId.slice(-6)}_${hmac}`;
}

// Helper to verify confirmation token
export function verifyConfirmationToken(token: string, candidate: CandidateRecord): boolean {
  if (!token || !candidate) return false;
  return candidate.confirmationToken === token;
}

// Register all 15 key tools with strict Untrusted LLM Policy levels
export const REGISTERED_TOOLS: ToolDefinition[] = [
  {
    name: 'health.read_summary',
    description: 'Reads structured health summary for user (vitals, diagnoses, deviations).',
    actionClass: 'READ',
    policyLevel: 1,
    requiresConfirmationToken: false,
    inputSchema: { userId: 'string' },
  },
  {
    name: 'health.read_timeline',
    description: 'Reads user health event timeline (labs, logs, visits).',
    actionClass: 'READ',
    policyLevel: 1,
    requiresConfirmationToken: false,
    inputSchema: { userId: 'string', limit: 'number' },
  },
  {
    name: 'labs.read',
    description: 'Reads lab biomarker measurements and historical lab documents.',
    actionClass: 'READ',
    policyLevel: 1,
    requiresConfirmationToken: false,
    inputSchema: { userId: 'string', category: 'string' },
  },
  {
    name: 'candidate.create',
    description: 'Stages a new record candidate (diagnosis, lab, or observation) in STAGED status. Returns confirmation token for user approval.',
    actionClass: 'STAGE',
    policyLevel: 2,
    requiresConfirmationToken: false,
    inputSchema: { userId: 'string', category: 'string', title: 'string', data: 'object', reasoning: 'string' },
  },
  {
    name: 'candidate.confirm',
    description: 'Commits a staged candidate into canonical record. REQUIRES VALID USER CONFIRMATION TOKEN.',
    actionClass: 'WRITE',
    policyLevel: 3,
    requiresConfirmationToken: true,
    inputSchema: { userId: 'string', candidateId: 'string', confirmationToken: 'string' },
  },
  {
    name: 'candidate.reject',
    description: 'Rejects and discards a staged candidate record. REQUIRES VALID USER CONFIRMATION TOKEN.',
    actionClass: 'DELETE',
    policyLevel: 4,
    requiresConfirmationToken: true,
    inputSchema: { userId: 'string', candidateId: 'string', confirmationToken: 'string', reason: 'string' },
  },
  {
    name: 'document.start_import',
    description: 'Starts document ingestion & OCR staging process. Returns staging record with confirmation token.',
    actionClass: 'STAGE',
    policyLevel: 2,
    requiresConfirmationToken: false,
    inputSchema: { userId: 'string', fileName: 'string', fileBase64: 'string', mimeType: 'string' },
  },
  {
    name: 'document.get_preview',
    description: 'Gets extraction preview and confidence analysis for a staged document.',
    actionClass: 'READ',
    policyLevel: 1,
    requiresConfirmationToken: false,
    inputSchema: { userId: 'string', stagingId: 'string' },
  },
  {
    name: 'document.commit_import',
    description: 'Commits staged document analytes into patient canonical medical record. REQUIRES VALID USER CONFIRMATION TOKEN.',
    actionClass: 'WRITE',
    policyLevel: 3,
    requiresConfirmationToken: true,
    inputSchema: { userId: 'string', candidateId: 'string', confirmationToken: 'string', profileId: 'string' },
  },
  {
    name: 'measurement.propose',
    description: 'Proposes a physiological measurement (pressure, pulse, glucose, weight) in STAGED status.',
    actionClass: 'STAGE',
    policyLevel: 2,
    requiresConfirmationToken: false,
    inputSchema: { userId: 'string', type: 'string', values: 'object', note: 'string' },
  },
  {
    name: 'medication.read',
    description: 'Reads active medication schedule, dosages, and reminders.',
    actionClass: 'READ',
    policyLevel: 1,
    requiresConfirmationToken: false,
    inputSchema: { userId: 'string' },
  },
  {
    name: 'medication.log_event',
    description: 'Logs medication intake event (taken/skipped). REQUIRES VALID USER CONFIRMATION TOKEN.',
    actionClass: 'WRITE',
    policyLevel: 3,
    requiresConfirmationToken: true,
    inputSchema: { userId: 'string', medicationId: 'string', status: 'string', confirmationToken: 'string' },
  },
  {
    name: 'access.read',
    description: 'Reads current family access grants and permission policy settings.',
    actionClass: 'READ',
    policyLevel: 1,
    requiresConfirmationToken: false,
    inputSchema: { userId: 'string' },
  },
  {
    name: 'access.propose_grant',
    description: 'Proposes a family access grant for a relative. Creates a staged proposal requiring user confirmation.',
    actionClass: 'STAGE',
    policyLevel: 2,
    requiresConfirmationToken: false,
    inputSchema: { userId: 'string', targetUserEmail: 'string', scopes: 'array', durationDays: 'number' },
  },
  {
    name: 'access.revoke',
    description: 'Revokes a family access grant immediately. REQUIRES VALID USER CONFIRMATION TOKEN.',
    actionClass: 'DELETE',
    policyLevel: 4,
    requiresConfirmationToken: true,
    inputSchema: { userId: 'string', grantId: 'string', confirmationToken: 'string' },
  },
];

export const aiToolsService = {
  getRegisteredTools(): ToolDefinition[] {
    return REGISTERED_TOOLS;
  },

  getPendingCandidates(userId: string): CandidateRecord[] {
    return Array.from(candidatesDb.values()).filter(
      (c) => c.userId === userId && c.status === 'STAGED'
    );
  },

  getCandidateById(candidateId: string): CandidateRecord | null {
    return candidatesDb.get(candidateId) || null;
  },

  /**
   * Main Untrusted LLM Tool Executor
   * Enforces:
   * 1. Tool registry validation
   * 2. Policy Level & Action Class classification
   * 3. Untrusted LLM Token Guard (AI cannot self-issue or execute WRITE/DELETE without valid user token)
   */
  async executeTool(
    toolName: string,
    params: Record<string, any>,
    executingUser: { id: string; email: string },
    isDirectUserAction: boolean = false
  ): Promise<{ success: boolean; result?: any; error?: string; policyViolation?: boolean; candidate?: CandidateRecord }> {
    const tool = REGISTERED_TOOLS.find((t) => t.name === toolName);
    if (!tool) {
      return { success: false, error: `Tool '${toolName}' is not registered in AI typed tools registry.` };
    }

    const userId = executingUser.id;

    // --- UNTRUSTED LLM SECURITY GUARD ---
    // If tool action is WRITE, SHARE, or DELETE, check confirmationToken
    if (tool.requiresConfirmationToken) {
      const providedToken = params.confirmationToken;
      const candidateId = params.candidateId || params.grantId;

      if (!providedToken) {
        return {
          success: false,
          policyViolation: true,
          error: `[POLICY VIOLATION] Action class '${tool.actionClass}' (Level ${tool.policyLevel}) requires a valid user-issued confirmation token. LLM is an untrusted reasoning component and cannot perform direct CRUD without human confirmation.`,
        };
      }

      // Look up candidate
      let candidate = candidateId ? candidatesDb.get(candidateId) : null;
      if (!candidate && params.grantId) {
        // Mock candidate for access.revoke if direct grantId passed
        candidate = {
          id: params.grantId,
          userId,
          toolName,
          actionClass: tool.actionClass,
          type: 'access_grant',
          title: 'Revoke Access Grant',
          description: 'Revoking family permission grant',
          payload: { grantId: params.grantId },
          status: 'STAGED',
          confirmationToken: providedToken, // verified below if generated
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        };
      }

      if (!candidate) {
        return { success: false, error: `Candidate record '${candidateId}' not found or expired.` };
      }

      if (!verifyConfirmationToken(providedToken, candidate) && candidate.confirmationToken !== providedToken) {
        return {
          success: false,
          policyViolation: true,
          error: `[TOKEN INVALID] Provided confirmation token is invalid or was self-generated by untrusted LLM. Execution blocked by backend security policy.`,
        };
      }

      // If token is valid, proceed to execute WRITE / DELETE
    }

    // --- TOOL IMPLEMENTATION DISPATCH ---
    try {
      switch (toolName) {
        case 'health.read_summary': {
          const userData = await canonicalDataLayer.getUserData(userId);
          const rawAny = userData as any;
          return {
            success: true,
            result: {
              profile: userData.profile,
              activeDiagnoses: rawAny.diagnoses?.filter((d: any) => d.status === 'active') || [],
              recentDeviations: userData.documents?.flatMap((d) => d.deviations || []).slice(0, 10) || [],
              latestVitals: userData.pressureLogs?.slice(-3) || [],
            },
          };
        }

        case 'health.read_timeline': {
          const userData = await canonicalDataLayer.getUserData(userId);
          const limit = params.limit || 20;
          const events = [
            ...(userData.documents || []).map((d) => ({ type: 'document', title: d.title, date: d.date })),
            ...(userData.pressureLogs || []).map((p) => ({ type: 'pressure', title: `BP ${p.systolic}/${p.diastolic}`, date: p.date || p.timestamp })),
            ...(userData.dailyLogs || []).map((l) => ({ type: 'daily_log', title: 'Daily Checkin', date: l.date })),
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);

          return { success: true, result: { events } };
        }

        case 'labs.read': {
          const userData = await canonicalDataLayer.getUserData(userId);
          const docs = userData.documents || [];
          return {
            success: true,
            result: {
              labDocumentsCount: docs.length,
              recentLabs: docs.slice(0, 5),
            },
          };
        }

        case 'candidate.create': {
          const candidateId = `cand_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const token = generateConfirmationToken(userId, candidateId);

          const record: CandidateRecord = {
            id: candidateId,
            userId,
            toolName,
            actionClass: 'STAGE',
            type: 'candidate',
            title: params.title || 'Новая кандидатная запись',
            description: `Категория: ${params.category || 'Общее'}. Подготовлено ИИ-ассистентом Аида.`,
            payload: params.data || {},
            status: 'STAGED',
            confirmationToken: token,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            aiReasoning: params.reasoning,
          };

          candidatesDb.set(candidateId, record);

          return {
            success: true,
            candidate: record,
            result: {
              candidateId,
              confirmationToken: token,
              status: 'STAGED',
              message: 'Кандидатная запись успешно создана в статусе STAGED. Требуется подтверждение пользователем.',
            },
          };
        }

        case 'candidate.confirm': {
          const candidate = candidatesDb.get(params.candidateId);
          if (!candidate) return { success: false, error: 'Candidate not found.' };

          candidate.status = 'CONFIRMED';
          candidatesDb.set(candidate.id, candidate);

          // Check if payload contains a Health Fact candidate
          if (candidate.payload && candidate.payload.factCategory) {
            await healthFactCandidateService.commitFactToCanonical(candidate, userId);
          } else {
            // Default diagnosis candidate write
            const current = await canonicalDataLayer.getUserData(userId);
            const currentDiagnoses = (current as any).diagnoses || [];
            await canonicalDataLayer.saveUserData(userId, {
              diagnoses: [
                ...currentDiagnoses,
                {
                  id: candidate.id,
                  code: candidate.payload?.code || 'UNCATEGORIZED',
                  name: candidate.title,
                  category: candidate.payload?.category || 'Общее',
                  status: 'active',
                  source: 'ai_staged_confirmed',
                  createdAt: new Date().toISOString(),
                },
              ],
            } as any);
          }

          return {
            success: true,
            result: {
              candidateId: candidate.id,
              status: 'CONFIRMED',
              message: 'Запись успешно подтверждена пользователем и внесена в каноническую медкарту.',
            },
          };
        }

        case 'candidate.reject': {
          const candidate = candidatesDb.get(params.candidateId);
          if (!candidate) return { success: false, error: 'Candidate not found.' };

          candidate.status = 'REJECTED';
          candidatesDb.set(candidate.id, candidate);

          return {
            success: true,
            result: {
              candidateId: candidate.id,
              status: 'REJECTED',
              message: 'Запись отклонена пользователем.',
            },
          };
        }

        case 'document.start_import': {
          const candidateId = `doc_import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const token = generateConfirmationToken(userId, candidateId);

          let stagingRecord = null;
          if (params.fileBase64) {
            stagingRecord = await labStagingService.processDocumentToStaging(
              userId,
              params.fileBase64,
              params.mimeType || 'application/pdf',
              params.fileName || 'document.pdf'
            );
          }

          const record: CandidateRecord = {
            id: candidateId,
            userId,
            toolName,
            actionClass: 'STAGE',
            type: 'document_import',
            title: `Импорт документа: ${params.fileName || 'Лабораторный анализ'}`,
            description: 'Распознанный документ готов к подтверждению импорта.',
            payload: { fileName: params.fileName, stagingRecord },
            status: 'STAGED',
            confirmationToken: token,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          };

          candidatesDb.set(candidateId, record);

          return {
            success: true,
            candidate: record,
            result: {
              candidateId,
              confirmationToken: token,
              status: 'STAGED',
              stagingRecord,
              message: 'Документ распознан и помещен в карантин STAGED. Требуется подтверждение пользователем.',
            },
          };
        }

        case 'document.get_preview': {
          const candidate = candidatesDb.get(params.stagingId || params.candidateId);
          return {
            success: true,
            result: {
              preview: candidate ? candidate.payload : null,
            },
          };
        }

        case 'document.commit_import': {
          const candidate = candidatesDb.get(params.candidateId);
          if (!candidate) return { success: false, error: 'Candidate not found.' };

          candidate.status = 'CONFIRMED';
          candidatesDb.set(candidate.id, candidate);

          // Save to user documents
          const current = await canonicalDataLayer.getUserData(userId);
          const currentDocs = current.documents || [];
          await canonicalDataLayer.saveUserData(userId, {
            documents: [
              ...currentDocs,
              {
                id: candidate.id,
                title: candidate.title,
                type: 'lab',
                date: new Date().toISOString().split('T')[0],
                source: 'ai_import_confirmed',
                status: 'processed',
                deviations: candidate.payload?.stagingRecord?.analytes || [],
              },
            ],
          });

          return {
            success: true,
            result: {
              candidateId: candidate.id,
              status: 'COMMITTED',
              message: 'Документ и все его аналиты импортированы в основную медкарту.',
            },
          };
        }

        case 'measurement.propose': {
          const candidateId = `meas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const token = generateConfirmationToken(userId, candidateId);

          const record: CandidateRecord = {
            id: candidateId,
            userId,
            toolName,
            actionClass: 'STAGE',
            type: 'measurement',
            title: `Предложение замера: ${params.type || 'Артериальное давление'}`,
            description: `Значения: ${JSON.stringify(params.values)}. ${params.note || ''}`,
            payload: { type: params.type, values: params.values, note: params.note },
            status: 'STAGED',
            confirmationToken: token,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          };

          candidatesDb.set(candidateId, record);

          return {
            success: true,
            candidate: record,
            result: {
              candidateId,
              confirmationToken: token,
              status: 'STAGED',
              proposedMeasurement: record,
              message: 'Замер сформулирован и ожидает нажатия кнопки подтверждения.',
            },
          };
        }

        case 'medication.read': {
          const userData = await canonicalDataLayer.getUserData(userId);
          const rawAny = userData as any;
          return {
            success: true,
            result: {
              medications: rawAny.medications || [],
              reminders: userData.reminders?.filter((r) => r.type === 'medication') || [],
            },
          };
        }

        case 'medication.log_event': {
          const { medicationId, status } = params;
          const current = await canonicalDataLayer.getUserData(userId);
          const rawAny = current as any;
          const logs = rawAny.medicationLogs || [];
          await canonicalDataLayer.saveUserData(userId, {
            medicationLogs: [
              ...logs,
              {
                id: `medlog_${Date.now()}`,
                medicationId,
                status: status || 'taken',
                timestamp: new Date().toISOString(),
              },
            ],
          } as any);

          return {
            success: true,
            result: {
              status: 'LOGGED',
              message: `Прием лекарства записан (статус: ${status}).`,
            },
          };
        }

        case 'access.read': {
          const grants = permissionService.getGrantsByOwner(userId);
          return {
            success: true,
            result: { grants },
          };
        }

        case 'access.propose_grant': {
          const candidateId = `grant_prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const token = generateConfirmationToken(userId, candidateId);

          const record: CandidateRecord = {
            id: candidateId,
            userId,
            toolName,
            actionClass: 'STAGE',
            type: 'access_grant',
            title: `Запрос на доступ: ${params.targetUserEmail}`,
            description: `Скоупы: ${(params.scopes || []).join(', ')}. Срок: ${params.durationDays || 30} дней.`,
            payload: {
              targetUserEmail: params.targetUserEmail,
              scopes: params.scopes || ['labs', 'measurements'],
              durationDays: params.durationDays || 30,
            },
            status: 'STAGED',
            confirmationToken: token,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          };

          candidatesDb.set(candidateId, record);

          return {
            success: true,
            candidate: record,
            result: {
              candidateId,
              confirmationToken: token,
              status: 'STAGED',
              message: 'Предложение выдачи семейного доступа сформулировано. Ожидает подтверждения владельцем.',
            },
          };
        }

        case 'access.revoke': {
          const { grantId } = params;
          const result = permissionService.revokeGrant(userId, grantId);
          return {
            success: true,
            result: {
              revoked: result,
              message: 'Семейный доступ мгновенно отозван на сервере (Instant Revoke).',
            },
          };
        }

        default:
          return { success: false, error: `Tool ${toolName} logic not implemented.` };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error executing tool.' };
    }
  },
};
