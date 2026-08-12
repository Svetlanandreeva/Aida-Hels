import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId, DashboardTab, UserProfile, Reminder, MedicalDocument } from '../types';
import { SubjectProfile, SubjectProfileType } from '../utils/subjectProfiles';
import { SubjectProfileSwitcher } from './SubjectProfileSwitcher';
import {
  Heart,
  LayoutDashboard,
  FileText,
  MessageSquare,
  Activity,
  Bell,
  BellOff,
  Pill,
  Brain,
  ChevronDown,
  Sparkles,
  CheckSquare,
  Settings,
  User,
  Check,
  X,
  Plus,
  Home,
  UserRound,
  PersonStanding,
  RefreshCw,
  Calendar,
  Watch,
  ShieldCheck,
} from 'lucide-react';

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
  currentScreen,
  setCurrentScreen,
  dashboardTab,
  setDashboardTab,
  user,
  onLogout,
  onOpenTutorial,
  activeRemindersCount,
  reminders = [],
  documents = [],
  onRefreshAnalysis,
  isLoadingAnalysis = false,
  subjectProfiles = [],
  activeSubjectProfileId = '',
  onSelectSubjectProfile,
  onAddSubjectProfile,
  onDeleteSubjectProfile,
}) => {
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>([]);
  const [showOrganismMenu, setShowOrganismMenu] = useState(false);

  // Build dynamic real notifications from user data
  const dynamicNotifs = React.useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      time: string;
      message: string;
      type: 'reminder' | 'document' | 'system';
      targetScreen?: ScreenId;
    }> = [];

    // 1. Active Enabled Reminders
    reminders
      .filter((r) => r.isEnabled)
      .slice(0, 5)
      .forEach((r) => {
        items.push({
          id: `rem-${r.id}`,
          title: r.title,
          time: r.time || 'Сегодня',
          message: r.dosage ? `Дозировка: ${r.dosage}` : (r.notes || 'Приём нутрицевтиков/лекарства'),
          type: 'reminder',
          targetScreen: 'reminders',
        });
      });

    // 2. Uploaded & Processed Documents
    documents.slice(0, 3).forEach((d) => {
      items.push({
        id: `doc-${d.id}`,
        title: d.title,
        time: d.date || 'Обработано',
        message: `Результат исследования (${d.categoryLabel || 'Анализы'}) успешного разобран ИИ`,
        type: 'document',
        targetScreen: 'dashboard',
      });
    });

    // 3. System Daily Check-in Notification if questionnaire/check-in prompt active
    items.push({
      id: 'sys-checkin',
      title: 'Дневной опрос самочувствия',
      time: 'Сегодня',
      message: 'Отметьте состояние и уровень энергии для точности расчётов',
      type: 'system',
      targetScreen: 'daily_checkin',
    });

    return items.filter((item) => !dismissedNotifIds.includes(item.id));
  }, [reminders, documents, dismissedNotifIds]);

  const unreadCount = dynamicNotifs.length;

  const isAppView = [
    'dashboard',
    'profile',
    'settings',
    'ai_chat',
    'daily_checkin',
    'body_map',
    'reminders',
    'mental_diary',
    'pressure_diary',
  ].includes(currentScreen);

  const userName = user?.fullName ? user.fullName.split(' ')[0] : 'Пользователь';

  const navTabs = React.useMemo(
    () => [
      { id: 'home', label: 'Главная', icon: Home },
      { id: 'mental', label: 'Психика', icon: Brain },
      { id: 'body', label: 'Организм', icon: UserRound },
      { id: 'aida', label: 'Аида', icon: Sparkles },
      { id: 'profile', label: 'Профиль', icon: User },
    ],
    []
  );

  const activeIndex = React.useMemo(() => {
    if (currentScreen === 'dashboard') return 0;
    if (currentScreen === 'mental_diary') return 1;
    if (['body_map', 'pressure_diary'].includes(currentScreen)) return 2;
    if (currentScreen === 'ai_chat') return 3;
    if (['profile', 'settings'].includes(currentScreen)) return 4;
    return 0;
  }, [currentScreen]);

  return (
    <>
      {/* TOP NAVIGATION (ВЕРХНЯЯ НАВИГАЦИЯ) */}
      <header className="sticky top-0 z-[100] bg-[#050711]/80 backdrop-blur-2xl border-b border-[#99AEFF]/15 h-16 sm:h-20 px-3 sm:px-12">
        <div className="max-w-[1320px] mx-auto h-full flex items-center justify-between gap-2">
          {/* LEFT: LOGO + TITLE + EYEBROW */}
          <button
            onClick={() => {
              setCurrentScreen('dashboard');
              setDashboardTab('main');
            }}
            className="flex items-center gap-3 group text-left cursor-pointer shrink-0"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#734CFF]/15 border border-[#9E7CFF]/40 flex items-center justify-center text-[#C8BAFF] shadow-[0_0_20px_rgba(116,72,255,0.2)] group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 fill-[#8968FF] text-[#8968FF]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 hidden sm:inline">
                Персональный ИИ-мониторинг
              </span>
              <span className="font-extrabold text-white tracking-tight text-lg sm:text-xl">
                Аида
              </span>
            </div>
          </button>



          {/* CENTER/SUBJECT SWITCHER */}
          {subjectProfiles && subjectProfiles.length > 0 && onSelectSubjectProfile && (
            <div className="mx-2 shrink-0">
              <SubjectProfileSwitcher
                profiles={subjectProfiles}
                activeSubjectProfileId={activeSubjectProfileId}
                onSelectProfile={onSelectSubjectProfile}
                onAddProfile={onAddSubjectProfile || (() => {})}
                onDeleteProfile={onDeleteSubjectProfile || (() => {})}
                accountEmail={user?.email}
                accountFullName={user?.fullName}
              />
            </div>
          )}

          {/* RIGHT: REFRESH AI ANALYSIS + SETTINGS + NOTIFICATIONS + USER AVATAR */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* WEARABLES & INTEGRATIONS BUTTON */}
            <button
              onClick={() => setCurrentScreen('integrations')}
              className={`px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-2xl bg-[#111827] border transition-all cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5 ${
                currentScreen === 'integrations'
                  ? 'border-[#3DD9C5] text-[#3DD9C5] shadow-[0_0_12px_rgba(61,217,197,0.2)]'
                  : 'border-white/[0.06] text-white/80 hover:text-white hover:border-[#3DD9C5]/40 hover:bg-[#151d2e]'
              }`}
              title="Интеграции и носимые устройства (Apple Health, Health Connect, Garmin, Oura)"
            >
              <Watch className="w-4 h-4 text-[#3DD9C5]" />
              <span className="text-xs font-semibold text-white/90 hidden md:inline">
                Гаджеты
              </span>
            </button>

            {/* TIMELINE BUTTON */}
            <button
              onClick={() => setCurrentScreen('timeline')}
              className={`px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-2xl bg-[#111827] border transition-all cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5 ${
                currentScreen === 'timeline'
                  ? 'border-[#3DD9C5] text-[#3DD9C5] shadow-[0_0_12px_rgba(61,217,197,0.2)]'
                  : 'border-white/[0.06] text-white/80 hover:text-white hover:border-[#3DD9C5]/40 hover:bg-[#151d2e]'
              }`}
              title="История здоровья (Timeline)"
            >
              <Calendar className="w-4 h-4 text-[#3DD9C5]" />
              <span className="text-xs font-semibold text-white/90 hidden md:inline">
                История
              </span>
            </button>

            {/* REFRESH AI ANALYSIS BUTTON */}
            <button
              onClick={() => onRefreshAnalysis?.()}
              disabled={isLoadingAnalysis}
              className={`px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-2xl bg-[#111827] border transition-all cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5 ${
                isLoadingAnalysis
                  ? 'border-[#3DD9C5]/50 text-[#3DD9C5] opacity-80'
                  : 'border-white/[0.06] text-white/80 hover:text-white hover:border-[#3DD9C5]/40 hover:bg-[#151d2e]'
              }`}
              title="Обновить ИИ-анализ"
            >
              <RefreshCw className={`w-4 h-4 text-[#3DD9C5] ${isLoadingAnalysis ? 'animate-spin' : ''}`} />
              <span className="text-xs font-semibold text-white/90 hidden md:inline">
                {isLoadingAnalysis ? 'Обновляем...' : 'Обновить анализ'}
              </span>
            </button>

            {/* PERMISSIONS & ZERO TRUST SECURITY BUTTON */}
            <button
              onClick={() => setCurrentScreen('permissions')}
              className={`p-2 sm:p-2.5 rounded-2xl bg-[#111827] border transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                currentScreen === 'permissions'
                  ? 'border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                  : 'border-white/[0.06] text-white/70 hover:text-white hover:border-white/20'
              }`}
              title="Центр прав доступа и семейной безопасности (Deny by Default)"
            >
              <ShieldCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* SETTINGS BUTTON */}
            <button
              onClick={() => setCurrentScreen('settings')}
              className={`p-2 sm:p-2.5 rounded-2xl bg-[#111827] border transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                currentScreen === 'settings'
                  ? 'border-[#8B5CF6] text-[#8B5CF6] shadow-[0_0_12px_rgba(139,92,246,0.2)]'
                  : 'border-white/[0.06] text-white/70 hover:text-white hover:border-white/20'
              }`}
              title="Настройки"
            >
              <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* NOTIFICATION CENTER DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setShowBellDropdown(!showBellDropdown)}
                className={`relative p-2 sm:p-2.5 rounded-2xl bg-[#111827] border transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                  showBellDropdown
                    ? 'border-[#3DD9C5] text-[#3DD9C5] shadow-[0_0_12px_rgba(61,217,197,0.2)]'
                    : 'border-white/[0.06] text-white/70 hover:text-white hover:border-white/20'
                }`}
                title="Центр уведомлений"
              >
                <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#3DD9C5] animate-pulse" />
                )}
              </button>

              {showBellDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-[105]"
                    onClick={() => setShowBellDropdown(false)}
                  />
                  <div className="fixed sm:absolute top-16 sm:top-full left-3 right-3 sm:left-auto sm:right-0 mt-2 w-auto sm:w-96 bg-[#111827] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-4 z-[110] space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2 font-bold text-white text-sm">
                        <Bell className="w-4 h-4 text-[#3DD9C5]" />
                        <span>Центр уведомлений</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#3DD9C5]/10 text-[#3DD9C5] font-bold text-[10px]">
                        {unreadCount > 0 ? `Новых: ${unreadCount}` : 'Нет новых'}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {dynamicNotifs.length === 0 ? (
                        <div className="py-6 px-4 text-center space-y-2 text-white/50">
                          <BellOff className="w-7 h-7 mx-auto text-white/20" />
                          <p className="font-semibold text-xs text-white/70">Новых уведомлений нет</p>
                          <p className="text-[11px] text-white/40">
                            Все текущие напоминания и отчёты просмотрены
                          </p>
                        </div>
                      ) : (
                        dynamicNotifs.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 bg-[#090B10] hover:bg-[#151D2E] rounded-xl border border-white/[0.04] space-y-1 relative group transition-colors"
                          >
                            <div className="flex items-center justify-between font-bold text-white text-xs pr-6">
                              <span
                                className="cursor-pointer hover:text-[#3DD9C5] transition-colors flex items-center gap-1.5"
                                onClick={() => {
                                  if (item.targetScreen) {
                                    setCurrentScreen(item.targetScreen);
                                    setShowBellDropdown(false);
                                  }
                                }}
                              >
                                {item.type === 'reminder' && <Pill className="w-3.5 h-3.5 text-[#3DD9C5]" />}
                                {item.type === 'document' && <FileText className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                                {item.type === 'system' && <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                                <span>{item.title}</span>
                              </span>
                              <span className="text-[10px] text-white/40 shrink-0">{item.time}</span>
                            </div>
                            <p className="text-white/60 text-[11px] leading-relaxed">{item.message}</p>

                            <button
                              onClick={() => setDismissedNotifIds((prev) => [...prev, item.id])}
                              className="absolute top-2 right-2 p-1 text-white/30 hover:text-white rounded transition-colors cursor-pointer"
                              title="Скрыть уведомление"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setShowBellDropdown(false);
                        setCurrentScreen('settings');
                      }}
                      className="w-full py-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Управление уведомлениями в Настройках</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setCurrentScreen('profile')}
              className="flex items-center gap-2 sm:gap-2.5 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1.5 rounded-2xl bg-[#111827] border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer text-left min-h-[40px]"
              title="Профиль"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#3DD9C5] text-[#090B10] font-black text-xs sm:text-sm flex items-center justify-center shadow-md">
                {userName.charAt(0)}
              </div>
              <span className="text-xs sm:text-sm font-medium text-white hidden sm:inline">{userName}</span>
            </button>
          </div>
        </div>
      </header>

      {/* FLOATING BOTTOM MENU (MOVING ACTIVE TAB INDICATOR) */}
      {isAppView && (
        <div className="bottom-nav-wrapper">
          {/* SATELLITE BUTTONS ARC FOR ORGANISM */}
          <AnimatePresence>
            {showOrganismMenu && (
              <div className="absolute -top-[105px] left-1/2 -translate-x-1/2 w-[240px] h-[100px] pointer-events-none z-30">
                {/* Top Center Satellite: Давление */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.5, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: 12 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                  type="button"
                  onClick={() => {
                    setCurrentScreen('pressure_diary');
                    setShowOrganismMenu(false);
                  }}
                  className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-0 flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white bg-[radial-gradient(circle_at_50%_35%,rgba(137,104,255,0.35)_0%,rgba(10,14,22,0.96)_80%)] backdrop-blur-2xl border border-[#8968FF]/40 shadow-[inset_0_1px_10px_rgba(137,104,255,0.4),0_8px_18px_rgba(0,0,0,0.65)] group-hover:border-[#8968FF]/80 group-hover:shadow-[inset_0_1px_14px_rgba(137,104,255,0.6),0_0_12px_rgba(137,104,255,0.35)] group-hover:-translate-y-0.5 active:scale-95 transition-all duration-200">
                    <Activity className="w-5 h-5 text-[#8968FF] group-hover:scale-110 transition-transform" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-medium tracking-tight text-gray-200 mt-1 whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    Давление
                  </span>
                </motion.button>

                {/* Left Satellite: Психика */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.5, x: 14, y: 14 }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, x: 12, y: 12 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 24, delay: 0.02 }}
                  type="button"
                  onClick={() => {
                    setCurrentScreen('mental_diary');
                    setShowOrganismMenu(false);
                  }}
                  className="pointer-events-auto absolute left-2 top-[24px] flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white bg-[radial-gradient(circle_at_50%_35%,rgba(77,235,255,0.35)_0%,rgba(10,14,22,0.96)_80%)] backdrop-blur-2xl border border-[#4DEBFF]/40 shadow-[inset_0_1px_10px_rgba(77,235,255,0.4),0_8px_18px_rgba(0,0,0,0.65)] group-hover:border-[#4DEBFF]/80 group-hover:shadow-[inset_0_1px_14px_rgba(77,235,255,0.6),0_0_12px_rgba(77,235,255,0.35)] group-hover:-translate-y-0.5 active:scale-95 transition-all duration-200">
                    <Brain className="w-5 h-5 text-[#4DEBFF] group-hover:scale-110 transition-transform" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-medium tracking-tight text-gray-200 mt-1 whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    Психика
                  </span>
                </motion.button>

                {/* Right Satellite: Тело */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.5, x: -14, y: 14 }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, x: -12, y: 12 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 24, delay: 0.04 }}
                  type="button"
                  onClick={() => {
                    setCurrentScreen('body_map');
                    setShowOrganismMenu(false);
                  }}
                  className="pointer-events-auto absolute right-2 top-[24px] flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white bg-[radial-gradient(circle_at_50%_35%,rgba(52,245,164,0.35)_0%,rgba(10,14,22,0.96)_80%)] backdrop-blur-2xl border border-[#34F5A4]/40 shadow-[inset_0_1px_10px_rgba(52,245,164,0.4),0_8px_18px_rgba(0,0,0,0.65)] group-hover:border-[#34F5A4]/80 group-hover:shadow-[inset_0_1px_14px_rgba(52,245,164,0.6),0_0_12px_rgba(52,245,164,0.35)] group-hover:-translate-y-0.5 active:scale-95 transition-all duration-200">
                    <PersonStanding className="w-5 h-5 text-[#34F5A4] group-hover:scale-110 transition-transform" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-medium tracking-tight text-gray-200 mt-1 whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    Тело
                  </span>
                </motion.button>
              </div>
            )}
          </AnimatePresence>

          <nav
            className="bottom-nav"
            style={
              {
                '--active-index': activeIndex,
                '--tabs-count': navTabs.length,
              } as React.CSSProperties
            }
          >
            {/* MOVING ACTIVE ORB */}
            <div className="active-orb">
              {(() => {
                const ActiveIcon = navTabs[activeIndex]?.icon || Home;
                return <ActiveIcon size={20} strokeWidth={2} />;
              })()}
            </div>

            {navTabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeIndex === idx;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setShowOrganismMenu(false);
                    if (tab.id === 'home') {
                      setCurrentScreen('dashboard');
                      setDashboardTab('main');
                    } else if (tab.id === 'mental') {
                      setCurrentScreen('mental_diary');
                    } else if (tab.id === 'body') {
                      setCurrentScreen('body_map');
                    } else if (tab.id === 'aida') {
                      setCurrentScreen('ai_chat');
                    } else if (tab.id === 'profile') {
                      setCurrentScreen('profile');
                    }
                  }}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <div className="nav-icon">
                    {!isActive && <Icon size={20} strokeWidth={1.8} />}
                  </div>
                  <span className="text-[11px] font-medium tracking-tight text-white/80">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
};

