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
  CalendarDays,
  Droplets,
  Ruler,
  Weight,
  Activity,
} from 'lucide-react';

interface MedicalProfileProps {
  user: UserProfile;
  onOpenDoctorReport: () => void;
  onEditQuestionnaire: () => void;
}

const ValueCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) => (
  <div className="rounded-[20px] border border-[#e2e6ee] bg-[#f7f8fa] p-4">
    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#e9294f] shadow-sm">
      {icon}
    </div>
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a91a0]">{label}</p>
    <div className="mt-1.5 text-[17px] font-extrabold text-[#061d48]">{value}</div>
  </div>
);

const Section = ({
  title,
  subtitle,
  icon,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <section className={`rounded-[28px] border border-[#e2e6ee] bg-white p-5 shadow-[0_18px_45px_rgba(6,29,72,0.06)] sm:p-6 ${className}`}>
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff1f3] text-[#e9294f]">
        {icon}
      </div>
      <div>
        <h2 className="text-[16px] font-extrabold text-[#061d48]">{title}</h2>
        {subtitle && <p className="mt-1 text-xs leading-5 text-[#737b8c]">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

export const MedicalProfile: React.FC<MedicalProfileProps> = ({
  user,
  onOpenDoctorReport,
  onEditQuestionnaire,
}) => {
  const hasAnthropometry = Boolean(user.height || user.weight);
  const bmi = user.height > 0 && user.weight > 0
    ? (user.weight / Math.pow(user.height / 100, 2)).toFixed(1)
    : null;

  const bloodValue = user.bloodType
    ? `${user.bloodType}${user.rhFactor ? ` · ${user.rhFactor}` : ''}`
    : 'Нет данных';

  const chronicDiagnoses = Array.isArray(user.chronicDiagnoses) ? user.chronicDiagnoses : [];
  const allergies = Array.isArray(user.allergies) ? user.allergies : [];

  return (
    <div className="mx-auto max-w-[1080px] space-y-6 pb-32 text-[#061d48] sm:pb-36">
      <section className="relative overflow-hidden rounded-[34px] border border-[#e2e6ee] bg-white p-6 shadow-[0_24px_70px_rgba(6,29,72,0.08)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#fff0f3] blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#f4cfd7] bg-[#fff6f8] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#c71f45]">
              <FileText className="h-3.5 w-3.5" />
              Медицинский паспорт
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-[#061d48] sm:text-4xl">
              {user.fullName || 'Профиль здоровья'}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#747d8e]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-[#e9294f]" />
                {user.birthDate ? `Дата рождения: ${user.birthDate}` : 'Дата рождения не указана'}
              </span>
              <span className="h-1 w-1 rounded-full bg-[#c7ccd6]" />
              <span>Данные отображаются только из вашего профиля</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onEditQuestionnaire}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dce1ea] bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#061d48] transition hover:bg-[#eef1f5]"
            >
              <Edit2 className="h-4 w-4" />
              Редактировать анкету
            </button>
            <button
              onClick={onOpenDoctorReport}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#061d48] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(6,29,72,0.2)] transition hover:-translate-y-0.5"
            >
              <Printer className="h-4 w-4" />
              Отчёт для врача
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Основные параметры"
          subtitle="Антропометрия и базовые физиологические данные"
          icon={<User className="h-5 w-5" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <ValueCard label="Рост" value={user.height ? `${user.height} см` : 'Нет данных'} icon={<Ruler className="h-4 w-4" />} />
            <ValueCard label="Вес" value={user.weight ? `${user.weight} кг` : 'Нет данных'} icon={<Weight className="h-4 w-4" />} />
            <ValueCard label="ИМТ" value={bmi ? `${bmi} кг/м²` : 'Нет данных'} icon={<Activity className="h-4 w-4" />} />
            <ValueCard
              label="Пол"
              value={user.gender === 'female' ? 'Женский' : user.gender === 'male' ? 'Мужской' : 'Нет данных'}
              icon={<User className="h-4 w-4" />}
            />
          </div>
          {!hasAnthropometry && (
            <p className="mt-4 rounded-2xl bg-[#f7f8fa] px-4 py-3 text-xs leading-5 text-[#737b8c]">
              Добавьте рост и вес в анкете, чтобы здесь появились расчётные показатели.
            </p>
          )}
        </Section>

        <Section
          title="Кровь и аллергии"
          subtitle="Группа крови, резус-фактор и зарегистрированные аллергии"
          icon={<Heart className="h-5 w-5" />}
        >
          <div className="rounded-[22px] border border-[#e2e6ee] bg-[#f7f8fa] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a91a0]">Группа крови</p>
                <p className="mt-1 text-xl font-black text-[#061d48]">{bloodValue}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#e9294f] shadow-sm">
                <Droplets className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a91a0]">Аллергии</p>
            {allergies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {allergies.map((allergy, index) => (
                  <span key={`${allergy}-${index}`} className="rounded-full border border-[#f2cbd4] bg-[#fff4f6] px-3 py-1.5 text-xs font-bold text-[#bd2145]">
                    {allergy}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#dfe3ea] px-4 py-4 text-sm text-[#7b8392]">Нет данных об аллергиях</div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#e2e6ee] px-4 py-3 text-sm">
            <span className="text-[#737b8c]">Частота ОРВИ</span>
            <strong className="text-[#061d48]">{user.orviFrequency || 'Нет данных'}</strong>
          </div>
        </Section>

        <Section
          title="Хронические заболевания"
          subtitle="Только диагнозы и назначения, сохранённые в профиле"
          icon={<ShieldCheck className="h-5 w-5" />}
          className="lg:col-span-2"
        >
          {chronicDiagnoses.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {chronicDiagnoses.map((diagnosis) => (
                <div key={diagnosis.id} className="rounded-[22px] border border-[#e2e6ee] bg-[#f7f8fa] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-extrabold text-[#061d48]">{diagnosis.name}</h3>
                      <p className="mt-1 text-xs text-[#7a8392]">
                        {diagnosis.sinceYear ? `С ${diagnosis.sinceYear} года` : 'Год постановки не указан'}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#89909e] shadow-sm">запись</span>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white px-3.5 py-3 text-sm">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9299a6]">Назначение</span>
                    <strong className="mt-1 block text-[#061d48]">{diagnosis.medication || 'Нет данных'}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-[#dfe3ea] bg-[#fafbfc] px-5 py-7 text-center">
              <ShieldCheck className="mx-auto h-6 w-6 text-[#aeb5c1]" />
              <p className="mt-3 font-bold text-[#061d48]">Нет сохранённых диагнозов</p>
              <p className="mt-1 text-xs text-[#7c8492]">Пустой список не означает отсутствие заболеваний — только отсутствие записей в профиле.</p>
            </div>
          )}
        </Section>

        <Section
          title="Психоэмоциональный профиль"
          subtitle="Данные из психологической части анкеты"
          icon={<Brain className="h-5 w-5" />}
        >
          <div className="space-y-3">
            {[
              ['Уровень стресса', user.psychology?.stressLevel !== undefined ? `${user.psychology.stressLevel} из 10` : 'Нет данных'],
              ['Сон', user.psychology?.sleepHours !== undefined ? `${user.psychology.sleepHours} ч` : 'Нет данных'],
              ['Настроение', user.psychology?.mood || 'Нет данных'],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between gap-4 rounded-2xl border border-[#e2e6ee] bg-[#f7f8fa] px-4 py-3">
                <span className="text-sm text-[#737b8c]">{label}</span>
                <strong className="text-sm text-[#061d48]">{value}</strong>
              </div>
            ))}
          </div>
        </Section>

        {user.gender === 'female' && (
          <Section
            title="Женское здоровье"
            subtitle="Параметры цикла, сохранённые в анкете"
            icon={<Sparkles className="h-5 w-5" />}
          >
            {user.womenHealth ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-[#f1d8df] bg-[#fff7f9] px-4 py-3">
                  <span className="text-sm text-[#8a6170]">Длительность цикла</span>
                  <strong className="text-sm text-[#8f1d3d]">{user.womenHealth.cycleLength ? `${user.womenHealth.cycleLength} дней` : 'Нет данных'}</strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[#f1d8df] bg-[#fff7f9] px-4 py-3">
                  <span className="text-sm text-[#8a6170]">Последняя менструация</span>
                  <strong className="text-sm text-[#8f1d3d]">{user.womenHealth.lastPeriodDate || 'Нет данных'}</strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[#f1d8df] bg-[#fff7f9] px-4 py-3">
                  <span className="text-sm text-[#8a6170]">Болезненность</span>
                  <strong className="text-sm text-[#8f1d3d]">{user.womenHealth.painLevel !== undefined ? `${user.womenHealth.painLevel} / 10` : 'Нет данных'}</strong>
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-[#ead8de] bg-[#fffafb] px-4 py-6 text-center text-sm text-[#8a7480]">Нет сохранённых данных</div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
};