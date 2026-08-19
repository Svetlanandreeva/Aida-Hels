import React from "react";

import { useMedicationReminderSync } from "@/src/hooks/use-medication-reminder-sync";
import { useSleepRecommendationSync } from "@/src/hooks/use-sleep-recommendation-sync";

export function AuthenticatedSyncRuntime() {
  useMedicationReminderSync();
  useSleepRecommendationSync();
  return null;
}
