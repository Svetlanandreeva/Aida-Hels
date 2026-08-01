import React, { useState } from 'react';
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
} from 'lucide-react';

export interface RecognizedMarker {
  category: string;
  originalName: string;
  normalizedName: string;
  value: number | string;
  valueText: string;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  referenceText: string;
  status: 'low' | 'normal' | 'high' | 'critical' | 'unknown';
  sourcePage?: number;
  confidence: number; // 0 to 1
}

export interface RecognizedDocumentData {
  documentType: string;
  laboratoryName: string;
  researchDate: string;
  patientName?: string;
  rawText?: string;
  overallConfidence: number;
  warnings: string[];
  results: RecognizedMarker[];
}

interface ResearchVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentData: RecognizedDocumentData | null;
  filePreviewUrl?: string | null;
  fileName?: string;
  onConfirmSave: (confirmedData: RecognizedDocumentData) => void;
  onDeleteDoc?: () => void;
}

export const ResearchVerificationModal: React.FC<ResearchVerificationModalProps> = ({
  isOpen,
  onClose,
  documentData,
  filePreviewUrl,
  fileName,
  onConfirmSave,
  onDeleteDoc,
}) => {
  if (!isOpen || !documentData) return null;

  const [docType, setDocType] = useState(documentData.documentType || 'Общий анализ крови');
  const [labName, setLabName] = useState(documentData.laboratoryName || 'Медицинская лаборатория');
  const [researchDate, setResearchDate] = useState(documentData.researchDate || new Date().toISOString().split('T')[0]);
  const [results, setResults] = useState<RecognizedMarker[]>(documentData.results || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleUpdateMarker = (index: number, field: keyof RecognizedMarker, val: any) => {
    setResults((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleRemoveMarker = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onConfirmSave({
      ...documentData,
      documentType: docType,
      laboratoryName: labName,
      researchDate: researchDate,
      results: results,
    });
    onClose();
  };

  const renderStatusBadge = (status: RecognizedMarker['status']) => {
    switch (status) {
      case 'normal':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#34F5A4]/15 border border-[#34F5A4]/30 text-[#34F5A4] text-xs font-bold rounded-lg whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>В норме</span>
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#4DEBFF]/15 border border-[#4DEBFF]/30 text-[#4DEBFF] text-xs font-bold rounded-lg whitespace-nowrap">
            <ArrowDown className="w-3.5 h-3.5 shrink-0" />
            <span>Ниже диапазона</span>
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FF8C42]/15 border border-[#FF8C42]/30 text-[#FF8C42] text-xs font-bold rounded-lg whitespace-nowrap">
            <ArrowUp className="w-3.5 h-3.5 shrink-0" />
            <span>Выше диапазона</span>
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FF5A5A]/15 border border-[#FF5A5A]/30 text-[#FF5A5A] text-xs font-bold rounded-lg whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Критическое</span>
          </span>
        );
      case 'unknown':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-500/15 border border-gray-500/30 text-gray-400 text-xs font-bold rounded-lg whitespace-nowrap">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Не определено</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#0B1320] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl text-gray-100 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* HEADER */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-[#101A28]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 text-[#34F5A4] flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white">Экран проверки распознанных данных</h2>
              <p className="text-xs text-white/60">
                ИИ извлёк показатели из документа. Пожалуйста, проверьте и подтвердите их перед сохранением.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          
          {/* Document Meta Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#101A28] p-4 rounded-2xl border border-white/[0.06]">
            <div>
              <label className="text-[11px] font-semibold text-white/50 block mb-1 flex items-center gap-1">
                <FileCheck2 className="w-3.5 h-3.5 text-[#34F5A4]" /> Тип исследования
              </label>
              <input
                type="text"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full bg-[#0B1320] border border-white/10 rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:border-[#34F5A4]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-white/50 block mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-[#4DEBFF]" /> Лаборатория
              </label>
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="w-full bg-[#0B1320] border border-white/10 rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:border-[#4DEBFF]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-white/50 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#8E74FF]" /> Дата исследования
              </label>
              <input
                type="date"
                value={researchDate}
                onChange={(e) => setResearchDate(e.target.value)}
                className="w-full bg-[#0B1320] border border-white/10 rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:border-[#8E74FF]"
              />
            </div>
          </div>

          {/* Warnings List if confidence is lower or missing fields */}
          {documentData.warnings && documentData.warnings.length > 0 && (
            <div className="bg-[#FF8C42]/10 border border-[#FF8C42]/30 p-3.5 rounded-2xl flex items-start gap-3 text-[#FF8C42]">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block text-xs">Предупреждения системы распознавания:</span>
                <ul className="list-disc list-inside text-xs space-y-0.5 opacity-90">
                  {documentData.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* PREVIEW IMAGE / PDF ACCORDION */}
          {filePreviewUrl && (
            <div className="bg-[#101A28] p-3 rounded-2xl border border-white/[0.06] flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10 flex items-center justify-center">
                <img src={filePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-white block text-xs truncate">{fileName || 'Скан/фото бланка'}</span>
                <span className="text-[11px] text-[#34F5A4] block mt-0.5">Сохранено в защищённый Google Drive</span>
              </div>
            </div>
          )}

          {/* TABLE OF RECOGNIZED MARKERS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                <span>Извлечённые показатели ({results.length})</span>
                <span className="text-[11px] text-white/50 font-normal">
                  (нажмите на ячейку для ручной корректировки)
                </span>
              </h3>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0B1320]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#101A28] text-white/60 text-[11px] font-bold uppercase tracking-wider border-b border-white/10">
                    <th className="p-3 sm:p-4">Показатель</th>
                    <th className="p-3 sm:p-4">Значение</th>
                    <th className="p-3 sm:p-4">Ед. изм.</th>
                    <th className="p-3 sm:p-4">Референс лаборатории</th>
                    <th className="p-3 sm:p-4">Статус</th>
                    <th className="p-3 sm:p-4 text-center">Уверенность</th>
                    <th className="p-3 sm:p-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {results.map((item, idx) => {
                    const isLowConfidence = item.confidence < 0.75;
                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          isLowConfidence ? 'bg-[#FF8C42]/10 hover:bg-[#FF8C42]/15' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        {/* Показатель */}
                        <td className="p-3 sm:p-4">
                          <input
                            type="text"
                            value={item.originalName}
                            onChange={(e) => handleUpdateMarker(idx, 'originalName', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-[#34F5A4] text-white font-bold w-full focus:outline-none"
                          />
                          <span className="text-[10px] text-white/40 block mt-0.5 font-mono">
                            {item.normalizedName || 'custom'}
                          </span>
                        </td>

                        {/* Значение */}
                        <td className="p-3 sm:p-4">
                          <input
                            type="text"
                            value={item.valueText || String(item.value)}
                            onChange={(e) => {
                              const v = e.target.value;
                              handleUpdateMarker(idx, 'valueText', v);
                              handleUpdateMarker(idx, 'value', parseFloat(v) || v);
                            }}
                            className="bg-transparent border-b border-transparent focus:border-[#34F5A4] text-white font-black text-sm w-full focus:outline-none"
                          />
                        </td>

                        {/* Единица */}
                        <td className="p-3 sm:p-4">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleUpdateMarker(idx, 'unit', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-[#34F5A4] text-white/80 w-full focus:outline-none"
                          />
                        </td>

                        {/* Референс */}
                        <td className="p-3 sm:p-4">
                          <input
                            type="text"
                            value={item.referenceText}
                            onChange={(e) => handleUpdateMarker(idx, 'referenceText', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-[#34F5A4] text-white/80 w-full focus:outline-none"
                          />
                        </td>

                        {/* Статус */}
                        <td className="p-3 sm:p-4">
                          <select
                            value={item.status}
                            onChange={(e) => handleUpdateMarker(idx, 'status', e.target.value)}
                            className="bg-[#101A28] border border-white/10 text-xs rounded-lg px-2 py-1 text-white focus:outline-none"
                          >
                            <option value="normal">В норме</option>
                            <option value="low">Ниже диапазона</option>
                            <option value="high">Выше диапазона</option>
                            <option value="critical">Критическое</option>
                            <option value="unknown">Не определено</option>
                          </select>
                          <div className="mt-1">{renderStatusBadge(item.status)}</div>
                        </td>

                        {/* Уверенность */}
                        <td className="p-3 sm:p-4 text-center">
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                              isLowConfidence
                                ? 'bg-[#FF8C42]/20 text-[#FF8C42] border border-[#FF8C42]/40'
                                : 'bg-[#34F5A4]/10 text-[#34F5A4]'
                            }`}
                          >
                            {Math.round(item.confidence * 100)}%
                          </span>
                          {isLowConfidence && (
                            <span className="block text-[10px] text-[#FF8C42] font-semibold mt-1">
                              Проверьте значение
                            </span>
                          )}
                        </td>

                        {/* Действия */}
                        <td className="p-3 sm:p-4 text-right">
                          <button
                            onClick={() => handleRemoveMarker(idx)}
                            className="p-1.5 text-white/40 hover:text-[#FF5A5A] hover:bg-[#FF5A5A]/10 rounded-lg transition-colors cursor-pointer"
                            title="Удалить показатель"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Neutral Wording & Disclaimer */}
          <div className="bg-[#101A28] p-4 rounded-2xl border border-white/[0.06] space-y-2 text-xs text-white/70">
            <div className="flex items-center gap-2 text-[#34F5A4] font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Политика деликатной интерпретации</span>
            </div>
            <p className="leading-relaxed">
              Автоматическое распознавание создано для структурирования результатов лабораторных бланков. Все показатели сравниваются только с собственными референсными диапазонами указанной лаборатории.
            </p>
            <p className="text-white/50 text-[11px] italic pt-1 border-t border-white/[0.06]">
              «Автоматическое распознавание может содержать ошибки. Проверяйте данные по оригиналу документа. Интерпретация не заменяет консультацию врача.»
            </p>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 sm:p-6 border-t border-white/10 bg-[#101A28] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              if (onDeleteDoc) onDeleteDoc();
              onClose();
            }}
            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-[#FF5A5A] border border-red-500/20 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Удалить документ</span>
          </button>

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-[#34F5A4] hover:bg-[#2ce093] text-[#050A12] font-extrabold text-xs rounded-xl shadow-lg shadow-[#34F5A4]/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Подтвердить и сохранить</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
