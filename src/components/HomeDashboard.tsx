import React from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  Brain,
  CalendarDays,
  ChevronRight,
  FileText,
  FlaskConical,
  HeartPulse,
  Moon,
  Pill,
  Plus,
  Settings,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import {
  Appointment,
  BodySystem,
  DailyLogEntry,
  DashboardTab,
  DiaryEntry,
  MedicalDocument,
  PressureLogEntry,
  Reminder,
  ScreenId,
  StructuredHealthAnalysis,
  UserMentalPatterns,
  UserProfile,
} from '../types';
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

const MetricCard = ({
  title,
  icon,
  value,
  hint,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  value?: string;
  hint: string;
  onClick?: () => void;
}) => (
  <button type="button" className="aida-metric" onClick={onClick}>
    <div className="aida-metric-title">{icon}<b>{title}</b></div>
    <strong>{value || '—'}</strong>
    <small>{value ? hint : 'Нет данных'}</small>
    <div className="aida-mini-line" aria-hidden="true"><i/><i/><i/></div>
  </button>
);

const EmptyAction = ({ children }: { children: React.ReactNode }) => (
  <span className="aida-empty-action">{children}</span>
);

export default function HomeDashboard({
  user,
  documents = [],
  appointments = [],
  bodySystems = [],
  onNavigate,
  setActiveTab,
  reminders = [],
  dailyLogs = [],
  diaryEntries = [],
  pressureLogs = [],
  mentalPatterns,
  isLoadingAnalysis = false,
  fetchHealthAnalysis,
  aiAnalysis,
}: HomeDashboardProps) {
  const name = user.fullName?.trim().split(' ')[0] || 'пользователь';
  const profile = user as any;
  const latestLog = dailyLogs[0] as any;
  const latestPressure = pressureLogs[0] as any;

  const pulse = latestPressure?.pulse != null ? String(latestPressure.pulse) : undefined;
  const pressure = latestPressure?.systolic != null && latestPressure?.diastolic != null
    ? `${latestPressure.systolic}/${latestPressure.diastolic}`
    : undefined;
  const sleep = latestLog?.sleep != null ? `${latestLog.sleep} ч` : undefined;
  const energy = latestLog?.energy != null ? `${latestLog.energy}/10` : undefined;
  const mood = latestLog?.mood || undefined;
  const stress = latestLog?.stress != null ? `${latestLog.stress}/10` : undefined;
  const oxygen = latestLog?.spo2 != null ? `${latestLog.spo2}%` : undefined;

  const activeReminders = reminders.filter((r: any) => r?.isEnabled !== false);
  const upcomingAppointment = appointments[0] as any;
  const hasAnyData = documents.length > 0 || dailyLogs.length > 0 || pressureLogs.length > 0 || diaryEntries.length > 0;
  const hasEnoughForSummary = Boolean(aiAnalysis && hasAnyData);

  const cycleDay = profile?.cycleDay ?? profile?.cycle?.day ?? profile?.reproductiveHealth?.cycleDay;
  const cycleLabel = cycleDay ? `${cycleDay} день` : undefined;

  const knownSystems = bodySystems.filter((s: any) => s?.status || s?.score || s?.value).slice(0, 3);

  const nextActions = [
    !documents.length && { label: 'Загрузить последний анализ', action: () => setActiveTab('lab') },
    !pressureLogs.length && { label: 'Добавить первое измерение давления', action: () => onNavigate('pressure_diary') },
    !dailyLogs.length && { label: 'Заполнить короткий чек-ин дня', action: () => onNavigate('daily_checkin') },
    !reminders.length && { label: 'Добавить лекарство или напоминание', action: () => onNavigate('reminders') },
  ].filter(Boolean).slice(0, 3) as Array<{ label: string; action: () => void }>;

  return (
    <div className="aida-home">
      <header className="aida-home-header">
        <div>
          <p>Доброе утро, {name}</p>
          <h1>Ваше здоровье сегодня</h1>
          <span className="aida-home-subtitle">Только ваши реальные данные — без выдуманных показателей.</span>
        </div>
        <div className="aida-home-tools">
          <button className="aida-ai-chip" onClick={() => onNavigate('ai_chat')}>
            Аида <Sparkles size={17}/>
          </button>
          <button className="aida-tool" aria-label="Уведомления">
            <Bell size={19}/>{activeReminders.length > 0 && <i/>}
          </button>
          <button className="aida-tool" aria-label="Настройки" onClick={() => onNavigate('settings')}>
            <Settings size={19}/>
          </button>
        </div>
      </header>

      <div className="aida-dashboard-grid aida-dashboard-grid--expanded">
        <section className="aida-health-card">
          <div className="aida-card-label">Общая картина</div>
          <h2>{hasAnyData ? 'Данные собраны в одном месте' : 'Начнём с первых данных'}</h2>
          <div className="aida-health-ring">
            <svg viewBox="0 0 320 320" aria-hidden="true">
              <circle cx="160" cy="160" r="142"/>
              <circle className="ring-accent" cx="160" cy="160" r="142"/>
            </svg>
            <div>
              <strong>{hasAnyData ? '•' : '—'}</strong>
              <b>{hasAnyData ? 'Профиль формируется' : 'Нет данных'}</b>
              <small>{hasAnyData ? 'Аида объединяет ваши записи' : 'Добавьте первый показатель'}</small>
            </div>
          </div>
          <button className="aida-btn" onClick={() => setActiveTab('lab')}>
            <Plus size={18}/> Добавить данные
          </button>
        </section>

        <section className="aida-ai-summary">
          <div>
            <span className="aida-card-label">ИИ-наблюдение</span>
            <h2>Что изменилось</h2>
            <p>
              {hasEnoughForSummary
                ? 'Аида сформировала наблюдение на основе ваших записей. Откройте его, чтобы увидеть связи и изменения.'
                : 'Когда появится достаточно данных, здесь будут только подтверждённые изменения, связи и важные наблюдения.'}
            </p>
            <div className="aida-ai-summary-actions">
              {hasEnoughForSummary ? (
                <button onClick={() => onNavigate('ai_chat')}>Открыть наблюдение <ChevronRight size={16}/></button>
              ) : (
                <button onClick={fetchHealthAnalysis} disabled={isLoadingAnalysis || !hasAnyData}>
                  {isLoadingAnalysis ? 'Анализируем…' : 'Проверить данные'}
                </button>
              )}
            </div>
          </div>
          <div className="aida-pulse-orb"><Activity size={44}/></div>
        </section>

        <section className="aida-today-panel">
          <div className="aida-section-head">
            <div>
              <span className="aida-card-label">Сегодня</span>
              <h2>Важное на день</h2>
            </div>
          </div>
          <div className="aida-today-list">
            <button onClick={() => onNavigate('reminders')}>
              <span><Pill size={18}/><b>Лекарства</b></span>
              <strong>{activeReminders.length ? `${activeReminders.length} запланировано` : 'Не добавлены'}</strong>
              <ChevronRight size={16}/>
            </button>
            <button onClick={() => onNavigate('tasks')}>
              <span><CalendarDays size={18}/><b>Задачи</b></span>
              <strong>{upcomingAppointment ? 'Есть ближайшее событие' : 'Нет запланированных'}</strong>
              <ChevronRight size={16}/>
            </button>
            <button onClick={() => onNavigate('mental_diary')}>
              <span><Brain size={18}/><b>Самочувствие</b></span>
              <strong>{mood || 'Не отмечено'}</strong>
              <ChevronRight size={16}/>
            </button>
            {cycleLabel && (
              <button onClick={() => onNavigate('profile')}>
                <span><Target size={18}/><b>Цикл</b></span>
                <strong>{cycleLabel}</strong>
                <ChevronRight size={16}/>
              </button>
            )}
          </div>
        </section>

        <section className="aida-metrics-wrap">
          <div className="aida-section-head">
            <div>
              <span className="aida-card-label">Показатели</span>
              <h2>Последние значения</h2>
            </div>
          </div>
          <div className="aida-metrics">
            <MetricCard title="Пульс" icon={<HeartPulse size={18}/>} value={pulse} hint="уд/мин" onClick={() => onNavigate('pressure_diary')} />
            <MetricCard title="Давление" icon={<Activity size={18}/>} value={pressure} hint="мм рт. ст." onClick={() => onNavigate('pressure_diary')} />
            <MetricCard title="Кислород" icon={<Target size={18}/>} value={oxygen} hint="SpO₂" />
            <MetricCard title="Энергия" icon={<Zap size={18}/>} value={energy} hint="сегодня" onClick={() => onNavigate('daily_checkin')} />
            <MetricCard title="Сон" icon={<Moon size={18}/>} value={sleep} hint="последняя запись" onClick={() => onNavigate('mental_diary')} />
            <MetricCard title="Стресс" icon={<Brain size={18}/>} value={stress} hint="последняя отметка" onClick={() => onNavigate('mental_diary')} />
          </div>
        </section>

        <section className="aida-next-actions">
          <div className="aida-section-head">
            <div>
              <span className="aida-card-label">Следующий шаг</span>
              <h2>Что добавить дальше</h2>
            </div>
          </div>
          {nextActions.length ? (
            <div className="aida-action-list">
              {nextActions.map((item) => (
                <button key={item.label} onClick={item.action}>
                  <Plus size={17}/><span>{item.label}</span><ChevronRight size={16}/>
                </button>
              ))}
            </div>
          ) : (
            <p className="aida-muted-copy">Базовые данные уже добавлены. Продолжайте вести записи в удобном для вас ритме.</p>
          )}
        </section>

        <section className="aida-bottom-cards aida-bottom-cards--expanded">
          <article className="aida-detail-card">
            <div className="aida-detail-title"><span><FlaskConical size={18}/></span><b>Анализы</b></div>
            <strong>{documents.length ? `${documents.length} ${documents.length === 1 ? 'документ' : 'документов'}` : 'Нет данных'}</strong>
            <p>Результаты, динамика и расшифровка.</p>
            <button onClick={() => setActiveTab('lab')}>{documents.length ? 'Открыть' : 'Добавить'}</button>
          </article>

          <article className="aida-detail-card">
            <div className="aida-detail-title"><span><FileText size={18}/></span><b>История здоровья</b></div>
            <strong>{hasAnyData ? 'Есть записи' : 'Пока пусто'}</strong>
            <p>Анализы, симптомы, измерения и события в одной ленте.</p>
            <button onClick={() => onNavigate('history')}>{hasAnyData ? 'Открыть' : 'Начать'}</button>
          </article>

          <article className="aida-detail-card">
            <div className="aida-detail-title"><span><Brain size={18}/></span><b>Психика</b></div>
            <strong>{diaryEntries.length ? `${diaryEntries.length} записей` : 'Нет данных'}</strong>
            <p>Настроение, стресс, сон и триггеры.</p>
            <button onClick={() => onNavigate('mental_diary')}>{diaryEntries.length ? 'Открыть' : 'Добавить'}</button>
          </article>

          <article className="aida-detail-card">
            <div className="aida-detail-title"><span><HeartPulse size={18}/></span><b>Организм</b></div>
            <strong>{knownSystems.length ? `${knownSystems.length} систем с данными` : 'Нет данных'}</strong>
            <p>Системы организма и связанные показатели.</p>
            <button onClick={() => setActiveTab('body')}>{knownSystems.length ? 'Открыть' : 'Добавить данные'}</button>
          </article>
        </section>

        {!hasAnyData && (
          <section className="aida-empty-notice">
            <AlertCircle size={20}/>
            <div>
              <b>Аида пока ничего не предполагает о вашем здоровье.</b>
              <p>Добавьте данные вручную, загрузите анализ или подключите источник — после этого появятся персональные наблюдения.</p>
            </div>
            <EmptyAction>Без шаблонных значений</EmptyAction>
          </section>
        )}
      </div>
    </div>
  );
}
