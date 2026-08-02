import React from 'react';
import {
  Heart,
  Activity,
  FileCheck2,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Smartphone,
  Dna,
  Video,
  Apple,
  Brain,
  Moon,
  TrendingUp,
  Star,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  Lock,
  Calendar,
  Layers,
  FileText,
} from 'lucide-react';
import { EmotionalSphere } from './EmotionalSphere';

interface StartScreenProps {
  onStartQuestionnaire: () => void;
  onGoToDashboard: () => void;
  onLoginClick: () => void;
  isAuthenticated: boolean;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStartQuestionnaire,
  onGoToDashboard,
  onLoginClick,
  isAuthenticated,
}) => {
  // 4 Cards for "Почему это отличается"
  const whyDifferent = [
    {
      icon: Activity,
      color: 'text-[#34F5AA] bg-[#34F5AA]/10 border-[#34F5AA]/20',
      title: 'Мультисистемный ИИ-анализ',
      desc: 'Комплексный непрерывный скан 10 ключевых систем организма в единую цифровую экосистему.',
    },
    {
      icon: FileCheck2,
      color: 'text-[#4CEBFF] bg-[#4CEBFF]/10 border-[#4CEBFF]/20',
      title: 'Мгновенная расшифровка',
      desc: 'Автоматическое распознавание лабораторных бланков, снимков и PDF-выписок за секунды.',
    },
    {
      icon: ShieldCheck,
      color: 'text-[#8870FF] bg-[#8870FF]/10 border-[#8870FF]/20',
      title: 'Врачебная точность',
      desc: 'Формирование отчетов стандарта A4 по протоколам доказательной медицины для очного приема.',
    },
    {
      icon: MessageSquare,
      color: 'text-[#FF9830] bg-[#FF9830]/10 border-[#FF9830]/20',
      title: 'Непрерывный мониторинг',
      desc: 'Персональный ИИ-ассистент 24/7 отслеживает биомаркеры и динамику психоэмоционального ресурса.',
    },
  ];

  // 4 Steps for "Как это работает"
  const processSteps = [
    {
      step: '01',
      title: 'Заполнение анкеты',
      desc: '5 минут для формирования первичного медицинского паспорта',
      color: 'bg-[#34F5AA] text-[#050A12] shadow-[0_0_20px_rgba(52,245,170,0.4)]',
    },
    {
      step: '02',
      title: 'Загрузка анализов',
      desc: 'ИИ сканирует выписки, PDF и исторические биомаркеры',
      color: 'bg-[#4CEBFF] text-[#050A12] shadow-[0_0_20px_rgba(76,235,255,0.4)]',
    },
    {
      step: '03',
      title: 'ИИ-анализ 10 систем',
      desc: 'Мгновенный расчет состояния органов и потенциальных рисков',
      color: 'bg-[#8870FF] text-white shadow-[0_0_20px_rgba(136,112,255,0.4)]',
    },
    {
      step: '04',
      title: 'Готовый результат',
      desc: 'Персональные рекомендации, трекинг и отчёт для врача',
      color: 'bg-[#34F5AA] text-[#050A12] shadow-[0_0_20px_rgba(52,245,170,0.4)]',
    },
  ];

  // 8 Cards for "Возможности приложения"
  const appFeatures = [
    {
      icon: Layers,
      title: 'Карта 10 систем',
      desc: 'Визуальная интерактивная оценка всех органов',
      color: 'text-[#34F5AA] bg-[#34F5AA]/10',
    },
    {
      icon: FileText,
      title: 'Расшифровка PDF',
      desc: 'ИИ-сканирование любых лабораторных бланков',
      color: 'text-[#4CEBFF] bg-[#4CEBFF]/10',
    },
    {
      icon: Brain,
      title: 'Ментальный дневник',
      desc: 'Трекинг эмоций, стресса и уровня энергии',
      color: 'text-[#8870FF] bg-[#8870FF]/10',
    },
    {
      icon: MessageSquare,
      title: 'ИИ-Консультант 24/7',
      desc: 'Ответы на вопросы по симптомам и рекомендациям',
      color: 'text-[#FF9830] bg-[#FF9830]/10',
    },
    {
      icon: ShieldCheck,
      title: 'Печать отчета A4',
      desc: 'Готовая клиническая выписка для врача',
      color: 'text-[#34F5AA] bg-[#34F5AA]/10',
    },
    {
      icon: Calendar,
      title: 'Уведомления и приемы',
      desc: 'Умный календарь анализов и лекарственных схем',
      color: 'text-[#4CEBFF] bg-[#4CEBFF]/10',
    },
    {
      icon: TrendingUp,
      title: 'Прогноз ресурса',
      desc: 'Предиктивная аналитика физического состояния',
      color: 'text-[#8870FF] bg-[#8870FF]/10',
    },
    {
      icon: Lock,
      title: 'Защита данных',
      desc: 'Шифрование профиля по медицинским стандартам',
      color: 'text-[#FF9830] bg-[#FF9830]/10',
    },
  ];

  // Statistics
  const statistics = [
    { value: '10', label: 'Систем организма в анализе', color: 'text-[#34F5AA]' },
    { value: '26+', label: 'Ключевых биомаркеров', color: 'text-[#4CEBFF]' },
    { value: '99.4%', label: 'Точность ИИ-расшифровки', color: 'text-[#8870FF]' },
    { value: '24/7', label: 'Доступ ко всем сервисам', color: 'text-[#FF9830]' },
  ];

  // Testimonials
  const testimonials = [
    {
      name: 'Елена Соколова',
      role: 'Руководитель продуктов',
      text: 'Благодаря системе «Здоровье» впервые за годы получила структурированную картину анализов. Врач на приеме был в восторге от формата выписки A4.',
      rating: 5,
    },
    {
      name: 'Дмитрий Волков',
      role: 'Предприниматель',
      text: 'ИИ-ассистент помог вовремя заметить дефициты биомаркеров. Мониторинг энергии и сна дал ощутимый прирост продуктивности.',
      rating: 5,
    },
    {
      name: 'Мария Кравцова',
      role: 'Архитектор',
      text: 'Интерфейс выглядит как продукт будущего. Сфера психоэмоционального ресурса очень точно отражает текущий уровень стресса.',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-[#050A12] text-white font-[SF_Pro_Display],Inter selection:bg-[#34F5AA]/20 selection:text-[#34F5AA] overflow-x-hidden">
      {/* Background Noise & Lighting Lines */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(7,19,31,0.8),transparent_70%)] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-[rgba(52,245,170,0.06)] to-transparent pointer-events-none z-0" />

      <div className="relative z-10 max-w-[1320px] mx-auto px-5 lg:px-0">
        {/* HEADER */}
        <header className="h-[64px] sm:h-[80px] flex items-center justify-between border-b border-white/[0.05] gap-2">
          {/* Logo 48x48 + Name 24px Bold */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-[38px] h-[38px] sm:w-[48px] sm:h-[48px] rounded-[14px] sm:rounded-[16px] bg-[#34F5AA]/10 border border-[#34F5AA]/30 flex items-center justify-center text-[#34F5AA] shadow-[0_0_20px_rgba(52,245,170,0.15)] shrink-0">
              <Heart className="w-4 h-4 sm:w-6 sm:h-6 fill-[#34F5AA]" />
            </div>
            <span className="text-[18px] sm:text-[24px] font-bold text-white tracking-tight">
              Здоровье
            </span>
          </div>

          {/* Nav Links Gap 48px */}
          <nav className="hidden md:flex items-center gap-[40px] lg:gap-[48px] text-[15px] text-white/70 font-medium">
            <a href="#why" className="hover:text-white transition-colors">Почему это отличается</a>
            <a href="#dashboard" className="hover:text-white transition-colors">Dashboard</a>
            <a href="#process" className="hover:text-white transition-colors">Как это работает</a>
            <a href="#features" className="hover:text-white transition-colors">Возможности</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Отзывы</a>
          </nav>

          {/* Button "Начать бесплатно" */}
          <button
            onClick={isAuthenticated ? onGoToDashboard : onStartQuestionnaire}
            className="h-[40px] sm:h-[52px] px-[14px] sm:px-[28px] rounded-[20px] sm:rounded-[26px] bg-[#34F5AA] hover:bg-[#2ce093] text-[#050A12] font-bold text-xs sm:text-[15px] shadow-[0_8px_20px_rgba(52,245,170,0.30)] transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0"
          >
            <span>{isAuthenticated ? 'Личный кабинет' : 'Начать бесплатно'}</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </header>

        {/* HERO SECTION */}
        <section className="pt-4 sm:pt-10 lg:pt-12 pb-6 sm:pb-12 lg:pb-20 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 items-center">
            {/* Left Block (col-span-7 on large screens for ample text width) */}
            <div className="lg:col-span-7 max-w-[640px] space-y-0 text-center lg:text-left flex flex-col items-center lg:items-start">
              {/* Badge */}
              <div className="h-[34px] px-[16px] rounded-[18px] bg-[#34F5AA]/10 border border-[#34F5AA]/30 text-[#34F5AA] text-[13px] font-medium flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Цифровой ассистент здоровья нового поколения</span>
              </div>

              {/* H1 Title */}
              <h1 className="mt-[20px] text-[32px] sm:text-[52px] lg:text-[64px] xl:text-[70px] font-bold text-white tracking-[-0.02em] leading-[1.1]">
                Ваше здоровье —<br className="hidden sm:block" />под контролем ИИ
              </h1>

              {/* Description */}
              <p className="mt-[24px] max-w-[540px] text-[15px] sm:text-[17px] text-white/70 font-normal leading-[28px]">
                ИИ анализирует все системы организма, автоматически расшифровывает лабораторные выписки и помогает принимать решения для идеального самочувствия.
              </p>

              {/* Buttons */}
              <div className="mt-[36px] flex flex-col sm:flex-row items-center gap-[16px] w-full sm:w-auto">
                <button
                  onClick={isAuthenticated ? onGoToDashboard : onStartQuestionnaire}
                  className="w-full sm:w-[220px] h-[54px] sm:h-[58px] rounded-[29px] bg-[#34F5AA] hover:bg-[#2ce093] text-[#050A12] font-bold text-[16px] shadow-[0_8px_24px_rgba(52,245,170,0.30)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isAuthenticated ? 'Личный кабинет' : 'Начать бесплатно'}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  onClick={onLoginClick}
                  className="w-full sm:w-[200px] h-[54px] sm:h-[58px] rounded-[29px] bg-transparent border border-white/15 hover:border-white/40 text-white font-semibold text-[16px] transition-all flex items-center justify-center cursor-pointer"
                >
                  Войти в аккаунт
                </button>
              </div>
            </div>

            {/* Right Block: Live State Field */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center relative mt-2 lg:mt-0">
              <div className="relative w-[220px] h-[220px] sm:w-[380px] sm:h-[380px] lg:w-[460px] lg:h-[460px] flex items-center justify-center shrink-0">
                <EmotionalSphere score={8.2} resourceLevel="high" />
              </div>

              {/* Overlaid AI Day Summary Card */}
              <div className="relative lg:absolute lg:-bottom-2 lg:right-0 w-full sm:w-[340px] backdrop-blur-2xl bg-[#0D1624]/90 border border-white/10 p-4 sm:p-5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-3 mt-2 lg:mt-0 z-20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#34F5AA]">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-semibold text-xs tracking-wide">ИИ-итог дня</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-[#34F5AA] animate-ping" />
                </div>
                <p className="text-xs text-white/80 leading-relaxed font-normal">
                  Организм в высоком ресурсе (8.2/10). Восстановление сна прошло успешно.
                </p>
                <button
                  onClick={isAuthenticated ? onGoToDashboard : onStartQuestionnaire}
                  className="w-full py-2.5 px-4 bg-[#34F5AA] hover:bg-[#2ce093] text-[#050A12] font-bold text-xs rounded-[16px] shadow-[0_4px_12px_rgba(52,245,170,0.2)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Открыть аналитику</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: «Почему это отличается» (Margin Top 40px on mobile, 100px desktop) */}
        <section id="why" className="mt-8 sm:mt-[100px] space-y-6 sm:space-y-[48px]">
          {/* H2 Title Center */}
          <div className="text-center space-y-3">
            <h2 className="text-[32px] sm:text-[48px] font-bold text-white tracking-tight">
              Почему это отличается
            </h2>
            <p className="text-[17px] text-white/70 max-w-xl mx-auto">
              Инновационный подход к анализу показателей здоровья с технологиями доказательной ИИ-медицины.
            </p>
          </div>

          {/* Cards 4 pieces: Width 306px, Min-Height 260px, Gap 24px, Radius 22px, Padding 28px */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px] lg:gap-[24px]">
            {whyDifferent.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#0D1624] border border-white/[0.05] rounded-[22px] p-[26px] sm:p-[28px] min-h-[260px] flex flex-col justify-between hover:bg-[#111F33] hover:-translate-y-[6px] transition-all duration-300 shadow-[0_12px_40px_rgba(0,0,0,0.22)] group cursor-pointer relative"
                >
                  <div>
                    {/* Icon 56px */}
                    <div className={`w-[56px] h-[56px] rounded-[18px] border flex items-center justify-center ${item.color} group-hover:scale-105 transition-transform shrink-0`}>
                      <Icon className="w-7 h-7" />
                    </div>

                    {/* Title Top 20px */}
                    <h3 className="mt-[20px] text-[19px] sm:text-[20px] font-bold text-white tracking-tight leading-snug">
                      {item.title}
                    </h3>

                    {/* Description Top 12px */}
                    <p className="mt-[10px] text-[14px] text-white/70 leading-[22px] font-normal pr-2">
                      {item.desc}
                    </p>
                  </div>

                  {/* Arrow Bottom Right */}
                  <div className="self-end mt-4 pt-2 text-white/40 group-hover:text-[#34F5AA] group-hover:translate-x-1 transition-all flex items-center shrink-0">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION: «Dashboard приложения» (Height 520px desktop, Radius 32px) */}
        <section id="dashboard" className="mt-8 sm:mt-[100px]">
          <div className="bg-gradient-to-br from-[#07131F] to-[#0A1E30] border border-white/[0.05] rounded-[32px] p-6 sm:p-10 lg:p-12 shadow-2xl overflow-hidden min-h-0 lg:min-h-[520px] flex flex-col justify-center">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left text: Width 340px */}
              <div className="lg:col-span-5 max-w-[340px] space-y-4">
                <span className="text-[13px] font-semibold text-[#34F5AA] bg-[#34F5AA]/10 border border-[#34F5AA]/20 px-3 py-1 rounded-full uppercase tracking-wider">
                  Интерфейс будущего
                </span>
                <h2 className="text-[28px] sm:text-[40px] font-bold text-white tracking-tight leading-[1.2]">
                  Все данные в одном экране
                </h2>
                <p className="text-[15px] sm:text-[17px] text-white/70 leading-[26px]">
                  Интерактивная карта 10 систем организма, динамика биомаркеров и персональные рекомендации ИИ обновляются в реальном времени.
                </p>
                <button
                  onClick={isAuthenticated ? onGoToDashboard : onStartQuestionnaire}
                  className="pt-2 flex items-center gap-2 text-[#34F5AA] font-bold text-sm hover:underline cursor-pointer"
                >
                  <span>Попробовать демо-интерфейс</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Right Mockup: 860px, Radius 30px, Padding 28px, Glass opacity 92% */}
              <div className="lg:col-span-7 bg-[#0D1624]/92 border border-white/10 rounded-[30px] p-5 sm:p-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                {/* Mockup Top Bar */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500/80" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <span className="w-3 h-3 rounded-full bg-green-500/80" />
                    <span className="ml-2 text-xs text-white/50 font-mono">dashboard.zdorovye.ai</span>
                  </div>
                  <span className="text-xs text-[#34F5AA] bg-[#34F5AA]/10 px-2.5 py-0.5 rounded-full font-medium">Live Sync</span>
                </div>

                {/* Mockup Content Layout */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-[#101C2B] p-4 rounded-[18px] border border-white/[0.04]">
                    <div className="text-xs text-white/60 mb-1">Состояние</div>
                    <div className="text-2xl font-black text-[#34F5AA]">92%</div>
                    <div className="text-[10px] text-white/50 mt-1">Отличный ресурс</div>
                  </div>
                  <div className="bg-[#101C2B] p-4 rounded-[18px] border border-white/[0.04]">
                    <div className="text-xs text-white/60 mb-1">Энергия</div>
                    <div className="text-2xl font-black text-[#4CEBFF]">78%</div>
                    <div className="text-[10px] text-white/50 mt-1">Выше нормы</div>
                  </div>
                  <div className="bg-[#101C2B] p-4 rounded-[18px] border border-white/[0.04] col-span-2 sm:col-span-1">
                    <div className="text-xs text-white/60 mb-1">Сон</div>
                    <div className="text-2xl font-black text-[#8870FF]">7ч 23м</div>
                    <div className="text-[10px] text-white/50 mt-1">Глубокая фаза</div>
                  </div>
                </div>

                {/* Mini Systems List */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-[12px] bg-[#101C2B] text-xs">
                    <span className="text-white/80">Сердечно-сосудистая система</span>
                    <span className="text-[#34F5AA] font-bold">94% · Норма</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-[12px] bg-[#101C2B] text-xs">
                    <span className="text-white/80">Нервная система и стресс</span>
                    <span className="text-[#4CEBFF] font-bold">88% · Стабильно</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: «Как это работает» (Process Timeline, Height 220px block) */}
        <section id="process" className="mt-8 sm:mt-[100px] space-y-6 sm:space-y-[48px]">
          <div className="text-center space-y-3">
            <h2 className="text-[32px] sm:text-[48px] font-bold text-white tracking-tight">
              Как это работает
            </h2>
            <p className="text-[17px] text-white/70 max-w-xl mx-auto">
              Простой 4-шаговый процесс от первички до глубокой ИИ-аналитики.
            </p>
          </div>

          <div className="relative pt-4">
            {/* Connecting Gradient Line: Green -> Blue -> Purple across step dots center */}
            <div className="hidden lg:block absolute top-[46px] left-[80px] right-[80px] h-[3px] bg-gradient-to-r from-[#34F5AA] via-[#4CEBFF] to-[#8870FF] z-0 opacity-80" />

            {/* Steps (Gap 24px between step cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px] lg:gap-[24px] relative z-10">
              {processSteps.map((step, idx) => (
                <div key={idx} className="bg-[#0D1624] border border-white/[0.05] rounded-[22px] p-6 lg:p-7 min-h-[210px] flex flex-col justify-between hover:bg-[#111F33] transition-all duration-300 shadow-[0_12px_40px_rgba(0,0,0,0.20)] group relative">
                  <div>
                    {/* Step Dot Diameter 44px */}
                    <div className={`w-[44px] h-[44px] rounded-full ${step.color} font-black text-base flex items-center justify-center mb-5 shrink-0`}>
                      {step.step}
                    </div>
                    <h3 className="text-[18px] font-bold text-white mb-2 tracking-tight">{step.title}</h3>
                    <p className="text-[14px] text-white/70 font-normal leading-[22px]">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION: «Возможности приложения» (8 cards: 270x140) */}
        <section id="features" className="mt-8 sm:mt-[100px] space-y-6 sm:space-y-[48px]">
          <div className="text-center space-y-3">
            <h2 className="text-[32px] sm:text-[48px] font-bold text-white tracking-tight">
              Возможности приложения
            </h2>
            <p className="text-[17px] text-white/70 max-w-xl mx-auto">
              Полный спектр инструментов для мониторинга, предотвращения рисков и заботы о себе.
            </p>
          </div>

          {/* Cards 8 pieces: 270x140px, Radius 20px, Padding 24px, Gap 24px (20px mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px] lg:gap-[24px]">
            {appFeatures.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#0D1624] border border-white/[0.05] rounded-[20px] p-[24px] h-auto sm:h-[140px] flex items-center gap-[24px] hover:bg-[#132235] transition-all cursor-pointer group"
                >
                  {/* Icon 44px */}
                  <div className={`w-[44px] h-[44px] rounded-[14px] ${feat.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-white mb-1">{feat.title}</h3>
                    <p className="text-[13px] text-white/70 font-normal leading-snug">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION: «Статистика» (Height 130px, Radius 26px, Gap 80px) */}
        <section className="mt-8 sm:mt-[100px]">
          <div className="bg-[#07131F] border border-white/[0.05] rounded-[26px] p-6 sm:p-8 min-h-0 lg:min-h-[130px] flex items-center justify-center">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[30px] lg:gap-[80px] w-full text-center">
              {statistics.map((stat, idx) => (
                <div key={idx} className="space-y-1">
                  {/* Digits 54px Bold */}
                  <div className={`text-[36px] sm:text-[54px] font-bold tracking-tight leading-none ${stat.color}`}>
                    {stat.value}
                  </div>
                  {/* Description 15px */}
                  <div className="text-[13px] sm:text-[15px] text-white/70 font-medium">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION: «Отзывы» (Card: Width 400px, Height 170px, Radius 20, Stars #FFC845) */}
        <section id="testimonials" className="mt-8 sm:mt-[100px] space-y-6 sm:space-y-[48px]">
          <div className="text-center space-y-3">
            <h2 className="text-[32px] sm:text-[48px] font-bold text-white tracking-tight">
              Отзывы пользователей
            </h2>
            <p className="text-[17px] text-white/70 max-w-xl mx-auto">
              Нам доверяют тысячи людей, отслеживающих здоровье с помощью ИИ.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] lg:gap-[24px]">
            {testimonials.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#0D1624] border border-white/[0.05] rounded-[20px] p-[24px] h-auto lg:h-[170px] flex flex-col justify-between hover:bg-[#132235] transition-all"
              >
                <div>
                  {/* Yellow Stars #FFC845 */}
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: item.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#FFC845] text-[#FFC845]" />
                    ))}
                  </div>
                  <p className="text-[13px] sm:text-[14px] text-white/80 font-normal leading-relaxed line-clamp-3">
                    "{item.text}"
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-[13px] font-bold text-white">{item.name}</span>
                  <span className="text-[11px] text-white/50">{item.role}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: «Финальный CTA» (Height 360px, Radius 34px, Gradient Left Green Glow, Right Purple Glow, Button 260x64) */}
        <section className="mt-8 sm:mt-[100px] mb-8 sm:mb-[80px]">
          <div className="relative rounded-[34px] p-8 sm:p-12 lg:p-16 min-h-[360px] flex flex-col items-center justify-center text-center overflow-hidden border border-white/10 bg-[#07131F] shadow-2xl">
            {/* Left Green Glow & Right Purple Glow */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-[#34F5AA]/15 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#8870FF]/15 rounded-full blur-[120px] pointer-events-none" />

            <div className="relative z-10 space-y-6 max-w-3xl">
              {/* Title 64px Center */}
              <h2 className="text-[32px] sm:text-[48px] lg:text-[64px] font-bold text-white tracking-tight leading-[1.1]">
                Начните контроль здоровья уже сегодня
              </h2>
              <p className="text-[15px] sm:text-[17px] text-white/70 max-w-xl mx-auto font-normal">
                Заполните анкету за 5 минут и получите расширенную ИИ-диагностику 10 систем организма прямо сейчас.
              </p>
              <div className="pt-2 flex justify-center">
                {/* Button 260x64, Radius 32 */}
                <button
                  onClick={onStartQuestionnaire}
                  className="w-[260px] h-[64px] rounded-[32px] bg-[#34F5AA] hover:bg-[#2ce093] text-[#050A12] font-bold text-[18px] shadow-[0_8px_20px_rgba(52,245,170,0.30)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Начать бесплатно</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
