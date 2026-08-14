import React, { useMemo, useState } from 'react';
import { CalendarDays, Plus, X, FileText, MapPin, UserRound, Clock3 } from 'lucide-react';
import { Appointment } from '../types';

interface AppointmentsScreenProps {
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  onOpenDoctorReport: () => void;
}

const emptyForm = {
  specialty: '',
  doctorName: '',
  clinic: '',
  dateTime: '',
  purpose: '',
};

export const AppointmentsScreen: React.FC<AppointmentsScreenProps> = ({
  appointments,
  setAppointments,
  onOpenDoctorReport,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const upcoming = useMemo(() => appointments.filter((item) => item.status === 'upcoming'), [appointments]);
  const completed = useMemo(() => appointments.filter((item) => item.status === 'completed'), [appointments]);

  const openModal = () => {
    setForm(emptyForm);
    setShowModal(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.specialty.trim() || !form.dateTime.trim()) return;

    const created: Appointment = {
      id: `app-${Date.now()}`,
      specialty: form.specialty.trim(),
      doctorName: form.doctorName.trim(),
      clinic: form.clinic.trim(),
      dateTime: form.dateTime.trim(),
      status: 'upcoming',
      purpose: form.purpose.trim(),
    };
    setAppointments((prev) => [created, ...prev]);
    setShowModal(false);
    setForm(emptyForm);
  };

  return (
    <section className="aida-appointments-screen">
      <header className="aida-appointments-hero">
        <div>
          <span className="aida-appointments-eyebrow">Медицинский календарь</span>
          <h1>Приёмы врачей</h1>
          <p>Предстоящие визиты и история консультаций — без вымышленных записей и заранее заполненных врачей.</p>
        </div>
        <button type="button" className="aida-appointments-primary" onClick={openModal}>
          <Plus size={17} /> Добавить приём
        </button>
      </header>

      <div className="aida-appointments-summary">
        <div><span>Предстоящие</span><strong>{upcoming.length}</strong></div>
        <div><span>Прошедшие</span><strong>{completed.length}</strong></div>
        <div><span>Всего записей</span><strong>{appointments.length}</strong></div>
      </div>

      <div className="aida-appointments-section-head">
        <div><h2>Предстоящие</h2><p>Только сохранённые вами записи.</p></div>
      </div>

      {upcoming.length === 0 ? (
        <div className="aida-appointments-empty">
          <div><CalendarDays size={25} /></div>
          <h3>Предстоящих приёмов нет</h3>
          <p>Добавьте запись, когда визит будет назначен. Аида не создаёт врачей, клиники или даты автоматически.</p>
          <button type="button" onClick={openModal}><Plus size={16} /> Добавить приём</button>
        </div>
      ) : (
        <div className="aida-appointments-grid">
          {upcoming.map((appt) => (
            <article className="aida-appointment-card" key={appt.id}>
              <div className="aida-appointment-card__top">
                <div>
                  <span className="aida-appointment-date"><Clock3 size={13} /> {appt.dateTime}</span>
                  <h3>{appt.specialty}</h3>
                </div>
                <span className="aida-appointment-dot" />
              </div>
              <div className="aida-appointment-details">
                {appt.doctorName && <p><UserRound size={15} /><span>{appt.doctorName}</span></p>}
                {appt.clinic && <p><MapPin size={15} /><span>{appt.clinic}</span></p>}
                {appt.purpose && <p className="aida-appointment-purpose">{appt.purpose}</p>}
              </div>
              <footer>
                <button type="button" onClick={onOpenDoctorReport}><FileText size={15} /> Подготовить отчёт</button>
                <button type="button" className="is-danger" onClick={() => setAppointments((prev) => prev.filter((item) => item.id !== appt.id))}>Удалить</button>
              </footer>
            </article>
          ))}
        </div>
      )}

      <div className="aida-appointments-section-head aida-appointments-section-head--history">
        <div><h2>История консультаций</h2><p>Прошедшие приёмы, которые есть в вашей карте.</p></div>
      </div>

      {completed.length === 0 ? (
        <div className="aida-appointments-history-empty">Прошедших приёмов пока нет.</div>
      ) : (
        <div className="aida-appointments-history">
          {completed.map((appt) => (
            <div className="aida-appointments-history-row" key={appt.id}>
              <div><strong>{appt.specialty}</strong><span>{[appt.doctorName, appt.clinic].filter(Boolean).join(' · ') || 'Дополнительные данные не указаны'}</span></div>
              <time>{appt.dateTime}</time>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="aida-appointments-modal-backdrop" role="presentation">
          <div className="aida-appointments-modal" role="dialog" aria-modal="true" aria-label="Добавить приём врача">
            <header><div><span>Новая запись</span><h2>Добавить приём врача</h2></div><button type="button" onClick={() => setShowModal(false)} aria-label="Закрыть"><X size={19} /></button></header>
            <form onSubmit={submit}>
              <label><span>Специальность *</span><input required value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Например, терапевт" /></label>
              <label><span>Врач</span><input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} placeholder="Если уже известен" /></label>
              <label><span>Клиника</span><input value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value })} placeholder="Если уже известна" /></label>
              <label><span>Дата и время *</span><input required value={form.dateTime} onChange={(e) => setForm({ ...form, dateTime: e.target.value })} placeholder="Например, 18 августа, 10:00" /></label>
              <label><span>Цель визита</span><textarea rows={3} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Что хотите обсудить с врачом" /></label>
              <div className="aida-appointments-modal__actions"><button type="button" onClick={() => setShowModal(false)}>Отмена</button><button type="submit" className="aida-appointments-primary">Сохранить</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default AppointmentsScreen;
