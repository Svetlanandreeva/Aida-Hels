import React, { useState } from 'react';
import { ScreenId, DashboardTab, UserProfile, Reminder, MedicalDocument } from '../types';
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
}) => {
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>([]);

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

  // Check center tabs active state
  const isTabActive = (tabKey: string) => {
    if (tabKey === 'main') return currentScreen === 'dashboard' && dashboardTab === 'main';
    if (tabKey === 'diary') return currentScreen === 'mental_diary';
    if (tabKey === 'pressure_diary') return currentScreen === 'pressure_diary';
    if (tabKey === 'analytics') return currentScreen === 'dashboard' && dashboardTab === 'lab';
    if (tabKey === 'body_map') return currentScreen === 'body_map';
    if (tabKey === 'ai_chat') return currentScreen === 'ai_chat';
    return false;
  };

  return (
    <>
      {/* TOP NAVIGATION (ВЕРХНЯЯ НАВИГАЦИЯ) */}
      <header className="sticky top-0 z-40 bg-[#050711]/80 backdrop-blur-2xl border-b border-[#99AEFF]/15 h-16 sm:h-20 px-3 sm:px-12 overflow-hidden">
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



          {/* RIGHT: NOTIFICATIONS + SETTINGS + USER AVATAR + NAME + ARROW */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* NOTIFICATION CENTER DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setShowBellDropdown(!showBellDropdown)}
                className={`relative p-2 sm:p-2.5 rounded-2xl bg-[#0B1320] border transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                  showBellDropdown
                    ? 'border-[#34F5A4] text-[#34F5A4] shadow-[0_0_12px_rgba(52,245,164,0.2)]'
                    : 'border-white/[0.06] text-white/70 hover:text-white hover:border-white/20'
                }`}
                title="Центр уведомлений"
              >
                <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#34F5A4] animate-pulse" />
                )}
              </button>

              {showBellDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0B1320] border border-white/10 rounded-2xl shadow-2xl p-4 z-50 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <Bell className="w-4 h-4 text-[#34F5A4]" />
                      <span>Центр уведомлений</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#34F5A4]/10 text-[#34F5A4] font-bold text-[10px]">
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
                          className="p-2.5 bg-[#101A28] hover:bg-[#142133] rounded-xl border border-white/[0.04] space-y-1 relative group transition-colors"
                        >
                          <div className="flex items-center justify-between font-bold text-white text-xs pr-6">
                            <span
                              className="cursor-pointer hover:text-[#34F5A4] transition-colors flex items-center gap-1.5"
                              onClick={() => {
                                if (item.targetScreen) {
                                  setCurrentScreen(item.targetScreen);
                                  setShowBellDropdown(false);
                                }
                              }}
                            >
                              {item.type === 'reminder' && <Pill className="w-3.5 h-3.5 text-[#34F5A4]" />}
                              {item.type === 'document' && <FileText className="w-3.5 h-3.5 text-[#4DEBFF]" />}
                              {item.type === 'system' && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
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
              )}
            </div>

            {onOpenTutorial && (
              <button
                onClick={onOpenTutorial}
                className="hidden sm:flex px-2.5 sm:px-3 py-2 rounded-2xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 hover:bg-[#34F5A4]/20 text-[#34F5A4] transition-all cursor-pointer min-h-[40px] items-center justify-center gap-1.5 text-xs font-bold"
                title="Обучение по функционалу"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Обучение</span>
              </button>
            )}

            <button
              onClick={() => setCurrentScreen('settings')}
              className={`p-2 sm:p-2.5 rounded-2xl bg-[#0B1320] border transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                currentScreen === 'settings'
                  ? 'border-[#34F5A4] text-[#34F5A4] shadow-[0_0_12px_rgba(52,245,164,0.2)]'
                  : 'border-white/[0.06] text-white/70 hover:text-white hover:border-white/20'
              }`}
              title="Настройки"
            >
              <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            <button
              onClick={() => setCurrentScreen('profile')}
              className="flex items-center gap-2 sm:gap-3 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1.5 rounded-2xl bg-[#0B1320] border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer text-left min-h-[40px]"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-[#34F5A4] to-[#4DEBFF] text-[#050A12] font-black text-xs sm:text-sm flex items-center justify-center shadow-md">
                {userName.charAt(0)}
              </div>
              <span className="text-xs sm:text-sm font-medium text-white hidden sm:inline">{userName}</span>
              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/40" />
            </button>
          </div>
        </div>
      </header>

      {/* FLOATING BOTTOM MENU (НИЖНЕЕ МЕНЮ - СТЕКЛЯННОЕ, ПЛАВАЮЩЕЕ) */}
      {isAppView && (
        <nav
          aria-label="Мобильная навигация"
          className="fixed bottom-2 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0A0E1D]/90 backdrop-blur-2xl border border-[#98AEEB]/20 shadow-[0_24px_80px_rgba(0,0,0,0.7)] rounded-[28px] px-1.5 py-2 flex items-center justify-between gap-1 w-[96vw] max-w-[680px] select-none"
        >
          <button
            onClick={() => {
              setCurrentScreen('dashboard');
              setDashboardTab('main');
            }}
            title="Главная"
            type="button"
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              isTabActive('main')
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] font-extrabold shadow-lg shadow-[#8968FF]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="text-[9px] sm:text-xs">Главная</span>
          </button>

          <button
            onClick={() => setCurrentScreen('mental_diary')}
            title="Психика"
            type="button"
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              isTabActive('diary')
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] font-extrabold shadow-lg shadow-[#8968FF]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Brain className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="text-[9px] sm:text-xs">Психика</span>
          </button>

          <button
            onClick={() => setCurrentScreen('pressure_diary')}
            title="Давление"
            type="button"
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              isTabActive('pressure_diary')
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] font-extrabold shadow-lg shadow-[#8968FF]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="text-[9px] sm:text-xs">Давление</span>
          </button>

          <button
            onClick={() => setCurrentScreen('body_map')}
            title="Организм"
            type="button"
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              isTabActive('body_map')
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] font-extrabold shadow-lg shadow-[#8968FF]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="text-[9px] sm:text-xs">Организм</span>
          </button>

          <button
            onClick={() => {
              setCurrentScreen('dashboard');
              setDashboardTab('lab');
            }}
            title="Анализы"
            type="button"
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              isTabActive('analytics')
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] font-extrabold shadow-lg shadow-[#8968FF]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="text-[9px] sm:text-xs">Анализы</span>
          </button>

          <button
            onClick={() => setCurrentScreen('ai_chat')}
            title="Аида"
            type="button"
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              isTabActive('ai_chat')
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] font-extrabold shadow-lg shadow-[#8968FF]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="text-[9px] sm:text-xs">Аида</span>
          </button>

          <button
            onClick={() => setCurrentScreen('reminders')}
            title="Задачи"
            type="button"
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              currentScreen === 'reminders'
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] font-extrabold shadow-lg shadow-[#8968FF]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="text-[9px] sm:text-xs">Задачи</span>
          </button>
        </nav>
      )}
    </>
  );
};

