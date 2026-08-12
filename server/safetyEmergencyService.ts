import { integrationsService } from './integrationsService';
import { auditProvenanceService } from './auditProvenanceService';

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

export interface AllergyEntry {
  allergyName: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
  notes?: string;
}

export interface ActiveMedicationEntry {
  medicationName: string;
  dosage: string;
  schedule: string;
}

export interface CriticalConditionEntry {
  conditionName: string;
  icdCode?: string;
  notes?: string;
}

export interface EmergencyCardProfile {
  userId: string;
  bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'UNKNOWN';
  allergies: AllergyEntry[];
  activeMedications: ActiveMedicationEntry[];
  criticalConditions: CriticalConditionEntry[];
  emergencyContacts: EmergencyContact[];
  organDonor: boolean;
  specialInstructions: string;
  updatedAt: string;
}

export interface SafetyAlertResult {
  id: string;
  userId: string;
  alertType: 'hypertensive_crisis' | 'hypoglycemia' | 'hyperglycemia' | 'tachycardia' | 'bradycardia' | 'fever_anomaly' | 'fall_detected';
  severity: 'warning' | 'critical' | 'emergency';
  title: string;
  description: string;
  recommendedAction: string;
  triggeredValue?: string;
  triggeredAt: string;
}

export interface LocationRecord {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string; // ISO String
  addressText?: string;
  isStale: boolean;
  ageMinutes: number;
  displayStatus: 'FRESH_LIVE_LOCATION' | 'STALE_LOCATION_NOT_CURRENT';
  formattedLabel: string;
}

export interface SOSAlertRecord {
  id: string;
  userId: string;
  status: 'active_dispatch' | 'resolved' | 'cancelled';
  source: 'user_button' | 'fall_sensor' | 'system';
  triggeredAt: string;
  resolvedAt?: string;
  emergencyCardSnapshot: EmergencyCardProfile;
  locationSnapshot: LocationRecord | null;
  locationStatus: 'FRESH_LIVE_LOCATION' | 'STALE_LOCATION_NOT_CURRENT' | 'LOCATION_UNAVAILABLE';
  notifiedContacts: { name: string; phone: string; status: 'sent' | 'pending' }[];
  cancellationReason?: string;
}

export class SafetyEmergencyService {
  private emergencyCards = new Map<string, EmergencyCardProfile>();
  private locations = new Map<string, LocationRecord>(); // userId -> LocationRecord
  private activeSosDispatches = new Map<string, SOSAlertRecord>(); // sosId -> SOSAlertRecord
  private safetyAlertsLog: SafetyAlertResult[] = [];

  constructor() {
    this.seedDemoEmergencyData('user_demo_me');
  }

  private seedDemoEmergencyData(userId: string) {
    const demoCard: EmergencyCardProfile = {
      userId,
      bloodType: 'A+',
      allergies: [
        { allergyName: 'Пенициллин', severity: 'life_threatening', notes: 'Анафилактический шок в анамнезе' },
        { allergyName: 'Новокаин', severity: 'severe', notes: 'Отек Квинке' },
      ],
      activeMedications: [
        { medicationName: 'Периндоприл', dosage: '5 мг', schedule: '1 раз в день утром' },
        { medicationName: 'Аспирин Кардио', dosage: '100 мг', schedule: '1 раз в день вечером' },
      ],
      criticalConditions: [
        { conditionName: 'Артериальная гипертензия II ст.', icdCode: 'I10', notes: 'Целевое АД 120-130 / 70-80' },
        { conditionName: 'Бронхиальная астма', icdCode: 'J45', notes: 'Использует ингалятор Вентолин' },
      ],
      emergencyContacts: [
        { name: 'Анна Иванова (Жена)', relationship: 'супруга', phone: '+7 (999) 123-45-67', isPrimary: true },
        { name: 'Д-р Петров В.С.', relationship: 'лечащий врач', phone: '+7 (903) 987-65-43', isPrimary: false },
      ],
      organDonor: true,
      specialInstructions: 'Наличие кардиостимулятора Medtronic. Избегать МРТ без согласования с кардиологом.',
      updatedAt: new Date().toISOString(),
    };
    this.emergencyCards.set(userId, demoCard);

    // Seed Location (Fresh location)
    const nowIso = new Date().toISOString();
    const loc: LocationRecord = {
      id: 'loc-demo-01',
      userId,
      latitude: 55.7558,
      longitude: 37.6173,
      accuracyMeters: 12,
      capturedAt: nowIso,
      addressText: 'г. Москва, ул. Тверская, д. 12, кв. 45',
      isStale: false,
      ageMinutes: 0,
      displayStatus: 'FRESH_LIVE_LOCATION',
      formattedLabel: 'Текущая геопозиция (Точность 12м, зафиксировано только что)',
    };
    this.locations.set(userId, loc);
  }

  // --- 1. EMERGENCY CARD ENGINE (NO LLM, 100% DETERMINISTIC) ---

  /**
   * Requirement 20: Deterministic Emergency Card without LLM
   */
  public getEmergencyCard(userId: string): EmergencyCardProfile {
    const card = this.emergencyCards.get(userId);
    if (card) return card;

    // Return empty fallback profile if not configured
    return {
      userId,
      bloodType: 'UNKNOWN',
      allergies: [],
      activeMedications: [],
      criticalConditions: [],
      emergencyContacts: [],
      organDonor: false,
      specialInstructions: 'Особые медицинские указания не заполнены.',
      updatedAt: new Date().toISOString(),
    };
  }

  public updateEmergencyCard(userId: string, updates: Partial<EmergencyCardProfile>): EmergencyCardProfile {
    const current = this.getEmergencyCard(userId);
    const updated: EmergencyCardProfile = {
      ...current,
      ...updates,
      userId,
      updatedAt: new Date().toISOString(),
    };

    this.emergencyCards.set(userId, updated);

    auditProvenanceService.recordCriticalChange({
      userId,
      resourceType: 'document',
      resourceId: `emergency-card-${userId}`,
      action: 'UPDATE',
      oldValue: current,
      newValue: updated,
      actor: { id: userId, role: 'user', name: 'Пользователь' },
      reasonSource: 'EMERGENCY_CARD_MANUAL_UPDATE',
    });

    return updated;
  }

  // --- 2. DETERMINISTIC SAFETY SERVICE ---

  /**
   * Requirement 20: Safety Service MUST be deterministic and independent of free AI decisions
   */
  public evaluateMetricsSafety(
    userId: string,
    metrics: {
      systolic?: number;
      diastolic?: number;
      glucose?: number;
      heartRate?: number;
      temperature?: number;
    }
  ): SafetyAlertResult[] {
    const alerts: SafetyAlertResult[] = [];
    const nowIso = new Date().toISOString();

    // Hypertensive Crisis Threshold (SBP >= 180 or DBP >= 120)
    if ((metrics.systolic && metrics.systolic >= 180) || (metrics.diastolic && metrics.diastolic >= 120)) {
      alerts.push({
        id: `alert-hypertensive-${Date.now()}`,
        userId,
        alertType: 'hypertensive_crisis',
        severity: 'emergency',
        title: 'ГИПЕРТОНИЧЕСКИЙ КРИЗ (Критический уровень АД)',
        description: `Зафиксировано опасное повышение артериального давления: ${metrics.systolic || '--'}/${metrics.diastolic || '--'} мм рт. ст.`,
        recommendedAction: 'Немедленно примите горизонтальное положение. Вызовите скорую медицинскую помощь 103 / 112!',
        triggeredValue: `${metrics.systolic}/${metrics.diastolic} мм рт. ст.`,
        triggeredAt: nowIso,
      });
    }

    // Critical Hypoglycemia Threshold (Glucose < 3.5 mmol/L)
    if (metrics.glucose && metrics.glucose < 3.5) {
      alerts.push({
        id: `alert-hypo-${Date.now()}`,
        userId,
        alertType: 'hypoglycemia',
        severity: 'emergency',
        title: 'ОПАСНАЯ ГИПОГЛИКЕМИЯ (Низкий уровень сахара)',
        description: `Зафиксировано критическое падение глюкозы крови: ${metrics.glucose} ммоль/л (Ниже 3.5 ммоль/л).`,
        recommendedAction: 'Примите 15-20 грамм быстрых углеводов (стакан сладкого сока, 3-4 куска сахара, гелевую глюкозу). Измерьте уровень через 15 минут!',
        triggeredValue: `${metrics.glucose} ммоль/л`,
        triggeredAt: nowIso,
      });
    }

    // Critical Hyperglycemia Threshold (Glucose >= 16.0 mmol/L)
    if (metrics.glucose && metrics.glucose >= 16.0) {
      alerts.push({
        id: `alert-hyper-${Date.now()}`,
        userId,
        alertType: 'hyperglycemia',
        severity: 'critical',
        title: 'ВЫСОКАЯ ГИПЕРГЛИКЕМИЯ',
        description: `Уровень глюкозы крови повышен до ${metrics.glucose} ммоль/л. Высокий риск кетоацидоза.`,
        recommendedAction: 'Проверьте кетоны в моче/крови. Введите подкалывающую дозу короткого инсулина согласно врачебному назначению.',
        triggeredValue: `${metrics.glucose} ммоль/л`,
        triggeredAt: nowIso,
      });
    }

    // Heart Rate Tachycardia/Bradycardia
    if (metrics.heartRate) {
      if (metrics.heartRate > 150) {
        alerts.push({
          id: `alert-tachy-${Date.now()}`,
          userId,
          alertType: 'tachycardia',
          severity: 'critical',
          title: 'ВЫРАЖЕННАЯ ТАХИКАРДИЯ В ПОКОЕ',
          description: `Пульс покоя превышает 150 уд/мин (Зафиксировано: ${metrics.heartRate} уд/мин).`,
          recommendedAction: 'Прекратите любую физическую нагрузку, сядьте в прохладном месте. При сохранении вызовите 103.',
          triggeredValue: `${metrics.heartRate} уд/мин`,
          triggeredAt: nowIso,
        });
      } else if (metrics.heartRate < 40) {
        alerts.push({
          id: `alert-brady-${Date.now()}`,
          userId,
          alertType: 'bradycardia',
          severity: 'emergency',
          title: 'ОПАСНАЯ БРАДИКАРДИЯ',
          description: `Пульс падал ниже 40 уд/мин (Зафиксировано: ${metrics.heartRate} уд/мин). Высокий риск синкопе/потери сознания.`,
          recommendedAction: 'Примите горизонтальное положение с приподнятыми ногами. Вызовите скорую помощь.',
          triggeredValue: `${metrics.heartRate} уд/мин`,
          triggeredAt: nowIso,
        });
      }
    }

    // Temperature Anomaly
    if (metrics.temperature) {
      if (metrics.temperature >= 39.5) {
        alerts.push({
          id: `alert-fever-${Date.now()}`,
          userId,
          alertType: 'fever_anomaly',
          severity: 'critical',
          title: 'ВЫСОКАЯ ЛИХОРАДКА (Гипертермия)',
          description: `Температура тела достигла ${metrics.temperature}°C.`,
          recommendedAction: 'Примите жаропонижающее средство (Парацетамол/Ибупрофен) и примените физическое охлаждение.',
          triggeredValue: `${metrics.temperature}°C`,
          triggeredAt: nowIso,
        });
      }
    }

    for (const alert of alerts) {
      this.safetyAlertsLog.unshift(alert);
    }

    return alerts;
  }

  // --- 3. SOS WORKFLOW ---

  /**
   * Requirement 20: SOS по кнопке → отдельный workflow
   */
  public triggerSOS(params: {
    userId: string;
    source: 'user_button' | 'fall_sensor' | 'system';
    reason?: string;
  }): SOSAlertRecord {
    const sosId = `sos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const emergencyCardSnapshot = this.getEmergencyCard(params.userId);
    const locationSnapshot = this.getLatestLocation(params.userId);

    let locationStatus: SOSAlertRecord['locationStatus'] = 'LOCATION_UNAVAILABLE';
    if (locationSnapshot) {
      locationStatus = locationSnapshot.isStale
        ? 'STALE_LOCATION_NOT_CURRENT'
        : 'FRESH_LIVE_LOCATION';
    }

    const notifiedContacts = emergencyCardSnapshot.emergencyContacts.map((c) => ({
      name: c.name,
      phone: c.phone,
      status: 'sent' as const,
    }));

    const sosRecord: SOSAlertRecord = {
      id: sosId,
      userId: params.userId,
      status: 'active_dispatch',
      source: params.source,
      triggeredAt: nowIso,
      emergencyCardSnapshot,
      locationSnapshot,
      locationStatus,
      notifiedContacts,
    };

    this.activeSosDispatches.set(sosId, sosRecord);

    auditProvenanceService.recordCriticalChange({
      userId: params.userId,
      resourceType: 'document',
      resourceId: sosId,
      action: 'CREATE',
      oldValue: null,
      newValue: sosRecord,
      actor: { id: params.userId, role: 'user', name: 'Пользователь (SOS)' },
      reasonSource: `SOS_WORKFLOW_TRIGGERED_BY_${params.source.toUpperCase()}`,
    });

    return sosRecord;
  }

  public resolveSOS(userId: string, sosId: string, reason?: string): SOSAlertRecord {
    const sos = this.activeSosDispatches.get(sosId);
    if (!sos) throw new Error('SOS диспетчеризация не найдена');

    sos.status = 'resolved';
    sos.resolvedAt = new Date().toISOString();
    sos.cancellationReason = reason || 'Отменено пользователем (Ложный сигнал/Помощь получена)';

    this.activeSosDispatches.set(sosId, sos);

    auditProvenanceService.recordCriticalChange({
      userId,
      resourceType: 'document',
      resourceId: sosId,
      action: 'UPDATE',
      oldValue: { status: 'active_dispatch' },
      newValue: { status: 'resolved', reason: sos.cancellationReason },
      actor: { id: userId, role: 'user' },
      reasonSource: 'SOS_RESOLVED_BY_USER',
    });

    return sos;
  }

  // --- 4. FALL / DEVICE EVENTS (STRICT PROVIDER CAPABILITY ENFORCEMENT) ---

  /**
   * Requirement 20: Fall/device events → только если конкретный provider действительно отдаёт такую capability
   */
  public recordDeviceFallEvent(params: {
    userId: string;
    providerId: string;
    timestamp?: string;
    impactGForce?: number;
  }): { success: boolean; message: string; sosRecord?: SOSAlertRecord } {
    // 1. Check provider capability via integrationsService registry
    const provider = integrationsService.getProvidersRegistry().find((p) => p.id === params.providerId);

    if (!provider) {
      throw new Error(`Неизвестный провайдер носимых устройств: ${params.providerId}`);
    }

    const hasFallCapability = provider.capabilities.some((c) => c.key === 'fall_detection');

    if (!hasFallCapability) {
      throw new Error(
        `ОТКЛОНЕНО: Провайдер «${provider.name}» (${params.providerId}) не поддерживает аппаратную детекцию падений (отсутствует capability "fall_detection"). Событие заблокировано.`
      );
    }

    // 2. Provider HAS capability -> Process Fall Event & Trigger Emergency SOS Workflow
    const sosRecord = this.triggerSOS({
      userId: params.userId,
      source: 'fall_sensor',
      reason: `Зафиксировано аппаратное падение с устройства ${provider.name} (Ускорение: ${params.impactGForce || '4.2'}G)`,
    });

    return {
      success: true,
      message: `Зафиксировано подтвержденное аппаратное падение с носимого устройства ${provider.name}. Автоматически активирован экстренный SOS workflow.`,
      sosRecord,
    };
  }

  // --- 5. LOCATION MANAGEMENT & STALE LOCATION ENFORCEMENT ---

  /**
   * Requirement 20: Геолокация хранится отдельно, имеет freshness/accuracy и отдельный permission scope.
   * STALE LOCATION НЕЛЬЗЯ показывать как текущую!
   */
  public saveLocationRecord(params: {
    userId: string;
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    capturedAt?: string;
    addressText?: string;
  }): LocationRecord {
    const id = `loc-${Date.now()}`;
    const capturedAt = params.capturedAt || new Date().toISOString();
    const ageMs = Date.now() - new Date(capturedAt).getTime();
    const ageMinutes = Math.floor(ageMs / 60000);

    const isStale = ageMinutes > 15; // > 15 minutes threshold
    const displayStatus: LocationRecord['displayStatus'] = isStale
      ? 'STALE_LOCATION_NOT_CURRENT'
      : 'FRESH_LIVE_LOCATION';

    let formattedLabel = '';
    if (isStale) {
      formattedLabel = `[УСТАРЕВШАЯ ГЕОПОЗИЦИЯ - НЕ ЯВЛЯЕТСЯ ТЕКУЩЕЙ] (Зафиксирована ${ageMinutes} мин. назад, Точность ${params.accuracyMeters}м)`;
    } else {
      formattedLabel = `Текущая геопозиция (Зафиксировано ${ageMinutes === 0 ? 'только что' : ageMinutes + ' мин. назад'}, Точность ${params.accuracyMeters}м)`;
    }

    const loc: LocationRecord = {
      id,
      userId: params.userId,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracyMeters: params.accuracyMeters,
      capturedAt,
      addressText: params.addressText,
      isStale,
      ageMinutes,
      displayStatus,
      formattedLabel,
    };

    this.locations.set(params.userId, loc);
    return loc;
  }

  /**
   * Get latest location with strict freshness evaluation
   */
  public getLatestLocation(userId: string): LocationRecord | null {
    const loc = this.locations.get(userId);
    if (!loc) return null;

    // Recalculate age and freshness dynamically upon retrieval
    const ageMs = Date.now() - new Date(loc.capturedAt).getTime();
    const ageMinutes = Math.floor(ageMs / 60000);
    const isStale = ageMinutes > 15; // 15 mins threshold

    const displayStatus: LocationRecord['displayStatus'] = isStale
      ? 'STALE_LOCATION_NOT_CURRENT'
      : 'FRESH_LIVE_LOCATION';

    let formattedLabel = '';
    if (isStale) {
      formattedLabel = `[УСТАРЕВШАЯ ГЕОПОЗИЦИЯ - НЕ ЯВЛЯЕТСЯ ТЕКУЩЕЙ] (Зафиксирована ${ageMinutes} мин. назад, Точность ${loc.accuracyMeters}м)`;
    } else {
      formattedLabel = `Текущая геопозиция (Зафиксировано ${ageMinutes === 0 ? 'только что' : ageMinutes + ' мин. назад'}, Точность ${loc.accuracyMeters}м)`;
    }

    const updatedLoc: LocationRecord = {
      ...loc,
      isStale,
      ageMinutes,
      displayStatus,
      formattedLabel,
    };

    this.locations.set(userId, updatedLoc);
    return updatedLoc;
  }
}

export const safetyEmergencyService = new SafetyEmergencyService();
