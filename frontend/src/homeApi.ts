import { apiFetch } from "@/src/api";
import type { LabTest, Medication, Symptom, Task } from "@/src/api";
import type { MedicationSlot } from "@/src/medicationScheduleApi";

export type DataState = "data" | "no_data" | "insufficient_data" | "error" | "stale" | "syncing" | "not_connected" | "permission_denied" | "not_applicable";

type ListSection<T> = {
  state: DataState;
  items: T[];
  error?: string;
};

export type HomePayload = {
  profile_id: string;
  generated_at: string;
  readiness: {
    state: DataState;
    value: number | null;
    scores?: Record<string, number>;
    error?: string;
  };
  gamification: {
    state: DataState;
    value?: any;
    error?: string;
  };
  medications: ListSection<Medication>;
  symptoms: ListSection<Symptom>;
  labs: ListSection<LabTest>;
  lab_status: {
    state: DataState;
    in_range?: number | null;
    out_of_range?: number | null;
    error?: string;
  };
  puzzle: {
    state: DataState;
    value?: { profile_id: string; widgets: any[] };
    error?: string;
  };
  overview: {
    state: DataState;
    attention?: any[];
    ai_summary?: string | null;
    error?: string;
  };
  tasks: ListSection<Task>;
  medication_day: {
    state: DataState;
    date?: string;
    wake_time?: string | null;
    slots?: MedicationSlot[];
    error?: string;
  };
  cycle: {
    state: DataState;
    cycle_day?: number | null;
    last_period_start?: string | null;
    error?: string;
  };
};

function localTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export async function getHome(profileId: string, date: string, language: string): Promise<HomePayload> {
  const query = new URLSearchParams({
    date,
    now_local: localTime(),
    language,
  });
  const response = await apiFetch(`/home/${encodeURIComponent(profileId)}?${query.toString()}`);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json();
}
