import React, { useState, useEffect } from 'react';
import { processLabDocumentThroughStaging } from '../utils/analyzeMedicalDocument';
import {
  UserProfile,
  DashboardTab,
  MedicalDocument,
  Appointment,
  BodySystem,
  ScreenId,
  Reminder,
  StructuredHealthAnalysis,
  DailyLogEntry,
  DiaryEntry,
  PressureLogEntry,
  UserMentalPatterns,
} from '../types';
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Upload,
  MessageSquare,
  Activity,
  Plus,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Heart,
  FileCheck2,
  Trash2,
  Search,
  Filter,
  Bell,
  Pill,
  RotateCcw,
  Check,
  Brain,
  Smile,
  Zap,
  Moon,
  TrendingUp,
  ArrowRight,
  Shield,
  BookOpen,
  Coffee,
  CheckSquare,
  SlidersHorizontal,
  RefreshCw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  ResearchVerificationModal,
  StagingRecordPayload,
} from './modals/ResearchVerificationModal';
import { RedFlagBanner } from './dashboard/RedFlagBanner';
import { OverallAiSummaryCard } from './dashboard/OverallAiSummaryCard';
import { AttentionItemCard } from './dashboard/AttentionItemCard';
import { BodySystemsSection } from './dashboard/BodySystemsSection';
import { NewUserIntroCard } from './dashboard/NewUserIntroCard';
import { MaturityStageIndicator } from './dashboard/MaturityStageIndicator';
import { QuestionnaireProposalModal } from './modals/QuestionnaireProposalModal';
import { DataCollectionExplainedModal } from './modals/DataCollectionExplainedModal';
import { SurveyHistoryModal } from './modals/SurveyHistoryModal';
import { MedicationTodaySection } from './dashboard/MedicationTodaySection';
import HomeDashboard from './HomeDashboard';
import LabResearchScreen from './LabResearchScreen';
import { deduplicateMarkers } from '../utils/markerUtils';

interface DashboardProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  user: UserProfile;
  documents: MedicalDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<MedicalDocument[]>>;
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  bodySystems: BodySystem[];
  onNavigate: (screen: ScreenId) => void;
  onOpenDoctorReport: () => void;
  reminders?: Reminder[];
  setReminders?: React.Dispatch<React.SetStateAction<Reminder[]>>;
  dailyLogs?: DailyLogEntry[];
  diaryEntries?: DiaryEntry[];
  pressureLogs?: PressureLogEntry[];
  mentalPatterns?: UserMentalPatterns;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeTab,
  setActiveTab,
  user,
  documents,
  setDocuments,
  appointments,
  setAppointments,
  bodySystems,
  onNavigate,
  onOpenDoctorReport,
  reminders = [],
  setReminders,
  dailyLogs = [],
  diaryEntries = [],
  pressureLogs = [],
  mentalPatterns,
}) => {
  // Structured AI Health Analysis state
  const [healthAnalysis, setHealthAnalysis] = useState<StructuredHealthAnalysis | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  // Intro Card & Modals State
  const [isIntroDismissed, setIsIntroDismissed] = useState(false);
  const [isProposalOpen, setIsProposalOpen] = useState(false);
  const [isExplainedOpen, setIsExplainedOpen] = useState(false);
  const [isSurveyHistoryOpen, setIsSurveyHistoryOpen] = useState(false);
  const [isSituationalPromptDismissed, setIsSituationalPromptDismissed] = useState(false);

  // Category filter state for Lab tab
  const [docFilter, setDocFilter] = useState<'all' | 'lab' | 'ultrasound' | 'instrumental' | 'consultations'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // New Appointment Modal State
  const [showAddApptModal, setShowAddApptModal] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('Невролог');
  const [newDoctorName, setNewDoctorName] = useState('Д-р Ильин А. В.');
  const [newClinic, setNewClinic] = useState('МедЦентр «Здоровье»');
  const [newDateTime, setNewDateTime] = useState('2026-08-18 в 10:00');
  const [newPurpose, setNewPurpose] = useState('Консультация по вечерним головным болям');

  // Trend Chart State for Main Tab
  const [chartPeriod, setChartPeriod] = useState<'7d' | '14d' | '30d'>('7d');

  // Accordion Expand/Collapse States for Deep Analysis Blocks
  const [isSystemsExpanded, setIsSystemsExpanded] = useState(false);
  const [isPsychologyExpanded, setIsPsychologyExpanded] = useState(false);
  const [isRecommendationsExpanded, setIsRecommendationsExpanded] = useState(false);
  const [showAllMarkersDocMap, setShowAllMarkersDocMap] = useState<Record<string, boolean>>({});

  // Fetch structured AI analysis from backend
  const fetchHealthAnalysis = async () => {
    setIsLoadingAnalysis(true);
    try {
      const res = await fetch('/api/ai/health-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user,
          documents,
          appointments,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setHealthAnalysis(data.analysis);
        }
      }
    } catch (err) {
      console.warn('Health analysis fetch notice:', err);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    fetchHealthAnalysis();
  }, [documents, user]);

  const { metricsTrendData, hasEnoughChartData } = React.useMemo(() => {
    const totalRecords = (diaryEntries?.length || 0) + (dailyLogs?.length || 0) + (pressureLogs?.length || 0);
    if (totalRecords < 2) {
      return { metricsTrendData: [], hasEnoughChartData: false };
    }

    const daysCount = chartPeriod === '7d' ? 7 : chartPeriod === '14d' ? 14 : 30;
    const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const result: Array<{ day: string; energy?: number; sleep?: number; stress?: number; mood?: number }> = [];

    const now = new Date();
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = daysCount === 7 ? dayLabels[d.getDay()] : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;

      const dayDiary = (diaryEntries || []).filter((e) => {
        const eDate = e.event_datetime || e.created_at;
        return eDate && eDate.startsWith(dateStr);
      });

      const dayLogs = (dailyLogs || []).filter((l) => l.date === dateStr || l.date === dayName);

      if (dayDiary.length > 0) {
        const energyValues = dayDiary
          .map((entry) => entry.energy_score)
          .filter((value): value is number => typeof value === 'number');
        const stressValues = dayDiary
          .map((entry) => entry.stress_score ?? entry.anxiety_score)
          .filter((value): value is number => typeof value === 'number');
        const moodValues = dayDiary
          .map((entry) => entry.state_score)
          .filter((value): value is number => typeof value === 'number');
        const sleepValues = dayDiary
          .map((entry) => entry.physical_factors?.sleepDurationHours)
          .filter((value): value is number => typeof value === 'number');

        const avgEnergy = energyValues.length > 0
          ? Math.round((energyValues.reduce((sum, value) => sum + value, 0) / energyValues.length) * 10)
          : undefined;
        const avgStress = stressValues.length > 0
          ? Math.round((stressValues.reduce((sum, value) => sum + value, 0) / stressValues.length) * 10)
          : undefined;
        const avgMood = moodValues.length > 0
          ? Math.round((moodValues.reduce((sum, value) => sum + value, 0) / moodValues.length) * 10)
          : undefined;
        const avgSleep = sleepValues.length > 0
          ? Math.min(100, Math.round(((sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length) / 8) * 100))
          : undefined;

        if ([avgEnergy, avgSleep, avgStress, avgMood].some((value) => typeof value === 'number')) {
          result.push({ day: dayName, energy: avgEnergy, sleep: avgSleep, stress: avgStress, mood: avgMood });
        }
      } else if (dayLogs.length > 0) {
        const lastL = dayLogs[dayLogs.length - 1];
        const observed = {
          energy: typeof lastL.energy === 'number' ? lastL.energy : undefined,
          sleep: typeof lastL.sleep === 'number' ? lastL.sleep : undefined,
          stress: typeof lastL.stress === 'number' ? lastL.stress : undefined,
          mood: typeof lastL.mood === 'number' ? lastL.mood : undefined,
        };
        if (Object.values(observed).some((value) => typeof value === 'number')) {
          result.push({ day: dayName, ...observed });
        }
      }
    }

    const activeDays = result.filter((r) =>
      [r.energy, r.sleep, r.stress, r.mood].some((value) => typeof value === 'number')
    ).length;
    if (activeDays < 2) {
      return { metricsTrendData: [], hasEnoughChartData: false };
    }

    return { metricsTrendData: result, hasEnoughChartData: true };
  }, [diaryEntries, dailyLogs, pressureLogs, chartPeriod]);

  // Real Document Upload & Staging Verification State
  const [uploadStatusStep, setUploadStatusStep] = useState('Загружаем документ...');
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFailedFile, setLastFailedFile] = useState<File | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [stagingRecord, setStagingRecord] = useState<StagingRecordPayload | null>(null);

  // Staging Pipeline Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] } }) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setUploadError(null);
    setLastFailedFile(null);
    setIsUploading(true);
    setUploadProgress(10);
    setUploadStatusStep('Проверка формата, размер (макс 15МБ) и хеширование...');

    try {
      if (file.type.startsWith('image/')) {
        setSelectedFilePreview(URL.createObjectURL(file));
      } else {
        setSelectedFilePreview(null);
      }

      const record = await processLabDocumentThroughStaging(file, (step, percent) => {
        setUploadStatusStep(step);
        setUploadProgress(percent);
      });

      setStagingRecord(record);
      setIsVerificationModalOpen(true);
    } catch (err: any) {
      console.error('Document staging error:', err);
      const errMsg = err?.message || 'Не удалось сопоставить документ в пайплайне';
      setUploadError(errMsg);
      setLastFailedFile(file);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRetryUpload = () => {
    if (lastFailedFile) {
      handleFileUpload({ target: { files: [lastFailedFile] } });
    }
  };

  // Commit verified staging record to backend canonical history
  const handleCommitStaging = async (commitParams: any) => {
    try {
      const res = await fetch('/api/lab/staging/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...commitParams,
          stagingRecordFallback: stagingRecord,
        }),
      });

      const data = await res.json();
      if (data.success && data.document) {
        setDocuments((prev) => [data.document, ...prev]);
      }
    } catch (err) {
      console.error('Commit staging error:', err);
    }
  };

  // Add Appointment Submit
  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Appointment = {
      id: `app-${Date.now()}`,
      specialty: newSpecialty,
      doctorName: newDoctorName,
      clinic: newClinic,
      dateTime: newDateTime,
      status: 'upcoming',
      purpose: newPurpose,
    };
    setAppointments((prev) => [created, ...prev]);
    setShowAddApptModal(false);
  };

  // Calculate completeness score
  const completeness = 92;

  // Women Health calculation
  const getCycleDaysLeft = () => {
    if (!user.womenHealth) return null;
    const last = new Date(user.womenHealth.lastPeriodDate);
    const now = new Date('2026-08-01');
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 3600 * 24));
    const daysLeft = user.womenHealth.cycleLength - (diffDays % user.womenHealth.cycleLength);
    return daysLeft > 0 ? daysLeft : 1;
  };

  return (
    <div className="space-y-6 pb-32 sm:pb-36">
      {/* SUB-TAB 1: ГЛАВНАЯ (HOME DASHBOARD) */}
      {activeTab === 'main' && (
        <HomeDashboard
          user={user}
          documents={documents}
          appointments={appointments}
          bodySystems={bodySystems}
          onNavigate={onNavigate}
          setActiveTab={setActiveTab}
          onOpenDoctorReport={onOpenDoctorReport}
          reminders={reminders}
          setReminders={setReminders}
          dailyLogs={dailyLogs}
          diaryEntries={diaryEntries}
          pressureLogs={pressureLogs}
          mentalPatterns={mentalPatterns}
          isLoadingAnalysis={isLoadingAnalysis}
          fetchHealthAnalysis={fetchHealthAnalysis}
          aiAnalysis={healthAnalysis}
        />
      )}






















      {/* SUB-TAB 2: ИССЛЕДОВАНИЯ И АНАЛИЗЫ */}
      {activeTab === 'lab' && (
        <LabResearchScreen
          documents={documents}
          setDocuments={setDocuments}
          docFilter={docFilter}
          setDocFilter={setDocFilter}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          uploadStatusStep={uploadStatusStep}
          uploadError={uploadError}
          handleFileUpload={handleFileUpload}
          handleRetryUpload={handleRetryUpload}
        />
      )}

      {/* SUB-TAB 3: ПРИЁМЫ ВРАЧЕЙ */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-100 text-lg">Записи и визиты к врачам</h3>
              <p className="text-xs text-gray-400">
                Календарный график плановых и прошедших консультаций.
              </p>
            </div>
            <button
              onClick={() => setShowAddApptModal(true)}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Записаться к врачу</span>
            </button>
          </div>

          {/* Upcoming Section */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              Предстоящие приёмы
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointments
                .filter((a) => a.status === 'upcoming')
                .map((appt) => (
                  <div
                    key={appt.id}
                    className="bg-[#14171C] p-5 rounded-2xl border border-gray-800 shadow-sm space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-extrabold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg inline-block mb-1">
                          {appt.dateTime}
                        </span>
                        <h4 className="font-bold text-gray-100 text-base">{appt.specialty}</h4>
                        <p className="text-xs text-gray-400">{appt.doctorName}</p>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>

                    <p className="text-xs text-gray-400 bg-[#0F1115] p-2.5 rounded-xl border border-gray-800/60">
                      Клиника: <strong className="text-gray-200">{appt.clinic}</strong>
                      <br />
                      Цель: {appt.purpose}
                    </p>

                    <div className="pt-1 flex items-center justify-between text-xs">
                      <button
                        onClick={onOpenDoctorReport}
                        className="text-emerald-400 font-bold hover:underline cursor-pointer"
                      >
                        Подготовить отчёт для приёма →
                      </button>
                      <button
                        onClick={() =>
                          setAppointments((prev) => prev.filter((a) => a.id !== appt.id))
                        }
                        className="text-gray-500 hover:text-rose-400 text-[11px] cursor-pointer"
                      >
                        Отменить
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Completed Section */}
          <div className="space-y-3 pt-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              Прошедшие приёмы
            </span>
            <div className="space-y-2">
              {appointments
                .filter((a) => a.status === 'completed')
                .map((appt) => (
                  <div
                    key={appt.id}
                    className="bg-[#0F1115] p-4 rounded-xl border border-gray-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-gray-200">
                        {appt.specialty} — {appt.doctorName}
                      </span>
                      <p className="text-gray-400 mt-0.5">
                        {appt.clinic} • {appt.dateTime}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-gray-800 text-gray-300 rounded font-semibold text-[10px]">
                      Завершен
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal for adding appointment */}
      {showAddApptModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#14171C] rounded-2xl max-w-md w-full p-6 border border-gray-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-bold text-gray-100 text-base">Запись к врачу / Добавить приём</h3>
              <button
                onClick={() => setShowAddApptModal(false)}
                className="text-gray-400 hover:text-gray-200 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-gray-300 mb-1">Специальность врача</label>
                <input
                  type="text"
                  required
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-300 mb-1">ФИО врача</label>
                <input
                  type="text"
                  required
                  value={newDoctorName}
                  onChange={(e) => setNewDoctorName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-300 mb-1">Медицинский центр / Клиника</label>
                <input
                  type="text"
                  required
                  value={newClinic}
                  onChange={(e) => setNewClinic(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-300 mb-1">Дата и время приёма</label>
                <input
                  type="text"
                  required
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-300 mb-1">Цель визита / Жалобы</label>
                <textarea
                  rows={2}
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddApptModal(false)}
                  className="px-4 py-2 text-gray-400 hover:bg-gray-800 rounded-lg font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg hover:bg-emerald-400 cursor-pointer"
                >
                  Сохранить запись
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Voluntary Questionnaire Proposal Modal */}
      <QuestionnaireProposalModal
        isOpen={isProposalOpen}
        onClose={() => setIsProposalOpen(false)}
        onStartSurvey={() => {
          setIsProposalOpen(false);
          onNavigate('questionnaire');
        }}
        onDecline={() => {
          setIsProposalOpen(false);
          setIsIntroDismissed(true);
        }}
      />

      {/* Data Collection Explained Modal */}
      <DataCollectionExplainedModal
        isOpen={isExplainedOpen}
        onClose={() => setIsExplainedOpen(false)}
      />

      {/* Questionnaire History Modal */}
      <SurveyHistoryModal
        isOpen={isSurveyHistoryOpen}
        onClose={() => setIsSurveyHistoryOpen(false)}
        snapshots={user.questionnaireHistory || []}
        onRetakeSurvey={() => {
          setIsSurveyHistoryOpen(false);
          onNavigate('questionnaire');
        }}
      />
    </div>
  );
};
