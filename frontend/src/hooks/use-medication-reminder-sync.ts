import { useEffect } from "react";
import { Platform } from "react-native";

import { api } from "@/src/api";
import { useApp } from "@/src/store";
import { updateMedicationSchedule } from "@/src/medicationScheduleApi";
import {
  cancelNotificationIds,
  getNotificationPermissionState,
  scheduleMedicationReminders,
} from "@/src/notifications";

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

        const medications = await api.listMeds(activeId).catch(() => []);
        if (cancelled) return;

        for (const medication of medications as any[]) {
          if (cancelled) return;
          const previousIds = Array.isArray(medication.notification_ids) ? medication.notification_ids : [];
          if (previousIds.length) await cancelNotificationIds(previousIds);

          let nextIds: string[] = [];
          if (canSchedule && medication.active !== false && Array.isArray(medication.times) && medication.times.length) {
            nextIds = await scheduleMedicationReminders({
              medicationId: medication.id,
              name: medication.name,
              dose: medication.dose,
              times: medication.times,
              showDetails,
            });
          }

          const same = previousIds.length === nextIds.length && previousIds.every((id: string, index: number) => id === nextIds[index]);
          if (!same) {
            await updateMedicationSchedule(medication.id, { notification_ids: nextIds }).catch(() => undefined);
          }
        }
      })();
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeId, activeProfile?.privacy?.notification_preferences?.medications, activeProfile?.privacy?.show_notification_details, refreshTick]);
}
