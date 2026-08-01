import React from 'react';
import { BodySystem } from '../../types';
import { Activity, X, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Plus } from 'lucide-react';

interface SystemDetailModalProps {
  system: BodySystem | null;
  onClose: () => void;
  onAddTestToAppointments?: (testName: string) => void;
}

export const SystemDetailModal: React.FC<SystemDetailModalProps> = ({
  system,
  onClose,
  onAddTestToAppointments,
}) => {
  if (!system) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#14171C] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto border border-gray-800">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-gray-800 pb-4">
          <div className="space-y-1">
            <span
              className={`px-2.5 py-0.5 rounded-md font-bold text-xs inline-block ${
                system.status === 'norm'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
              }`}
            >
              Статус: {system.statusText} • Индекс {system.score}%
            </span>
            <h2 className="text-xl font-extrabold text-gray-100">{system.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-200 text-lg font-bold rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level of Attention Indicator */}
        <div className="bg-[#0F1115] p-4 rounded-2xl border border-gray-800 flex items-center justify-between text-xs">
          <span className="text-gray-400 font-medium">Уровень клинического внимания:</span>
          <span
            className={`font-bold px-3 py-1 rounded-lg ${
              system.attentionLevel === 'Низкий'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
            }`}
          >
            {system.attentionLevel}
          </span>
        </div>

        {/* Detailed Analysis Text */}
        <div className="space-y-2">
          <h3 className="font-bold text-gray-100 text-sm">Подробная расшифровка состояния:</h3>
          <p className="text-xs text-gray-300 bg-[#0F1115] p-4 rounded-xl leading-relaxed border border-gray-800">
            {system.detailedAnalysis}
          </p>
        </div>

        {/* Lifestyle & Nutrition Recommendations */}
        <div className="space-y-2">
          <h3 className="font-bold text-gray-100 text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Персональные рекомендации по образу жизни:</span>
          </h3>
          <ul className="space-y-1.5 text-xs text-gray-300">
            {system.lifestyleRecommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommended Tests to Take */}
        <div className="space-y-2 pt-2 border-t border-gray-800">
          <h3 className="font-bold text-gray-100 text-sm">Что сдать (рекомендованные лабораторные тесты):</h3>
          <div className="space-y-2">
            {system.recommendedTests.map((test, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#0F1115] border border-gray-800 rounded-xl text-xs flex items-center justify-between gap-3"
              >
                <div>
                  <span className="font-bold text-gray-100 block">{test.name}</span>
                  <span className="text-gray-400 text-[11px]">{test.reason}</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold rounded text-[10px] shrink-0">
                  {test.urgency}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Close */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            Понятно, закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
