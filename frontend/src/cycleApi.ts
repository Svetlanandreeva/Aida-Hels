import { apiFetch } from "@/src/api";

async function req(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await apiFetch(path, { ...options, headers });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export const cycleApi = {
  get: (profileId: string) => req(`/cycle/${encodeURIComponent(profileId)}`),
  forecast: (profileId: string) => req(`/cycle/${encodeURIComponent(profileId)}/forecast`),
  addEvent: (data: { profile_id: string; event_type: "period_start" | "period_end" | "symptom" | "ovulation_test" | "note"; observed_at: string; value?: string | null; note?: string | null }) =>
    req("/cycle/events", { method: "POST", body: JSON.stringify(data) }),
  deleteEvent: (eventId: string) => req(`/cycle/events/${encodeURIComponent(eventId)}`, { method: "DELETE" }),
  saveSettings: (data: { profile_id: string; typical_cycle_length?: number | null; typical_period_length?: number | null; reminders_enabled?: boolean }) =>
    req("/cycle/settings", { method: "PUT", body: JSON.stringify(data) }),
};
