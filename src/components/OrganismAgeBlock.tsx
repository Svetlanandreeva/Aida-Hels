import React, { useState } from 'react';
import {
  OrganismAgeResult,
  OrganismSystemAge,
  formatYearsDiffRussian,
  formatYearsRussian,
} from '../utils/calculateOrganismAge';
import {
  Heart,
  Zap,
  Apple,
  Droplets,
  Shield,
  Brain,
  Info,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Flame,
  Moon,
  Pill,
  Scale,
  FileText,
  Lightbulb,
} from 'lucide-react';

interface OrganismAgeBlockProps {
  data: OrganismAgeResult;
  onOpenAddMetrics?: () => void;
}

export const OrganismAgeBlock: React.FC<OrganismAgeBlockProps> = ({
  data,
  onOpenAddMetrics,
}) => {
  const [isHowCalculatedModalOpen, setIsHowCalculatedModalOpen] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<OrganismSystemAge | null>(null);

  const getSystemIcon = (iconName: string) => {
    switch (iconName) {
      case 'heart':
        return <Heart className="w-4 h-4 text-[#4DEBFF]" />;
      case 'zap':
        return <Zap className="w-4 h-4 text-[#8968FF]" />;
      case 'apple':
        return <Apple className="w-4 h-4 text-[#34F5A4]" />;
      case 'droplets':
        return <Droplets className="w-4 h-4 text-blue-400" />;
      case 'shield':
        return <Shield className="w-4 h-4 text-emerald-400" />;
      case 'brain':
        return <Brain className="w-4 h-4 text-purple-400" />;
      default:
        return <Activity className="w-4 h-4 text-[#8968FF]" />;
    }
  };

  const getFactorIcon = (category: string) => {
    switch (category) {
      case 'inflammation':
        return <Flame className="w-4 h-4 text-rose-400" />;
      case 'sleep':
        return <Moon className="w-4 h-4 text-[#8968FF]" />;
      case 'deficits':
        return <Pill className="w-4 h-4 text-amber-400" />;
      case 'pressure':
        return <Activity className="w-4 h-4 text-[#4DEBFF]" />;
      case 'activity':
        return <Sparkles className="w-4 h-4 text-[#34F5A4]" />;
      case 'metabolism':
        return <Scale className="w-4 h-4 text-cyan-300" />;
      default:
        return <Activity className="w-4 h-4 text-purple-300" />;
    }
  };

  const isOlder = data.differenceYears > 0;
  const isYounger = data.differenceYears < 0;

  return (
    <div className="space-y-6">
      {/* Insufficient Data Warning Banner (If applicable) */}
      {!data.hasSufficientData && (
        <div className="bg-[#181124] border border-purple-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Недостаточно данных для точной оценки</h4>
              <p className="text-xs text-purple-200/70">
                Добавьте ещё {data.missingMetricsCount} показателя для более достоверного расчёта.
              </p>
            </div>
          </div>
          {onOpenAddMetrics && (
            <button
              onClick={onOpenAddMetrics}
              className="px-4 py-2 bg-[#8968FF] hover:bg-[#7854f7] text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer shrink-0"
            >
              Загрузить анализы
            </button>
          )}
        </div>
      )}

      {/* MAIN CARD: COMPARISON INDICATORS (CIRCLES) */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden space-y-6">
        {/* Subtle Ambient Background Lighting */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#8968FF]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-[#4DEBFF]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Label */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#8968FF]/15 border border-[#8968FF]/30 text-[#8968FF]">
                <Sparkles className="w-3 h-3" />
                Расчётный возраст организма
              </span>
              <span className="text-xs text-white/40 font-medium">
                Точность: <strong className="text-gray-200 font-semibold">{data.confidenceLevel}</strong>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1.5">
              Сравнение возраста организма и паспорта
            </h2>
          </div>

          <button
            onClick={() => setIsHowCalculatedModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#4DEBFF]" />
            <span>Как рассчитано?</span>
          </button>
        </div>

        {/* COMPARISON CIRCLES CONTAINER (SIDE-BY-SIDE CIRCULAR GAUGES) */}
        <div className="bg-[#070C15]/90 border border-white/[0.06] rounded-2xl p-5 sm:p-7 shadow-inner space-y-6">
          <div className="flex items-center justify-center gap-6 sm:gap-12 py-4">
            {/* LEFT CIRCLE: Ваш (Паспортный) */}
            <div className="flex flex-col items-center space-y-3">
              <div className="text-center space-y-0.5">
                <span className="text-xs uppercase tracking-wider font-extrabold text-gray-300 block">
                  Ваш
                </span>
                <span className="text-[11px] text-gray-400 font-medium block">
                  (Паспортный)
                </span>
              </div>

              {/* Circle Container */}
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-b from-slate-800/90 via-slate-900 to-[#0B1320] border-2 border-slate-600/40 p-2 flex flex-col items-center justify-center relative shadow-lg group hover:border-slate-500/60 transition-all">
                {/* SVG Decorative Ring */}
                <svg className="absolute inset-0 w-full h-full p-1" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.4)"
                    strokeWidth="3"
                    strokeDasharray="200"
                    strokeDashoffset="60"
                    strokeLinecap="round"
                  />
                </svg>

                <div className="z-10 text-center">
                  <span className="text-2xl sm:text-4xl font-black text-white tracking-tight block">
                    {data.passportAge}
                  </span>
                  <span className="text-[11px] sm:text-xs text-gray-400 font-semibold uppercase tracking-wider block">
                    {formatYearsRussian(data.passportAge).replace(/^[0-9]+\s*/, '')}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT CIRCLE: Генетический (Организм) */}
            <div className="flex flex-col items-center space-y-3 relative">
              {/* Badge above */}
              <span className="absolute -top-3 z-20 px-2.5 py-0.5 bg-[#8968FF] text-white text-[9px] sm:text-[10px] font-black tracking-wider uppercase rounded-full shadow-[0_0_14px_rgba(137,104,255,0.7)]">
                Главный
              </span>

              <div className="text-center space-y-0.5 pt-1">
                <span className="text-xs uppercase tracking-wider font-black text-[#8968FF] block">
                  Генетический
                </span>
                <span className="text-[11px] text-[#4DEBFF] font-medium block">
                  (Биологический)
                </span>
              </div>

              {/* Glowing Circle Container */}
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-b from-[#8968FF]/25 via-[#6551E8]/20 to-[#0A101D] border-2 border-[#8968FF] p-2 flex flex-col items-center justify-center relative shadow-[0_0_35px_rgba(137,104,255,0.45)] group transition-all hover:scale-105">
                {/* Outer Ambient Glow Ring */}
                <div className="absolute inset-0 rounded-full border border-purple-400/30 animate-pulse pointer-events-none" />

                {/* SVG Progress Ring */}
                <svg className="absolute inset-0 w-full h-full p-1" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="rgba(137, 104, 255, 0.15)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="url(#purpleCyanGradient)"
                    strokeWidth="4"
                    strokeDasharray="276"
                    strokeDashoffset="35"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="purpleCyanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8968FF" />
                      <stop offset="50%" stopColor="#6551E8" />
                      <stop offset="100%" stopColor="#34F5A4" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="z-10 text-center">
                  <span className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-[0_2px_12px_rgba(137,104,255,0.6)] block">
                    {data.organismAge}
                  </span>
                  <span className="text-xs sm:text-sm text-cyan-300 font-extrabold uppercase tracking-wider block">
                    {formatYearsRussian(data.organismAge).replace(/^[0-9]+\s*/, '')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* DIFFERENCE DISPLAY & TEXT */}
          <div className="text-center pt-3 border-t border-white/[0.06] space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 shadow-md">
              <span
                className={`text-base sm:text-lg font-black tracking-tight ${
                  isOlder
                    ? 'text-amber-300'
                    : isYounger
                    ? 'text-[#34F5A4]'
                    : 'text-purple-300'
                }`}
              >
                {data.differenceYears > 0 ? `+${data.differenceYears}` : data.differenceYears < 0 ? `−${Math.abs(data.differenceYears)}` : '0'}{' '}
                {formatYearsRussian(Math.abs(data.differenceYears)).replace(/^[0-9]+\s*/, '')}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-gray-200 max-w-lg mx-auto">
              {data.differenceText}
            </p>

            <div className="pt-1 flex items-center justify-center gap-3 text-[11px] text-gray-400">
              <span>Расчёт основан на <strong>{data.evaluatedMetricsCount}</strong> показателях</span>
              <span>•</span>
              <button
                onClick={() => setIsHowCalculatedModalOpen(true)}
                className="text-[#4DEBFF] hover:underline font-medium cursor-pointer"
              >
                Как рассчитано?
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: ORGANISM SYSTEMS AGE (PLACED DIRECTLY BELOW AGE CIRCLES!) */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Возраст систем организма
            </h3>
            <p className="text-xs text-gray-400">
              Нажмите на систему или иконку, чтобы посмотреть подробное пояснение по анализам и рекомендации
            </p>
          </div>
        </div>

        {/* COMPACT INTERACTIVE CARDS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {data.systemAges.map((sys) => {
            const isPlus = sys.diffYears > 0;
            const isMinus = sys.diffYears < 0;
            const diffTag = isPlus
              ? `+${sys.diffYears} ${formatYearsRussian(sys.diffYears).replace(/^[0-9]+\s*/, '')}`
              : isMinus
              ? `−${Math.abs(sys.diffYears)} ${formatYearsRussian(Math.abs(sys.diffYears)).replace(/^[0-9]+\s*/, '')}`
              : '0';

            return (
              <button
                key={sys.id}
                onClick={() => setSelectedSystem(sys)}
                className="text-left bg-[#0E1726] border border-white/[0.06] hover:border-[#8968FF]/50 rounded-xl p-3.5 space-y-2 transition-all hover:bg-[#121E32] hover:scale-[1.02] shadow-md flex flex-col justify-between group cursor-pointer relative overflow-hidden"
              >
                {/* Top Subtle Hover Accent */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#8968FF]/0 group-hover:via-[#8968FF] to-transparent transition-all" />

                <div className="flex items-center justify-between gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 group-hover:border-[#8968FF]/30 group-hover:bg-[#8968FF]/10 flex items-center justify-center shrink-0 transition-all">
                    {getSystemIcon(sys.iconName)}
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                      isMinus
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-[#34F5A4]'
                        : isPlus
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        : 'bg-slate-500/15 border-slate-500/30 text-slate-300'
                    }`}
                  >
                    {diffTag}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-200 group-hover:text-white transition-colors truncate">
                      {sys.name}
                    </h4>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#4DEBFF] transition-colors shrink-0" />
                  </div>
                  <div className="text-base font-black text-white mt-0.5">
                    {sys.age} {formatYearsRussian(sys.age).replace(/^[0-9]+\s*/, '')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION: WHAT AFFECTS ORGANISM AGE (FACTORS) */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Что влияет на возраст организма
            </h3>
            <p className="text-xs text-gray-400">
              Вклад ключевых показателей здоровья и факторов образа жизни в итоговую оценку
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {data.factors.map((factor) => {
            const isPlus = factor.impactYears > 0;
            const formattedVal = isPlus
              ? `+${factor.impactYears.toFixed(1)} ${formatYearsRussian(factor.impactYears).replace(/^[0-9.]+\s*/, '')}`
              : `−${Math.abs(factor.impactYears).toFixed(1)} ${formatYearsRussian(Math.abs(factor.impactYears)).replace(/^[0-9.]+\s*/, '')}`;

            return (
              <div
                key={factor.id}
                className="bg-[#0E1726] border border-white/[0.06] rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-white/15 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    {getFactorIcon(factor.category)}
                  </div>
                  <span className="text-xs font-semibold text-gray-200 truncate">
                    {factor.name}
                  </span>
                </div>

                <div
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shrink-0 border ${
                    isPlus
                      ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/25 text-[#34F5A4]'
                  }`}
                >
                  {formattedVal}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-gray-400/80 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
          💡 <strong>Обратите внимание:</strong> Положительное значение означает фактор, увеличивающий расчётный возраст. Отрицательное — фактор, уменьшающий его.
        </p>
      </div>

      {/* SYSTEM DETAIL MODAL (ПОЯСНЕНИЕ ПО АНАЛИЗАМ И РЕКОМЕНДАЦИИ) */}
      {selectedSystem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0D1524] border border-white/15 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setSelectedSystem(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-start gap-3.5 border-b border-white/10 pb-4 pr-8">
              <div className="w-12 h-12 rounded-2xl bg-[#8968FF]/15 border border-[#8968FF]/30 flex items-center justify-center shrink-0">
                {getSystemIcon(selectedSystem.iconName)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {selectedSystem.name}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold border ${
                      selectedSystem.diffYears < 0
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-[#34F5A4]'
                        : selectedSystem.diffYears > 0
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        : 'bg-slate-500/15 border-slate-500/30 text-slate-300'
                    }`}
                  >
                    {selectedSystem.diffYears > 0
                      ? `+${selectedSystem.diffYears} ${formatYearsRussian(selectedSystem.diffYears).replace(/^[0-9]+\s*/, '')}`
                      : selectedSystem.diffYears < 0
                      ? `−${Math.abs(selectedSystem.diffYears)} ${formatYearsRussian(Math.abs(selectedSystem.diffYears)).replace(/^[0-9]+\s*/, '')}`
                      : 'Норма'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Расчётный возраст системы: <strong className="text-white font-bold">{selectedSystem.age} {formatYearsRussian(selectedSystem.age).replace(/^[0-9]+\s*/, '')}</strong>
                </p>
              </div>
            </div>

            {/* 1. ПОЯСНЕНИЕ НА ОСНОВЕ АНАЛИЗОВ */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#4DEBFF]">
                <FileText className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Пояснение на основе анализов
                </h4>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed">
                {selectedSystem.explanation}
              </p>
            </div>

            {/* 2. КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ И МАРКЁРЫ */}
            {selectedSystem.markers && selectedSystem.markers.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#8968FF]" />
                  Ключевые показатели и анализы
                </h4>

                <div className="space-y-2">
                  {selectedSystem.markers.map((marker, idx) => {
                    const isNorm = marker.status === 'norm';
                    const isAttention = marker.status === 'attention';
                    const isWarning = marker.status === 'warning';

                    return (
                      <div
                        key={idx}
                        className="bg-[#0E1726] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-gray-200 block truncate">
                            {marker.name}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            Норма: {marker.norm}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-white block">
                            {marker.value}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              isNorm
                                ? 'text-[#34F5A4]'
                                : isAttention
                                ? 'text-amber-300'
                                : 'text-rose-400'
                            }`}
                          >
                            {isNorm ? 'В норме' : isAttention ? 'Внимание' : 'Отклонение'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. РЕКОМЕНДАЦИИ: ЧТО ДЕЛАТЬ */}
            {selectedSystem.recommendations && selectedSystem.recommendations.length > 0 && (
              <div className="bg-[#8968FF]/10 border border-[#8968FF]/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-[#8968FF]">
                  <Lightbulb className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                    Рекомендации: что делать с этим
                  </h4>
                </div>

                <ul className="space-y-2 text-xs text-purple-100">
                  {selectedSystem.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#8968FF]/20 text-[#8968FF] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              {onOpenAddMetrics ? (
                <button
                  onClick={() => {
                    setSelectedSystem(null);
                    onOpenAddMetrics();
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  Загрузить свежие анализы
                </button>
              ) : <div />}

              <button
                onClick={() => setSelectedSystem(null)}
                className="px-5 py-2.5 bg-[#8968FF] hover:bg-[#7854f7] text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer ml-auto"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: METHODOLOGY EXPLANATION ("КАК РАССЧИТАНО?") */}
      {isHowCalculatedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0D1524] border border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsHowCalculatedModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#8968FF]/20 text-[#8968FF] flex items-center justify-center">
                  <Info className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#8968FF] uppercase tracking-wider">
                  Методология расчёта
                </span>
              </div>
              <h3 className="text-xl font-bold text-white">Как рассчитывается возраст организма?</h3>
            </div>

            <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
              <p>
                Оценка возраста организма рассчитывается на основе агрегированной математической модели, анализирующей ваши лабораторые анализы, физиологические параметры и объективные маркёры здоровья.
              </p>

              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#34F5A4]" />
                  Приоритет объективных данных (85%)
                </h4>
                <p className="text-gray-300">
                  Лабораторные показатели (липидный профиль, биохимия, маркёры воспаления, гематология), АД, пульс и ИМТ имеют ключевой вес в расчёте.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#4DEBFF]" />
                  Вес симптомов (15%)
                </h4>
                <p className="text-gray-300">
                  Субъективные симптомы и самочувствие из дневника имеют второстепенное значение и не могут сами по себе существенно сместить итоговый возраст.
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <h4 className="font-bold text-white">Уровень точности расчёта</h4>
                <p className="text-gray-400">
                  Текущая точность: <strong className="text-white">{data.confidenceLevel}</strong> ({data.evaluatedMetricsCount} показателя(-ей) задействовано).
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setIsHowCalculatedModalOpen(false)}
                className="px-5 py-2.5 bg-[#8968FF] hover:bg-[#7854f7] text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
