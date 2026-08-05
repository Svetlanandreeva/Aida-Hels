import React, { useState } from 'react';
import { UserProfile, MedicalDocument, BodySystem, Reminder, DiaryEntry } from '../../types';
import { Printer, X, Download, ShieldCheck, Heart, FileText, CheckCircle2 } from 'lucide-react';

interface DoctorReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  documents: MedicalDocument[];
  systems: BodySystem[];
  reminders?: Reminder[];
  diaryEntries?: DiaryEntry[];
}

export const DoctorReportModal: React.FC<DoctorReportModalProps> = ({
  isOpen,
  onClose,
  user,
  documents,
  systems,
  reminders = [],
  diaryEntries = [],
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleServerDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/reports/doctor-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_from: '2026-01-01',
          date_to: new Date().toISOString().split('T')[0],
          profile: user,
          medications: reminders,
          diaryEntries,
          documents,
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Health_Doctor_Report_${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Не удалось сформировать отчёт на сервере.');
      }
    } catch (e) {
      console.error('Download report error:', e);
      alert('Ошибка скачивания отчёта.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#14171C] rounded-3xl max-w-3xl w-full p-6 sm:p-10 shadow-2xl space-y-6 relative max-h-[92vh] overflow-y-auto border border-gray-800">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 print:hidden">
          <div className="flex items-center gap-2 text-gray-100 font-bold text-sm">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span>Печатная выписка анамнеза для лечащего врача</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleServerDownload}
              disabled={isDownloading}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Формирую...' : 'Скачать файл'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Распечатать / Сохранить в PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-200 text-lg font-bold rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE MEDICAL REPORT PAPER FORMAT */}
        <div className="p-6 bg-[#0F1115] border border-gray-800 rounded-2xl space-y-6 text-gray-200 font-sans print:bg-white print:text-slate-900 print:p-0 print:border-none">
          {/* Paper Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-700 print:border-slate-900 pb-4">
            <div>
              <h1 className="text-xl font-extrabold uppercase tracking-tight text-gray-100 print:text-slate-900">
                СВОДНЫЙ МЕДИЦИНСКИЙ ОТЧЁТ И АНАМНЕЗ
              </h1>
              <p className="text-xs text-gray-400 print:text-slate-600 mt-1">
                Сформировано платформой «Здоровье ИИ» • {new Date().toLocaleDateString('ru-RU')}
              </p>
            </div>
            <div className="text-right text-[11px] text-gray-400 print:text-slate-500 font-mono">
              ID: {user.email.split('@')[0].toUpperCase()}-2026
              <br />
              ВЕРСИЯ: 2.4-MED
            </div>
          </div>

          {/* Patient Details Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#14171C] print:bg-white p-4 rounded-xl border border-gray-800 print:border-slate-200 text-xs">
            <div>
              <span className="text-gray-400 print:text-slate-500 block text-[10px]">Пациент</span>
              <strong className="text-gray-100 print:text-slate-900">{user.fullName}</strong>
            </div>
            <div>
              <span className="text-gray-400 print:text-slate-500 block text-[10px]">Дата рождения</span>
              <strong className="text-gray-100 print:text-slate-900">{user.birthDate}</strong>
            </div>
            <div>
              <span className="text-gray-400 print:text-slate-500 block text-[10px]">Группа крови / Rh</span>
              <strong className="text-gray-100 print:text-slate-900">{user.bloodType} ({user.rhFactor})</strong>
            </div>
            <div>
              <span className="text-gray-400 print:text-slate-500 block text-[10px]">Рост / Вес / ИМТ</span>
              <strong className="text-gray-100 print:text-slate-900">
                {user.height || '—'} см / {user.weight || '—'} кг (
                {(user.height > 0 && user.weight > 0)
                  ? (user.weight / Math.pow(user.height / 100, 2)).toFixed(1)
                  : '—'}
                )
              </strong>
            </div>
          </div>

          {/* Allergies & Chronic Conditions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-[#14171C] print:bg-white p-4 rounded-xl border border-gray-800 print:border-slate-200 space-y-2">
              <span className="font-bold text-rose-400 print:text-rose-800 uppercase text-[10px] tracking-wider block">
                Аллергический анамнез
              </span>
              <p className="text-gray-300 print:text-slate-800">
                {user.allergies.length > 0 ? (
                  <strong className="text-rose-400 print:text-rose-700">{user.allergies.join(', ')}</strong>
                ) : (
                  'Аллергические реакции не отмечены.'
                )}
              </p>
            </div>

            <div className="bg-[#14171C] print:bg-white p-4 rounded-xl border border-gray-800 print:border-slate-200 space-y-2">
              <span className="font-bold text-gray-100 print:text-slate-900 uppercase text-[10px] tracking-wider block">
                Хронические диагнозы и препараты
              </span>
              <ul className="list-disc list-inside space-y-1 text-gray-300 print:text-slate-800">
                {user.chronicDiagnoses.map((d) => (
                  <li key={d.id}>
                    <strong className="text-gray-100 print:text-slate-900">{d.name}</strong> — {d.medication} ({d.sinceYear} г.)
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Body Systems Summary */}
          <div className="bg-[#14171C] print:bg-white p-4 rounded-xl border border-gray-800 print:border-slate-200 space-y-3 text-xs">
            <span className="font-bold text-gray-100 print:text-slate-900 uppercase text-[10px] tracking-wider block">
              Состояние 10 систем организма (ИИ-Карта)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {systems.map((s) => (
                <div key={s.id} className="p-2 bg-[#0F1115] print:bg-slate-50 rounded-lg border border-gray-800 print:border-slate-100 text-[11px]">
                  <span className="font-semibold block truncate text-gray-100 print:text-slate-900">{s.name}</span>
                  <span
                    className={`font-bold text-[10px] ${
                      s.status === 'norm' ? 'text-emerald-400 print:text-emerald-700' : 'text-amber-400 print:text-amber-700'
                    }`}
                  >
                    {s.score}% • {s.statusText}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Lab Deviations */}
          <div className="bg-[#14171C] print:bg-white p-4 rounded-xl border border-gray-800 print:border-slate-200 space-y-3 text-xs">
            <span className="font-bold text-gray-100 print:text-slate-900 uppercase text-[10px] tracking-wider block">
              Зафиксированные отклонения в лабораторных исследованиях
            </span>
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-gray-800 print:border-slate-200 text-gray-400 print:text-slate-500 font-semibold bg-[#0F1115] print:bg-slate-50">
                  <th className="py-1.5 px-2">Показатель</th>
                  <th className="py-1.5 px-2">Значение</th>
                  <th className="py-1.5 px-2">Референс</th>
                  <th className="py-1.5 px-2">Интерпретация</th>
                </tr>
              </thead>
              <tbody>
                {documents.flatMap((d) => d.deviations).map((dev, idx) => (
                  <tr key={idx} className="border-b border-gray-800 print:border-slate-100">
                    <td className="py-1.5 px-2 font-bold text-gray-100 print:text-slate-900">{dev.marker}</td>
                    <td className="py-1.5 px-2 text-rose-400 print:text-rose-700 font-semibold">{dev.value}</td>
                    <td className="py-1.5 px-2 text-gray-400 print:text-slate-500">{dev.norm}</td>
                    <td className="py-1.5 px-2 text-gray-300 print:text-slate-700">{dev.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signatures & Disclaimer */}
          <div className="pt-4 border-t border-gray-700 print:border-slate-300 flex justify-between items-end text-[10px] text-gray-400 print:text-slate-500">
            <div>
              <p>Документ сформирован автоматически в системе «Здоровье ИИ».</p>
              <p>Данные сверены с Федеральными клиническими рекомендациями РФ.</p>
            </div>
            <div className="text-right">
              <p className="font-mono">Подпись врача: ___________________</p>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="pt-2 flex justify-end gap-3 print:hidden">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-900 text-gray-300 border border-gray-800 font-semibold text-xs rounded-xl hover:bg-gray-800 cursor-pointer"
          >
            Закрыть
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Печать</span>
          </button>
        </div>
      </div>
    </div>
  );
};
