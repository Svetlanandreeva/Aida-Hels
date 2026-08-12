import React, { useState, useEffect } from 'react';
import { UserProfile, Reminder, MedicalDocument, ScreenId, MedicationSchedule, WaterTrackerState } from '../types';
import { SecurityLockModal } from './SecurityLockModal';
import { MedicationSchedulePicker } from './MedicationSchedulePicker';
import { ResearchVerificationModal, StagingRecordPayload } from './modals/ResearchVerificationModal';
import { processLabDocumentThroughStaging } from '../utils/analyzeMedicalDocument';
import {
  Settings,
  Users,
  LogOut,
  Bell,
  Shield,
  Copy,
  Check,
  Pill,
  Upload,
  Plus,
  Trash2,
  FileText,
  Clock,
  Sparkles,
  CheckCircle2,
  Volume2,
  Moon,
  ChevronRight,
  AlertCircle,
  Calendar,
  SlidersHorizontal,
  X,
  FileCheck,
  Scan,
  Lock,
  KeyRound,
  Edit3,
  Droplet,
  RotateCcw,
  Archive,
  History,
  Download,
  Watch,
  ShieldCheck,
} from 'lucide-react';

interface SettingsScreenProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  reminders?: Reminder[];
  setReminders?: React.Dispatch<React.SetStateAction<Reminder[]>>;
  documents?: MedicalDocument[];
  setDocuments?: React.Dispatch<React.SetStateAction<MedicalDocument[]>>;
  onLogout: () => void;
  onDeleteProfile?: () => Promise<void> | void;
  onNavigate?: (screen: ScreenId) => void;
  biometricsEnabled?: boolean;
  setBiometricsEnabled?: (enabled: boolean) => void;
  userPin?: string;
  setUserPin?: (pin: string) => void;
  onLockApp?: () => void;
}

type TabType = 'all' | 'notifications' | 'medications' | 'documents' | 'security';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  user,
  setUser,
  reminders = [],
  setReminders,
  documents = [],
  setDocuments,
  onLogout,
  onDeleteProfile,
  onNavigate,
  biometricsEnabled: externalBiometricsEnabled,
  setBiometricsEnabled: externalSetBiometricsEnabled,
  userPin: externalUserPin,
  setUserPin: externalSetUserPin,
  onLockApp,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [copied, setCopied] = useState(false);
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

  // Notification settings states
  const [notifMedication, setNotifMedication] = useState(true);
  const [notifAppointments, setNotifAppointments] = useState(true);
  const [notifCheckins, setNotifCheckins] = useState(true);
  const [notifAiReport, setNotifAiReport] = useState(true);
  const [morningTime, setMorningTime] = useState('09:00');
  const [eveningTime, setEveningTime] = useState('21:00');
  const [soundMode, setSoundMode] = useState<'gentle' | 'pulse' | 'silent'>('gentle');
  const [quietHours, setQuietHours] = useState(true);

  // Biometrics & PIN state synced with localStorage / external props
  const [localBiometrics, setLocalBiometrics] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_biometrics_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [localPin, setLocalPin] = useState<string>(() => {
    return localStorage.getItem('app_pin_code') || '';
  });

  const biometricsEnabled = externalBiometricsEnabled ?? localBiometrics;
  const userPin = externalUserPin ?? localPin;

  const handleToggleBiometrics = (enabled: boolean) => {
    if (enabled && !userPin) {
      // Require user to set PIN code first when enabling
      setLockModalMode('setup');
      setShowLockModal(true);
      return;
    }
    setLocalBiometrics(enabled);
    localStorage.setItem('app_biometrics_enabled', JSON.stringify(enabled));
    if (externalSetBiometricsEnabled) {
      externalSetBiometricsEnabled(enabled);
    }
  };

  const handleUpdateUserPin = (newPin: string) => {
    setLocalPin(newPin);
    localStorage.setItem('app_pin_code', newPin);
    if (externalSetUserPin) {
      externalSetUserPin(newPin);
    }
  };

  // Security & PIN code modal states
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockModalMode, setLockModalMode] = useState<'verify' | 'setup'>('verify');
  const [lockNotice, setLockNotice] = useState<string | null>(null);

  const handleOpenLockVerification = () => {
    setLockModalMode('verify');
    setShowLockModal(true);
  };

  const handleOpenLockSetup = () => {
    setLockModalMode('setup');
    setShowLockModal(true);
  };

  const handleSecuritySuccess = (newPin?: string) => {
    setShowLockModal(false);
    if (lockModalMode === 'setup' && newPin) {
      handleUpdateUserPin(newPin);
      setLockNotice('Новый 4-значный PIN-код успешно установлен!');
      setTimeout(() => setLockNotice(null), 3500);
    } else {
      setLockNotice('Авторизация по Face ID / PIN прошла успешно!');
      setTimeout(() => setLockNotice(null), 3500);
    }
  };

  // Medication Form & Editing state
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medTitle, setMedTitle] = useState('');
  
  // Structured dosage fields
  const [doseQuantity, setDoseQuantity] = useState<number>(1);
  const [doseForm, setDoseForm] = useState<string>('капсула');
  const [doseActiveIngredient, setDoseActiveIngredient] = useState<string>('100 мг');
  
  const [medSchedule, setMedSchedule] = useState<MedicationSchedule>({
    morning: { enabled: true, time: '08:00' },
    afternoon: { enabled: false, time: '13:00' },
    evening: { enabled: false, time: '19:00' },
  });
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [medFrequency, setMedFrequency] = useState<'daily' | 'once' | 'weekly' | 'weekdays'>('daily');
  const [medNotes, setMedNotes] = useState('');

  // Archived / History Medications State
  const [archivedMeds, setArchivedMeds] = useState<Reminder[]>(() => {
    try {
      const saved = localStorage.getItem('archived_medications');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Auto-sync questionnaire medications to reminders
  useEffect(() => {
    if (!setReminders || !user) return;
    const userMeds: Array<{ title: string; time: string; notes?: string }> = [];

    if (Array.isArray(user.chronicDiagnoses)) {
      user.chronicDiagnoses.forEach((d) => {
        if (d.medication && d.medication !== 'Без медикаментов' && d.medication.trim()) {
          userMeds.push({
            title: d.medication.trim(),
            time: d.schedule?.morning?.time || '08:00',
            notes: `Назначено по диагнозу: ${d.name}`,
          });
        }
      });
    }

    if (Array.isArray(user.psychology?.psychiatricData?.medications)) {
      user.psychology.psychiatricData.medications.forEach((medName) => {
        if (medName && medName !== 'Без медикаментов' && medName.trim()) {
          userMeds.push({
            title: medName.trim(),
            time: '20:00',
            notes: 'Назначено специалистом (психологический профиль)',
          });
        }
      });
    }

    if (userMeds.length > 0) {
      setReminders((prev) => {
        let changed = false;
        const updated = [...prev];
        userMeds.forEach((m) => {
          const exists = updated.some(
            (r) => r.category === 'medication' && r.title.toLowerCase().trim() === m.title.toLowerCase().trim()
          );
          if (!exists) {
            changed = true;
            updated.push({
              id: `med-sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              title: m.title,
              category: 'medication',
              time: m.time,
              frequency: 'daily',
              dosage: 'По назначению',
              notes: m.notes,
              isEnabled: true,
            });
          }
        });
        return changed ? updated : prev;
      });
    }
  }, [user, setReminders]);

  // Water Tracker State
  const [waterState, setWaterState] = useState<WaterTrackerState>(() => {
    try {
      const saved = localStorage.getItem('water_tracker_data');
      return saved
        ? JSON.parse(saved)
        : {
            targetMl: 2000,
            consumedMl: 1000,
            logs: [],
            remindersEnabled: true,
            schedule: {
              morning: { enabled: true, time: '08:30' },
              afternoon: { enabled: true, time: '13:30' },
              evening: { enabled: true, time: '19:30' },
            },
          };
    } catch (e) {
      return { targetMl: 2000, consumedMl: 1000, logs: [], remindersEnabled: true };
    }
  });

  const handleAddWater = (amountMl: number) => {
    setWaterState((prev) => {
      const updated = {
        ...prev,
        consumedMl: Math.min(prev.targetMl * 2, prev.consumedMl + amountMl),
        logs: [
          { id: `w-${Date.now()}`, amountMl, timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) },
          ...prev.logs,
        ],
      };
      localStorage.setItem('water_tracker_data', JSON.stringify(updated));
      return updated;
    });
  };

  const handleResetWater = () => {
    setWaterState((prev) => {
      const updated = { ...prev, consumedMl: 0, logs: [] };
      localStorage.setItem('water_tracker_data', JSON.stringify(updated));
      return updated;
    });
  };

  // New Document Upload Form state
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<'lab' | 'ultrasound' | 'instrumental' | 'consultations'>('lab');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [stagingRecord, setStagingRecord] = useState<StagingRecordPayload | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  // Partner sync & cloud backup state
  const [linkedPartnerCode, setLinkedPartnerCode] = useState<string>(() => {
    return localStorage.getItem('app_linked_partner_code') || user.womenHealth?.linkedPartnerCode || '';
  });

  const handleCopyCode = () => {
    const code =
      user.womenHealth?.partnerSyncCode && user.womenHealth.partnerSyncCode !== 'PARTNER-DEMO-RU'
        ? user.womenHealth.partnerSyncCode
        : (user.id && user.id !== 'usr-new'
          ? `PARTNER-${user.id.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}-RU`
          : `PARTNER-${(user.fullName || 'USER').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'A1B2'}-RU`);
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLinkPartnerCode = () => {
    const code = partnerCodeInput.trim().toUpperCase();
    if (!code) {
      alert('Пожалуйста, введите код партнёра (например, PARTNER-A1B2-RU)');
      return;
    }
    setLinkedPartnerCode(code);
    localStorage.setItem('app_linked_partner_code', code);
    if (setUser) {
      setUser((prev) => ({
        ...prev,
        womenHealth: {
          ...(prev.womenHealth || { cycleLength: 28, periodDuration: 5, isRegular: true, pmsSymptoms: [], painLevel: 1, lastPeriodDate: '', partnerSyncCode: '', isPartnerSynced: false }),
          partnerSyncCode: code,
          isPartnerSynced: true,
        },
      }));
    }
    setPartnerCodeInput('');
    alert(`Аккаунт партнёра (${code}) успешно привязан! Синхронизация активирована.`);
  };

  const handleUnlinkPartnerCode = () => {
    setLinkedPartnerCode('');
    localStorage.removeItem('app_linked_partner_code');
    if (setUser) {
      setUser((prev) => ({
        ...prev,
        womenHealth: {
          ...(prev.womenHealth || { cycleLength: 28, periodDuration: 5, isRegular: true, pmsSymptoms: [], painLevel: 1, lastPeriodDate: '', partnerSyncCode: '', isPartnerSynced: false }),
          partnerSyncCode: '',
          isPartnerSynced: false,
        },
      }));
    }
    alert('Связь с партнёром отключена.');
  };

  // Cloud Backup JSON Export & Import
  const handleExportBackup = () => {
    const backupData = {
      app: 'Google AI Studio Health Assistant',
      version: '2.5.0',
      exportedAt: new Date().toISOString(),
      userProfile: user,
      reminders,
      documents,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Health_Card_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.userProfile && setUser) {
          setUser(parsed.userProfile);
        }
        if (Array.isArray(parsed.reminders) && setReminders) {
          setReminders(parsed.reminders);
        }
        if (Array.isArray(parsed.documents) && setDocuments) {
          setDocuments(parsed.documents);
        }
        alert('Данные медицинской карты успешно восстановлены из файла резервной копии!');
      } catch (err) {
        alert('Ошибка при чтении файла бэкапа. Проверьте формат JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Medication handlers
  const medicationList = reminders.filter((r) => r.category === 'medication');

  const handleToggleMedication = (id: string) => {
    if (!setReminders) return;
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isEnabled: !r.isEnabled } : r))
    );
  };

  const handleOpenAddMedModal = () => {
    setEditingMedId(null);
    setMedTitle('');
    setDoseQuantity(1);
    setDoseForm('капсула');
    setDoseActiveIngredient('100 мг');
    setMedSchedule({
      morning: { enabled: true, time: '08:00' },
      afternoon: { enabled: false, time: '13:00' },
      evening: { enabled: false, time: '19:00' },
    });
    setStartDate(new Date().toISOString().split('T')[0]);
    setMedFrequency('daily');
    setMedNotes('');
    setShowAddMedModal(true);
  };

  const handleEditMedication = (med: Reminder) => {
    setEditingMedId(med.id);
    setMedTitle(med.title);
    setDoseQuantity(med.doseQuantity || 1);
    setDoseForm(med.doseForm || 'капсула');
    setDoseActiveIngredient(med.doseActiveIngredient || '');
    setMedSchedule(med.schedule || {
      morning: { enabled: true, time: med.time || '08:00' },
    });
    setStartDate(med.startDate || new Date().toISOString().split('T')[0]);
    setMedFrequency(med.frequency || 'daily');
    setMedNotes(med.notes || '');
    setShowAddMedModal(true);
  };

  const handleSaveMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medTitle.trim() || !setReminders) return;

    const formattedDosage = `${doseQuantity} ${doseForm}${doseActiveIngredient ? ` · ${doseActiveIngredient}` : ''}`;
    const primaryTime =
      medSchedule.morning?.enabled ? medSchedule.morning.time :
      medSchedule.afternoon?.enabled ? medSchedule.afternoon.time :
      medSchedule.evening?.enabled ? medSchedule.evening.time : '09:00';

    if (editingMedId) {
      setReminders((prev) =>
        prev.map((item) =>
          item.id === editingMedId
            ? {
                ...item,
                title: medTitle,
                time: primaryTime,
                dosage: formattedDosage,
                doseQuantity,
                doseForm,
                doseActiveIngredient,
                schedule: medSchedule,
                startDate,
                frequency: medFrequency,
                notes: medNotes,
              }
            : item
        )
      );
    } else {
      const newMed: Reminder = {
        id: `med-${Date.now()}`,
        title: medTitle,
        category: 'medication',
        time: primaryTime,
        dosage: formattedDosage,
        doseQuantity,
        doseForm,
        doseActiveIngredient,
        schedule: medSchedule,
        startDate,
        frequency: medFrequency,
        notes: medNotes || 'Принимать строго по инструкции',
        isEnabled: true,
        sound: soundMode === 'pulse' ? 'pulse' : 'gentle',
      };
      setReminders((prev) => [newMed, ...prev]);
    }

    setShowAddMedModal(false);
  };

  const handleArchiveMedication = (id: string) => {
    if (!setReminders) return;
    const itemToArchive = medicationList.find((m) => m.id === id);
    if (itemToArchive) {
      const archivedItem = {
        ...itemToArchive,
        archivedAt: new Date().toLocaleDateString('ru-RU'),
      };
      const updatedArchive = [archivedItem, ...archivedMeds];
      setArchivedMeds(updatedArchive);
      localStorage.setItem('archived_medications', JSON.stringify(updatedArchive));
    }
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRestoreArchivedMedication = (med: Reminder) => {
    if (!setReminders) return;
    const restored = { ...med, isEnabled: true };
    setReminders((prev) => [restored, ...prev]);
    const updatedArchive = archivedMeds.filter((m) => m.id !== med.id);
    setArchivedMeds(updatedArchive);
    localStorage.setItem('archived_medications', JSON.stringify(updatedArchive));
  };

  const handlePermanentlyDeleteArchived = (id: string) => {
    const updatedArchive = archivedMeds.filter((m) => m.id !== id);
    setArchivedMeds(updatedArchive);
    localStorage.setItem('archived_medications', JSON.stringify(updatedArchive));
  };

  // Document handlers
  const handleDeleteDocument = (id: string) => {
    if (!setDocuments) return;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setDocuments) return;

    if (!selectedFile) {
      if (!docTitle.trim()) return;
      const categoryLabels: Record<string, string> = {
        lab: 'Лабораторные анализы',
        ultrasound: 'УЗИ и МРТ',
        instrumental: 'Инструментальная диагностика',
        consultations: 'Консультации врачей',
      };
      const newDoc: MedicalDocument = {
        id: `doc-${Date.now()}`,
        title: docTitle,
        date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        category: docCategory,
        categoryLabel: categoryLabels[docCategory] || 'Лабораторные анализы',
        summary: 'Запись о медицинском исследовании (ручной ввод).',
        deviations: [],
        recommendations: ['Сохраняйте плановый порядок консультаций с лечащим врачом.'],
      };
      setDocuments((prev) => [newDoc, ...prev]);
      setShowAddDocModal(false);
      setDocTitle('');
      return;
    }

    setIsAnalyzingFile(true);
    setAnalysisError(null);
    setAnalysisProgress('Чтение файла...');

    try {
      const record = await processLabDocumentThroughStaging(selectedFile, (step) => {
        setAnalysisProgress(step);
      });
      setStagingRecord(record);
      setIsAnalyzingFile(false);
      setShowAddDocModal(false);
      setIsVerificationModalOpen(true);
    } catch (err: any) {
      console.error('Document analysis error:', err);
      setIsAnalyzingFile(false);
      setAnalysisError(err?.message || 'Не удалось распознать документ. Проверьте формат бланка и четкость фото.');
    }
  };

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
      if (data.success && data.document && setDocuments) {
        setDocuments((prev) => [data.document, ...prev]);
      }
    } catch (err) {
      console.error('Commit staging error:', err);
    } finally {
      setIsVerificationModalOpen(false);
      setSelectedFile(null);
      setDocTitle('');
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-6 pb-32 sm:pb-36 text-white">
      {/* HEADER TITLE */}
      <div className="bg-[#0F142A]/80 border border-[#99AEFF]/15 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-2xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8968FF]/15 border border-[#8968FF]/30 text-[#C7B9FF] text-xs font-bold tracking-wide mb-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#47D8FF]" />
            <span>Центр управления приложением</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Настройки и управление
          </h1>
          <p className="text-sm text-gray-400 mt-1 max-w-xl">
            Единое место для настройки всех уведомлений, списка принимаемых лекарств и архива лабораторных исследований.
          </p>
        </div>

        {/* TAB FILTER BUTTONS */}
        <div className="flex flex-wrap gap-1.5 bg-[#050711] p-1.5 rounded-2xl border border-white/10 shrink-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] shadow-md shadow-[#8968FF]/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] shadow-md shadow-[#8968FF]/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Уведомления</span>
          </button>
          <button
            onClick={() => setActiveTab('medications')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'medications'
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] shadow-md shadow-[#8968FF]/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            <span>Лекарства</span>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-gradient-to-r from-[#8968FF] to-[#47D8FF] text-[#050711] shadow-md shadow-[#8968FF]/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Исследования</span>
          </button>
        </div>
      </div>

      {/* WEARABLES & INTEGRATIONS BANNER */}
      {onNavigate && (
        <div className="bg-gradient-to-r from-[#0F172A] via-[#111C30] to-[#0F172A] border border-[#3DD9C5]/30 rounded-[24px] p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#3DD9C5]/10 border border-[#3DD9C5]/30 flex items-center justify-center text-[#3DD9C5] shrink-0">
              <Watch className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white">Носимые устройства и Health-платформы</span>
                <span className="px-2 py-0.5 rounded-full bg-[#3DD9C5]/20 text-[#3DD9C5] text-[10px] font-bold">
                  Apple Health, Health Connect
                </span>
              </div>
              <p className="text-xs text-gray-300">
                Синхронизация пульса, шагов, давления и сна через 7-этапный адаптивный конвейер с отслеживанием источника (Provenance).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('integrations')}
            className="px-5 py-2.5 bg-[#3DD9C5] hover:bg-[#34c4b1] text-black font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <span>Управление гаджетами</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PERMISSION LAYER & FAMILY ACCESS CARD */}
      {(activeTab === 'all' || activeTab === 'privacy') && (
        <div className="bg-[#0B1320] border border-rose-500/20 rounded-[24px] p-6 sm:p-8 space-y-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Права доступа и семейный доступ (Deny by Default)</h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-extrabold uppercase">
                  Zero Trust Pipeline
                </span>
              </div>
              <p className="text-xs text-gray-300">
                6-этапный бэкенд-конвейер проверки прав. Точечная настройка 13 скоупов, защита сенситивных данных (`mental`, `cycle`, `pregnancy`, `location`) и мгновенный отзыв (Instant Revoke).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate && onNavigate('permissions')}
            className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <span>Управление семейным доступом</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: НАСТРОЙКА УВЕДОМЛЕНИЙ (NOTIFICATION SETTINGS) */}
      {(activeTab === 'all' || activeTab === 'notifications') && (
        <div className="bg-[#0B1320] border border-white/[0.06] rounded-[24px] p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 flex items-center justify-center text-[#34F5A4]">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Уведомления и сигналы</h2>
                <p className="text-xs text-white/60">Гибкая настройка напоминаний о чекинах, приёмах лекарств и отчетах</p>
              </div>
            </div>

            <button
              onClick={() => onNavigate && onNavigate('reminders')}
              className="text-xs font-bold text-[#34F5A4] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Открыть расписание сигналов</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Toggle 1: Medication */}
            <div className="bg-[#111C2C]/60 border border-white/[0.05] p-4 rounded-2xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-white block">Напоминания о приёме лекарств</span>
                <p className="text-xs text-white/50">Точный таймер для каждой таблетки или БАДа</p>
              </div>
              <input
                type="checkbox"
                checked={notifMedication}
                onChange={(e) => setNotifMedication(e.target.checked)}
                className="w-5 h-5 accent-[#34F5A4] cursor-pointer"
              />
            </div>

            {/* Toggle 2: Appointments */}
            <div className="bg-[#111C2C]/60 border border-white/[0.05] p-4 rounded-2xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-white block">Визиты к врачам</span>
                <p className="text-xs text-white/50">Уведомление за 24 часа и за 2 часа до приёма</p>
              </div>
              <input
                type="checkbox"
                checked={notifAppointments}
                onChange={(e) => setNotifAppointments(e.target.checked)}
                className="w-5 h-5 accent-[#34F5A4] cursor-pointer"
              />
            </div>

            {/* Toggle 3: Check-ins */}
            <div className="bg-[#111C2C]/60 border border-white/[0.05] p-4 rounded-2xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-white block">Утренние и вечерние чекины</span>
                <p className="text-xs text-white/50">Быстрый опрос самочувствия и уровня энергии</p>
              </div>
              <input
                type="checkbox"
                checked={notifCheckins}
                onChange={(e) => setNotifCheckins(e.target.checked)}
                className="w-5 h-5 accent-[#34F5A4] cursor-pointer"
              />
            </div>

            {/* Toggle 4: AI Report */}
            <div className="bg-[#111C2C]/60 border border-white/[0.05] p-4 rounded-2xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-white block">Еженедельный ИИ-отчет</span>
                <p className="text-xs text-white/50">Итоги психоэмоционального и физического состояния</p>
              </div>
              <input
                type="checkbox"
                checked={notifAiReport}
                onChange={(e) => setNotifAiReport(e.target.checked)}
                className="w-5 h-5 accent-[#34F5A4] cursor-pointer"
              />
            </div>
          </div>

          {/* Time & Sound Settings */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/[0.05]">
            <div className="bg-[#111C2C]/40 p-3.5 rounded-2xl border border-white/[0.05] space-y-1.5">
              <span className="text-xs text-white/60 font-medium block flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#34F5A4]" />
                Утреннее время
              </span>
              <input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                className="w-full bg-[#050A12] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-[#34F5A4]"
              />
            </div>

            <div className="bg-[#111C2C]/40 p-3.5 rounded-2xl border border-white/[0.05] space-y-1.5">
              <span className="text-xs text-white/60 font-medium block flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#4DEBFF]" />
                Вечерний итог
              </span>
              <input
                type="time"
                value={eveningTime}
                onChange={(e) => setEveningTime(e.target.value)}
                className="w-full bg-[#050A12] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-[#4DEBFF]"
              />
            </div>

            <div className="bg-[#111C2C]/40 p-3.5 rounded-2xl border border-white/[0.05] space-y-1.5">
              <span className="text-xs text-white/60 font-medium block flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                Звуковой сигнал
              </span>
              <select
                value={soundMode}
                onChange={(e) => setSoundMode(e.target.value as any)}
                className="w-full bg-[#050A12] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-purple-400 cursor-pointer"
              >
                <option value="gentle">Мягкий звон</option>
                <option value="pulse">Импульсный тональный</option>
                <option value="silent">Без звука (только экран)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: СПИСОК ПРИНИМАЕМЫХ ЛЕКАРСТВ, БАДОВ И ВОДНЫЙ БАЛАНС */}
      {(activeTab === 'all' || activeTab === 'medications') && (
        <div className="space-y-6">
          {/* WATER TRACKER CARD */}
          <div className="bg-[#0B1320] border border-white/[0.06] rounded-[24px] p-6 sm:p-8 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#4DEBFF]/10 border border-[#4DEBFF]/20 flex items-center justify-center text-[#4DEBFF]">
                  <Droplet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Водный баланс и гидратация</h2>
                  <p className="text-xs text-white/60">
                    Цель: {waterState.targetMl} мл в день • Выпито: {waterState.consumedMl} мл (
                    {Math.round((waterState.consumedMl / waterState.targetMl) * 100)}%)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAddWater(250)}
                  className="px-3 py-2 bg-[#4DEBFF]/10 hover:bg-[#4DEBFF]/20 text-[#4DEBFF] border border-[#4DEBFF]/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+250 мл (стакан)</span>
                </button>
                <button
                  onClick={() => handleAddWater(500)}
                  className="px-3 py-2 bg-[#4DEBFF]/10 hover:bg-[#4DEBFF]/20 text-[#4DEBFF] border border-[#4DEBFF]/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+500 мл (бутылка)</span>
                </button>
                <button
                  onClick={handleResetWater}
                  className="p-2 hover:bg-white/10 text-white/40 hover:text-white rounded-xl transition-colors cursor-pointer"
                  title="Сбросить счетчик воды"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* WATER PROGRESS BAR */}
            <div className="space-y-2">
              <div className="w-full h-3 bg-[#101A28] rounded-full overflow-hidden border border-white/[0.06]">
                <div
                  className="h-full bg-gradient-to-r from-[#4DEBFF] to-[#34F5A4] transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, (waterState.consumedMl / waterState.targetMl) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/50">
                <span>0 мл</span>
                <span>1000 мл</span>
                <span>{waterState.targetMl} мл (норма)</span>
              </div>
            </div>
          </div>

          {/* MEDICATIONS & SUPPLEMENTS ACTIVE LIST */}
          <div className="bg-[#0B1320] border border-white/[0.06] rounded-[24px] p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 flex items-center justify-center text-[#34F5A4]">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Список принимаемых лекарств и БАДов</h2>
                  <p className="text-xs text-white/60">
                    Активный курс терапии ({medicationList.length} наименований)
                  </p>
                </div>
              </div>

              <button
                onClick={handleOpenAddMedModal}
                className="px-4 py-2.5 bg-[#34F5A4] hover:bg-[#2ce093] text-[#050A12] font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить лекарство</span>
              </button>
            </div>

            {/* LIST OF MEDICATIONS */}
            {medicationList.length === 0 ? (
              <div className="bg-[#111C2C]/40 border border-white/[0.05] p-8 rounded-2xl text-center space-y-3">
                <Pill className="w-10 h-10 text-white/30 mx-auto" />
                <p className="text-sm text-white/70 font-medium">Список лекарств и БАДов пока пуст</p>
                <button
                  onClick={handleOpenAddMedModal}
                  className="text-xs text-[#34F5A4] font-bold hover:underline"
                >
                  + Нажмите, чтобы добавить первое назначение
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {medicationList.map((med) => (
                  <div
                    key={med.id}
                    className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                      med.isEnabled
                        ? 'bg-[#111C2C]/80 border-white/[0.08] hover:border-[#34F5A4]/30'
                        : 'bg-[#111C2C]/30 border-white/[0.04] opacity-60'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-bold text-sm text-white truncate">{med.title}</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#34F5A4]/10 border border-[#34F5A4]/20 text-[10px] font-semibold text-[#34F5A4]">
                          {med.dosage || '1 шт'}
                        </span>
                      </div>

                      <div className="flex items-center flex-wrap gap-3 text-xs text-white/60">
                        <span className="flex items-center gap-1 text-[#34F5A4]">
                          <Clock className="w-3.5 h-3.5" />
                          {med.time}
                        </span>
                        <span>
                          {med.frequency === 'daily'
                            ? 'Ежедневно'
                            : med.frequency === 'weekdays'
                            ? 'По будням'
                            : 'Раз в неделю'}
                        </span>
                        {med.startDate && (
                          <span className="text-white/40 text-[11px]">Курс с: {med.startDate}</span>
                        )}
                      </div>

                      {med.notes && (
                        <p className="text-[11px] text-white/50 truncate pt-0.5">{med.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEditMedication(med)}
                        className="px-2.5 py-1.5 bg-[#4DEBFF]/10 hover:bg-[#4DEBFF]/20 text-[#4DEBFF] border border-[#4DEBFF]/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Изменить название, время или дозировку"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Изменить</span>
                      </button>
                      <button
                        onClick={() => handleArchiveMedication(med.id)}
                        className="p-1.5 hover:bg-amber-500/20 text-white/40 hover:text-amber-400 rounded-xl transition-colors cursor-pointer"
                        title="Завершить курс (перенести в архив)"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <input
                        type="checkbox"
                        checked={med.isEnabled}
                        onChange={() => handleToggleMedication(med.id)}
                        className="w-5 h-5 accent-[#34F5A4] cursor-pointer ml-1"
                        title={med.isEnabled ? 'Деактивировать' : 'Активировать'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ARCHIVED / COMPLETED COURSES */}
            {archivedMeds.length > 0 && (
              <div className="pt-6 border-t border-white/[0.06] space-y-4">
                <div className="flex items-center gap-2 text-white/80 font-bold text-sm">
                  <History className="w-4 h-4 text-amber-400" />
                  <h3>История и архив прошлых курсов ({archivedMeds.length})</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {archivedMeds.map((med) => (
                    <div
                      key={med.id}
                      className="p-3.5 bg-[#101A28]/60 border border-white/[0.04] rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white/90 truncate">{med.title}</span>
                          <span className="text-[10px] text-white/50 bg-white/5 px-1.5 py-0.5 rounded">
                            {med.dosage}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40">
                          Завершено: {med.archivedAt || 'Ранее'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleRestoreArchivedMedication(med)}
                          className="px-2.5 py-1 bg-[#34F5A4]/10 hover:bg-[#34F5A4]/20 text-[#34F5A4] border border-[#34F5A4]/30 rounded-lg font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Возобновить</span>
                        </button>
                        <button
                          onClick={() => handlePermanentlyDeleteArchived(med.id)}
                          className="p-1 hover:bg-rose-500/20 text-white/30 hover:text-rose-400 rounded transition-colors cursor-pointer"
                          title="Удалить навсегда"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: ЗАГРУЗКА И АРХИВ ИССЛЕДОВАНИЙ (LABORATORY DOCUMENTS) */}
      {(activeTab === 'all' || activeTab === 'documents') && (
        <div className="bg-[#0B1320] border border-white/[0.06] rounded-[24px] p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Загрузка и архив исследований</h2>
                <p className="text-xs text-white/60">
                  Медицинские анализы, МРТ, УЗИ и выписки ({documents.length} файлов)
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAddDocModal(true)}
              className="px-4 py-2.5 bg-[#4DEBFF] hover:bg-[#38d8ec] text-[#050A12] font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Загрузить исследование</span>
            </button>
          </div>

          {/* DOCUMENTS LIST */}
          {documents.length === 0 ? (
            <div className="bg-[#111C2C]/40 border border-white/[0.05] p-8 rounded-2xl text-center space-y-3">
              <FileText className="w-10 h-10 text-white/30 mx-auto" />
              <p className="text-sm text-white/70 font-medium">Архив медицинских исследований пока пуст</p>
              <button
                onClick={() => setShowAddDocModal(true)}
                className="text-xs text-[#4DEBFF] font-bold hover:underline"
              >
                + Загрузить результаты лабораторных анализов в формате PDF или JPG
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-[#111C2C]/80 border border-white/[0.08] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-[#34F5A4]">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{doc.title}</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#34F5A4]/10 border border-[#34F5A4]/20 text-[#34F5A4] text-[10px] font-bold">
                          {doc.categoryLabel}
                        </span>
                      </div>
                      <p className="text-xs text-white/60 line-clamp-1">{doc.summary}</p>
                      <span className="text-[11px] text-white/40 block">Загружено: {doc.date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => onNavigate && onNavigate('dashboard')}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Обзор ИИ
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-2 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                      title="Удалить файл"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: ПАРТНЁРСКАЯ СИНХРОНИЗАЦИЯ И БЕЗОПАСНОСТЬ */}
      {(activeTab === 'all' || activeTab === 'security') && (
        <div className="space-y-6">
          {/* PARTNER CYCLE SYNC BLOCK (For female users) */}
          {user.gender === 'female' && user.womenHealth && (
            <div className="bg-gradient-to-br from-pink-500/20 to-rose-600/20 border border-pink-500/30 text-white p-6 sm:p-8 rounded-[24px] space-y-5 shadow-xl backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pink-400/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-pink-500/20 border border-pink-400/30 flex items-center justify-center text-pink-300">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-lg text-white">Синхронизация цикла с партнёром</h2>
                    <p className="text-xs text-pink-200/70">
                      Совместное наблюдение за фазами цикла, самочувствием и напоминаниями
                    </p>
                  </div>
                </div>
                <span className={`text-[11px] font-bold px-3 py-1 rounded-full w-fit border ${
                  linkedPartnerCode
                    ? 'text-emerald-300 bg-emerald-500/20 border-emerald-400/30'
                    : 'text-slate-300 bg-slate-800/60 border-slate-700/50'
                }`}>
                  {linkedPartnerCode ? 'Партнёр подключён' : 'Ожидает подключения'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Copy My Code */}
                <div className="bg-[#050A12]/60 p-4 rounded-2xl border border-pink-500/20 space-y-2">
                  <span className="text-xs text-pink-200 font-semibold block">Ваш персональный код синхронизации:</span>
                  <div className="flex items-center justify-between gap-3 bg-black/40 p-2.5 rounded-xl border border-white/10">
                    <code className="text-sm font-mono font-bold tracking-widest text-pink-300">
                      {user.womenHealth?.partnerSyncCode && user.womenHealth.partnerSyncCode !== 'PARTNER-DEMO-RU'
                        ? user.womenHealth.partnerSyncCode
                        : (user.id && user.id !== 'usr-new'
                          ? `PARTNER-${user.id.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}-RU`
                          : `PARTNER-${(user.fullName || 'USER').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'A1B2'}-RU`)}
                    </code>
                    <button
                      onClick={handleCopyCode}
                      className="px-3 py-1.5 bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
                    </button>
                  </div>
                </div>

                {/* Connect Partner */}
                <div className="bg-[#050A12]/60 p-4 rounded-2xl border border-pink-500/20 space-y-2">
                  <span className="text-xs text-pink-200 font-semibold block">Статус связи с партнёром:</span>
                  {linkedPartnerCode ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 bg-emerald-950/40 rounded-xl border border-emerald-500/30 text-xs">
                        <span className="font-mono font-bold text-emerald-300">{linkedPartnerCode}</span>
                        <button
                          onClick={handleUnlinkPartnerCode}
                          className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                        >
                          Отвязать
                        </button>
                      </div>
                      <p className="text-[11px] text-pink-200/60">Данные о фазах цикла успешно синхронизируются.</p>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Код партнёра (PARTNER-XXXX)"
                        value={partnerCodeInput}
                        onChange={(e) => setPartnerCodeInput(e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-pink-400"
                      />
                      <button
                        onClick={handleLinkPartnerCode}
                        className="px-4 py-2 bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                      >
                        Связать
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REAL BIOMETRICS FACE ID & PIN SECURITY CARD */}
          <div className="bg-[#0B1320] border border-white/[0.06] rounded-[24px] p-6 sm:p-8 space-y-5 shadow-xl">
            <div className="flex items-center justify-between p-4 bg-[#111C2C]/60 rounded-2xl border border-white/[0.06]">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 flex items-center justify-center text-[#34F5A4]">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">Защита входа по Face ID / PIN</span>
                  <p className="text-xs text-white/50">
                    Блокировать доступ к приложению до подтверждения личности при каждом входе
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={biometricsEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  handleToggleBiometrics(val);
                  if (val) {
                    handleOpenLockVerification();
                  }
                }}
                className="w-5 h-5 accent-[#34F5A4] cursor-pointer shrink-0"
              />
            </div>

            {/* Status indicator */}
            <div className="flex items-center justify-between text-xs px-1 text-white/70">
              <span>Статус аппаратной защиты:</span>
              <span className={`font-bold px-2 py-0.5 rounded-md ${biometricsEnabled ? 'bg-[#34F5A4]/20 text-[#34F5A4]' : 'bg-white/10 text-white/50'}`}>
                {biometricsEnabled ? 'Активна (Face ID / PIN)' : 'Выключена'}
              </span>
            </div>

            {/* Quick Action Buttons for PIN & Face ID */}
            {biometricsEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <button
                  onClick={handleOpenLockVerification}
                  className="p-3 bg-white/5 hover:bg-[#34F5A4]/10 border border-white/10 hover:border-[#34F5A4]/30 rounded-xl text-xs font-bold text-white hover:text-[#34F5A4] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Scan className="w-4 h-4 text-[#4DEBFF]" />
                  <span>Проверить Face ID / PIN</span>
                </button>

                <button
                  onClick={handleOpenLockSetup}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-[#34F5A4]" />
                  <span>Изменить PIN-код</span>
                </button>

                {onLockApp && (
                  <button
                    onClick={onLockApp}
                    className="p-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Заблокировать сейчас</span>
                  </button>
                )}
              </div>
            )}

            {lockNotice && (
              <div className="p-3 rounded-xl bg-[#34F5A4]/10 border border-[#34F5A4]/30 text-[#34F5A4] text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{lockNotice}</span>
              </div>
            )}

            {/* Account Management & Logout / Delete Rows */}
            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-white block">Выход из системы</span>
                  <p className="text-xs text-white/60">Текущий сеанс: {user.email || 'user@health.ai'}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Выйти</span>
                </button>
              </div>

              {onDeleteProfile && (
                <div className="flex items-center justify-between p-4 bg-red-950/40 rounded-2xl border border-red-500/30">
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold text-red-300 block">Удалить профиль</span>
                    <p className="text-xs text-red-200/60">Полное невозвратное удаление профиля и всех медицинских данных</p>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Удалить профиль</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT MEDICATION */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B1320] border border-white/10 rounded-[24px] max-w-lg w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-[#34F5A4]">
                <Pill className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">
                  {editingMedId ? 'Редактирование назначения' : 'Новое лекарство или БАД'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddMedModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMedication} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Название препарата / витамина *</label>
                <input
                  type="text"
                  required
                  placeholder="например, Магний B6 Форте"
                  value={medTitle}
                  onChange={(e) => setMedTitle(e.target.value)}
                  className="w-full bg-[#050A12] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#34F5A4]"
                />
              </div>

              {/* STRUCTURED DOSAGE FIELDS */}
              <div className="space-y-2 p-3 bg-[#101A28] rounded-xl border border-white/[0.05]">
                <span className="text-white/80 font-bold block text-[11px]">Структурированная дозировка:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-white/50 text-[10px] block mb-1">Количество</label>
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={doseQuantity}
                      onChange={(e) => setDoseQuantity(parseFloat(e.target.value) || 1)}
                      className="w-full bg-[#050A12] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#34F5A4]"
                    />
                  </div>

                  <div>
                    <label className="text-white/50 text-[10px] block mb-1">Форма выпуска</label>
                    <select
                      value={doseForm}
                      onChange={(e) => setDoseForm(e.target.value)}
                      className="w-full bg-[#050A12] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#34F5A4] cursor-pointer"
                    >
                      <option value="капсула">капсула</option>
                      <option value="таблетка">таблетка</option>
                      <option value="мл">мл</option>
                      <option value="капли">капли</option>
                      <option value="саше">саше (пакетик)</option>
                      <option value="инъекция">инъекция</option>
                      <option value="спрей">спрей</option>
                      <option value="драже">драже</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-white/50 text-[10px] block mb-1">Действующее вещество</label>
                    <input
                      type="text"
                      placeholder="напр., 100 мг"
                      value={doseActiveIngredient}
                      onChange={(e) => setDoseActiveIngredient(e.target.value)}
                      className="w-full bg-[#050A12] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#34F5A4]"
                    />
                  </div>
                </div>
              </div>

              {/* SCHEDULE PICKER */}
              <div className="space-y-1">
                <MedicationSchedulePicker
                  schedule={medSchedule}
                  onChange={setMedSchedule}
                  label="Время и слоты приёма:"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-white/70 font-semibold block">Дата начала курса</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#050A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#34F5A4]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/70 font-semibold block">Периодичность</label>
                  <select
                    value={medFrequency}
                    onChange={(e) => setMedFrequency(e.target.value as any)}
                    className="w-full bg-[#050A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#34F5A4] cursor-pointer"
                  >
                    <option value="daily">Ежедневно</option>
                    <option value="weekdays">По будням (Пн-Пт)</option>
                    <option value="weekly">Раз в неделю</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Заметки или особые инструкции</label>
                <input
                  type="text"
                  placeholder="напр., После еды, запивать большим количеством воды"
                  value={medNotes}
                  onChange={(e) => setMedNotes(e.target.value)}
                  className="w-full bg-[#050A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#34F5A4]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 text-xs rounded-xl font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#34F5A4] hover:bg-[#2ce093] text-[#050A12] text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {editingMedId ? 'Сохранить изменения' : 'Добавить в курс'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD LAB DOCUMENT */}
      {showAddDocModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B1320] border border-white/10 rounded-[24px] max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-[#4DEBFF]">
                <Upload className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">Загрузка медицинского документа</h3>
              </div>
              <button
                onClick={() => setShowAddDocModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="space-y-4 text-xs">
              {analysisError && (
                <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs">{analysisError}</p>
                    <button
                      type="submit"
                      className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Повторить попытку</span>
                    </button>
                  </div>
                </div>
              )}

              {isAnalyzingFile && (
                <div className="p-3 bg-[#4DEBFF]/10 border border-[#4DEBFF]/20 rounded-xl text-[#4DEBFF] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                  <span className="font-semibold text-xs">{analysisProgress || 'Сканирование файла...'}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Название исследования *</label>
                <input
                  type="text"
                  required
                  placeholder="например, Клинический анализ крови + Ферритин"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-[#050A12] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#4DEBFF]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Категория документа</label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as any)}
                  className="w-full bg-[#050A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4DEBFF] cursor-pointer"
                >
                  <option value="lab">Лабораторные анализы (Кровь, Моча, Гормоны)</option>
                  <option value="ultrasound">УЗИ, МРТ, КТ исследования</option>
                  <option value="instrumental">Инструментальная диагностика (ЭКГ, Холтер)</option>
                  <option value="consultations">Консультация врача / Выписка</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Выберите файл (PDF, JPG, PNG)</label>
                <div className="border-2 border-dashed border-white/20 hover:border-[#4DEBFF] rounded-2xl p-6 text-center bg-[#050A12]/50 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-8 h-8 text-[#4DEBFF] mx-auto mb-2" />
                  <p className="text-xs text-white font-medium">
                    {selectedFile ? selectedFile.name : 'Нажмите или перетащите файл исследования сюда'}
                  </p>
                  <span className="text-[10px] text-white/40 block mt-1">До 25 МБ</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDocModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 text-xs rounded-xl font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isAnalyzingFile}
                  className="px-5 py-2 bg-[#4DEBFF] hover:bg-[#38d8ec] text-[#050A12] text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAnalyzingFile ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>ИИ сканирует...</span>
                    </>
                  ) : (
                    <span>Загрузить и распознать</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* RESEARCH VERIFICATION MODAL FOR SETTINGS UPLOAD */}
      <ResearchVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        stagingRecord={stagingRecord}
        filePreviewUrl={selectedFile ? URL.createObjectURL(selectedFile) : null}
        onCommit={handleCommitStaging}
      />

      {/* BIOMETRICS FACE ID / PIN LOCK MODAL */}
      <SecurityLockModal
        isOpen={showLockModal}
        mode={lockModalMode}
        currentPin={userPin}
        onSuccess={handleSecuritySuccess}
        onCancel={() => setShowLockModal(false)}
        allowCancel={true}
      />

      {/* MODAL: DELETE PROFILE CONFIRMATION */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B1320] border border-red-500/30 rounded-[24px] max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Удалить профиль?</h3>
                <p className="text-xs text-red-300/80">Это действие необратимо</p>
              </div>
            </div>

            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-2">
              <p className="text-xs text-red-200 leading-relaxed font-medium">
                Вы уверены? Это действие необратимо и удалит все ваши данные: личный профиль, анкеты, дневники самочувствия, лекарства, анализы и медицинские выписки.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                disabled={isDeletingProfile}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-xl font-semibold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeletingProfile}
                onClick={async () => {
                  setIsDeletingProfile(true);
                  if (onDeleteProfile) {
                    await onDeleteProfile();
                  }
                  setIsDeletingProfile(false);
                  setShowDeleteModal(false);
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isDeletingProfile ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Удаление...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Удалить профиль</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
