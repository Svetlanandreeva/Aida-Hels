import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Filter,
  RefreshCw,
  Activity,
  FileText,
  Pill,
  Clock,
  Heart,
  Smile,
  AlertCircle,
  Stethoscope,
  ChevronRight,
  ArrowDownCircle,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ScreenId } from '../types';

export interface TimelineEventItem {
  id: string;
  type:
    | 'lab_result'
    | 'symptom'
    | 'medication'
    | 'diagnosis'
    | 'measurement'
    | 'sleep'
    | 'workout'
    | 'pregnancy'
    | 'dental'
    | 'appointment';
  timestamp: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: string;
  severity?: 'normal' | 'attention' | 'warning' | 'critical';
  details?: Record<string, any>;
  sourceEntityId?: string;
  sourceType: string;
  cta?: {
    label: string;
    targetScreen?: string;
    targetId?: string;
  };
}

interface TimelineScreenProps {
  onNavigate: (screen: ScreenId) => void;
  activeSubjectProfileId?: string;
}

const EVENT_TYPE_OPTIONS: { id: string; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'lab_result', label: 'Анализы & Документы', icon: FileText },
  { id: 'measurement', label: 'Измерения & АД', icon: Activity },
  { id: 'symptom', label: 'Симптомы & Настроение', icon: Smile },
  { id: 'medication', label: 'Лекарства', icon: Pill },
  { id: 'appointment', label: 'Приёмы врачей', icon: Stethoscope },
  { id: 'sleep', label: 'Сон', icon: Clock },
  { id: 'diagnosis', label: 'Диагнозы', icon: AlertCircle },
  { id: 'pregnancy', label: 'Женское здоровье', icon: Heart },
  { id: 'workout', label: 'Тренировки', icon: Activity },
  { id: 'dental', label: 'Стоматология', icon: Sparkles },
];

export const TimelineScreen: React.FC<TimelineScreenProps> = ({ onNavigate, activeSubjectProfileId }) => {
  const [events, setEvents] = useState<TimelineEventItem[]>([]);
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [dateRangePreset, setDateRangePreset] = useState<'all' | '7d' | '30d' | '365d'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const calculateDateFilter = () => {
    if (dateRangePreset === 'all') return { from: undefined, to: undefined };
    const now = new Date();
    const fromDate = new Date();
    if (dateRangePreset === '7d') fromDate.setDate(now.getDate() - 7);
    if (dateRangePreset === '30d') fromDate.setDate(now.getDate() - 30);
    if (dateRangePreset === '365d') fromDate.setDate(now.getDate() - 365);
    return { from: fromDate.toISOString(), to: now.toISOString() };
  };

  const fetchTimelineData = async (isLoadMore = false) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
    }

    try {
      const { from, to } = calculateDateFilter();
      const profileId = activeSubjectProfileId || 'self';

      const queryParams = new URLSearchParams();
      if (from) queryParams.set('from', from);
      if (to) queryParams.set('to', to);
      if (selectedTypes.length > 0) queryParams.set('types', selectedTypes.join(','));
      if (isLoadMore && nextCursor) queryParams.set('cursor', nextCursor);
      queryParams.set('limit', '25');

      const res = await fetch(`/profiles/${profileId}/timeline?${queryParams.toString()}`);
      const data = await res.json();

      if (data.success) {
        if (isLoadMore) {
          setEvents((prev) => [...prev, ...(data.events || [])]);
        } else {
          setEvents(data.events || []);
        }
        setTotalEvents(data.totalEvents || 0);
        setNextCursor(data.nextCursor || null);
        setHasMore(!!data.hasMore);
      } else {
        setError(data.message || 'Ошибка загрузки таймлайна');
      }
    } catch (err: any) {
      console.error('Timeline fetch error:', err);
      setError('Не удалось подключиться к серверу истории здоровья');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTimelineData(false);
  }, [selectedTypes, dateRangePreset, activeSubjectProfileId]);

  const toggleTypeFilter = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  const filteredEvents = events.filter((evt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      evt.title.toLowerCase().includes(q) ||
      (evt.subtitle && evt.subtitle.toLowerCase().includes(q)) ||
      (evt.description && evt.description.toLowerCase().includes(q))
    );
  });

  const getEventIcon = (type: TimelineEventItem['type']) => {
    switch (type) {
      case 'lab_result':
        return <FileText className="w-5 h-5 text-emerald-400" />;
      case 'measurement':
        return <Activity className="w-5 h-5 text-[#3DD9C5]" />;
      case 'symptom':
        return <Smile className="w-5 h-5 text-amber-400" />;
      case 'medication':
        return <Pill className="w-5 h-5 text-purple-400" />;
      case 'appointment':
        return <Stethoscope className="w-5 h-5 text-sky-400" />;
      case 'sleep':
        return <Clock className="w-5 h-5 text-indigo-400" />;
      case 'diagnosis':
        return <AlertCircle className="w-5 h-5 text-rose-400" />;
      case 'pregnancy':
        return <Heart className="w-5 h-5 text-pink-400" />;
      case 'dental':
        return <Sparkles className="w-5 h-5 text-teal-400" />;
      default:
        return <Activity className="w-5 h-5 text-blue-400" />;
    }
  };

  const getSeverityBadge = (severity?: TimelineEventItem['severity']) => {
    if (!severity || severity === 'normal') return null;
    if (severity === 'warning' || severity === 'attention') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30">
          <AlertCircle className="w-3 h-3" />
          Внимание
        </span>
      );
    }
    if (severity === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
          <AlertCircle className="w-3 h-3" />
          Критический показатель
        </span>
      );
    }
    return null;
  };

  const formatDateLabel = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 text-white">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-[#3DD9C5] font-semibold text-sm">
            <Calendar className="w-4 h-4" />
            <span>Единый журнал медистории</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            История здоровья (Timeline)
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Агрегированный таймлайн всех анализов, симптомов, приёмов препаратов, измерений и диагнозов.
          </p>
        </div>

        <button
          onClick={() => fetchTimelineData(false)}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111827] hover:bg-[#1f293d] border border-white/10 hover:border-[#3DD9C5]/40 rounded-xl transition-all cursor-pointer text-sm font-semibold text-white/90"
        >
          <RefreshCw className={`w-4 h-4 text-[#3DD9C5] ${isLoading ? 'animate-spin' : ''}`} />
          <span>Синхронизировать</span>
        </button>
      </div>

      {/* SEARCH AND DATE PRESETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по событиям, названию, препаратам или симптомам..."
            className="w-full bg-[#111827] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#3DD9C5]"
          />
        </div>

        {/* Date Presets */}
        <div className="flex items-center gap-1 bg-[#111827] border border-white/10 p-1 rounded-xl">
          {[
            { id: 'all', label: 'Всё' },
            { id: '7d', label: '7 дн' },
            { id: '30d', label: '30 дн' },
            { id: '365d', label: 'Год' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setDateRangePreset(preset.id as any)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                dateRangePreset === preset.id
                  ? 'bg-[#3DD9C5]/20 text-[#3DD9C5] border border-[#3DD9C5]/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* CATEGORY TYPE FILTERS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#3DD9C5]" />
            <span>Фильтр типов событий:</span>
          </div>
          {selectedTypes.length > 0 && (
            <button
              onClick={() => setSelectedTypes([])}
              className="text-[#3DD9C5] hover:underline cursor-pointer"
            >
              Сбросить ({selectedTypes.length})
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {EVENT_TYPE_OPTIONS.map((opt) => {
            const isSelected = selectedTypes.includes(opt.id);
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                onClick={() => toggleTypeFilter(opt.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[#3DD9C5]/20 border-[#3DD9C5] text-[#3DD9C5] shadow-sm'
                    : 'bg-[#111827]/80 border-white/10 text-gray-300 hover:border-white/20 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN TIMELINE CONTENT */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3 bg-[#111827]/50 rounded-2xl border border-white/5">
          <RefreshCw className="w-8 h-8 text-[#3DD9C5] animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Формируем историю здоровья...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center space-y-2">
          <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-sm text-rose-200">{error}</p>
          <button
            onClick={() => fetchTimelineData(false)}
            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Попробовать снова
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-16 text-center space-y-4 bg-[#111827]/50 rounded-2xl border border-white/5 p-6">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">В выбранном периоде нет событий</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              Попробуйте сбросить фильтры или добавьте новые замеры давления, анализы или зафиксируйте дневник симптомов.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() => onNavigate('pressure_diary')}
              className="px-3.5 py-2 bg-[#3DD9C5]/10 text-[#3DD9C5] border border-[#3DD9C5]/30 rounded-xl text-xs font-semibold hover:bg-[#3DD9C5]/20 cursor-pointer"
            >
              + Замерить давление
            </button>
            <button
              onClick={() => onNavigate('daily_checkin')}
              className="px-3.5 py-2 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold hover:bg-purple-500/20 cursor-pointer"
            >
              + Чек-ин состояния
            </button>
          </div>
        </div>
      ) : (
        <div className="relative border-l-2 border-white/10 ml-4 pl-6 space-y-6 pt-2">
          {filteredEvents.map((event) => (
            <div key={event.id} className="relative group">
              {/* Timeline dot */}
              <div className="absolute -left-[35px] top-1.5 w-6 h-6 rounded-full bg-[#111827] border-2 border-[#3DD9C5] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <div className="w-2 h-2 rounded-full bg-[#3DD9C5]" />
              </div>

              {/* Event Card */}
              <div className="bg-[#111827] border border-white/10 hover:border-[#3DD9C5]/40 rounded-2xl p-4 sm:p-5 transition-all shadow-sm space-y-3">
                {/* Header line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      {getEventIcon(event.type)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-[#3DD9C5] transition-colors">
                        {event.title}
                      </h3>
                      {event.subtitle && (
                        <p className="text-xs text-gray-400 font-medium">{event.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getSeverityBadge(event.severity)}
                    <span className="text-[11px] font-semibold text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                      {formatDateLabel(event.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {event.description && (
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                    {event.description}
                  </p>
                )}

                {/* Details Breakdown if available */}
                {event.details && Object.keys(event.details).length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {Object.entries(event.details).map(([key, val]) => {
                      if (val === undefined || val === null || typeof val === 'object') return null;
                      return (
                        <span
                          key={key}
                          className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-gray-300 text-[11px]"
                        >
                          <span className="text-gray-500 font-medium mr-1">{key}:</span>
                          <span className="font-semibold text-white">{String(val)}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Footer CTA */}
                {event.cta && (
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => {
                        if (event.cta?.targetScreen) {
                          onNavigate(event.cta.targetScreen as ScreenId);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3DD9C5] hover:text-[#2dc2ae] transition-colors cursor-pointer group/cta"
                    >
                      <span>{event.cta.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover/cta:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Pagination Load More */}
          {hasMore && (
            <div className="pt-4 text-center">
              <button
                onClick={() => fetchTimelineData(true)}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#111827] hover:bg-[#1a2336] border border-[#3DD9C5]/30 hover:border-[#3DD9C5] rounded-xl text-xs font-bold text-[#3DD9C5] transition-all cursor-pointer shadow-sm"
              >
                {isLoadingMore ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#3DD9C5]" />
                ) : (
                  <ArrowDownCircle className="w-4 h-4 text-[#3DD9C5]" />
                )}
                <span>Загрузить предыдущие события</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimelineScreen;
