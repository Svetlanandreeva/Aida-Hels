import React from 'react';
import { X, Sparkles, CheckCircle2, Clock, ShieldCheck, ArrowRight, HelpCircle } from 'lucide-react';

interface QuestionnaireProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSurvey: () => void;
  onDecline: () => void;
}

export const QuestionnaireProposalModal: React.FC<QuestionnaireProposalModalProps> = ({
  isOpen,
  onClose,
  onStartSurvey,
  onDecline,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#14171C] border border-gray-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-[#18202A] to-[#12161F] p-6 border-b border-gray-800 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800/60 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400">
                Добровольная функция
              </span>
              <h2 className="text-xl font-bold text-gray-100">
                Получите предварительную картину уже сейчас
              </h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-gray-300 text-xs sm:text-sm">
          <p className="leading-relaxed text-gray-300">
            Обычно приложению требуется несколько недель, чтобы заметить ваши индивидуальные закономерности. Комплексный опрос поможет быстрее понять общее состояние организма на основании ваших ответов.
          </p>

          {/* Advantages List */}
          <div className="bg-[#0F1115] p-4 rounded-2xl border border-gray-800 space-y-2.5">
            <div className="text-xs font-bold text-gray-200 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Особенности опроса:</span>
            </div>
            <ul className="space-y-2 text-xs text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>Занимает около 10–15 минут</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>Можно сохранить черновик и продолжить позже</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>Любой вопрос можно пропустить</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>Ответы можно обновить в любое время</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>Результат будет предварительным, а не медицинским диагнозом</span>
              </li>
            </ul>
          </div>

          {/* Disclaimer Note */}
          <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-amber-200/90">
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-snug">
              Опрос не ставит диагноз и не заменяет обследование врача. Вы можете пропустить любой вопрос, сохранить черновик или пройти его позже.
            </p>
          </div>
        </div>

        {/* Buttons Footer */}
        <div className="p-6 pt-0 flex flex-col gap-2.5">
          <button
            onClick={() => {
              onStartSurvey();
              onClose();
            }}
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Начать опрос</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onClose();
              }}
              className="py-2.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs rounded-xl transition-all cursor-pointer text-center"
            >
              Продолжить без опроса
            </button>
            <button
              onClick={() => {
                onDecline();
                onClose();
              }}
              className="py-2.5 px-3 bg-gray-900 hover:bg-gray-800 text-gray-400 font-medium text-xs rounded-xl border border-gray-800 transition-all cursor-pointer text-center"
            >
              Мне это не нужно
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
