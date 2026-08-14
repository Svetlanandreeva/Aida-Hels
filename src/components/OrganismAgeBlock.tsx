import React, { useState } from 'react';
import { Activity, AlertCircle, ArrowDownRight, ArrowUpRight, ChevronRight, HelpCircle, Info, Sparkles, X } from 'lucide-react';
import { OrganismAgeResult, OrganismSystemAge, formatYearsDiffRussian, formatYearsRussian } from '../utils/calculateOrganismAge';

interface Props { data: OrganismAgeResult; onOpenAddMetrics?: () => void; }

export const OrganismAgeBlock: React.FC<Props> = ({ data, onOpenAddMetrics }) => {
  const [details, setDetails] = useState<OrganismSystemAge | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const ageReady = data.hasSufficientData && data.organismAge > 0;
  const close = () => { setDetails(null); setMethodOpen(false); };

  return <div className="aida-age-layout">
    {!data.hasSufficientData && <div className="aida-data-notice"><span><AlertCircle /></span><div><strong>Для точной оценки нужно больше данных</strong><small>Добавьте ещё {data.missingMetricsCount} показателя — точность расчёта будет расти постепенно.</small></div>{onOpenAddMetrics && <button onClick={onOpenAddMetrics}>Добавить анализы</button>}</div>}

    <article className="aida-age-card">
      <div className="aida-age-card-heading"><div><span><Sparkles /> Расчётный возраст</span><h2>Паспортный и биологический возраст</h2></div><button onClick={() => setMethodOpen(true)}><HelpCircle /> Как рассчитано</button></div>
      <div className="aida-age-comparison"><AgeGauge label="Паспортный" value={data.passportAge || '—'} muted /><div className="aida-age-connector"><span>сравнение</span><i /></div><AgeGauge label="Биологический" value={ageReady ? data.organismAge : '—'} accent /></div>
      <div className="aida-age-summary"><strong>{ageReady ? formatYearsDiffRussian(data.differenceYears) : 'Расчёт формируется'}</strong><span>{ageReady ? data.differenceText : 'Аида покажет разницу, когда данных станет достаточно.'}</span><small>{data.evaluatedMetricsCount} показателей учтено · {data.confidenceLevel}</small></div>
    </article>

    <div className="aida-age-secondary">
      <article className="aida-age-systems"><header><div><span>Системы организма</span><h2>Что влияет на итог</h2></div><small>{data.systemAges.length} систем рассчитано</small></header>
        {data.systemAges.length ? <div className="aida-age-system-list">{data.systemAges.slice(0, 6).map((system) => <button key={system.id} onClick={() => setDetails(system)}><span className="aida-system-dot"><Activity /></span><span><strong>{system.name}</strong><small>{system.age} {formatYearsRussian(system.age).replace(/^\d+\s*/, '')}</small></span><em className={system.diffYears > 0 ? 'up' : 'down'}>{system.diffYears > 0 ? <ArrowUpRight /> : <ArrowDownRight />}{formatYearsDiffRussian(system.diffYears)}</em><ChevronRight /></button>)}</div> : <div className="aida-age-empty"><Activity /><strong>Пока нет расчётов по системам</strong><span>Загрузите анализы и добавьте базовые показатели здоровья.</span></div>}
      </article>
      <article className="aida-age-factors"><span>Данные для оценки</span><h2>Готовность профиля</h2><div className="aida-readiness"><strong>{data.confidenceScore}%</strong><span><i style={{ width: `${data.confidenceScore}%` }} /></span></div><ul><li><i />Лабораторные показатели</li><li><i />Давление и пульс</li><li><i />Сон и самочувствие</li></ul><button onClick={() => setMethodOpen(true)}>О методике <ChevronRight /></button></article>
    </div>

    {(details || methodOpen) && <div className="aida-clean-modal" role="dialog" aria-modal="true"><button className="aida-clean-modal-backdrop" onClick={close} /><section><button className="aida-clean-modal-close" onClick={close}><X /></button>{details ? <><span className="aida-page-eyebrow"><Activity /> Система организма</span><h2>{details.name}</h2><p>{details.explanation}</p><h3>Что можно сделать</h3><ol>{details.recommendations.map((item, index) => <li key={item}><b>{index + 1}</b>{item}</li>)}</ol></> : <><span className="aida-page-eyebrow"><Info /> Методология</span><h2>Как Аида рассчитывает возраст</h2><p>Модель сопоставляет лабораторные показатели, давление, пульс, параметры восстановления и образа жизни. Объективные медицинские данные имеют больший вес, а субъективные записи уточняют контекст.</p><div className="aida-method-note"><strong>{data.confidenceLevel}</strong><span>Сейчас учтено {data.evaluatedMetricsCount} показателей. Итог обновляется вместе с новыми данными.</span></div></>}</section></div>}
  </div>;
};

const AgeGauge: React.FC<{ label: string; value: number | string; muted?: boolean; accent?: boolean }> = ({ label, value, muted, accent }) => <div className={`aida-age-gauge ${muted ? 'muted' : ''} ${accent ? 'accent' : ''}`}><span>{label}</span><div><strong>{value}</strong><small>{typeof value === 'number' ? 'лет' : 'нет данных'}</small></div></div>;
