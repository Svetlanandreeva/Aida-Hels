import React, { useState } from 'react';
import { DailyLogEntry } from '../types';
import { Heart, Activity, CheckCircle2, TrendingUp, Calendar } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface DailyCheckinProps {
  logs: DailyLogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<DailyLogEntry[]>>;
  onOpenPressureDiary?: () => void;
}

export const DailyCheckin: React.FC<DailyCheckinProps> = ({ logs, setLogs, onOpenPressureDiary }) => {
  const [energy, setEnergy] = useState(8);
  const [sleep, setSleep] = useState(8);
  const [stress, setStress] = useState(3);
  const [mood, setMood] = useState(9);
  const [comfort, setComfort] = useState(9);
  const [submittedToday, setSubmittedToday] = useState(false);

  const handleSubmitToday = (e: React.FormEvent) => {
    e.preventDefault();
    const todayStr = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    const newEntry: DailyLogEntry = {
      date: todayStr,
      energy,
      sleep,
      stress,
      mood,
      comfort,
    };
    setLogs((prev) => [...prev.slice(1), newEntry]);
    setSubmittedToday(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 sm:pb-36">
      {/* Title */}
      <div className="bg-[#14171C] p-6 rounded-2xl border border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Heart className="w-6 h-6 text-emerald-400 fill-current" />
            <span>Ежедневный опрос самочувствия</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Отслеживайте корреляцию между уровнем стресса, качеством сна и энергией.
          </p>
        </div>

        {submittedToday && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Опрос за сегодня пройден</span>
          </span>
        )}
      </div>

      {/* Pressure Diary Quick Banner */}
      {onOpenPressureDiary && (
        <div className="bg-gradient-to-r from-[#0B1320] via-[#101A28] to-[#0B1320] p-5 rounded-2xl border border-[#34F5A4]/25 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#34F5A4]/15 border border-[#34F5A4]/30 flex items-center justify-center text-[#34F5A4] shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Дневник артериального давления и пульса</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Динамика систолического, диастолического давления и пульса за 7, 14 и 30 дней.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenPressureDiary}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#34F5A4] hover:bg-[#2be093] text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            Открыть график и замеры АД
          </button>
        </div>
      )}

      {/* Daily Sliders Form */}
      <form
        onSubmit={handleSubmitToday}
        className="bg-[#14171C] p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-md space-y-6"
      >
        <h2 className="text-base font-bold text-gray-100 border-b border-gray-800 pb-3">
          Оценка состояния за {new Date().toLocaleDateString('ru-RU')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Energy */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-300">Уровень энергии</span>
              <span className="text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                {energy} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Sleep */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-300">Качество сна (часов / покой)</span>
              <span className="text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded font-bold">
                {sleep} ч
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="12"
              step="0.5"
              value={sleep}
              onChange={(e) => setSleep(Number(e.target.value))}
              className="w-full accent-teal-500 cursor-pointer"
            />
          </div>

          {/* Stress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-300">Уровень стресса / тревоги</span>
              <span className="text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                {stress} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={stress}
              onChange={(e) => setStress(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Mood */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-300">Настроение и фон</span>
              <span className="text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                {mood} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={mood}
              onChange={(e) => setMood(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            Зафиксировать дневной чек-ин
          </button>
        </div>
      </form>

      {/* Dynamic Graph Section */}
      <div className="bg-[#14171C] p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-gray-100 text-base">График динамики самочувствия</h2>
          </div>
          <span className="text-xs text-gray-400">За последние 7 дней</span>
        </div>

        <div className="h-72 w-full pt-2">
          {logs.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                <YAxis domain={[0, 10]} stroke="#9ca3af" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#14171C',
                    borderRadius: '12px',
                    border: '1px solid #374151',
                    color: '#f3f4f6',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="energy"
                  name="Энергия"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="sleep"
                  name="Сон (ч)"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="stress"
                  name="Стресс"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#090B10] border border-white/[0.04] rounded-2xl space-y-2">
              <TrendingUp className="w-8 h-8 text-white/20" />
              <p className="text-sm font-bold text-white/70">Записи ежедневного опроса отсутствуют</p>
              <p className="text-xs text-white/40">Заполните форму выше, чтобы зафиксировать первые данные динамики самочувствия</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
