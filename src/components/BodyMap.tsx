import React, { useState, useMemo, useEffect } from 'react';
import { BodySystem } from '../types';
import { Sparkles, ArrowUpRight, Heart, Brain, Shield, Flame, Bone, Zap } from 'lucide-react';

interface BodyMapProps {
  systems: BodySystem[];
  onSelectSystem: (system: BodySystem) => void;
  onOpenOverviewModal: () => void;
}

export const BodyMap: React.FC<BodyMapProps> = ({
  systems,
  onSelectSystem,
  onOpenOverviewModal,
}) => {
  // Default to cardio system
  const [activeSystemId, setActiveSystemId] = useState<string>('cardio');

  useEffect(() => {
    onOpenOverviewModal();
  }, []);

  // Map 6 core systems explicitly with accurate medical labels and status colors
  const coreSystemIds = ['cardio', 'neuro', 'immune', 'gastro', 'endocrine', 'locomotor'];

  const processedSystems = useMemo(() => {
    return coreSystemIds.map((id) => {
      const found = systems.find((s) => s.id === id);

      let name = 'Сердечно-сосудистая';
      let shortTitle = 'Сердечно-сосудистая';
      let icon = Heart;
      let accent = '#FF6685';
      let defaultScore = 88;
      let tone: 'norm' | 'warning' | 'critical' = 'norm';

      switch (id) {
        case 'cardio':
          name = 'Сердечно-сосудистая система';
          shortTitle = 'Сердечно-сосудистая';
          icon = Heart;
          accent = '#FF6685';
          defaultScore = found?.score || 88;
          break;

        case 'neuro':
          name = 'Нервная система';
          shortTitle = 'Нервная система';
          icon = Brain;
          accent = '#B45CFF';
          defaultScore = found?.score || 92;
          break;

        case 'immune':
          name = 'Иммунная система';
          shortTitle = 'Иммунная система';
          icon = Shield;
          accent = '#47D8FF';
          defaultScore = found?.score || 84;
          break;

        case 'gastro':
          name = 'Пищеварительная система';
          shortTitle = 'Пищеварительная';
          icon = Flame;
          accent = '#FFB957';
          defaultScore = found?.score || 76;
          tone = 'warning';
          break;

        case 'endocrine':
          name = 'Эндокринная система';
          shortTitle = 'Эндокринная';
          icon = Zap;
          accent = '#FF8A65';
          defaultScore = found?.score || 89;
          break;

        case 'locomotor':
          name = 'Опорно-двигательная';
          shortTitle = 'Опорно-двигательная';
          icon = Bone;
          accent = '#65F4C0';
          defaultScore = found?.score || 90;
          break;

        default:
          break;
      }

      const score = found?.score ?? defaultScore;
      const statusText = found?.statusText || (score >= 80 ? 'В норме' : score >= 65 ? 'Наблюдение' : 'Риск');
      const currentTone = found?.status === 'critical' ? 'critical' : found?.status === 'warning' ? 'warning' : tone;

      return {
        id,
        name: found?.name || name,
        shortTitle,
        score,
        statusText,
        tone: currentTone,
        accent,
        icon,
        description: found?.description || `Анализ состояния системы. Индекс активности: ${score}/100.`,
        detailedAnalysis: found?.detailedAnalysis || 'Показатели системы стабильны, серьезных отклонений по последним анализам не выявлено.',
        deviationsCount: found?.deviationsCount || 0,
        attentionLevel: found?.attentionLevel || 'Низкий',
        rawSystem: found,
      };
    });
  }, [systems]);

  const activeSystem = useMemo(() => {
    return processedSystems.find((sys) => sys.id === activeSystemId) || processedSystems[0];
  }, [processedSystems, activeSystemId]);

  return (
    <div className="w-full max-w-[1240px] mx-auto space-y-5 sm:space-y-6 pb-32 pt-2 px-3 sm:px-6 select-none font-sans">
      {/* MOBILE-FIRST COMPACT HEADER */}
      <div className="p-5 sm:p-7 rounded-[28px] bg-[#0F142A]/80 border border-[#99AEFF]/15 shadow-2xl backdrop-blur-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8968FF]/15 border border-[#8968FF]/30 text-[#C7B9FF] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#47D8FF]" />
            <span>ИИ-монитор систем «Аида»</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
            Организм и системы
          </h1>
          <p className="text-xs text-gray-400 max-w-lg">
            Персональная оценка статуса и динамика здоровья 6 ключевых систем
          </p>
        </div>

        <button
          onClick={onOpenOverviewModal}
          type="button"
          className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-[#8968FF] to-[#47D8FF] hover:brightness-110 text-[#050711] font-extrabold text-xs shadow-lg shadow-[#8968FF]/25 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 z-10"
        >
          <Sparkles className="w-4 h-4" />
          <span>Разбор систем организма</span>
        </button>
      </div>

      {/* ACTIVE SYSTEM OVERVIEW BANNER */}
      <div className="bg-[#0F142A]/80 border border-[#99AEFF]/20 rounded-[28px] p-5 sm:p-6 shadow-2xl backdrop-blur-2xl flex flex-col sm:flex-row items-center gap-5">
        {/* Score Circle Ring */}
        <div className="relative shrink-0 w-24 h-24 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" className="fill-none stroke-white/10 stroke-[7]" />
            <circle
              cx="50"
              cy="50"
              r="40"
              className="fill-none stroke-[7] stroke-round transition-all duration-700"
              stroke={activeSystem.accent}
              strokeDasharray={2 * Math.PI * 40}
              strokeDashoffset={2 * Math.PI * 40 * (1 - activeSystem.score / 100)}
              style={{ filter: `drop-shadow(0 0 6px ${activeSystem.accent})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <strong className="text-2xl font-black text-white">{activeSystem.score}</strong>
            <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">из 100</span>
          </div>
        </div>

        {/* Text description */}
        <div className="flex-1 space-y-1.5 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h2 className="text-lg font-extrabold text-white">{activeSystem.name}</h2>
            <span
              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
              style={{
                backgroundColor: `${activeSystem.accent}15`,
                borderColor: `${activeSystem.accent}40`,
                color: activeSystem.accent,
              }}
            >
              {activeSystem.statusText}
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed font-medium">
            {activeSystem.detailedAnalysis}
          </p>
        </div>
      </div>

      {/* GRID OF 6 SYSTEM CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {processedSystems.map((sys) => {
          const IconComp = sys.icon;
          const isActive = sys.id === activeSystemId;

          return (
            <button
              key={sys.id}
              onClick={() => setActiveSystemId(sys.id)}
              type="button"
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 relative overflow-hidden ${
                isActive
                  ? 'bg-[#151C3B]/90 border-[#977EFF]/50 shadow-[0_0_24px_rgba(151,126,255,0.2)] -translate-y-0.5'
                  : 'bg-[#0F142A]/60 border-[#99AEFF]/12 hover:border-[#99AEFF]/30 hover:bg-[#121834]/80'
              }`}
            >
              {/* Left Icon Badge */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: `${sys.accent}15`,
                  borderColor: `${sys.accent}35`,
                  color: sys.accent,
                }}
              >
                <IconComp className="w-5 h-5" />
              </div>

              {/* Card Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <strong className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {sys.shortTitle}
                  </strong>
                  <span className="text-xs font-black text-white shrink-0">{sys.score}%</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>{sys.statusText}</span>
                </div>

                {/* Thin Progress Bar */}
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${sys.score}%`,
                      backgroundColor: sys.accent,
                      boxShadow: `0 0 8px ${sys.accent}`,
                    }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* SELECTED SYSTEM METRICS DETAILED CARD */}
      <section className="bg-[#0F142A]/80 border border-[#99AEFF]/15 rounded-[28px] p-5 sm:p-6 shadow-2xl backdrop-blur-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9A93FF]">
              Медицинские показатели
            </span>
            <h3 className="text-base font-extrabold text-white">{activeSystem.name}</h3>
          </div>

          {activeSystem.rawSystem && (
            <button
              onClick={() => onSelectSystem(activeSystem.rawSystem!)}
              className="px-4 py-2 bg-[#8968FF]/15 hover:bg-[#8968FF]/25 border border-[#8968FF]/30 text-[#C7B9FF] font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              type="button"
            >
              <span>Полный отчёт системы</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.08] p-3.5 rounded-2xl space-y-1">
            <span className="text-xs text-gray-400 font-medium">Индекс состояния</span>
            <strong className="text-lg font-extrabold text-white block">{activeSystem.score} из 100</strong>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.08] p-3.5 rounded-2xl space-y-1">
            <span className="text-xs text-gray-400 font-medium">Уровень внимания</span>
            <strong className="text-lg font-extrabold text-white block">{activeSystem.attentionLevel}</strong>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.08] p-3.5 rounded-2xl space-y-1">
            <span className="text-xs text-gray-400 font-medium">Выявленные отклонения</span>
            <strong className="text-lg font-extrabold text-white block">
              {activeSystem.deviationsCount > 0 ? `${activeSystem.deviationsCount} показат.` : 'В норме'}
            </strong>
          </div>
        </div>
      </section>

      {/* AIDA INSIGHT RECOMMENDATION BANNER */}
      <section className="p-5 rounded-[28px] bg-gradient-to-r from-[#1A183A]/90 to-[#0A0F22]/90 border border-[#815FFF]/35 shadow-[0_0_32px_rgba(119,87,255,0.18)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#815FFF]/20 border border-[#AE91FF]/40 flex items-center justify-center shrink-0 text-[#D0C4FF]">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#9F8DFF] block">
              Вывод ИИ Аиды ({activeSystem.shortTitle})
            </span>
            <p className="text-xs sm:text-sm font-semibold text-gray-100 leading-relaxed">
              {activeSystem.statusText === 'В норме'
                ? `Показатели системы «${activeSystem.shortTitle}» стабильны. Рекомендуется плановый контроль 1 раз в год.`
                : `Система «${activeSystem.shortTitle}» требует внимания. Зафиксированы небольшие колебания показателей.`}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenOverviewModal}
          type="button"
          className="px-4 py-2.5 rounded-2xl bg-[#8968FF]/20 hover:bg-[#8968FF]/35 border border-[#8968FF]/40 text-[#C7B9FF] text-xs font-extrabold transition-all cursor-pointer shrink-0 self-stretch sm:self-auto text-center"
        >
          Рекомендации
        </button>
      </section>

      <p className="text-center text-[11px] text-gray-500 pt-1">
        Информация носит справочный характер и не является медицинским диагнозом.
      </p>
    </div>
  );
};
