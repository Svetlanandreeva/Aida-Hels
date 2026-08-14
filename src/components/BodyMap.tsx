import React, { useState } from 'react';
import { Activity, AlertCircle, Apple, Bone, Brain, CheckCircle2, ChevronRight, Droplets, Heart, Info, Layers, Shield, Sparkles, Wind, Zap } from 'lucide-react';
import { BodySystem, DailyLogEntry, MedicalDocument, PressureLogEntry, UserProfile } from '../types';
import { calculateOrganismAge } from '../utils/calculateOrganismAge';
import { OrganismAgeBlock } from './OrganismAgeBlock';

interface BodyMapProps { systems: BodySystem[]; onSelectSystem: (system: BodySystem) => void; onOpenOverviewModal?: () => void; user?: UserProfile | null; documents?: MedicalDocument[]; pressureLogs?: PressureLogEntry[]; dailyLogs?: DailyLogEntry[]; onNavigate?: (screen: any) => void; }

const iconFor = (name: string) => {
  const props = { size: 21, strokeWidth: 1.8 };
  switch (name?.toLowerCase()) {
    case 'heart': case 'cardio': return <Heart {...props} />;
    case 'brain': case 'nervous': return <Brain {...props} />;
    case 'lungs': case 'wind': case 'respiratory': return <Wind {...props} />;
    case 'digestive': case 'apple': return <Apple {...props} />;
    case 'endocrine': case 'zap': return <Zap {...props} />;
    case 'immune': case 'shield': return <Shield {...props} />;
    case 'urinary': case 'droplets': return <Droplets {...props} />;
    case 'bone': case 'musculoskeletal': return <Bone {...props} />;
    default: return <Activity {...props} />;
  }
};

export const BodyMap: React.FC<BodyMapProps> = ({ systems, onSelectSystem, onOpenOverviewModal, user, documents = [], pressureLogs = [], dailyLogs = [], onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'age' | 'systems'>('age');
  const [filter, setFilter] = useState<'all' | 'attention' | 'norm'>('all');
  const data = calculateOrganismAge(user, documents, pressureLogs, dailyLogs);
  const normCount = systems.filter((s) => s.status === 'norm').length;
  const attentionCount = systems.length - normCount;
  const filtered = systems.filter((s) => filter === 'all' || (filter === 'norm' ? s.status === 'norm' : s.status !== 'norm'));

  return <section className="aida-organism">
    <header className="aida-organism-header">
      <div><span className="aida-page-eyebrow"><Activity /> Раздел «Организм»</span><h1>Здоровье организма — в ясной картине</h1><p>Аида объединяет анализы, давление и самочувствие, чтобы показать состояние ключевых систем.</p></div>
      <div className="aida-segmented" aria-label="Вид раздела">
        <button className={activeTab === 'age' ? 'active' : ''} onClick={() => setActiveTab('age')}><Sparkles /> Возраст организма</button>
        <button className={activeTab === 'systems' ? 'active' : ''} onClick={() => setActiveTab('systems')}><Layers /> Карта систем</button>
      </div>
    </header>

    {activeTab === 'age' ? <OrganismAgeBlock data={data} onOpenAddMetrics={() => onNavigate?.('dashboard')} /> : <div className="aida-systems-view">
      <div className="aida-systems-toolbar"><div className="aida-filter-tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Все · {systems.length}</button>
        <button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}><AlertCircle /> Внимание · {attentionCount}</button>
        <button className={filter === 'norm' ? 'active' : ''} onClick={() => setFilter('norm')}><CheckCircle2 /> В норме · {normCount}</button>
      </div>{onOpenOverviewModal && <button className="aida-method-button" onClick={onOpenOverviewModal}><Info /> Как формируется карта</button>}</div>
      <div className="aida-systems-grid">{filtered.map((system) => {
        const ok = system.status === 'norm';
        return <button key={system.id} className="aida-system-card" onClick={() => onSelectSystem(system)}>
          <div className="aida-system-card-top"><span className="aida-system-icon">{iconFor(system.iconName)}</span><span className={`aida-system-status ${ok ? 'ok' : 'attention'}`}>{ok ? 'В норме' : 'Наблюдение'}</span></div>
          <h3>{system.name}</h3><p>{system.description}</p>
          <div className="aida-system-score"><span><i style={{ width: `${Math.max(8, system.score)}%` }} /></span><strong>{system.score}%</strong></div>
          <footer><span>{system.deviationsCount ? `${system.deviationsCount} маркера требуют внимания` : 'Отклонений не выявлено'}</span><ChevronRight /></footer>
        </button>;
      })}</div>
    </div>}
  </section>;
};
