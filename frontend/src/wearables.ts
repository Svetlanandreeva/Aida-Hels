import { apiFetch } from "@/src/api";

export type WearableProvider = {
  id: string;
  name: string;
  devices: string[];
  mode: "native_system" | "cloud_oauth" | "cloud_partner" | string;
  platform: "ios" | "android" | "cloud" | string;
  ready: boolean;
  connected?: boolean;
  last_sync_at?: string | null;
  device?: { name?: string | null; model?: string | null; os_version?: string | null } | null;
};

async function jsonRequest(path: string) {
  const response = await apiFetch(path);
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
