import React from 'react';
import { Sparkles, Info, X, Zap, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

interface NewUserIntroCardProps {
  onAccelerateAnalysis: () => void;
  onExplainDataCollection: () => void;
  onDismiss: () => void;
}

export const NewUserIntroCard: React.FC<NewUserIntroCardProps> = ({
  onAccelerateAnalysis,
  onExplainDataCollection,
  onDismiss,
}) => {
  return (
    <div className="bg-gradient-to-r from-[#121824] via-[#161C2A] to-[#121620] rounded-2xl p-4 sm:p-5 border border-emerald-500/30 shadow-lg relative overflow-hidden my-4">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top bar with heading and close button */}
      <div className="flex items-start justify-between gap-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-gray-100 tracking-tight">
            Мы только начинаем знакомиться
          </h3>
        </div>
        <button
          onClick={onDismiss}
          title="Скрыть подсказку"
          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main explanatory text */}
      <div className="space-y-2 text-xs sm:text-sm text-gray-300 leading-relaxed pl-1 sm:pl-10">
        <p>
          Сейчас данных ещё немного. Приложение будет постепенно замечать, что влияет на ваше самочувствие, энергию, сон и настроение. Чем дольше вы им пользуетесь, тем точнее становятся наблюдения.
        </p>
        <p className="text-emerald-400/90 font-medium flex items-center gap-1.5 pt-0.5 text-xs">
          <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            Более полная персональная картина обычно формируется примерно за месяц регулярного использования.
          </span>
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-gray-800/80 flex flex-wrap items-center gap-2.5 sm:pl-10">
        <button
          onClick={onAccelerateAnalysis}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Ускорить анализ</span>
        </button>

        <button
          onClick={onExplainDataCollection}
          className="px-3.5 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-200 font-medium text-xs rounded-xl border border-gray-700/80 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Info className="w-3.5 h-3.5 text-teal-400" />
          <span>Как собираются данные</span>
        </button>

        <button
          onClick={onDismiss}
          className="ml-auto text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1"
        >
          Понятно, продолжить
        </button>
      </div>
    </div>
  );
};
