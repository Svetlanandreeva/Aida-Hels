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
  label: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "other" | string;
  eaten_at: string;
  source: "manual" | "fatsecret" | string;
  quantity?: number;
  external_food_id?: string | null;
  external_serving_id?: string | null;
  provider_name?: string | null;
  provider_brand?: string | null;
  serving_description?: string | null;
  nutrients?: NutritionNutrients;
  note?: string | null;
};

export type FatSecretFood = {
  food_id: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  provider: "fatsecret";
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
  provider?: { fatsecret_configured?: boolean };
  daily: Array<Record<string, any>>;
  insights: NutritionInsight[];
  food_medication_flags: FoodMedicationFlag[];
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
  status: (profileId: string): Promise<{ enabled: boolean; fatsecret_configured: boolean; fatsecret_mode: string }> =>
    nutritionReq(`/nutrition/status?profile_id=${encodeURIComponent(profileId)}`),

  listEntries: (profileId: string, limit = 100): Promise<NutritionEntry[]> =>
    nutritionReq(`/nutrition/entries?profile_id=${encodeURIComponent(profileId)}&limit=${limit}`),

  searchFoods: (profileId: string, query: string): Promise<{ configured: boolean; items: FatSecretFood[] }> =>
    nutritionReq(`/nutrition/foods/search?profile_id=${encodeURIComponent(profileId)}&q=${encodeURIComponent(query)}`),

  createEntry: (data: Record<string, any>): Promise<NutritionEntry> =>
    nutritionReq("/nutrition/entries", { method: "POST", body: JSON.stringify(data) }),

  deleteEntry: (entryId: string): Promise<{ ok: boolean }> =>
    nutritionReq(`/nutrition/entries/${encodeURIComponent(entryId)}`, { method: "DELETE" }),

  summary: (profileId: string): Promise<NutritionSummary> =>
    nutritionReq(`/nutrition/summary?profile_id=${encodeURIComponent(profileId)}`),
};
