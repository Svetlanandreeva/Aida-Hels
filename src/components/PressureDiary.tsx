import React, { useMemo, useState } from 'react';
import { Activity, ArrowLeft, Clock, HeartPulse, Plus, Trash2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PressureLogEntry } from '../types';

interface PressureDiaryProps {
  entries: PressureLogEntry[];
  setEntries: React.Dispatch<React.SetStateAction<PressureLogEntry[]>>;
  onNavigateBack?: () => void;
}

type Range = 7 | 14 | 30;

const timeLabel = (value?: string) => {
  if (value === 'morning') return 'Утро';
  if (value === 'day') return 'День';
  if (value === 'evening') return 'Вечер';
  if (value === 'night') return 'Ночь';
  return 'Замер';
};

export const PressureDiary: React.FC<PressureDiaryProps> = ({ entries, setEntries, onNavigateBack }) => {
  const [range, setRange] = useState<Range>(14);
  const [isOpen, setIsOpen] = useState(false);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'day' | 'evening' | 'night'>('morning');
  const [note, setNote] = useState('');

  const filtered = useMemo(() => {
    const cutoff = Date.now() - range * 24 * 60 * 60 * 1000;
    return [...entries]
      .filter((entry) => new Date(entry.timestamp).getTime() >= cutoff)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [entries, range]);

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const average = (key: 'systolic' | 'diastolic' | 'pulse') =>
      Math.round(filtered.reduce((sum, item) => sum + Number(item[key] || 0), 0) / filtered.length);
    return {
      systolic: average('systolic'),
      diastolic: average('diastolic'),
      pulse: average('pulse'),
      count: filtered.length,
    };
  }, [filtered]);

  const chartData = filtered.map((entry) => ({
    ...entry,
    label: entry.displayDate || new Date(entry.timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
  }));

  const saveMeasurement = (event: React.FormEvent) => {
    event.preventDefault();
    const sys = Number(systolic);
    const dia = Number(diastolic);
    const pul = Number(pulse);
    if (!Number.isFinite(sys) || !Number.isFinite(dia) || !Number.isFinite(pul) || sys <= 0 || dia <= 0 || pul <= 0) return;

    const now = new Date();
    const next: PressureLogEntry = {
      id: `bp-${Date.now()}`,
      timestamp: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      displayDate: now.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      systolic: sys,
      diastolic: dia,
      pulse: pul,
      timeOfDay,
      note: note.trim() || undefined,
      tags: [],
    };

    setEntries((prev) => [...prev, next]);
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setNote('');
    setIsOpen(false);
  };

  return (
    <div className="aida-pressure-page">
      <header className="aida-pressure-hero">
        <div className="aida-pressure-copy">
          {onNavigateBack && (
            <button className="aida-pressure-back" onClick={onNavigateBack} type="button">
              <ArrowLeft size={16} /> Назад
            </button>
          )}
          <span className="aida-page-eyebrow"><HeartPulse size={16} /> Наблюдение</span>
          <h1>Давление и пульс</h1>
          <p>Записывайте реальные измерения и смотрите динамику без выдуманных значений и автоматических «норм».</p>
        </div>
        <button className="aida-primary-action" onClick={() => setIsOpen(true)} type="button">
          <Plus size={18} /> Добавить замер
        </button>
      </header>

      <section className="aida-pressure-kpis" aria-label="Сводка за период">
        <article>
          <small>Среднее давление</small>
          <strong>{stats ? `${stats.systolic} / ${stats.diastolic}` : '— / —'}</strong>
          <span>{stats ? `за ${range} дней` : 'Нет данных'}</span>
        </article>
        <article>
          <small>Средний пульс</small>
          <strong>{stats ? stats.pulse : '—'}</strong>
          <span>{stats ? 'уд/мин' : 'Нет данных'}</span>
        </article>
        <article>
          <small>Количество замеров</small>
          <strong>{stats ? stats.count : '—'}</strong>
          <span>{stats ? `за ${range} дней` : 'Нет данных'}</span>
        </article>
      </section>

      <section className="aida-pressure-panel">
        <div className="aida-pressure-panel-head">
          <div>
            <span className="aida-page-eyebrow"><Activity size={16} /> Динамика</span>
            <h2>Изменения показателей</h2>
          </div>
          <div className="aida-range-switch" aria-label="Период">
            {([7, 14, 30] as Range[]).map((value) => (
              <button key={value} className={range === value ? 'active' : ''} onClick={() => setRange(value)} type="button">
                {value} дней
              </button>
            ))}
          </div>
        </div>

        {chartData.length ? (
          <div className="aida-pressure-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#e8ebf0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#7b8190', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#7b8190', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 16, border: '1px solid #e3e6ec', boxShadow: '0 16px 38px rgba(28,38,62,.12)' }}
                  labelStyle={{ color: '#111522', fontWeight: 700 }}
                />
                <Line type="monotone" dataKey="systolic" name="Систолическое" stroke="#e9294f" strokeWidth={2.6} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="diastolic" name="Диастолическое" stroke="#061d48" strokeWidth={2.4} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="pulse" name="Пульс" stroke="#e98074" strokeWidth={2.2} strokeDasharray="6 5" dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="aida-pressure-empty">
            <HeartPulse size={30} />
            <strong>Пока нет измерений</strong>
            <p>После первого сохранённого замера здесь появится график динамики.</p>
            <button className="aida-secondary-action" onClick={() => setIsOpen(true)} type="button">Добавить первый замер</button>
          </div>
        )}
      </section>

      <section className="aida-pressure-panel">
        <div className="aida-pressure-panel-head compact">
          <div>
            <span className="aida-page-eyebrow"><Clock size={16} /> История</span>
            <h2>Последние измерения</h2>
          </div>
        </div>
        {filtered.length ? (
          <div className="aida-pressure-list">
            {[...filtered].reverse().map((entry) => (
              <article key={entry.id} className="aida-pressure-row">
                <div className="aida-pressure-date">
                  <strong>{entry.displayDate || new Date(entry.timestamp).toLocaleDateString('ru-RU')}</strong>
                  <span>{timeLabel(entry.timeOfDay)}</span>
                </div>
                <div className="aida-pressure-values">
                  <span><small>АД</small><b>{entry.systolic} / {entry.diastolic}</b></span>
                  <span><small>Пульс</small><b>{entry.pulse}</b></span>
                </div>
                <p>{entry.note || 'Без заметки'}</p>
                <button className="aida-icon-button" aria-label="Удалить замер" onClick={() => setEntries((prev) => prev.filter((item) => item.id !== entry.id))} type="button">
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="aida-pressure-list-empty">Сохранённых замеров за выбранный период нет.</p>
        )}
      </section>

      {isOpen && (
        <div className="aida-pressure-modal" role="dialog" aria-modal="true" aria-label="Новый замер давления">
          <button className="aida-pressure-modal-backdrop" onClick={() => setIsOpen(false)} aria-label="Закрыть" type="button" />
          <form className="aida-pressure-form" onSubmit={saveMeasurement}>
            <span className="aida-page-eyebrow">Новый замер</span>
            <h2>Добавить показатели</h2>
            <p>Введите значения с тонометра. Поля не заполняются автоматически.</p>
            <div className="aida-pressure-fields">
              <label>Систолическое<input inputMode="numeric" value={systolic} onChange={(e) => setSystolic(e.target.value)} placeholder="например, 118" required /></label>
              <label>Диастолическое<input inputMode="numeric" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} placeholder="например, 76" required /></label>
              <label>Пульс<input inputMode="numeric" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="например, 68" required /></label>
            </div>
            <label>Время суток
              <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value as typeof timeOfDay)}>
                <option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option><option value="night">Ночь</option>
              </select>
            </label>
            <label>Заметка<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Самочувствие, нагрузка, кофе, лекарства — только если это важно вам" rows={3} /></label>
            <div className="aida-pressure-form-actions">
              <button className="aida-secondary-action" type="button" onClick={() => setIsOpen(false)}>Отмена</button>
              <button className="aida-primary-action" type="submit">Сохранить замер</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
