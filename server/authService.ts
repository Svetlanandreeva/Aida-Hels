import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { canonicalDataLayer } from './canonicalDataLayer';

function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET or JWT_SECRET must be configured before creating authenticated sessions');
  }
  return secret;
}

export interface UserSessionInfo {
  sessionId: string;
  userId: string;
  token: string;
  ipAddress: string;
  userAgent: string;
  deviceName: string;
  createdAt: string;
  lastActiveAt: string;
  isRevoked: boolean;
}

export interface PasswordRecoveryRecord {
  emailOrPhone: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

export interface RecoveryRequestResult {
  expiresAt: number;
  deliveryRequired: true;
}

export interface OnboardingStatus {
  isCompleted: boolean;
  currentStep: string;
  completedSteps: string[];
}

export interface FeatureFlags {
  enableAIInsights: boolean;
  enableWearables: boolean;
  enableDentalSuite: boolean;
  enableCloudSync: boolean;
  enableMFA: boolean;
}

export class AuthService {
  private sessions = new Map<string, UserSessionInfo>();
  private userSessionsMap = new Map<string, Set<string>>();
  private recoveryRequests = new Map<string, PasswordRecoveryRecord>();

  private parseDeviceName(userAgent: string): string {
    if (!userAgent) return 'Неизвестное устройство';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'Apple iOS Device';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Macintosh')) return 'Mac OS Computer';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Linux')) return 'Linux Workstation';
    return 'Веб-браузер';
  }

  public createSession(
    userId: string,
    reqContext: { ip: string; userAgent: string; email: string; fullName?: string }
  ): UserSessionInfo {
    if (!userId || !reqContext.email) {
      throw new Error('Cannot create an authenticated session without a real user id and email');
    }

    const sessionId = `sess-${crypto.randomUUID()}`;
    const token = jwt.sign(
      { id: userId, email: reqContext.email, fullName: reqContext.fullName, sessionId },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    const session: UserSessionInfo = {
      sessionId,
      userId,
      token,
      ipAddress: reqContext.ip || '',
      userAgent: reqContext.userAgent || '',
      deviceName: this.parseDeviceName(reqContext.userAgent || ''),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isRevoked: false,
    };

    this.sessions.set(sessionId, session);

    if (!this.userSessionsMap.has(userId)) {
      this.userSessionsMap.set(userId, new Set());
    }
    this.userSessionsMap.get(userId)!.add(sessionId);

    return session;
  }

  /**
   * Creates a recovery challenge without returning the raw OTP to API callers.
   * The delivery layer must send the raw code to the verified destination.
   */
  public requestRecovery(emailOrPhone: string): RecoveryRequestResult {
    const norm = emailOrPhone.trim().toLowerCase();
    if (!norm) throw new Error('Email или телефон обязателен');

    const rawCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000;

    this.recoveryRequests.set(norm, {
      emailOrPhone: norm,
      codeHash,
      expiresAt,
      attempts: 0,
    });

    // Intentionally do not expose rawCode. A mail/SMS adapter must deliver it.
    return { expiresAt, deliveryRequired: true };
  }

  /**
   * Validates recovery challenge. Password persistence belongs to the account store.
   */
  public async confirmRecovery(emailOrPhone: string, code: string, _newPassword: string): Promise<boolean> {
    const norm = emailOrPhone.trim().toLowerCase();
    const record = this.recoveryRequests.get(norm);

    if (!record || Date.now() > record.expiresAt) {
      this.recoveryRequests.delete(norm);
      throw new Error('Срок действия кода восстановления истёк или код не запрашивался');
    }

    if (record.attempts >= 3) {
      this.recoveryRequests.delete(norm);
      throw new Error('Превышено количество попыток ввода кода восстановления');
    }

    const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(inputHash, 'hex');
    const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!matches) {
      record.attempts += 1;
      if (record.attempts >= 3) this.recoveryRequests.delete(norm);
      throw new Error(`Неверный код восстановления. Осталось попыток: ${Math.max(0, 3 - record.attempts)}`);
    }

    this.recoveryRequests.delete(norm);
    return true;
  }

  public revokeSession(userId: string, sessionIdToRevoke: string): boolean {
    const session = this.sessions.get(sessionIdToRevoke);
    if (!session || session.userId !== userId) return false;

    session.isRevoked = true;
    this.sessions.delete(sessionIdToRevoke);
    this.userSessionsMap.get(userId)?.delete(sessionIdToRevoke);
    return true;
  }

  public revokeAllSessions(userId: string, keepCurrentSessionId?: string): number {
    const sessionIds = this.userSessionsMap.get(userId);
    if (!sessionIds) return 0;

    let revokedCount = 0;
    for (const sid of Array.from(sessionIds)) {
      if (keepCurrentSessionId && sid === keepCurrentSessionId) continue;
      const session = this.sessions.get(sid);
      if (session) {
        session.isRevoked = true;
        this.sessions.delete(sid);
      }
      sessionIds.delete(sid);
      revokedCount++;
    }
    return revokedCount;
  }

  public isSessionActive(sessionId: string, userId?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.isRevoked) return false;
    return !userId || session.userId === userId;
  }

  public touchSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.isRevoked) return false;
    session.lastActiveAt = new Date().toISOString();
    return true;
  }

  /**
   * Builds GET /session without fabricating email, dates, names, verification,
   * profile identifiers or family members when source records are missing.
   */
  public async buildSessionResponse(userId: string, currentToken?: string, activeSubjectProfileId?: string) {
    const userData = await canonicalDataLayer.getUserData(userId);
    const profile = userData?.profile || {};

    const account = {
      id: userId,
      email: profile.email ?? null,
      fullName: profile.fullName ?? profile.name ?? null,
      isVerified: profile.isVerified === true,
      mfaEnabled: profile.mfaEnabled === true,
      createdAt: profile.createdAt ?? null,
      updatedAt: userData?.updatedAt ?? null,
    };

    const selfProfile = {
      id: `sp-primary-${userId}`,
      accountId: userId,
      type: 'self' as const,
      fullName: profile.fullName ?? profile.name ?? null,
      relationship: 'self',
      birthDate: profile.birthDate ?? null,
      gender: profile.gender ?? null,
      bloodType: profile.bloodType ?? null,
      heightCm: profile.heightCm ?? profile.height ?? null,
      weightKg: profile.weightKg ?? profile.weight ?? null,
      createdAt: profile.createdAt ?? null,
      updatedAt: userData?.updatedAt ?? null,
    };

    const storedRelatedProfiles = Array.isArray(userData?.subjectProfiles)
      ? userData.subjectProfiles
      : Array.isArray((userData as any)?.familyProfiles)
        ? (userData as any).familyProfiles
        : [];

    const relatedProfiles = storedRelatedProfiles
      .filter((p: any) => p?.id)
      .map((p: any) => ({
        id: p.id,
        accountId: userId,
        type: p.type ?? null,
        fullName: p.fullName ?? p.name ?? null,
        relationship: p.relationship ?? null,
        birthDate: p.birthDate ?? null,
        gender: p.gender ?? null,
        createdAt: p.createdAt ?? null,
        updatedAt: p.updatedAt ?? null,
      }));

    const availableProfiles = [selfProfile, ...relatedProfiles];
    const activeProfile =
      availableProfiles.find((p) => p.id === activeSubjectProfileId) || selfProfile;

    const onboardingStatus: OnboardingStatus = {
      isCompleted: Boolean(profile.fullName && profile.birthDate),
      currentStep: profile.fullName && profile.birthDate ? 'completed' : 'profile_setup',
      completedSteps: [
        'registration',
        ...(profile.consentPersonalData === true && profile.consentMedicalData === true ? ['consents'] : []),
        ...(profile.fullName && profile.birthDate ? ['profile_setup'] : []),
      ],
    };

    const featureFlags: FeatureFlags = {
      enableAIInsights: true,
      enableWearables: true,
      enableDentalSuite: true,
      enableCloudSync: true,
      enableMFA: false,
    };

    const userSessionIds = Array.from(this.userSessionsMap.get(userId) || []);
    const activeSessions = userSessionIds
      .map((sid) => this.sessions.get(sid))
      .filter((s): s is UserSessionInfo => Boolean(s && !s.isRevoked))
      .map((s) => ({
        sessionId: s.sessionId,
        deviceName: s.deviceName,
        ipAddress: s.ipAddress || null,
        isCurrent: Boolean(currentToken && s.token === currentToken),
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
      }));

    return {
      authenticated: true,
      account,
      activeProfile,
      availableProfiles,
      onboardingStatus,
      featureFlags,
      activeSessions,
      userData,
    };
  }
}

export const authService = new AuthService();