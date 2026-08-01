import React from 'react';
import { UrgentRedFlagAlert } from '../../types';
import { AlertOctagon, PhoneCall, ShieldAlert, ArrowRight } from 'lucide-react';

interface RedFlagBannerProps {
  alert: UrgentRedFlagAlert;
}

export const RedFlagBanner: React.FC<RedFlagBannerProps> = ({ alert }) => {
  return (
    <div
      id="red-flag-alert-banner"
      className="bg-gradient-to-r from-rose-950/90 via-red-900/80 to-rose-950/90 border-2 border-rose-500 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 animate-pulse-subtle"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                Критическое предупреждение
              </span>
              <span className="text-xs text-rose-300/80 font-mono">ID: {alert.id}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-1 leading-tight">
              {alert.title}
            </h2>
            <p className="text-xs sm:text-sm text-rose-200/90 mt-1 leading-relaxed">
              {alert.description}
            </p>
          </div>
        </div>
      </div>

      {alert.criticalSymptoms && alert.criticalSymptoms.length > 0 && (
        <div className="bg-black/30 p-3.5 rounded-xl border border-rose-500/30">
          <span className="text-xs font-bold text-rose-300 block mb-1">
            Критические сигналы, зафиксированные ИИ:
          </span>
          <div className="flex flex-wrap gap-2">
            {alert.criticalSymptoms.map((sym, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 bg-rose-500/20 text-rose-200 border border-rose-500/30 rounded-lg text-xs font-medium"
              >
                • {sym}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-rose-500/30">
        <div className="flex items-center gap-2 text-xs text-rose-200">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{alert.recommendedAction}</span>
        </div>

        <a
          href={`tel:${alert.emergencyNumber.split('/')[0].trim()}`}
          className="px-5 py-3 bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <PhoneCall className="w-4.5 h-4.5" />
          <span>Вызвать помощь ({alert.emergencyNumber})</span>
        </a>
      </div>
    </div>
  );
};
