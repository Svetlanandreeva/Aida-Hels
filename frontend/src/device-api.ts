import { apiFetch } from "@/src/api";
import type { AidaHealthSample } from "@/modules/aida-health";

export type AppleHealthStatus = {
  connected: boolean;
  last_sync_at: string | null;
  device: {
    name?: string | null;
    model?: string | null;
    os_version?: string | null;
  } | null;
};

export type AppleHealthSyncResult = {
  ok: boolean;
  inserted: number;
  skipped: number;
  last_sync_at: string;
};

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text || "Device API request failed"}`);
  }
  return res.json() as Promise<T>;
}

export const deviceApi = {
  appleHealthStatus: async (profileId: string): Promise<AppleHealthStatus> =>
    readJson(await apiFetch(`/health/apple/status/${encodeURIComponent(profileId)}`)),

  syncAppleHealth: async (
    profileId: string,
    samples: AidaHealthSample[]
  ): Promise<AppleHealthSyncResult> =>
    readJson(
      await apiFetch("/health/apple/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          samples,
        }),
      })
    ),
};
