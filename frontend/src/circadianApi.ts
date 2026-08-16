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
  plan?: { planned_time?: string | null } | null;
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

export function recordRhythmEvent(profileId: string, kind: "wake" | "bedtime", date: string, time: string) {
  return req("/circadian/events", {
    method: "POST",
    body: JSON.stringify({ profile_id: profileId, kind, local_date: date, local_time: time, source: "manual" }),
  });
}

export function saveBedtimePlan(profileId: string, date: string, plannedTime: string) {
  return req("/circadian/bedtime-plan", {
    method: "POST",
    body: JSON.stringify({ profile_id: profileId, local_date: date, planned_time: plannedTime }),
  });
}
