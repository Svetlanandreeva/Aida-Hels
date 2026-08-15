import { Platform } from "react-native";
import { apiFetch } from "@/src/api";
import { AidaHealthKit } from "@/modules/aida-healthkit/src";

export type WearableProvider =
  | "apple_health"
  | "health_connect"
  | "garmin"
  | "oura"
  | "google_health"
  | "samsung_health";

export type WearableProviderStatus = {
  connected: boolean;
  last_sync_at?: string | null;
  device?: { name?: string | null; model?: string | null; os_version?: string | null } | null;
};

export type WearableStatusMap = Record<WearableProvider, WearableProviderStatus>;

const json = async (res: Response) => {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
};

export async function getWearableStatus(profileId: string): Promise<WearableStatusMap> {
  return json(await apiFetch(`/health/wearables/status/${encodeURIComponent(profileId)}`));
}

export async function syncAppleHealth(profileId: string, lookbackDays = 30) {
  if (Platform.OS !== "ios") throw new Error("Apple Health is available only on iPhone/iOS builds");
  if (!(await AidaHealthKit.isAvailable())) throw new Error("HealthKit is unavailable on this device");

  await AidaHealthKit.requestAuthorization();
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const nativeSamples = await AidaHealthKit.readRecentSamples(since);
  const samples = nativeSamples.map((sample) => ({
    external_id: sample.external_id,
    metric: sample.metric,
    value: sample.value,
    unit: sample.unit,
    start_at: new Date(sample.start_at_ms).toISOString(),
    end_at: new Date(sample.end_at_ms).toISOString(),
    source_name: sample.source_name,
    device_name: sample.device_name,
  }));

  return json(
    await apiFetch("/health/wearables/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profileId,
        provider: "apple_health",
        device_name: "Apple Health",
        os_version: Platform.Version ? String(Platform.Version) : undefined,
        samples,
      }),
    })
  );
}

export const providerAvailability = (provider: WearableProvider) => {
  if (provider === "apple_health") {
    return { actionable: Platform.OS === "ios", reason: Platform.OS === "ios" ? null : "Open Aida on iPhone" };
  }
  if (provider === "health_connect") {
    return { actionable: false, reason: Platform.OS === "android" ? "Android connector is next" : "Open Aida on Android" };
  }
  if (provider === "garmin") return { actionable: false, reason: "Garmin partner access required" };
  if (provider === "oura") return { actionable: false, reason: "Oura OAuth app credentials required" };
  if (provider === "google_health") return { actionable: false, reason: "Google Health OAuth credentials required" };
  return { actionable: false, reason: "Samsung partner registration required" };
};
