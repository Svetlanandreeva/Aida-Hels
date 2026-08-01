import React from 'react';
import { BodySystem } from '../../types';
import { Activity, ShieldAlert, CheckCircle2, ChevronRight, X, AlertTriangle } from 'lucide-react';

interface BodyMapOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  systems: BodySystem[];
  onSelectSystem: (system: BodySystem) => void;
  onOpenDoctorReport: () => void;
}

export const BodyMapOverviewModal: React.FC<BodyMapOverviewModalProps> = ({
  isOpen,
  onClose,
  systems,
  onSelectSystem,
  onOpenDoctorReport,
}) => {
  if (!isOpen) return null;

  // Find systems with warnings or deviations
  const warningSystems = systems.filter((s) => s.status !== 'norm' || s.deviationsCount > 0);
  const totalDeviations = systems.reduce((acc, curr) => acc + curr.deviationsCount, 0);

  // Collect all recommended tests
  const allMissingTests = systems.flatMap((s) =>
    s.recommendedTests.map((t) => ({ ...t, systemName: s.name }))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#14171C] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto border border-gray-800">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Activity className="w-3.5 h-3.5" />
              <span>Автоматический разбор ИИ</span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-100">
              Сводный разбор карты 10 систем организма
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-200 text-lg font-bold rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Executive Health Overview Banner */}
        <div className="bg-[#0F1115] border border-gray-800 text-white p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold">Общий системный профиль</span>
            <span className="text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
              Зафиксировано {totalDeviations} отклонения
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            По результатам автоматического сопоставления показателей: <strong className="text-gray-100">8 систем из 10</strong> функционируют в целевой норме. Основного внимания требуют <strong className="text-gray-100">Эндокринная система</strong> (Витамин D и ТТГ) и <strong className="text-gray-100">Нервная система</strong> (суточный стресс).
          </p>
        </div>

        {/* Warning Systems List */}
        <div className="space-y-3">
          <h3 className="font-bold text-gray-100 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Системы, требующие контроля ({warningSystems.length}):</span>
          </h3>

          <div className="space-y-2">
            {warningSystems.map((sys) => (
              <div
                key={sys.id}
                onClick={() => {
                  onClose();
                  onSelectSystem(sys);
                }}
                className="bg-amber-500/10 hover:bg-amber-500/20 p-3.5 rounded-xl border border-amber-500/20 flex items-center justify-between cursor-pointer transition-all"
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-gray-100 text-xs">
                    <span>{sys.name}</span>
                    <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded">
                      {sys.score}%
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{sys.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Missing Recommended Lab Tests */}
        <div className="space-y-3 pt-2 border-t border-gray-800">
          <h3 className="font-bold text-gray-100 text-sm">
            Недостающие рекомендованные анализы:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {allMissingTests.slice(0, 4).map((test, idx) => (
              <div key={idx} className="p-3 bg-[#0F1115] rounded-xl border border-gray-800 space-y-1">
                <div className="flex justify-between font-bold text-gray-100">
                  <span>{test.name}</span>
                  <span className="text-emerald-400 font-semibold">{test.urgency}</span>
                </div>
                <p className="text-[11px] text-gray-400">{test.reason} ({test.systemName})</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-900 text-gray-300 font-semibold text-xs border border-gray-800 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Закрыть разбор
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenDoctorReport();
            }}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            Сформировать печатный отчёт для врача
          </button>
        </div>
      </div>
    </div>
  );
};
