import React, { useEffect } from 'react';
import { BodySystem } from '../types';
import {
  Activity,
  Heart,
  Brain,
  ShieldAlert,
  Wind,
  Droplet,
  Sparkles,
  Users,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Sparkle,
} from 'lucide-react';

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
  // Auto-open overview modal on first mount of Screen 11
  useEffect(() => {
    onOpenOverviewModal();
  }, []);

  // Map icon names to Lucide icon components
  const getSystemIcon = (name: string) => {
    switch (name) {
      case 'Heart':
        return <Heart className="w-6 h-6 text-rose-500" />;
      case 'Brain':
        return <Brain className="w-6 h-6 text-purple-500" />;
      case 'Stomach':
        return <Activity className="w-6 h-6 text-amber-500" />;
      case 'Activity':
        return <Activity className="w-6 h-6 text-teal-500" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-6 h-6 text-blue-500" />;
      case 'Bone':
        return <Activity className="w-6 h-6 text-slate-600" />;
      case 'Wind':
        return <Wind className="w-6 h-6 text-cyan-500" />;
      case 'Droplet':
        return <Droplet className="w-6 h-6 text-blue-400" />;
      case 'Sparkles':
        return <Sparkles className="w-6 h-6 text-pink-500" />;
      case 'Users':
        return <Users className="w-6 h-6 text-rose-400" />;
      default:
        return <Activity className="w-6 h-6 text-emerald-500" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32 sm:pb-36">
      {/* Header & Main Auto-Analyze Trigger */}
      <div className="bg-[#0F1115] border border-gray-800 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold backdrop-blur-md border border-emerald-500/30">
            <Activity className="w-4 h-4" />
            <span>Анатомический ИИ-Мониторинг</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-100">
            Карта 10 систем организма
          </h1>
          <p className="text-xs text-gray-400">
            Комплексная диагностика функций организма. Нажмите на любую систему для открытия подробных рекомендаций и направлений на анализы.
          </p>
        </div>

        <button
          onClick={onOpenOverviewModal}
          className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>Разбор карты тела</span>
        </button>
      </div>

      {/* Systems Grid (10 Systems) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {systems.map((sys) => (
          <div
            key={sys.id}
            onClick={() => onSelectSystem(sys)}
            className="bg-[#14171C] p-5 rounded-2xl border border-gray-800 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#0F1115] border border-gray-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                {getSystemIcon(sys.iconName)}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-100 text-sm">{sys.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      sys.status === 'norm'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                    }`}
                  >
                    {sys.score}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 line-clamp-1">{sys.description}</p>
                <div className="flex items-center gap-2 text-[11px] pt-0.5">
                  <span className="text-gray-500">Статус:</span>
                  <span
                    className={`font-semibold ${
                      sys.status === 'norm' ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {sys.statusText}
                  </span>
                </div>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:translate-x-1 transition-transform shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};
