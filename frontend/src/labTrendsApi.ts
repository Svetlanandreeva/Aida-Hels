import { BASE } from "@/src/api";

export type LabTrendPoint = {
  lab_id?: string | null;
  lab_title?: string | null;
  date: string;
  value: number;
  raw_value?: string | number | null;
  unit?: string | null;
  reference?: string | null;
  status?: "normal" | "high" | "low" | "unknown" | string;
  verification_status?: string | null;
};

export type LabTrendSeries = {
  key: string;
  name: string;
  unit?: string | null;
  points: LabTrendPoint[];
  count: number;
  latest: LabTrendPoint;
  delta: number;
  percent_change?: number | null;
};

export type LabTrendsResponse = {
  profile_id: string;
  series: LabTrendSeries[];
  series_count: number;
  lab_count: number;
};

export async function getLabTrends(profileId: string): Promise<LabTrendsResponse> {
  const res = await fetch(`${BASE}/labs/trends?profile_id=${encodeURIComponent(profileId)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}
