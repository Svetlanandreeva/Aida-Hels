import { apiFetch } from "@/src/api";

export type BodyEvidence = {
  id?: string;
  kind: string;
  title: string;
  value?: string | number | null;
  unit?: string | null;
  observed_at?: string | null;
  source?: string | null;
  verification_status?: string | null;
};

export type BodySystemInsight = {
  id: string;
  label_ru: string;
  label_en: string;
  state: "data" | "no_data" | string;
  evidence_count: number;
  latest_observed_at?: string | null;
  interpretation: "observations_available" | "insufficient_data" | string;
  evidence: BodyEvidence[];
};

async function req(path: string) {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export function getBodySystems(profileId: string): Promise<{ profile_id: string; systems: BodySystemInsight[] }> {
  return req(`/insights/body-systems/${encodeURIComponent(profileId)}`);
}

export function getBodySystem(profileId: string, systemId: string): Promise<BodySystemInsight> {
  return req(`/insights/body-systems/${encodeURIComponent(profileId)}/${encodeURIComponent(systemId)}`);
}
