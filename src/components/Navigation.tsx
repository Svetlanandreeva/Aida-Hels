import React from 'react';
import { Activity, Brain, CalendarDays, FlaskConical, HeartPulse, History, Home, LogOut, MessageCircle, Moon, Pill, RefreshCw, Settings, SlidersHorizontal, User, Watch } from 'lucide-react';
import { DashboardTab, MedicalDocument, Reminder, ScreenId, UserProfile } from '../types';
import { SubjectProfile } from '../utils/subjectProfiles';
import { AIDA_LOGO } from '../assets/aidaBrandAssets';
import './AidaRedesign.css';

interface NavigationProps {
  currentScreen: ScreenId;
  setCurrentScreen: (screen: ScreenId) => void;
  dashboardTab: DashboardTab;
  setDashboardTab: (tab: DashboardTab) => void;
  user: UserProfile;
  onLogout: () => void;
  onOpenTutorial?: () => void;
  activeRemindersCount?: number;
  reminders?: Reminder[];
  documents?: MedicalDocument[];
  onRefreshAnalysis?: () => void;
  isLoadingAnalysis?: boolean;
  subjectProfiles?: SubjectProfile[];
  activeSubjectProfileId?: string;
  onSelectSubjectProfile?: (subjectProfileId: string) => void;
  onAddSubjectProfile?: (newProfile: Omit<SubjectProfile, 'id' | 'accountId'>) => void;
  onDeleteSubjectProfile?: (subjectProfileId: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentScreen, setCurrentScreen, setDashboardTab, user, onLogout,
  activeRemindersCount = 0, onRefreshAnalysis, isLoadingAnalysis = false,
}) => {
  const go = (screen: ScreenId, tab?: DashboardTab) => {
    if (tab) setDashboardTab(tab);
    setCurrentScreen(screen);
  };
  const items = [
    ['Главная', Home, 'dashboard', 'main'],
    ['Анализы', FlaskConical, 'dashboard', 'lab'],
    ['Организм', Activity, 'body_map'],
    ['Психика', Brain, 'mental_diary'],
    ['Давление', HeartPulse, 'pressure_diary'],
    ['Сон', Moon, 'mental_diary'],
    ['Задачи', CalendarDays, 'reminders'],
    ['Лекарства', Pill, 'reminders'],
    ['Аида', MessageCircle, 'ai_chat'],
    ['История', History, 'timeline'],
  ] as const;
  const name = user.fullName || user.email || 'Пользователь';
  return (
    <>
      <aside className="aida-sidebar">
        <button className="aida-sidebar-logo" onClick={() => go('dashboard','main')}><img src={AIDA_LOGO} alt="Аида"/></button>
        <nav>
          {items.map(([label,Icon,screen,tab]) => {
            const active = currentScreen === screen && (screen !== 'dashboard' || label === 'Главная');
            return <button className={active ? 'active' : ''} key={label} onClick={() => go(screen as ScreenId, tab as DashboardTab | undefined)}><Icon size={19}/><span>{label}</span>{label === 'Задачи' && activeRemindersCount > 0 && <b>{activeRemindersCount}</b>}</button>;
          })}
        </nav>
        <div className="aida-sidebar-secondary">
          <button onClick={() => go('integrations')}><Watch size={18}/><span>Синхронизация</span></button>
          <button onClick={() => onRefreshAnalysis?.()}><RefreshCw size={18} className={isLoadingAnalysis ? 'spin' : ''}/><span>Обновить анализ</span></button>
        </div>
        <button className="aida-profile-card" onClick={() => go('profile')}>
          <i>{name.slice(0,2).toUpperCase()}</i><span><b>{name}</b><small>Профиль</small></span><User size={18}/>
        </button>
        <div className="aida-sidebar-footer"><button onClick={() => go('settings')}><Settings size={18}/> Настройки</button><button onClick={onLogout}><LogOut size={18}/> Выйти</button></div>
      </aside>
      <nav className="aida-mobile-nav">
        {items.slice(0,5).map(([label,Icon,screen,tab]) => <button key={label} className={currentScreen===screen?'active':''} onClick={()=>go(screen as ScreenId,tab as DashboardTab|undefined)}><Icon size={20}/><span>{label}</span></button>)}
      </nav>
    </>
  );
};
