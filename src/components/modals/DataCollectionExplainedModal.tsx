import React from 'react';
import { X, ShieldCheck, Database, Calendar, FileText, Pill, Activity, Heart, Smartphone } from 'lucide-react';

interface DataCollectionExplainedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataCollectionExplainedModal: React.FC<DataCollectionExplainedModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const sources = [
    {
      icon: Calendar,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      title: 'Дневник и эмоциональная сфера',
      desc: 'Записи о самочувствии, настроении, уровне энергии, дневном стрессе и качестве сна.',
    },
    {
      icon: FileText,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      title: 'Анализы и исследования',
      desc: 'Распознанные лабораторные анализы, снимки УЗИ, ЭКГ и заключения специалистов.',
    },
    {
      icon: Activity,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      title: 'Измерения показателей',
      desc: 'Динамика артериального давления, пульса, температуры, сахара крови и веса.',
    },
    {
      icon: Pill,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      title: 'Препараты и курсы',
      desc: 'Отметки о приёме лекарств, пропущенных дозах и возможных реакциях.',
    },
    {
      icon: Heart,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      title: 'Комплексный опрос',
      desc: 'Добровольные ответы для быстрой оценки состояния без ожидания нескольких недель.',
    },
    {
      icon: Smartphone,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      title: 'Устройства и гаджеты',
      desc: 'Данные о шагах, фазах сна и пульсе с фитнес-браслетов (при подключении).',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#14171C] border border-gray-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#121620] via-[#1A2232] to-[#121620] p-6 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100">Как собираются данные</h2>
              <p className="text-xs text-gray-400">Источники и принципы формирования персонального профиля</p>
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
        <div className="p-6 overflow-y-auto space-y-5 text-gray-300 text-xs sm:text-sm flex-1">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-xs text-emerald-200/90 space-y-1.5">
            <div className="font-bold text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Главный принцип накопления</span>
            </div>
            <p className="leading-relaxed">
              Каждая новая запись дополняет ваш персональный профиль. Мы не перезаписываем старые данные новыми: вся история сохраняется, позволяя ИИ отслеживать динамику и замечать важные изменения во времени.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Источники персональной аналитики:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sources.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#0F1115] p-3.5 rounded-2xl border border-gray-800/80 space-y-1.5 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${item.color}`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-gray-200 text-xs">{item.title}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-800 bg-[#0F1115] shrink-0 text-right">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
