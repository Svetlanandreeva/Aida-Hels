import React, { useState, useMemo } from 'react';
import { PressureLogEntry } from '../types';
import {
  Heart,
  Activity,
  Plus,
  Calendar,
  Clock,
  TrendingUp,
  Info,
  Trash2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';

interface PressureDiaryProps {
  entries: PressureLogEntry[];
  setEntries: React.Dispatch<React.SetStateAction<PressureLogEntry[]>>;
  onNavigateBack?: () => void;
}

export const PressureDiary: React.FC<PressureDiaryProps> = ({
  entries,
  setEntries,
  onNavigateBack,
}) => {
  // Timeframe filter state: 7, 14, or 30 days
  const [timeframe, setTimeframe] = useState<7 | 14 | 30>(14);

  // Toggle line visibility
  const [showSystolic, setShowSystolic] = useState(true);
  const [showDiastolic, setShowDiastolic] = useState(true);
  const [showPulse, setShowPulse] = useState(true);
  const [showReferenceLines, setShowReferenceLines] = useState(true);

  // New log form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [systolicInput, setSystolicInput] = useState<number>(120);
  const [diastolicInput, setDiastolicInput] = useState<number>(80);
  const [pulseInput, setPulseInput] = useState<number>(70);
  const [timeOfDayInput, setTimeOfDayInput] = useState<'morning' | 'day' | 'evening' | 'night'>('morning');
  const [noteInput, setNoteInput] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['В покое', 'Утро']);

  const availableTags = [
    'В покое',
    'Утро',
    'Вечер',
    'После нагрузки',
    'После кофе',
    'При стрессе',
    'После лекарства',
    'При головной боли',
  ];

  // Calculate BP Category for any given systolic & diastolic values
  const getBpCategory = (systolic: number, diastolic: number) => {
    if (systolic < 120 && diastolic < 80) {
      return {
        label: 'Оптимальное АД',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/15',
        borderColor: 'border-emerald-500/30',
        description: 'Отличное значение давления для здоровья сосудов и сердца.',
      };
    }
    if (systolic <= 129 && diastolic <= 84) {
      return {
        label: 'Нормальное АД',
        color: 'text-teal-300',
        bgColor: 'bg-teal-500/15',
        borderColor: 'border-teal-500/30',
        description: 'Показатели находятся в пределах целевой нормы.',
      };
    }
    if (systolic <= 139 || diastolic <= 89) {
      return {
        label: 'Высокое нормальное АД',
        color: 'text-amber-300',
        bgColor: 'bg-amber-500/15',
        borderColor: 'border-amber-500/30',
        description: 'Рекомендуется обращать внимание на отдых, режим сна и уровень стресса.',
      };
    }
    if (systolic <= 159 || diastolic <= 99) {
      return {
        label: 'Гипертензия 1 степени',
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/15',
        borderColor: 'border-orange-500/30',
        description: 'Мягкое повышение АД. Желательно проконсультироваться с терапевтом.',
      };
    }
    return {
      label: 'Выраженная гипертензия',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/15',
      borderColor: 'border-rose-500/30',
      description: 'Значительное повышение давления. Потребуется медицинский контроль.',
    };
  };

  // Filter entries based on timeframe (7, 14, or 30 days)
  const filteredEntries = useMemo(() => {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    if (sorted.length === 0) return [];

    const now = new Date().getTime();
    const cutoffMs = timeframe * 24 * 60 * 60 * 1000;

    const filtered = sorted.filter((entry) => {
      const entryTime = new Date(entry.timestamp).getTime();
      return now - entryTime <= cutoffMs;
    });

    // Fallback if no entries fall in time range, return last 'timeframe' items
    return filtered.length > 0 ? filtered : sorted.slice(-timeframe);
  }, [entries, timeframe]);

  // Analytical stats calculation
  const stats = useMemo(() => {
    if (filteredEntries.length === 0) {
      return {
        avgSystolic: 120,
        avgDiastolic: 80,
        avgPulse: 70,
        avgPulsePressure: 40,
        normalPercent: 100,
        minSystolic: 115,
        maxSystolic: 125,
      };
    }

    const sysSum = filteredEntries.reduce((acc, e) => acc + e.systolic, 0);
    const diaSum = filteredEntries.reduce((acc, e) => acc + e.diastolic, 0);
    const pulseSum = filteredEntries.reduce((acc, e) => acc + e.pulse, 0);

    const count = filteredEntries.length;
    const avgSys = Math.round(sysSum / count);
    const avgDia = Math.round(diaSum / count);
    const avgPul = Math.round(pulseSum / count);

    const normalCount = filteredEntries.filter(
      (e) => e.systolic <= 129 && e.diastolic <= 84
    ).length;

    const sysValues = filteredEntries.map((e) => e.systolic);

    return {
      avgSystolic: avgSys,
      avgDiastolic: avgDia,
      avgPulse: avgPul,
      avgPulsePressure: avgSys - avgDia,
      normalPercent: Math.round((normalCount / count) * 100),
      minSystolic: Math.min(...sysValues),
      maxSystolic: Math.max(...sysValues),
    };
  }, [filteredEntries]);

  // Current current status
  const currentCategory = getBpCategory(stats.avgSystolic, stats.avgDiastolic);

  // Toggle tag in form
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Add new measurement handler
  const handleAddMeasurement = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const displayDateStr = now.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
    });

    const newLog: PressureLogEntry = {
      id: `bp-${Date.now()}`,
      timestamp: now.toISOString(),
      date: dateStr,
      displayDate: displayDateStr,
      systolic: systolicInput,
      diastolic: diastolicInput,
      pulse: pulseInput,
      timeOfDay: timeOfDayInput,
      note: noteInput.trim() || undefined,
      tags: selectedTags,
    };

    setEntries((prev) => [...prev, newLog]);
    setIsModalOpen(false);
    setNoteInput('');
  };

  // Delete measurement handler
  const handleDeleteMeasurement = (id: string) => {
    setEntries((prev) => prev.filter((item) => item.id !== id));
  };

  // Custom Recharts Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload as PressureLogEntry;
      if (!dataPoint) return null;

      const category = getBpCategory(dataPoint.systolic, dataPoint.diastolic);
      const pulsePressure = dataPoint.systolic - dataPoint.diastolic;

      return (
        <div className="bg-[#0B1320] border border-white/15 rounded-2xl p-3.5 shadow-2xl space-y-2 max-w-[260px] text-xs">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#34F5A4]" />
              {dataPoint.displayDate}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              {dataPoint.timeOfDay === 'morning' && '🌅 Утро'}
              {dataPoint.timeOfDay === 'day' && '☀️ День'}
              {dataPoint.timeOfDay === 'evening' && '🌙 Вечер'}
              {dataPoint.timeOfDay === 'night' && '🌌 Ночь'}
            </span>
          </div>

          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">АД (Сист / Диаст):</span>
              <span className="font-bold text-[#34F5A4]">
                {dataPoint.systolic} / {dataPoint.diastolic} <span className="text-[10px] text-gray-400">мм</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-300">Пульс:</span>
              <span className="font-bold text-amber-400">
                {dataPoint.pulse} <span className="text-[10px] text-gray-400">уд/мин</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Пульсовое давление:</span>
              <span className="font-semibold text-gray-200">{pulsePressure} мм рт.ст.</span>
            </div>
          </div>

          <div className={`mt-1 px-2 py-1 rounded-lg ${category.bgColor} ${category.borderColor} border flex items-center justify-between`}>
            <span className={`font-bold text-[10px] ${category.color}`}>{category.label}</span>
          </div>

          {dataPoint.note && (
            <p className="text-[10px] text-gray-300 italic bg-white/5 p-1.5 rounded-lg">
              «{dataPoint.note}»
            </p>
          )}

          {dataPoint.tags && dataPoint.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {dataPoint.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-white/10 text-gray-300 text-[9px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 px-3 sm:px-6">
      {/* HEADER BAR */}
      <div className="bg-[#14171C] p-5 sm:p-7 rounded-3xl border border-gray-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors mb-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Назад</span>
            </button>
          )}
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <span>Дневник давления и пульса</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400">
            Мониторинг артериального давления, частоты сердечных сокращений и пульсового размаха.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto px-5 py-3 bg-[#34F5A4] hover:bg-[#2be093] text-slate-950 font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-[#34F5A4]/20 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Зафиксировать замер</span>
        </button>
      </div>

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Avg BP */}
        <div className="bg-[#14171C] p-4 sm:p-5 rounded-2xl border border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-gray-400">
            <span>Среднее АД ({timeframe}д)</span>
            <Heart className="w-4 h-4 text-[#34F5A4]" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-white">
            {stats.avgSystolic} <span className="text-gray-400 text-sm font-normal">/ {stats.avgDiastolic}</span>
          </div>
          <div className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-md inline-block ${currentCategory.bgColor} ${currentCategory.color} border ${currentCategory.borderColor}`}>
            {currentCategory.label}
          </div>
        </div>

        {/* Avg Pulse */}
        <div className="bg-[#14171C] p-4 sm:p-5 rounded-2xl border border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-gray-400">
            <span>Средний пульс</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-400">
            {stats.avgPulse} <span className="text-gray-400 text-xs font-normal">уд/мин</span>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-400">
            {stats.avgPulse >= 60 && stats.avgPulse <= 80 ? 'Нормокардия в покое' : 'Требует наблюдения'}
          </p>
        </div>

        {/* Pulse Pressure */}
        <div className="bg-[#14171C] p-4 sm:p-5 rounded-2xl border border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-gray-400">
            <span>Пульсовое давление</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-sky-400">
            {stats.avgPulsePressure} <span className="text-gray-400 text-xs font-normal">мм рт.ст.</span>
          </div>
          <p className="text-[10px] sm:text-xs text-emerald-400">
            {stats.avgPulsePressure >= 30 && stats.avgPulsePressure <= 50 ? 'Целевой размах (30-50)' : 'Обратите внимание'}
          </p>
        </div>

        {/* In Target Range */}
        <div className="bg-[#14171C] p-4 sm:p-5 rounded-2xl border border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-gray-400">
            <span>Замеров в норме</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-400">
            {stats.normalPercent}%
          </div>
          <p className="text-[10px] sm:text-xs text-gray-400">
            {filteredEntries.length} замеров за {timeframe} дней
          </p>
        </div>
      </div>

      {/* DYNAMICS GRAPH SECTION (RECHARTS) */}
      <div className="bg-[#14171C] p-4 sm:p-7 rounded-3xl border border-gray-800 shadow-md space-y-5">
        {/* Graph Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#34F5A4]" />
            <h2 className="font-bold text-white text-base sm:text-lg">Динамика артериального давления и пульса</h2>
          </div>

          {/* Timeframe Selector: 7, 14, 30 days */}
          <div className="flex items-center gap-1 bg-[#0B1320] p-1 rounded-xl border border-gray-800 self-start sm:self-auto">
            <button
              onClick={() => setTimeframe(7)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeframe === 7
                  ? 'bg-[#34F5A4] text-slate-950 shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              7 дней
            </button>
            <button
              onClick={() => setTimeframe(14)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeframe === 14
                  ? 'bg-[#34F5A4] text-slate-950 shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              14 дней
            </button>
            <button
              onClick={() => setTimeframe(30)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeframe === 30
                  ? 'bg-[#34F5A4] text-slate-950 shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              30 дней
            </button>
          </div>
        </div>

        {/* Filter / Toggle Checkboxes for lines */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[#0B1320] p-3 rounded-2xl border border-gray-800/80">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSystolic}
                onChange={(e) => setShowSystolic(e.target.checked)}
                className="accent-[#34F5A4] rounded"
              />
              <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34F5A4]" />
                Систолическое (верхнее)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDiastolic}
                onChange={(e) => setShowDiastolic(e.target.checked)}
                className="accent-sky-400 rounded"
              />
              <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                Диастолическое (нижнее)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPulse}
                onChange={(e) => setShowPulse(e.target.checked)}
                className="accent-amber-400 rounded"
              />
              <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Пульс (уд/мин)
              </span>
            </label>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-gray-400 hover:text-gray-200">
            <input
              type="checkbox"
              checked={showReferenceLines}
              onChange={(e) => setShowReferenceLines(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span>Линии целевых норм</span>
          </label>
        </div>

        {/* Recharts Responsive Container */}
        <div className="h-72 sm:h-96 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={filteredEntries}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              
              <XAxis
                dataKey="displayDate"
                stroke="#9ca3af"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#374151' }}
              />

              {/* Left Y Axis for Pressure (mmHg) */}
              <YAxis
                yAxisId="bp"
                domain={[50, 170]}
                stroke="#9ca3af"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#374151' }}
                unit=" мм"
              />

              {/* Right Y Axis for Pulse (bpm) */}
              <YAxis
                yAxisId="pulse"
                orientation="right"
                domain={[40, 130]}
                stroke="#f59e0b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#374151' }}
                unit=" уд"
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Target Reference Lines */}
              {showReferenceLines && (
                <>
                  <ReferenceLine
                    yAxisId="bp"
                    y={120}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                  />
                  <ReferenceLine
                    yAxisId="bp"
                    y={80}
                    stroke="#38bdf8"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                  />
                  <ReferenceLine
                    yAxisId="bp"
                    y={140}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                </>
              )}

              {/* Systolic Line */}
              {showSystolic && (
                <Line
                  yAxisId="bp"
                  type="monotone"
                  dataKey="systolic"
                  name="Систолическое АД"
                  stroke="#34F5A4"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#34F5A4', strokeWidth: 0 }}
                  activeDot={{ r: 7, fill: '#34F5A4', stroke: '#050A12', strokeWidth: 2 }}
                />
              )}

              {/* Diastolic Line */}
              {showDiastolic && (
                <Line
                  yAxisId="bp"
                  type="monotone"
                  dataKey="diastolic"
                  name="Диастолическое АД"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#38bdf8', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#38bdf8', stroke: '#050A12', strokeWidth: 2 }}
                />
              )}

              {/* Pulse Line */}
              {showPulse && (
                <Line
                  yAxisId="pulse"
                  type="monotone"
                  dataKey="pulse"
                  name="Пульс"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#f59e0b', stroke: '#050A12', strokeWidth: 2 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Medical Legend Note */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 pt-2 border-t border-gray-800/60">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[#10b981] border-dashed" /> Норма систолического (&lt;120 мм)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[#38bdf8] border-dashed" /> Норма диастолического (&lt;80 мм)
            </span>
          </div>
          <span className="text-gray-500">
            Оптимальный интервал между замерами: утро (натощак) и вечер (перед сном)
          </span>
        </div>
      </div>

      {/* RECENT MEASUREMENTS LOG TABLE / CARDS */}
      <div className="bg-[#14171C] p-4 sm:p-7 rounded-3xl border border-gray-800 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#34F5A4]" />
            <span>История замеров ({filteredEntries.length})</span>
          </h3>
          <span className="text-xs text-gray-400">Сортировка: Свежие сверху</span>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filteredEntries
            .slice()
            .reverse()
            .map((entry) => {
              const category = getBpCategory(entry.systolic, entry.diastolic);
              return (
                <div
                  key={entry.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#0B1320] border border-gray-800 hover:border-gray-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex flex-col items-center justify-center shrink-0 border border-white/10 text-center">
                      <span className="text-[11px] font-bold text-[#34F5A4] leading-none">
                        {entry.displayDate.split(' ')[0]}
                      </span>
                      <span className="text-[9px] text-gray-400 leading-none mt-0.5">
                        {entry.displayDate.split(' ')[1] || 'Авг'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white">
                          {entry.systolic} / {entry.diastolic}
                          <span className="text-xs text-gray-400 font-normal ml-1">мм рт.ст.</span>
                        </span>
                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                          ❤️ {entry.pulse} уд
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${category.bgColor} ${category.color}`}>
                          {category.label}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {entry.timeOfDay === 'morning' && '🌅 Утро'}
                          {entry.timeOfDay === 'day' && '☀️ День'}
                          {entry.timeOfDay === 'evening' && '🌙 Вечер'}
                          {entry.timeOfDay === 'night' && '🌌 Ночь'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-gray-800/80 pt-2 sm:pt-0">
                    {entry.note && (
                      <p className="text-xs text-gray-300 italic max-w-xs truncate">
                        «{entry.note}»
                      </p>
                    )}

                    <button
                      onClick={() => handleDeleteMeasurement(entry.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Удалить запись"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* NEW MEASUREMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#14171C] border border-gray-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#34F5A4]" />
                <span>Зафиксировать новое измерение</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMeasurement} className="space-y-5">
              {/* Sliders / Inputs for Systolic, Diastolic, Pulse */}
              <div className="space-y-4">
                {/* Systolic */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-300">Систолическое (верхнее) АД</span>
                    <span className="text-[#34F5A4] font-bold text-sm bg-[#34F5A4]/10 px-2.5 py-0.5 rounded-lg border border-[#34F5A4]/20">
                      {systolicInput} мм рт.ст.
                    </span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="200"
                    value={systolicInput}
                    onChange={(e) => setSystolicInput(Number(e.target.value))}
                    className="w-full accent-[#34F5A4] cursor-pointer"
                  />
                </div>

                {/* Diastolic */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-300">Диастолическое (нижнее) АД</span>
                    <span className="text-sky-300 font-bold text-sm bg-sky-500/10 px-2.5 py-0.5 rounded-lg border border-sky-500/20">
                      {diastolicInput} мм рт.ст.
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="130"
                    value={diastolicInput}
                    onChange={(e) => setDiastolicInput(Number(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                {/* Pulse */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-300">Пульс (ЧСС)</span>
                    <span className="text-amber-300 font-bold text-sm bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                      {pulseInput} уд/мин
                    </span>
                  </div>
                  <input
                    type="range"
                    min="45"
                    max="140"
                    value={pulseInput}
                    onChange={(e) => setPulseInput(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Dynamic Category Preview */}
              {(() => {
                const cat = getBpCategory(systolicInput, diastolicInput);
                return (
                  <div className={`p-3.5 rounded-2xl ${cat.bgColor} ${cat.borderColor} border space-y-1`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-xs ${cat.color}`}>{cat.label}</span>
                      <span className="text-[11px] text-gray-300 font-mono">
                        Пульс. размах: {systolicInput - diastolicInput} мм
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300">{cat.description}</p>
                  </div>
                );
              })()}

              {/* Time of Day */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 block">Время суток</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'morning', label: '🌅 Утро' },
                    { id: 'day', label: '☀️ День' },
                    { id: 'evening', label: '🌙 Вечер' },
                    { id: 'night', label: '🌌 Ночь' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTimeOfDayInput(item.id as any)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        timeOfDayInput === item.id
                          ? 'bg-[#34F5A4] text-slate-950 border-[#34F5A4]'
                          : 'bg-[#0B1320] text-gray-300 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 block">Контекст и теги</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
                        selectedTags.includes(tag)
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                          : 'bg-[#0B1320] border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  Заметка (необязательно)
                </label>
                <input
                  type="text"
                  placeholder="Например: Самочувствие отличное, замер после отдыха"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full bg-[#0B1320] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#34F5A4]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#34F5A4] hover:bg-[#2be093] text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Сохранить замер
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
