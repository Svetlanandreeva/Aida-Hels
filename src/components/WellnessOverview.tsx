import React from 'react';
import { ArrowRight, Moon, Pill, Plus } from 'lucide-react';

interface WellnessOverviewProps {
  mode: 'sleep' | 'medications';
  onPrimary: () => void;
}

export const WellnessOverview: React.FC<WellnessOverviewProps> = ({ mode, onPrimary }) => {
  const sleep = mode === 'sleep';
  const Icon = sleep ? Moon : Pill;
  return (
    <section className="aida-simple-page">
      <header>
        <span className="aida-page-eyebrow"><Icon /> {sleep ? 'Сон и восстановление' : 'Лекарства'}</span>
        <h1>{sleep ? 'Сон без догадок' : 'Приём препаратов под контролем'}</h1>
        <p>{sleep ? 'Добавляйте данные о сне — Аида поможет увидеть качество восстановления и связь с самочувствием.' : 'Соберите назначения и расписание в одном месте. Аида поможет не пропускать приём.'}</p>
      </header>
      <div className="aida-simple-grid">
        <article className="aida-simple-primary">
          <span>{sleep ? 'Сегодня' : 'Ближайший приём'}</span>
          <strong>Нет данных</strong>
          <p>{sleep ? 'Первая запись сформирует базовую точку для динамики.' : 'Добавьте препарат и время приёма.'}</p>
          <button onClick={onPrimary}><Plus /> {sleep ? 'Добавить запись' : 'Добавить препарат'}</button>
        </article>
        <article><span>Динамика</span><strong>—</strong><p>Появится после нескольких записей.</p><ArrowRight /></article>
        <article><span>Наблюдение Аиды</span><strong>Пока рано для вывода</strong><p>Нужно больше личных данных.</p><ArrowRight /></article>
      </div>
    </section>
  );
};
