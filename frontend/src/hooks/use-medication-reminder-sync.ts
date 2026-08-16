import { useEffect } from "react";
import { Platform } from "react-native";

import { api } from "@/src/api";
import { getCircadianDay } from "@/src/circadianApi";
import { useApp } from "@/src/store";
import { updateMedicationSchedule } from "@/src/medicationScheduleApi";
import { cancelNotificationIds, getNotificationPermissionState, scheduleMedicationReminders } from "@/src/notifications";

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

function effectiveReminderTimes(medication: any, wakeTime?: string | null) {
  const times = Array.isArray(medication.times) ? [...medication.times] : [];
  if (!times.length || medication.first_dose_anchor !== "wake" || !wakeTime) return times;
  const offset = Math.max(-240, Math.min(720, Number(medication.wake_offset_minutes || 0)));
  const shifted = hhmm(minutes(wakeTime) + offset);
  if (minutes(shifted) > minutes(times[0])) times[0] = shifted;
  return times;
}

export function useMedicationReminderSync() {
  const { activeId, activeProfile, refreshTick } = useApp();

  useEffect(() => {
    if (Platform.OS === "web" || !activeId || !activeProfile) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const preference = activeProfile.privacy?.notification_preferences?.medications === true;
        const showDetails = activeProfile.privacy?.show_notification_details === true;
        const permission = await getNotificationPermissionState();
        const canSchedule = preference && permission === "granted";
        const [medications, rhythm] = await Promise.all([
          api.listMeds(activeId).catch(() => []),
          getCircadianDay(activeId, localDate()).catch(() => null),
        ]);
        if (cancelled) return;

        for (const medication of medications as any[]) {
          if (cancelled) return;
          const previousIds = Array.isArray(medication.notification_ids) ? medication.notification_ids : [];
          if (previousIds.length) await cancelNotificationIds(previousIds);

          let nextIds: string[] = [];
          const reminderTimes = effectiveReminderTimes(medication, rhythm?.wake?.local_time);
          if (canSchedule && medication.active !== false && reminderTimes.length) {
            nextIds = await scheduleMedicationReminders({ medicationId: medication.id, name: medication.name, dose: medication.dose, times: reminderTimes, showDetails });
          }
          const same = previousIds.length === nextIds.length && previousIds.every((id: string, index: number) => id === nextIds[index]);
          if (!same) await updateMedicationSchedule(medication.id, { notification_ids: nextIds }).catch(() => undefined);
        }
      })();
    }, 700);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeId, activeProfile?.privacy?.notification_preferences?.medications, activeProfile?.privacy?.show_notification_details, refreshTick]);
}
