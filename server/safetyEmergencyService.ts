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
  severity?: 'mild' | 'moderate' | 'severe' | 'life_threatening';
  notes?: string;
}

export interface ActiveMedicationEntry {
  medicationName: string;
  dosage?: string;
  schedule?: string;
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
  organDonor: boolean | null;
  specialInstructions: string | null;
  updatedAt: string | null;
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
  capturedAt: string;
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
  private locations = new Map<string, LocationRecord>();
  private activeSosDispatches = new Map<string, SOSAlertRecord>();
  private safetyAlertsLog: SafetyAlertResult[] = [];

  public getEmergencyCard(userId: string): EmergencyCardProfile {
    const card = this.emergencyCards.get(userId);
    if (card) return card;

    return {
      userId,
      bloodType: 'UNKNOWN',
      allergies: [],
      activeMedications: [],
      criticalConditions: [],
      emergencyContacts: [],
      organDonor: null,
      specialInstructions: null,
      updatedAt: null,
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

    if ((metrics.systolic && metrics.systolic >= 180) || (metrics.diastolic && metrics.diastolic >= 120)) {
      alerts.push({
        id: `alert-hypertensive-${Date.now()}`,
        userId,
        alertType: 'hypertensive_crisis',
        severity: 'emergency',
        title: 'Критически высокое артериальное давление',
        description: `Зафиксировано высокое артериальное давление: ${metrics.systolic ?? 'нет данных'}/${metrics.diastolic ?? 'нет данных'} мм рт. ст.`,
        recommendedAction: 'Следуйте заранее согласованному с врачом плану действий. При выраженных симптомах или ухудшении состояния обратитесь за неотложной медицинской помощью.',
        triggeredValue: `${metrics.systolic ?? 'нет данных'}/${metrics.diastolic ?? 'нет данных'} мм рт. ст.`,
        triggeredAt: nowIso,
      });
    }

    if (metrics.glucose && metrics.glucose < 3.5) {
      alerts.push({
        id: `alert-hypo-${Date.now()}`,
        userId,
        alertType: 'hypoglycemia',
        severity: 'emergency',
        title: 'Критически низкий уровень глюкозы',
        description: `Зафиксирован уровень глюкозы ${metrics.glucose} ммоль/л.`,
        recommendedAction: 'Следуйте персональному плану, который дал лечащий врач. Если состояние ухудшается или есть выраженные симптомы, обратитесь за неотложной медицинской помощью.',
        triggeredValue: `${metrics.glucose} ммоль/л`,
        triggeredAt: nowIso,
      });
    }

    if (metrics.glucose && metrics.glucose >= 16.0) {
      alerts.push({
        id: `alert-hyper-${Date.now()}`,
        userId,
        alertType: 'hyperglycemia',
        severity: 'critical',
        title: 'Очень высокий уровень глюкозы',
        description: `Зафиксирован уровень глюкозы ${metrics.glucose} ммоль/л.`,
        recommendedAction: 'Следуйте персональному плану лечения, который дал врач. При выраженных симптомах, кетонах или ухудшении состояния обратитесь за медицинской помощью.',
        triggeredValue: `${metrics.glucose} ммоль/л`,
        triggeredAt: nowIso,
      });
    }

    if (metrics.heartRate) {
      if (metrics.heartRate > 150) {
        alerts.push({
          id: `alert-tachy-${Date.now()}`,
          userId,
          alertType: 'tachycardia',
          severity: 'critical',
          title: 'Очень высокая частота пульса',
          description: `Зафиксирован пульс ${metrics.heartRate} уд/мин.`,
          recommendedAction: 'Прекратите нагрузку и оцените самочувствие. При выраженных симптомах или сохранении очень высокой частоты пульса обратитесь за неотложной медицинской помощью.',
          triggeredValue: `${metrics.heartRate} уд/мин`,
          triggeredAt: nowIso,
        });
      } else if (metrics.heartRate < 40) {
        alerts.push({
          id: `alert-brady-${Date.now()}`,
          userId,
          alertType: 'bradycardia',
          severity: 'emergency',
          title: 'Очень низкая частота пульса',
          description: `Зафиксирован пульс ${metrics.heartRate} уд/мин.`,
          recommendedAction: 'Оцените самочувствие и следуйте персональному плану врача. При слабости, головокружении, обмороке, боли в груди или других выраженных симптомах обратитесь за неотложной помощью.',
          triggeredValue: `${metrics.heartRate} уд/мин`,
          triggeredAt: nowIso,
        });
      }
    }

    if (metrics.temperature && metrics.temperature >= 39.5) {
      alerts.push({
        id: `alert-fever-${Date.now()}`,
        userId,
        alertType: 'fever_anomaly',
        severity: 'critical',
        title: 'Высокая температура',
        description: `Зафиксирована температура ${metrics.temperature}°C.`,
        recommendedAction: 'Оцените общее состояние и следуйте рекомендациям врача. При выраженном ухудшении состояния или тревожных симптомах обратитесь за медицинской помощью.',
        triggeredValue: `${metrics.temperature}°C`,
        triggeredAt: nowIso,
      });
    }

    for (const alert of alerts) this.safetyAlertsLog.unshift(alert);
    return alerts;
  }

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
      locationStatus = locationSnapshot.isStale ? 'STALE_LOCATION_NOT_CURRENT' : 'FRESH_LIVE_LOCATION';
    }

    const notifiedContacts = emergencyCardSnapshot.emergencyContacts.map((c) => ({
      name: c.name,
      phone: c.phone,
      status: 'pending' as const,
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
    if (!sos) throw new Error('SOS workflow не найден');

    sos.status = 'resolved';
    sos.resolvedAt = new Date().toISOString();
    sos.cancellationReason = reason || 'Причина завершения не указана';
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

  public recordDeviceFallEvent(params: {
    userId: string;
    providerId: string;
    timestamp?: string;
    impactGForce?: number;
  }): { success: boolean; message: string; sosRecord?: SOSAlertRecord } {
    const provider = integrationsService.getProvidersRegistry().find((p) => p.id === params.providerId);
    if (!provider) throw new Error(`Неизвестный провайдер носимых устройств: ${params.providerId}`);

    const hasFallCapability = provider.capabilities.some((c) => c.key === 'fall_detection');
    if (!hasFallCapability) {
      throw new Error(`ОТКЛОНЕНО: Провайдер «${provider.name}» (${params.providerId}) не поддерживает capability fall_detection.`);
    }

    const impactText = params.impactGForce !== undefined ? `${params.impactGForce}G` : 'значение ускорения не передано';
    const sosRecord = this.triggerSOS({
      userId: params.userId,
      source: 'fall_sensor',
      reason: `Зафиксировано аппаратное событие падения с устройства ${provider.name}; ${impactText}`,
    });

    return {
      success: true,
      message: `Зафиксировано подтверждённое событие падения от ${provider.name}. SOS workflow активирован локально; статус доставки контактам остаётся pending до подтверждения провайдером уведомлений.`,
      sosRecord,
    };
  }

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
    const isStale = ageMinutes > 15;
    const displayStatus: LocationRecord['displayStatus'] = isStale ? 'STALE_LOCATION_NOT_CURRENT' : 'FRESH_LIVE_LOCATION';

    const formattedLabel = isStale
      ? `[УСТАРЕВШАЯ ГЕОПОЗИЦИЯ - НЕ ЯВЛЯЕТСЯ ТЕКУЩЕЙ] (Зафиксирована ${ageMinutes} мин. назад, Точность ${params.accuracyMeters}м)`
      : `Текущая геопозиция (Зафиксировано ${ageMinutes === 0 ? 'только что' : ageMinutes + ' мин. назад'}, Точность ${params.accuracyMeters}м)`;

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

  public getLatestLocation(userId: string): LocationRecord | null {
    const loc = this.locations.get(userId);
    if (!loc) return null;

    const ageMs = Date.now() - new Date(loc.capturedAt).getTime();
    const ageMinutes = Math.floor(ageMs / 60000);
    const isStale = ageMinutes > 15;
    const displayStatus: LocationRecord['displayStatus'] = isStale ? 'STALE_LOCATION_NOT_CURRENT' : 'FRESH_LIVE_LOCATION';
    const formattedLabel = isStale
      ? `[УСТАРЕВШАЯ ГЕОПОЗИЦИЯ - НЕ ЯВЛЯЕТСЯ ТЕКУЩЕЙ] (Зафиксирована ${ageMinutes} мин. назад, Точность ${loc.accuracyMeters}м)`
      : `Текущая геопозиция (Зафиксировано ${ageMinutes === 0 ? 'только что' : ageMinutes + ' мин. назад'}, Точность ${loc.accuracyMeters}м)`;

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
