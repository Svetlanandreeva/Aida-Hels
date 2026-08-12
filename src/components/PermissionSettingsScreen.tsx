import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Users,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Send,
  Eye,
  FileText,
  Activity,
  Heart,
  Pill,
  Stethoscope,
  Smile,
  Calendar,
  Compass,
  MapPin,
  Flame,
  Shield,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
  Zap,
} from 'lucide-react';

export type PermissionScope =
  | 'labs'
  | 'measurements'
  | 'medications'
  | 'conditions'
  | 'allergies'
  | 'mental'
  | 'cycle'
  | 'pregnancy'
  | 'dental'
  | 'documents'
  | 'emergency_card'
  | 'safety'
  | 'location';

export interface ScopeInfo {
  id: PermissionScope;
  label: string;
  category: string;
  isSensitive: boolean;
  description: string;
  icon: React.ReactNode;
}

export const SCOPES_CATALOG: ScopeInfo[] = [
  { id: 'labs', label: 'Лабораторные анализы', category: 'Медицина', isSensitive: false, description: 'Результаты анализов крови, мочи, ПЦР и биомаркеры', icon: <FileText className="w-4 h-4 text-emerald-400" /> },
  { id: 'measurements', label: 'Замеры и телеметрия', category: 'Медицина', isSensitive: false, description: 'Давление, ЧСС, вес, SpO2, HRV с гаджетов', icon: <Activity className="w-4 h-4 text-cyan-400" /> },
  { id: 'medications', label: 'Лекарства и рецепты', category: 'Медицина', isSensitive: false, description: 'Курсы приёма, дозировки и назначенные препараты', icon: <Pill className="w-4 h-4 text-purple-400" /> },
  { id: 'conditions', label: 'Заболевания и диагнозы', category: 'Медицина', isSensitive: false, description: 'Хронические диагнозы и медицинская карта', icon: <Stethoscope className="w-4 h-4 text-blue-400" /> },
  { id: 'allergies', label: 'Аллергии и непереносимости', category: 'Безопасность', isSensitive: false, description: 'Реакции на препараты и аллергены', icon: <ShieldAlert className="w-4 h-4 text-amber-400" /> },
  { id: 'mental', label: 'Ментальный дневник', category: 'Сенситивные', isSensitive: true, description: 'Записи настроения, стресса и эмоций', icon: <Smile className="w-4 h-4 text-pink-400" /> },
  { id: 'cycle', label: 'Женский цикл', category: 'Сенситивные', isSensitive: true, description: 'Фазы цикла, симптоматика и гинекология', icon: <Calendar className="w-4 h-4 text-rose-400" /> },
  { id: 'pregnancy', label: 'Дневник беременности', category: 'Сенситивные', isSensitive: true, description: 'Недели беременности, замеры плода и УЗИ', icon: <Heart className="w-4 h-4 text-rose-300" /> },
  { id: 'dental', label: 'Стоматологическая карта', category: 'Медицина', isSensitive: false, description: 'Одонтограмма, снимки зубов и план лечения', icon: <Flame className="w-4 h-4 text-teal-400" /> },
  { id: 'documents', label: 'Документы и выписки', category: 'Архив', isSensitive: false, description: 'Справки, PDF-выписки и договоры клиник', icon: <FileText className="w-4 h-4 text-gray-300" /> },
  { id: 'emergency_card', label: 'Экстренная карточка', category: 'Безопасность', isSensitive: false, description: 'Данная карточка для врачей скорой помощи', icon: <Shield className="w-4 h-4 text-red-400" /> },
  { id: 'safety', label: 'Анализ рисков', category: 'Безопасность', isSensitive: false, description: 'Проверка межлекарственных взаимодействий', icon: <ShieldCheck className="w-4 h-4 text-yellow-400" /> },
  { id: 'location', label: 'Геолокация и вызовы', category: 'Сенситивные', isSensitive: true, description: 'Местоположение при вызове экстренных служб', icon: <MapPin className="w-4 h-4 text-amber-500" /> },
];

export interface FamilyGrant {
  id: string;
  ownerUserId: string;
  granteeUserId: string;
  granteeEmailOrPhone?: string;
  granteeName: string;
  relationship: string;
  isAdult: boolean;
  status: 'pending_invitation' | 'active' | 'revoked' | 'rejected';
  invitationCode: string;
  allowedScopes: PermissionScope[];
  explicitSensitiveScopesGranted: PermissionScope[];
  invitedAt: string;
  consentedAt?: string;
  revokedAt?: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  pipelineStage: string;
  requesterUserId: string;
  targetSubjectProfileId: string;
  scope: string;
  action: string;
  decision: 'GRANTED' | 'DENIED';
  reason: string;
}

interface PermissionSettingsScreenProps {
  onBackToDashboard: () => void;
}

export const PermissionSettingsScreen: React.FC<PermissionSettingsScreenProps> = ({
  onBackToDashboard,
}) => {
  const [issuedGrants, setIssuedGrants] = useState<FamilyGrant[]>([]);
  const [receivedGrants, setReceivedGrants] = useState<FamilyGrant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for creating invitation
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteEmailOrPhone, setInviteEmailOrPhone] = useState<string>('');
  const [inviteRelationship, setInviteRelationship] = useState<string>('Супруг(а)');
  const [inviteIsAdult, setInviteIsAdult] = useState<boolean>(true);
  const [selectedScopes, setSelectedScopes] = useState<PermissionScope[]>([
    'emergency_card',
    'medications',
    'measurements',
  ]);
  const [selectedSensitiveScopes, setSelectedSensitiveScopes] = useState<PermissionScope[]>([]);

  // Invitation acceptance code state
  const [acceptCode, setAcceptCode] = useState<string>('');

  // Sandbox testing states
  const [testScope, setTestScope] = useState<PermissionScope>('mental');
  const [testTargetProfile, setTestTargetProfile] = useState<string>('user-spouse-456');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState<boolean>(false);

  // Expanded grant state
  const [expandedGrantId, setExpandedGrantId] = useState<string | null>(null);

  const fetchPermissionData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [grantsRes, auditRes] = await Promise.all([
        fetch('/api/permissions/grants'),
        fetch('/api/permissions/audit-log'),
      ]);

      if (grantsRes.ok) {
        const gData = await grantsRes.json();
        setIssuedGrants(gData.issuedGrants || []);
        setReceivedGrants(gData.receivedGrants || []);
      }

      if (auditRes.ok) {
        const aData = await auditRes.json();
        setAuditLogs(aData.auditLogs || []);
      }
    } catch (err: any) {
      setError(' Ошибка загрузки реестра разрешений: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissionData();
  }, []);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/permissions/invitation/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          granteeName: inviteName,
          granteeEmailOrPhone: inviteEmailOrPhone,
          relationship: inviteRelationship,
          isAdult: inviteIsAdult,
          allowedScopes: selectedScopes,
          explicitSensitiveScopes: selectedSensitiveScopes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || ' Ошибка создания приглашения');
      }

      setSuccessMsg(data.message);
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmailOrPhone('');
      fetchPermissionData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptCode.trim()) return;
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/permissions/invitation/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationCode: acceptCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Неудалось принять приглашение');
      }

      setSuccessMsg(data.message);
      setAcceptCode('');
      fetchPermissionData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    if (!window.confirm(' Вы уверены, что хотите немедленно отозвать доступ (Instant Revoke)? Родственник потеряет доступ моментально.')) {
      return;
    }

    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/permissions/grants/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка отзыва прав доступа');
      }

      setSuccessMsg('Доступ немедленно отозван (Instant Revoke)');
      fetchPermissionData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleScope = (grant: FamilyGrant, scopeId: PermissionScope) => {
    const isCurrentlyAllowed = grant.allowedScopes.includes(scopeId);
    let newAllowed = [...grant.allowedScopes];
    let newSensitive = [...grant.explicitSensitiveScopesGranted];

    const scopeMeta = SCOPES_CATALOG.find((s) => s.id === scopeId);

    if (isCurrentlyAllowed) {
      newAllowed = newAllowed.filter((s) => s !== scopeId);
      newSensitive = newSensitive.filter((s) => s !== scopeId);
    } else {
      newAllowed.push(scopeId);
      if (scopeMeta?.isSensitive) {
        newSensitive.push(scopeId);
      }
    }

    updateGrantScopesOnServer(grant.id, newAllowed, newSensitive);
  };

  const updateGrantScopesOnServer = async (
    grantId: string,
    allowedScopes: PermissionScope[],
    explicitSensitiveScopes: PermissionScope[]
  ) => {
    try {
      const res = await fetch('/api/permissions/grants/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantId, allowedScopes, explicitSensitiveScopes }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка обновления разрешений');
      }

      setSuccessMsg('Разрешения для родственника успешно обновлены');
      fetchPermissionData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const runPermissionSandboxTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Simulate endpoint access (e.g. lab trends or timeline) with custom subject profile ID
      const targetUrl = `/api/lab/trends?subject_profile_id=${encodeURIComponent(testTargetProfile)}&scope=${testScope}`;
      const res = await fetch(targetUrl);
      const data = await res.json();

      setTestResult({
        status: res.status,
        ok: res.ok,
        data,
      });

      // Refresh audit logs
      fetchPermissionData();
    } catch (err: any) {
      setTestResult({
        status: 500,
        ok: false,
        data: { error: err.message },
      });
    } finally {
      setTesting(false);
    }
  };

  const toggleModalScope = (scopeId: PermissionScope) => {
    const meta = SCOPES_CATALOG.find((s) => s.id === scopeId);
    if (selectedScopes.includes(scopeId)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scopeId));
      setSelectedSensitiveScopes(selectedSensitiveScopes.filter((s) => s !== scopeId));
    } else {
      setSelectedScopes([...selectedScopes, scopeId]);
      if (meta?.isSensitive) {
        setSelectedSensitiveScopes([...selectedSensitiveScopes, scopeId]);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-white">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-all cursor-pointer"
            title="Назад на дашборд"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Центр прав доступа и семейной безопасности
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-extrabold uppercase tracking-wider">
                Deny By Default
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              6-этапный серверный конвейер проверки прав • Раздельные скоупы • Сенситивные категории • Мгновенный отзыв (Instant Revoke)
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Подключить родственника</span>
        </button>
      </div>

      {/* ERROR & SUCCESS MESSAGES */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-200 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-200 text-xs">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span className="flex-1">{successMsg}</span>
        </div>
      )}

      {/* SECTION 1: 6-STAGE SECURITY PIPELINE VISUALIZER */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-[24px] p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#3DD9C5]" />
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              6-этапный серверный конвейер проверки запроса (Zero Trust Pipeline)
            </h2>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            Server-enforced independently of Frontend
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2">
          {[
            { num: '1', title: 'Authentication', desc: 'Проверка JWT и сессии', color: 'border-blue-500/40 bg-blue-500/10 text-blue-300' },
            { num: '2', title: 'Permission', desc: 'Deny by default реестр', color: 'border-purple-500/40 bg-purple-500/10 text-purple-300' },
            { num: '3', title: 'Validation', desc: 'Спецификация скоупа', color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
            { num: '4', title: 'Policy', desc: 'Consent & Sensitive Rules', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
            { num: '5', title: 'Execution', desc: 'Выполнение обработчика', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
            { num: '6', title: 'Audit', desc: 'Запись в журнал аудита', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
          ].map((stage) => (
            <div key={stage.num} className={`p-3 rounded-2xl border ${stage.color} space-y-1`}>
              <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                <span>STAGE {stage.num}</span>
                <CheckCircle2 className="w-3 h-3 opacity-80" />
              </div>
              <div className="text-xs font-extrabold">{stage.title}</div>
              <p className="text-[9px] opacity-80 leading-tight">{stage.desc}</p>
            </div>
          ))}
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-gray-300 space-y-1">
          <div className="flex items-center gap-2 font-bold text-white">
            <Info className="w-4 h-4 text-[#3DD9C5]" />
            <span>Ключевые гарантии безопасности:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-gray-400 text-[10px]">
            <li><strong>Deny by default:</strong> Любой запрос к чужому профилю или без явного разрешения блокируется на Этапе 2.</li>
            <li><strong>Родство ≠ Полный доступ:</strong> Привязка родственника не означает автоматического открытия медкарты. Доступ только по выбранным скоупам.</li>
            <li><strong>Сенситивные категории:</strong> Записи психического здоровья (`mental`), репродукции (`cycle`, `pregnancy`) и геолокация (`location`) <strong>никогда не включаются автоматически</strong>.</li>
            <li><strong>Взрослые родственники (18+):</strong> Подключение только через подтверждение персонального приглашения и согласия (Invitation/Consent Code).</li>
            <li><strong>Instant Revoke:</strong> Нажатие кнопки «Отозвать» мгновенно блокирует все последующие API-запросы родственника.</li>
          </ul>
        </div>
      </div>

      {/* SECTION 2: ISSUED FAMILY GRANTS (МОИ ВЫДАННЫЕ РАЗРЕШЕНИЯ) */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-[24px] p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-rose-400" />
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Семейные разрешения для родственников ({issuedGrants.length})
            </h2>
          </div>
          <button
            onClick={fetchPermissionData}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-all cursor-pointer"
            title="Обновить данные"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {issuedGrants.length === 0 ? (
          <div className="p-8 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl space-y-3">
            <ShieldAlert className="w-8 h-8 text-gray-500 mx-auto" />
            <div className="text-xs font-bold text-gray-300">У вас нет активных семейных разрешений</div>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto">
              Нажмите «Подключить родственника», чтобы выдать ограниченный доступ родителям, супругам или взрослым детям с точечной настройкой скоупов.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {issuedGrants.map((grant) => {
              const isExpanded = expandedGrantId === grant.id;
              const isRevoked = grant.status === 'revoked';

              return (
                <div
                  key={grant.id}
                  className={`p-5 rounded-2xl border transition-all space-y-4 ${
                    isRevoked
                      ? 'bg-rose-950/10 border-rose-500/20 opacity-70'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-sm">{grant.granteeName}</span>
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-300 text-[10px] font-bold">
                          {grant.relationship}
                        </span>
                        {grant.isAdult ? (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                            Взрослый (18+)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold">
                            Ребенок
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono ${
                            grant.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : grant.status === 'pending_invitation'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {grant.status === 'active'
                            ? 'Активен'
                            : grant.status === 'pending_invitation'
                            ? 'Ожидает согласия'
                            : 'Отозван'}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-400 flex items-center gap-3">
                        <span>Создано: {new Date(grant.invitedAt).toLocaleDateString('ru-RU')}</span>
                        {grant.invitationCode && grant.status === 'pending_invitation' && (
                          <span className="font-mono text-[#3DD9C5] font-bold">
                            Код приглашения: {grant.invitationCode}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedGrantId(isExpanded ? null : grant.id)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Настройка скоупов</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {!isRevoked && (
                        <button
                          onClick={() => handleRevokeGrant(grant.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                          title="Мгновенный отзыв прав доступа (Instant Revoke)"
                        >
                          <UserX className="w-4 h-4" />
                          <span>Отозвать</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ACTIVE SCOPES BADGES */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SCOPES_CATALOG.map((scope) => {
                      const isAllowed = grant.allowedScopes.includes(scope.id);
                      const isSensitiveGranted = grant.explicitSensitiveScopesGranted.includes(scope.id);

                      if (!isAllowed) return null;

                      return (
                        <span
                          key={scope.id}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border ${
                            scope.isSensitive
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                              : 'bg-white/10 border-white/10 text-gray-200'
                          }`}
                        >
                          {scope.icon}
                          <span>{scope.label}</span>
                          {scope.isSensitive && (
                            <span className="px-1 py-0.2 rounded bg-rose-500/40 text-[8px] font-mono uppercase">
                              Sensitive
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* EXPANDABLE GRANULAR SCOPES TOGGLER */}
                  {isExpanded && !isRevoked && (
                    <div className="pt-4 border-t border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          Точечное управление категориями медицинских данных:
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Кликните по категории для выдачи или отзыва
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {SCOPES_CATALOG.map((scope) => {
                          const isAllowed = grant.allowedScopes.includes(scope.id);

                          return (
                            <div
                              key={scope.id}
                              onClick={() => handleToggleScope(grant, scope.id)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isAllowed
                                  ? scope.isSensitive
                                    ? 'bg-rose-500/20 border-rose-500/50 text-white'
                                    : 'bg-[#3DD9C5]/10 border-[#3DD9C5]/40 text-white'
                                  : 'bg-white/[0.02] border-white/5 hover:border-white/20 text-gray-400'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {scope.icon}
                                <div>
                                  <div className="text-xs font-bold flex items-center gap-1">
                                    <span>{scope.label}</span>
                                    {scope.isSensitive && (
                                      <span className="text-[9px] text-rose-400 font-mono">*</span>
                                    )}
                                  </div>
                                  <div className="text-[9px] text-gray-400 truncate max-w-[160px]">
                                    {scope.description}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 ml-2">
                                {isAllowed ? (
                                  <CheckCircle2 className="w-4 h-4 text-[#3DD9C5]" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-gray-600" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: ACCEPT INVITATION CODE CARD */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-[24px] p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
            Ввод кода приглашения родственника (Accept Invitation)
          </h2>
        </div>
        <p className="text-xs text-gray-400">
          Если ваш родственник создал приглашение и передал вам код (`INV-XXXXXX`), введите его ниже для активации доступа и подтверждения персонального согласия.
        </p>

        <form onSubmit={handleAcceptInvitation} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={acceptCode}
            onChange={(e) => setAcceptCode(e.target.value)}
            placeholder="Код приглашения, например: INV-773821"
            className="w-full sm:flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-mono uppercase focus:outline-none focus:border-purple-400 placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={!acceptCode.trim()}
            className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            <span>Принять и дать согласие</span>
          </button>
        </form>
      </div>

      {/* SECTION 4: PERMISSION SANDBOX TESTER */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-[24px] p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Тестер эмуляции доступа (Permission Sandbox)
            </h2>
          </div>
          <span className="text-[10px] text-amber-300 font-mono">
            Проверка реакций бэкенда в реальном времени
          </span>
        </div>

        <p className="text-xs text-gray-400">
          Проверьте, как бэкенд обрабатывает запросы к разным скоупам данных с соблюдением политики Deny by Default:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-gray-400 font-bold block mb-1">Целевой профиль (Subject ID):</label>
            <input
              type="text"
              value={testTargetProfile}
              onChange={(e) => setTestTargetProfile(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-400 font-bold block mb-1">Запрашиваемый скоуп:</label>
            <select
              value={testScope}
              onChange={(e) => setTestScope(e.target.value as PermissionScope)}
              className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
            >
              {SCOPES_CATALOG.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} {s.isSensitive ? '(SENSITIVE)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={runPermissionSandboxTest}
              disabled={testing}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              <span>Симулировать API-запрос</span>
            </button>
          </div>
        </div>

        {/* TEST RESULT DISPLAY */}
        {testResult && (
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">HTTP Status:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded ${
                  testResult.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {testResult.status} {testResult.ok ? 'OK (GRANTED)' : 'FORBIDDEN (DENIED)'}
              </span>
            </div>

            {testResult.data?.stage && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Pipeline Stage:</span>
                <span className="text-purple-300 font-bold uppercase">{testResult.data.stage}</span>
              </div>
            )}

            {testResult.data?.reason && (
              <div className="p-2.5 rounded bg-white/5 border border-white/5 text-gray-200">
                <strong className="text-rose-400">Причина отклонения бэкендом:</strong> {testResult.data.reason}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 5: AUDIT TRAIL LOG */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-[24px] p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Журнал аудита проверок доступа (Security Audit Trail)
            </h2>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            Записей: {auditLogs.length}
          </span>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {auditLogs.length === 0 ? (
            <div className="text-xs text-gray-500 py-4 text-center">Записи журнала аудита отсутствуют</div>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
                        log.decision === 'GRANTED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {log.decision}
                    </span>
                    <span className="text-gray-300 font-bold">Скоуп: {log.scope}</span>
                    <span className="text-[10px] text-purple-300 font-mono">Этап: {log.pipelineStage}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">{log.reason}</p>
                </div>

                <div className="text-[10px] text-gray-500 font-mono shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('ru-RU')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL: CREATE INVITATION */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-white/10 rounded-[28px] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-400" />
                <h3 className="text-lg font-extrabold text-white">
                  Подключить родственника и настроить скоупы
                </h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl bg-white/5"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvitation} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-300 font-bold block mb-1">Имя родственника *</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Например: Анна (Сестра)"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-bold block mb-1">Родственная связь *</label>
                  <select
                    value={inviteRelationship}
                    onChange={(e) => setInviteRelationship(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#111827] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400"
                  >
                    <option value="Супруг(а)">Супруг(а)</option>
                    <option value="Родитель">Родитель</option>
                    <option value="Взрослый ребенок">Взрослый ребенок (18+)</option>
                    <option value="Ребенок">Ребенок (&lt; 18 лет)</option>
                    <option value="Брат/Сестра">Брат/Сестра</option>
                    <option value="Опекун">Опекун / Доверенное лицо</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Родственник совершеннолетний (18+)?</div>
                  <div className="text-[10px] text-gray-400">
                    Для взрослых родственников требуется генерация кода приглашения (`INV-XXXXXX`) и подтверждение согласия.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={inviteIsAdult}
                  onChange={(e) => setInviteIsAdult(e.target.checked)}
                  className="w-5 h-5 accent-rose-500 rounded cursor-pointer shrink-0"
                />
              </div>

              {/* SCOPE SELECTION GRID */}
              <div className="space-y-2">
                <label className="text-xs text-gray-300 font-bold block">
                  Выберите разрешенные категории данных (Scopes):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {SCOPES_CATALOG.map((scope) => {
                    const isSelected = selectedScopes.includes(scope.id);

                    return (
                      <div
                        key={scope.id}
                        onClick={() => toggleModalScope(scope.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? scope.isSensitive
                              ? 'bg-rose-500/20 border-rose-500/50 text-white'
                              : 'bg-emerald-500/20 border-emerald-500/50 text-white'
                            : 'bg-white/[0.02] border-white/5 text-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {scope.icon}
                          <div>
                            <div className="text-xs font-bold flex items-center gap-1">
                              <span>{scope.label}</span>
                              {scope.isSensitive && (
                                <span className="text-[9px] text-rose-400 font-mono">*</span>
                              )}
                            </div>
                            <div className="text-[9px] text-gray-400 truncate max-w-[150px]">
                              {scope.description}
                            </div>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-4 h-4 accent-rose-500 rounded shrink-0 pointer-events-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Создать разрешение</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
