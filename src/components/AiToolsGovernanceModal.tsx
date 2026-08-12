import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Bot,
  CheckCircle2,
  XCircle,
  Lock,
  Terminal,
  Cpu,
  Layers,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles,
  AlertTriangle,
  KeyRound,
  FileCheck,
  Activity,
  Users,
  Pill,
} from 'lucide-react';

interface ToolItem {
  name: string;
  description: string;
  actionClass: 'READ' | 'EXPLAIN' | 'SUGGEST' | 'STAGE' | 'WRITE' | 'SHARE' | 'ALERT' | 'DELETE';
  policyLevel: 1 | 2 | 3 | 4;
  requiresConfirmationToken: boolean;
  inputSchema: Record<string, any>;
}

interface CandidateItem {
  id: string;
  toolName: string;
  actionClass: string;
  type: string;
  title: string;
  description: string;
  payload: Record<string, any>;
  status: 'STAGED' | 'CONFIRMED' | 'REJECTED';
  confirmationToken: string;
  createdAt: string;
  expiresAt: string;
  aiReasoning?: string;
}

interface AiToolsGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiToolsGovernanceModal: React.FC<AiToolsGovernanceModalProps> = ({ isOpen, onClose }) => {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [pendingCandidates, setPendingCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tools' | 'pending' | 'sandbox'>('tools');

  // Sandbox State
  const [selectedTool, setSelectedTool] = useState<string>('candidate.confirm');
  const [sandboxToken, setSandboxToken] = useState<string>('');
  const [sandboxCandidateId, setSandboxCandidateId] = useState<string>('cand_test_123');
  const [sandboxOutput, setSandboxOutput] = useState<any>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRegistryAndCandidates();
    }
  }, [isOpen]);

  const fetchRegistryAndCandidates = async () => {
    setLoading(true);
    try {
      const [regRes, candRes] = await Promise.all([
        fetch('/api/ai/tools/registry'),
        fetch('/api/ai/candidates/pending'),
      ]);

      const regData = await regRes.json();
      const candData = await candRes.json();

      if (regData.success) {
        setTools(regData.tools || []);
      }
      if (candData.success) {
        setPendingCandidates(candData.candidates || []);
      }
    } catch (err) {
      console.error('Error fetching tools registry:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCandidate = async (candidateId: string, token: string) => {
    try {
      const res = await fetch('/api/ai/candidates/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, confirmationToken: token }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Успешно! Кандидатная запись подтверждена пользователем и внесена в медкарту.');
        fetchRegistryAndCandidates();
      } else {
        alert('Ошибка подтверждения: ' + data.message);
      }
    } catch (err: any) {
      alert('Сетевая ошибка: ' + err.message);
    }
  };

  const handleRejectCandidate = async (candidateId: string, token: string) => {
    try {
      const res = await fetch('/api/ai/candidates/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, confirmationToken: token, reason: 'Пользователь отклонил запись' }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Кандидатная запись успешно отклонена.');
        fetchRegistryAndCandidates();
      } else {
        alert('Ошибка отклонения: ' + data.message);
      }
    } catch (err: any) {
      alert('Сетевая ошибка: ' + err.message);
    }
  };

  const handleRunSandbox = async (withValidToken: boolean) => {
    setSandboxLoading(true);
    setSandboxOutput(null);

    const tokenToPass = withValidToken ? sandboxToken || 'CONF_TOK_VALID_1234' : '';

    try {
      const res = await fetch('/api/ai/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: selectedTool,
          params: {
            userId: 'user_current',
            candidateId: sandboxCandidateId,
            confirmationToken: tokenToPass,
            title: 'Тестовый замер давления',
            category: 'vitals',
            data: { systolic: 120, diastolic: 80 },
          },
        }),
      });

      const data = await res.json();
      setSandboxOutput({ status: res.status, body: data });
    } catch (err: any) {
      setSandboxOutput({ status: 500, body: { error: err.message } });
    } finally {
      setSandboxLoading(false);
    }
  };

  if (!isOpen) return null;

  const getActionBadgeColor = (actionClass: string) => {
    switch (actionClass) {
      case 'READ':
      case 'EXPLAIN':
      case 'SUGGEST':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'STAGE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'WRITE':
      case 'SHARE':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getLevelBadgeColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-emerald-500/20 text-emerald-300';
      case 2:
        return 'bg-amber-500/20 text-amber-300';
      case 3:
        return 'bg-blue-500/20 text-blue-300';
      case 4:
        return 'bg-rose-500/20 text-rose-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0B1320] border border-cyan-500/30 rounded-[28px] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden">
        {/* MODAL HEADER */}
        <div className="bg-[#111C2E] p-6 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-wide">AI Backend Typed Tools & Untrusted LLM Engine</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase">
                  Rule 15 Enforcement
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                LLM = Untrusted Reasoning Component. Запрет прямого CRUD. Модификация данных только через 15 типизированных инструментов с Human Confirmation Token.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* POLICY STATEMENT BANNER */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between gap-4 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Политика ИИ:</strong> AI не имеет прямого доступа к базе данных. Операции <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-300 font-mono">WRITE/SHARE/DELETE</code> требуют токена подтверждения, генерируемого сервером при явном клике пользователя.
            </span>
          </div>
          <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded font-bold uppercase text-amber-300 shrink-0">
            No AI Self-Token Issue
          </span>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-white/[0.08] bg-[#0E1726] px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'tools'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>15 Типизированных Инструментов ({tools.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'pending'
                ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Ожидающие Кандидаты STAGED ({pendingCandidates.length})</span>
            {pendingCandidates.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center">
                {pendingCandidates.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'sandbox'
                ? 'border-rose-400 text-rose-400 bg-rose-500/10'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Песочница безопасности (Security Sandbox)</span>
          </button>
        </div>

        {/* BODY CONTENT */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-[#0B1320]">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span>Загрузка реестра инструментов ИИ...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: 15 TYPED TOOLS REGISTRY */}
              {activeTab === 'tools' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tools.map((t) => (
                      <div
                        key={t.name}
                        className="bg-[#111C2E] border border-white/[0.06] hover:border-cyan-500/40 rounded-2xl p-4 space-y-3 transition-all shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <code className="text-sm font-black text-cyan-300 font-mono">{t.name}</code>
                            <p className="text-xs text-gray-300">{t.description}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-lg border text-[10px] font-extrabold uppercase shrink-0 ${getActionBadgeColor(
                              t.actionClass
                            )}`}
                          >
                            {t.actionClass}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/[0.04]">
                          <span className="flex items-center gap-1.5 text-gray-400">
                            <span>Уровень политики:</span>
                            <span className={`px-1.5 py-0.5 rounded font-black ${getLevelBadgeColor(t.policyLevel)}`}>
                              L{t.policyLevel}
                            </span>
                          </span>

                          <span className="flex items-center gap-1 font-bold">
                            {t.requiresConfirmationToken ? (
                              <span className="text-rose-400 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Токен обязателен
                              </span>
                            ) : (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Авто-выполнение
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: PENDING STAGED CANDIDATES */}
              {activeTab === 'pending' && (
                <div className="space-y-4">
                  {pendingCandidates.length === 0 ? (
                    <div className="bg-[#111C2E] border border-white/[0.06] rounded-2xl p-8 text-center space-y-3">
                      <FileCheck className="w-10 h-10 text-emerald-400 mx-auto" />
                      <h3 className="text-base font-bold text-white">Все кандидаты обработаны</h3>
                      <p className="text-xs text-gray-400">
                        В карантине STAGED нет новых кандидатов замерных данных или импортов. ИИ работает строго в рамках политик безопасности.
                      </p>
                    </div>
                  ) : (
                    pendingCandidates.map((c) => (
                      <div
                        key={c.id}
                        className="bg-[#111C2E] border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-lg"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
                                STAGED
                              </span>
                              <h4 className="text-sm font-bold text-white">{c.title}</h4>
                            </div>
                            <p className="text-xs text-gray-300">{c.description}</p>
                            {c.aiReasoning && (
                              <p className="text-[11px] text-cyan-300 italic bg-cyan-500/10 p-2 rounded-lg mt-1 border border-cyan-500/20">
                                💡 ИИ-обоснование: {c.aiReasoning}
                              </p>
                            )}
                          </div>

                          <div className="text-right space-y-1 shrink-0">
                            <span className="text-[10px] text-gray-400 block font-mono">ID: {c.id}</span>
                            <span className="text-[10px] text-amber-400 block font-mono bg-black/40 px-2 py-1 rounded">
                              {c.confirmationToken}
                            </span>
                          </div>
                        </div>

                        {/* PAYLOAD PREVIEW */}
                        <div className="bg-[#080E1A] p-3 rounded-xl border border-white/[0.04] text-xs font-mono text-gray-300">
                          <pre className="overflow-x-auto">{JSON.stringify(c.payload, null, 2)}</pre>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            onClick={() => handleRejectCandidate(c.id, c.confirmationToken)}
                            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Отклонить</span>
                          </button>

                          <button
                            onClick={() => handleConfirmCandidate(c.id, c.confirmationToken)}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Подтвердить и внести в медкарту</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: SECURITY SANDBOX */}
              {activeTab === 'sandbox' && (
                <div className="space-y-6">
                  <div className="bg-[#111C2E] border border-white/[0.08] rounded-2xl p-6 space-y-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-rose-400" />
                      <span>Тестирование политики Untrusted LLM Tool Engine</span>
                    </h3>
                    <p className="text-xs text-gray-300">
                      Проверьте блокировку прямых записей без токена подтверждения. Если ИИ попытается вызвать инструмент категории WRITE без токена пользователя, сервер вернет отказ <code className="text-rose-400 font-bold">403 POLICY_VIOLATION</code>.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="text-xs font-bold text-gray-300 block mb-1.5">Целевой инструмент</label>
                        <select
                          value={selectedTool}
                          onChange={(e) => setSelectedTool(e.target.value)}
                          className="w-full bg-[#080E1A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                        >
                          {tools.map((t) => (
                            <option key={t.name} value={t.name}>
                              {t.name} ({t.actionClass} - L{t.policyLevel})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-300 block mb-1.5">Токен подтверждения (User Token)</label>
                        <input
                          type="text"
                          value={sandboxToken}
                          onChange={(e) => setSandboxToken(e.target.value)}
                          placeholder="Оставьте пустым для имитации атаки ИИ"
                          className="w-full bg-[#080E1A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        onClick={() => handleRunSandbox(false)}
                        disabled={sandboxLoading}
                        className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>Вызвать ИИ БЕЗ токена (Имитация прямой записи ИИ)</span>
                      </button>

                      <button
                        onClick={() => handleRunSandbox(true)}
                        disabled={sandboxLoading}
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Вызвать С ТОКЕНОМ (После подтверждения человеком)</span>
                      </button>
                    </div>
                  </div>

                  {/* SANDBOX OUTPUT */}
                  {sandboxOutput && (
                    <div className="bg-[#080E1A] border border-white/10 rounded-2xl p-5 space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 font-bold">Ответ бэкенд-сервера:</span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            sandboxOutput.status === 200
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          HTTP {sandboxOutput.status}
                        </span>
                      </div>
                      <pre className="text-cyan-300 overflow-x-auto p-3 bg-black/60 rounded-xl border border-white/[0.04]">
                        {JSON.stringify(sandboxOutput.body, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
