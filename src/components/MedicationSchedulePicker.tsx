import React from 'react';
import { MedicationSchedule, MedicationScheduleSlot } from '../types';

interface MedicationSchedulePickerProps {
  schedule?: MedicationSchedule;
  onChange: (updatedSchedule: MedicationSchedule) => void;
  label?: string;
}

export const MedicationSchedulePicker: React.FC<MedicationSchedulePickerProps> = ({
  schedule,
  onChange,
  label = 'Расписание приёма:',
}) => {
  const safeSchedule: MedicationSchedule = schedule || {};

  const defaultTimes = {
    morning: '08:00',
    afternoon: '13:00',
    evening: '20:00',
  };

  const handleToggleSlot = (slot: 'morning' | 'afternoon' | 'evening') => {
    const current = safeSchedule[slot];
    const isNowEnabled = !current?.enabled;
    const timeToSet = current?.time || defaultTimes[slot];

    onChange({
      ...safeSchedule,
      [slot]: {
        enabled: isNowEnabled,
        time: timeToSet,
      },
    });
  };

  const handleTimeChange = (slot: 'morning' | 'afternoon' | 'evening', time: string) => {
    onChange({
      ...safeSchedule,
      [slot]: {
        enabled: safeSchedule[slot]?.enabled ?? true,
        time: time,
      },
    });
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-800 space-y-2">
      {label && (
        <span className="text-[11px] font-semibold text-gray-300 block">
          {label}
        </span>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Morning / Утро */}
        <div
          className={`p-2 rounded-xl border transition-all ${
            safeSchedule.morning?.enabled
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              : 'bg-gray-900 border-gray-800 text-gray-400'
          }`}
        >
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
            <input
              type="checkbox"
              checked={Boolean(safeSchedule.morning?.enabled)}
              onChange={() => handleToggleSlot('morning')}
              className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
            />
            <span>Утро</span>
          </label>
          {safeSchedule.morning?.enabled && (
            <div className="mt-1.5">
              <label className="text-[10px] text-gray-400 block mb-0.5">Время:</label>
              <input
                type="time"
                value={safeSchedule.morning.time || defaultTimes.morning}
                onChange={(e) => handleTimeChange('morning', e.target.value)}
                className="w-full px-2 py-1 bg-gray-950 border border-emerald-500/50 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
            </div>
          )}
        </div>

        {/* Afternoon / День */}
        <div
          className={`p-2 rounded-xl border transition-all ${
            safeSchedule.afternoon?.enabled
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              : 'bg-gray-900 border-gray-800 text-gray-400'
          }`}
        >
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
            <input
              type="checkbox"
              checked={Boolean(safeSchedule.afternoon?.enabled)}
              onChange={() => handleToggleSlot('afternoon')}
              className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
            />
            <span>День</span>
          </label>
          {safeSchedule.afternoon?.enabled && (
            <div className="mt-1.5">
              <label className="text-[10px] text-gray-400 block mb-0.5">Время:</label>
              <input
                type="time"
                value={safeSchedule.afternoon.time || defaultTimes.afternoon}
                onChange={(e) => handleTimeChange('afternoon', e.target.value)}
                className="w-full px-2 py-1 bg-gray-950 border border-emerald-500/50 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
            </div>
          )}
        </div>

        {/* Evening / Вечер */}
        <div
          className={`p-2 rounded-xl border transition-all ${
            safeSchedule.evening?.enabled
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              : 'bg-gray-900 border-gray-800 text-gray-400'
          }`}
        >
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
            <input
              type="checkbox"
              checked={Boolean(safeSchedule.evening?.enabled)}
              onChange={() => handleToggleSlot('evening')}
              className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
            />
            <span>Вечер</span>
          </label>
          {safeSchedule.evening?.enabled && (
            <div className="mt-1.5">
              <label className="text-[10px] text-gray-400 block mb-0.5">Время:</label>
              <input
                type="time"
                value={safeSchedule.evening.time || defaultTimes.evening}
                onChange={(e) => handleTimeChange('evening', e.target.value)}
                className="w-full px-2 py-1 bg-gray-950 border border-emerald-500/50 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
