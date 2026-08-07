import React, { useState } from 'react';
import {
  BodySystem,
  UserProfile,
  StructuredHealthAnalysis,
  MedicalDocument,
  DailyLogEntry,
  DiaryEntry,
  ScreenId,
} from '../types';
import { AiMetricsTopSection } from './dashboard/AiMetricsTopSection';
import {
  Activity,
  Heart,
  Brain,
  Wind,
  Apple,
  Zap,
  Shield,
  Droplets,
  Bone,
  Eye,
  Info,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

interface BodyMapProps {
  systems: BodySystem[];
  onSelectSystem: (system: BodySystem) => void;
  onOpenOverviewModal?: () => void;
  user?: UserProfile;
  aiAnalysis?: StructuredHealthAnalysis | null;
  documents?: MedicalDocument[];
  dailyLogs?: DailyLogEntry[];
  diaryEntries?: DiaryEntry[];
  onNavigate?: (screen: ScreenId) => void;
  displayHealthScore?: number | null;
}

export const BodyMap: React.FC<BodyMapProps> = ({
  systems,
  onSelectSystem,
  onOpenOverviewModal,
  user,
  aiAnalysis,
  documents = [],
  dailyLogs = [],
  diaryEntries = [],
  onNavigate,
  displayHealthScore,
}) => {
  const [filter, setFilter] = useState<'all' | 'attention' | 'norm'>('all');

  const getSystemIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'heart':
      case 'cardio':
        return <Heart className="w-5 h-5 text-red-400" />;
      case 'brain':
      case 'nervous':
        return <Brain className="w-5 h-5 text-[#8E74FF]" />;
      case 'lungs':
      case 'wind':
      case 'respiratory':
        return <Wind className="w-5 h-5 text-cyan-400" />;
      case 'digestive':
      case 'apple':
        return <Apple className="w-5 h-5 text-amber-400" />;
      case 'endocrine':
      case 'zap':
        return <Zap className="w-5 h-5 text-yellow-400" />;
      case 'immune':
      case 'shield':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case 'urinary':
      case 'droplets':
        return <Droplets className="w-5 h-5 text-blue-400" />;
      case 'bone':
      case 'musculoskeletal':
        return <Bone className="w-5 h-5 text-indigo-400" />;
      default:
        return <Activity className="w-5 h-5 text-[#8E74FF]" />;
    }
  };

  const filteredSystems = systems.filter((sys) => {
    if (filter === 'attention') return sys.status !== 'norm';
    if (filter === 'norm') return sys.status === 'norm';
    return true;
  });

  const normCount = systems.filter((s) => s.status === 'norm').length;
  const attentionCount = systems.filter((s) => s.status !== 'norm').length;

  return (
    <div className="w-full max-w-[1000px] mx-auto space-y-5 px-2 sm:px-0">
      {/* AI STATUS TOP BAR & 4 METRIC CARDS GRID (ШКАЛЫ ОРГАНИЗМА) */}
      <AiMetricsTopSection
        user={user}
        aiAnalysis={aiAnalysis}
        documents={documents}
        dailyLogs={dailyLogs}
        diaryEntries={diaryEntries}
        onNavigate={onNavigate}
        displayHealthScore={displayHealthScore}
      />

      {/* Header Banner */}
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#8E74FF]/10 border border-[#8E74FF]/30 text-[#8E74FF] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#8E74FF] uppercase tracking-wider">
              Карта систем организма
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Интерактивный баланс 10 систем
          </h1>
          <p className="text-xs text-white/60 max-w-xl">
            Наглядный обзор органов и функциональных систем по результатам лабораторных анализов и зафиксированным симптомам.
          </p>
        </div>

        {onOpenOverviewModal && (
          <button
            onClick={onOpenOverviewModal}
            className="z-10 px-4 py-2.5 bg-[#8E74FF]/10 hover:bg-[#8E74FF]/20 border border-[#8E74FF]/30 rounded-xl text-xs font-bold text-[#8E74FF] hover:text-white transition-all cursor-pointer flex items-center gap-2 shrink-0"
          >
            <Info className="w-4 h-4" />
            <span>Методология расчёта</span>
          </button>
        )}
      </div>

      {/* Filter Tabs & Quick Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0F172A]/80 border border-white/[0.06] p-2.5 rounded-2xl">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-[#8E74FF] text-white shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Все системы ({systems.length})
          </button>
          <button
            onClick={() => setFilter('attention')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'attention'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-white/60 hover:text-amber-300 hover:bg-white/5'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Требуют внимания ({attentionCount})</span>
          </button>
          <button
            onClick={() => setFilter('norm')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'norm'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-white/60 hover:text-emerald-300 hover:bg-white/5'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>В норме ({normCount})</span>
          </button>
        </div>

        <div className="text-[11px] text-white/40 font-medium px-2 hidden sm:block">
          Нажмите на карточку системы для детальной расшифровки
        </div>
      </div>

      {/* Systems Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3.5">
        {filteredSystems.map((sys) => {
          const isNorm = sys.status === 'norm';
          return (
            <div
              key={sys.id}
              onClick={() => onSelectSystem(sys)}
              className="bg-[#0B1320] hover:bg-[#0E182A] border border-white/[0.08] hover:border-[#8E74FF]/40 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer shadow-lg space-y-3 group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {getSystemIcon(sys.iconName)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-sm group-hover:text-[#8E74FF] transition-colors">
                        {sys.name}
                      </h3>
                      <p className="text-[11px] text-white/50">{sys.description}</p>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                </div>

                {/* Score bar & Status */}
                <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50 font-medium">Статус физиологии</span>
                    <span
                      className={`font-bold px-2.5 py-0.5 rounded-md text-[11px] ${
                        isNorm
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {sys.statusText} • {sys.score}%
                    </span>
                  </div>

                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isNorm ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.max(10, Math.min(100, sys.score))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom detail pill */}
              <div className="text-[11px] text-white/60 bg-[#101A28] p-2.5 rounded-xl border border-white/[0.04] flex items-center justify-between">
                <span>
                  {sys.deviationsCount > 0
                    ? `Зафиксировано ${sys.deviationsCount} маркёров для наблюдения`
                    : 'Отклонений в анализах не выявлено'}
                </span>
                <span className="text-[#8E74FF] font-bold shrink-0 ml-2">Подробнее &rarr;</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
