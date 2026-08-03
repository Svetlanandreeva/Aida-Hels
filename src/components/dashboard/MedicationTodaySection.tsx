import React, { useState, useEffect } from 'react';
import {
  MedicationIntake,
  MedicationIntakeAudit,
  IntakeStatus,
  FoodRelation,
  Reminder,
  ScreenId,
  UserProfile,
  MedicationSchedule,
} from '../../types';
import {
  Pill,
  CheckCircle2,
  Clock,
  MoreVertical,
  RotateCcw,
  Plus,
  AlertCircle,
  Calendar,
  Utensils,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  Edit3,
  XCircle,
  Sparkles,
  Info,
  Check,
  EyeOff,
  Eye,
  Sliders,
} from 'lucide-react';

interface MedicationTodaySectionProps {
  user?: UserProfile;
  reminders: Reminder[];
  onNavigate: (screen: ScreenId) => void;
  onOpenAddMedication?: () => void;
  onStatusChanged?: (intake: MedicationIntake, message: string) => void;
}

// Build real user intakes for today from user profile and reminders
function buildTodayIntakesFromUser(
  user?: UserProfile,
  reminders: Reminder[] = []
): MedicationIntake[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const list: MedicationIntake[] = [];

  const processMedicationItem = (
    medId: string,
    medName: string,
    doseText: string,
    schedule?: MedicationSchedule
  ) => {
    if (!medName || medName === 'Без медикаментов') return;

    // If schedule is missing or no slot enabled, default to morning 08:00
    const effSchedule: MedicationSchedule =
      schedule && (schedule.morning?.enabled || schedule.afternoon?.enabled || schedule.evening?.enabled)
        ? schedule
        : { morning: { enabled: true, time: '08:00' } };

    if (effSchedule.morning?.enabled) {
      const time = effSchedule.morning.time || '08:00';
      list.push({
        intake_id: `intake-${medId}-morning`,
        intake_schedule_id: `sched-${medId}-m`,
        user_id: user?.id || 'usr-1',
        medication_id: medId,
        medication_name: medName,
        dose: doseText || '1 доза',
        dose_unit: 'приём',
        quantity: '1 приём',
        scheduled_date: todayStr,
        scheduled_time: time,
        scheduled_datetime: `${todayStr}T${time}:00`,
        status: 'Запланировано',
        food_relation: 'Утренний приём',
        instructionsUrl: 'Принимать строго по инструкции врача.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (effSchedule.afternoon?.enabled) {
      const time = effSchedule.afternoon.time || '13:00';
      list.push({
        intake_id: `intake-${medId}-afternoon`,
        intake_schedule_id: `sched-${medId}-a`,
        user_id: user?.id || 'usr-1',
        medication_id: medId,
        medication_name: medName,
        dose: doseText || '1 доза',
        dose_unit: 'приём',
        quantity: '1 приём',
        scheduled_date: todayStr,
        scheduled_time: time,
        scheduled_datetime: `${todayStr}T${time}:00`,
        status: 'Запланировано',
        food_relation: 'Дневной приём',
        instructionsUrl: 'Принимать строго по инструкции врача.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (effSchedule.evening?.enabled) {
      const time = effSchedule.evening.time || '20:00';
      list.push({
        intake_id: `intake-${medId}-evening`,
        intake_schedule_id: `sched-${medId}-e`,
        user_id: user?.id || 'usr-1',
        medication_id: medId,
        medication_name: medName,
        dose: doseText || '1 доза',
        dose_unit: 'приём',
        quantity: '1 приём',
        scheduled_date: todayStr,
        scheduled_time: time,
        scheduled_datetime: `${todayStr}T${time}:00`,
        status: 'Запланировано',
        food_relation: 'Вечерний приём',
        instructionsUrl: 'Принимать строго по инструкции врача.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  };

  // 1. Process Physical Chronic Diagnoses Medications
  if (user?.chronicDiagnoses) {
    user.chronicDiagnoses.forEach((d) => {
      if (d.medication && d.medication !== 'Без медикаментов') {
        processMedicationItem(
          `cd-${d.id}`,
          d.medication,
          d.name ? `Диагноз: ${d.name}` : 'По назначению',
          d.schedule
        );
      }
    });
  }

  // 2. Process Psychiatric Medications
  if (user?.psychology?.psychiatricData) {
    const psychData = user.psychology.psychiatricData;
    if (psychData.psychiatricMedications && psychData.psychiatricMedications.length > 0) {
      psychData.psychiatricMedications.forEach((pm) => {
        processMedicationItem(
          `pm-${pm.id}`,
          pm.name,
          pm.dosage || 'Психиатрический анамнез',
          pm.schedule
        );
      });
    } else if (psychData.medications && psychData.medications.length > 0) {
      psychData.medications.forEach((medName, idx) => {
        if (medName.trim()) {
          processMedicationItem(
            `pm-legacy-${idx}`,
            medName.trim(),
            'Психиатрический анамнез',
            { morning: { enabled: true, time: '08:00' } }
          );
        }
      });
    }
  }

  // 3. Process Reminders (category: 'medication')
  if (reminders && reminders.length > 0) {
    reminders
      .filter((r) => r.category === 'medication' && r.isEnabled !== false)
      .forEach((r) => {
        const time = r.time || '08:00';
        list.push({
          intake_id: `rem-intake-${r.id}`,
          intake_schedule_id: r.id,
          user_id: user?.id || 'usr-1',
          medication_id: r.id,
          medication_name: r.title,
          dose: r.dosage || '1 доза',
          dose_unit: 'приём',
          quantity: '1 приём',
          scheduled_date: todayStr,
          scheduled_time: time,
          scheduled_datetime: `${todayStr}T${time}:00`,
          status: 'Запланировано',
          food_relation: 'Напоминание',
          instructionsUrl: r.notes || 'Напоминание из личного календаря.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
  }

  // Sort list by scheduled_time asc
  list.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

  // 4. Registration day time filter
  const regIsoStr = user?.registrationDate;
  if (regIsoStr) {
    const regDate = new Date(regIsoStr);
    const regDateStr = regDate.toISOString().split('T')[0];

    if (regDateStr === todayStr) {
      const regMinutes = regDate.getHours() * 60 + regDate.getMinutes();
      return list.filter((item) => {
        const [h, m] = item.scheduled_time.split(':').map(Number);
        const itemMinutes = (h || 0) * 60 + (m || 0);
        return itemMinutes >= regMinutes;
      });
    }
  }

  return list;
}

export const MedicationTodaySection: React.FC<MedicationTodaySectionProps> = ({
  user,
  reminders,
  onNavigate,
  onOpenAddMedication,
  onStatusChanged,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Load or sync intakes
  const [intakes, setIntakes] = useState<MedicationIntake[]>(() => {
    const baseList = buildTodayIntakesFromUser(user, reminders);
    try {
      const savedRaw = localStorage.getItem(`medication_intakes_${todayStr}`);
      if (savedRaw) {
        const savedList: MedicationIntake[] = JSON.parse(savedRaw);
        const savedMap = new Map<string, MedicationIntake>(savedList.map((i) => [i.intake_id, i]));
        return baseList.map((bi) => {
          const saved = savedMap.get(bi.intake_id);
          if (saved) {
            return {
              ...bi,
              status: saved.status,
              taken_at: saved.taken_at,
              comment: saved.comment,
            };
          }
          return bi;
        });
      }
    } catch (e) {
      console.error('Error loading medication intakes', e);
    }
    return baseList;
  });

  // Keep intakes synced with user profile and reminders updates
  useEffect(() => {
    const baseList = buildTodayIntakesFromUser(user, reminders);
    setIntakes((prev) => {
      const prevMap = new Map<string, MedicationIntake>(prev.map((i) => [i.intake_id, i]));
      return baseList.map((bi) => {
        const existing = prevMap.get(bi.intake_id);
        if (existing) {
          return {
            ...bi,
            status: existing.status,
            taken_at: existing.taken_at,
            comment: existing.comment,
          };
        }
        return bi;
      });
    });
  }, [user, reminders, todayStr]);

  const [audits, setAudits] = useState<MedicationIntakeAudit[]>(() => {
    try {
      const saved = localStorage.getItem(`medication_audits_${todayStr}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading audits', e);
    }
    return [];
  });

  // Section visibility controls
  const [isSectionVisible, setIsSectionVisible] = useState<boolean>(() => {
    return localStorage.getItem('dash_medication_section_visible') !== 'false';
  });

  const [showAllItems, setShowAllItems] = useState(false);

  // Active Menu / Modal states
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [customTimeModalItem, setCustomTimeModalItem] = useState<MedicationIntake | null>(null);
  const [customTimeInput, setCustomTimeInput] = useState<string>('08:00');
  const [customDateInput, setCustomDateInput] = useState<string>(todayStr);

  const [commentModalItem, setCommentModalItem] = useState<MedicationIntake | null>(null);
  const [commentInput, setCommentInput] = useState<string>('');

  const [instructionModalItem, setInstructionModalItem] = useState<MedicationIntake | null>(null);

  // State to toggle showing list when all medications are completed
  const [showCompletedList, setShowCompletedList] = useState(false);

  // Undo Toast state (15s protection)
  const [undoToast, setUndoToast] = useState<{
    intakeId: string;
    previousStatus: IntakeStatus;
    medName: string;
    takenTime: string;
    expiryTimer: any;
  } | null>(null);

  const [aidaMessage, setAidaMessage] = useState<string | null>(null);

  // Save to localStorage when intakes or audits change
  useEffect(() => {
    try {
      localStorage.setItem(`medication_intakes_${todayStr}`, JSON.stringify(intakes));
    } catch (e) {
      console.error(e);
    }
  }, [intakes, todayStr]);

  useEffect(() => {
    try {
      localStorage.setItem(`medication_audits_${todayStr}`, JSON.stringify(audits));
    } catch (e) {
      console.error(e);
    }
  }, [audits, todayStr]);

  const toggleSectionVisibility = (visible: boolean) => {
    setIsSectionVisible(visible);
    localStorage.setItem('dash_medication_section_visible', String(visible));
  };

  // Helper date formatting in Russian
  const formatRussianDate = () => {
    const now = new Date();
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    const daysOfWeek = [
      'воскресенье', 'понедельник', 'вторник', 'среда',
      'четверг', 'пятница', 'суббота',
    ];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const weekday = daysOfWeek[now.getDay()];
    return `${day} ${month}, ${weekday}`;
  };

  // Progress metrics
  const totalCount = intakes.length;
  const takenCount = intakes.filter(
    (i) => i.status === 'Принято' || i.status === 'Принято раньше' || i.status === 'Принято с опозданием'
  ).length;
  const progressPercent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  // Add audit log entry
  const recordAudit = (
    intakeId: string,
    prevStatus: IntakeStatus,
    newStatus: IntakeStatus,
    source: string,
    note?: string
  ) => {
    const newAudit: MedicationIntakeAudit = {
      event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      intake_id: intakeId,
      previous_status: prevStatus,
      new_status: newStatus,
      event_datetime: new Date().toISOString(),
      source,
      user_id: 'user-1',
      note,
    };
    setAudits((prev) => [newAudit, ...prev]);
  };

  // Handle direct Checkbox click
  const handleToggleCheckbox = (intake: MedicationIntake) => {
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const isAlreadyTaken =
      intake.status === 'Принято' ||
      intake.status === 'Принято раньше' ||
      intake.status === 'Принято с опозданием';

    if (!isAlreadyTaken) {
      // Determine if taken early, late, or on time
      const [schedH, schedM] = intake.scheduled_time.split(':').map(Number);
      const schedTotalM = schedH * 60 + schedM;
      const currentTotalM = now.getHours() * 60 + now.getMinutes();
      const diffMinutes = currentTotalM - schedTotalM;

      let newStatus: IntakeStatus = 'Принято';
      if (diffMinutes < -30) {
        newStatus = 'Принято раньше';
      } else if (diffMinutes > 45) {
        newStatus = 'Принято с опозданием';
      }

      const prevStatus = intake.status;

      setIntakes((prev) =>
        prev.map((item) =>
          item.intake_id === intake.intake_id
            ? {
                ...item,
                status: newStatus,
                taken_at: currentTimeStr,
                source: 'dashboard_checkbox',
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );

      recordAudit(intake.intake_id, prevStatus, newStatus, 'dashboard_checkbox');

      // Clear existing undo timer
      if (undoToast?.expiryTimer) clearTimeout(undoToast.expiryTimer);

      const timer = setTimeout(() => {
        setUndoToast(null);
      }, 15000); // 15 seconds undo window

      setUndoToast({
        intakeId: intake.intake_id,
        previousStatus: prevStatus,
        medName: intake.medication_name,
        takenTime: currentTimeStr,
        expiryTimer: timer,
      });

      const aidaText = `Готово, я записала приём ${intake.medication_name} в ${currentTimeStr} 🌿`;
      setAidaMessage(aidaText);
      if (onStatusChanged) onStatusChanged(intake, aidaText);

      // Check if all complete
      if (takenCount + 1 >= totalCount) {
        setTimeout(() => {
          setAidaMessage(
            'На сегодня всё отмечено. Хорошо, что ты ведёшь историю приёма — это поможет видеть более точную картину 🤍'
          );
        }, 2000);
      }
    } else {
      // Uncheck / revert
      handleUndo(intake.intake_id, 'Запланировано');
    }
  };

  // Handle Undo
  const handleUndo = (intakeId: string, targetStatus?: IntakeStatus) => {
    const intake = intakes.find((i) => i.intake_id === intakeId);
    if (!intake) return;

    const prevStatus = intake.status;
    const restoreStatus = targetStatus || undoToast?.previousStatus || 'Запланировано';

    setIntakes((prev) =>
      prev.map((item) =>
        item.intake_id === intakeId
          ? {
              ...item,
              status: restoreStatus,
              taken_at: null,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    recordAudit(intakeId, prevStatus, restoreStatus, 'dashboard_undo_button');

    if (undoToast?.expiryTimer) clearTimeout(undoToast.expiryTimer);
    setUndoToast(null);
    setAidaMessage('Отметка приёма отменена');
    setTimeout(() => setAidaMessage(null), 3000);
  };

  // Change status explicitly from menu (Snooze, Skip, etc)
  const handleChangeStatus = (intake: MedicationIntake, newStatus: IntakeStatus, note?: string) => {
    const prevStatus = intake.status;
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    setIntakes((prev) =>
      prev.map((item) =>
        item.intake_id === intake.intake_id
          ? {
              ...item,
              status: newStatus,
              taken_at: newStatus.includes('Принято') ? currentTimeStr : item.taken_at,
              comment: note ? (item.comment ? `${item.comment} | ${note}` : note) : item.comment,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    recordAudit(intake.intake_id, prevStatus, newStatus, 'dashboard_kebab_menu', note);
    setActiveMenuId(null);

    if (newStatus === 'Пропущено') {
      setAidaMessage(
        'Я отмечу это в истории. Не принимай двойную дозу автоматически — лучше проверь инструкцию или назначение врача.'
      );
    } else if (newStatus === 'Отложено') {
      setAidaMessage(`Приём ${intake.medication_name} отложен на 30 минут ⏰`);
    }
  };

  // Custom Time Correction Modal Save
  const handleSaveCustomTime = () => {
    if (!customTimeModalItem) return;
    const now = new Date().toISOString();

    setIntakes((prev) =>
      prev.map((item) =>
        item.intake_id === customTimeModalItem.intake_id
          ? {
              ...item,
              status: 'Принято',
              original_taken_at: item.taken_at || item.scheduled_time,
              corrected_taken_at: customTimeInput,
              corrected_by_user: true,
              correction_created_at: now,
              taken_at: customTimeInput,
              updated_at: now,
            }
          : item
      )
    );

    recordAudit(
      customTimeModalItem.intake_id,
      customTimeModalItem.status,
      'Принято',
      'manual_time_correction',
      `Время изменено вручную на ${customTimeInput}`
    );

    setAidaMessage(`Время приёма скорректировано на ${customTimeInput} 🌿`);
    setCustomTimeModalItem(null);
  };

  // Comment Save
  const handleSaveComment = () => {
    if (!commentModalItem) return;
    setIntakes((prev) =>
      prev.map((item) =>
        item.intake_id === commentModalItem.intake_id
          ? {
              ...item,
              comment: commentInput,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );
    setCommentModalItem(null);
    setAidaMessage('Комментарий к приёму сохранён');
    setTimeout(() => setAidaMessage(null), 3000);
  };

  // Grouping items by Time of Day
  const getGroupTitle = (timeStr: string) => {
    const hour = parseInt(timeStr.split(':')[0], 10);
    if (hour >= 5 && hour < 12) return 'Утро';
    if (hour >= 12 && hour < 17) return 'День';
    if (hour >= 17 && hour < 22) return 'Вечер';
    return 'Перед сном';
  };

  // Sort intakes chronologically
  const sortedIntakes = [...intakes].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

  const visibleIntakes = showAllItems ? sortedIntakes : sortedIntakes.slice(0, 5);

  if (!isSectionVisible) {
    return (
      <div className="bg-[#0B1320]/60 border border-white/[0.06] rounded-[24px] p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Pill className="w-5 h-5 text-[#34F5A4]" />
          <span className="text-sm font-bold text-white">Блок «Лекарства сегодня» скрыт</span>
        </div>
        <button
          onClick={() => toggleSectionVisibility(true)}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-[#34F5A4]" />
          <span>Показать</span>
        </button>
      </div>
    );
  }

  // Render Empty State if no medications
  if (intakes.length === 0) {
    return (
      <div className="bg-[#0B1320] border border-white/[0.08] rounded-[24px] p-6 sm:p-8 shadow-xl space-y-4 text-center">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 flex items-center justify-center text-[#34F5A4]">
              <Pill className="w-5 h-5" />
            </div>
            <h2 className="font-extrabold text-base text-white text-left">Лекарства сегодня</h2>
          </div>
          <button
            onClick={() => toggleSectionVisibility(false)}
            title="Скрыть блок с главной"
            className="p-2 text-white/40 hover:text-white transition-colors cursor-pointer"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        </div>

        <div className="py-6 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
            <CheckCircle2 className="w-7 h-7 text-[#34F5A4]" />
          </div>
          <p className="text-sm font-bold text-white">Сегодня нет запланированных лекарств</p>
          <p className="text-xs text-white/50 max-w-sm mx-auto">
            Все курсы завершены или список пуст. Вы можете добавить новый препарат в расписание.
          </p>
          <button
            onClick={() => {
              if (onOpenAddMedication) onOpenAddMedication();
              else onNavigate('reminders');
            }}
            className="px-5 py-2.5 bg-[#34F5A4] text-[#050A12] font-extrabold text-xs rounded-xl hover:bg-[#34F5A4]/90 transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer shadow-lg shadow-[#34F5A4]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить препарат</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0B1320] border border-white/[0.08] rounded-[24px] p-5 sm:p-7 shadow-xl space-y-5 relative">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#34F5A4]/10 border border-[#34F5A4]/20 flex items-center justify-center text-[#34F5A4] shrink-0">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-white tracking-tight leading-tight">
                Лекарства сегодня
              </h2>
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Calendar className="w-3.5 h-3.5 text-[#34F5A4]" />
                <span className="capitalize">{formatRussianDate()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side Controls: Progress counter & Hide toggle */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0">
          <div className="bg-[#111C2C] border border-white/10 px-3.5 py-1.5 rounded-xl flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-white/50 block leading-none">Прогресс дня</span>
              <span className="text-xs font-extrabold text-[#34F5A4] leading-tight">
                Принято {takenCount} из {totalCount}
              </span>
            </div>
            <div className="w-12 bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#34F5A4] h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => toggleSectionVisibility(false)}
            title="Скрыть блок на главной"
            className="p-2 text-white/40 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AIDA SOFT FEEDBACK MESSAGE BANNER */}
      {aidaMessage && (
        <div className="bg-[#34F5A4]/10 border border-[#34F5A4]/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 text-xs font-medium text-[#34F5A4]">
            <Sparkles className="w-4 h-4 shrink-0 text-[#34F5A4] animate-pulse" />
            <span>{aidaMessage}</span>
          </div>
          <button
            onClick={() => setAidaMessage(null)}
            className="text-white/40 hover:text-white text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* UNDO TOAST BANNER (15 SECONDS) */}
      {undoToast && (
        <div className="bg-emerald-950/80 border border-[#34F5A4]/50 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg animate-bounce">
          <div className="flex items-center gap-2.5 text-xs text-white">
            <CheckCircle2 className="w-4 h-4 text-[#34F5A4] shrink-0" />
            <span>
              Отмечено как принято в <strong className="text-[#34F5A4]">{undoToast.takenTime}</strong> ({undoToast.medName})
            </span>
          </div>
          <button
            onClick={() => handleUndo(undoToast.intakeId)}
            className="px-3 py-1 bg-[#34F5A4] hover:bg-[#34F5A4]/90 text-[#050A12] text-xs font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-md"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Отменить</span>
          </button>
        </div>
      )}

      {/* OVERDUE / MISSED DOSE WARNING BANNER */}
      {intakes.some((i) => i.status === 'Пропущено') && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 animate-fadeIn">
          <div className="flex items-center gap-2 font-extrabold text-amber-300 text-sm">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>Внимание: пропущен приём лекарства</span>
          </div>
          <p className="text-white/80 leading-relaxed text-xs">
            По времени уже поздно принимать пропущенное лекарство, так как близится следующий приём. Лучше не принимать препарат с сильным опозданием и не пить двойную дозу.
          </p>
        </div>
      )}

      {/* CONDITIONAL RENDER: ALL MEDICATIONS COMPLETED CARD OR ACTIVE CHECKLIST */}
      {takenCount === totalCount && totalCount > 0 && !showCompletedList ? (
        <div className="py-8 px-6 bg-gradient-to-b from-[#34F5A4]/15 via-[#0E1726]/80 to-[#0B1320] border border-[#34F5A4]/30 rounded-[24px] text-center space-y-4 shadow-2xl relative overflow-hidden my-2">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-[#34F5A4]/20 border border-[#34F5A4]/40 flex items-center justify-center text-[#34F5A4] shadow-lg shadow-[#34F5A4]/20">
            <CheckCircle2 className="w-9 h-9 animate-bounce" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-lg font-extrabold text-white tracking-tight">
              Сегодня все лекарства приняты по расписанию
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Отличная работа! Все {totalCount} приёма за сегодня успешно отмечены и записаны в вашу историю лечения.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setShowCompletedList(true)}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-extrabold text-[#34F5A4] rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Посмотреть принятые лекарства</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {takenCount === totalCount && totalCount > 0 && showCompletedList && (
            <div className="flex items-center justify-between bg-[#34F5A4]/10 border border-[#34F5A4]/20 p-3 rounded-xl text-xs text-[#34F5A4] font-bold">
              <span>Отображаются все принятые лекарства за сегодня ({takenCount}/{totalCount})</span>
              <button
                onClick={() => setShowCompletedList(false)}
                className="hover:underline cursor-pointer"
              >
                Скрыть список
              </button>
            </div>
          )}

          {/* LIST OF SCHEDULED INTAKES */}
          <div className="space-y-3">
            {visibleIntakes.map((intake) => {
              const isTaken =
                intake.status === 'Принято' ||
                intake.status === 'Принято раньше' ||
                intake.status === 'Принято с опозданием';
              const isMissed = intake.status === 'Пропущено';
              const isPending = intake.status === 'Запланировано' || intake.status === 'Пора принять';

              return (
                <div
                  key={intake.intake_id}
                  className={`p-4 rounded-2xl border transition-all relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isTaken
                      ? 'bg-[#0E1726]/60 border-emerald-500/20 opacity-80'
                      : isMissed
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : intake.status === 'Пора принять'
                      ? 'bg-[#34F5A4]/10 border-[#34F5A4]/40 shadow-lg shadow-[#34F5A4]/5'
                      : 'bg-[#111C2C]/80 border-white/[0.07] hover:border-white/20'
                  }`}
                >
                  {/* Left Column: Touch Checkbox (44x44) & Details */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {/* Checkbox Touch Target */}
                    <button
                      onClick={() => handleToggleCheckbox(intake)}
                      className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        isTaken
                          ? 'bg-[#34F5A4] border-[#34F5A4] text-[#050A12] shadow-md shadow-[#34F5A4]/30'
                          : isMissed
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                          : 'border-white/30 hover:border-[#34F5A4] bg-white/5 hover:bg-[#34F5A4]/10 text-transparent'
                      }`}
                      title={isTaken ? 'Отменить отметку' : 'Отметить как принято'}
                    >
                      {isMissed ? (
                        <XCircle className="w-6 h-6 text-amber-400" />
                      ) : (
                        <Check className="w-6 h-6 stroke-[3]" />
                      )}
                    </button>

                    {/* Medication Details */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Scheduled Time */}
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-white/10 text-white">
                          {intake.scheduled_time}
                        </span>

                        {/* Medication Title */}
                        <span
                          className={`font-extrabold text-sm sm:text-base leading-tight truncate ${
                            isTaken
                              ? 'text-white/60 line-through decoration-white/30'
                              : isMissed
                              ? 'text-amber-200/80 line-through decoration-amber-400'
                              : 'text-white'
                          }`}
                        >
                          {intake.medication_name}
                        </span>

                        {/* Dosage & Quantity */}
                        <span className="text-xs text-white/50 font-medium">
                          ({intake.dose} · {intake.quantity})
                        </span>
                      </div>

                      {/* Food Relation Instruction & Status text */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/60 pt-0.5">
                        <span className="flex items-center gap-1 text-[#4DEBFF]">
                          <Utensils className="w-3.5 h-3.5" />
                          <span>{intake.food_relation}</span>
                        </span>

                        {/* Actual Taken Time Display if taken */}
                        {isTaken && intake.taken_at && (
                          <span className="text-xs font-bold text-[#34F5A4] flex items-center gap-1 bg-[#34F5A4]/10 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3" />
                            <span>Фактически принято в {intake.taken_at}</span>
                          </span>
                        )}

                        {/* Missed Warning text */}
                        {isMissed && (
                          <span className="text-xs font-bold text-amber-300 flex items-center gap-1 bg-amber-500/20 px-2 py-0.5 rounded-md">
                            <AlertCircle className="w-3 h-3" />
                            <span>Приём пропущен — лучше не принимать двойную дозу</span>
                          </span>
                        )}

                        {/* Manual Correction note if edited */}
                        {intake.corrected_by_user && (
                          <span className="text-[11px] text-amber-300 font-medium">
                            (время изменено вручную)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Status Tag & Kebab Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-white/5">
                    {/* Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                        isTaken
                          ? 'bg-emerald-500/20 text-[#34F5A4] border border-emerald-500/30'
                          : isMissed
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : intake.status === 'Пора принять'
                          ? 'bg-[#34F5A4]/20 text-[#34F5A4] animate-pulse border border-[#34F5A4]/40'
                          : 'bg-white/5 text-white/70 border border-white/10'
                      }`}
                    >
                      {isTaken ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#34F5A4]" />
                      ) : isMissed ? (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-white/50" />
                      )}
                      <span>{intake.status}</span>
                    </span>

                    {/* Kebab 3-Dots Menu Trigger */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveMenuId(activeMenuId === intake.intake_id ? null : intake.intake_id)
                        }
                        className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                        title="Дополнительные действия"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* DROPDOWN MENU */}
                      {activeMenuId === intake.intake_id && (
                        <div className="absolute right-0 top-10 z-50 bg-[#0B1320] border border-white/15 rounded-2xl p-2 w-56 shadow-2xl space-y-1 text-xs text-white">
                          <button
                            onClick={() => {
                              handleToggleCheckbox(intake);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#34F5A4]" />
                            <span>Принял сейчас</span>
                          </button>

                          <button
                            onClick={() => {
                              setCustomTimeModalItem(intake);
                              setCustomTimeInput(intake.scheduled_time);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4 text-[#4DEBFF]" />
                            <span>Указать другое время</span>
                          </button>

                          <button
                            onClick={() => handleChangeStatus(intake, 'Отложено')}
                            className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <Clock className="w-4 h-4 text-purple-400" />
                            <span>Отложить на 30 минут</span>
                          </button>

                          <button
                            onClick={() => handleChangeStatus(intake, 'Пропущено')}
                            className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2 font-medium text-amber-300 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Пропустить приём</span>
                          </button>

                          <button
                            onClick={() => {
                              setCommentModalItem(intake);
                              setCommentInput(intake.comment || '');
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4 text-white/70" />
                            <span>Добавить комментарий</span>
                          </button>

                          <button
                            onClick={() => {
                              setInstructionModalItem(intake);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <FileText className="w-4 h-4 text-white/70" />
                            <span>Посмотреть инструкцию</span>
                          </button>

                          <button
                            onClick={() => {
                              onNavigate('reminders');
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2 font-medium border-t border-white/10 pt-2 cursor-pointer text-white/70"
                          >
                            <Sliders className="w-4 h-4" />
                            <span>Изменить расписание</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* EXPAND / COLLAPSE BUTTON IF MORE THAN 5 ITEMS */}
      {intakes.length > 5 && (
        <button
          onClick={() => setShowAllItems(!showAllItems)}
          className="w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          {showAllItems ? (
            <>
              <ChevronUp className="w-4 h-4 text-[#34F5A4]" />
              <span>Свернуть список препаратов</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 text-[#34F5A4]" />
              <span>Показать все препараты на сегодня ({intakes.length})</span>
            </>
          )}
        </button>
      )}

      {/* FOOTER ACTION BUTTON */}
      <div className="pt-2 flex items-center justify-between text-xs text-white/50 border-t border-white/[0.06]">
        <span>Синхронизировано с вашим расписанием и напоминаниями</span>
        <button
          onClick={() => {
            if (onOpenAddMedication) onOpenAddMedication();
            else onNavigate('reminders');
          }}
          className="text-[#34F5A4] hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Добавить препарат</span>
        </button>
      </div>

      {/* CUSTOM TIME CORRECTION MODAL */}
      {customTimeModalItem && (
        <div className="fixed inset-0 z-50 bg-[#050A12]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B1320] border border-white/10 rounded-[28px] max-w-sm w-full p-6 space-y-5 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-base">Указать другое время</h3>
              <button
                onClick={() => setCustomTimeModalItem(null)}
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/60">
              Препарат: <strong className="text-white">{customTimeModalItem.medication_name}</strong>
              <br />
              Плановое время: {customTimeModalItem.scheduled_time}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Фактическое время приёма:</label>
                <input
                  type="time"
                  value={customTimeInput}
                  onChange={(e) => setCustomTimeInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#050A12] border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-[#34F5A4]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Дата приёма:</label>
                <input
                  type="date"
                  value={customDateInput}
                  onChange={(e) => setCustomDateInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#050A12] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#34F5A4]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCustomTimeModalItem(null)}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveCustomTime}
                className="flex-1 py-2.5 bg-[#34F5A4] text-[#050A12] text-xs font-extrabold rounded-xl hover:bg-[#34F5A4]/90 transition-colors"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMENT MODAL */}
      {commentModalItem && (
        <div className="fixed inset-0 z-50 bg-[#050A12]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B1320] border border-white/10 rounded-[28px] max-w-sm w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-base">Комментарий к приёму</h3>
              <button
                onClick={() => setCommentModalItem(null)}
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/60">
              {commentModalItem.medication_name} ({commentModalItem.scheduled_time})
            </p>

            <textarea
              rows={3}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Например: Запил большим количеством воды, переносимость хорошая..."
              className="w-full p-3 bg-[#050A12] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#34F5A4]"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setCommentModalItem(null)}
                className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveComment}
                className="flex-1 py-2 bg-[#34F5A4] text-[#050A12] text-xs font-extrabold rounded-xl"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSTRUCTION MODAL */}
      {instructionModalItem && (
        <div className="fixed inset-0 z-50 bg-[#050A12]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B1320] border border-white/10 rounded-[28px] max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#34F5A4]" />
                <h3 className="font-extrabold text-base">{instructionModalItem.medication_name}</h3>
              </div>
              <button
                onClick={() => setInstructionModalItem(null)}
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-white/80">
              <div className="p-3 bg-white/5 rounded-xl space-y-1">
                <span className="font-bold text-white block">Дозировка и форма:</span>
                <p>{instructionModalItem.dose} · {instructionModalItem.quantity}</p>
              </div>

              <div className="p-3 bg-white/5 rounded-xl space-y-1">
                <span className="font-bold text-white block">Связь с едой:</span>
                <p className="text-[#4DEBFF] font-medium">{instructionModalItem.food_relation}</p>
              </div>

              <div className="p-3 bg-white/5 rounded-xl space-y-1">
                <span className="font-bold text-white block">Официальная инструкция и правила приёма:</span>
                <p className="text-white/70 leading-relaxed">
                  {instructionModalItem.instructionsUrl ||
                    'Принимать строго по назначению врача. Не превышать рекомендованную дозировку.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setInstructionModalItem(null)}
              className="w-full py-2.5 bg-[#34F5A4] text-[#050A12] font-extrabold text-xs rounded-xl hover:bg-[#34F5A4]/90 transition-colors"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
