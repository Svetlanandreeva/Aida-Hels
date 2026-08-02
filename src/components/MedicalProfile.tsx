import React from 'react';
import { UserProfile } from '../types';
import {
  FileText,
  User,
  Heart,
  Brain,
  ShieldCheck,
  Printer,
  Sparkles,
  Edit2,
  Calendar,
} from 'lucide-react';

interface MedicalProfileProps {
  user: UserProfile;
  onOpenDoctorReport: () => void;
  onEditQuestionnaire: () => void;
}

export const MedicalProfile: React.FC<MedicalProfileProps> = ({
  user,
  onOpenDoctorReport,
  onEditQuestionnaire,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32 sm:pb-36 text-white font-[SF Pro Display],Inter">
      {/* Header */}
      <div className="bg-[#0B1320] p-6 sm:p-8 rounded-3xl border border-white/[0.08] shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34F5AA]/10 text-[#34F5AA] border border-[#34F5AA]/20 text-xs font-bold">
            <FileText className="w-3.5 h-3.5" />
            <span>Паспорт анамнеза (Только чтение)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {user.fullName}
          </h1>
          <p className="text-xs text-white/60">
            Электронная медицинская карта • Дата рождения: {user.birthDate}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <button
            onClick={onEditQuestionnaire}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
          >
            <Edit2 className="w-4 h-4" />
            <span>Редактировать анкету</span>
          </button>
          <button
            onClick={onOpenDoctorReport}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-[#34F5AA] hover:bg-[#2ce093] text-[#050A12] font-bold text-xs rounded-xl shadow-lg shadow-[#34F5AA]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Сформировать отчёт для врача</span>
          </button>
        </div>
      </div>

      {/* Grid of Profile Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Антропометрия и демография */}
        <div className="bg-[#0B1320] p-6 rounded-2xl border border-white/[0.08] shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-white font-bold text-sm">
            <User className="w-4 h-4 text-[#34F5AA]" />
            <span>1. Антропометрия и физиология</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#101C2B] p-3 rounded-xl border border-white/[0.04]">
              <span className="text-white/50 block text-[11px]">Рост</span>
              <strong className="text-white text-sm">{user.height ? `${user.height} см` : 'Не указан'}</strong>
            </div>
            <div className="bg-[#101C2B] p-3 rounded-xl border border-white/[0.04]">
              <span className="text-white/50 block text-[11px]">Вес</span>
              <strong className="text-white text-sm">{user.weight ? `${user.weight} кг` : 'Не указан'}</strong>
            </div>
            <div className="bg-[#101C2B] p-3 rounded-xl border border-white/[0.04]">
              <span className="text-white/50 block text-[11px]">ИМТ (Индекс массы)</span>
              <strong className="text-[#34F5AA] text-sm">
                {(user.height > 0 && user.weight > 0)
                  ? `${(user.weight / Math.pow(user.height / 100, 2)).toFixed(1)} кг/м²`
                  : '—'}
              </strong>
            </div>
            <div className="bg-[#101C2B] p-3 rounded-xl border border-white/[0.04]">
              <span className="text-white/50 block text-[11px]">Пол</span>
              <strong className="text-white text-sm">
                {user.gender === 'female' ? 'Женский' : 'Мужской'}
              </strong>
            </div>
          </div>
        </div>

        {/* Card 2: Группа крови и иммунитет */}
        <div className="bg-[#0B1320] p-6 rounded-2xl border border-white/[0.08] shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-white font-bold text-sm">
            <Heart className="w-4 h-4 text-[#34F5AA]" />
            <span>2. Кровь, аллергии и ОРВИ</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center bg-[#101C2B] p-3 rounded-xl border border-white/[0.04]">
              <span className="text-white/70">Группа крови и резус:</span>
              <span className="font-extrabold text-[#34F5AA] bg-[#050A12] px-2.5 py-1 rounded border border-[#34F5AA]/30">
                {user.bloodType} ({user.rhFactor})
              </span>
            </div>

            <div>
              <span className="text-white/50 block mb-1">Аллергологический анамнез:</span>
              <div className="flex flex-wrap gap-1.5">
                {user.allergies.length > 0 ? (
                  user.allergies.map((a, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-lg font-semibold"
                    >
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="text-white/40">Аллергии не зафиксированы</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-white/70">Частота ОРВИ:</span>
              <span className="font-bold text-white">{user.orviFrequency}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Хронические заболевания */}
        <div className="bg-[#0B1320] p-6 rounded-2xl border border-white/[0.08] shadow-xl space-y-4 md:col-span-2">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-[#34F5AA]" />
              <span>3. Хронические заболевания и фармакотерапия</span>
            </div>
            <span className="text-xs text-white/50">{user.chronicDiagnoses.length} записи</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {user.chronicDiagnoses.map((d) => (
              <div
                key={d.id}
                className="p-4 bg-[#101C2B] rounded-xl border border-white/[0.04] text-xs space-y-1"
              >
                <div className="flex justify-between font-bold text-white">
                  <span>{d.name}</span>
                  <span className="text-white/50 font-normal">Установлен в {d.sinceYear} г.</span>
                </div>
                <p className="text-[#34F5AA] font-medium pt-1">
                  Текущее назначение: {d.medication}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Card 4: Психологический статус */}
        <div className="bg-[#0B1320] p-6 rounded-2xl border border-white/[0.08] shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-white font-bold text-sm">
            <Brain className="w-4 h-4 text-[#34F5AA]" />
            <span>4. Психология и соматика</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center bg-[#101C2B] p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-white/70">Уровень стресса:</span>
              <span className="font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded">
                {user.psychology.stressLevel} из 10
              </span>
            </div>
            <div className="flex justify-between items-center bg-[#101C2B] p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-white/70">Суточный сон:</span>
              <span className="font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded">
                {user.psychology.sleepHours} часов
              </span>
            </div>
            <div className="flex justify-between items-center bg-[#101C2B] p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-white/70">Настроение:</span>
              <span className="font-bold text-white capitalize">{user.psychology.mood}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Женское здоровье (Если женщина) */}
        {user.gender === 'female' && user.womenHealth && (
          <div className="bg-[#0B1320] p-6 rounded-2xl border border-pink-500/20 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-pink-500/20 pb-3 text-pink-300 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>5. Репродуктивный паспорт</span>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center bg-[#101C2B] p-2.5 rounded-xl border border-white/[0.04]">
                <span className="text-white/70">Длительность цикла:</span>
                <span className="font-bold text-pink-300">{user.womenHealth.cycleLength} дней</span>
              </div>
              <div className="flex justify-between items-center bg-[#101C2B] p-2.5 rounded-xl border border-white/[0.04]">
                <span className="text-white/70">Дата последних месячных:</span>
                <span className="font-bold text-pink-300">{user.womenHealth.lastPeriodDate}</span>
              </div>
              <div className="flex justify-between items-center bg-[#101C2B] p-2.5 rounded-xl border border-white/[0.04]">
                <span className="text-white/70">Болезненность цикла:</span>
                <span className="font-bold text-pink-300">{user.womenHealth.painLevel} / 10</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
