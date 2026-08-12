import {
  getUserData as dbGetUserData,
  saveUserData as dbSaveUserData,
  deleteUser as dbDeleteUser,
  isPostgresConfigured,
} from './db';

export interface CanonicalUserData {
  profile: any;
  subjectProfiles?: any[];
  documents: any[];
  appointments: any[];
  dailyLogs: any[];
  diaryEntries: any[];
  pressureLogs: any[];
  reminders: any[];
  aiAnalysis: any;
  wearablesSyncs?: any[];
  connectedSources?: any[];
  devices?: any[];
  onboardingState?: any;
  puzzleConfig?: any[];
  updatedAt?: string;
}

export interface WearableIngestPayload {
  source: 'apple_health' | 'google_fit' | 'garmin' | 'whoop' | 'samsung_health' | 'generic';
  deviceModel?: string;
  timestamp?: string;
  subjectProfileId?: string;
  metrics: {
    heartRateBpm?: number;
    systolicBp?: number;
    diastolicBp?: number;
    pulseBpm?: number;
    sleepHours?: number;
    stressScore?: number;
    stepsCount?: number;
    spo2Percentage?: number;
  };
}

// Abstraction for Storage Adapters (PostgreSQL/YDB, Google Sheets, In-Memory)
export interface MedicalStorageAdapter {
  name: string;
  getUserData(userId: string): Promise<CanonicalUserData | null>;
  saveUserData(userId: string, data: CanonicalUserData): Promise<void>;
  deleteUserData(userId: string, email?: string): Promise<void>;
}

// In-Memory Storage Adapter Fallback
class InMemoryMedicalStorageAdapter implements MedicalStorageAdapter {
  name = 'InMemoryStorageAdapter';
  private store = new Map<string, CanonicalUserData>();

  async getUserData(userId: string): Promise<CanonicalUserData | null> {
    return this.store.get(userId) || null;
  }

  async saveUserData(userId: string, data: CanonicalUserData): Promise<void> {
    this.store.set(userId, data);
  }

  async deleteUserData(userId: string, email?: string): Promise<void> {
    this.store.delete(userId);
    if (email) {
      this.store.delete(email);
    }
  }
}

// PostgreSQL / YDB Storage Adapter Implementation
class PostgresYdbMedicalStorageAdapter implements MedicalStorageAdapter {
  name = 'PostgresYdbStorageAdapter';

  async getUserData(userId: string): Promise<CanonicalUserData | null> {
    if (!isPostgresConfigured()) return null;
    return await dbGetUserData(userId);
  }

  async saveUserData(userId: string, data: CanonicalUserData): Promise<void> {
    if (!isPostgresConfigured()) return;
    await dbSaveUserData(userId, data);
  }

  async deleteUserData(userId: string, email?: string): Promise<void> {
    if (!isPostgresConfigured()) return;
    await dbDeleteUser(userId, email);
  }
}

// Google Sheets Storage Adapter Implementation (Server-to-Server)
// Decouples business logic from Google Sheets tab names / row indices
class GoogleSheetsMedicalStorageAdapter implements MedicalStorageAdapter {
  name = 'GoogleSheetsStorageAdapter';

  private getScriptUrl(): string | null {
    const url = process.env.GOOGLE_SHEETS_WEB_APP_URL;
    if (url && url.startsWith('https://script.google.com/')) {
      return url;
    }
    return null;
  }

  async getUserData(userId: string): Promise<CanonicalUserData | null> {
    const webAppUrl = this.getScriptUrl();
    if (!webAppUrl) return null;

    try {
      const response = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getUserData', userId }),
      });
      const resData = await response.json();
      if (resData?.success && resData?.data) {
        return resData.data as CanonicalUserData;
      }
    } catch (err) {
      console.warn('[GoogleSheetsStorageAdapter] Read error:', err);
    }
    return null;
  }

  async saveUserData(userId: string, data: CanonicalUserData): Promise<void> {
    const webAppUrl = this.getScriptUrl();
    if (!webAppUrl) return;

    try {
      await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveUserData',
          userId,
          payload: data,
        }),
      });
    } catch (err) {
      console.warn('[GoogleSheetsStorageAdapter] Write error:', err);
    }
  }

  async deleteUserData(userId: string, email?: string): Promise<void> {
    const webAppUrl = this.getScriptUrl();
    if (!webAppUrl) return;

    try {
      await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteUserAccount',
          userId,
          payload: { email },
        }),
      });
    } catch (err) {
      console.warn('[GoogleSheetsStorageAdapter] Delete error:', err);
    }
  }
}

// Canonical Data Layer orchestrates storage adapters & standardizes medical schemas
export class CanonicalDataLayer {
  private inMemoryAdapter = new InMemoryMedicalStorageAdapter();
  private postgresAdapter = new PostgresYdbMedicalStorageAdapter();
  private sheetsAdapter = new GoogleSheetsMedicalStorageAdapter();

  /**
   * Retrieves canonical user medical data from configured storage adapters in priority sequence:
   * 1. PostgreSQL / YDB
   * 2. Google Sheets
   * 3. In-Memory fallback
   */
  async getUserData(userId: string): Promise<CanonicalUserData> {
    let data: CanonicalUserData | null = null;

    if (isPostgresConfigured()) {
      data = await this.postgresAdapter.getUserData(userId);
    }

    if (!data || Object.keys(data).length === 0) {
      data = await this.sheetsAdapter.getUserData(userId);
    }

    if (!data || Object.keys(data).length === 0) {
      data = await this.inMemoryAdapter.getUserData(userId);
    }

    return this.normalizeCanonicalData(data || {});
  }

  /**
   * Filter health data strictly by subject_profile_id (Self, Child, Relative)
   */
  async getSubjectHealthData(userId: string, subjectProfileId?: string): Promise<CanonicalUserData> {
    const fullData = await this.getUserData(userId);
    if (!subjectProfileId) return fullData;

    const primarySubjectId = `sp-primary-${userId}`;

    const filterCollection = (collection: any[]) => {
      if (!Array.isArray(collection)) return [];
      return collection.filter((item) => {
        if (!item) return false;
        if (!item.subject_profile_id) {
          // Legacy or unassigned items belong to primary profile
          return subjectProfileId === primarySubjectId || subjectProfileId === 'sp-default' || subjectProfileId === 'default';
        }
        return item.subject_profile_id === subjectProfileId;
      });
    };

    return {
      ...fullData,
      documents: filterCollection(fullData.documents),
      appointments: filterCollection(fullData.appointments),
      dailyLogs: filterCollection(fullData.dailyLogs),
      diaryEntries: filterCollection(fullData.diaryEntries),
      pressureLogs: filterCollection(fullData.pressureLogs),
      reminders: filterCollection(fullData.reminders),
    };
  }

  /**
   * Save medical data through storage adapters
   */
  async saveUserData(userId: string, payload: Partial<CanonicalUserData>): Promise<CanonicalUserData> {
    const currentData = await this.getUserData(userId);

    const updatedData: CanonicalUserData = {
      profile: payload.profile !== undefined ? payload.profile : currentData.profile,
      subjectProfiles: payload.subjectProfiles !== undefined ? payload.subjectProfiles : currentData.subjectProfiles,
      documents: payload.documents !== undefined ? payload.documents : currentData.documents,
      appointments: payload.appointments !== undefined ? payload.appointments : currentData.appointments,
      dailyLogs: payload.dailyLogs !== undefined ? payload.dailyLogs : currentData.dailyLogs,
      diaryEntries: payload.diaryEntries !== undefined ? payload.diaryEntries : currentData.diaryEntries,
      pressureLogs: payload.pressureLogs !== undefined ? payload.pressureLogs : currentData.pressureLogs,
      reminders: payload.reminders !== undefined ? payload.reminders : currentData.reminders,
      aiAnalysis: payload.aiAnalysis !== undefined ? payload.aiAnalysis : currentData.aiAnalysis,
      wearablesSyncs: payload.wearablesSyncs !== undefined ? payload.wearablesSyncs : currentData.wearablesSyncs,
      onboardingState: payload.onboardingState !== undefined ? payload.onboardingState : currentData.onboardingState,
      puzzleConfig: payload.puzzleConfig !== undefined ? payload.puzzleConfig : currentData.puzzleConfig,
      updatedAt: new Date().toISOString(),
    };

    const normalized = this.normalizeCanonicalData(updatedData);

    // Save to primary and fallback storage adapters
    if (isPostgresConfigured()) {
      await this.postgresAdapter.saveUserData(userId, normalized);
    }
    await this.sheetsAdapter.saveUserData(userId, normalized);
    await this.inMemoryAdapter.saveUserData(userId, normalized);

    return normalized;
  }

  /**
   * Delete user medical data across all adapters
   */
  async deleteUserData(userId: string, email?: string): Promise<void> {
    await this.postgresAdapter.deleteUserData(userId, email);
    await this.sheetsAdapter.deleteUserData(userId, email);
    await this.inMemoryAdapter.deleteUserData(userId, email);
  }

  /**
   * Ingest telemetry from Wearable devices (smartwatches, monitors)
   * Wearables do NOT write directly to UI or raw tables — they go through Backend Canonical Layer
   */
  async ingestWearableData(userId: string, payload: WearableIngestPayload): Promise<CanonicalUserData> {
    const currentData = await this.getUserData(userId);
    const nowIso = payload.timestamp || new Date().toISOString();
    const dateStr = nowIso.slice(0, 10);
    const timeStr = nowIso.slice(11, 16) || '12:00';
    const subjId = payload.subjectProfileId || `sp-primary-${userId}`;

    const newSyncEvent = {
      id: `wearable-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subject_profile_id: subjId,
      source: payload.source,
      deviceModel: payload.deviceModel || 'Smart Tracker',
      timestamp: nowIso,
      metrics: payload.metrics,
    };

    const updatedWearablesSyncs = [newSyncEvent, ...(currentData.wearablesSyncs || [])].slice(0, 50);

    let updatedPressureLogs = [...(currentData.pressureLogs || [])];
    if (payload.metrics.systolicBp || payload.metrics.diastolicBp || payload.metrics.pulseBpm) {
      const newBpLog = {
        id: `press-wearable-${Date.now()}`,
        subject_profile_id: subjId,
        timestamp: nowIso,
        date: dateStr,
        displayDate: dateStr,
        time: timeStr,
        systolic: payload.metrics.systolicBp || 120,
        diastolic: payload.metrics.diastolicBp || 80,
        pulse: payload.metrics.pulseBpm || payload.metrics.heartRateBpm || 72,
        notes: `Авто-импорт с носимого устройства (${payload.source})`,
      };
      updatedPressureLogs = [newBpLog, ...updatedPressureLogs];
    }

    let updatedDailyLogs = [...(currentData.dailyLogs || [])];
    if (payload.metrics.sleepHours || payload.metrics.stressScore) {
      const existingTodayIndex = updatedDailyLogs.findIndex(
        (l) => l.date === dateStr && l.subject_profile_id === subjId
      );

      if (existingTodayIndex >= 0) {
        updatedDailyLogs[existingTodayIndex] = {
          ...updatedDailyLogs[existingTodayIndex],
          sleep: payload.metrics.sleepHours ?? updatedDailyLogs[existingTodayIndex].sleep,
          stress: payload.metrics.stressScore ?? updatedDailyLogs[existingTodayIndex].stress,
        };
      } else {
        updatedDailyLogs.unshift({
          id: `daily-wearable-${Date.now()}`,
          date: dateStr,
          subject_profile_id: subjId,
          energy: 7,
          sleep: payload.metrics.sleepHours || 8,
          stress: payload.metrics.stressScore || 3,
          mood: 'нормальное',
          has_pain: false,
        });
      }
    }

    return await this.saveUserData(userId, {
      pressureLogs: updatedPressureLogs,
      dailyLogs: updatedDailyLogs,
      wearablesSyncs: updatedWearablesSyncs,
    });
  }

  private normalizeCanonicalData(raw: any): CanonicalUserData {
    return {
      profile: raw.profile || {},
      subjectProfiles: Array.isArray(raw.subjectProfiles) ? raw.subjectProfiles : [],
      documents: Array.isArray(raw.documents) ? raw.documents : [],
      appointments: Array.isArray(raw.appointments) ? raw.appointments : [],
      dailyLogs: Array.isArray(raw.dailyLogs) ? raw.dailyLogs : [],
      diaryEntries: Array.isArray(raw.diaryEntries) ? raw.diaryEntries : [],
      pressureLogs: Array.isArray(raw.pressureLogs) ? raw.pressureLogs : [],
      reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
      aiAnalysis: raw.aiAnalysis || null,
      wearablesSyncs: Array.isArray(raw.wearablesSyncs) ? raw.wearablesSyncs : [],
      onboardingState: raw.onboardingState || null,
      puzzleConfig: Array.isArray(raw.puzzleConfig) ? raw.puzzleConfig : [],
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  }
}

export const canonicalDataLayer = new CanonicalDataLayer();
