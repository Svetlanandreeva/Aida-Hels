import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AccountEntity, ProfileEntity } from './schema';
import { canonicalDataLayer } from './canonicalDataLayer';

const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'helt_aida_secure_session_secret_2026';

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
  private sessions = new Map<string, UserSessionInfo>(); // sessionId -> UserSessionInfo
  private userSessionsMap = new Map<string, Set<string>>(); // userId -> Set of sessionIds
  private recoveryRequests = new Map<string, PasswordRecoveryRecord>(); // emailOrPhone -> record

  /**
   * Helper to parse user agent into a friendly device string
   */
  private parseDeviceName(userAgent: string): string {
    if (!userAgent) return 'Неизвестное устройство';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'Apple iOS Device';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Macintosh')) return 'Mac OS Computer';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Linux')) return 'Linux Workstation';
    return 'Веб-браузер';
  }

  /**
   * Create new authenticated session
   */
  public createSession(userId: string, reqContext: { ip: string; userAgent: string; email: string; fullName?: string }): UserSessionInfo {
    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const token = jwt.sign(
      { id: userId, email: reqContext.email, fullName: reqContext.fullName, sessionId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const deviceName = this.parseDeviceName(reqContext.userAgent);
    const session: UserSessionInfo = {
      sessionId,
      userId,
      token,
      ipAddress: reqContext.ip || '127.0.0.1',
      userAgent: reqContext.userAgent || '',
      deviceName,
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
   * Request password recovery OTP code
   */
  public requestRecovery(emailOrPhone: string): { code: string; expiresAt: number } {
    const norm = emailOrPhone.trim().toLowerCase();
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min TTL

    this.recoveryRequests.set(norm, {
      emailOrPhone: norm,
      codeHash,
      expiresAt,
      attempts: 0,
    });

    return { code: rawCode, expiresAt };
  }

  /**
   * Confirm password recovery and set new password
   */
  public async confirmRecovery(emailOrPhone: string, code: string, newPassword: string): Promise<boolean> {
    const norm = emailOrPhone.trim().toLowerCase();
    const record = this.recoveryRequests.get(norm);

    if (!record || Date.now() > record.expiresAt) {
      throw new Error('Срок действия кода восстановления истёк или код не запрашивался');
    }

    if (record.attempts >= 3) {
      throw new Error('Превышено количество попыток ввода кода восстановления');
    }

    const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    if (inputHash !== record.codeHash) {
      record.attempts += 1;
      throw new Error(`Неверный код восстановления. Осталось попыток: ${3 - record.attempts}`);
    }

    // OTP validated - clear recovery record
    this.recoveryRequests.delete(norm);
    return true;
  }

  /**
   * Revoke single session or device (lost device scenario)
   */
  public revokeSession(userId: string, sessionIdToRevoke: string): boolean {
    const session = this.sessions.get(sessionIdToRevoke);
    if (session && session.userId === userId) {
      session.isRevoked = true;
      this.sessions.delete(sessionIdToRevoke);
      
      const userSet = this.userSessionsMap.get(userId);
      if (userSet) {
        userSet.delete(sessionIdToRevoke);
      }
      return true;
    }
    return false;
  }

  /**
   * Revoke all user sessions except current (or all sessions)
   */
  public revokeAllSessions(userId: string, keepCurrentSessionId?: string): number {
    const sessionIds = this.userSessionsMap.get(userId);
    if (!sessionIds) return 0;

    let revokedCount = 0;
    for (const sid of Array.from(sessionIds)) {
      if (keepCurrentSessionId && sid === keepCurrentSessionId) {
        continue;
      }
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

  /**
   * Build complete GET /session payload
   */
  public async buildSessionResponse(userId: string, currentToken?: string, activeSubjectProfileId?: string) {
    const userData = await canonicalDataLayer.getUserData(userId);
    const profile = userData?.profile || {};

    const account: AccountEntity = {
      id: userId,
      email: profile.email || `${userId}@heltaida.local`,
      fullName: profile.fullName || 'Пользователь',
      passwordHash: '***',
      isVerified: profile.isVerified ?? true,
      mfaEnabled: false,
      createdAt: profile.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Profiles linked to account
    const availableProfiles: ProfileEntity[] = [
      {
        id: 'self',
        accountId: userId,
        type: 'self',
        fullName: profile.fullName || 'Главный профиль',
        relationship: 'Self',
        birthDate: profile.birthDate,
        gender: profile.gender,
        bloodType: profile.bloodType,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        createdAt: profile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...((userData?.subjectProfiles || (userData as any)?.familyProfiles || [])).map((p: any) => ({
        id: p.id || `prof-${Math.random().toString(36).substring(2, 7)}`,
        accountId: userId,
        type: p.type || 'relative',
        fullName: p.fullName || p.name || 'Член семьи',
        relationship: p.relationship || 'Родственник',
        birthDate: p.birthDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    ];

    const activeProfile = availableProfiles.find((p) => p.id === activeSubjectProfileId) || availableProfiles[0];

    const onboardingStatus: OnboardingStatus = {
      isCompleted: Boolean(profile.fullName && profile.birthDate),
      currentStep: profile.fullName ? 'completed' : 'profile_setup',
      completedSteps: ['registration', 'consents', profile.fullName ? 'profile_setup' : ''].filter(Boolean),
    };

    const featureFlags: FeatureFlags = {
      enableAIInsights: true,
      enableWearables: true,
      enableDentalSuite: true,
      enableCloudSync: true,
      enableMFA: false,
    };

    // Get active session list for lost-device management
    const userSessionIds = Array.from(this.userSessionsMap.get(userId) || []);
    const activeSessions = userSessionIds
      .map((sid) => this.sessions.get(sid))
      .filter((s): s is UserSessionInfo => Boolean(s && !s.isRevoked))
      .map((s) => ({
        sessionId: s.sessionId,
        deviceName: s.deviceName,
        ipAddress: s.ipAddress,
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
