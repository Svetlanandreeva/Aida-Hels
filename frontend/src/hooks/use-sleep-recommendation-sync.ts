import { useEffect } from "react";
import { Platform } from "react-native";

import { getCircadianDay, getSleepInsight, saveRecommendationReminder } from "@/src/circadianApi";
import { useApp } from "@/src/store";

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useSleepRecommendationSync() {
  const { activeId, activeProfile, refreshTick } = useApp();

  useEffect(() => {
    if (Platform.OS === "web" || !activeId || !activeProfile) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        const {
          cancelNotificationIds,
          getNotificationPermissionState,
          schedulePersonalSleepWindowReminder,
        } = await import("@/src/notifications");
        if (cancelled) return;

        const date = localDate();
        const [day, insight, permission] = await Promise.all([
          getCircadianDay(activeId, date).catch(() => null),
          getSleepInsight(activeId).catch(() => null),
          getNotificationPermissionState(),
        ]);
        if (cancelled || !day || !insight) return;

        const previousId = day.plan?.recommendation_notification_id || null;
        const signalsEnabled = activeProfile.privacy?.notification_preferences?.aida_signals === true;
        const sleepModuleEnabled = activeProfile.module_settings?.sleep !== false;
        const personalized = insight.status === "personalized" && !!insight.suggested_window;
        const clinicallyFlagged = !!insight.clinical_prompt;
        const canSchedule = signalsEnabled && sleepModuleEnabled && permission === "granted" && personalized && !clinicallyFlagged;

        if (!canSchedule) {
          if (previousId) {
            await cancelNotificationIds([previousId]);
            await saveRecommendationReminder(activeId, date, day.plan?.recommendation_window_end || "00:00", null).catch(() => undefined);
          }
          return;
        }

        const window = insight.suggested_window!;
        if (previousId && day.plan?.recommendation_window_end === window.end) return;
        if (previousId) await cancelNotificationIds([previousId]);

        const id = await schedulePersonalSleepWindowReminder({
          date,
          time: window.end,
          windowStart: window.start,
          windowEnd: window.end,
        });
        if (cancelled) {
          if (id) await cancelNotificationIds([id]);
          return;
        }
        await saveRecommendationReminder(activeId, date, window.end, id).catch(() => undefined);
      })();
    }, 900);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    activeId,
    activeProfile?.module_settings?.sleep,
    activeProfile?.privacy?.notification_preferences?.aida_signals,
    refreshTick,
  ]);
}
