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
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <FileText className="w-3.5 h-3.5" />
            <span>Паспорт анамнеза (Только чтение)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {user.fullName}
          </h1>
          <p className="text-xs text-slate-500">
            Электронная медицинская карта • Дата рождения: {user.birthDate}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={onEditQuestionnaire}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
            <span>Редактировать анкету</span>
          </button>
          <button
            onClick={onOpenDoctorReport}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Сформировать отчёт для врача</span>
          </button>
        </div>
      </div>

      {/* Grid of Profile Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Антропометрия и демография */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-900 font-bold text-sm">
            <User className="w-4 h-4 text-emerald-600" />
            <span>1. Антропометрия и физиология</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px]">Рост</span>
              <strong className="text-slate-900 text-sm">{user.height} см</strong>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px]">Вес</span>
              <strong className="text-slate-900 text-sm">{user.weight} кг</strong>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px]">ИМТ (Индекс массы)</span>
              <strong className="text-emerald-700 text-sm">
                {(user.weight / Math.pow(user.height / 100, 2)).toFixed(1)} кг/м²
              </strong>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px]">Пол</span>
              <strong className="text-slate-900 text-sm">
                {user.gender === 'female' ? 'Женский' : 'Мужской'}
              </strong>
            </div>
          </div>
        </div>

        {/* Card 2: Группа крови и иммунитет */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-900 font-bold text-sm">
            <Heart className="w-4 h-4 text-emerald-600" />
            <span>2. Кровь, аллергии и ОРВИ</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
              <span className="text-slate-600">Группа крови и резус:</span>
              <span className="font-extrabold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200">
                {user.bloodType} ({user.rhFactor})
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-1">Аллергологический анамнез:</span>
              <div className="flex flex-wrap gap-1.5">
                {user.allergies.length > 0 ? (
                  user.allergies.map((a, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg font-semibold"
                    >
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">Аллергии не зафиксированы</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-600">Частота ОРВИ:</span>
              <span className="font-bold text-slate-900">{user.orviFrequency}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Хронические заболевания */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4 md:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>3. Хронические заболевания и фармакотерапия</span>
            </div>
            <span className="text-xs text-slate-500">{user.chronicDiagnoses.length} записи</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {user.chronicDiagnoses.map((d) => (
              <div
                key={d.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1"
              >
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{d.name}</span>
                  <span className="text-slate-500 font-normal">Установлен в {d.sinceYear} г.</span>
                </div>
                <p className="text-emerald-700 font-medium pt-1">
                  Текущее назначение: {d.medication}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Card 4: Психологический статус */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-900 font-bold text-sm">
            <Brain className="w-4 h-4 text-emerald-600" />
            <span>4. Психология и соматика</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Уровень стресса:</span>
              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                {user.psychology.stressLevel} из 10
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Суточный сон:</span>
              <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                {user.psychology.sleepHours} часов
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Настроение:</span>
              <span className="font-bold text-slate-900 capitalize">{user.psychology.mood}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Женское здоровье (Если женщина) */}
        {user.gender === 'female' && user.womenHealth && (
          <div className="bg-white p-6 rounded-2xl border border-pink-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-pink-100 pb-3 text-pink-900 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-pink-600" />
              <span>5. Репродуктивный паспорт</span>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Длительность цикла:</span>
                <span className="font-bold text-pink-900">{user.womenHealth.cycleLength} дней</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Дата последних месячных:</span>
                <span className="font-bold text-pink-900">{user.womenHealth.lastPeriodDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Болезненность цикла:</span>
                <span className="font-bold text-pink-900">{user.womenHealth.painLevel} / 10</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
