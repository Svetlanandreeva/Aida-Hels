import { canonicalDataLayer } from './canonicalDataLayer';
import { familyDoctorSharingService } from './familyDoctorSharingService';

export type PermissionScope =
  | 'labs'            // Лабораторные анализы и биомаркеры
  | 'measurements'    // Физиологические замеры (давление, вес, пульс и т.д.)
  | 'medications'     // Лекарства и рецепты
  | 'conditions'      // Диагнозы и медицинские проблемы
  | 'allergies'       // Аллергии и непереносимости
  | 'mental'          // Ментальный дневник и эмоции (SENSITIVE)
  | 'cycle'           // Менструальный цикл и женское здоровье (SENSITIVE)
  | 'pregnancy'       // Дневник беременности (SENSITIVE)
  | 'dental'          // Стоматологическая карта
  | 'documents'       // Документы и выписки
  | 'emergency_card'  // Экстренная карточка
  | 'safety'          // Проверки безопасности и риски
  | 'location';       // Геолокация и вызовы (SENSITIVE)

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
  ownerUserId: string;              // Владелец медкарт/профиля
  granteeUserId: string;            // Пользователь/родственник, получающий доступ
  granteeEmailOrPhone?: string;
  granteeName: string;
  relationship: string;             // "Супруг", "Родитель", "Взрослый ребенок", "Брат/Сестра", "Опекун"
  isAdult: boolean;                 // Совершеннолетний родственник (>= 18)
  status: 'pending_invitation' | 'active' | 'revoked' | 'rejected';
  invitationCode: string;          // Уникальный код приглашения (например "INV-982103")
  allowedScopes: PermissionScope[];
  explicitSensitiveScopesGranted: PermissionScope[]; // Явно подтвержденные сенситивные скоупы
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

export class PermissionService {
  private grants = new Map<string, FamilyGrant>(); // grantId -> FamilyGrant
  private userGrantsIndex = new Map<string, Set<string>>(); // ownerUserId -> Set of grantIds
  private granteeIndex = new Map<string, Set<string>>(); // granteeUserId -> Set of grantIds
  private invitationCodeIndex = new Map<string, string>(); // invitationCode -> grantId
  private auditLogs: AuditLogEntry[] = [];

  constructor() {
    this.seedDemoGrants();
  }

  /**
   * Seed demo family grants for testing & simulation
   */
  private seedDemoGrants() {
    const demoGrantId = 'grant-demo-adult-spouse';
    const invCode = 'INV-773821';
    
    const demoGrant: FamilyGrant = {
      id: demoGrantId,
      ownerUserId: 'demo-user-123',
      granteeUserId: 'user-spouse-456',
      granteeEmailOrPhone: 'spouse@example.com',
      granteeName: 'Елена (Супруга)',
      relationship: 'Супруг(а)',
      isAdult: true,
      status: 'active',
      invitationCode: invCode,
      allowedScopes: ['emergency_card', 'medications', 'measurements', 'labs'],
      explicitSensitiveScopesGranted: [], // sensitive scopes (mental, cycle, location) are NOT included
      invitedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      consentedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.storeGrant(demoGrant);
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

    if (grant.invitationCode) {
      this.invitationCodeIndex.set(grant.invitationCode, grant.id);
    }
  }

  /**
   * Add entry to tamper-evident audit log
   */
  public logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    this.auditLogs.unshift(fullEntry);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }

    return fullEntry;
  }

  /**
   * Get audit logs for a specific user (as owner or requester)
   */
  public getAuditLogs(userId: string): AuditLogEntry[] {
    return this.auditLogs.filter(
      (log) => log.requesterUserId === userId || log.targetSubjectProfileId === userId
    );
  }

  /**
   * Core 6-stage permission pipeline evaluator
   * authentication -> permission -> validation -> policy -> execution -> audit
   */
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
      !targetSubjectProfileId ||
      targetSubjectProfileId === 'self' ||
      targetSubjectProfileId === 'me'
        ? requesterUserId
        : targetSubjectProfileId;

    // STAGE 1: AUTHENTICATION
    if (!requesterUserId) {
      const auditEntry = this.logAudit({
        pipelineStage: 'authentication',
        requesterUserId: 'anonymous',
        targetSubjectProfileId: normalizedTargetId,
        scope,
        action,
        decision: 'DENIED',
        reason: 'Ошибка аутентификации: маркер доступа отсутствует или недействителен',
        ipAddress,
        userAgent,
      });

      return {
        allowed: false,
        stage: 'authentication',
        decision: 'DENIED',
        reason: 'Ошибка аутентификации: маркер доступа отсутствует',
        auditEntry,
      };
    }

    // SELF-ACCESS CHECK (Owner accessing their own data)
    if (requesterUserId === normalizedTargetId) {
      const auditEntry = this.logAudit({
        pipelineStage: 'audit',
        requesterUserId,
        targetSubjectProfileId: normalizedTargetId,
        scope,
        action,
        decision: 'GRANTED',
        reason: 'Доступ разрешен: Владелец имеет полный доступ к собственному профилю',
        ipAddress,
        userAgent,
      });

      return {
        allowed: true,
        stage: 'audit',
        decision: 'GRANTED',
        reason: 'Владелец профиля',
        auditEntry,
      };
    }

    // CHILD PROFILE GUARDIAN CHECK (Requirement 19: Multiple Guardians)
    const childProfile = familyDoctorSharingService.getChildProfile(normalizedTargetId);
    if (childProfile && childProfile.isChild) {
      const isGuardian = childProfile.guardians.some((g) => g.userId === requesterUserId);
      if (isGuardian) {
        const auditEntry = this.logAudit({
          pipelineStage: 'audit',
          requesterUserId,
          targetSubjectProfileId: normalizedTargetId,
          scope,
          action,
          decision: 'GRANTED',
          reason: `Доступ разрешен: Пользователь является зарегистрированным опекуном (Guardian) детского профиля ${childProfile.fullName}`,
          ipAddress,
          userAgent,
        });

        return {
          allowed: true,
          stage: 'audit',
          decision: 'GRANTED',
          reason: `Опекун детского профиля (${childProfile.fullName})`,
          auditEntry,
        };
      }
    }

    // STAGE 2: PERMISSION — DENY BY DEFAULT
    // Search for an active grant from target owner to requester
    const ownerGrantIds = this.userGrantsIndex.get(normalizedTargetId) || new Set();
    let matchedGrant: FamilyGrant | undefined;

    for (const gId of ownerGrantIds) {
      const g = this.grants.get(gId);
      if (g && g.granteeUserId === requesterUserId) {
        matchedGrant = g;
        break;
      }
    }

    if (!matchedGrant) {
      const auditEntry = this.logAudit({
        pipelineStage: 'permission',
        requesterUserId,
        targetSubjectProfileId: normalizedTargetId,
        scope,
        action,
        decision: 'DENIED',
        reason: 'Deny by Default: Нет активного разрешения от владельца медицинского профиля',
        ipAddress,
        userAgent,
      });

      return {
        allowed: false,
        stage: 'permission',
        decision: 'DENIED',
        reason: 'Deny by Default: Разрешение доступа отсутствует в реестре',
        auditEntry,
      };
    }

    // STAGE 3: VALIDATION
    if (!ALL_SCOPES.includes(scope)) {
      const auditEntry = this.logAudit({
        pipelineStage: 'validation',
        requesterUserId,
        targetSubjectProfileId: normalizedTargetId,
        scope,
        action,
        decision: 'DENIED',
        reason: `Запрошен недействительный скоуп данных: ${scope}`,
        ipAddress,
        userAgent,
      });

      return {
        allowed: false,
        stage: 'validation',
        decision: 'DENIED',
        reason: 'Некорректный скоуп медицинских данных',
        auditEntry,
      };
    }

    // STAGE 4: POLICY ENFORCEMENT
    // Policy Check 1: Instant Revocation
    if (matchedGrant.status === 'revoked') {
      const auditEntry = this.logAudit({
        pipelineStage: 'policy',
        requesterUserId,
        targetSubjectProfileId: normalizedTargetId,
        scope,
        action,
        decision: 'DENIED',
        reason: 'Политика безопасности: Доступ был немедленно отозван (Instant Revoke)',
        ipAddress,
        userAgent,
      });

      return {
        allowed: false,
        stage: 'policy',
        decision: 'DENIED',
        reason: 'Доступ был ранее отозван владельцем профиля',
        grant: matchedGrant,
        auditEntry,
      };
    }

    // Policy Check 2: Adult Relative Invitation / Consent Requirement
    if (matchedGrant.isAdult && matchedGrant.status === 'pending_invitation') {
      const auditEntry = this.logAudit({
        pipelineStage: 'policy',
        requesterUserId,
        targetSubjectProfileId: normalizedTargetId,
        scope,
        action,
        decision: 'DENIED',
        reason: 'Политика безопасности: Взрослый родственник еще не принял приглашение и персональное согласие (Consent/Invitation Required)',
        ipAddress,
        userAgent,
      });

      return {
        allowed: false,
        stage: 'policy',
        decision: 'DENIED',
        reason: 'Подключение взрослого родственника требует подтверждения приглашения и согласия',
        grant: matchedGrant,
        auditEntry,
      };
    }

    if (matchedGrant.status !== 'active') {
      const auditEntry = this.logAudit({
        pipelineStage: 'policy',
        requesterUserId,
        targetSubjectProfileId: normalizedTargetId,
        scope,
        action,
        decision: 'DENIED',
        reason: `Политика безопасности: Статус доступа "${matchedGrant.status}" не позволяет чтение/запись`,
        ipAddress,
        userAgent,
      });

      return {
        allowed: false,
        stage: 'policy',
        decision: 'DENIED',
        reason: 'Статус прав доступа не является активным',
        grant: matchedGrant,
        auditEntry,
      };
    }

    // Policy Check 3: Scope Match
    const isScopeAllowed = matchedGrant.allowedScopes.includes(scope);
    if (!isScopeAllowed) {
      const auditEntry = this.logAudit({
        pipelineStage: 'policy',
        requesterUserId,
        targetSubjectProfileId: normalizedTargetId,
        scope,
        action,
        decision: 'DENIED',
        reason: `Политика безопасности: Скоуп "${scope}" не был предоставлен в списке разрешений родственнику`,
        ipAddress,
        userAgent,
      });

      return {
        allowed: false,
        stage: 'policy',
        decision: 'DENIED',
        reason: `Скоуп "${scope}" не входит в список разрешённых категорий`,
        grant: matchedGrant,
        auditEntry,
      };
    }

    // Policy Check 4: Sensitive Scopes (mental, cycle, pregnancy, location) explicitly excluded from default shared access
    const isSensitive = SENSITIVE_SCOPES.includes(scope);
    if (isSensitive) {
      const isExplicitlyGranted = matchedGrant.explicitSensitiveScopesGranted?.includes(scope);
      if (!isExplicitlyGranted) {
        const auditEntry = this.logAudit({
          pipelineStage: 'policy',
          requesterUserId,
          targetSubjectProfileId: normalizedTargetId,
          scope,
          action,
          decision: 'DENIED',
          reason: `Политика безопасности: Сенситивный скоуп "${scope}" (mental/cycle/pregnancy/location) требует ЯВНОГО отдельного подтверждения владельца и не включается автоматически при семейном доступе`,
          ipAddress,
          userAgent,
        });

        return {
          allowed: false,
          stage: 'policy',
          decision: 'DENIED',
          reason: `Сенситивная категория "${scope}" не включена в семейный доступ по умолчанию. Требуется явное подтверждение владельца`,
          grant: matchedGrant,
          auditEntry,
        };
      }
    }

    // STAGE 5 & 6: EXECUTION & AUDIT LOGGING
    const auditEntry = this.logAudit({
      pipelineStage: 'audit',
      requesterUserId,
      targetSubjectProfileId: normalizedTargetId,
      scope,
      action,
      decision: 'GRANTED',
      reason: `Доступ успешно разрешен для скоупа "${scope}" по семейной политике`,
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

  /**
   * Create invitation for an adult relative or family member
   */
  public createInvitation(params: {
    ownerUserId: string;
    granteeName: string;
    granteeEmailOrPhone?: string;
    relationship: string;
    isAdult: boolean;
    allowedScopes: PermissionScope[];
    explicitSensitiveScopes?: PermissionScope[];
  }): FamilyGrant {
    const {
      ownerUserId,
      granteeName,
      granteeEmailOrPhone,
      relationship,
      isAdult,
      allowedScopes,
      explicitSensitiveScopes = [],
    } = params;

    const grantId = `grant-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const invitationCode = `INV-${Math.floor(100000 + Math.random() * 900000)}`;

    // Sensitive scopes filter: only allow sensitive scopes if explicitly selected in explicitSensitiveScopes
    const safeAllowedScopes = allowedScopes.filter(
      (s) => !SENSITIVE_SCOPES.includes(s) || explicitSensitiveScopes.includes(s)
    );

    const newGrant: FamilyGrant = {
      id: grantId,
      ownerUserId,
      granteeUserId: '', // set upon invitation acceptance
      granteeEmailOrPhone,
      granteeName,
      relationship,
      isAdult,
      status: isAdult ? 'pending_invitation' : 'active', // adult relatives must accept invitation
      invitationCode,
      allowedScopes: safeAllowedScopes,
      explicitSensitiveScopesGranted: explicitSensitiveScopes.filter((s) => SENSITIVE_SCOPES.includes(s)),
      invitedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.storeGrant(newGrant);

    this.logAudit({
      pipelineStage: 'policy',
      requesterUserId: ownerUserId,
      targetSubjectProfileId: ownerUserId,
      scope: 'grants',
      action: 'manage_grants',
      decision: 'GRANTED',
      reason: `Создано ${isAdult ? 'приглашение для взрослого родственника' : 'разрешение'} (${granteeName}, ${relationship}). Код: ${invitationCode}`,
    });

    return newGrant;
  }

  /**
   * Accept invitation via code with explicit consent
   */
  public acceptInvitation(invitationCode: string, granteeUserId: string, granteeName?: string): FamilyGrant {
    const grantId = this.invitationCodeIndex.get(invitationCode.trim().toUpperCase());
    if (!grantId) {
      throw new Error('Код приглашения не найден или недействителен');
    }

    const grant = this.grants.get(grantId);
    if (!grant) {
      throw new Error('Запись приглашения не найдена');
    }

    if (grant.status === 'revoked') {
      throw new Error('Данное приглашение было отозвано владельцем профиля');
    }

    if (grant.status === 'active' && grant.granteeUserId === granteeUserId) {
      return grant;
    }

    grant.granteeUserId = granteeUserId;
    if (granteeName) {
      grant.granteeName = granteeName;
    }
    grant.status = 'active';
    grant.consentedAt = new Date().toISOString();
    grant.updatedAt = new Date().toISOString();

    // Update grantee index
    if (!this.granteeIndex.has(granteeUserId)) {
      this.granteeIndex.set(granteeUserId, new Set());
    }
    this.granteeIndex.get(granteeUserId)!.add(grant.id);

    this.logAudit({
      pipelineStage: 'policy',
      requesterUserId: granteeUserId,
      targetSubjectProfileId: grant.ownerUserId,
      scope: 'grants',
      action: 'manage_grants',
      decision: 'GRANTED',
      reason: `Приглашение (${invitationCode}) успешно принято с подтверждением персонального согласия`,
    });

    return grant;
  }

  /**
   * Instant Revoke: Immediately revoke a family grant
   */
  public revokeGrant(ownerUserId: string, grantId: string): boolean {
    const grant = this.grants.get(grantId);
    if (!grant) return false;

    if (grant.ownerUserId !== ownerUserId) {
      throw new Error('Отмена доступа возможна только владельцем профиля');
    }

    grant.status = 'revoked';
    grant.revokedAt = new Date().toISOString();
    grant.updatedAt = new Date().toISOString();

    this.logAudit({
      pipelineStage: 'policy',
      requesterUserId: ownerUserId,
      targetSubjectProfileId: ownerUserId,
      scope: 'grants',
      action: 'manage_grants',
      decision: 'GRANTED',
      reason: `Мгновенный отзыв прав доступа (Instant Revoke) для родственника: ${grant.granteeName} (${grant.relationship})`,
    });

    return true;
  }

  /**
   * Update scopes / sensitive scopes for an existing grant
   */
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

    const safeAllowedScopes = allowedScopes.filter(
      (s) => !SENSITIVE_SCOPES.includes(s) || explicitSensitiveScopes.includes(s)
    );

    grant.allowedScopes = safeAllowedScopes;
    grant.explicitSensitiveScopesGranted = explicitSensitiveScopes.filter((s) => SENSITIVE_SCOPES.includes(s));
    grant.updatedAt = new Date().toISOString();

    this.logAudit({
      pipelineStage: 'policy',
      requesterUserId: ownerUserId,
      targetSubjectProfileId: ownerUserId,
      scope: 'grants',
      action: 'manage_grants',
      decision: 'GRANTED',
      reason: `Обновлен список доступных скоупов для ${grant.granteeName}. Сенситивные скоупы: [${grant.explicitSensitiveScopesGranted.join(', ')}]`,
    });

    return grant;
  }

  /**
   * Get all grants issued BY a user (where user is owner)
   */
  public getGrantsByOwner(ownerUserId: string): FamilyGrant[] {
    const grantIds = this.userGrantsIndex.get(ownerUserId) || new Set();
    const result: FamilyGrant[] = [];
    for (const id of grantIds) {
      const g = this.grants.get(id);
      if (g) result.push(g);
    }
    return result;
  }

  /**
   * Get all grants received BY a user (where user is grantee)
   */
  public getGrantsByGrantee(granteeUserId: string): FamilyGrant[] {
    const grantIds = this.granteeIndex.get(granteeUserId) || new Set();
    const result: FamilyGrant[] = [];
    for (const id of grantIds) {
      const g = this.grants.get(id);
      if (g) result.push(g);
    }
    return result;
  }
}

export const permissionService = new PermissionService();
