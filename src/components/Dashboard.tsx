import React, { useState, useEffect } from 'react';
import { analyzeMedicalDocument } from '../utils/analyzeMedicalDocument';
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
import HomeDashboard from './HomeDashboard';

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
    const result: Array<{ day: string; energy: number; sleep: number; stress: number; mood: number }> = [];

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
        const avgEnergy = Math.round(
          (dayDiary.reduce((acc, curr) => acc + (curr.energy_score || 5), 0) / dayDiary.length) * 10
        );
        const avgStress = Math.round(
          (dayDiary.reduce((acc, curr) => acc + (curr.stress_score || curr.anxiety_score || 3), 0) / dayDiary.length) * 10
        );
        const avgMood = Math.round(
          (dayDiary.reduce((acc, curr) => acc + (curr.state_score || 6), 0) / dayDiary.length) * 10
        );
        const sleepEntry = dayDiary.find((e) => e.physical_factors?.sleepDurationHours !== undefined);
        const avgSleep = sleepEntry?.physical_factors?.sleepDurationHours
          ? Math.min(100, Math.round((sleepEntry.physical_factors.sleepDurationHours / 8) * 100))
          : 70;

        result.push({ day: dayName, energy: avgEnergy, sleep: avgSleep, stress: avgStress, mood: avgMood });
      } else if (dayLogs.length > 0) {
        const lastL = dayLogs[dayLogs.length - 1];
        result.push({
          day: dayName,
          energy: lastL.energy,
          sleep: lastL.sleep,
          stress: lastL.stress,
          mood: lastL.mood,
        });
      } else {
        result.push({
          day: dayName,
          energy: 0,
          sleep: 0,
          stress: 0,
          mood: 0,
        });
      }
    }

    const activeDays = result.filter((r) => r.energy > 0 || r.sleep > 0 || r.stress > 0 || r.mood > 0).length;
    if (activeDays < 2) {
      return { metricsTrendData: [], hasEnoughChartData: false };
    }

    return { metricsTrendData: result, hasEnoughChartData: true };
  }, [diaryEntries, dailyLogs, pressureLogs, chartPeriod]);

  // Real Document Upload & Verification State
  const [uploadStatusStep, setUploadStatusStep] = useState('Загружаем документ...');
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFailedFile, setLastFailedFile] = useState<File | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [recognizedData, setRecognizedData] = useState<RecognizedDocumentData | null>(null);

  // Real OCR & Gemini Recognition Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] } }) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setUploadError(null);
    setLastFailedFile(null);
    setIsUploading(true);
    setUploadProgress(10);
    setUploadStatusStep('Проверка формата и чтение файла...');

    try {
      // Create local preview URL for image files
      if (file.type.startsWith('image/')) {
        setSelectedFilePreview(URL.createObjectURL(file));
      } else {
        setSelectedFilePreview(null);
      }

      const parsedResult = await analyzeMedicalDocument(file, 'lab', (step, percent) => {
        setUploadStatusStep(step);
        setUploadProgress(percent);
      });

      setRecognizedData(parsedResult);
      setIsVerificationModalOpen(true);
    } catch (err: any) {
      console.error('Document analysis error:', err);
      const errMsg = err?.message || 'Не удалось распознать медицинский документ';
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
        <div className="space-y-6">
          {/* Header Banner for Research View */}
          <div className="bg-[#101A28] border border-white/[0.08] p-5 sm:p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#4DEBFF]/10 border border-[#4DEBFF]/20 text-[#4DEBFF] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Архив исследований и лабораторных анализов</h3>
                <p className="text-xs text-white/60 mt-0.5 max-w-xl">
                  Здесь сохраняются все расшифрованные анализы, УЗИ и консультации врачей. Чтобы добавить новое исследование, воспользуйтесь формой загрузки в Настройках.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="px-4 py-2.5 bg-[#34F5A4] hover:bg-[#2be093] text-[#050A12] font-extrabold text-xs rounded-xl shadow-lg shadow-[#34F5A4]/20 transition-all flex items-center gap-2 cursor-pointer relative">
                <Upload className="w-4 h-4" />
                <span>Загрузить бланк (JPG, PNG, PDF)</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
              <button
                onClick={() => onNavigate('settings')}
                className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <span>Все настройки</span>
              </button>
            </div>
          </div>

          {/* Uploading Status Banner */}
          {isUploading && (
            <div className="bg-[#101A28] border border-[#4DEBFF]/30 p-4 rounded-2xl space-y-2 text-xs text-[#4DEBFF]">
              <div className="flex items-center justify-between font-bold">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin text-[#4DEBFF]" />
                  <span>{uploadStatusStep}</span>
                </div>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#4DEBFF] to-[#34F5A4] h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-start justify-between gap-3 text-xs text-red-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-300">Ошибка обработки документа</p>
                  <p className="text-red-200/80 mt-0.5">{uploadError}</p>
                </div>
              </div>
              {lastFailedFile && (
                <button
                  onClick={handleRetryUpload}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-100 font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Повторить</span>
                </button>
              )}
            </div>
          )}

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
