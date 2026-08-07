import React, { useState } from 'react';
import { HealthAttentionItem } from '../../types';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  ShieldCheck,
  Info,
  HelpCircle,
  FileText,
  Clock,
  Sparkles,
  Phone,
} from 'lucide-react';

interface AttentionItemCardProps {
  item: HealthAttentionItem;
}

export const AttentionItemCard: React.FC<AttentionItemCardProps> = ({ item }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'meaning' | 'causes' | 'actions' | 'doctor' | 'sources'>('meaning');

  const getSeverityBadge = () => {
    switch (item.severity) {
      case 'critical':
      case 'high':
        return {
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
          dot: 'bg-rose-400',
          label: 'Высокое внимание',
        };
      case 'moderate':
        return {
          bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          dot: 'bg-amber-400',
          label: 'Отклонение',
        };
      default:
        return {
          bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          dot: 'bg-emerald-400',
          label: 'Умеренное',
        };
    }
  };

  const getUrgencyBadge = () => {
    switch (item.doctor?.urgency) {
      case 'emergency':
        return 'bg-rose-500 text-slate-950 font-black';
      case 'urgent':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
      case 'soon':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    }
  };

  const badge = getSeverityBadge();

  return (
    <div
      id={`attention-item-${item.id}`}
      className="bg-[#0B1320] border border-white/[0.08] hover:border-white/20 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl transition-all space-y-4"
    >
      {/* LEVEL 1: SHORT SUMMARY HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${badge.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              <span>{badge.label}</span>
            </span>

            {item.doctor?.specialty && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center gap-1">
                <Stethoscope className="w-3 h-3" />
                <span>{item.doctor.specialty}</span>
              </span>
            )}

            {item.doctor?.urgencyLabel && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getUrgencyBadge()}`}>
                {item.doctor.urgencyLabel}
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight mt-1">
            {item.title}
          </h3>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-[#101A28] hover:bg-white/[0.06] text-[#34F5A4] border border-[#34F5A4]/30 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? 'Свернуть' : 'Подробнее'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* SHORT SUMMARY TEXT (2-3 LINES) */}
      <p className="text-xs sm:text-sm text-white/80 leading-relaxed bg-[#101A28] p-3.5 rounded-2xl border border-white/[0.04]">
        <strong className="text-white font-semibold">Краткое резюме ИИ:</strong> {item.shortSummary}
      </p>

      {/* LEVEL 2: DETAILED EXPANDED VIEW */}
      {isExpanded && (
        <div className="pt-2 border-t border-white/[0.06] space-y-4 animate-fadeIn">
          {/* NAVIGATION SUB-TABS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'meaning', label: 'Что это значит?', icon: Info },
              { id: 'causes', label: 'Возможные причины', icon: HelpCircle },
              { id: 'actions', label: 'Безопасные шаги', icon: ShieldCheck },
              { id: 'doctor', label: 'К какому врачу', icon: Stethoscope },
              { id: 'sources', label: 'Источники вывода', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-[#34F5A4] text-slate-950 shadow-md'
                      : 'bg-[#101A28] text-white/70 hover:bg-white/[0.06] border border-white/[0.06]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: Что это значит (Plain Russian explanation with terms in brackets) */}
          {activeTab === 'meaning' && (
            <div className="bg-[#101A28] p-4 rounded-2xl border border-white/[0.06] space-y-3">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#34F5A4] flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>Понятное объяснение показателя</span>
              </h4>
              <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                {item.plainExplanation}
              </p>
              {item.emergencySigns && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-200 space-y-1">
                  <span className="font-bold text-rose-300 block flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-rose-400" />
                    When to call emergency (103 / 112):
                  </span>
                  <span>{item.emergencySigns}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Возможные причины (Categorized: common, lifestyle, medication, doctor_check) */}
          {activeTab === 'causes' && (
            <div className="space-y-3">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#4DEBFF] flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                <span>Вероятные причины отклонения</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {item.possibleCauses.map((cause, idx) => {
                  const getCategoryLabel = () => {
                    switch (cause.category) {
                      case 'lifestyle':
                        return { text: 'Образ жизни', color: 'text-[#34F5A4] bg-[#34F5A4]/10 border-[#34F5A4]/20' };
                      case 'medication':
                        return { text: 'Лекарства/БАДы', color: 'text-[#8E74FF] bg-[#8E74FF]/10 border-[#8E74FF]/20' };
                      case 'doctor_check':
                        return { text: 'Медицинская оценка', color: 'text-[#FF8C42] bg-[#FF8C42]/10 border-[#FF8C42]/20' };
                      default:
                        return { text: 'Физиология', color: 'text-[#4DEBFF] bg-[#4DEBFF]/10 border-[#4DEBFF]/20' };
                    }
                  };
                  const cat = getCategoryLabel();
                  return (
                    <div
                      key={idx}
                      className="bg-[#101A28] p-3.5 rounded-2xl border border-white/[0.04] space-y-1.5"
                    >
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cat.color}`}>
                        {cat.text}
                      </span>
                      <h5 className="font-bold text-white text-xs mt-1">{cause.title}</h5>
                      <p className="text-xs text-white/70 leading-relaxed">{cause.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Безопасные шаги сейчас */}
          {activeTab === 'actions' && (
            <div className="bg-[#101A28] p-4 rounded-2xl border border-white/[0.06] space-y-3">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#34F5A4] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Безопасные рекомендации по образу жизни</span>
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-white/80">
                {item.safeActionsNow.map((act, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34F5A4] mt-1.5 shrink-0" />
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-white/50 italic border-t border-white/[0.04] pt-2">
                * Важно: данные рекомендации не заменяют очный приём врача и не являются назначением лекарственных препаратов.
              </p>
            </div>
          )}

          {/* TAB 4: К какому врачу */}
          {activeTab === 'doctor' && item.doctor && (
            <div className="bg-[#101A28] p-4 rounded-2xl border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-[#8E74FF]" />
                  <span className="font-bold text-white text-sm">
                    {item.doctor.specialty}
                  </span>
                </div>
                <span className="text-xs text-white/60 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#8E74FF]" />
                  {item.doctor.timeframe}
                </span>
              </div>

              <p className="text-xs text-white/80 leading-relaxed">
                <strong className="text-white font-semibold">Причина обращения:</strong> {item.doctor.reason}
              </p>

              {item.doctor.prepareItems && item.doctor.prepareItems.length > 0 && (
                <div className="bg-black/20 p-3 rounded-xl border border-white/[0.04] space-y-1.5 text-xs">
                  <span className="font-bold text-white/90 block">Что взять с собой на консультацию:</span>
                  <div className="flex flex-wrap gap-2">
                    {item.doctor.prepareItems.map((p, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-white/5 text-white/80 rounded-lg border border-white/10">
                        📄 {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Источники вывода */}
          {activeTab === 'sources' && (
            <div className="bg-[#101A28] p-4 rounded-2xl border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#FF8C42] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Прозрачность вывода (Explainability)</span>
                </h4>
                <span className="text-xs font-mono text-[#34F5A4]">
                  Достоверность ИИ: {Math.round((item.confidence || 0.9) * 100)}%
                </span>
              </div>

              <div className="space-y-2">
                {item.reasoningSources.map((src, idx) => (
                  <div key={idx} className="p-3 bg-black/20 rounded-xl border border-white/[0.04] text-xs space-y-0.5">
                    <span className="font-bold text-[#FF8C42] block">{src.label}</span>
                    <span className="text-white/70 block">{src.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
