import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  DashboardTab,
  MedicalDocument,
  Appointment,
  BodySystem,
  ScreenId,
  Reminder,
  StructuredHealthAnalysis,
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
  RecognizedDocumentData,
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
      const data = await res.json();
      if (data.success && data.analysis) {
        setHealthAnalysis(data.analysis);
      }
    } catch (err) {
      console.error('Failed to fetch health analysis:', err);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    fetchHealthAnalysis();
  }, [documents, user]);
  const metricsTrendData = [
    { day: 'Пн', energy: 65, sleep: 70, stress: 45, mood: 60 },
    { day: 'Вт', energy: 70, sleep: 75, stress: 40, mood: 68 },
    { day: 'Ср', energy: 58, sleep: 60, stress: 55, mood: 55 },
    { day: 'Чт', energy: 80, sleep: 82, stress: 30, mood: 80 },
    { day: 'Пт', energy: 85, sleep: 80, stress: 35, mood: 85 },
    { day: 'Сб', energy: 90, sleep: 88, stress: 25, mood: 90 },
    { day: 'Вс', energy: 78, sleep: 85, stress: 35, mood: 82 },
  ];

  // Real Document Upload & Verification State
  const [uploadStatusStep, setUploadStatusStep] = useState('Загружаем документ...');
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [recognizedData, setRecognizedData] = useState<RecognizedDocumentData | null>(null);

  // Real 2-Stage OCR & Gemini Recognition Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsUploading(true);
    setUploadProgress(15);
    setUploadStatusStep('Загружаем документ на сервер...');

    // Convert file to Base64
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      setSelectedFilePreview(result);
      const base64Content = result.split(',')[1] || '';

      setUploadProgress(40);
      setUploadStatusStep('ИИ считывает бланковые данные (OCR)...');

      try {
        setUploadProgress(70);
        setUploadStatusStep('Извлекаем показатели и референсы...');

        const res = await fetch('/api/research/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64Content,
            mimeType: file.type || 'image/png',
            fileName: file.name,
            userId: user.id || 'usr-1',
          }),
        });

        const data = await res.json();
        setUploadProgress(100);

        if (data.success && data.data) {
          setRecognizedData(data.data);
          setIsVerificationModalOpen(true);
        } else {
          alert('Ошибка распознавания. Документ будет открыт с шаблонными полями.');
        }
      } catch (err) {
        console.error('File recognition error:', err);
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    };
    reader.readAsDataURL(file);
  };

  // Confirm and save user verified data
  const handleConfirmSaveRecognizedDoc = async (confirmed: RecognizedDocumentData) => {
    // 1. Create frontend document entry
    const newDoc: MedicalDocument = {
      id: `doc-${Date.now()}`,
      title: confirmed.documentType || 'Распознанный анализ',
      date: confirmed.researchDate || new Date().toLocaleDateString('ru-RU'),
      category: 'lab',
      categoryLabel: confirmed.documentType || 'Лабораторные анализы',
      summary: `Исследование проанализировано. Проверено показателей: ${confirmed.results.length}. Лаборатория: ${confirmed.laboratoryName}.`,
      deviations: confirmed.results
        .filter((item) => item.status !== 'normal')
        .map((item) => ({
          marker: item.originalName,
          value: `${item.value} ${item.unit}`.trim(),
          norm: item.referenceText || `${item.referenceMin || ''} - ${item.referenceMax || ''}`,
          status: item.status === 'low' ? 'Ниже' : item.status === 'high' ? 'Выше' : 'Внимание',
          explanation: item.status === 'low' ? 'Ниже референсного диапазона лаборатории.' : 'Выше референсного диапазона лаборатории.',
        })),
      recommendations: [
        'Показатели успешно сохранены в историю исследовательской динамометрии.',
        'Для полной интерпретации обратитесь к лечащему врачу.',
      ],
    };

    setDocuments((prev) => [newDoc, ...prev]);

    // 2. Persist to Google Sheets / Google Apps Script via proxy
    try {
      await fetch('/api/sheets/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveRecognizedDocument',
          userId: user.id || 'usr-1',
          payload: {
            document_id: newDoc.id,
            document_type: confirmed.documentType,
            laboratory_name: confirmed.laboratoryName,
            research_date: confirmed.researchDate,
            results: confirmed.results,
          },
        }),
      });
    } catch (err) {
      console.error('Sheets sync error:', err);
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
      {/* SUB-TAB 1: ГЛАВНАЯ (PERSONAL WORK DASHBOARD - 10-BLOCK STRUCTURE) */}
      {activeTab === 'main' && (
        <div className="space-y-6 sm:space-y-8 max-w-[1320px] mx-auto font-[SF Pro Display],Inter text-white pb-28 px-1 sm:px-2">
          {/* BLOCK 1: COMPACT WORK HEADER */}
          <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Добрый день, {user?.fullName ? user.fullName.split(' ')[0] : 'Пользователь'}
                </h1>
                <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-[#34F5A4]/15 border border-[#34F5A4]/30 text-[#34F5A4] font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> ИИ 2.0
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/60 font-medium">
                Сводка состояния на сегодня • {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={fetchHealthAnalysis}
                disabled={isLoadingAnalysis}
                className="px-4 py-2.5 bg-[#101A28] hover:bg-white/[0.06] text-white/90 border border-white/10 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalysis ? 'animate-spin text-[#34F5A4]' : ''}`} />
                <span>{isLoadingAnalysis ? 'Идет анализ...' : 'Обновить анализ ИИ'}</span>
              </button>

              <button
                onClick={() => onNavigate('daily_checkin')}
                className="px-4 py-2.5 bg-[#34F5A4] hover:bg-[#2ce093] text-slate-950 font-black text-xs rounded-xl transition-all shadow-md shadow-[#34F5A4]/20 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Чек-ин</span>
              </button>
            </div>
          </div>

          {/* BLOCK 1.5: NEW USER INTRO CARD & MATURITY STAGE INDICATOR */}
          {!isIntroDismissed && !user.introCardDismissedAt && (
            <NewUserIntroCard
              onAccelerateAnalysis={() => setIsProposalOpen(true)}
              onExplainDataCollection={() => setIsExplainedOpen(true)}
              onDismiss={() => setIsIntroDismissed(true)}
            />
          )}

          <MaturityStageIndicator
            daysSinceRegistration={
              user.registrationDate
                ? Math.max(0, Math.floor((new Date().getTime() - new Date(user.registrationDate).getTime()) / (1000 * 3600 * 24)))
                : 0
            }
            hasSurvey={Boolean(user.questionnaireHistory && user.questionnaireHistory.length > 0)}
            documentsCount={documents.length}
            diaryEntriesCount={0}
            onOpenProposal={() => setIsProposalOpen(true)}
          />

          {/* SITUATIONAL LEARNING PROMPT (MAX 1 AT A TIME) */}
          {!isSituationalPromptDismissed && (
            <div className="bg-[#121824] border border-teal-500/30 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-gray-200 font-medium">
                  Как вы чувствуете себя сегодня? Запись займёт меньше минуты
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onNavigate('daily_checkin')}
                  className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-[11px] rounded-lg transition-all"
                >
                  Заполнить
                </button>
                <button
                  onClick={() => setIsSituationalPromptDismissed(true)}
                  className="text-gray-500 hover:text-gray-300 p-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* BLOCK 1.8: "ЛЕКАРСТВА СЕГОДНЯ" (MEDICATION TODAY CHECKLIST BLOCK) */}
          <MedicationTodaySection
            user={user}
            reminders={reminders}
            onNavigate={onNavigate}
            onOpenAddMedication={() => onNavigate('reminders')}
          />

          {/* BLOCK 2: RED FLAG ALERT BANNER (IF PRESENT) */}
          {healthAnalysis?.urgentAlert && (
            <RedFlagBanner alert={healthAnalysis.urgentAlert} />
          )}

          {/* BLOCK 3: OVERALL AI SUMMARY CARD */}
          {healthAnalysis && (
            <OverallAiSummaryCard analysis={healthAnalysis} />
          )}

          {/* BLOCK 4: 4 CORE HEALTH METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Общее состояние */}
            <div className="bg-[#0B1320] border border-white/[0.08] hover:border-white/20 rounded-2xl sm:rounded-3xl p-5 shadow-xl transition-all flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-white/70">Общее состояние</span>
                <div className="w-9 h-9 rounded-xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 text-[#34F5A4] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Heart className="w-4.5 h-4.5 fill-[#34F5A4]" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none mb-1">
                  {healthAnalysis?.overallStatus === 'insufficient_data'
                    ? 'Начинаем сбор'
                    : healthAnalysis
                    ? `${Math.round(healthAnalysis.overallScore * 10)}%`
                    : '84%'}
                </div>
                <div className="text-xs text-[#34F5A4] font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34F5A4]" />
                  <span>
                    {healthAnalysis?.overallStatus === 'insufficient_data'
                      ? 'Начальный этап'
                      : user.isQuestionnaireCompleted
                      ? 'Оценка по опросу'
                      : 'Стабильное / Норма'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Энергия */}
            <div className="bg-[#0B1320] border border-white/[0.08] hover:border-white/20 rounded-2xl sm:rounded-3xl p-5 shadow-xl transition-all flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-white/70">Энергия</span>
                <div className="w-9 h-9 rounded-xl bg-[#4DEBFF]/10 border border-[#4DEBFF]/20 text-[#4DEBFF] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-4.5 h-4.5 fill-[#4DEBFF]" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none mb-1">
                  {user.psychology?.stressLevel ? `${(10 - user.psychology.stressLevel) * 10}%` : 'Добавьте запись'}
                </div>
                <div className="text-xs text-[#4DEBFF] font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4DEBFF]" />
                  <span>По записям дневника</span>
                </div>
              </div>
            </div>

            {/* Card 3: Сон */}
            <div className="bg-[#0B1320] border border-white/[0.08] hover:border-white/20 rounded-2xl sm:rounded-3xl p-5 shadow-xl transition-all flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-white/70">Сон</span>
                <div className="w-9 h-9 rounded-xl bg-[#8E74FF]/10 border border-[#8E74FF]/20 text-[#8E74FF] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Moon className="w-4.5 h-4.5 fill-[#8E74FF]" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none mb-1">
                  {user.psychology?.sleepHours ? `${user.psychology.sleepHours}ч` : 'Пока нет данных'}
                </div>
                <div className="text-xs text-[#8E74FF] font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8E74FF]" />
                  <span>{user.psychology?.sleepHours ? 'Среднесуточный отдых' : 'Добавьте первую запись о сне'}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Прогноз ресурса */}
            <div className="bg-[#0B1320] border border-white/[0.08] hover:border-white/20 rounded-2xl sm:rounded-3xl p-5 shadow-xl transition-all flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-white/70">Прогноз ресурса</span>
                <div className="w-9 h-9 rounded-xl bg-[#FF8C42]/10 border border-[#FF8C42]/20 text-[#FF8C42] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none mb-1">
                  {healthAnalysis?.resourceForecast?.level === 'insufficient_data'
                    ? 'Появится позже'
                    : healthAnalysis?.resourceForecast?.level === 'high'
                    ? 'Высокий'
                    : 'Хороший'}
                </div>
                <div className="text-xs text-[#FF8C42] font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF8C42]" />
                  <span>
                    {healthAnalysis?.resourceForecast?.level === 'insufficient_data'
                      ? 'После накопления динамики'
                      : 'На ближайшие 3 дня'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCK 5: "ЧТО ТРЕБУЕТ ВНИМАНИЯ" (ATTENTION ITEMS DEVIATIONS BLOCK) */}
          <div id="attention-items-block" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FF8C42]/10 border border-[#FF8C42]/20 text-[#FF8C42] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base sm:text-xl tracking-tight">
                    Что требует внимания ({healthAnalysis?.attentionItems?.length || 0})
                  </h3>
                  <p className="text-xs text-white/60">
                    Детализированный двухуровневый анализ всех отклонений в лабораторных бланках и симптомах.
                  </p>
                </div>
              </div>
            </div>

            {healthAnalysis?.attentionItems && healthAnalysis.attentionItems.length > 0 ? (
              <div className="space-y-4">
                {healthAnalysis.attentionItems.map((item) => (
                  <AttentionItemCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="bg-[#0B1320] border border-white/[0.08] p-6 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#34F5A4] mx-auto" />
                <h4 className="font-bold text-white text-sm">Все ключевые лабораторные маркеры в норме</h4>
                <p className="text-xs text-white/60">
                  По загруженным бланкам и анкете отклонений референсного диапазона не выявлено.
                </p>
              </div>
            )}
          </div>

          {/* BLOCK 6: REPORT BY 12 BODY SYSTEMS */}
          {healthAnalysis?.systems && (
            <BodySystemsSection
              systems={healthAnalysis.systems}
              onNavigateBodyMap={() => onNavigate('body_map')}
            />
          )}

          {/* BLOCK 7 & 8: PSYCHOEMOTIONAL & INDICATOR DYNAMICS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            {/* BLOCK 7: ПСИХОЭМОЦИОНАЛЬНОЕ СОСТОЯНИЕ */}
            <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#4DEBFF]/10 border border-[#4DEBFF]/20 text-[#4DEBFF] flex items-center justify-center">
                      <Brain className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-white text-base sm:text-lg">Психоэмоциональный баланс</h3>
                  </div>
                  <span className="text-xs text-[#34F5A4] font-bold bg-[#34F5A4]/10 border border-[#34F5A4]/20 px-2.5 py-0.5 rounded-full">
                    Стабилен
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                  <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-white/10"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-[#34F5A4]"
                        strokeDasharray="82, 100"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-black text-white">82%</span>
                      <span className="text-[10px] text-[#34F5A4] font-semibold uppercase">Баланс</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs flex-1 w-full">
                    <div className="bg-[#101A28] p-3 rounded-xl border border-white/[0.04] space-y-1">
                      <span className="text-white/60 block text-[10px]">Уровень стресса:</span>
                      <span className="font-bold text-white block text-sm">3 / 10 (Умеренный)</span>
                    </div>
                    <div className="bg-[#101A28] p-3 rounded-xl border border-white/[0.04] space-y-1">
                      <span className="text-white/60 block text-[10px]">Ключевые триггеры:</span>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-[#FF8C42]/10 text-[#FF8C42] rounded text-[10px] font-medium">Недосып</span>
                        <span className="px-2 py-0.5 bg-[#8E74FF]/10 text-[#8E74FF] rounded text-[10px] font-medium">Дедлайны</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigate('mental_diary')}
                className="w-full py-3 px-4 bg-[#101A28] hover:bg-white/[0.06] text-[#34F5A4] border border-[#34F5A4]/30 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>Открыть дневник ментального здоровья</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* BLOCK 8: ДИНАМИКА ПОКАЗАТЕЛЕЙ (TREND CHART) */}
            <div className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <h3 className="font-bold text-white text-base sm:text-lg">Динамика самочувствия</h3>
                <select
                  value={chartPeriod}
                  onChange={(e) => setChartPeriod(e.target.value as any)}
                  className="bg-[#101A28] text-xs text-white/80 border border-white/10 rounded-xl px-3 py-1.5 focus:outline-none"
                >
                  <option value="7d">7 дней</option>
                  <option value="14d">14 дней</option>
                  <option value="30d">30 дней</option>
                </select>
              </div>

              <div className="h-44 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.38)" fontSize={11} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.38)" fontSize={11} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101A28',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '1rem',
                        fontSize: '12px',
                        color: '#fff',
                      }}
                    />
                    <Line type="monotone" dataKey="energy" stroke="#34F5A4" strokeWidth={2.5} dot={false} name="Энергия" />
                    <Line type="monotone" dataKey="sleep" stroke="#4DEBFF" strokeWidth={2.5} dot={false} name="Сон" />
                    <Line type="monotone" dataKey="stress" stroke="#8E74FF" strokeWidth={2.5} dot={false} name="Стресс" />
                    <Line type="monotone" dataKey="mood" stroke="#FF8C42" strokeWidth={2.5} dot={false} name="Настроение" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/60 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#34F5A4]" />
                  <span>Энергия</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#4DEBFF]" />
                  <span>Сон</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#8E74FF]" />
                  <span>Стресс</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FF8C42]" />
                  <span>Настроение</span>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCK 9: ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ ИI (SAFE LIFESTYLE ADVICE ONLY) */}
          <div id="personal-recommendations-block" className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-3">
              <div className="w-8 h-8 rounded-xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 text-[#34F5A4] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                Персональные рекомендации по образу жизни
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(healthAnalysis?.dailyRecommendations || [
                'Соблюдайте режим сна: засыпайте до 23:00 и спите не менее 7.5 часов.',
                'Пейте достаточный объем чистой воды (не менее 1.5 - 2 литров в день).',
                'Включите в рацион больше продуктов с высоким содержанием клетчатки и Витамина D3.',
                'Проводите на свежем воздухе не менее 30 минут в день.',
              ]).map((rec, idx) => (
                <div key={idx} className="p-4 bg-[#101A28] rounded-2xl border border-white/[0.04] flex items-start gap-3 text-xs sm:text-sm text-white/90">
                  <span className="w-2 h-2 rounded-full bg-[#34F5A4] mt-1.5 shrink-0" />
                  <span className="leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BLOCK 10: БЫСТРЫЕ ДЕЙСТВИЯ (QUICK ACTIONS BAR) */}
          <div id="quick-actions-block" className="bg-[#0B1320] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl space-y-4">
            <h3 className="font-bold text-white text-base sm:text-lg border-b border-white/[0.06] pb-3">
              Быстрые действия
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <button
                onClick={() => setActiveTab('lab')}
                className="p-4 bg-[#101A28] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#34F5A4]/40 rounded-2xl text-left transition-all group cursor-pointer space-y-3"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 text-[#34F5A4] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-white text-xs sm:text-sm block">Загрузить бланк</span>
                  <span className="text-[10px] text-white/40 block mt-0.5">Анализы / УЗИ</span>
                </div>
              </button>

              <button
                onClick={() => onNavigate('daily_checkin')}
                className="p-4 bg-[#101A28] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#4DEBFF]/40 rounded-2xl text-left transition-all group cursor-pointer space-y-3"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#4DEBFF]/10 border border-[#4DEBFF]/20 text-[#4DEBFF] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-white text-xs sm:text-sm block">Дневной чек-ин</span>
                  <span className="text-[10px] text-white/40 block mt-0.5">Записать самочувствие</span>
                </div>
              </button>

              <button
                onClick={() => onNavigate('mental_diary')}
                className="p-4 bg-[#101A28] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#8E74FF]/40 rounded-2xl text-left transition-all group cursor-pointer space-y-3"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#8E74FF]/10 border border-[#8E74FF]/20 text-[#8E74FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-white text-xs sm:text-sm block">Дневник эмоций</span>
                  <span className="text-[10px] text-white/40 block mt-0.5">Ментальное состояние</span>
                </div>
              </button>

              <button
                onClick={() => onNavigate('reminders')}
                className="p-4 bg-[#101A28] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#FF8C42]/40 rounded-2xl text-left transition-all group cursor-pointer space-y-3"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#FF8C42]/10 border border-[#FF8C42]/20 text-[#FF8C42] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-white text-xs sm:text-sm block">Напоминания</span>
                  <span className="text-[10px] text-white/40 block mt-0.5">Лекарства и приёмы</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ИССЛЕДОВАНИЯ И АНАЛИЗЫ */}
      {activeTab === 'lab' && (
        <div className="space-y-6">
          {/* Upload Dropzone */}
          <div className="bg-[#14171C] p-6 sm:p-8 rounded-3xl border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/5 transition-all text-center space-y-3 relative">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
            />
            <div className="w-14 h-14 bg-emerald-500 text-slate-950 rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-gray-100 text-base">Загрузить медицинский документ или бланк</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Перетащите сюда фото или PDF лабораторного исследования. Наш ИИ автоматически извлечёт результаты с выбором точных нормативных единиц.
              </p>
            </div>
            <div className="pt-1">
              <span className="inline-block px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-sm">
                Выбрать файл с устройства
              </span>
            </div>

            {isUploading && (
              <div className="absolute inset-0 bg-[#14171C]/95 rounded-3xl flex flex-col items-center justify-center space-y-3 z-20 p-6">
                <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
                <span className="font-bold text-gray-100 text-sm">
                  {uploadStatusStep} ({uploadProgress}%)
                </span>
                <div className="w-64 bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Research Document Verification Modal */}
          <ResearchVerificationModal
            isOpen={isVerificationModalOpen}
            onClose={() => setIsVerificationModalOpen(false)}
            documentData={recognizedData}
            filePreviewUrl={selectedFilePreview}
            fileName={selectedFileName}
            onConfirmSave={handleConfirmSaveRecognizedDoc}
          />

          {/* Category Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-gray-400 shrink-0">Категории:</span>
            {[
              { id: 'all', label: 'Все документы' },
              { id: 'lab', label: 'Лабораторные анализы' },
              { id: 'ultrasound', label: 'УЗИ и МРТ' },
              { id: 'instrumental', label: 'Инструментальные' },
              { id: 'consultations', label: 'Консультации врачей' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setDocFilter(cat.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  docFilter === cat.id
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Documents List */}
          <div className="space-y-4">
            {documents
              .filter((doc) => docFilter === 'all' || doc.category === docFilter)
              .map((doc) => (
                <div
                  key={doc.id}
                  className="bg-[#14171C] rounded-2xl border border-gray-800 shadow-sm p-6 space-y-4 hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-gray-800 pb-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {doc.categoryLabel}
                      </span>
                      <h3 className="font-bold text-gray-100 text-base">{doc.title}</h3>
                      <p className="text-xs text-gray-400">Дата исследования: {doc.date}</p>
                    </div>

                    <button
                      onClick={() => setDocuments((prev) => prev.filter((d) => d.id !== doc.id))}
                      className="text-gray-500 hover:text-rose-400 p-1 cursor-pointer"
                      title="Удалить файл"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-gray-300 bg-[#0F1115] p-3 rounded-xl leading-relaxed border border-gray-800/60">
                    <strong className="text-gray-100">Резюме ИИ:</strong> {doc.summary}
                  </p>

                  {/* Deviations Table */}
                  {doc.deviations.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-200 block">Отклонения от нормативов:</span>
                        <span className="text-[10px] text-gray-400 sm:hidden">Качественный анализ</span>
                      </div>

                      {/* Mobile Cards View */}
                      <div className="space-y-2 sm:hidden">
                        {doc.deviations.map((dev, idx) => (
                          <div key={idx} className="bg-[#0F1115] border border-gray-800/80 rounded-xl p-3 flex items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <span className="font-bold text-gray-100 text-xs block">{dev.marker}</span>
                              <div className="text-[11px] text-gray-400">
                                Значение: <span className="text-gray-200 font-semibold">{dev.value}</span> • Норма: <span className="text-gray-400">{dev.norm}</span>
                              </div>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-md font-bold text-[10px] shrink-0 ${
                                dev.status === 'Ниже' || dev.status === 'Выше'
                                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                              }`}
                            >
                              {dev.status}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden sm:block overflow-x-auto border border-gray-800/80 rounded-xl bg-[#0F1115]/80">
                        <table className="w-full min-w-[500px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-400 font-semibold bg-[#0F1115]">
                              <th className="py-2.5 px-3">Показатель</th>
                              <th className="py-2.5 px-3">Значение</th>
                              <th className="py-2.5 px-3">Норма</th>
                              <th className="py-2.5 px-3">Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            {doc.deviations.map((dev, idx) => (
                              <tr key={idx} className="border-b border-gray-800/50">
                                <td className="py-2.5 px-3 font-semibold text-gray-100">{dev.marker}</td>
                                <td className="py-2.5 px-3 text-gray-200">{dev.value}</td>
                                <td className="py-2.5 px-3 text-gray-400">{dev.norm}</td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                      dev.status === 'Ниже' || dev.status === 'Выше'
                                        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                                        : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                                    }`}
                                  >
                                    {dev.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {doc.recommendations.length > 0 && (
                    <div className="pt-2 border-t border-gray-800 space-y-1">
                      <span className="text-[11px] font-bold text-gray-300">Рекомендованные шаги:</span>
                      <ul className="list-disc list-inside text-xs text-gray-400 space-y-0.5">
                        {doc.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
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
