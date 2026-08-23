import { apiFetch } from "@/src/api";

export type NutritionNutrients = {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
  saturated_fat_g?: number;
  sodium_mg?: number;
  potassium_mg?: number;
};

export type NutritionEntry = {
  id: string;
  profile_id: string;
  label?: string | null;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "other" | string;
  eaten_at: string;
  local_date?: string | null;
  local_time?: string | null;
  timezone_offset_min?: number | null;
  source: "manual" | "usda" | "openfoodfacts" | "aggregate" | string;
  quantity?: number;
  serving_description?: string | null;
  reference_source?: string | null;
  reference_id?: string | null;
  nutrients?: NutritionNutrients;
  verification_status?: string | null;
  cross_check?: {
    status?: "matched" | "close" | "mismatch" | "insufficient" | "unavailable" | string;
    metrics_compared?: number;
    max_relative_difference?: number | null;
  } | null;
  compacted?: boolean;
  detail_count?: number;
  note?: string | null;
};

export type NutritionFoodCandidate = {
  reference_source: "usda" | "openfoodfacts" | string;
  reference_id: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  serving_description?: string | null;
  basis?: string | null;
  nutrients?: NutritionNutrients;
  license?: string | null;
};

export type NutritionInsight = {
  kind: string;
  level: "info" | "attention" | string;
  title: string;
  text: string;
};

export type FoodMedicationFlag = {
  severity: "info" | "check" | string;
  kind: string;
  food?: string | null;
  medication?: string | null;
  active_ingredient?: string | null;
  message: string;
  action?: string | null;
  evidence_url?: string | null;
};

export type NutritionSummary = {
  enabled: boolean;
  provider?: { usda_configured?: boolean; openfoodfacts_configured?: boolean };
  daily: Array<Record<string, any>>;
  insights: NutritionInsight[];
  food_medication_flags: FoodMedicationFlag[];
  detail_retention_hours?: number;
};

export type NutritionStatus = {
  enabled: boolean;
  usda_configured: boolean;
  openfoodfacts_configured: boolean;
  detail_retention_hours: number;
};

async function nutritionReq<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await apiFetch(path, { ...options, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export const nutritionApi = {
  status: (profileId: string): Promise<NutritionStatus> =>
    nutritionReq(`/nutrition/status?profile_id=${encodeURIComponent(profileId)}`),

  listEntries: (profileId: string, limit = 100): Promise<NutritionEntry[]> =>
    nutritionReq(`/nutrition/entries?profile_id=${encodeURIComponent(profileId)}&limit=${limit}`),

  searchFoods: (profileId: string, query: string): Promise<{
    providers: { usda_configured?: boolean; openfoodfacts_configured?: boolean };
    items: NutritionFoodCandidate[];
  }> => nutritionReq(`/nutrition/foods/search?profile_id=${encodeURIComponent(profileId)}&q=${encodeURIComponent(query)}`),

  createEntry: (data: Record<string, any>): Promise<NutritionEntry> =>
    nutritionReq("/nutrition/entries", { method: "POST", body: JSON.stringify(data) }),

  deleteEntry: (entryId: string): Promise<{ ok: boolean }> =>
    nutritionReq(`/nutrition/entries/${encodeURIComponent(entryId)}`, { method: "DELETE" }),

  summary: (profileId: string): Promise<NutritionSummary> =>
    nutritionReq(`/nutrition/summary?profile_id=${encodeURIComponent(profileId)}`),
};
