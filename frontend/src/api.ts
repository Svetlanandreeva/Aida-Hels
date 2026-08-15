const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api";

let API_TOKEN = "";

export function setApiToken(token?: string | null) {
  API_TOKEN = token || "";
}

export function getApiToken() {
  return API_TOKEN;
}

export async function apiFetch(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers || {});
  if (API_TOKEN) headers.set("Authorization", `Bearer ${API_TOKEN}`);
  return fetch(path.startsWith("http") ? path : BASE + path, { ...options, headers });
}

export type Surgery = {
  id: string;
  title: string;
  date?: string | null;
  note?: string | null;
};

export type Profile = {
  id: string;
  name: string;
  kind: "me" | "child" | "relative";
  dob?: string | null;
  sex?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  blood_type?: string | null;
  allergies: string[];
  chronic_conditions: string[];
  diagnoses?: string[];
  surgeries?: Surgery[];
  privacy?: {
    include_in_ai_context?: boolean;
    share_documents?: boolean;
    [key: string]: any;
  };
  module_settings?: Record<string, boolean>;
  avatar_url?: string | null;
};

export type Biomarker = {
  name: string;
  value: string;
  unit?: string | null;
  reference?: string | null;
  status?: string | null;
};

export type LabTest = {
  id: string;
  profile_id: string;
  title: string;
  date: string;
  lab_name?: string | null;
  biomarkers: Biomarker[];
  ai_summary?: string | null;
  source?: string | null;
};

export type Symptom = {
  id: string;
  profile_id: string;
  name: string;
  severity: number;
  note?: string | null;
  date: string;
};

export type Medication = {
  id: string;
  profile_id: string;
  name: string;
  dose?: string | null;
  schedule?: string | null;
  times?: string[];
  meal_relation?: "any" | "before" | "with" | "after" | string;
  active: boolean;
  start_date?: string | null;
  notes?: string | null;
};

export type ChatMsg = {
  id: string;
  profile_id: string;
  role: "user" | "assistant";
  text: string;
  created_at?: string;
};

export type Vital = {
  id: string;
  profile_id: string;
  kind: string;
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  value?: number | null;
  unit?: string | null;
  note?: string | null;
  date: string;
};

export type Checkin = {
  id: string;
  profile_id: string;
  mood: number;
  energy: number;
  stress: number;
  anxiety: number;
  sleep: number;
  triggers?: string | null;
  note?: string | null;
  date: string;
};

export type Task = {
  id: string;
  profile_id: string;
  title: string;
  kind: string;
  due?: string | null;
  reminder_at?: string | null;
  notification_id?: string | null;
  action_route?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  notes?: string | null;
  status?: "pending" | "done" | "cancelled" | string;
  done: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MedicalDocument = {
  id: string;
  profile_id: string;
  name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  drive_file_id?: string | null;
  drive_url?: string | null;
  purpose: string;
  document_type?: string | null;
  note?: string | null;
  status?: string | null;
  verification_status?: string | null;
  created_at?: string | null;
};

async function req(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await apiFetch(path, { ...options, headers });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${txt}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Aida API returned an invalid response");
  }

  return res.json();
}

function minutesUntilNextDose(medication: Medication, now = new Date()) {
  const times = (medication.times || []).filter((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time));
  if (!times.length) return Number.POSITIVE_INFINITY;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return Math.min(...times.map((time) => {
    const [hours, minutes] = time.split(":").map(Number);
    const scheduled = hours * 60 + minutes;
    const diff = scheduled - nowMinutes;
    return diff >= 0 ? diff : diff + 24 * 60;
  }));
}

function sortMedicationsForNow(items: Medication[]) {
  return [...items].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const aTime = minutesUntilNextDose(a);
    const bTime = minutesUntilNextDose(b);
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
    if (Number.isFinite(aTime) && !Number.isFinite(bTime)) return -1;
    if (!Number.isFinite(aTime) && Number.isFinite(bTime)) return 1;
    return a.name.localeCompare(b.name);
  });
}

export const api = {
  listProfiles: (): Promise<Profile[]> => req("/profiles"),
  createProfile: (data: Partial<Profile>): Promise<Profile> =>
    req("/profiles", { method: "POST", body: JSON.stringify(data) }),
  updateProfile: (id: string, data: Partial<Profile>): Promise<Profile> =>
    req(`/profiles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProfile: (id: string) => req(`/profiles/${id}`, { method: "DELETE" }),

  listLabs: (pid: string): Promise<LabTest[]> => req(`/labs?profile_id=${pid}`),
  createLab: (data: any): Promise<LabTest> =>
    req("/labs", { method: "POST", body: JSON.stringify(data) }),
  deleteLab: (id: string) => req(`/labs/${id}`, { method: "DELETE" }),

  listSymptoms: (pid: string): Promise<Symptom[]> => req(`/symptoms?profile_id=${pid}`),
  createSymptom: (data: any): Promise<Symptom> =>
    req("/symptoms", { method: "POST", body: JSON.stringify(data) }),
  deleteSymptom: (id: string) => req(`/symptoms/${id}`, { method: "DELETE" }),

  listMeds: async (pid: string): Promise<Medication[]> =>
    sortMedicationsForNow(await req(`/medications?profile_id=${pid}`)),
  createMed: (data: any): Promise<Medication> =>
    req("/medications", { method: "POST", body: JSON.stringify(data) }),
  deleteMed: (id: string) => req(`/medications/${id}`, { method: "DELETE" }),

  listChat: (pid: string): Promise<ChatMsg[]> => req(`/chat?profile_id=${pid}`),
  sendChat: (pid: string, text: string, lang: string) =>
    req(`/chat?language=${lang}`, { method: "POST", body: JSON.stringify({ profile_id: pid, text }) }),
  clearChat: (pid: string) => req(`/chat?profile_id=${pid}`, { method: "DELETE" }),

  readiness: (pid: string): Promise<{ scores: Record<string, number>; overall: number }> =>
    req(`/analytics/readiness/${pid}`),
  gamification: (pid: string): Promise<any> => req(`/gamification/${pid}`),
  getPuzzle: (pid: string): Promise<any> => req(`/puzzle/${pid}`),
  savePuzzle: (pid: string, widgets: any[]) =>
    req(`/puzzle/${pid}`, { method: "POST", body: JSON.stringify({ profile_id: pid, widgets }) }),
  report: (pid: string, days: number, lang: string): Promise<any> =>
    req(`/report/${pid}?days=${days}&language=${lang}`),

  listVitals: (pid: string, kind?: string): Promise<Vital[]> =>
    req(`/vitals?profile_id=${pid}${kind ? `&kind=${kind}` : ""}`),
  createVital: (data: any): Promise<Vital> =>
    req("/vitals", { method: "POST", body: JSON.stringify(data) }),
  deleteVital: (id: string) => req(`/vitals/${id}`, { method: "DELETE" }),

  listCheckins: (pid: string): Promise<Checkin[]> => req(`/checkins?profile_id=${pid}`),
  createCheckin: (data: any): Promise<Checkin> =>
    req("/checkins", { method: "POST", body: JSON.stringify(data) }),

  listTasks: (pid: string): Promise<Task[]> => req(`/tasks?profile_id=${pid}`),
  createTask: (data: any): Promise<Task> =>
    req("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>): Promise<Task> =>
    req(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggleTask: (id: string): Promise<Task> => req(`/tasks/${id}/toggle`, { method: "PUT" }),
  deleteTask: (id: string) => req(`/tasks/${id}`, { method: "DELETE" }),

  overview: (pid: string, lang: string): Promise<{ attention: any[]; ai_summary: string | null }> =>
    req(`/overview/${pid}?language=${lang}`),

  listDocuments: (pid: string): Promise<MedicalDocument[]> =>
    req(`/documents?profile_id=${encodeURIComponent(pid)}`),

  uploadDocument: async (
    pid: string,
    documentType: string,
    note: string,
    file: { uri: string; name: string; type: string }
  ): Promise<MedicalDocument> => {
    const form = new FormData();
    form.append("profile_id", pid);
    form.append("document_type", documentType);
    if (note.trim()) form.append("note", note.trim());
    // @ts-ignore RN FormData file
    form.append("file", { uri: file.uri, name: file.name, type: file.type });
    const res = await apiFetch("/documents/upload", { method: "POST", body: form as any });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${txt}`);
    }
    return res.json();
  },

  uploadLab: async (pid: string, lang: string, file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append("profile_id", pid);
    form.append("language", lang);
    // @ts-ignore RN FormData file
    form.append("file", { uri: file.uri, name: file.name, type: file.type });
    const res = await apiFetch("/labs/upload", { method: "POST", body: form as any });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${txt}`);
    }
    return res.json();
  },
};

export { BASE };
