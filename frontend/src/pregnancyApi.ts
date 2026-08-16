import { apiFetch } from "@/src/api";

async function req(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await apiFetch(path, { ...options, headers });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export type PregnancyStatus = "planning" | "pregnant" | "postpartum" | "completed";

export const pregnancyApi = {
  get: (profileId: string) => req(`/pregnancy/${encodeURIComponent(profileId)}`),
  save: (profileId: string, data: {
    profile_id: string;
    status: PregnancyStatus;
    lmp_date?: string | null;
    estimated_due_date?: string | null;
    confirmed_at?: string | null;
    outcome?: string | null;
    ended_at?: string | null;
    notes?: string | null;
  }) => req(`/pregnancy/${encodeURIComponent(profileId)}`, { method: "PUT", body: JSON.stringify(data) }),
  complete: (profileId: string) => req(`/pregnancy/${encodeURIComponent(profileId)}/complete`, { method: "POST" }),
};
