import React, { useState } from 'react';
import { Reminder, ReminderCategory, ReminderFrequency } from '../types';
import {
  Bell,
  Plus,
  CheckCircle2,
  Clock,
  Pill,
  Calendar,
  Heart,
  Volume2,
  Trash2,
  Edit2,
  Sparkles,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';

interface RemindersScreenProps {
  reminders: Reminder[];
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
  onNavigateToCheckin?: () => void;
  onNavigateToAppointments?: () => void;
}

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Helper sound synth using Web Audio API
const playSoundAlert = (type: 'chime' | 'gentle' | 'pulse' | 'complete' = 'chime') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'complete') {
      // Pleasant double ding
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'pulse') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(880, now + 0.1);
      osc.frequency.setValueAtTime(1174.66, now + 0.2); // D6
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    } else if (type === 'gentle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.2); // C#5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    } else {
      // chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(now + 0.4);
  } catch {
    // Audio context not allowed without gesture or unsupported
  }
};

export const RemindersScreen: React.FC<RemindersScreenProps> = ({
  reminders,
  setReminders,
  onNavigateToCheckin,
  onNavigateToAppointments,
}) => {
  const [activeCategory, setActiveCategory] = useState<ReminderCategory | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ReminderCategory>('medication');
  const [formTime, setFormTime] = useState('08:00');
  const [formDosage, setFormDosage] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFrequency, setFormFrequency] = useState<ReminderFrequency>('daily');
  const [formDays, setFormDays] = useState<string[]>(DAYS_OF_WEEK);
  const [formSound, setFormSound] = useState<'chime' | 'gentle' | 'pulse'>('chime');

  // Test Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleOpenAddModal = () => {
    setEditingReminder(null);
    setFormTitle('');
    setFormCategory('medication');
    setFormTime('08:00');
    setFormDosage('');
    setFormNotes('');
    setFormFrequency('daily');
    setFormDays(DAYS_OF_WEEK);
    setFormSound('chime');
    setShowModal(true);
  };

  const handleOpenEditModal = (rem: Reminder) => {
    setEditingReminder(rem);
    setFormTitle(rem.title);
    setFormCategory(rem.category);
    setFormTime(rem.time);
    setFormDosage(rem.dosage || '');
    setFormNotes(rem.notes || '');
    setFormFrequency(rem.frequency);
    setFormDays(rem.days || DAYS_OF_WEEK);
    setFormSound(rem.sound || 'chime');
    setShowModal(true);
  };

  const handleSaveReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingReminder) {
      setReminders((prev) =>
        prev.map((r) =>
          r.id === editingReminder.id
            ? {
                ...r,
                title: formTitle,
                category: formCategory,
                time: formTime,
                dosage: formDosage || undefined,
                notes: formNotes || undefined,
                frequency: formFrequency,
                days: formDays,
                sound: formSound,
              }
            : r
        )
      );
      showToast(`Напоминание «${formTitle}» обновлено!`);
    } else {
      const newRem: Reminder = {
        id: `rem-${Date.now()}`,
        title: formTitle,
        category: formCategory,
        time: formTime,
        dosage: formDosage || undefined,
        notes: formNotes || undefined,
        frequency: formFrequency,
        days: formDays,
        isEnabled: true,
        sound: formSound,
      };
      setReminders((prev) => [newRem, ...prev]);
      showToast(`Напоминание «${formTitle}» создано на ${formTime}!`);
    }

    setShowModal(false);
  };

  const handleToggleEnable = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isEnabled: !r.isEnabled } : r))
    );
  };

  const handleToggleCompleteToday = (rem: Reminder) => {
    const isCompleted = rem.lastCompletedDate === todayStr;
    const newDate = isCompleted ? undefined : todayStr;

    setReminders((prev) =>
      prev.map((r) => (r.id === rem.id ? { ...r, lastCompletedDate: newDate } : r))
    );

    if (!isCompleted) {
      playSoundAlert('complete');
      showToast(`Отмечено выполненным: «${rem.title}» 🎉`);
    }
  };

  const handleDeleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    showToast('Напоминание удалено');
  };

  const handleTestSound = (rem: Reminder) => {
    playSoundAlert(rem.sound || 'chime');
    showToast(`🔔 Сигнал напоминания: ${rem.title} (${rem.time})`);

    // Request browser notification if available
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Здоровье ИИ: ${rem.title}`, {
        body: rem.dosage ? `Дозировка: ${rem.dosage}` : `Время приёма: ${rem.time}`,
        icon: '/favicon.ico',
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleQuickAddPreset = (title: string, category: ReminderCategory, time: string, dosage?: string, notes?: string) => {
    const newRem: Reminder = {
      id: `rem-preset-${Date.now()}`,
      title,
      category,
      time,
      dosage,
      notes,
      frequency: 'daily',
      days: DAYS_OF_WEEK,
      isEnabled: true,
      sound: 'chime',
    };
    setReminders((prev) => [newRem, ...prev]);
    showToast(`Добавлено пресет-напоминание: ${title}`);
  };

  const filteredReminders = reminders.filter((r) => {
    if (activeCategory === 'all') return true;
    return r.category === activeCategory;
  });

  const completedTodayCount = reminders.filter((r) => r.lastCompletedDate === todayStr).length;
  const activeCount = reminders.filter((r) => r.isEnabled).length;

  const getCategoryBadge = (category: ReminderCategory) => {
    switch (category) {
      case 'medication':
        return {
          label: 'Медикамент / Витамины',
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          icon: <Pill className="w-3.5 h-3.5" />,
        };
      case 'appointment':
        return {
          label: 'Приём врача',
          bg: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
          icon: <Calendar className="w-3.5 h-3.5" />,
        };
      case 'checkin':
        return {
          label: 'Чек-ин самочувствия',
          bg: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
          icon: <Heart className="w-3.5 h-3.5" />,
        };
      default:
        return {
          label: 'Своё напоминание',
          bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          icon: <Bell className="w-3.5 h-3.5" />,
        };
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32 sm:pb-36">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-2xl shadow-2xl border border-emerald-300 flex items-center gap-2 animate-bounce">
          <Sparkles className="w-5 h-5 shrink-0" />
          <span className="text-xs sm:text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#14171C] p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <Bell className="w-4 h-4 animate-pulse" />
            <span>Умные медицинские напоминания</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-100 tracking-tight">
            Расписание и приём лекарств
          </h1>
          <p className="text-xs text-gray-400">
            Персональные уведомления о приёме медикаментов, запланированных консультациях врачей и ежедневных опросах самочувствия.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto relative z-10">
          <button
            onClick={() => handleTestSound(reminders[0] || { title: 'Тестовый сигнал', time: '12:00', sound: 'chime' } as any)}
            className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            title="Проверить звуковой сигнал"
          >
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>Тест сигнала</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Создать напоминание</span>
          </button>
        </div>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#14171C] p-4 rounded-2xl border border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-gray-400 block">Всего напоминаний</span>
            <strong className="text-lg font-bold text-gray-100">{reminders.length} записей</strong>
          </div>
        </div>

        <div className="bg-[#14171C] p-4 rounded-2xl border border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-gray-400 block">Выполнено сегодня</span>
            <strong className="text-lg font-bold text-emerald-400">
              {completedTodayCount} из {reminders.length}
            </strong>
          </div>
        </div>

        <div className="bg-[#14171C] p-4 rounded-2xl border border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-gray-400 block">Активные сигналы</span>
            <strong className="text-lg font-bold text-gray-100">{activeCount} включено</strong>
          </div>
        </div>
      </div>

      {/* Quick Presets Section */}
      <div className="bg-[#14171C] p-4 rounded-2xl border border-gray-800 space-y-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
          Быстрые шаблоны напоминаний:
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => handleQuickAddPreset('Приём L-тироксина', 'medication', '07:30', '50 мкг натощак', 'За 30 минут до еды')}
            className="px-3 py-1.5 bg-[#0F1115] hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-gray-800 text-gray-300 text-xs font-medium rounded-xl shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Pill className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ L-тироксина (07:30)</span>
          </button>

          <button
            onClick={() => handleQuickAddPreset('Витамин D3', 'medication', '09:00', '5000 МЕ', 'Во время завтрака')}
            className="px-3 py-1.5 bg-[#0F1115] hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-gray-800 text-gray-300 text-xs font-medium rounded-xl shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Pill className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Витамин D3 (09:00)</span>
          </button>

          <button
            onClick={() => handleQuickAddPreset('Магний B6 перед сном', 'medication', '22:00', '2 таблетки', 'Перед сном для расслабления')}
            className="px-3 py-1.5 bg-[#0F1115] hover:bg-teal-500/10 hover:border-teal-500/30 border border-gray-800 text-gray-300 text-xs font-medium rounded-xl shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Pill className="w-3.5 h-3.5 text-teal-400" />
            <span>+ Магний B6 (22:00)</span>
          </button>

          <button
            onClick={() => handleQuickAddPreset('Ежедневный опрос самочувствия', 'checkin', '21:00', undefined, 'Фиксация сна и стресса')}
            className="px-3 py-1.5 bg-[#0F1115] hover:bg-pink-500/10 hover:border-pink-500/30 border border-gray-800 text-gray-300 text-xs font-medium rounded-xl shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Heart className="w-3.5 h-3.5 text-pink-400" />
            <span>+ Чек-ин дня (21:00)</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Все напоминания' },
          { id: 'medication', label: '💊 Лекарства & Витамины' },
          { id: 'appointment', label: '🩺 Приёмы врачей' },
          { id: 'checkin', label: '❤️ Ежедневный опрос' },
          { id: 'custom', label: '⚙️ Позиции' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === tab.id
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'bg-[#14171C] text-gray-400 border border-gray-800 hover:bg-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reminders List */}
      <div className="space-y-3">
        {filteredReminders.length === 0 ? (
          <div className="bg-[#14171C] p-8 rounded-3xl border border-gray-800 text-center space-y-3">
            <Bell className="w-10 h-10 text-gray-600 mx-auto" />
            <p className="text-sm font-semibold text-gray-300">В этой категории нет созданных напоминаний</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Нажмите кнопку «Создать напоминание» или выберите один из быстрых шаблонов выше.
            </p>
          </div>
        ) : (
          filteredReminders.map((rem) => {
            const badge = getCategoryBadge(rem.category);
            const isCompletedToday = rem.lastCompletedDate === todayStr;

            return (
              <div
                key={rem.id}
                className={`p-5 rounded-2xl border transition-all space-y-3 relative overflow-hidden ${
                  isCompletedToday
                    ? 'bg-[#14171C]/60 border-emerald-500/30 opacity-80'
                    : rem.isEnabled
                    ? 'bg-[#14171C] border-gray-800 hover:border-gray-700'
                    : 'bg-[#14171C]/40 border-gray-800/50 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    {/* Checkbox button for completing today */}
                    <button
                      onClick={() => handleToggleCompleteToday(rem)}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        isCompletedToday
                          ? 'bg-emerald-500 text-slate-950 shadow-md'
                          : 'bg-gray-900 border border-gray-700 text-gray-500 hover:border-emerald-400 hover:text-emerald-400'
                      }`}
                      title={isCompletedToday ? 'Отменить отметку' : 'Отметить принятым/выполненным за сегодня'}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>

                        <span className="text-xs font-mono font-extrabold text-emerald-400 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{rem.time}</span>
                        </span>

                        {isCompletedToday && (
                          <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                            ✓ Принято сегодня
                          </span>
                        )}
                      </div>

                      <h3
                        className={`font-bold text-base mt-1 ${
                          isCompletedToday ? 'line-through text-gray-400' : 'text-gray-100'
                        }`}
                      >
                        {rem.title}
                      </h3>
                    </div>
                  </div>

                  {/* Actions & Enable Toggle */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleTestSound(rem)}
                      className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                      title="Проверить звуковой сигнал"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(rem)}
                      className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                      title="Редактировать"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteReminder(rem.id)}
                      className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Enable Switch */}
                    <label className="relative inline-flex items-center cursor-pointer ml-1">
                      <input
                        type="checkbox"
                        checked={rem.isEnabled}
                        onChange={() => handleToggleEnable(rem.id)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                {/* Dosage & Notes info */}
                {(rem.dosage || rem.notes || rem.days) && (
                  <div className="text-xs text-gray-300 bg-[#0F1115] p-3 rounded-xl border border-gray-800/80 space-y-1">
                    {rem.dosage && (
                      <p>
                        <strong className="text-emerald-400 font-semibold">Дозировка / Схема:</strong>{' '}
                        {rem.dosage}
                      </p>
                    )}
                    {rem.notes && <p className="text-gray-400">Примечание: {rem.notes}</p>}
                    <p className="text-[11px] text-gray-500 pt-0.5">
                      Периодичность: {rem.frequency === 'daily' ? 'Ежедневно' : rem.frequency === 'once' ? 'Однократно' : 'По графикам'}{' '}
                      • Дни: {rem.days?.join(', ') || 'Все'}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal for Creating / Editing Reminder */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#14171C] rounded-2xl max-w-lg w-full p-6 border border-gray-800 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-bold text-gray-100 text-base flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-400" />
                <span>{editingReminder ? 'Редактировать напоминание' : 'Новое напоминание'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-200 text-lg font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReminder} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-300 mb-1">Категория напоминания</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'medication', label: '💊 Лекарство / Витамины' },
                    { id: 'appointment', label: '🩺 Приём врача' },
                    { id: 'checkin', label: '❤️ Чек-ин самочувствия' },
                    { id: 'custom', label: '⚙️ Позиция' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormCategory(cat.id as ReminderCategory)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
                        formCategory === cat.id
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-300 mb-1">Название процедура / медикамент / врач</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Приём L-тироксина 50 мкг"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 text-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Время напоминания</label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-300 mb-1">Мелодия / Сигнал</label>
                  <select
                    value={formSound}
                    onChange={(e) => setFormSound(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="chime">🔔 Звонкий перелив</option>
                    <option value="gentle">🎵 Мягкий сигнал</option>
                    <option value="pulse">⚡ Импульсный сигнал</option>
                  </select>
                </div>
              </div>

              {formCategory === 'medication' && (
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Дозировка и схема приема</label>
                  <input
                    type="text"
                    placeholder="Например: 1 таблетка за 30 мин до еды"
                    value={formDosage}
                    onChange={(e) => setFormDosage(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-gray-300 mb-1">Дни недели</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = formDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setFormDays(formDays.filter((d) => d !== day));
                          } else {
                            setFormDays([...formDays, day]);
                          }
                        }}
                        className={`w-9 h-9 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-300 mb-1">Примечания и указания врача</label>
                <textarea
                  rows={2}
                  placeholder="Дополнительные рекомендации (например, запивать водой)"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-400 hover:bg-gray-800 rounded-xl font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 shadow-md cursor-pointer"
                >
                  {editingReminder ? 'Сохранить изменения' : 'Создать напоминание'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
