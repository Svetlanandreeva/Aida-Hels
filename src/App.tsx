import React, { useState, useEffect } from 'react';
import {
  ScreenId,
  DashboardTab,
  UserProfile,
  MedicalDocument,
  Appointment,
  BodySystem,
  DailyLogEntry,
  Reminder,
  DiaryEntry,
  UserMentalPatterns,
  WeeklyMentalReport,
  PressureLogEntry,
} from './types';
import {
  initialUserProfile,
  emptyUserProfile,
  demoUserProfile,
  emptyBodySystems,
  emptyMentalPatterns,
  emptyWeeklyReport,
  initialBodySystems,
  initialDocuments,
  initialAppointments,
  initialDailyLogs,
  initialReminders,
  initialDiaryEntries,
  initialMentalPatterns,
  initialWeeklyReport,
  initialPressureLogs,
} from './data/initialData';

import { Navigation } from './components/Navigation';
import { AuthScreen } from './components/AuthScreen';
import { StartScreen } from './components/StartScreen';
import { Questionnaire } from './components/Questionnaire';
import { Dashboard } from './components/Dashboard';
import { MedicalProfile } from './components/MedicalProfile';
import { SettingsScreen } from './components/SettingsScreen';
import { AiAssistant } from './components/AiAssistant';
import { DailyCheckin } from './components/DailyCheckin';
import { BodyMap } from './components/BodyMap';
import { RemindersScreen } from './components/RemindersScreen';
import { MentalDiaryScreen } from './components/MentalDiaryScreen';
import { PressureDiary } from './components/PressureDiary';

import { SecurityLockModal } from './components/SecurityLockModal';

// Modals
import { BodyMapOverviewModal } from './components/modals/BodyMapOverviewModal';
import { SystemDetailModal } from './components/modals/SystemDetailModal';
import { DoctorReportModal } from './components/modals/DoctorReportModal';
import { OnboardingModal } from './components/modals/OnboardingModal';

const isDemoUser = (u: UserProfile) => {
  return u.email === 'anna.ivanova@health.ru' || u.id === 'usr-1' || Boolean((u as any).isDemoUser);
};

export default function App() {
  // Navigation State
  const [currentScreen, setCurrentScreen] = useState<ScreenId>(() => {
    const savedUser = localStorage.getItem('app_user_profile');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.isAuthenticated) {
          if (!parsed.isQuestionnaireCompleted) {
            return 'q1';
          }
          return 'dashboard';
        }
      } catch {
        // ignore
      }
    }
    return 'start';
  });
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('main');
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');

  // Application Data States
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('app_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return emptyUserProfile;
  });

  // Reset scroll to top when changing screens
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentScreen]);

  useEffect(() => {
    localStorage.setItem('app_user_profile', JSON.stringify(user));
  }, [user]);

  // Biometric Protection & App Lock States (disabled by default; PIN must be set explicitly)
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_biometrics_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [userPin, setUserPin] = useState<string>(() => {
    return localStorage.getItem('app_pin_code') || '';
  });
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    const savedBio = localStorage.getItem('app_biometrics_enabled');
    const bioEnabled = savedBio !== null ? JSON.parse(savedBio) : false;
    const savedUser = localStorage.getItem('app_user_profile');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        return bioEnabled && !!parsed.isAuthenticated;
      } catch {
        return false;
      }
    }
    return false;
  });

  const [bodySystems, setBodySystems] = useState<BodySystem[]>(() => {
    if (isDemoUser(user)) return initialBodySystems;
    const saved = localStorage.getItem('app_body_systems');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return emptyBodySystems;
  });

  const [documents, setDocuments] = useState<MedicalDocument[]>(() => {
    if (isDemoUser(user)) return initialDocuments;
    const saved = localStorage.getItem('app_user_documents');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return [];
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    if (isDemoUser(user)) return initialAppointments;
    const saved = localStorage.getItem('app_user_appointments');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return [];
  });

  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>(() => {
    if (isDemoUser(user)) return initialDailyLogs;
    const saved = localStorage.getItem('app_user_daily_logs');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return [];
  });

  const [reminders, setReminders] = useState<Reminder[]>(() => {
    if (isDemoUser(user)) return initialReminders;
    const saved = localStorage.getItem('app_user_reminders');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return [];
  });

  const [pressureLogs, setPressureLogs] = useState<PressureLogEntry[]>(() => {
    if (isDemoUser(user)) return initialPressureLogs;
    const saved = localStorage.getItem('app_user_pressure_logs');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return [];
  });

  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(() => {
    if (isDemoUser(user)) return initialDiaryEntries;
    const saved = localStorage.getItem('app_user_diary_entries');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return [];
  });

  const [mentalPatterns, setMentalPatterns] = useState<UserMentalPatterns>(() => {
    if (isDemoUser(user)) return initialMentalPatterns;
    const saved = localStorage.getItem('app_user_mental_patterns');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return emptyMentalPatterns;
  });

  const [weeklyReport, setWeeklyReport] = useState<WeeklyMentalReport>(() => {
    if (isDemoUser(user)) return initialWeeklyReport;
    const saved = localStorage.getItem('app_user_weekly_report');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return emptyWeeklyReport;
  });

  // Save non-demo user data changes to localStorage
  useEffect(() => {
    if (!isDemoUser(user)) {
      localStorage.setItem('app_body_systems', JSON.stringify(bodySystems));
      localStorage.setItem('app_user_documents', JSON.stringify(documents));
      localStorage.setItem('app_user_appointments', JSON.stringify(appointments));
      localStorage.setItem('app_user_daily_logs', JSON.stringify(dailyLogs));
      localStorage.setItem('app_user_reminders', JSON.stringify(reminders));
      localStorage.setItem('app_user_pressure_logs', JSON.stringify(pressureLogs));
      localStorage.setItem('app_user_diary_entries', JSON.stringify(diaryEntries));
      localStorage.setItem('app_user_mental_patterns', JSON.stringify(mentalPatterns));
      localStorage.setItem('app_user_weekly_report', JSON.stringify(weeklyReport));
    }
  }, [user, bodySystems, documents, appointments, dailyLogs, reminders, pressureLogs, diaryEntries, mentalPatterns, weeklyReport]);
  const handleAddDiaryEntry = async (entryData: Partial<DiaryEntry>) => {
    const newEntry: DiaryEntry = {
      id: `diary-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user.id || 'usr-1',
      event_datetime: entryData.event_datetime || new Date().toISOString(),
      entry_type: entryData.entry_type || 'full',
      state_score: entryData.state_score ?? 7,
      energy_score: entryData.energy_score ?? 7,
      anxiety_score: entryData.anxiety_score ?? 3,
      stress_score: entryData.stress_score ?? 3,
      moods: entryData.moods || ['спокойствие'],
      event_description: entryData.event_description || '',
      event_categories: entryData.event_categories || ['работа'],
      thoughts: entryData.thoughts || '',
      user_reactions: entryData.user_reactions || [],
      helpful_actions: entryData.helpful_actions || [],
      physical_factors: entryData.physical_factors || {},
      additional_note: entryData.additional_note || '',
    };

    // Update state locally first
    setDiaryEntries((prev) => [newEntry, ...prev]);

    // Async trigger server AI analysis
    try {
      const res = await fetch('/api/mental-diary/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: diaryEntries, newEntry }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          // Attach AI result to newEntry
          setDiaryEntries((prev) =>
            prev.map((e) =>
              e.id === newEntry.id
                ? {
                    ...e,
                    ai_analysis: {
                      detected_emotions: data.analysis.detected_emotions || newEntry.moods,
                      detected_topics: data.analysis.detected_triggers || [],
                      detected_triggers: data.analysis.detected_triggers || [],
                      detected_resource_factors: data.analysis.detected_resource_factors || [],
                      summary_insight: data.analysis.summary_insight || 'Запись сохранена и проанализирована.',
                      risk_level: data.analysis.risk_level || 'none',
                    },
                  }
                : e
            )
          );

          if (data.analysis.positive_triggers) {
            setMentalPatterns((prev) => ({
              ...prev,
              positive_triggers: data.analysis.positive_triggers || prev.positive_triggers,
              negative_triggers: data.analysis.negative_triggers || prev.negative_triggers,
              resource_forecast: data.analysis.resource_forecast || prev.resource_forecast,
              forecast_reasoning: data.analysis.forecast_reasoning || prev.forecast_reasoning,
            }));
          }
        }
      }
    } catch (err) {
      console.error('Mental diary AI sync error:', err);
    }
  };

  const handleUpdateDiaryEntry = (entryData: Partial<DiaryEntry>) => {
    if (!entryData.id) return;
    setDiaryEntries((prev) =>
      prev.map((e) => (e.id === entryData.id ? ({ ...e, ...entryData, updated_at: new Date().toISOString() } as DiaryEntry) : e))
    );
  };

  const handleDeleteDiaryEntry = (id: string) => {
    setDiaryEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClearAllDiaryData = () => {
    setDiaryEntries([]);
  };

  // Modal Visibility States
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  const [selectedSystemDetail, setSelectedSystemDetail] = useState<BodySystem | null>(null);
  const [isDoctorReportOpen, setIsDoctorReportOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Handlers
  const handleAuthSuccess = (userData?: Partial<UserProfile>) => {
    const isNewRegistration = userData?.isQuestionnaireCompleted === false;
    const updatedUser: UserProfile = {
      ...(isNewRegistration ? emptyUserProfile : user),
      ...userData,
      isAuthenticated: true,
    };
    setUser(updatedUser);

    if (isNewRegistration || !updatedUser.isQuestionnaireCompleted) {
      setBodySystems(emptyBodySystems);
      setDocuments([]);
      setAppointments([]);
      setDailyLogs([]);
      setReminders([]);
      setPressureLogs([]);
      setDiaryEntries([]);
      setMentalPatterns(emptyMentalPatterns);
      setWeeklyReport(emptyWeeklyReport);
      setCurrentScreen('q1');
    } else {
      setCurrentScreen('dashboard');
    }
  };

  const handleDemoLogin = () => {
    const demoUser = {
      ...demoUserProfile,
      isAuthenticated: true,
      isQuestionnaireCompleted: true,
      isDemoUser: true,
    };
    setUser(demoUser);
    setBodySystems(initialBodySystems);
    setDocuments(initialDocuments);
    setAppointments(initialAppointments);
    setDailyLogs(initialDailyLogs);
    setReminders(initialReminders);
    setPressureLogs(initialPressureLogs);
    setDiaryEntries(initialDiaryEntries);
    setMentalPatterns(initialMentalPatterns);
    setWeeklyReport(initialWeeklyReport);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setUser((prev) => ({ ...prev, isAuthenticated: false }));
    setAuthTab('login');
    setCurrentScreen('auth');
  };

  const handleDeleteProfile = async () => {
    const currentUserId = user.id || 'usr-1';
    const savedSheetUrl = localStorage.getItem('app_google_sheet_url') || '';

    // a) Reset all local React states to empty/defaults
    setUser(initialUserProfile);
    setBodySystems(initialBodySystems);
    setDocuments([]);
    setAppointments([]);
    setDailyLogs([]);
    setReminders([]);
    setPressureLogs([]);
    setDiaryEntries([]);
    setMentalPatterns(initialMentalPatterns);
    setWeeklyReport(initialWeeklyReport);
    setBiometricsEnabled(false);
    setUserPin('');
    setIsAppLocked(false);

    // b) Clear all localStorage keys
    try {
      localStorage.removeItem('app_user_profile');
      localStorage.removeItem('app_biometrics_enabled');
      localStorage.removeItem('app_pin_code');
      localStorage.removeItem('app_saved_credentials');
      localStorage.removeItem('app_google_sheet_url');
      localStorage.removeItem('app_sync_status');
      localStorage.clear();
    } catch (err) {
      console.error('Error clearing localStorage during account deletion:', err);
    }

    // c) Call server endpoint /api/sheets/proxy with deleteUserAccount action
    let serverSuccess = true;
    try {
      const res = await fetch('/api/sheets/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteUserAccount',
          userId: currentUserId,
          webAppUrl: savedSheetUrl,
        }),
      });
      if (!res.ok) {
        serverSuccess = false;
      } else {
        const data = await res.json();
        if (!data.success) {
          serverSuccess = false;
        }
      }
    } catch (err) {
      console.error('Server deleteUserAccount request error:', err);
      serverSuccess = false;
    }

    // e) Redirect user to start screen as a brand new user
    setCurrentScreen('start');
    setDashboardTab('main');

    if (!serverSuccess) {
      setTimeout(() => {
        alert('Локальные данные профиля полностью удалены. Часть данных в облаке могла не удалиться из-за отсутствия связи с сервером.');
      }, 300);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-gray-100 font-sans flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Header & Mobile Navigation (Only for logged-in inside app screens) */}
      {currentScreen !== 'start' && currentScreen !== 'auth' && user.isAuthenticated && (
        <Navigation
          currentScreen={currentScreen}
          setCurrentScreen={setCurrentScreen}
          dashboardTab={dashboardTab}
          setDashboardTab={setDashboardTab}
          user={user}
          onLogout={handleLogout}
          onOpenTutorial={() => setIsOnboardingOpen(true)}
          activeRemindersCount={reminders.filter((r) => r.isEnabled).length}
        />
      )}

      {/* Main Screen Router Content */}
      <main className={currentScreen === 'start' || currentScreen === 'auth' ? 'flex-1 w-full flex flex-col' : 'flex-1 max-w-[1320px] w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-28 sm:pb-24'}>
        {/* GATE / AUTH SCREEN */}
        {currentScreen === 'auth' && (
          <AuthScreen
            initialTab={authTab}
            onLoginSuccess={handleAuthSuccess}
            onDemoLogin={handleDemoLogin}
          />
        )}

        {/* SCREEN 0: START HERO SCREEN */}
        {currentScreen === 'start' && (
          <StartScreen
            onStartQuestionnaire={() => {
              setAuthTab('register');
              setCurrentScreen('auth');
            }}
            onGoToDashboard={() => setCurrentScreen('dashboard')}
            onLoginClick={() => {
              setAuthTab('login');
              setCurrentScreen('auth');
            }}
            isAuthenticated={user.isAuthenticated}
          />
        )}

        {/* QUESTIONNAIRE FLOW (q1, q2, q3, q4, q5) */}
        {['q1', 'q2', 'q3', 'q4', 'q5'].includes(currentScreen) && (
          <Questionnaire
            currentStep={currentScreen as any}
            setCurrentStep={(step) => setCurrentScreen(step as ScreenId)}
            user={user}
            setUser={setUser}
            onComplete={() => {
              setIsOnboardingOpen(true);
              setCurrentScreen('dashboard');
              setDashboardTab('main');
            }}
          />
        )}

        {/* SCREEN 6: DASHBOARD (3 SUB-TABS) */}
        {currentScreen === 'dashboard' && (
          <Dashboard
            activeTab={dashboardTab}
            setActiveTab={setDashboardTab}
            user={user}
            documents={documents}
            setDocuments={setDocuments}
            appointments={appointments}
            setAppointments={setAppointments}
            bodySystems={bodySystems}
            onNavigate={(screen) => setCurrentScreen(screen)}
            onOpenDoctorReport={() => setIsDoctorReportOpen(true)}
            reminders={reminders}
            setReminders={setReminders}
          />
        )}

        {/* SCREEN 7: ANAMNESIS & PROFILE (READ-ONLY) */}
        {currentScreen === 'profile' && (
          <MedicalProfile
            user={user}
            onOpenDoctorReport={() => setIsDoctorReportOpen(true)}
            onEditQuestionnaire={() => setCurrentScreen('q1')}
          />
        )}

        {/* SCREEN 8: SETTINGS & PARTNER CYCLE SYNC */}
        {currentScreen === 'settings' && (
          <SettingsScreen
            user={user}
            setUser={setUser}
            reminders={reminders}
            setReminders={setReminders}
            documents={documents}
            setDocuments={setDocuments}
            onLogout={handleLogout}
            onDeleteProfile={handleDeleteProfile}
            onNavigate={(screen) => setCurrentScreen(screen)}
            biometricsEnabled={biometricsEnabled}
            setBiometricsEnabled={(enabled) => {
              setBiometricsEnabled(enabled);
              localStorage.setItem('app_biometrics_enabled', JSON.stringify(enabled));
            }}
            userPin={userPin}
            setUserPin={(pin) => {
              setUserPin(pin);
              localStorage.setItem('app_pin_code', pin);
            }}
            onLockApp={() => setIsAppLocked(true)}
          />
        )}

        {/* SCREEN 9: AI CHAT ASSISTANT */}
        {currentScreen === 'ai_chat' && (
          <AiAssistant
            user={user}
            documents={documents}
            dailyLogs={dailyLogs}
            diaryEntries={diaryEntries}
            reminders={reminders}
            pressureLogs={pressureLogs}
          />
        )}

        {/* SCREEN 10: DAILY CHECK-IN & RECHARTS DYNAMICS */}
        {currentScreen === 'daily_checkin' && (
          <DailyCheckin logs={dailyLogs} setLogs={setDailyLogs} />
        )}

        {/* SCREEN 11: BODY MAP (10 SYSTEMS) */}
        {currentScreen === 'body_map' && (
          <BodyMap
            systems={bodySystems}
            onSelectSystem={(system) => setSelectedSystemDetail(system)}
            onOpenOverviewModal={() => setIsOverviewModalOpen(true)}
          />
        )}

        {/* SCREEN 12: REMINDERS & MEDICATION SCHEDULE */}
        {currentScreen === 'reminders' && (
          <RemindersScreen
            reminders={reminders}
            setReminders={setReminders}
            onNavigateToCheckin={() => setCurrentScreen('daily_checkin')}
            onNavigateToAppointments={() => {
              setCurrentScreen('dashboard');
              setDashboardTab('appointments');
            }}
          />
        )}

        {/* SCREEN 13: MENTAL STATE DIARY */}
        {currentScreen === 'mental_diary' && (
          <MentalDiaryScreen
            user={user}
            entries={diaryEntries}
            patterns={mentalPatterns}
            weeklyReport={weeklyReport}
            onAddEntry={handleAddDiaryEntry}
            onUpdateEntry={handleUpdateDiaryEntry}
            onDeleteEntry={handleDeleteDiaryEntry}
            onUpdateWeeklyReportToggle={(enabled) =>
              setWeeklyReport((prev) => ({ ...prev, is_enabled: enabled }))
            }
            onClearAllDiaryData={handleClearAllDiaryData}
          />
        )}

        {/* SCREEN 14: PRESSURE & PULSE DIARY */}
        {currentScreen === 'pressure_diary' && (
          <PressureDiary
            entries={pressureLogs}
            setEntries={setPressureLogs}
            onNavigateBack={() => {
              setCurrentScreen('dashboard');
              setDashboardTab('main');
            }}
          />
        )}
      </main>

      {/* OVERLAY MODALS */}

      {/* Modal 1: Body Map Overview */}
      <BodyMapOverviewModal
        isOpen={isOverviewModalOpen}
        onClose={() => setIsOverviewModalOpen(false)}
        systems={bodySystems}
        onSelectSystem={(system) => setSelectedSystemDetail(system)}
        onOpenDoctorReport={() => setIsDoctorReportOpen(true)}
      />

      {/* Modal 2: Individual System Detail */}
      <SystemDetailModal
        system={selectedSystemDetail}
        onClose={() => setSelectedSystemDetail(null)}
      />

      {/* Modal 3: Printable Doctor Report */}
      <DoctorReportModal
        isOpen={isDoctorReportOpen}
        onClose={() => setIsDoctorReportOpen(false)}
        user={user}
        documents={documents}
        systems={bodySystems}
      />

      {/* Modal 4: Onboarding & Interactive Tutorial */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onFinish={() => {
          setIsOnboardingOpen(false);
          setUser((prev) => ({ ...prev, hasCompletedTutorial: true }));
        }}
      />

      {/* FULL-APP SECURITY LOCK SCREEN OVERLAY */}
      <SecurityLockModal
        isOpen={isAppLocked && biometricsEnabled}
        mode="verify"
        currentPin={userPin}
        onSuccess={() => setIsAppLocked(false)}
        allowCancel={false}
      />
    </div>
  );
}
