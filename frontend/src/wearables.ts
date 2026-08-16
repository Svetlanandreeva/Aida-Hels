import { apiFetch } from "@/src/api";

export type WearableProvider = {
  id: string;
  name: string;
  devices: string[];
  mode: "native_system" | "cloud_oauth" | "cloud_partner" | string;
  platform: "ios" | "android" | "cloud" | string;
  ready: boolean;
  state?: "not_connected" | "connected_no_data" | "permission_denied" | "sync_error" | "data" | "stale" | string;
  connected?: boolean;
  last_sync_at?: string | null;
  error?: { code?: string | null; message?: string | null } | null;
  device?: { name?: string | null; model?: string | null; os_version?: string | null } | null;
};

async function jsonRequest(path: string, options?: RequestInit) {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json();
}

export async function listWearableProviders(): Promise<{ providers: WearableProvider[]; core_metrics: string[] }> {
  return jsonRequest("/health/wearables/providers");
}

export async function wearableStatus(profileId: string): Promise<{ providers: WearableProvider[] }> {
  return jsonRequest(`/health/wearables/status/${encodeURIComponent(profileId)}`);
}

export async function updateWearableConnection(
  provider: string,
  profileId: string,
  state: "connected_no_data" | "permission_denied" | "sync_error" | "data",
  error?: { code?: string; message?: string }
): Promise<{ ok: boolean; provider: string; state: string }> {
  return jsonRequest(`/health/wearables/${encodeURIComponent(provider)}/connection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile_id: profileId,
      state,
      error_code: error?.code || null,
      error_message: error?.message || null,
    }),
  });
}

export async function cloudWearableConfiguration(): Promise<Record<string, { configured: boolean; missing: string[]; redirect_uri?: string }>> {
  return jsonRequest("/health/wearables/cloud/configuration");
}

export async function startCloudWearableAuthorization(provider: string, profileId: string): Promise<{ authorization_url: string; provider: string }> {
  return jsonRequest(`/health/wearables/cloud/${encodeURIComponent(provider)}/authorize?profile_id=${encodeURIComponent(profileId)}`);
}

export async function disconnectCloudWearable(provider: string): Promise<{ ok: boolean }> {
  return jsonRequest(`/health/wearables/cloud/${encodeURIComponent(provider)}`, { method: "DELETE" });
}
