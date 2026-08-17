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

export type WearableCircadianCandidate = {
  id: string;
  profile_id: string;
  entity_type: "circadian_event";
  status: "pending" | "approved" | "rejected";
  proposed_by: "import";
  payload: {
    kind: "wake" | "bedtime";
    local_date: string;
    local_time: string;
    provider: string;
    source_record_id: string;
    confidence?: number | null;
    metadata?: Record<string, unknown>;
  };
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

export function stageWearableRhythmCandidate(input: {
  profileId: string;
  provider: string;
  sourceRecordId: string;
  kind: "wake" | "bedtime";
  localDate: string;
  localTime: string;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<WearableCircadianCandidate> {
  return req("/circadian/wearable-candidates", {
    method: "POST",
    body: JSON.stringify({
      profile_id: input.profileId,
      provider: input.provider,
      source_record_id: input.sourceRecordId,
      kind: input.kind,
      local_date: input.localDate,
      local_time: input.localTime,
      confidence: input.confidence ?? null,
      metadata: input.metadata || {},
    }),
  });
}

export function listPendingCircadianCandidates(profileId: string): Promise<WearableCircadianCandidate[]> {
  return req(`/candidates?profile_id=${encodeURIComponent(profileId)}&status=pending`).then((items: WearableCircadianCandidate[]) =>
    items.filter((item) => item.entity_type === "circadian_event")
  );
}

export function correctCircadianCandidate(
  candidateId: string,
  correction: { kind: "wake" | "bedtime"; localDate: string; localTime: string }
): Promise<WearableCircadianCandidate> {
  return req(`/candidates/${encodeURIComponent(candidateId)}/circadian`, {
    method: "PATCH",
    body: JSON.stringify({
      kind: correction.kind,
      local_date: correction.localDate,
      local_time: correction.localTime,
    }),
  });
}

export function approveCircadianCandidate(candidateId: string) {
  return req(`/candidates/${encodeURIComponent(candidateId)}/approve`, { method: "POST", body: JSON.stringify({}) });
}

export function rejectCircadianCandidate(candidateId: string) {
  return req(`/candidates/${encodeURIComponent(candidateId)}/reject`, { method: "POST", body: JSON.stringify({}) });
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
