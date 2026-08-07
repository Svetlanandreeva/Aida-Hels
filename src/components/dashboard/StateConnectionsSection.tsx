import React, { useState } from 'react';
import { StateConnection } from '../../types';
import { GitCommit, AlertTriangle, ArrowRight, Info, ShieldAlert, Sparkles } from 'lucide-react';

interface StateConnectionsSectionProps {
  connections: StateConnection[];
  onOpenDoctorReport?: () => void;
}

export const StateConnectionsSection: React.FC<StateConnectionsSectionProps> = ({
  connections,
  onOpenDoctorReport,
}) => {
  const [selectedConnection, setSelectedConnection] = useState<StateConnection | null>(
    connections[0] || null
  );

  if (connections.length === 0) {
    return (
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#8E74FF]/10 border border-[#8E74FF]/20 text-[#8E74FF] flex items-center justify-center shrink-0">
            <GitCommit className="w-4 h-4" />
          </div>
          <h2 className="font-extrabold text-white text-sm sm:text-base tracking-tight">
            Связи состояний и патофизиологические цепочки
          </h2>
        </div>
        <div className="p-4 bg-[#101A28] border border-white/[0.06] rounded-xl text-xs text-white/70 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-[#8E74FF] shrink-0" />
          <span>
            При выведении показателей за рамки нормы Аида автоматически формирует межсистемные связи (например, влияние дефицита ферритина на сердечный пульс или влияние уровня ТТГ на липидный обмен).
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0B1320] border border-[#8E74FF]/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-4 relative overflow-hidden">
      {/* Glow background accent */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#8E74FF]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#8E74FF]/15 border border-[#8E74FF]/30 text-[#8E74FF] flex items-center justify-center shrink-0">
            <GitCommit className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-white text-sm sm:text-base tracking-tight">
                Связи состояний ({connections.length})
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#8E74FF]/20 text-[#8E74FF] text-[10px] font-bold border border-[#8E74FF]/30">
                Межсистемный ИИ-анализ
              </span>
            </div>
            <p className="text-[11px] text-white/60">
              Взаимосвязи между показателями лабораторных анализов и функциональными системами
            </p>
          </div>
        </div>

        {onOpenDoctorReport && (
          <button
            onClick={onOpenDoctorReport}
            className="self-start sm:self-auto px-3 py-1.5 bg-[#8E74FF]/10 hover:bg-[#8E74FF]/20 border border-[#8E74FF]/30 rounded-xl text-xs font-bold text-[#8E74FF] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Отчёт врачу</span>
          </button>
        )}
      </div>

      {/* Grid Layout: Connection Selector Buttons & Connection Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Connection Tabs */}
        <div className="lg:col-span-5 space-y-2">
          {connections.map((conn) => {
            const isSelected = selectedConnection?.id === conn.id;
            return (
              <button
                key={conn.id}
                onClick={() => setSelectedConnection(conn)}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  isSelected
                    ? 'bg-[#152338] border-[#8E74FF] shadow-lg shadow-[#8E74FF]/10'
                    : 'bg-[#101A28] hover:bg-[#132033] border-white/[0.06] text-white/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#4DEBFF] bg-[#4DEBFF]/10 px-2 py-0.5 rounded">
                    {conn.sourceMarker}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      conn.severity === 'critical'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {conn.severity === 'critical' ? 'Высокий риск' : 'Умеренный риск'}
                  </span>
                </div>

                <h4 className="font-bold text-white text-xs leading-snug">{conn.title}</h4>

                <div className="flex flex-wrap items-center gap-1 text-[10px] text-white/50">
                  <span>Затрагивает:</span>
                  {conn.affectedSystems.map((sys, idx) => (
                    <span key={idx} className="bg-white/5 px-1.5 py-0.5 rounded text-white/70 font-medium">
                      {sys}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Connection Detailed Card */}
        {selectedConnection && (
          <div className="lg:col-span-7 bg-[#101A28] border border-white/[0.08] rounded-xl p-4 space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                <div>
                  <span className="text-[11px] font-bold text-[#8E74FF]">
                    Первопричина / Триггер: {selectedConnection.sourceMarker}
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                    {selectedConnection.title}
                  </h3>
                </div>
                <div className="p-2 bg-[#8E74FF]/10 rounded-xl text-[#8E74FF] shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>

              {/* Pathophysiological Mechanism */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                  Патофизиологический механизм каскада:
                </span>
                <p className="text-xs text-white/90 leading-relaxed bg-[#0B1320] p-3 rounded-xl border border-white/[0.04]">
                  {selectedConnection.mechanism}
                </p>
              </div>

              {/* Connected Systems Badges */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                  Связанные органы и системы:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedConnection.affectedSystems.map((sysName, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#8E74FF]/10 border border-[#8E74FF]/30 text-[#8E74FF] text-xs font-bold"
                    >
                      <GitCommit className="w-3 h-3" />
                      <span>{sysName}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical Recommendation */}
              <div className="p-3 bg-[#34F5A4]/10 border border-[#34F5A4]/20 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-[#34F5A4] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Рекомендация по коррекции состояния:</span>
                </span>
                <p className="text-xs text-white/90">{selectedConnection.recommendation}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
