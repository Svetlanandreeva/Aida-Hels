import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  HelpCircle,
  X,
  Edit2,
  Trash2,
  Save,
  ShieldCheck,
  Building,
  Calendar,
  User,
  Sparkles,
  Plus,
  Fingerprint,
  FileWarning,
  Eye,
  Check,
  RefreshCw,
  Copy,
  ChevronRight,
  ShieldAlert,
  Sliders,
} from 'lucide-react';

export interface StagedAnalyte {
  id: string;
  analyteCode: string;
  originalName: string;
  normalizedName: string;
  value: number | string | null;
  valueText: string;
  unit: string;
  min: number | null;
  max: number | null;
  normalRange: string;
  status: 'low' | 'normal' | 'high' | 'critical' | 'unknown';
  confidence: number;
  originalRawLine?: string;
  isCorrected?: boolean;
}

export interface StagingRecordPayload {
  stagingId: string;
  sourceHash: string;
  sourceFileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  status: 'staging' | 'quarantined' | 'committed' | 'discarded';
  quarantineReason?: string;

  documentCategory: string;
  documentTitle: string;
  researchDate: string;
  laboratoryName: string;

  patientNameOnDoc: string;
  suggestedProfileId: string;
  suggestedProfileName: string;
  isOwnerMatch: boolean;
  availableProfiles: { id: string; name: string; relation: string }[];

  analytes: StagedAnalyte[];
  warnings: string[];

  isDuplicate: boolean;
  duplicateInfo?: {
    existingDocId: string;
    existingDocTitle: string;
    existingDocDate: string;
    existingProfileName?: string;
    matchedAnalytesCount: number;
  };

  aiExplanation?: string;
}

interface ResearchVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  stagingRecord: StagingRecordPayload | null;
  filePreviewUrl?: string | null;
  onCommit: (commitParams: {
    stagingId: string;
    targetProfileId: string;
    mode: 'commit_to_history' | 'explain_only_no_save';
    duplicateAction: 'overwrite' | 'skip' | 'create_duplicate';
    correctedAnalytes: StagedAnalyte[];
    documentMetadata: {
      documentTitle: string;
      researchDate: string;
      laboratoryName: string;
    };
  }) => Promise<void>;
}

export const ResearchVerificationModal: React.FC<ResearchVerificationModalProps> = ({
  isOpen,
  onClose,
  stagingRecord,
  filePreviewUrl,
  onCommit,
}) => {
  if (!isOpen || !stagingRecord) return null;

  // Local editable form state
  const [docTitle, setDocTitle] = useState(stagingRecord.documentTitle || 'Лабораторный анализ');
  const [labName, setLabName] = useState(stagingRecord.laboratoryName || 'Медицинская лаборатория');
  const [researchDate, setResearchDate] = useState(
    stagingRecord.researchDate || new Date().toISOString().split('T')[0]
  );
  const [selectedProfileId, setSelectedProfileId] = useState(
    stagingRecord.suggestedProfileId || 'sp-primary'
  );
  const [saveMode, setSaveMode] = useState<'commit_to_history' | 'explain_only_no_save'>(
    'commit_to_history'
  );
  const [duplicateAction, setDuplicateAction] = useState<'overwrite' | 'skip' | 'create_duplicate'>(
    'create_duplicate'
  );

  const [analytes, setAnalytes] = useState<StagedAnalyte[]>(stagingRecord.analytes || []);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [explanationResult, setExplanationResult] = useState<string | null>(null);

  useEffect(() => {
    if (stagingRecord) {
      setDocTitle(stagingRecord.documentTitle || 'Лабораторный анализ');
      setLabName(stagingRecord.laboratoryName || 'Медицинская лаборатория');
      setResearchDate(stagingRecord.researchDate || new Date().toISOString().split('T')[0]);
      setSelectedProfileId(stagingRecord.suggestedProfileId || 'sp-primary');
      setAnalytes(stagingRecord.analytes || []);
      setExplanationResult(null);
    }
  }, [stagingRecord]);

  const handleUpdateAnalyte = (id: string, field: keyof StagedAnalyte, val: any) => {
    setAnalytes((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            [field]: val,
            isCorrected: true,
          };
        }
        return a;
      })
    );
  };

  const handleRemoveAnalyte = (id: string) => {
    setAnalytes((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAddAnalyte = () => {
    const newId = `an_manual_${Date.now()}`;
    setAnalytes((prev) => [
      ...prev,
      {
        id: newId,
        analyteCode: 'custom',
        originalName: 'Новый показатель',
        normalizedName: 'Новый показатель',
        value: 0,
        valueText: '0',
        unit: 'ед',
        min: 0,
        max: 100,
        normalRange: '0 - 100',
        status: 'normal',
        confidence: 1.0,
        isCorrected: true,
      },
    ]);
    setEditingId(newId);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onCommit({
        stagingId: stagingRecord.stagingId,
        targetProfileId: selectedProfileId,
        mode: saveMode,
        duplicateAction,
        correctedAnalytes: analytes,
        documentMetadata: {
          documentTitle: docTitle,
          researchDate,
          laboratoryName: labName,
        },
      });
      onClose();
    } catch (err) {
      console.error('Commit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isQuarantined = stagingRecord.status === 'quarantined';

  const renderStatusBadge = (status: StagedAnalyte['status']) => {
    switch (status) {
      case 'normal':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold rounded-lg whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3" />
            <span>В норме</span>
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[11px] font-bold rounded-lg whitespace-nowrap">
            <ArrowDown className="w-3 h-3" />
            <span>Ниже</span>
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold rounded-lg whitespace-nowrap">
            <ArrowUp className="w-3 h-3" />
            <span>Выше</span>
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold rounded-lg whitespace-nowrap">
            <AlertTriangle className="w-3 h-3" />
            <span>Критическое</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-500/15 border border-gray-500/30 text-gray-400 text-[11px] font-bold rounded-lg whitespace-nowrap">
            <HelpCircle className="w-3 h-3" />
            <span>Неизвестно</span>
          </span>
        );
    }
  };

  const renderConfidenceBadge = (confidence: number, isCorrected?: boolean) => {
    if (isCorrected) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-semibold rounded-md">
          <Edit2 className="w-2.5 h-2.5" />
          <span>Исправлено</span>
        </span>
      );
    }
    const percent = Math.round(confidence * 100);
    if (percent >= 85) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold rounded-md">
          <span>{percent}% OCR</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-semibold rounded-md">
        <AlertTriangle className="w-2.5 h-2.5" />
        <span>{percent}% (Проверьте)</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#0B1320] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl text-gray-100 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* HEADER PIPELINE INDICATOR */}
        <div className="p-4 sm:p-6 border-b border-white/10 bg-gradient-to-r from-[#0F172A] via-[#111C30] to-[#0F172A]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-[#3DD9C5]/10 border border-[#3DD9C5]/30 text-[#3DD9C5]">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#3DD9C5] uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Staging Pipeline Обработки Документов</span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
                  Верификация & Подготовка к занесению
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* PIPELINE BREADCRUMBS STEPS */}
          <div className="mt-4 pt-3 border-t border-white/5 overflow-x-auto flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-gray-400 no-scrollbar whitespace-nowrap">
            {[
              'Upload',
              'Validation',
              'OCR/Parser',
              'Classify',
              'Владелец',
              'Extract',
              'Normalize',
              'Confidence',
              'Dedupe',
              'Preview',
              'Correction',
              'Commit',
            ].map((stepName, idx) => (
              <React.Fragment key={stepName}>
                <span
                  className={`px-2 py-0.5 rounded-md ${
                    idx <= 9
                      ? 'bg-[#3DD9C5]/15 text-[#3DD9C5] border border-[#3DD9C5]/30'
                      : idx === 10
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-pulse'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {stepName}
                </span>
                {idx < 11 && <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* QUARANTINE WARNING IF QUARANTINED */}
          {isQuarantined && (
            <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-200">Файл помещён на карантин (Quarantine)</h4>
                <p className="text-xs text-rose-300 mt-1">{stagingRecord.quarantineReason}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Пожалуйста, выберите четкий медицинский скан в формате PDF, JPG или PNG размером до 15 МБ.
                </p>
              </div>
            </div>
          )}

          {/* STEP 1: OWNER MATCHING & MODE SWITCHER */}
          {!isQuarantined && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* OWNER IDENTIFICATION ("Это ваши анализы?") */}
              <div className="p-4 rounded-2xl bg-[#111827] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                    <User className="w-4 h-4 text-[#3DD9C5]" />
                    <span>Владелец исследования («Это ваши анализы?»)</span>
                  </div>
                  {stagingRecord.isOwnerMatch ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Владелец подтвержден
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      Уточните профиль
                    </span>
                  )}
                </div>

                {stagingRecord.patientNameOnDoc && (
                  <p className="text-xs text-gray-300 bg-white/5 p-2 rounded-xl border border-white/5">
                    На бланке найден пациент: <strong className="text-white">{stagingRecord.patientNameOnDoc}</strong>
                  </p>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-medium">Сохранить в медкарту профиля:</label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full bg-[#1F2937] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3DD9C5]"
                  >
                    {stagingRecord.availableProfiles?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.relation === 'self' ? 'Основной пользователь' : p.relation})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* MODE SWITCHER ("Только расшифровать, не сохранять") */}
              <div className="p-4 rounded-2xl bg-[#111827] border border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>Режим сохранения / Расшифровки</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSaveMode('commit_to_history')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                      saveMode === 'commit_to_history'
                        ? 'bg-[#3DD9C5]/15 border-[#3DD9C5] text-[#3DD9C5]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Save className="w-3.5 h-3.5" />
                      <span>Внести в историю</span>
                    </div>
                    <p className="text-[10px] font-normal text-gray-400 mt-1">
                      Сохранить все аналиты в графики и динамику здоровья
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSaveMode('explain_only_no_save')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                      saveMode === 'explain_only_no_save'
                        ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Только расшифровать</span>
                    </div>
                    <p className="text-[10px] font-normal text-gray-400 mt-1">
                      Разобрать ИИ без записи в базу данных
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DUPLICATE FLOW WARNING BANNER */}
          {stagingRecord.isDuplicate && (
            <div className="p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl space-y-3">
              <div className="flex items-start gap-3">
                <Copy className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-200">Обнаружен дубликат исследования (Duplicate Flow)</h4>
                  <p className="text-xs text-amber-300/80 mt-0.5">
                    Найден сохраненный анализ со схожими данными («{stagingRecord.duplicateInfo?.existingDocTitle}» за {stagingRecord.duplicateInfo?.existingDocDate}).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDuplicateAction('create_duplicate')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    duplicateAction === 'create_duplicate'
                      ? 'bg-amber-400 text-black border-amber-400'
                      : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  Создать отдельный дубликат
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateAction('overwrite')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    duplicateAction === 'overwrite'
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  Заменить существующий
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateAction('skip')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    duplicateAction === 'skip'
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  Пропустить загрузку
                </button>
              </div>
            </div>
          )}

          {/* EDITABLE DOCUMENT METADATA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#111827]/60 p-4 rounded-2xl border border-white/5">
            <div>
              <label className="text-[11px] text-gray-400 font-semibold block mb-1">Название анализа</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full bg-[#1F2937] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#3DD9C5]"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 font-semibold block mb-1">Лаборатория</label>
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="w-full bg-[#1F2937] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#3DD9C5]"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 font-semibold block mb-1">Дата исследования</label>
              <input
                type="date"
                value={researchDate}
                onChange={(e) => setResearchDate(e.target.value)}
                className="w-full bg-[#1F2937] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#3DD9C5]"
              />
            </div>
          </div>

          {/* EXTRACTED ANALYTES INTERACTIVE TABLE (PREVIEW & USER CORRECTION) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#3DD9C5]" />
                <h3 className="font-bold text-white text-base">
                  Извлеченные аналиты ({analytes.length})
                </h3>
                <span className="text-xs text-gray-400 font-normal">
                  (1 строка = 1 показатель)
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddAnalyte}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#3DD9C5]/10 hover:bg-[#3DD9C5]/20 text-[#3DD9C5] border border-[#3DD9C5]/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить показатель</span>
              </button>
            </div>

            {analytes.length === 0 ? (
              <div className="py-8 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl text-gray-400 text-xs">
                Показатели не найдены. Вы можете добавить их вручную.
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/10 rounded-2xl bg-[#111827]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-gray-400 font-semibold">
                      <th className="p-3">Показатель</th>
                      <th className="p-3">Значение</th>
                      <th className="p-3">Ед. изм.</th>
                      <th className="p-3">Норма (референс)</th>
                      <th className="p-3">Статус</th>
                      <th className="p-3">OCR Confidence</th>
                      <th className="p-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-200">
                    {analytes.map((item) => {
                      const isEditing = editingId === item.id;
                      return (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-medium">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.originalName}
                                onChange={(e) => handleUpdateAnalyte(item.id, 'originalName', e.target.value)}
                                className="w-full bg-[#1F2937] border border-white/20 rounded px-2 py-1 text-xs text-white"
                              />
                            ) : (
                              <div>
                                <span className="text-white font-semibold">{item.originalName}</span>
                                {item.normalizedName && item.normalizedName !== item.originalName && (
                                  <span className="block text-[10px] text-gray-400">({item.normalizedName})</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="p-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.valueText || String(item.value ?? '')}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const parsed = parseFloat(raw.replace(',', '.'));
                                  handleUpdateAnalyte(item.id, 'valueText', raw);
                                  handleUpdateAnalyte(item.id, 'value', isNaN(parsed) ? null : parsed);
                                }}
                                className="w-20 bg-[#1F2937] border border-white/20 rounded px-2 py-1 text-xs text-white"
                              />
                            ) : (
                              <span className="font-bold text-white">
                                {item.valueText || (item.value !== null ? item.value : '—')}
                              </span>
                            )}
                          </td>

                          <td className="p-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => handleUpdateAnalyte(item.id, 'unit', e.target.value)}
                                className="w-16 bg-[#1F2937] border border-white/20 rounded px-2 py-1 text-xs text-white"
                              />
                            ) : (
                              <span className="text-gray-400">{item.unit || '—'}</span>
                            )}
                          </td>

                          <td className="p-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.normalRange}
                                onChange={(e) => handleUpdateAnalyte(item.id, 'normalRange', e.target.value)}
                                className="w-28 bg-[#1F2937] border border-white/20 rounded px-2 py-1 text-xs text-white"
                              />
                            ) : (
                              <span className="text-gray-400">{item.normalRange || '—'}</span>
                            )}
                          </td>

                          <td className="p-3">
                            {isEditing ? (
                              <select
                                value={item.status}
                                onChange={(e) => handleUpdateAnalyte(item.id, 'status', e.target.value)}
                                className="bg-[#1F2937] border border-white/20 rounded px-1 py-1 text-xs text-white"
                              >
                                <option value="normal">В норме</option>
                                <option value="low">Ниже</option>
                                <option value="high">Выше</option>
                                <option value="critical">Критическое</option>
                                <option value="unknown">Неизвестно</option>
                              </select>
                            ) : (
                              renderStatusBadge(item.status)
                            )}
                          </td>

                          <td className="p-3">{renderConfidenceBadge(item.confidence, item.isCorrected)}</td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingId(isEditing ? null : item.id)}
                                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                title={isEditing ? 'Готово' : 'Редактировать'}
                              >
                                {isEditing ? <Check className="w-4 h-4 text-[#3DD9C5]" /> : <Edit2 className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAnalyte(item.id)}
                                className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Удалить показатель"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* FOOTER METADATA: FINGERPRINT & FILE PREVIEW */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-[#3DD9C5]" />
              <span>
                Source Fingerprint (SHA-256):{' '}
                <code className="text-gray-300 font-mono text-[10px]">
                  {stagingRecord.sourceHash?.slice(0, 16)}...
                </code>
              </span>
            </div>

            {filePreviewUrl && (
              <a
                href={filePreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#3DD9C5] hover:underline flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Открыть исходный скан</span>
              </a>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-6 border-t border-white/10 bg-[#0A101C] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {saveMode === 'commit_to_history'
                ? 'До нажатия кнопки ни один показатель не сохранен в историю.'
                : 'Режим расшифровки без записи в медицинскую карту.'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Отмена
            </button>

            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting || isQuarantined}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-[#3DD9C5] hover:bg-[#34c4b1] text-black font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                {saveMode === 'commit_to_history' ? 'Подтвердить и внести в медкарту' : 'Распознать без сохранения'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResearchVerificationModal;
