import React from 'react';
import { Activity, Bell, Brain, Check, ChevronRight, FlaskConical, HeartPulse, Moon, Pill, Plus, Settings, Sparkles, Target, Zap } from 'lucide-react';
import { Appointment, BodySystem, DailyLogEntry, DashboardTab, DiaryEntry, MedicalDocument, PressureLogEntry, Reminder, ScreenId, StructuredHealthAnalysis, UserMentalPatterns, UserProfile } from '../types';
import './AidaRedesign.css';

export interface HomeDashboardProps {
  user: UserProfile;
  documents?: MedicalDocument[];
  appointments?: Appointment[];
  bodySystems?: BodySystem[];
  onNavigate: (screen: ScreenId) => void;
  setActiveTab: (tab: DashboardTab) => void;
  onOpenDoctorReport?: () => void;
  reminders?: Reminder[];
  setReminders?: React.Dispatch<React.SetStateAction<Reminder[]>>;
  dailyLogs?: DailyLogEntry[];
  diaryEntries?: DiaryEntry[];
  pressureLogs?: PressureLogEntry[];
  mentalPatterns?: UserMentalPatterns;
  isLoadingAnalysis?: boolean;
  fetchHealthAnalysis?: () => void;
  aiAnalysis?: StructuredHealthAnalysis | null;
}

const MetricCard = ({ title, icon, value, hint }: { title: string; icon: React.ReactNode; value?: string; hint: string }) => (
  <article className="aida-metric">
    <div className="aida-metric-title">{icon}<b>{title}</b></div>
    <strong>{value || '—'}</strong><small>{value ? hint : 'Нет данных'}</small>
    <div className="aida-mini-line"><i/><i/><i/></div>
  </article>
);

export default function HomeDashboard({
  user, documents = [], onNavigate, setActiveTab, reminders = [], dailyLogs = [],
  pressureLogs = [], isLoadingAnalysis = false, fetchHealthAnalysis, aiAnalysis,
}: HomeDashboardProps) {
  const name = user.fullName?.trim().split(' ')[0] || 'пользователь';
  const latestLog = dailyLogs[0] as any;
  const latestPressure = pressureLogs[0] as any;
  const pulse = latestPressure?.pulse ? String(latestPressure.pulse) : undefined;
  const sleep = latestLog?.sleep ? `${latestLog.sleep} ч` : undefined;
  const energy = latestLog?.energy !== undefined ? `${Math.round(Number(latestLog.energy) * 10)}%` : undefined;
  const hasProfileData = documents.length > 0 || dailyLogs.length > 0 || pressureLogs.length > 0;

  return (
    <div className="aida-home">
      <header className="aida-home-header">
        <div><p>Доброе утро, {name}</p><h1>Состояние организма</h1></div>
        <div className="aida-home-tools">
          <button className="aida-ai-chip" onClick={() => onNavigate('ai_chat')}>ИИ-итог дня <Sparkles size={17}/></button>
          <button className="aida-tool" aria-label="Уведомления"><Bell size={19}/>{reminders.length > 0 && <i/>}</button>
          <button className="aida-tool" aria-label="Настройки" onClick={() => onNavigate('settings')}><Settings size={19}/></button>
        </div>
      </header>

      <div className="aida-dashboard-grid">
        <section className="aida-health-card">
          <div className="aida-card-label">Общий профиль</div>
          <h2>{hasProfileData ? 'Профиль формируется' : 'Данные ещё не добавлены'}</h2>
          <div className="aida-health-ring">
            <svg viewBox="0 0 320 320" aria-hidden="true"><circle cx="160" cy="160" r="142"/><circle className="ring-accent" cx="160" cy="160" r="142"/></svg>
            <div><strong>{hasProfileData ? '…' : '—'}</strong><b>{hasProfileData ? 'Идёт анализ' : 'Нет данных'}</b><small>{hasProfileData ? 'Аида объединяет показатели' : 'Добавьте первые показатели'}</small></div>
          </div>
          <button className="aida-btn" onClick={() => setActiveTab('lab')}><Plus size={18}/> Добавить данные</button>
        </section>

        <section className="aida-ai-summary">
          <div><h2>ИИ-итог дня</h2><p>{aiAnalysis ? 'Персональное наблюдение сформировано на основе ваших данных.' : 'Аида сформирует наблюдение, когда появятся первые данные о сне, симптомах и анализах.'}</p>
          {aiAnalysis && <button onClick={() => onNavigate('ai_chat')}>Открыть наблюдение <ChevronRight size={16}/></button>}</div>
          <div className="aida-pulse-orb"><Activity size={44}/></div>
        </section>

        <div className="aida-metrics">
          <MetricCard title="Пульс" icon={<HeartPulse size={18}/>} value={pulse} hint="уд/мин" />
          <MetricCard title="Кислород" icon={<Target size={18}/>} hint="SpO₂" />
          <MetricCard title="Энергия" icon={<Zap size={18}/>} value={energy} hint="Сегодня" />
        </div>

        <section className="aida-bottom-cards">
          <article className="aida-detail-card">
            <div className="aida-detail-title"><span><Moon size={18}/></span><b>Сон</b></div>
            <strong>{sleep || 'Нет данных'}</strong><p>Длительность и качество</p>
            <button onClick={() => onNavigate('mental_diary')}>{sleep ? 'Подробнее' : 'Добавить'}</button>
          </article>
          <article className="aida-detail-card">
            <div className="aida-detail-title"><span><FlaskConical size={18}/></span><b>Анализы</b></div>
            <strong>{documents.length ? `${documents.length} ${documents.length === 1 ? 'документ' : 'документов'}` : 'Нет данных'}</strong><p>Показатели и динамика</p>
            <button onClick={() => setActiveTab('lab')}>{documents.length ? 'Смотреть' : 'Добавить'}</button>
          </article>
          <article className="aida-detail-card aida-med-card">
            <div className="aida-detail-title"><span><Pill size={18}/></span><b>Лекарства</b></div>
            <strong>{reminders.length ? `${reminders.length} на сегодня` : 'Нет данных'}</strong><p>Приёмы и напоминания</p>
            <button onClick={() => onNavigate('reminders')}>{reminders.length ? 'Открыть' : 'Добавить'}</button>
            <div className="aida-check-ring"><Check size={35}/></div>
          </article>
        </section>
      </div>
    </div>
  );
}
