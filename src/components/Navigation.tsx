import React, { useState } from 'react';
import { ScreenId, DashboardTab, UserProfile } from '../types';
import {
  Heart,
  LayoutDashboard,
  FileText,
  MessageSquare,
  Activity,
  Bell,
  Brain,
  ChevronDown,
  Sparkles,
  CheckSquare,
  Settings,
  User,
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
}

export const Navigation: React.FC<NavigationProps> = ({
  currentScreen,
  setCurrentScreen,
  dashboardTab,
  setDashboardTab,
  user,
  onLogout,
  onOpenTutorial,
  activeRemindersCount = 3,
}) => {
  const [showBellDropdown, setShowBellDropdown] = useState(false);

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

  const userName = user?.fullName ? user.fullName.split(' ')[0] : 'Анна';

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
      {/* TOP NAVIGATION (ВЕРХНЯЯ НАВИГАЦИЯ - 80px) */}
      <header className="sticky top-0 z-40 bg-[#050A12]/90 backdrop-blur-xl border-b border-white/[0.06] h-16 sm:h-20 px-4 sm:px-12">
        <div className="max-w-[1320px] mx-auto h-full flex items-center justify-between gap-2">
          {/* LEFT: LOGO + TITLE + BADGE */}
          <button
            onClick={() => {
              setCurrentScreen('dashboard');
              setDashboardTab('main');
            }}
            className="flex items-center gap-2.5 sm:gap-3 group text-left cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#34F5A4]/10 border border-[#34F5A4]/30 flex items-center justify-center text-[#34F5A4] shadow-[0_0_15px_rgba(52,245,164,0.15)] group-hover:scale-105 transition-transform">
              <Heart className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-[#34F5A4]" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-white tracking-tight text-lg sm:text-xl font-[SF Pro Display],Inter">
                Здоровье
              </span>
              <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold bg-[#34F5A4]/15 text-[#34F5A4] border border-[#34F5A4]/30 rounded-md uppercase tracking-wider">
                ИИ 2.0
              </span>
            </div>
          </button>

          {/* CENTER: TABS (Главная, Дневник, Аналитика, Карта тела, Помощник) */}
          <nav className="hidden lg:flex items-center gap-1 sm:gap-6 h-full">
            <button
              onClick={() => {
                setCurrentScreen('dashboard');
                setDashboardTab('main');
              }}
              className={`h-full flex items-center px-3 text-sm font-medium transition-all relative cursor-pointer ${
                isTabActive('main')
                  ? 'text-white font-semibold'
                  : 'text-white/68 hover:text-white'
              }`}
            >
              <span>Главная</span>
              {isTabActive('main') && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#34F5A4] shadow-[0_0_8px_#34F5A4]" />
              )}
            </button>

            <button
              onClick={() => setCurrentScreen('mental_diary')}
              className={`h-full flex items-center px-3 text-sm font-medium transition-all relative cursor-pointer ${
                isTabActive('diary')
                  ? 'text-white font-semibold'
                  : 'text-white/68 hover:text-white'
              }`}
            >
              <span>Дневник</span>
              {isTabActive('diary') && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#34F5A4] shadow-[0_0_8px_#34F5A4]" />
              )}
            </button>

            <button
              onClick={() => setCurrentScreen('pressure_diary')}
              className={`h-full flex items-center px-3 text-sm font-medium transition-all relative cursor-pointer ${
                isTabActive('pressure_diary')
                  ? 'text-white font-semibold'
                  : 'text-white/68 hover:text-white'
              }`}
            >
              <span>Давление</span>
              {isTabActive('pressure_diary') && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#34F5A4] shadow-[0_0_8px_#34F5A4]" />
              )}
            </button>

            <button
              onClick={() => {
                setCurrentScreen('dashboard');
                setDashboardTab('lab');
              }}
              className={`h-full flex items-center px-3 text-sm font-medium transition-all relative cursor-pointer ${
                isTabActive('analytics')
                  ? 'text-white font-semibold'
                  : 'text-white/68 hover:text-white'
              }`}
            >
              <span>Аналитика</span>
              {isTabActive('analytics') && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#34F5A4] shadow-[0_0_8px_#34F5A4]" />
              )}
            </button>

            <button
              onClick={() => setCurrentScreen('body_map')}
              className={`h-full flex items-center px-3 text-sm font-medium transition-all relative cursor-pointer ${
                isTabActive('body_map')
                  ? 'text-white font-semibold'
                  : 'text-white/68 hover:text-white'
              }`}
            >
              <span>Карта тела</span>
              {isTabActive('body_map') && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#34F5A4] shadow-[0_0_8px_#34F5A4]" />
              )}
            </button>

            <button
              onClick={() => setCurrentScreen('ai_chat')}
              className={`h-full flex items-center px-3 text-sm font-medium transition-all relative cursor-pointer ${
                isTabActive('ai_chat')
                  ? 'text-white font-semibold'
                  : 'text-white/68 hover:text-white'
              }`}
            >
              <span>Помощник</span>
              {isTabActive('ai_chat') && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#34F5A4] shadow-[0_0_8px_#34F5A4]" />
              )}
            </button>
          </nav>

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
                {activeRemindersCount > 0 && (
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
                      Новых: 3
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <div className="p-2.5 bg-[#101A28] rounded-xl border border-white/[0.04] space-y-1">
                      <div className="flex items-center justify-between font-bold text-white text-xs">
                        <span>Витамин D3 (5000 ME)</span>
                        <span className="text-[10px] text-white/40">14:00</span>
                      </div>
                      <p className="text-white/60 text-[11px]">Запланирован дневной приём нутрицевтиков</p>
                    </div>

                    <div className="p-2.5 bg-[#101A28] rounded-xl border border-white/[0.04] space-y-1">
                      <div className="flex items-center justify-between font-bold text-white text-xs">
                        <span>Лабораторный анализ</span>
                        <span className="text-[10px] text-white/40">12:30</span>
                      </div>
                      <p className="text-white/60 text-[11px]">Результат бланкового исследования успешно обработан ИИ</p>
                    </div>

                    <div className="p-2.5 bg-[#101A28] rounded-xl border border-white/[0.04] space-y-1">
                      <div className="flex items-center justify-between font-bold text-white text-xs">
                        <span>ИИ-Ассистент</span>
                        <span className="text-[10px] text-white/40">09:15</span>
                      </div>
                      <p className="text-white/60 text-[11px]">Сводка показателей за неделю сформирована</p>
                    </div>
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
                className="px-2.5 sm:px-3 py-2 rounded-2xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 hover:bg-[#34F5A4]/20 text-[#34F5A4] transition-all cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5 text-xs font-bold"
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
              <span className="text-xs sm:text-sm font-medium text-white hidden xs:inline sm:inline">{userName}</span>
              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/40" />
            </button>
          </div>
        </div>
      </header>

      {/* FLOATING BOTTOM MENU (НИЖНЕЕ МЕНЮ - ИКОНКИ НА МОБИЛЬНОМ, ИКОНКИ+ТЕКСТ НА ДЕСКТОПЕ) */}
      {isAppView && (
        <nav className="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0B1320]/95 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)] rounded-[24px] sm:rounded-[32px] px-1.5 sm:px-4 py-1.5 sm:py-2.5 flex items-center justify-between gap-1 sm:gap-2 w-[96vw] max-w-[680px] select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => {
              setCurrentScreen('dashboard');
              setDashboardTab('main');
            }}
            title="Главная"
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2 rounded-xl sm:rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[40px] min-w-[36px] ${
              isTabActive('main')
                ? 'bg-[#34F5A4] text-[#050A12] shadow-lg shadow-[#34F5A4]/25 font-bold'
                : 'text-white/68 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Главная</span>
          </button>

          <button
            onClick={() => setCurrentScreen('mental_diary')}
            title="Дневник эмоций"
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2 rounded-xl sm:rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[40px] min-w-[36px] ${
              isTabActive('diary')
                ? 'bg-[#34F5A4] text-[#050A12] shadow-lg shadow-[#34F5A4]/25 font-bold'
                : 'text-white/68 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Brain className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Дневник</span>
          </button>

          <button
            onClick={() => setCurrentScreen('pressure_diary')}
            title="Дневник давления"
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2 rounded-xl sm:rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[40px] min-w-[36px] ${
              isTabActive('pressure_diary')
                ? 'bg-[#34F5A4] text-[#050A12] shadow-lg shadow-[#34F5A4]/25 font-bold'
                : 'text-white/68 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Activity className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Давление</span>
          </button>

          <button
            onClick={() => setCurrentScreen('body_map')}
            title="Карта тела"
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2 rounded-xl sm:rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[40px] min-w-[36px] ${
              isTabActive('body_map')
                ? 'bg-[#34F5A4] text-[#050A12] shadow-lg shadow-[#34F5A4]/25 font-bold'
                : 'text-white/68 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <User className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Карта тела</span>
          </button>

          <button
            onClick={() => {
              setCurrentScreen('dashboard');
              setDashboardTab('lab');
            }}
            title="Лабораторные анализы"
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2 rounded-xl sm:rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[40px] min-w-[36px] ${
              isTabActive('analytics')
                ? 'bg-[#34F5A4] text-[#050A12] shadow-lg shadow-[#34F5A4]/25 font-bold'
                : 'text-white/68 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <FileText className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Аналитика</span>
          </button>

          <button
            onClick={() => setCurrentScreen('ai_chat')}
            title="ИИ Помощник"
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2 rounded-xl sm:rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[40px] min-w-[36px] ${
              isTabActive('ai_chat')
                ? 'bg-[#34F5A4] text-[#050A12] shadow-lg shadow-[#34F5A4]/25 font-bold'
                : 'text-white/68 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Sparkles className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">ИИ Чат</span>
          </button>

          <button
            onClick={() => setCurrentScreen('daily_checkin')}
            title="Ежедневный опрос"
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2 rounded-xl sm:rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[40px] min-w-[36px] ${
              isTabActive('daily_checkin')
                ? 'bg-[#34F5A4] text-[#050A12] shadow-lg shadow-[#34F5A4]/25 font-bold'
                : 'text-white/68 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <CheckSquare className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Опрос</span>
          </button>
        </nav>
      )}
    </>
  );
};

