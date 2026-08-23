import { apiFetch } from "@/src/api";
import { withTimeout } from "@/src/async";

export type MedicationReferenceItem = {
  reference_source: "rls_aurora" | string;
  reference_id: string | null;
  trade_name: string | null;
  active_ingredient: string | null;
  active_substance_id: number | null;
  dosage_form: string | null;
  strength: string | null;
  registration: string | null;
  manufacturer: string | null;
  description: string | null;
  updated_at_source: string | null;
};

export type MedicationReferenceSearchResult = {
  items: MedicationReferenceItem[];
  provider: string;
  provider_ready: boolean;
  provider_available: boolean;
  minimum_query_length: number;
};

const EMPTY_RESULT: MedicationReferenceSearchResult = {
  items: [],
  provider: "rls_aurora",
  provider_ready: false,
  provider_available: false,
  minimum_query_length: 3,
};

export async function searchMedicationReferences(query: string, limit = 12): Promise<MedicationReferenceSearchResult> {
  const q = query.trim();
  if (q.length < 3) return { ...EMPTY_RESULT };
  const safeLimit = Math.max(1, Math.min(limit, 20));
  const response = await withTimeout(
    apiFetch(`/reference/medications/search?q=${encodeURIComponent(q)}&limit=${safeLimit}`),
    6000,
    "medication_reference_search",
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${response.status}: ${detail}`);
  }
  const payload = await response.json();
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    provider: String(payload?.provider || "rls_aurora"),
    provider_ready: payload?.provider_ready === true,
    provider_available: payload?.provider_available === true,
    minimum_query_length: Number(payload?.minimum_query_length || 3),
  };
}
