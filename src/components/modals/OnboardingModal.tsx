import React, { useState } from 'react';
import {
  X,
  Heart,
  Brain,
  Activity,
  FileText,
  Sparkles,
  Pill,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Award,
  BookOpen,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinish: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onFinish,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Добро пожаловать в «Здоровье ИИ»!',
      subtitle: 'Ваш единый цифровой медицинский паспорт',
      icon: Sparkles,
      iconBg: 'bg-[#34F5AA]/15 text-[#34F5AA] border-[#34F5AA]/30',
      badge: 'Обучение • Шаг 1 из 5',
      description:
        'Система объединяет все данные о вашем организме: от антропометрии и анализов до эмоционального состояния и суточного артериального давления.',
      features: [
        'Автоматический расчет индекса массы и рисков',
        'Персональный прогноз биологического ресурса',
        'Полная защита и шифрование данных по ФЗ-152',
      ],
    },
    {
      title: 'Карта 10 систем организма',
      subtitle: 'Мониторинг ключевых органов и систем',
      icon: Activity,
      iconBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      badge: 'Обучение • Шаг 2 из 5',
      description:
        'ИИ непрерывно анализирует Сердечно-сосудистую, Нервную, ЖКТ, Иммунную и другие 6 систем на основе ваших дневников и лабораторий.',
      features: [
        'Интерактивная карта тела с цветовой индикацией статуса',
        'Мгновенная подсветка органов, требующих внимания',
        'Подробная детализация по каждой системе с рекомендациями',
      ],
    },
    {
      title: 'Дневники: Давление и Эмоции',
      subtitle: 'Ежедневный контроль симптомов и фокуса',
      icon: Heart,
      iconBg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      badge: 'Обучение • Шаг 3 из 5',
      description:
        'Удобно заносите показатели артериального давления, пульса, настроение и стресс. ИИ выявит скрытые взаимосвязи и предупредит о рисках.',
      features: [
        'Дневник давления с графиками и расчетом нормалей',
        'Дневник эмоционального баланса и ментальных паттернов',
        'Ежедневный 1-минутный ИИ-опрос состояния',
      ],
    },
    {
      title: 'Анализы и Медкарты с ИИ',
      subtitle: 'Мгновенная расшифровка сложных бланков',
      icon: FileText,
      iconBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      badge: 'Обучение • Шаг 4 из 5',
      description:
        'Загружайте бланки лабораторных анализов, УЗИ и консультаций врачей. ИИ подсветит отклонения от референсов простым и понятным языком.',
      features: [
        'Таблицы отклонений с указанием нормы и статуса',
        'Хранилище медицинских заключений и выписок',
        'Формирование печатного отчёта для вашего врача',
      ],
    },
    {
      title: 'ИИ-Помощник & Расписание',
      subtitle: 'Ваш персональный медицинский консультант',
      icon: Pill,
      iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      badge: 'Обучение • Шаг 5 из 5',
      description:
        'Задавайте любые вопросы по симптом-чекеру, совместимости медикаментов и образу жизни. Настраивайте удобные напоминания о приёме лекарств.',
      features: [
        'Круглосуточный ИИ-чат с медицинским контекстом',
        'Уведомления о приёме таблеток и визитах к врачу',
        'Полный контроль и редактирование профиля в любое время',
      ],
    },
  ];

  const step = steps[currentStep];
  const StepIcon = step.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#0B1320] border border-white/10 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden text-white flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08] bg-[#0E1726]/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#34F5AA]/10 text-[#34F5AA] border border-[#34F5AA]/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-gray-300">
              Интерактивное обучение
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            title="Пропустить обучение"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slide Body */}
        <div className="p-6 sm:p-8 space-y-6 flex-1">
          {/* Badge & Icon */}
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-bold text-[#34F5AA]">
              {step.badge}
            </span>
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-lg ${step.iconBg}`}
            >
              <StepIcon className="w-6 h-6" />
            </div>
          </div>

          {/* Titles */}
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {step.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#34F5AA] font-semibold">
              {step.subtitle}
            </p>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed bg-[#101C2B] p-4 rounded-2xl border border-white/[0.05]">
            {step.description}
          </p>

          {/* Feature Bullets */}
          <div className="space-y-2.5 pt-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Основные возможности:
            </span>
            {step.features.map((feat, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 text-xs text-gray-200"
              >
                <CheckCircle2 className="w-4 h-4 text-[#34F5AA] shrink-0 mt-0.5" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="p-5 border-t border-white/[0.08] bg-[#0E1726]/60 flex items-center justify-between gap-3">
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStep
                    ? 'w-6 bg-[#34F5AA]'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Назад</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-[#34F5AA] hover:bg-[#2ce093] text-[#050A12] font-bold text-xs shadow-lg shadow-[#34F5AA]/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>
                {currentStep === steps.length - 1
                  ? 'Завершить обучение'
                  : 'Далее'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
