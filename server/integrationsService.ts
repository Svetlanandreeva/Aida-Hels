import crypto from 'crypto';
import { canonicalDataLayer } from './canonicalDataLayer';

export type IntegrationProviderStatus = 'supported' | 'preview_bridge' | 'partner_pending';
export type IntegrationCategory = 'mobile_os' | 'smart_watch' | 'fitness_tracker' | 'ring' | 'smart_scale';
export type ConnectedSourceStatus = 'active' | 'syncing' | 'stale' | 'error' | 'disconnected';

export interface ProviderCapability {
  key: string;
  name: string;
  unit: string;
  description: string;
}

export interface IntegrationProvider {
  id: string;
  name: string;
  status: IntegrationProviderStatus;
  statusMessage: string;
  category: IntegrationCategory;
  authType: 'system_sdk' | 'oauth2' | 'bridge_file';
  capabilities: ProviderCapability[];
  docsUrl: string;
  iconName: string;
}

export interface ConnectedSource {
  id: string;
  userId: string;
  providerId: string;
  providerName: string;
  status: ConnectedSourceStatus;
  lastSyncAt: string | null;
  syncCursor: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  createdTime: string;
  settings: {
    autoSync: boolean;
    syncFrequencyMinutes: number;
  };
}

export interface DeviceEntity {
  id: string;
  sourceId: string;
  userId: string;
  providerId: string;
  deviceName: string;
  model: string;
  firmwareVersion: string;
  hardwareId: string;
  batteryLevel: number | null;
  lastSeenAt: string;
  isPrimaryTracker: boolean;
}

export interface RawStagingSample {
  id: string;
  providerId: string;
  sourceId: string;
  deviceId?: string;
  rawPayload: any;
  receivedAt: string;
  status: 'staged' | 'validated' | 'normalized' | 'quarantined' | 'committed';
  quarantineReason?: string;
}

export type CanonicalMetricType =
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'hrv'
  | 'blood_pressure'
  | 'spo2'
  | 'weight'
  | 'body_composition'
  | 'sleep_session'
  | 'steps'
  | 'workout'
  | 'vo2_max'
  | 'body_temperature'
  | 'basal_temperature'
  | 'wrist_temperature'
  | 'respiratory_rate'
  | 'cycle_record'
  | 'nutrition_hydration'
  | 'vendor_sleep_score'
  | 'glucose'
  | 'temperature';

export interface VendorSleepScoreMetadata {
  rawScore: number;
  scaleMax: number;
  scoreName: string;
  vendor: string;
  normalizationVersion: string; // "v1.0-vendor-preserved"
  normalizedPercent: number;
  normalizationFormula: string;
  notes: string;
}

export interface ValueComponents {
  // Blood Pressure (Grouped Event)
  systolic?: number;
  diastolic?: number;
  pulse?: number;

  // Body Composition
  fatMassKg?: number;
  fatPercentage?: number;
  muscleMassKg?: number;
  boneMassKg?: number;
  waterPercentage?: number;

  // Sleep Sessions & Stages
  durationMinutes?: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  lightSleepMinutes?: number;
  awakeMinutes?: number;

  // Versioned Vendor Sleep Score
  vendorSleepScore?: VendorSleepScoreMetadata;

  // Activity & Workouts
  activeCalories?: number;
  activeMinutes?: number;
  distanceMeters?: number;
  activityType?: string;
  durationSeconds?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;

  // Temperature
  baselineDeviationDegreesC?: number;

  // Reproductive / Cycle
  cycleDay?: number;
  cyclePhase?: 'follicular' | 'ovulation' | 'luteal' | 'menstruation';
  flowLevel?: 'spotting' | 'light' | 'medium' | 'heavy';

  // Nutrition & Hydration
  waterMl?: number;
  caloriesKcal?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
}

export interface CanonicalMetricSample {
  id: string;
  userId: string;
  metricType: CanonicalMetricType;
  value: number;
  valueComponents?: ValueComponents;
  unit: string;
  timestamp: string;
  provenance: {
    providerId: string;
    providerName: string;
    sourceId: string;
    deviceId?: string;
    deviceName?: string;
    idempotencyKey: string;
    ingestedAt: string;
  };
}

export interface SyncBatchResponse {
  success: boolean;
  pipelineStats: {
    receivedCount: number;
    stagedCount: number;
    validatedCount: number;
    normalizedCount: number;
    deduplicatedCount: number;
    canonicalCommittedCount: number;
    quarantinedCount: number;
  };
  canonicalSamples: CanonicalMetricSample[];
  quarantinedSamples: { raw: any; reason: string }[];
  connectedSource: ConnectedSource;
}

export class IntegrationsService {
  // 1. PROVIDERS CAPABILITY REGISTRY
  private providersRegistry: IntegrationProvider[] = [
    {
      id: 'apple_health',
      name: 'Apple Health (HealthKit)',
      status: 'supported',
      statusMessage: 'Официальный адаптер активен. Нативная синхронизация с iOS HealthKit.',
      category: 'mobile_os',
      authType: 'system_sdk',
      iconName: 'Apple',
      docsUrl: 'https://developer.apple.com/documentation/healthkit',
      capabilities: [
        { key: 'steps', name: 'Шаги и физическая активность', unit: 'steps', description: 'Ежедневный подсчёт шагов' },
        { key: 'heart_rate', name: 'Пульс и ЧСС в покое', unit: 'bpm', description: 'Частота сердечных сокращений' },
        { key: 'sleep', name: 'Анализ сна и фаз', unit: 'hours', description: 'Общая продолжительность и фазы сна' },
        { key: 'blood_pressure', name: 'Артериальное давление', unit: 'mmHg', description: 'Систолическое и диастолическое давление' },
        { key: 'spo2', name: 'Насыщение кислородом (SpO2)', unit: '%', description: 'Уровень пульсоксиметрии' },
        { key: 'hrv', name: 'Вариабельность пульса (HRV)', unit: 'ms', description: 'Показатели стресса и восстановления' },
        { key: 'weight', name: 'Масса тела', unit: 'kg', description: 'Динамика веса' },
        { key: 'fall_detection', name: 'Детекция падений (Fall Detection)', unit: 'event', description: 'Автоматическая фиксация падения с датчиков Apple Watch' },
      ],
    },
    {
      id: 'health_connect',
      name: 'Android Health Connect',
      status: 'supported',
      statusMessage: 'Официальный адаптер активен. Единое хранилище Android Health Connect.',
      category: 'mobile_os',
      authType: 'system_sdk',
      iconName: 'Smartphone',
      docsUrl: 'https://developer.android.com/health-and-fitness/guides/health-connect',
      capabilities: [
        { key: 'steps', name: 'Шаги и активность', unit: 'steps', description: 'Шаги и дистанция' },
        { key: 'heart_rate', name: 'Пульс (HeartRateRecord)', unit: 'bpm', description: 'Пульс в реальном времени' },
        { key: 'sleep', name: 'Сессии сна (SleepSessionRecord)', unit: 'hours', description: 'Аналитика сна' },
        { key: 'blood_pressure', name: 'Артериальное давление', unit: 'mmHg', description: 'Замеры тонометра' },
        { key: 'glucose', name: 'Глюкоза крови (BloodGlucoseRecord)', unit: 'mmol/L', description: 'НМГ / Глюкометр' },
        { key: 'temperature', name: 'Температура тела', unit: '°C', description: 'Базальная и кожная температура' },
      ],
    },
    {
      id: 'withings',
      name: 'Withings Health Solutions',
      status: 'partner_pending',
      statusMessage: 'Заявка на партнерский API-доступ подана. Ожидает авторизации провайдером Withings.',
      category: 'smart_scale',
      authType: 'oauth2',
      iconName: 'Scale',
      docsUrl: 'https://developer.withings.com',
      capabilities: [
        { key: 'weight', name: 'Умные весы (Вес & Состав тела)', unit: 'kg', description: 'Жировая, мышечная, костная масса' },
        { key: 'blood_pressure', name: 'Тонометры BPM Core', unit: 'mmHg', description: 'АД и ФКГ' },
        { key: 'sleep', name: 'Мат для сна Sleep Analyzer', unit: 'hours', description: 'Оценка апноэ и качества сна' },
      ],
    },
    {
      id: 'garmin',
      name: 'Garmin Connect',
      status: 'partner_pending',
      statusMessage: 'Требуется официальное согласование Garmin Health Enterprise API.',
      category: 'smart_watch',
      authType: 'oauth2',
      iconName: 'Watch',
      docsUrl: 'https://developer.garmin.com/gc-developer-program',
      capabilities: [
        { key: 'heart_rate', name: 'Непрерывный пульс Elevate', unit: 'bpm', description: 'Пульс 24/7' },
        { key: 'body_battery', name: 'Body Battery & Стресс', unit: '%', description: 'Уровень энергии и стресса' },
        { key: 'spo2', name: 'Pulse Ox', unit: '%', description: 'Ночная сатурация' },
        { key: 'fall_detection', name: 'Incident Detection (Обнаружение инцидентов и падений)', unit: 'event', description: 'Детектор падений во время тренировок и активности' },
      ],
    },
    {
      id: 'fitbit',
      name: 'Fitbit / Google Health',
      status: 'partner_pending',
      statusMessage: 'Ожидается подтверждение OAuth Client ID в Google Cloud Console.',
      category: 'fitness_tracker',
      authType: 'oauth2',
      iconName: 'Activity',
      docsUrl: 'https://dev.fitbit.com/build/reference/web-api',
      capabilities: [
        { key: 'steps', name: 'Активность и зоны пульса', unit: 'steps', description: 'Минуты в зоне жиросжигания' },
        { key: 'sleep', name: 'Fitbit Sleep Score', unit: 'score', description: 'Индекс сна' },
        { key: 'hrv', name: 'Ночной HRV', unit: 'ms', description: 'Вариабельность сердечного ритма' },
      ],
    },
    {
      id: 'samsung',
      name: 'Samsung Health',
      status: 'partner_pending',
      statusMessage: 'Пакет интеграции Samsung Privileged Health SDK готов к активации.',
      category: 'smart_watch',
      authType: 'system_sdk',
      iconName: 'Watch',
      docsUrl: 'https://developer.samsung.com/health',
      capabilities: [
        { key: 'body_composition', name: 'BIA биоимпеданс', unit: '%', description: '% жира и скелетных мышц' },
        { key: 'blood_pressure', name: 'Калиброванный тонометр Galaxy Watch', unit: 'mmHg', description: 'АД на запястье' },
        { key: 'sleep', name: 'Детекция храпа и фазы сна', unit: 'hours', description: 'Расширенный анализ сна' },
      ],
    },
    {
      id: 'oura',
      name: 'Oura Ring API v2',
      status: 'partner_pending',
      statusMessage: 'Oura Ring Cloud API v2 готово. Ожидает введения OAuth Personal Access Token.',
      category: 'ring',
      authType: 'oauth2',
      iconName: 'Disc',
      docsUrl: 'https://cloud.ouraring.com/docs',
      capabilities: [
        { key: 'readiness', name: 'Oura Readiness Score', unit: 'score', description: 'Готовность организма' },
        { key: 'sleep', name: 'Oura Sleep Score & HRV', unit: 'score', description: 'Детализированные фазы сна' },
        { key: 'temperature', name: 'Отклонение температуры кожи', unit: '°C', description: 'Ранние маркеры воспаления' },
      ],
    },
    {
      id: 'polar',
      name: 'Polar Flow',
      status: 'partner_pending',
      statusMessage: 'Заявка Polar AccessLink API зарегистрирована.',
      category: 'smart_watch',
      authType: 'oauth2',
      iconName: 'Zap',
      docsUrl: 'https://www.polar.com/accesslink-api',
      capabilities: [
        { key: 'recovery', name: 'Recovery Pro & Nightly Recharge', unit: 'score', description: 'Восстановление ВНС' },
        { key: 'heart_rate', name: 'Нагрудные датчики H10 / Verity Sense', unit: 'bpm', description: 'Высокоточная кардиограмма' },
      ],
    },
    {
      id: 'whoop',
      name: 'WHOOP Developer API',
      status: 'partner_pending',
      statusMessage: 'WHOOP OAuth 2.0 Client credentials в режиме рассмотрения.',
      category: 'fitness_tracker',
      authType: 'oauth2',
      iconName: 'Flame',
      docsUrl: 'https://developer.whoop.com',
      capabilities: [
        { key: 'strain', name: 'Day Strain Score', unit: 'score', description: 'Нагрузка на нервную систему' },
        { key: 'recovery', name: 'Recovery % & HRV', unit: '%', description: 'Уровень готовности' },
        { key: 'sleep', name: 'Sleep Performance', unit: '%', description: 'Потребность и качество сна' },
      ],
    },
    {
      id: 'xiaomi',
      name: 'Xiaomi Mi Fitness Bridge',
      status: 'partner_pending',
      statusMessage: 'Xiaomi Health Bridge ожидает технического согласования.',
      category: 'fitness_tracker',
      authType: 'bridge_file',
      iconName: 'Cpu',
      docsUrl: 'https://dev.mi.com',
      capabilities: [
        { key: 'steps', name: 'Шаги с фитнес-браслетов Mi Band', unit: 'steps', description: 'Суточная активность' },
        { key: 'heart_rate', name: 'Мониторинг пульса', unit: 'bpm', description: 'Замеры ЧСС' },
        { key: 'spo2', name: 'SpO2 трекинг', unit: '%', description: 'Кислород в крови' },
      ],
    },
  ];

  public getProvidersRegistry(): IntegrationProvider[] {
    return this.providersRegistry;
  }

  // 2. CONNECTED SOURCES & DEVICES MANAGEMENT
  public async getConnectedSources(userId: string): Promise<ConnectedSource[]> {
    const userData = await canonicalDataLayer.getUserData(userId);
    const sources: ConnectedSource[] = userData?.connectedSources || [];

    // Evaluate stale status (lastSyncAt > 24h)
    const now = new Date().getTime();
    const updatedSources = sources.map((src) => {
      if (src.status === 'active' && src.lastSyncAt) {
        const lastSyncMs = new Date(src.lastSyncAt).getTime();
        if (now - lastSyncMs > 24 * 60 * 60 * 1000) {
          return {
            ...src,
            status: 'stale' as ConnectedSourceStatus,
            errorMessage: 'Данные устарели (синхронизация отсутствовала более 24 часов)',
          };
        }
      }
      return src;
    });

    return updatedSources;
  }

  public async getConnectedDevices(userId: string): Promise<DeviceEntity[]> {
    const userData = await canonicalDataLayer.getUserData(userId);
    return userData?.devices || [];
  }

  public async connectSource(userId: string, providerId: string): Promise<{ source: ConnectedSource; device: DeviceEntity }> {
    const provider = this.providersRegistry.find((p) => p.id === providerId);
    if (!provider) {
      throw new Error(`Неизвестный провайдер интеграции: ${providerId}`);
    }

    const userData = (await canonicalDataLayer.getUserData(userId)) || {
      profile: { id: userId },
      documents: [],
      appointments: [],
      dailyLogs: [],
      diaryEntries: [],
      pressureLogs: [],
      reminders: [],
      aiAnalysis: {},
    };

    const existingSources: ConnectedSource[] = userData.connectedSources || [];
    const existingDevices: DeviceEntity[] = userData.devices || [];

    const nowIso = new Date().toISOString();
    const sourceId = `cs-${providerId}-${Date.now().toString(36)}`;
    const deviceId = `dev-${providerId}-${Date.now().toString(36)}`;

    let deviceName = 'Виртуальный трекер';
    let model = 'Generic Mobile';
    if (providerId === 'apple_health') {
      deviceName = 'Apple Watch Series 9';
      model = 'A2980 Watch OS 10.4';
    } else if (providerId === 'health_connect') {
      deviceName = 'Google Pixel Watch 2';
      model = 'Wear OS 4.0';
    } else if (providerId === 'garmin') {
      deviceName = 'Garmin Forerunner 965';
      model = 'SW v18.23';
    } else if (providerId === 'oura') {
      deviceName = 'Oura Ring Gen3 Horizon';
      model = 'Firmware v2.9.12';
    } else if (providerId === 'withings') {
      deviceName = 'Withings Body Scan';
      model = 'Smart Scale HW 1.0';
    }

    const newSource: ConnectedSource = {
      id: sourceId,
      userId,
      providerId: provider.id,
      providerName: provider.name,
      status: 'active',
      lastSyncAt: nowIso,
      syncCursor: String(Date.now()),
      errorMessage: null,
      errorCode: null,
      createdTime: nowIso,
      settings: {
        autoSync: true,
        syncFrequencyMinutes: 15,
      },
    };

    const newDevice: DeviceEntity = {
      id: deviceId,
      sourceId,
      userId,
      providerId: provider.id,
      deviceName,
      model,
      firmwareVersion: '1.0.0',
      hardwareId: `HW-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      batteryLevel: 88,
      lastSeenAt: nowIso,
      isPrimaryTracker: existingDevices.length === 0,
    };

    // Filter out previous connection to same provider if reconnecting
    const updatedSources = [...existingSources.filter((s) => s.providerId !== providerId), newSource];
    const updatedDevices = [...existingDevices.filter((d) => d.providerId !== providerId), newDevice];

    await canonicalDataLayer.saveUserData(userId, {
      ...userData,
      connectedSources: updatedSources,
      devices: updatedDevices,
      updatedAt: nowIso,
    });

    return { source: newSource, device: newDevice };
  }

  public async disconnectSource(userId: string, sourceId: string): Promise<boolean> {
    const userData = await canonicalDataLayer.getUserData(userId);
    if (!userData) return false;

    const sources: ConnectedSource[] = userData.connectedSources || [];
    const devices: DeviceEntity[] = userData.devices || [];

    const updatedSources = sources.filter((s) => s.id !== sourceId);
    const updatedDevices = devices.filter((d) => d.sourceId !== sourceId);

    await canonicalDataLayer.saveUserData(userId, {
      ...userData,
      connectedSources: updatedSources,
      devices: updatedDevices,
      updatedAt: new Date().toISOString(),
    });

    return true;
  }

  // 3. COMPLETE 7-STAGE ADAPTER PIPELINE
  // Provider → Adapter → Raw/Staging → Validation → Normalization → Dedup → Canonical Entity
  public async executeAdapterPipeline(
    userId: string,
    providerId: string,
    rawBatchSamples: any[]
  ): Promise<SyncBatchResponse> {
    const provider = this.providersRegistry.find((p) => p.id === providerId);
    if (!provider) {
      throw new Error(`Неизвестный или неподдерживаемый провайдер: ${providerId}`);
    }

    const userData = (await canonicalDataLayer.getUserData(userId)) || {
      profile: { id: userId },
      documents: [],
      appointments: [],
      dailyLogs: [],
      diaryEntries: [],
      pressureLogs: [],
      reminders: [],
      aiAnalysis: {},
    };

    let sources: ConnectedSource[] = userData.connectedSources || [];
    let devices: DeviceEntity[] = userData.devices || [];
    let connectedSource = sources.find((s) => s.providerId === providerId && s.status !== 'disconnected');

    // Auto-register connected source if not connected yet
    if (!connectedSource) {
      const conn = await this.connectSource(userId, providerId);
      connectedSource = conn.source;
      const updatedData = await canonicalDataLayer.getUserData(userId);
      sources = updatedData?.connectedSources || [];
      devices = updatedData?.devices || [];
    }

    const connectedDevice = devices.find((d) => d.sourceId === connectedSource!.id);
    const existingMetrics: CanonicalMetricSample[] = userData.wearablesSyncs || [];

    const pipelineStats = {
      receivedCount: rawBatchSamples.length,
      stagedCount: 0,
      validatedCount: 0,
      normalizedCount: 0,
      deduplicatedCount: 0,
      canonicalCommittedCount: 0,
      quarantinedCount: 0,
    };

    const canonicalCommitted: CanonicalMetricSample[] = [];
    const quarantinedSamples: { raw: any; reason: string }[] = [];
    const nowIso = new Date().toISOString();

    for (const rawSample of rawBatchSamples) {
      // STEP 1 & 2: PROVIDER & ADAPTER PARSING
      pipelineStats.stagedCount++;

      // STEP 3: RAW / STAGING EXTRACTION
      const metricTypeRaw = rawSample.type || rawSample.metricType || rawSample.sampleType;
      const valueRaw = rawSample.value ?? rawSample.numericValue;
      const unitRaw = rawSample.unit || 'unit';
      const timestampRaw = rawSample.timestamp || rawSample.date || rawSample.time || nowIso;

      // STEP 4: PHYSIOLOGICAL RANGE VALIDATION & CANONICAL TYPE DETECTOR
      let isValid = true;
      let quarantineReason = '';

      if (valueRaw === null || valueRaw === undefined || isNaN(Number(valueRaw))) {
        isValid = false;
        quarantineReason = 'Пустое или некорректное числовое значение метрики';
      }

      const numVal = Number(valueRaw);
      const mTypeLower = String(metricTypeRaw).toLowerCase();

      // DETERMINE CANONICAL TYPE FIRST FOR EXACT BOUNDS VALIDATION
      let targetType: CanonicalMetricType = 'heart_rate';

      if (mTypeLower.includes('resting') && (mTypeLower.includes('heart') || mTypeLower.includes('hr') || mTypeLower.includes('rhr'))) {
        targetType = 'resting_heart_rate';
      } else if (mTypeLower.includes('heart') || mTypeLower.includes('pulse') || mTypeLower.includes('hr')) {
        if (mTypeLower.includes('variability') || mTypeLower.includes('hrv') || mTypeLower.includes('rmssd')) {
          targetType = 'hrv';
        } else {
          targetType = 'heart_rate';
        }
      } else if (mTypeLower.includes('hrv') || mTypeLower.includes('rmssd') || mTypeLower.includes('sdnn')) {
        targetType = 'hrv';
      } else if (mTypeLower.includes('bp') || mTypeLower.includes('pressure') || mTypeLower.includes('systolic') || mTypeLower.includes('diastolic')) {
        targetType = 'blood_pressure';
      } else if (mTypeLower.includes('spo2') || mTypeLower.includes('oxygen') || mTypeLower.includes('pulse_ox')) {
        targetType = 'spo2';
      } else if (mTypeLower.includes('weight') || mTypeLower.includes('body_mass') || mTypeLower.includes('mass')) {
        targetType = 'weight';
      } else if (mTypeLower.includes('composition') || mTypeLower.includes('bioimpedance') || mTypeLower.includes('fat_percentage') || mTypeLower.includes('body_fat')) {
        targetType = 'body_composition';
      } else if (mTypeLower.includes('sleep_score') || mTypeLower.includes('vendor_sleep') || mTypeLower.includes('score_sleep') || mTypeLower.includes('readiness')) {
        targetType = 'vendor_sleep_score';
      } else if (mTypeLower.includes('sleep')) {
        targetType = 'sleep_session';
      } else if (mTypeLower.includes('step') || mTypeLower.includes('cadence')) {
        targetType = 'steps';
      } else if (mTypeLower.includes('workout') || mTypeLower.includes('exercise') || mTypeLower.includes('training') || mTypeLower.includes('run') || mTypeLower.includes('swim')) {
        targetType = 'workout';
      } else if (mTypeLower.includes('vo2') || mTypeLower.includes('cardio_fitness')) {
        targetType = 'vo2_max';
      } else if (mTypeLower.includes('basal') && mTypeLower.includes('temp')) {
        targetType = 'basal_temperature';
      } else if ((mTypeLower.includes('wrist') || mTypeLower.includes('skin') || mTypeLower.includes('surface')) && mTypeLower.includes('temp')) {
        targetType = 'wrist_temperature';
      } else if (mTypeLower.includes('temp')) {
        targetType = 'body_temperature';
      } else if (mTypeLower.includes('respiratory') || mTypeLower.includes('respiration') || mTypeLower.includes('breaths')) {
        targetType = 'respiratory_rate';
      } else if (mTypeLower.includes('cycle') || mTypeLower.includes('period') || mTypeLower.includes('menstruat') || mTypeLower.includes('ovulation')) {
        targetType = 'cycle_record';
      } else if (mTypeLower.includes('nutrition') || mTypeLower.includes('hydration') || mTypeLower.includes('water') || mTypeLower.includes('macro')) {
        targetType = 'nutrition_hydration';
      } else if (mTypeLower.includes('glucose')) {
        targetType = 'glucose';
      }

      // PHYSIOLOGICAL RANGE VALIDATION PER CANONICAL TYPE
      if (isValid) {
        if (targetType === 'heart_rate' && (numVal < 30 || numVal > 250)) {
          isValid = false;
          quarantineReason = `Пульс вне физиологического диапазона (30-250 bpm): ${numVal}`;
        } else if (targetType === 'resting_heart_rate' && (numVal < 30 || numVal > 150)) {
          isValid = false;
          quarantineReason = `ЧСС в покое вне диапазона (30-150 bpm): ${numVal}`;
        } else if (targetType === 'hrv' && (numVal < 1 || numVal > 350)) {
          isValid = false;
          quarantineReason = `HRV вне диапазона (1-350 ms): ${numVal}`;
        } else if (targetType === 'blood_pressure') {
          const sys = rawSample.systolic || numVal;
          const dia = rawSample.diastolic || rawSample.valueComponents?.diastolic;
          if (sys && (sys < 50 || sys > 260)) {
            isValid = false;
            quarantineReason = `Систолическое АД вне диапазона (50-260 mmHg): ${sys}`;
          } else if (dia && (dia < 30 || dia > 180)) {
            isValid = false;
            quarantineReason = `Диастолическое АД вне диапазона (30-180 mmHg): ${dia}`;
          }
        } else if (targetType === 'spo2' && (numVal < 50 || numVal > 100)) {
          isValid = false;
          quarantineReason = `Насыщение кислородом SpO2 вне диапазона (50-100%): ${numVal}`;
        } else if (targetType === 'weight' && (numVal < 2.0 || numVal > 500.0)) {
          isValid = false;
          quarantineReason = `Масса тела вне диапазона (2.0-500.0 кг): ${numVal}`;
        } else if (targetType === 'sleep_session' && (numVal < 0 || numVal > 24)) {
          isValid = false;
          quarantineReason = `Продолжительность сна вне диапазона (0-24 ч): ${numVal}`;
        } else if (targetType === 'body_temperature' && (numVal < 30.0 || numVal > 45.0)) {
          isValid = false;
          quarantineReason = `Температура тела вне диапазона (30.0-45.0 °C): ${numVal}`;
        } else if (targetType === 'basal_temperature' && (numVal < 34.0 || numVal > 40.0)) {
          isValid = false;
          quarantineReason = `Базальная температура вне диапазона (34.0-40.0 °C): ${numVal}`;
        } else if (targetType === 'respiratory_rate' && (numVal < 4 || numVal > 60)) {
          isValid = false;
          quarantineReason = `Частота дыхания вне диапазона (4-60 вд/мин): ${numVal}`;
        } else if (targetType === 'vo2_max' && (numVal < 10 || numVal > 95)) {
          isValid = false;
          quarantineReason = `VO2 max вне диапазона (10-95 мл/кг/мин): ${numVal}`;
        }
      }

      if (!isValid) {
        pipelineStats.quarantinedCount++;
        quarantinedSamples.push({ raw: rawSample, reason: quarantineReason });
        continue;
      }

      pipelineStats.validatedCount++;

      // STEP 5: NORMALIZATION & VALUE COMPONENTS BUILDING
      let normalizedMetricType = targetType;
      let normalizedValue = numVal;
      let normalizedUnit = unitRaw;
      let valueComponents: ValueComponents | undefined = undefined;

      switch (targetType) {
        case 'heart_rate':
          normalizedUnit = 'bpm';
          break;
        case 'resting_heart_rate':
          normalizedUnit = 'bpm';
          break;
        case 'hrv':
          normalizedUnit = 'ms';
          break;
        case 'blood_pressure':
          normalizedUnit = 'mmHg';
          valueComponents = {
            systolic: Number(rawSample.systolic || rawSample.valueComponents?.systolic || numVal),
            diastolic: Number(rawSample.diastolic || rawSample.valueComponents?.diastolic || 80),
            pulse: rawSample.pulse ? Number(rawSample.pulse) : undefined,
          };
          normalizedValue = valueComponents.systolic || numVal;
          break;
        case 'spo2':
          normalizedUnit = '%';
          break;
        case 'weight':
          normalizedUnit = 'kg';
          if (unitRaw.toLowerCase().includes('lb')) {
            normalizedValue = Math.round(numVal * 0.45359237 * 10) / 10;
          } else if (unitRaw.toLowerCase().includes('st')) {
            normalizedValue = Math.round(numVal * 6.35029 * 10) / 10;
          }
          break;
        case 'body_composition':
          normalizedUnit = '%';
          valueComponents = {
            fatPercentage: rawSample.fatPercentage ?? numVal,
            fatMassKg: rawSample.fatMassKg,
            muscleMassKg: rawSample.muscleMassKg,
            boneMassKg: rawSample.boneMassKg,
            waterPercentage: rawSample.waterPercentage,
          };
          normalizedValue = valueComponents.fatPercentage || numVal;
          break;
        case 'sleep_session':
          normalizedUnit = 'hours';
          valueComponents = {
            durationMinutes: rawSample.durationMinutes ?? Math.round(numVal * 60),
            deepSleepMinutes: rawSample.deepSleepMinutes ?? Math.round(numVal * 60 * 0.25),
            remSleepMinutes: rawSample.remSleepMinutes ?? Math.round(numVal * 60 * 0.20),
            lightSleepMinutes: rawSample.lightSleepMinutes ?? Math.round(numVal * 60 * 0.45),
            awakeMinutes: rawSample.awakeMinutes ?? Math.round(numVal * 60 * 0.10),
          };
          break;
        case 'vendor_sleep_score':
          normalizedUnit = 'score';
          const scaleMax = Number(rawSample.scaleMax || 100);
          const rawScoreVal = numVal;
          valueComponents = {
            vendorSleepScore: {
              rawScore: rawScoreVal,
              scaleMax,
              scoreName: rawSample.scoreName || `${provider.name} Sleep Index`,
              vendor: provider.id,
              normalizationVersion: 'v1.0-vendor-preserved',
              normalizedPercent: Math.min(100, Math.max(0, Math.round((rawScoreVal / scaleMax) * 100))),
              normalizationFormula: '(rawScore / scaleMax) * 100',
              notes: 'Vendor sleep score preserved with explicit versioned normalization (v1.0-vendor-preserved) without lossy blending across different vendors.',
            },
          };
          break;
        case 'steps':
          normalizedUnit = 'steps';
          valueComponents = {
            activeCalories: rawSample.activeCalories,
            activeMinutes: rawSample.activeMinutes,
            distanceMeters: rawSample.distanceMeters,
          };
          break;
        case 'workout':
          normalizedUnit = 'kcal';
          valueComponents = {
            activityType: rawSample.activityType || 'general_workout',
            durationSeconds: rawSample.durationSeconds || Math.round(numVal * 60),
            activeCalories: numVal,
            avgHeartRate: rawSample.avgHeartRate,
            maxHeartRate: rawSample.maxHeartRate,
            distanceMeters: rawSample.distanceMeters,
          };
          break;
        case 'vo2_max':
          normalizedUnit = 'mL/kg/min';
          break;
        case 'body_temperature':
          normalizedUnit = '°C';
          if (unitRaw.toLowerCase().includes('f')) {
            normalizedValue = Math.round((((numVal - 32) * 5) / 9) * 10) / 10;
          }
          break;
        case 'basal_temperature':
          normalizedUnit = '°C';
          if (unitRaw.toLowerCase().includes('f')) {
            normalizedValue = Math.round((((numVal - 32) * 5) / 9) * 10) / 10;
          }
          break;
        case 'wrist_temperature':
          normalizedUnit = '°C';
          valueComponents = {
            baselineDeviationDegreesC: rawSample.baselineDeviationDegreesC ?? numVal,
          };
          break;
        case 'respiratory_rate':
          normalizedUnit = 'breaths/min';
          break;
        case 'cycle_record':
          normalizedUnit = 'day';
          valueComponents = {
            cycleDay: rawSample.cycleDay || numVal,
            cyclePhase: rawSample.cyclePhase || 'follicular',
            flowLevel: rawSample.flowLevel || 'light',
          };
          break;
        case 'nutrition_hydration':
          normalizedUnit = 'ml';
          valueComponents = {
            waterMl: rawSample.waterMl || numVal,
            caloriesKcal: rawSample.caloriesKcal,
            proteinGrams: rawSample.proteinGrams,
            carbsGrams: rawSample.carbsGrams,
            fatGrams: rawSample.fatGrams,
          };
          break;
        case 'glucose':
          normalizedUnit = 'mmol/L';
          if (unitRaw.toLowerCase().includes('mg')) {
            normalizedValue = Math.round((numVal / 18.0182) * 10) / 10;
          }
          break;
      }

      // Convert timestamp to standard ISO UTC
      let sampleIsoTime = nowIso;
      try {
        const d = new Date(timestampRaw);
        if (!isNaN(d.getTime())) {
          sampleIsoTime = d.toISOString();
        }
      } catch {
        sampleIsoTime = nowIso;
      }

      pipelineStats.normalizedCount++;

      // STEP 6: IDEMPOTENCY & DEDUPLICATION
      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${providerId}:${connectedDevice?.hardwareId || 'gen'}:${normalizedMetricType}:${sampleIsoTime}:${normalizedValue}`)
        .digest('hex');

      const isDuplicate = existingMetrics.some(
        (m) => m.provenance?.idempotencyKey === idempotencyKey
      ) || canonicalCommitted.some(
        (m) => m.provenance?.idempotencyKey === idempotencyKey
      );

      if (isDuplicate) {
        pipelineStats.deduplicatedCount++;
        continue;
      }

      // STEP 7: CANONICAL ENTITY INGESTION WITH FULL PROVENANCE
      const canonicalSample: CanonicalMetricSample = {
        id: `ms-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        userId,
        metricType: normalizedMetricType,
        value: normalizedValue,
        valueComponents,
        unit: normalizedUnit,
        timestamp: sampleIsoTime,
        provenance: {
          providerId,
          providerName: provider.name,
          sourceId: connectedSource.id,
          deviceId: connectedDevice?.id,
          deviceName: connectedDevice?.deviceName || provider.name,
          idempotencyKey,
          ingestedAt: nowIso,
        },
      };

      canonicalCommitted.push(canonicalSample);
      pipelineStats.canonicalCommittedCount++;
    }

    // Update Connected Source sync status, cursor, and last sync timestamp
    const updatedSource: ConnectedSource = {
      ...connectedSource,
      status: 'active',
      lastSyncAt: nowIso,
      syncCursor: String(Date.now()),
      errorMessage: null,
      errorCode: null,
    };

    const allSources = sources.map((s) => (s.id === updatedSource.id ? updatedSource : s));
    const allMetrics = [...existingMetrics, ...canonicalCommitted];

    await canonicalDataLayer.saveUserData(userId, {
      ...userData,
      connectedSources: allSources,
      wearablesSyncs: allMetrics,
      updatedAt: nowIso,
    });

    return {
      success: true,
      pipelineStats,
      canonicalSamples: canonicalCommitted,
      quarantinedSamples,
      connectedSource: updatedSource,
    };
  }
}

export const integrationsService = new IntegrationsService();
