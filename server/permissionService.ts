import crypto from 'crypto';
import { familyDoctorSharingService } from './familyDoctorSharingService';

export type PermissionScope =
  | 'labs'
  | 'measurements'
  | 'medications'
  | 'conditions'
  | 'allergies'
  | 'mental'
  | 'cycle'
  | 'pregnancy'
  | 'dental'
  | 'documents'
  | 'emergency_card'
  | 'safety'
  | 'location';

export const ALL_SCOPES: PermissionScope[] = [
  'labs',
  'measurements',
  'medications',
  'conditions',
  'allergies',
  'mental',
  'cycle',
  'pregnancy',
  'dental',
  'documents',
  'emergency_card',
  'safety',
  'location',
];

export const SENSITIVE_SCOPES: PermissionScope[] = ['mental', 'cycle', 'pregnancy', 'location'];

export const DEFAULT_BASIC_SCOPES: PermissionScope[] = [
  'labs',
  'measurements',
  'medications',
  'conditions',
  'allergies',
  'dental',
  'emergency_card',
  'documents',
  'safety',
];

export interface FamilyGrant {
  id: string;
  ownerUserId: string;
  granteeUserId: string;
  granteeEmailOrPhone?: string;
  granteeName: string;
  relationship: string;
  isAdult: boolean;
  status: 'pending_invitation' | 'active' | 'revoked' | 'rejected';
  invitationCode: string;
  allowedScopes: PermissionScope[];
  explicitSensitiveScopesGranted: PermissionScope[];
  invitedAt: string;
  consentedAt?: string;
  revokedAt?: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  pipelineStage: 'authentication' | 'permission' | 'validation' | 'policy' | 'execution' | 'audit';
  requesterUserId: string;
  targetSubjectProfileId: string;
  scope: PermissionScope | 'all' | 'grants';
  action: 'read' | 'write' | 'delete' | 'manage_grants';
  decision: 'GRANTED' | 'DENIED';
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface EvaluationResult {
  allowed: boolean;
  stage: 'authentication' | 'permission' | 'validation' | 'policy' | 'execution' | 'audit';
  decision: 'GRANTED' | 'DENIED';
  reason: string;
  grant?: FamilyGrant;
  auditEntry: AuditLogEntry;
}

function uniqueScopes(scopes: PermissionScope[]): PermissionScope[] {
  return Array.from(new Set(scopes)).filter((scope): scope is PermissionScope => ALL_SCOPES.includes(scope));
}

export class PermissionService {
  private grants = new Map<string, FamilyGrant>();
  private userGrantsIndex = new Map<string, Set<string>>();
  private granteeIndex = new Map<string, Set<string>>();
  private invitationCodeIndex = new Map<string, string>();
  private auditLogs: AuditLogEntry[] = [];

  // IMPORTANT: production service starts empty. Demo/test grants must be injected by tests only.
  constructor() {}

  private generateInvitationCode(): string {
    let code = '';
    do {
      const number = crypto.randomInt(100000, 1000000);
      code = `INV-${number}`;
    } while (this.invitationCodeIndex.has(code));
    return code;
  }

  private storeGrant(grant: FamilyGrant) {
    this.grants.set(grant.id, grant);

    if (!this.userGrantsIndex.has(grant.ownerUserId)) {
      this.userGrantsIndex.set(grant.ownerUserId, new Set());
    }
    this.userGrantsIndex.get(grant.ownerUserId)!.add(grant.id);

    if (grant.granteeUserId) {
      if (!this.granteeIndex.has(grant.granteeUserId)) {
        this.granteeIndex.set(grant.granteeUserId, new Set());
      }
      this.granteeIndex.get(grant.granteeUserId)!.add(grant.id);
    }

    this.invitationCodeIndex.set(grant.invitationCode, grant.id);
  }

  public logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    this.auditLogs.unshift(fullEntry);
    if (this.auditLogs.length > 500) this.auditLogs.length = 500;
    return fullEntry;
  }

  public getAuditLogs(userId: string): AuditLogEntry[] {
    return this.auditLogs.filter(
      (log) => log.requesterUserId === userId || log.targetSubjectProfileId === userId
    );
  }

  public evaluateAccess(params: {
    requesterUserId: string;
    targetSubjectProfileId?: string;
    scope: PermissionScope;
    action?: 'read' | 'write' | 'delete' | 'manage_grants';
    ipAddress?: string;
    userAgent?: string;
  }): EvaluationResult {
    const {
      requesterUserId,
      targetSubjectProfileId = 'self',
      scope,
      action = 'read',
      ipAddress,
      userAgent,
    } = params;

    const normalizedTargetId =
      !targetSubjectProfileId || targetSubjectProfileId === 'self' || targetSubjectProfileId === 'me'
        ? requesterUserId
        : targetSubjectProfileId;

    const deny = (
      stage: EvaluationResult['stage'],
      reason: string,
      grant?: FamilyGrant
    ): EvaluationResult => {
      const auditEntry = this.logAudit({
        pipelineStage: stage === 'execution' ? 'policy' : stage,
        requesterUserId: requesterUserId || 'anonymous',
        targetSubjectProfileId: normalizedTargetId,
        scope,
        action,
        decision: 'DENIED',
        reason,
        ipAddress,
        userAgent,
      });
      return { allowed: false, stage, decision: 'DENIED', reason, grant, auditEntry };
    };

    if (!requesterUserId) {
      return deny('authentication', 'Требуется аутентификация');
    }

    if (!ALL_SCOPES.includes(scope)) {
      return deny('validation', `Недействительный scope: ${scope}`);
    }

    // Self access is allowed only to the caller's own subject profile identifier.
    if (normalizedTargetId === requesterUserId || normalizedTargetId === `sp-primary-${requesterUserId}`) {
      const auditEntry = this.logAudit({
        pipelineStage: 'audit',
        requesterUserId,
        targetSubjectProfileId: normalizedTargetId,
        scope,
        action,
        decision: 'GRANTED',
        reason: 'Владелец собственного профиля',
        ipAddress,
        userAgent,
      });
      return {
        allowed: true,
        stage: 'audit',
        decision: 'GRANTED',
        reason: 'Владелец собственного профиля',
        auditEntry,
      };
    }

    const childProfile = familyDoctorSharingService.getChildProfile(normalizedTargetId);
    if (childProfile?.isChild) {
      const isGuardian = childProfile.guardians.some((guardian) => guardian.userId === requesterUserId);
      if (isGuardian) {
        const auditEntry = this.logAudit({
          pipelineStage: 'audit',
          requesterUserId,
          targetSubjectProfileId: normalizedTargetId,
          scope,
          action,
          decision: 'GRANTED',
          reason: `Авторизованный guardian детского профиля ${childProfile.fullName}`,
          ipAddress,
          userAgent,
        });
        return {
          allowed: true,
          stage: 'audit',
          decision: 'GRANTED',
          reason: 'Авторизованный guardian детского профиля',
          auditEntry,
        };
      }
    }

    const ownerGrantIds = this.userGrantsIndex.get(normalizedTargetId) || new Set<string>();
    let matchedGrant: FamilyGrant | undefined;
    for (const grantId of ownerGrantIds) {
      const candidate = this.grants.get(grantId);
      if (candidate?.granteeUserId === requesterUserId) {
        matchedGrant = candidate;
        break;
      }
    }

    if (!matchedGrant) {
      return deny('permission', 'Deny by default: разрешение отсутствует');
    }

    if (matchedGrant.status !== 'active') {
      return deny('policy', `Разрешение не активно: ${matchedGrant.status}`, matchedGrant);
    }

    if (!matchedGrant.allowedScopes.includes(scope)) {
      return deny('policy', `Scope ${scope} не выдан`, matchedGrant);
    }

    if (
      SENSITIVE_SCOPES.includes(scope) &&
      !matchedGrant.explicitSensitiveScopesGranted.includes(scope)
    ) {
      return deny('policy', `Sensitive scope ${scope} требует отдельного согласия`, matchedGrant);
    }

    const auditEntry = this.logAudit({
      pipelineStage: 'audit',
      requesterUserId,
      targetSubjectProfileId: normalizedTargetId,
      scope,
      action,
      decision: 'GRANTED',
      reason: `Доступ разрешён по grant ${matchedGrant.id}`,
      ipAddress,
      userAgent,
    });

    return {
      allowed: true,
      stage: 'execution',
      decision: 'GRANTED',
      reason: 'Доступ предоставлен',
      grant: matchedGrant,
      auditEntry,
    };
  }

  public createInvitation(params: {
    ownerUserId: string;
    granteeName: string;
    granteeEmailOrPhone?: string;
    relationship: string;
    isAdult: boolean;
    allowedScopes: PermissionScope[];
    explicitSensitiveScopes?: PermissionScope[];
  }): FamilyGrant {
    const explicitSensitive = uniqueScopes(params.explicitSensitiveScopes || []).filter((scope) =>
      SENSITIVE_SCOPES.includes(scope)
    );
    const allowed = uniqueScopes(params.allowedScopes).filter(
      (scope) => !SENSITIVE_SCOPES.includes(scope) || explicitSensitive.includes(scope)
    );

    const now = new Date().toISOString();
    const grant: FamilyGrant = {
      id: crypto.randomUUID(),
      ownerUserId: params.ownerUserId,
      granteeUserId: '',
      granteeEmailOrPhone: params.granteeEmailOrPhone,
      granteeName: params.granteeName,
      relationship: params.relationship,
      isAdult: params.isAdult,
      status: params.isAdult ? 'pending_invitation' : 'active',
      invitationCode: this.generateInvitationCode(),
      allowedScopes: allowed,
      explicitSensitiveScopesGranted: explicitSensitive,
      invitedAt: now,
      updatedAt: now,
    };

    this.storeGrant(grant);
    this.logAudit({
      pipelineStage: 'policy',
      requesterUserId: params.ownerUserId,
      targetSubjectProfileId: params.ownerUserId,
      scope: 'grants',
      action: 'manage_grants',
      decision: 'GRANTED',
      reason: `Создан grant ${grant.id}`,
    });
    return grant;
  }

  public acceptInvitation(invitationCode: string, granteeUserId: string, granteeName?: string): FamilyGrant {
    const normalizedCode = invitationCode.trim().toUpperCase();
    const grantId = this.invitationCodeIndex.get(normalizedCode);
    if (!grantId) throw new Error('Код приглашения не найден или недействителен');

    const grant = this.grants.get(grantId);
    if (!grant) throw new Error('Запись приглашения не найдена');
    if (grant.status === 'revoked' || grant.status === 'rejected') {
      throw new Error('Приглашение больше не активно');
    }
    if (grant.status === 'active' && grant.granteeUserId && grant.granteeUserId !== granteeUserId) {
      throw new Error('Приглашение уже использовано другим аккаунтом');
    }

    grant.granteeUserId = granteeUserId;
    if (granteeName) grant.granteeName = granteeName;
    grant.status = 'active';
    grant.consentedAt = new Date().toISOString();
    grant.updatedAt = grant.consentedAt;

    if (!this.granteeIndex.has(granteeUserId)) this.granteeIndex.set(granteeUserId, new Set());
    this.granteeIndex.get(granteeUserId)!.add(grant.id);

    this.logAudit({
      pipelineStage: 'policy',
      requesterUserId: granteeUserId,
      targetSubjectProfileId: grant.ownerUserId,
      scope: 'grants',
      action: 'manage_grants',
      decision: 'GRANTED',
      reason: `Приглашение ${normalizedCode} принято`,
    });
    return grant;
  }

  public revokeGrant(ownerUserId: string, grantId: string): boolean {
    const grant = this.grants.get(grantId);
    if (!grant) return false;
    if (grant.ownerUserId !== ownerUserId) {
      throw new Error('Отозвать доступ может только владелец профиля');
    }

    grant.status = 'revoked';
    grant.revokedAt = new Date().toISOString();
    grant.updatedAt = grant.revokedAt;
    this.logAudit({
      pipelineStage: 'policy',
      requesterUserId: ownerUserId,
      targetSubjectProfileId: ownerUserId,
      scope: 'grants',
      action: 'manage_grants',
      decision: 'GRANTED',
      reason: `Grant ${grantId} отозван`,
    });
    return true;
  }

  public updateGrantScopes(
    ownerUserId: string,
    grantId: string,
    allowedScopes: PermissionScope[],
    explicitSensitiveScopes: PermissionScope[]
  ): FamilyGrant {
    const grant = this.grants.get(grantId);
    if (!grant || grant.ownerUserId !== ownerUserId) {
      throw new Error('Разрешение не найдено или принадлежит другому пользователю');
    }

    const explicitSensitive = uniqueScopes(explicitSensitiveScopes).filter((scope) =>
      SENSITIVE_SCOPES.includes(scope)
    );
    grant.allowedScopes = uniqueScopes(allowedScopes).filter(
      (scope) => !SENSITIVE_SCOPES.includes(scope) || explicitSensitive.includes(scope)
    );
    grant.explicitSensitiveScopesGranted = explicitSensitive;
    grant.updatedAt = new Date().toISOString();
    return grant;
  }

  public getGrantsByOwner(ownerUserId: string): FamilyGrant[] {
    const grantIds = this.userGrantsIndex.get(ownerUserId) || new Set<string>();
    return Array.from(grantIds)
      .map((id) => this.grants.get(id))
      .filter((grant): grant is FamilyGrant => Boolean(grant));
  }

  public getGrantsByGrantee(granteeUserId: string): FamilyGrant[] {
    const grantIds = this.granteeIndex.get(granteeUserId) || new Set<string>();
    return Array.from(grantIds)
      .map((id) => this.grants.get(id))
      .filter((grant): grant is FamilyGrant => Boolean(grant));
  }
}

export const permissionService = new PermissionService();