import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Calendar,
  FileText,
  Filter,
  Heart,
  Pill,
  RefreshCw,
  Search,
  Smile,
  Stethoscope,
} from 'lucide-react';
import { ScreenId } from '../types';

export interface TimelineEventItem {
  id: string;
  type: 'lab_result'|'symptom'|'medication'|'diagnosis'|'measurement'|'sleep'|'workout'|'pregnancy'|'dental'|'appointment';
  timestamp: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: string;
  severity?: 'normal'|'attention'|'warning'|'critical';
  details?: Record<string, any>;
  sourceEntityId?: string;
  sourceType: string;
  cta?: { label: string; targetScreen?: string; targetId?: string };
}

interface TimelineScreenProps {
  onNavigate: (screen: ScreenId) => void;
  activeSubjectProfileId?: string;
}

const FILTERS = [
  { id:'lab_result', label:'Анализы', icon:FileText },
  { id:'measurement', label:'Измерения', icon:Activity },
  { id:'symptom', label:'Самочувствие', icon:Smile },
  { id:'medication', label:'Лекарства', icon:Pill },
  { id:'appointment', label:'Приёмы', icon:Stethoscope },
] as const;

const iconFor = (type: TimelineEventItem['type']) => {
  if (type === 'lab_result') return FileText;
  if (type === 'medication') return Pill;
  if (type === 'appointment') return Stethoscope;
  if (type === 'pregnancy') return Heart;
  if (type === 'symptom') return Smile;
  return Activity;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
};

export const TimelineScreen: React.FC<TimelineScreenProps> = ({ onNavigate, activeSubjectProfileId }) => {
  const [events,setEvents] = useState<TimelineEventItem[]>([]);
  const [isLoading,setIsLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [selectedTypes,setSelectedTypes] = useState<string[]>([]);
  const [period,setPeriod] = useState<'all'|'7d'|'30d'|'365d'>('all');
  const [search,setSearch] = useState('');
  const [nextCursor,setNextCursor] = useState<string|null>(null);
  const [hasMore,setHasMore] = useState(false);
  const [loadingMore,setLoadingMore] = useState(false);

  const load = async (more=false) => {
    more ? setLoadingMore(true) : setIsLoading(true);
    if (!more) setError(null);
    try {
      const params = new URLSearchParams();
      if (period !== 'all') {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : 365;
        const to = new Date();
        const from = new Date(); from.setDate(to.getDate()-days);
        params.set('from',from.toISOString()); params.set('to',to.toISOString());
      }
      if (selectedTypes.length) params.set('types',selectedTypes.join(','));
      if (more && nextCursor) params.set('cursor',nextCursor);
      params.set('limit','25');
      const profileId = activeSubjectProfileId || 'self';
      const data = await fetch(`/profiles/${profileId}/timeline?${params.toString()}`).then(r=>r.json());
      if (!data.success) throw new Error(data.message || 'Не удалось загрузить историю');
      setEvents(prev => more ? [...prev,...(data.events||[])] : (data.events||[]));
      setNextCursor(data.nextCursor || null); setHasMore(Boolean(data.hasMore));
    } catch (e:any) {
      setError(e?.message || 'Не удалось загрузить историю здоровья');
    } finally { setIsLoading(false); setLoadingMore(false); }
  };

  useEffect(()=>{ load(false); },[period,selectedTypes,activeSubjectProfileId]);

  const visible = useMemo(()=>events.filter(evt=>{
    const q=search.trim().toLowerCase();
    if(!q) return true;
    return [evt.title,evt.subtitle,evt.description,evt.category].some(v=>v?.toLowerCase().includes(q));
  }),[events,search]);

  const toggle=(id:string)=>setSelectedTypes(prev=>prev.includes(id)?prev.filter(v=>v!==id):[...prev,id]);

  return <div className="aida-timeline-page">
    <header className="aida-timeline-hero">
      <div><span className="aida-page-eyebrow"><Calendar/> История здоровья</span><h1>Всё важное — по времени</h1><p>Анализы, симптомы, приёмы препаратов, измерения и визиты собраны в одной хронологии. История показывает только реально сохранённые события.</p></div>
      <button className="aida-secondary-action" onClick={()=>load(false)} disabled={isLoading}><RefreshCw size={16} className={isLoading?'spin':''}/> Обновить</button>
    </header>

    <section className="aida-timeline-controls">
      <div className="aida-timeline-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по истории…"/></div>
      <div className="aida-range-switch">{(['all','7d','30d','365d'] as const).map(v=><button key={v} className={period===v?'active':''} onClick={()=>setPeriod(v)}>{v==='all'?'Всё':v==='7d'?'7 дней':v==='30d'?'30 дней':'Год'}</button>)}</div>
    </section>

    <section className="aida-timeline-filterbar"><div><Filter/><span>Фильтр</span></div><div>{FILTERS.map(item=>{const Icon=item.icon;return <button key={item.id} className={selectedTypes.includes(item.id)?'active':''} onClick={()=>toggle(item.id)}><Icon/>{item.label}</button>})}</div>{selectedTypes.length>0&&<button className="clear" onClick={()=>setSelectedTypes([])}>Сбросить</button>}</section>

    {isLoading ? <div className="aida-timeline-state"><RefreshCw className="spin"/><strong>Собираем историю…</strong></div> : error ? <div className="aida-timeline-state error"><AlertCircle/><strong>{error}</strong><button className="aida-secondary-action" onClick={()=>load(false)}>Повторить</button></div> : visible.length===0 ? <div className="aida-timeline-state"><Calendar/><strong>Событий пока нет</strong><span>Добавьте анализ, замер или запись самочувствия — и событие появится здесь.</span></div> : <section className="aida-timeline-list">{visible.map(evt=>{const Icon=iconFor(evt.type);return <article key={evt.id} className={evt.severity==='critical'?'critical':evt.severity==='warning'||evt.severity==='attention'?'attention':''}><div className="aida-timeline-dot"><Icon/></div><div className="aida-timeline-content"><div className="aida-timeline-meta"><span>{formatDate(evt.timestamp)}</span><small>{evt.category}</small></div><h3>{evt.title}</h3>{evt.subtitle&&<strong>{evt.subtitle}</strong>}{evt.description&&<p>{evt.description}</p>}{evt.severity&&evt.severity!=='normal'&&<span className="aida-timeline-badge">{evt.severity==='critical'?'Требует внимания':'Обратите внимание'}</span>}{evt.cta?.targetScreen&&<button onClick={()=>onNavigate(evt.cta!.targetScreen as ScreenId)}>{evt.cta.label}</button>}</div></article>})}{hasMore&&<button className="aida-timeline-more" onClick={()=>load(true)} disabled={loadingMore}>{loadingMore?'Загружаем…':'Показать ещё'}</button>}</section>}
  </div>;
};