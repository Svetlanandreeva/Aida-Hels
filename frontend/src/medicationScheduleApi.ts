import { BASE } from "@/src/api";

export type MedicationSlot = {
  id: string;
  medication_id: string;
  name: string;
  dose?: string | null;
  time: string;
  scheduled_at: string;
  meal_relation?: "any" | "before" | "with" | "after" | string;
  status: "pending" | "taken" | "skipped" | string;
  occurred_at?: string | null;
};

export type MedicationEvent = {
  id: string;
  profile_id: string;
  medication_id: string;
  medication_name?: string | null;
  scheduled_at: string;
  occurred_at?: string | null;
  status: "taken" | "skipped" | string;
};

async function jsonReq(path: string, options?: RequestInit) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export async function getMedicationDay(profileId: string, date: string): Promise<{ slots: MedicationSlot[] }> {
  return jsonReq(`/medications/schedule/day?profile_id=${encodeURIComponent(profileId)}&date=${encodeURIComponent(date)}`);
}

export async function updateMedicationSchedule(
  medicationId: string,
  data: { name?: string; dose?: string | null; times?: string[]; meal_relation?: string; active?: boolean; schedule?: string | null }
) {
  return jsonReq(`/medications/${encodeURIComponent(medicationId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function markMedicationIntake(medicationId: string, scheduledAt: string, status: "taken" | "skipped"): Promise<MedicationEvent> {
  return jsonReq(`/medications/${encodeURIComponent(medicationId)}/events`, {
    method: "POST",
    body: JSON.stringify({ scheduled_at: scheduledAt, status }),
  });
}

export async function getMedicationEvents(profileId: string, date?: string): Promise<MedicationEvent[]> {
  const q = new URLSearchParams({ profile_id: profileId });
  if (date) q.set("date", date);
  return jsonReq(`/medications/events/list?${q.toString()}`);
}
