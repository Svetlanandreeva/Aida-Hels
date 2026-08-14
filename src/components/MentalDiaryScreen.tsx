import React, { useMemo, useState } from 'react';
import { Brain, CalendarDays, ChevronRight, Lock, Plus, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { DiaryEntry, UserMentalPatterns, WeeklyMentalReport, UserProfile } from '../types';

interface MentalDiaryScreenProps {
  user?: UserProfile;
  entries: DiaryEntry[];
  patterns: UserMentalPatterns;
  weeklyReport: WeeklyMentalReport;
  onAddEntry: (entry: Partial<DiaryEntry>) => void;
  onUpdateEntry: (entry: Partial<DiaryEntry>) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateWeeklyReportToggle: (enabled: boolean) => void;
  onClearAllDiaryData: () => void;
}

type Tab = 'overview' | 'entries' | 'analytics' | 'privacy';

const scoreLabel = (score?: number) => {
  if (typeof score !== 'number') return 'Нет данных';
  if (score >= 8) return 'Высокий ресурс';
  if (score >= 6) return 'Стабильно';
  if (score >= 4) return 'Нагрузка выше обычной';
  return 'Нужен более бережный режим';
};

export const MentalDiaryScreen: React.FC<MentalDiaryScreenProps> = ({
  entries,
  patterns,
  weeklyReport,
  onAddEntry,
  onDeleteEntry,
  onUpdateWeeklyReportToggle,
  onClearAllDiaryData,
}) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stateScore, setStateScore] = useState('');
  const [energyScore, setEnergyScore] = useState('');
  const [stressScore, setStressScore] = useState('');
  const [mood, setMood] = useState('');
  const [note, setNote] = useState('');

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.event_datetime || b.created_at).getTime() - new Date(a.event_datetime || a.created_at).getTime()),
    [entries]
  );
  const latest = sortedEntries[0];

  const chartData = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(a.event_datetime || a.created_at).getTime() - new Date(b.event_datetime || b.created_at).getTime())
      .slice(-14)
      .map((entry) => ({
        day: new Date(entry.event_datetime || entry.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        state: typeof entry.state_score === 'number' ? entry.state_score : undefined,
        energy: typeof entry.energy_score === 'number' ? entry.energy_score : undefined,
        stress: typeof entry.stress_score === 'number' ? entry.stress_score : undefined,
      }));
  }, [entries]);

  const insights = useMemo(() => {
    const triggerSet = new Set<string>();
    const resourceSet = new Set<string>();
    sortedEntries.forEach((entry) => {
      entry.ai_analysis?.detected_triggers?.forEach((value) => triggerSet.add(value));
      entry.ai_analysis?.detected_resource_factors?.forEach((value) => resourceSet.add(value));
    });
    return { triggers: [...triggerSet].slice(0, 5), resources: [...resourceSet].slice(0, 5) };
  }, [sortedEntries]);

  const submitEntry = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Partial<DiaryEntry> = {
      entry_type: 'full',
      event_datetime: new Date().toISOString(),
      event_description: note.trim(),
      moods: mood.trim() ? [mood.trim()] : [],
    };
    if (stateScore !== '') next.state_score = Number(stateScore);
    if (energyScore !== '') next.energy_score = Number(energyScore);
    if (stressScore !== '') next.stress_score = Number(stressScore);
    onAddEntry(next);
    setStateScore('');
    setEnergyScore('');
    setStressScore('');
    setMood('');
    setNote('');
    setIsFormOpen(false);
  };

  return (
    <div className="aida-mental-page">
      <header className="aida-mental-hero">
        <div>
          <span className="aida-page-eyebrow"><Brain size={16} /> Психика и самочувствие</span>
          <h1>Дневник состояния</h1>
          <p>Личные записи, динамика и наблюдения Аиды — только на основе сохранённых вами данных.</p>
        </div>
        <button className="aida-primary-action" type="button" onClick={() => setIsFormOpen(true)}><Plus size={18} /> Новая запись</button>
      </header>

      <nav className="aida-mental-tabs" aria-label="Разделы дневника">
        {([
          ['overview', 'Сегодня'],
          ['entries', 'Записи'],
          ['analytics', 'Динамика'],
          ['privacy', 'Приватность'],
        ] as [Tab, string][]).map(([value, label]) => (
          <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)} type="button">{label}</button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <section className="aida-mental-summary-grid">
            <article className="aida-mental-state-card">
              <span className="aida-page-eyebrow">Последнее состояние</span>
              <strong>{typeof latest?.state_score === 'number' ? `${latest.state_score}/10` : '—'}</strong>
              <h2>{scoreLabel(latest?.state_score)}</h2>
              <p>{latest ? new Date(latest.event_datetime || latest.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Добавьте первую запись, чтобы начать отслеживать динамику.'}</p>
            </article>
            <article className="aida-mental-ai-card">
              <div className="aida-mental-ai-icon"><Sparkles size={22} /></div>
              <div>
                <span className="aida-page-eyebrow">Наблюдение Аиды</span>
                <h2>{latest?.ai_analysis?.summary_insight ? 'Есть наблюдение по последней записи' : 'Наблюдение появится после анализа данных'}</h2>
                <p>{latest?.ai_analysis?.summary_insight || 'Аида не будет подставлять типовые выводы вместо ваших реальных данных.'}</p>
              </div>
            </article>
          </section>

          <section className="aida-mental-panel">
            <div className="aida-mental-panel-head">
              <div><span className="aida-page-eyebrow"><CalendarDays size={16} /> Последние записи</span><h2>Что вы отмечали</h2></div>
              <button className="aida-text-action" onClick={() => setTab('entries')} type="button">Все записи <ChevronRight size={16} /></button>
            </div>
            {sortedEntries.length ? (
              <div className="aida-mental-entry-list">
                {sortedEntries.slice(0, 4).map((entry) => (
                  <article key={entry.id}>
                    <div className="aida-mental-score">{typeof entry.state_score === 'number' ? entry.state_score : '—'}</div>
                    <div><strong>{entry.moods?.length ? entry.moods.join(', ') : 'Без тега настроения'}</strong><p>{entry.event_description || entry.additional_note || 'Без дополнительной заметки'}</p></div>
                    <time>{new Date(entry.event_datetime || entry.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</time>
                  </article>
                ))}
              </div>
            ) : <div className="aida-mental-empty">Записей пока нет. Можно начать с короткой отметки состояния.</div>}
          </section>
        </>
      )}

      {tab === 'entries' && (
        <section className="aida-mental-panel">
          <div className="aida-mental-panel-head"><div><span className="aida-page-eyebrow">Архив</span><h2>Все записи</h2></div><span className="aida-muted-count">{sortedEntries.length}</span></div>
          {sortedEntries.length ? (
            <div className="aida-mental-entry-list detailed">
              {sortedEntries.map((entry) => (
                <article key={entry.id}>
                  <div className="aida-mental-score">{typeof entry.state_score === 'number' ? entry.state_score : '—'}</div>
                  <div><strong>{entry.moods?.length ? entry.moods.join(', ') : 'Состояние'}</strong><p>{entry.event_description || entry.additional_note || 'Без дополнительной заметки'}</p>{entry.ai_analysis?.summary_insight && <small>{entry.ai_analysis.summary_insight}</small>}</div>
                  <time>{new Date(entry.event_datetime || entry.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}</time>
                  <button className="aida-icon-button" aria-label="Удалить запись" onClick={() => onDeleteEntry(entry.id)} type="button"><Trash2 size={16} /></button>
                </article>
              ))}
            </div>
          ) : <div className="aida-mental-empty">Здесь появится история ваших записей.</div>}
        </section>
      )}

      {tab === 'analytics' && (
        <>
          <section className="aida-mental-panel">
            <div className="aida-mental-panel-head"><div><span className="aida-page-eyebrow"><TrendingUp size={16} /> Динамика</span><h2>Последние наблюдения</h2></div></div>
            {chartData.length >= 2 ? (
              <div className="aida-mental-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}><CartesianGrid stroke="#e8ebf0" strokeDasharray="4 4" vertical={false}/><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#7b8190', fontSize: 11 }}/><YAxis domain={[0, 10]} tickLine={false} axisLine={false} tick={{ fill: '#7b8190', fontSize: 11 }}/><Tooltip contentStyle={{ borderRadius: 16, border: '1px solid #e3e6ec' }}/><Line type="monotone" dataKey="state" name="Состояние" stroke="#061d48" strokeWidth={2.5}/><Line type="monotone" dataKey="energy" name="Энергия" stroke="#e9294f" strokeWidth={2.3}/><Line type="monotone" dataKey="stress" name="Стресс" stroke="#e98074" strokeWidth={2.1} strokeDasharray="6 5"/></LineChart></ResponsiveContainer></div>
            ) : <div className="aida-mental-empty">Для графика нужны минимум две записи с числовыми оценками.</div>}
          </section>
          <section className="aida-mental-insights-grid">
            <article><span className="aida-page-eyebrow">Триггеры</span><h3>Что чаще связано с нагрузкой</h3>{insights.triggers.length ? <div className="aida-mental-chips">{insights.triggers.map((value) => <span key={value}>{value}</span>)}</div> : <p>Пока недостаточно данных.</p>}</article>
            <article><span className="aida-page-eyebrow">Ресурс</span><h3>Что помогает восстанавливаться</h3>{insights.resources.length ? <div className="aida-mental-chips">{insights.resources.map((value) => <span key={value}>{value}</span>)}</div> : <p>Пока недостаточно данных.</p>}</article>
          </section>
        </>
      )}

      {tab === 'privacy' && (
        <section className="aida-mental-panel aida-mental-privacy">
          <div className="aida-mental-lock"><Lock size={24} /></div>
          <div><span className="aida-page-eyebrow">Приватность</span><h2>Дневник — отдельный чувствительный раздел</h2><p>Записи не должны отображаться другим профилям без отдельного разрешения. Пустой дневник не интерпретируется как хорошее или плохое состояние.</p></div>
          <label className="aida-weekly-toggle"><input type="checkbox" checked={Boolean((weeklyReport as any)?.is_enabled)} onChange={(e) => onUpdateWeeklyReportToggle(e.target.checked)} /><span>Еженедельный итог</span></label>
          <button className="aida-danger-text" type="button" onClick={() => { if (window.confirm('Удалить все записи дневника? Это действие нельзя отменить.')) onClearAllDiaryData(); }}>Удалить все записи</button>
        </section>
      )}

      {isFormOpen && (
        <div className="aida-pressure-modal" role="dialog" aria-modal="true" aria-label="Новая запись состояния">
          <button className="aida-pressure-modal-backdrop" onClick={() => setIsFormOpen(false)} aria-label="Закрыть" type="button" />
          <form className="aida-mental-form" onSubmit={submitEntry}>
            <span className="aida-page-eyebrow">Новая запись</span>
            <h2>Как вы сейчас?</h2>
            <p>Можно заполнить только то, что хочется отметить. Пустые поля не превращаются в «средние» значения.</p>
            <div className="aida-mental-form-grid">
              <label>Состояние 0–10<input type="number" min="0" max="10" step="1" value={stateScore} onChange={(e) => setStateScore(e.target.value)} placeholder="Необязательно" /></label>
              <label>Энергия 0–10<input type="number" min="0" max="10" step="1" value={energyScore} onChange={(e) => setEnergyScore(e.target.value)} placeholder="Необязательно" /></label>
              <label>Стресс 0–10<input type="number" min="0" max="10" step="1" value={stressScore} onChange={(e) => setStressScore(e.target.value)} placeholder="Необязательно" /></label>
            </div>
            <label>Настроение<input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="Например: спокойно, тревожно, устала" /></label>
            <label>Что происходило<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Событие, мысли или физическое самочувствие" /></label>
            <div className="aida-pressure-form-actions"><button className="aida-secondary-action" type="button" onClick={() => setIsFormOpen(false)}>Отмена</button><button className="aida-primary-action" type="submit">Сохранить</button></div>
          </form>
        </div>
      )}
    </div>
  );
};
