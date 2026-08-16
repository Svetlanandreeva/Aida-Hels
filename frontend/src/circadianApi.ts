import { apiFetch } from "@/src/api";

export type CircadianEvent = {
  id: string;
  profile_id: string;
  kind: "wake" | "bedtime";
  local_date: string;
  local_time: string;
  source: "manual" | "wearable" | "import" | string;
  recorded_at?: string;
};

export type CircadianDay = {
  profile_id: string;
  date: string;
  wake?: CircadianEvent | null;
  bedtime?: CircadianEvent | null;
  plan?: {
    planned_time?: string | null;
    notification_id?: string | null;
    recommendation_window_end?: string | null;
    recommendation_notification_id?: string | null;
  } | null;
};

export type SleepInsight = {
  status: "learning" | "personalized" | "stable_no_preference" | string;
  days_observed: number;
  paired_nights: number;
  outcome_linked_nights: number;
  minimum_days: number;
  confidence: "low" | "medium" | "high" | string;
  suggested_window?: { start: string; end: string; samples: number } | null;
  message_ru: string;
  message_en: string;
  clinical_prompt?: { level: string; message_ru: string; message_en: string } | null;
};

async function req(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await apiFetch(path, { ...options, headers });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export function getCircadianDay(profileId: string, date: string): Promise<CircadianDay> {
  return req(`/circadian/day?profile_id=${encodeURIComponent(profileId)}&date=${encodeURIComponent(date)}`);
}

export function getSleepInsight(profileId: string): Promise<SleepInsight> {
  return req(`/circadian/insight?profile_id=${encodeURIComponent(profileId)}`);
}

export function recordRhythmEvent(profileId: string, kind: "wake" | "bedtime", date: string, time: string) {
  return req("/circadian/events", { method: "POST", body: JSON.stringify({ profile_id: profileId, kind, local_date: date, local_time: time, source: "manual" }) });
}

export function saveBedtimePlan(profileId: string, date: string, plannedTime: string, notificationId?: string | null) {
  return req("/circadian/bedtime-plan", { method: "POST", body: JSON.stringify({ profile_id: profileId, local_date: date, planned_time: plannedTime, notification_id: notificationId || null }) });
}

export function saveRecommendationReminder(profileId: string, date: string, windowEnd: string, notificationId?: string | null) {
  return req("/circadian/recommendation-reminder", {
    method: "POST",
    body: JSON.stringify({ profile_id: profileId, local_date: date, window_end: windowEnd, notification_id: notificationId || null }),
  });
}
