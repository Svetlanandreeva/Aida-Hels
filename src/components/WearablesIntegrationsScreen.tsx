import React, { useState, useEffect } from 'react';
import {
  Watch,
  Smartphone,
  Activity,
  Heart,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  Wifi,
  WifiOff,
  BatteryCharging,
  Sliders,
  Scale,
  Disc,
  Flame,
  Zap,
  Info,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  Filter,
} from 'lucide-react';

export interface ProviderCapability {
  key: string;
  name: string;
  unit: string;
  description: string;
}

export interface IntegrationProvider {
  id: string;
  name: string;
  status: 'supported' | 'preview_bridge' | 'partner_pending';
  statusMessage: string;
  category: 'mobile_os' | 'smart_watch' | 'fitness_tracker' | 'ring' | 'smart_scale';
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
  status: 'active' | 'syncing' | 'stale' | 'error' | 'disconnected';
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

interface WearablesIntegrationsScreenProps {
  onBackToDashboard?: () => void;
}

export const WearablesIntegrationsScreen: React.FC<WearablesIntegrationsScreenProps> = ({
  onBackToDashboard,
}) => {
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [connectedSources, setConnectedSources] = useState<ConnectedSource[]>([]);
  const [devices, setDevices] = useState<DeviceEntity[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [lastSyncResult, setLastSyncResult] = useState<any | null>(null);

  // Load Integration Data
  const loadIntegrationsData = async () => {
    setIsLoading(true);
    try {
      const [provRes, srcRes, devRes] = await Promise.all([
        fetch('/api/integrations/providers').then((r) => r.json()),
        fetch('/api/integrations/connected-sources').then((r) => r.json()),
        fetch('/api/integrations/devices').then((r) => r.json()),
      ]);

      if (provRes.success) setProviders(provRes.providers || []);
      if (srcRes.success) setConnectedSources(srcRes.sources || []);
      if (devRes.success) setDevices(devRes.devices || []);
    } catch (err) {
      console.error('Error loading integrations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrationsData();
  }, []);

  // Connect Provider Source
  const handleConnectProvider = async (providerId: string) => {
    try {
      const res = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });
      const data = await res.json();
      if (data.success) {
        await loadIntegrationsData();
      }
    } catch (err) {
      console.error('Connect error:', err);
    }
  };

  // Disconnect Source
  const handleDisconnectSource = async (sourceId: string) => {
    try {
      const res = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (data.success) {
        await loadIntegrationsData();
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  // Trigger Simulated Batch Sync through 7-stage adapter pipeline
  const handleTriggerSimulatedBatchSync = async (providerId: string = 'apple_health') => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/integrations/simulate-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });
      const data = await res.json();
      setLastSyncResult(data);
      await loadIntegrationsData();
    } catch (err) {
      console.error('Batch sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter Providers
  const filteredProviders = providers.filter((p) => {
    if (activeCategoryFilter === 'all') return true;
    if (activeCategoryFilter === 'supported') return p.status === 'supported';
    if (activeCategoryFilter === 'partner_pending') return p.status === 'partner_pending';
    return p.category === activeCategoryFilter;
  });

  const renderProviderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Apple':
        return <Activity className="w-5 h-5 text-gray-200" />;
      case 'Smartphone':
        return <Smartphone className="w-5 h-5 text-emerald-400" />;
      case 'Watch':
        return <Watch className="w-5 h-5 text-[#3DD9C5]" />;
      case 'Scale':
        return <Scale className="w-5 h-5 text-purple-400" />;
      case 'Disc':
        return <Disc className="w-5 h-5 text-amber-400" />;
      case 'Flame':
        return <Flame className="w-5 h-5 text-rose-400" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-sky-400" />;
      default:
        return <Cpu className="w-5 h-5 text-[#3DD9C5]" />;
    }
  };

  const renderSourceStatusBadge = (status: ConnectedSource['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Активен (Live)</span>
          </span>
        );
      case 'stale':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
            <Clock className="w-3 h-3" />
            <span>Данные устарели (&gt;24ч)</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold">
            <AlertTriangle className="w-3 h-3" />
            <span>Ошибка синхронизации</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-500/15 border border-gray-500/30 text-gray-400 text-[11px] font-bold">
            <WifiOff className="w-3 h-3" />
            <span>Отключен</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 text-gray-100">
      {/* HEADER & OVERVIEW */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#111C30] to-[#0F172A] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3DD9C5]/10 border border-[#3DD9C5]/30 text-[#3DD9C5] text-xs font-bold uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5" />
              <span>Adapter Architecture Pipeline & Devices Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Интеграции и носимые устройства (Wearables)
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 max-w-2xl leading-relaxed">
              Адаптивный конвейер непрерывной телеметрии: прямая синхронизация с Apple HealthKit, Android Health Connect и реестр корпоративных партнёров.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleTriggerSimulatedBatchSync('apple_health')}
              disabled={isSyncing}
              className="px-5 py-3 bg-[#3DD9C5] hover:bg-[#34c4b1] text-black font-extrabold text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Синхронизация...' : 'Запустить Batch Sync'}</span>
            </button>
          </div>
        </div>

        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
          <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
            <span className="text-gray-400 block text-[10px]">Подключенные источники</span>
            <span className="text-lg font-bold text-white mt-0.5 block">{connectedSources.length}</span>
          </div>
          <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
            <span className="text-gray-400 block text-[10px]">Привязанные устройства</span>
            <span className="text-lg font-bold text-[#3DD9C5] mt-0.5 block">{devices.length}</span>
          </div>
          <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
            <span className="text-gray-400 block text-[10px]">Зарегистрированные провайдеры</span>
            <span className="text-lg font-bold text-purple-300 mt-0.5 block">{providers.length}</span>
          </div>
          <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
            <span className="text-gray-400 block text-[10px]">Статус последней синхронизации</span>
            <span className="text-xs font-bold text-emerald-400 mt-1 block flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Синхронизировано</span>
            </span>
          </div>
        </div>
      </div>

      {/* ADAPTER ARCHITECTURE SCHEME (PIPELINE STEP BREADCRUMBS) */}
      <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#3DD9C5]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              7-этапная архитектурная цепь обработки (Adapter Architecture Pipeline)
            </h3>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            Provider → Adapter → Raw/Staging → Validation → Normalization → Dedup → Canonical Entity
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1 text-center">
          {[
            { step: '1. Provider', desc: 'Apple/Android SDK' },
            { step: '2. Adapter', desc: 'Парсинг структуры' },
            { step: '3. Staging', desc: 'Хранение сырого лога' },
            { step: '4. Validation', desc: 'Диапазоны физиологии' },
            { step: '5. Normalize', desc: 'Перевод ед. и ISO UTC' },
            { step: '6. Dedup', desc: 'SHA-256 Idempotency' },
            { step: '7. Canonical', desc: 'Медкарта & Provenance' },
          ].map((item, idx) => (
            <div
              key={item.step}
              className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-left space-y-0.5"
            >
              <span className="text-[10px] font-bold text-[#3DD9C5] block">{item.step}</span>
              <span className="text-[10px] text-gray-400 block truncate">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* LAST BATCH SYNC RESULT NOTIFICATION & CANONICAL METRIC SAMPLES */}
      {lastSyncResult && (
        <div className="p-5 bg-[#111C30] border border-[#3DD9C5]/30 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3DD9C5]" />
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                Результат прохождения конвейера (Batch Sync Stats)
              </h4>
            </div>
            <span className="text-[10px] text-[#3DD9C5] font-mono px-2.5 py-0.5 rounded-full bg-[#3DD9C5]/10 border border-[#3DD9C5]/30">
              Источник: {lastSyncResult.connectedSource?.providerName}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px]">
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="text-gray-400 block text-[10px]">Получено:</span>
              <strong className="text-white text-sm">{lastSyncResult.pipelineStats?.receivedCount}</strong>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="text-gray-400 block text-[10px]">Проверено (Valid):</span>
              <strong className="text-emerald-400 text-sm">{lastSyncResult.pipelineStats?.validatedCount}</strong>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="text-gray-400 block text-[10px]">Нормализовано:</span>
              <strong className="text-purple-300 text-sm">{lastSyncResult.pipelineStats?.normalizedCount}</strong>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="text-gray-400 block text-[10px]">Дубликаты (Dedup):</span>
              <strong className="text-amber-300 text-sm">{lastSyncResult.pipelineStats?.deduplicatedCount}</strong>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="text-gray-400 block text-[10px]">В медкарту:</span>
              <strong className="text-[#3DD9C5] text-sm font-extrabold">{lastSyncResult.pipelineStats?.canonicalCommittedCount}</strong>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="text-gray-400 block text-[10px]">Карантин:</span>
              <strong className="text-rose-400 text-sm">{lastSyncResult.pipelineStats?.quarantinedCount}</strong>
            </div>
          </div>

          {/* CANONICAL COMMITTED SAMPLES DETAIL */}
          {Array.isArray(lastSyncResult.canonicalSamples) && lastSyncResult.canonicalSamples.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-white">
                  Канонические образцы замеров (Canonical Metrics) — {lastSyncResult.canonicalSamples.length}:
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  Schema Version: v1.0 Canonical Mapping
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {lastSyncResult.canonicalSamples.map((sample: any) => {
                  const isVendorScore = sample.metricType === 'vendor_sleep_score';
                  const vScore = sample.valueComponents?.vendorSleepScore;

                  return (
                    <div
                      key={sample.id}
                      className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md bg-[#3DD9C5]/10 border border-[#3DD9C5]/30 text-[#3DD9C5] text-[10px] font-mono uppercase font-bold">
                          {sample.metricType}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(sample.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* VALUE DISPLAY */}
                      <div className="flex items-baseline justify-between pt-1">
                        <div className="space-y-0.5">
                          {isVendorScore && vScore ? (
                            <div className="space-y-1">
                              <span className="text-xs text-gray-300 font-bold block">{vScore.scoreName}</span>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xl font-extrabold text-purple-300">{vScore.rawScore}</span>
                                <span className="text-xs text-gray-400">/ {vScore.scaleMax}</span>
                                <span className="text-xs font-mono text-emerald-400 ml-2">({vScore.normalizedPercent}%)</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xl font-extrabold text-white">
                                {sample.metricType === 'blood_pressure' && sample.valueComponents
                                  ? `${sample.valueComponents.systolic}/${sample.valueComponents.diastolic}`
                                  : sample.value}
                              </span>
                              <span className="text-xs text-gray-400">{sample.unit}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* SPECIALIZED COMPONENTS DETAILS */}
                      {sample.valueComponents && !isVendorScore && (
                        <div className="p-2 rounded-lg bg-black/20 text-[10px] font-mono text-gray-300 space-y-0.5">
                          {sample.valueComponents.systolic && sample.valueComponents.diastolic && (
                            <div>АД: {sample.valueComponents.systolic}/{sample.valueComponents.diastolic} mmHg {sample.valueComponents.pulse ? `| ЧСС: ${sample.valueComponents.pulse} bpm` : ''}</div>
                          )}
                          {sample.valueComponents.fatPercentage !== undefined && (
                            <div>Жир: {sample.valueComponents.fatPercentage}% | Мышцы: {sample.valueComponents.muscleMassKg}кг</div>
                          )}
                          {sample.valueComponents.durationMinutes !== undefined && (
                            <div>Длительность: {sample.valueComponents.durationMinutes} мин (Глубокий: {sample.valueComponents.deepSleepMinutes}м, REM: {sample.valueComponents.remSleepMinutes}м)</div>
                          )}
                          {sample.valueComponents.activityType && (
                            <div>Вид: {sample.valueComponents.activityType} | Калории: {sample.valueComponents.activeCalories} kcal</div>
                          )}
                          {sample.valueComponents.baselineDeviationDegreesC !== undefined && (
                            <div>Отклонение кожи: {sample.valueComponents.baselineDeviationDegreesC > 0 ? '+' : ''}{sample.valueComponents.baselineDeviationDegreesC} °C</div>
                          )}
                          {sample.valueComponents.cycleDay !== undefined && (
                            <div>День цикла: {sample.valueComponents.cycleDay} | Фаза: {sample.valueComponents.cyclePhase}</div>
                          )}
                        </div>
                      )}

                      {/* VENDOR SCORE PRESERVATION BADGE */}
                      {isVendorScore && vScore && (
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] space-y-1">
                          <div className="flex items-center justify-between text-purple-200 font-bold">
                            <span>Шкала провайдера сорт.</span>
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/30 font-mono text-[9px] text-purple-100">
                              {vScore.normalizationVersion}
                            </span>
                          </div>
                          <p className="text-gray-300 leading-tight text-[9px] font-mono">
                            {vScore.notes}
                          </p>
                        </div>
                      )}

                      {/* PROVENANCE FOOTER */}
                      <div className="text-[9px] font-mono text-gray-400 pt-1 border-t border-white/5 flex items-center justify-between truncate">
                        <span className="truncate">Датчик: {sample.provenance?.deviceName || sample.provenance?.providerName}</span>
                        <span className="text-[#3DD9C5] font-bold">ID: {sample.provenance?.idempotencyKey?.substring(0, 8)}...</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 1: CONNECTED SOURCES & DEVICES */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-[#3DD9C5]" />
            <h2 className="text-lg font-bold text-white">
              Подключенные платформы и устройства ({connectedSources.length})
            </h2>
          </div>
        </div>

        {connectedSources.length === 0 ? (
          <div className="p-8 text-center bg-[#111827]/60 border border-dashed border-white/10 rounded-2xl space-y-2 text-gray-400 text-xs">
            <Watch className="w-8 h-8 text-gray-500 mx-auto" />
            <p className="font-semibold text-white">Подключенных носимых устройств пока нет</p>
            <p className="text-gray-400 max-w-md mx-auto">
              Выберите Apple Health, Android Health Connect или сторонний гаджет из каталога ниже для быстрой привязки.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectedSources.map((source) => {
              const matchedDevice = devices.find((d) => d.sourceId === source.id);
              return (
                <div
                  key={source.id}
                  className="p-5 rounded-2xl bg-[#111827] border border-white/10 space-y-4 hover:border-white/20 transition-all shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white">
                        {renderProviderIcon(source.providerId === 'apple_health' ? 'Apple' : 'Watch')}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{source.providerName}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {renderSourceStatusBadge(source.status)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDisconnectSource(source.id)}
                      className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer text-xs flex items-center gap-1"
                      title="Отключить источник"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Отключить</span>
                    </button>
                  </div>

                  {/* DEVICE INFO CARD */}
                  {matchedDevice && (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-gray-200">
                        <div className="flex items-center gap-1.5">
                          <Watch className="w-3.5 h-3.5 text-[#3DD9C5]" />
                          <span>{matchedDevice.deviceName}</span>
                        </div>
                        {matchedDevice.batteryLevel !== null && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                            <BatteryCharging className="w-3.5 h-3.5" />
                            <span>{matchedDevice.batteryLevel}%</span>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 font-mono">
                        <div>
                          Модель: <span className="text-gray-200">{matchedDevice.model}</span>
                        </div>
                        <div>
                          HW ID: <span className="text-gray-200">{matchedDevice.hardwareId}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SYNC METADATA & CURSOR */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 pt-1 border-t border-white/5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        Синхронизировано:{' '}
                        {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString('ru-RU') : 'Никогда'}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleTriggerSimulatedBatchSync(source.providerId)}
                      disabled={isSyncing}
                      className="text-[#3DD9C5] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Синхронизировать сейчас</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: CAPABILITY REGISTRY (ALL PROVIDERS) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">
              Реестр совместимости платформ (Capability Registry)
            </h2>
          </div>

          {/* FILTER CATEGORY TABS */}
          <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-white/10 overflow-x-auto text-xs no-scrollbar">
            {[
              { id: 'all', label: 'Все' },
              { id: 'supported', label: 'Активные (Live)' },
              { id: 'partner_pending', label: 'Ожидают согласования' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategoryFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategoryFilter === tab.id
                    ? 'bg-[#3DD9C5] text-black font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* PROVIDER CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map((provider) => {
            const isConnected = connectedSources.some(
              (s) => s.providerId === provider.id && s.status !== 'disconnected'
            );

            return (
              <div
                key={provider.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 flex flex-col justify-between ${
                  provider.status === 'supported'
                    ? 'bg-[#111827] border-white/10 hover:border-[#3DD9C5]/40'
                    : 'bg-[#0E1524]/60 border-white/5 opacity-90'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white">
                        {renderProviderIcon(provider.iconName)}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{provider.name}</h3>
                        <span className="text-[10px] text-gray-400 block uppercase font-mono">
                          Тип: {provider.category}
                        </span>
                      </div>
                    </div>

                    {/* STATUS BADGE */}
                    {provider.status === 'supported' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold whitespace-nowrap">
                        Адаптер активен
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold whitespace-nowrap">
                        Ожидает API
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">{provider.statusMessage}</p>

                  {/* CAPABILITIES LIST CHIPS */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                      Поддерживаемые показатели ({provider.capabilities.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {provider.capabilities.map((cap) => (
                        <span
                          key={cap.key}
                          className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] font-medium text-gray-300"
                          title={cap.description}
                        >
                          {cap.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2 mt-4 text-xs">
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-400 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    <span>Документация</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {provider.status === 'supported' ? (
                    isConnected ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Подключено</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleConnectProvider(provider.id)}
                        className="px-4 py-1.5 bg-[#3DD9C5] hover:bg-[#34c4b1] text-black font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Подключить</span>
                      </button>
                    )
                  ) : (
                    <span className="text-[11px] text-amber-400/80 italic">
                      Заявка в обработке
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WearablesIntegrationsScreen;
