import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  HeartPulse,
  Link2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Watch,
  WifiOff,
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
  settings: { autoSync: boolean; syncFrequencyMinutes: number };
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

const providerIcon = (provider: IntegrationProvider) => {
  if (provider.category === 'mobile_os') return Smartphone;
  if (provider.category === 'smart_watch' || provider.category === 'fitness_tracker') return Watch;
  return Activity;
};

const formatSync = (value: string | null) => {
  if (!value) return 'Данных о синхронизации пока нет';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Время синхронизации неизвестно';
  return `Последняя синхронизация: ${date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
};

export const WearablesIntegrationsScreen: React.FC<WearablesIntegrationsScreenProps> = ({ onBackToDashboard }) => {
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [sources, setSources] = useState<ConnectedSource[]>([]);
  const [devices, setDevices] = useState<DeviceEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [provRes, srcRes, devRes] = await Promise.all([
        fetch('/api/integrations/providers').then((r) => r.json()),
        fetch('/api/integrations/connected-sources').then((r) => r.json()),
        fetch('/api/integrations/devices').then((r) => r.json()),
      ]);
      if (provRes.success) setProviders(provRes.providers || []);
      if (srcRes.success) setSources(srcRes.sources || []);
      if (devRes.success) setDevices(devRes.devices || []);
    } catch {
      setError('Не удалось загрузить подключённые источники. Попробуйте ещё раз.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const sourceByProvider = useMemo(() => new Map(sources.map((s) => [s.providerId, s])), [sources]);
  const activeSources = sources.filter((s) => s.status === 'active' || s.status === 'syncing').length;
  const lastSynced = sources.map((s) => s.lastSyncAt).filter((v): v is string => Boolean(v)).sort().at(-1) || null;

  const connect = async (providerId: string) => {
    setBusyProvider(providerId);
    try {
      const res = await fetch('/api/integrations/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error();
      await loadData();
    } catch {
      setError('Подключение не завершилось. Проверьте доступ и повторите попытку.');
    } finally { setBusyProvider(null); }
  };

  const disconnect = async (sourceId: string, providerId: string) => {
    setBusyProvider(providerId);
    try {
      const res = await fetch('/api/integrations/disconnect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error();
      await loadData();
    } catch {
      setError('Не удалось отключить источник. Повторите попытку.');
    } finally { setBusyProvider(null); }
  };

  return (
    <div className="aida-integrations-page">
      <header className="aida-integrations-hero">
        <div>
          {onBackToDashboard && <button className="aida-page-back" onClick={onBackToDashboard}><ArrowLeft size={16}/> На главную</button>}
          <span className="aida-page-eyebrow"><HeartPulse/> Данные здоровья</span>
          <h1>Подключённые устройства</h1>
          <p>Собирайте показатели из часов, телефона и других источников в одном месте. Аида использует только те данные, которые реально поступили от подключённого источника.</p>
        </div>
        <button className="aida-secondary-action" onClick={loadData} disabled={isLoading}><RefreshCw size={16} className={isLoading ? 'spin' : ''}/> Обновить</button>
      </header>

      <section className="aida-integrations-summary">
        <article><small>Активные источники</small><strong>{activeSources}</strong><span>из {sources.length} подключённых</span></article>
        <article><small>Устройства</small><strong>{devices.length}</strong><span>видимых сейчас</span></article>
        <article><small>Последние данные</small><strong>{lastSynced ? 'Есть' : 'Нет'}</strong><span>{formatSync(lastSynced)}</span></article>
      </section>

      {error && <div className="aida-integrations-error"><AlertCircle size={18}/><span>{error}</span></div>}

      <section className="aida-integrations-panel">
        <div className="aida-integrations-panel-head">
          <div><span className="aida-page-eyebrow"><Link2/> Источники</span><h2>Доступные подключения</h2></div>
          <p>Подключение не означает, что все показатели уже доступны: если источник ещё не прислал данные, Аида покажет «Нет данных».</p>
        </div>

        {isLoading ? (
          <div className="aida-integrations-empty"><RefreshCw className="spin"/><strong>Загружаем источники…</strong></div>
        ) : providers.length === 0 ? (
          <div className="aida-integrations-empty"><WifiOff/><strong>Доступных источников пока нет</strong><span>Когда интеграции будут доступны, они появятся здесь.</span></div>
        ) : (
          <div className="aida-provider-grid">
            {providers.map((provider) => {
              const Icon = providerIcon(provider);
              const source = sourceByProvider.get(provider.id);
              const connected = Boolean(source && source.status !== 'disconnected');
              const canConnect = provider.status === 'supported';
              return (
                <article className="aida-provider-card" key={provider.id}>
                  <div className="aida-provider-icon"><Icon/></div>
                  <div className="aida-provider-main">
                    <div className="aida-provider-title"><h3>{provider.name}</h3>{connected ? <span className="ok"><CheckCircle2/> Подключено</span> : <span>{canConnect ? 'Доступно' : 'Скоро'}</span>}</div>
                    <p>{connected && source ? formatSync(source.lastSyncAt) : provider.statusMessage}</p>
                    {provider.capabilities?.length > 0 && <div className="aida-capabilities">{provider.capabilities.slice(0,4).map((cap) => <span key={cap.key}>{cap.name}</span>)}</div>}
                  </div>
                  <div className="aida-provider-actions">
                    {connected && source ? <button className="aida-secondary-action" onClick={() => disconnect(source.id, provider.id)} disabled={busyProvider === provider.id}>Отключить</button> : <button className="aida-primary-action" onClick={() => connect(provider.id)} disabled={!canConnect || busyProvider === provider.id}>{busyProvider === provider.id ? 'Подключаем…' : canConnect ? 'Подключить' : 'Недоступно'}</button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="aida-integrations-panel">
        <div className="aida-integrations-panel-head"><div><span className="aida-page-eyebrow"><Watch/> Устройства</span><h2>Что сейчас привязано</h2></div></div>
        {devices.length === 0 ? <div className="aida-integrations-empty"><Watch/><strong>Устройства пока не обнаружены</strong><span>После подключения совместимого источника они появятся здесь.</span></div> : <div className="aida-device-list">{devices.map((device) => <article key={device.id}><div><Watch/><span><strong>{device.deviceName || device.model}</strong><small>{device.model || 'Модель не указана'}</small></span></div><div><span>{device.batteryLevel == null ? 'Батарея —' : `Батарея ${device.batteryLevel}%`}</span><small>{device.lastSeenAt ? `Последняя активность: ${new Date(device.lastSeenAt).toLocaleString('ru-RU')}` : 'Последняя активность неизвестна'}</small></div></article>)}</div>}
      </section>

      <div className="aida-integrations-privacy"><ShieldCheck/><div><strong>Ваши данные остаются под вашим контролем</strong><span>Источник можно отключить в любой момент. Аида не подменяет отсутствующие показатели примерными значениями.</span></div></div>
    </div>
  );
};