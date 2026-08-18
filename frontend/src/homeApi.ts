import { apiFetch } from "@/src/api";
import { withTimeout } from "@/src/async";
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

const HOME_CACHE_TTL_MS = 30_000;
const homeCache = new Map<string, { value: HomePayload; expiresAt: number }>();
const homeInflight = new Map<string, Promise<HomePayload>>();

function localTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function cacheKey(profileId: string, date: string, language: string) {
  return `${profileId}:${date}:${language}`;
}

export function hasFreshHome(profileId: string, date: string, language: string) {
  const cached = homeCache.get(cacheKey(profileId, date, language));
  return Boolean(cached && cached.expiresAt > Date.now());
}

export function invalidateHome(profileId?: string) {
  if (!profileId) {
    homeCache.clear();
    return;
  }
  for (const key of homeCache.keys()) {
    if (key.startsWith(`${profileId}:`)) homeCache.delete(key);
  }
}

export async function getHome(
  profileId: string,
  date: string,
  language: string,
  options: { force?: boolean } = {},
): Promise<HomePayload> {
  const key = cacheKey(profileId, date, language);
  const cached = homeCache.get(key);
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = homeInflight.get(key);
  if (!options.force && pending) return pending;

  const request = (async () => {
    const query = new URLSearchParams({
      date,
      now_local: localTime(),
      language,
    });
    const response = await withTimeout(
      apiFetch(`/home/${encodeURIComponent(profileId)}?${query.toString()}`),
      5500,
      "home",
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${response.status}: ${text}`);
    }
    const value = await withTimeout(response.json(), 1500, "home_json") as HomePayload;
    homeCache.set(key, { value, expiresAt: Date.now() + HOME_CACHE_TTL_MS });
    return value;
  })();

  homeInflight.set(key, request);
  try {
    return await request;
  } finally {
    if (homeInflight.get(key) === request) homeInflight.delete(key);
  }
}
