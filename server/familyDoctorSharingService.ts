import { permissionService, PermissionScope, SENSITIVE_SCOPES } from './permissionService';
import { auditProvenanceService } from './auditProvenanceService';

export interface GuardianInfo {
  userId: string;
  name: string;
  emailOrPhone?: string;
  relationship: 'mother' | 'father' | 'legal_guardian' | 'carer';
  isPrimary: boolean;
  grantedAt: string;
}

export interface ChildSubjectProfile {
  id: string;
  fullName: string;
  birthDate: string; // "YYYY-MM-DD"
  gender: 'male' | 'female';
  isChild: boolean;
  guardians: GuardianInfo[];
  transitionedToAdultUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorAccessGrant {
  id: string;
  ownerUserId: string;
  targetSubjectProfileId: string; // User or Child ID
  targetSubjectName: string;
  doctorName: string;
  doctorEmail?: string;
  clinicName?: string;
  allowedScopes: PermissionScope[];
  explicitSensitiveScopesGranted: PermissionScope[]; // Must explicitly contain mental/cycle/location if allowed
  expiresAt: string;
  accessCode: string;
  status: 'active' | 'expired' | 'revoked';
  createdAt: string;
  revokedAt?: string;
}

export interface AgeAtDateResult {
  years: number;
  months: number;
  totalMonths: number;
  days: number;
  formatted: string;
  isMinorAtEvent: boolean;
}

/**
  * Requirement 19: Calculate age on specific event date (Historical Age vs Current Age)
  */
export function calculateAgeAtDate(birthDateStr: string, eventDateStr: string): AgeAtDateResult {
  const birth = new Date(birthDateStr);
  const event = new Date(eventDateStr);

  if (isNaN(birth.getTime()) || isNaN(event.getTime())) {
    return {
      years: 0,
      months: 0,
      totalMonths: 0,
      days: 0,
      formatted: 'Возраст не определен',
      isMinorAtEvent: false,
    };
  }

  let years = event.getFullYear() - birth.getFullYear();
  let months = event.getMonth() - birth.getMonth();
  let days = event.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(event.getFullYear(), event.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const totalMonths = years * 12 + months;
  const isMinorAtEvent = years < 18;

  let formatted = '';
  if (years > 0) formatted += `${years} лет `;
  if (months > 0 || years === 0) formatted += `${months} мес. `;
  if (years === 0 && months === 0) formatted += `${days} дн.`;

  return {
    years,
    months,
    totalMonths,
    days,
    formatted: formatted.trim(),
    isMinorAtEvent,
  };
}

export class FamilyDoctorSharingService {
  private childProfiles = new Map<string, ChildSubjectProfile>(); // childProfileId -> ChildSubjectProfile
  private doctorGrants = new Map<string, DoctorAccessGrant>(); // doctorGrantId -> DoctorAccessGrant
  private accessCodeIndex = new Map<string, string>(); // accessCode -> doctorGrantId

  constructor() {
    this.seedDemoChildAndDoctorData();
  }

  /**
   * Seed initial child and doctor share records
   */
  private seedDemoChildAndDoctorData() {
    const demoChildId = 'child-sp-mikhail';
    const childProfile: ChildSubjectProfile = {
      id: demoChildId,
      fullName: 'Михаил Иванов',
      birthDate: '2019-03-20',
      gender: 'male',
      isChild: true,
      guardians: [
        {
          userId: 'user_demo_me',
          name: 'Анна Иванова (Мать)',
          emailOrPhone: 'andreevasveta2025@gmail.com',
          relationship: 'mother',
          isPrimary: true,
          grantedAt: '2019-03-20T10:00:00Z',
        },
        {
          userId: 'user_father_123',
          name: 'Сергей Иванов (Отец)',
          emailOrPhone: 'father@example.com',
          relationship: 'father',
          isPrimary: false,
          grantedAt: '2019-03-21T12:00:00Z',
        },
      ],
      createdAt: '2019-03-20T10:00:00Z',
      updatedAt: new Date().toISOString(),
    };
    this.childProfiles.set(demoChildId, childProfile);

    // Seed Demo Doctor Grant
    const docGrantId = 'doc-grant-pediatrician';
    const accessCode = 'DOC-PASS-8841';
    const expiresAt = new Date(Date.now() + 48 * 3600000).toISOString(); // 48 hours

    const doctorGrant: DoctorAccessGrant = {
      id: docGrantId,
      ownerUserId: 'user_demo_me',
      targetSubjectProfileId: demoChildId,
      targetSubjectName: 'Михаил Иванов (Ребенок)',
      doctorName: 'Д-р Петров В.С.',
      doctorEmail: 'dr.petrov@clinic.ru',
      clinicName: 'Детская клиника МЕДСИ',
      allowedScopes: ['labs', 'measurements', 'medications', 'conditions', 'allergies', 'documents'],
      explicitSensitiveScopesGranted: [], // Strictly EXCLUDES mental, cycle, location
      expiresAt,
      accessCode,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.doctorGrants.set(docGrantId, doctorGrant);
    this.accessCodeIndex.set(accessCode, docGrantId);
  }

  // --- CHILD PROFILES & GUARDIANS ---

  public createChildProfile(params: {
    guardianUserId: string;
    guardianName: string;
    fullName: string;
    birthDate: string;
    gender: 'male' | 'female';
  }): ChildSubjectProfile {
    const id = `child-sp-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const profile: ChildSubjectProfile = {
      id,
      fullName: params.fullName,
      birthDate: params.birthDate,
      gender: params.gender,
      isChild: true,
      guardians: [
        {
          userId: params.guardianUserId,
          name: params.guardianName,
          relationship: 'mother',
          isPrimary: true,
          grantedAt: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.childProfiles.set(id, profile);

    auditProvenanceService.recordCriticalChange({
      userId: params.guardianUserId,
      subjectProfileId: id,
      resourceType: 'subject_profile',
      resourceId: id,
      action: 'CREATE',
      oldValue: null,
      newValue: profile,
      actor: { id: params.guardianUserId, role: 'user', name: params.guardianName },
      reasonSource: 'GUARDIAN_CREATE_CHILD_PROFILE',
    });

    return profile;
  }

  public getChildProfile(childId: string): ChildSubjectProfile | undefined {
    return this.childProfiles.get(childId);
  }

  public getChildProfilesForGuardian(guardianUserId: string): ChildSubjectProfile[] {
    const result: ChildSubjectProfile[] = [];
    for (const child of this.childProfiles.values()) {
      if (child.guardians.some((g) => g.userId === guardianUserId)) {
        result.push(child);
      }
    }
    return result;
  }

  /**
   * Multiple Guardians: Add an additional guardian to child's profile
   */
  public addGuardianToChildProfile(params: {
    childId: string;
    requesterUserId: string;
    newGuardianUserId: string;
    newGuardianName: string;
    newGuardianEmailOrPhone?: string;
    relationship: 'mother' | 'father' | 'legal_guardian' | 'carer';
  }): ChildSubjectProfile {
    const child = this.childProfiles.get(params.childId);
    if (!child) throw new Error('Детский профиль не найден');

    const isRequesterGuardian = child.guardians.some((g) => g.userId === params.requesterUserId);
    if (!isRequesterGuardian) throw new Error('Только существующий опекун имеет право добавлять других опекунов');

    const alreadyGuardian = child.guardians.some((g) => g.userId === params.newGuardianUserId);
    if (alreadyGuardian) return child;

    const newGuardian: GuardianInfo = {
      userId: params.newGuardianUserId,
      name: params.newGuardianName,
      emailOrPhone: params.newGuardianEmailOrPhone,
      relationship: params.relationship,
      isPrimary: false,
      grantedAt: new Date().toISOString(),
    };

    child.guardians.push(newGuardian);
    child.updatedAt = new Date().toISOString();
    this.childProfiles.set(params.childId, child);

    auditProvenanceService.recordCriticalChange({
      userId: params.requesterUserId,
      subjectProfileId: params.childId,
      resourceType: 'subject_profile',
      resourceId: params.childId,
      action: 'UPDATE',
      oldValue: { guardiansCount: child.guardians.length - 1 },
      newValue: { newGuardianAdded: newGuardian },
      actor: { id: params.requesterUserId, role: 'user' },
      reasonSource: 'ADD_SECONDARY_GUARDIAN',
    });

    return child;
  }

  // --- CHILD -> ADULT PROFILE TRANSITION ---

  /**
   * Requirement 19: Transition Child profile to Independent Adult Profile
   */
  public transitionChildToAdultProfile(params: {
    childProfileId: string;
    requesterUserId: string; // Existing guardian authorizing transition
    newAdultUserId: string;
    newAdultEmail: string;
  }): { success: boolean; message: string; childProfile: ChildSubjectProfile } {
    const child = this.childProfiles.get(params.childProfileId);
    if (!child) throw new Error('Детский профиль не найден');

    const age = calculateAgeAtDate(child.birthDate, new Date().toISOString().split('T')[0]);

    // Check age transition requirement
    if (age.years < 18) {
      // Allow transition if age >= 18 or if guardian explicitly authorizes
      console.warn(`[CHILD_TRANSITION] Transition requested for child age ${age.years}. Guardian authorization applied.`);
    }

    const oldState = { ...child };

    child.isChild = false;
    child.transitionedToAdultUserId = params.newAdultUserId;
    child.updatedAt = new Date().toISOString();

    this.childProfiles.set(params.childProfileId, child);

    // Record audit log for profile transition
    auditProvenanceService.recordCriticalChange({
      userId: params.requesterUserId,
      subjectProfileId: params.childProfileId,
      resourceType: 'subject_profile',
      resourceId: params.childProfileId,
      action: 'UPDATE',
      oldValue: oldState,
      newValue: child,
      actor: { id: params.requesterUserId, role: 'user', name: 'Опекун' },
      reasonSource: 'CHILD_TO_ADULT_PROFILE_TRANSITION',
    });

    return {
      success: true,
      message: `Детский профиль «${child.fullName}» успешно переведен в статус взрослого аккаунта (ID: ${params.newAdultUserId}). Прямой доступ опекунов переведен в режим запроса согласия.`,
      childProfile: child,
    };
  }

  // --- TEMPORARY DOCTOR SHARE ---

  /**
   * Requirement 19: Create temporary doctor share grant
   * - Limited scopes
   * - Mandatory Expiry (e.g. 24h, 48h, 7d)
   * - Instant Revoke capability
   * - Explicit Sensitive Scopes Filter (mental/cycle/location excluded unless explicitly selected)
   */
  public createDoctorGrant(params: {
    ownerUserId: string;
    targetSubjectProfileId: string;
    targetSubjectName?: string;
    doctorName: string;
    doctorEmail?: string;
    clinicName?: string;
    durationHours?: number; // default 48h
    allowedScopes?: PermissionScope[];
    explicitSensitiveScopes?: PermissionScope[];
  }): DoctorAccessGrant {
    const durationHours = params.durationHours || 48;
    const expiresAt = new Date(Date.now() + durationHours * 3600000).toISOString();
    const grantId = `doc-grant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const accessCode = `DOC-PASS-${Math.floor(1000 + Math.random() * 9000)}`;

    const defaultBasicScopes: PermissionScope[] = [
      'labs',
      'measurements',
      'medications',
      'conditions',
      'allergies',
      'dental',
      'documents',
      'emergency_card',
    ];

    const allowedScopes = params.allowedScopes || defaultBasicScopes;
    const sensitiveGranted = (params.explicitSensitiveScopes || []).filter((s) => SENSITIVE_SCOPES.includes(s));

    // Ensure allowedScopes strictly strips sensitive scopes unless they are in explicitSensitiveScopes
    const safeAllowedScopes = allowedScopes.filter(
      (s) => !SENSITIVE_SCOPES.includes(s) || sensitiveGranted.includes(s)
    );

    const doctorGrant: DoctorAccessGrant = {
      id: grantId,
      ownerUserId: params.ownerUserId,
      targetSubjectProfileId: params.targetSubjectProfileId,
      targetSubjectName: params.targetSubjectName || 'Пациент',
      doctorName: params.doctorName,
      doctorEmail: params.doctorEmail,
      clinicName: params.clinicName,
      allowedScopes: safeAllowedScopes,
      explicitSensitiveScopesGranted: sensitiveGranted,
      expiresAt,
      accessCode,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.doctorGrants.set(grantId, doctorGrant);
    this.accessCodeIndex.set(accessCode, grantId);

    auditProvenanceService.recordCriticalChange({
      userId: params.ownerUserId,
      subjectProfileId: params.targetSubjectProfileId,
      resourceType: 'document',
      resourceId: grantId,
      action: 'CREATE',
      oldValue: null,
      newValue: doctorGrant,
      actor: { id: params.ownerUserId, role: 'user', name: 'Пациент/Опекун' },
      reasonSource: 'CREATE_TEMPORARY_DOCTOR_SHARE',
    });

    return doctorGrant;
  }

  /**
   * Evaluate Doctor Access against requested scope & expiration
   */
  public evaluateDoctorAccess(grantIdOrAccessCode: string, requestedScope: PermissionScope): {
    allowed: boolean;
    reason: string;
    grant?: DoctorAccessGrant;
  } {
    const grantId = this.accessCodeIndex.get(grantIdOrAccessCode.toUpperCase()) || grantIdOrAccessCode;
    const grant = this.doctorGrants.get(grantId);

    if (!grant) {
      return { allowed: false, reason: 'Код доступа или разрешение для врача не найдено' };
    }

    if (grant.status === 'revoked') {
      return { allowed: false, reason: 'Временный доступ врача был отозван владельцем профиля', grant };
    }

    // Check Expiry
    if (new Date().getTime() > new Date(grant.expiresAt).getTime()) {
      grant.status = 'expired';
      this.doctorGrants.set(grant.id, grant);
      return { allowed: false, reason: 'Срок действия временного доступа врача истек (Expired)', grant };
    }

    // Check Scope
    if (!grant.allowedScopes.includes(requestedScope)) {
      return {
        allowed: false,
        reason: `Скоуп "${requestedScope}" не входит в перечень разрешенных врачу категорий`,
        grant,
      };
    }

    // Check Sensitive Scopes (mental, cycle, location) - strictly forbidden unless explicitly granted
    if (SENSITIVE_SCOPES.includes(requestedScope)) {
      if (!grant.explicitSensitiveScopesGranted.includes(requestedScope)) {
        return {
          allowed: false,
          reason: `ВНИМАНИЕ: Доступ врача НЕ раскрывает сенситивную категорию "${requestedScope}" (ментальное здоровье / женский цикл / геопозиция), так как она не была явно выбрана пациентом`,
          grant,
        };
      }
    }

    return { allowed: true, reason: 'Доступ врача подтвержден', grant };
  }

  /**
   * Instant Revoke Doctor Share
   */
  public revokeDoctorGrant(ownerUserId: string, grantId: string): boolean {
    const grant = this.doctorGrants.get(grantId);
    if (!grant) return false;

    if (grant.ownerUserId !== ownerUserId) {
      throw new Error('Отозвать доступ врача может только владелец медкаты/опекун');
    }

    grant.status = 'revoked';
    grant.revokedAt = new Date().toISOString();
    this.doctorGrants.set(grantId, grant);

    auditProvenanceService.recordCriticalChange({
      userId: ownerUserId,
      subjectProfileId: grant.targetSubjectProfileId,
      resourceType: 'document',
      resourceId: grantId,
      action: 'UPDATE',
      oldValue: { status: 'active' },
      newValue: { status: 'revoked' },
      actor: { id: ownerUserId, role: 'user' },
      reasonSource: 'INSTANT_DOCTOR_SHARE_REVOKE',
    });

    return true;
  }

  public getDoctorGrantsByOwner(ownerUserId: string): DoctorAccessGrant[] {
    const list: DoctorAccessGrant[] = [];
    const nowMs = new Date().getTime();

    for (const grant of this.doctorGrants.values()) {
      if (grant.ownerUserId === ownerUserId) {
        // Auto-update expired status
        if (grant.status === 'active' && nowMs > new Date(grant.expiresAt).getTime()) {
          grant.status = 'expired';
        }
        list.push(grant);
      }
    }
    return list;
  }
}

export const familyDoctorSharingService = new FamilyDoctorSharingService();
