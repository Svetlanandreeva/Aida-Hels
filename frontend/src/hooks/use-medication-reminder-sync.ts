import { useEffect } from "react";
import { Platform } from "react-native";

import { api } from "@/src/api";
import { getCircadianDay } from "@/src/circadianApi";
import { useApp } from "@/src/store";
import { updateMedicationSchedule } from "@/src/medicationScheduleApi";

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function hhmm(total: number) {
  const value = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2,"0")}:${String(value % 60).padStart(2,"0")}`;
}

function shiftedFirstTime(medication: any, wakeTime?: string | null) {
  const first = Array.isArray(medication.times) ? medication.times[0] : null;
  if (!first || medication.first_dose_anchor !== "wake" || !wakeTime) return null;
  const offset = Math.max(-240, Math.min(720, Number(medication.wake_offset_minutes || 0)));
  const shifted = hhmm(minutes(wakeTime) + offset);
  return minutes(shifted) > minutes(first) ? shifted : first;
}

export function useMedicationReminderSync() {
  const { activeId, activeProfile, refreshTick } = useApp();

  useEffect(() => {
    if (Platform.OS === "web" || !activeId || !activeProfile) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const {
          cancelNotificationIds,
          getNotificationPermissionState,
          scheduleMedicationDoseAt,
          scheduleMedicationReminders,
        } = await import("@/src/notifications");
        if (cancelled) return;

        const preference = activeProfile.privacy?.notification_preferences?.medications === true;
        const showDetails = activeProfile.privacy?.show_notification_details === true;
        const permission = await getNotificationPermissionState();
        const canSchedule = preference && permission === "granted";
        const today = localDate();
        const [medications, rhythm] = await Promise.all([
          api.listMeds(activeId).catch(() => []),
          getCircadianDay(activeId, today).catch(() => null),
        ]);
        if (cancelled) return;

        for (const medication of medications as any[]) {
          if (cancelled) return;
          const previousIds = Array.isArray(medication.notification_ids) ? medication.notification_ids : [];
          if (previousIds.length) await cancelNotificationIds(previousIds);

          const nextIds: string[] = [];
          const times = Array.isArray(medication.times) ? medication.times : [];
          if (canSchedule && medication.active !== false && times.length) {
            if (medication.first_dose_anchor === "wake") {
              // The wake-linked dose is scheduled only for today after a confirmed wake.
              // It must not become a DAILY reminder, otherwise one late wake would shift future days too.
              const first = shiftedFirstTime(medication, rhythm?.wake?.local_time);
              if (first && rhythm?.wake?.local_time) {
                const id = await scheduleMedicationDoseAt({ medicationId: medication.id, name: medication.name, dose: medication.dose, date: today, time: first, showDetails });
                if (id) nextIds.push(id);
              }
              // Later doses remain ordinary clock-time daily reminders.
              if (times.length > 1) {
                nextIds.push(...await scheduleMedicationReminders({ medicationId: medication.id, name: medication.name, dose: medication.dose, times: times.slice(1), showDetails }));
              }
            } else {
              nextIds.push(...await scheduleMedicationReminders({ medicationId: medication.id, name: medication.name, dose: medication.dose, times, showDetails }));
            }
          }

          const same = previousIds.length === nextIds.length && previousIds.every((id: string, index: number) => id === nextIds[index]);
          if (!same) await updateMedicationSchedule(medication.id, { notification_ids: nextIds }).catch(() => undefined);
        }
      })();
    }, 700);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeId, activeProfile?.privacy?.notification_preferences?.medications, activeProfile?.privacy?.show_notification_details, refreshTick]);
}
