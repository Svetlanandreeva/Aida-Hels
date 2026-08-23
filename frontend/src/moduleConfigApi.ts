import { apiFetch } from "@/src/api";

export type ModuleConfig = {
  module_code: string;
  enabled: boolean;
  show_on_home: boolean;
  allow_ai_analytics: boolean;
  notifications_enabled: boolean;
  order: number;
  source: "goals" | "preset" | "user" | "migration" | string;
  updated_at?: string | null;
};

export type ModuleConfigResponse = {
  profile_id: string;
  modules: ModuleConfig[];
  module_settings: Record<string, boolean>;
  schema_version: "module-config-v2" | string;
};

export type ModuleConfigPatch = {
  module_code: string;
  enabled?: boolean;
  show_on_home?: boolean;
  allow_ai_analytics?: boolean;
  notifications_enabled?: boolean;
  order?: number;
};

async function jsonRequest(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");
  const response = await apiFetch(path, { ...init, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json();
}

export async function getModuleConfig(profileId: string): Promise<ModuleConfigResponse> {
  return jsonRequest(`/profiles/${encodeURIComponent(profileId)}/modules`);
}

export async function patchModuleConfig(
  profileId: string,
  modules: ModuleConfigPatch[],
): Promise<ModuleConfigResponse> {
  return jsonRequest(`/profiles/${encodeURIComponent(profileId)}/modules`, {
    method: "PATCH",
    body: JSON.stringify({ modules }),
  });
}

export function findModule(config: ModuleConfigResponse | null | undefined, code: string) {
  return config?.modules.find((module) => module.module_code === code) || null;
}
