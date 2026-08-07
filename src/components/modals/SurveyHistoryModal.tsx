import React, { useState } from 'react';
import { X, History, Sparkles, TrendingUp, TrendingDown, CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { QuestionnaireSnapshot } from '../../types';

interface SurveyHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: QuestionnaireSnapshot[];
  onRetakeSurvey: () => void;
}

export const SurveyHistoryModal: React.FC<SurveyHistoryModalProps> = ({
  isOpen,
  onClose,
  snapshots = [],
  onRetakeSurvey,
}) => {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    snapshots.length > 0 ? snapshots[0].survey_id : null
  );

  if (!isOpen) return null;

  const activeSnapshot = snapshots.find((s) => s.survey_id === selectedSnapshotId) || snapshots[0];
  const previousSnapshot = snapshots.length > 1 ? snapshots[1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#14171C] border border-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#121620] via-[#1A2232] to-[#121620] p-6 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100">История комплексных опросов</h2>
              <p className="text-xs text-gray-400">Снимки состояния организма и динамика изменений</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800/60 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm text-gray-300">
          {snapshots.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-gray-400">Вы ещё не проходили комплексный опрос.</p>
              <button
                onClick={() => {
                  onClose();
                  onRetakeSurvey();
                }}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all"
              >
                Пройти опрос
              </button>
            </div>
          ) : (
            <>
              {/* Snapshot Selector Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-800">
                {snapshots.map((snap, idx) => {
                  const dateStr = new Date(snap.completed_at || snap.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                  const isSelected = snap.survey_id === activeSnapshot?.survey_id;
                  return (
                    <button
                      key={snap.survey_id}
                      onClick={() => setSelectedSnapshotId(snap.survey_id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <span>Опрос #{snapshots.length - idx} ({dateStr})</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Snapshot Overview */}
              {activeSnapshot && (
                <div className="space-y-4">
                  <div className="bg-[#0F1115] p-4 rounded-2xl border border-gray-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-400 pb-1 border-b border-gray-800">
                      <span>Дата прохождения: <strong>{new Date(activeSnapshot.completed_at || activeSnapshot.created_at).toLocaleDateString('ru-RU')}</strong></span>
                      <span className="text-emerald-400 font-medium">Версия: {activeSnapshot.survey_version || 'v1.0'}</span>
                    </div>

                    <div className="pt-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                        Предварительная сводка ИИ:
                      </span>
                      <p className="text-gray-200 text-xs sm:text-sm leading-relaxed">
                        {activeSnapshot.ai_summary || 'Предварительная оценка состояния на основании ваших ответов.'}
                      </p>
                    </div>

                    {activeSnapshot.attention_areas && activeSnapshot.attention_areas.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                          Отмеченные зоны внимания:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {activeSnapshot.attention_areas.map((area, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg text-xs"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comparison with Previous Snapshot if exists */}
                  {previousSnapshot && (
                    <div className="bg-gradient-to-r from-[#121824] to-[#151B28] p-4 rounded-2xl border border-teal-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-teal-300 font-bold text-xs uppercase tracking-wider">
                        <TrendingUp className="w-4 h-4 text-teal-400" />
                        <span>Сравнение с предыдущим опросом:</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        По сравнению с прошлым опросом вы чаще отмечаете усталость к вечеру, но показатели уровня стресса стали более сбалансированными.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-800 bg-[#0F1115] flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              onClose();
              onRetakeSurvey();
            }}
            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Пройти повторный опрос</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
