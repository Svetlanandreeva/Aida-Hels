import { NativeModules, Platform } from "react-native";
import { getApiToken } from "@/src/api";
import AidaHealthConnect, { type HealthConnectSleepSession } from "../modules/aida-health-connect";
import { stageWearableRhythmCandidate } from "@/src/circadianApi";
import { syncWearableProvider, updateWearableConnection } from "@/src/wearables";

const healthKit = NativeModules.AidaHealthKit as undefined | {
  connect: (profileId: string, bearerToken: string) => Promise<any>;
  sync: (profileId: string, bearerToken: string) => Promise<any>;
  disconnect: () => Promise<any>;
};

function authToken() {
  const token = getApiToken();
  if (!token) throw new Error("Authentication required");
  return token;
}

function localParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid Health Connect timestamp: ${iso}`);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    localDate: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    localTime: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

async function stageHealthConnectSleep(profileId: string, sessions: HealthConnectSleepSession[]) {
  let staged = 0;
  for (const session of sessions) {
    if (!session.external_id || !session.start_at || !session.end_at) continue;
    const bedtime = localParts(session.start_at);
    const wake = localParts(session.end_at);
    const metadata = {
      source_app: session.source_name || null,
      recording_method: session.recording_method || null,
      stage_count: session.stage_count ?? 0,
    };
    await stageWearableRhythmCandidate({
      profileId,
      provider: "android_health_connect",
      sourceRecordId: `${session.external_id}:bedtime`,
      kind: "bedtime",
      localDate: bedtime.localDate,
      localTime: bedtime.localTime,
      metadata,
    });
    await stageWearableRhythmCandidate({
      profileId,
      provider: "android_health_connect",
      sourceRecordId: `${session.external_id}:wake`,
      kind: "wake",
      localDate: wake.localDate,
      localTime: wake.localTime,
      metadata,
    });
    staged += 1;
  }
  return staged;
}

export function appleHealthBridgeAvailable() {
  return Platform.OS === "ios" && !!healthKit;
}

export function healthConnectBridgeAvailable() {
  return Platform.OS === "android" && !!AidaHealthConnect;
}

export async function connectAppleHealth(profileId: string) {
  if (!appleHealthBridgeAvailable() || !healthKit) throw new Error("Apple Health bridge is not available in this build");
  return healthKit.connect(profileId, authToken());
}

export async function syncAppleHealth(profileId: string) {
  if (!appleHealthBridgeAvailable() || !healthKit) throw new Error("Apple Health bridge is not available in this build");
  return healthKit.sync(profileId, authToken());
}

export async function connectHealthConnect(profileId: string) {
  if (!healthConnectBridgeAvailable() || !AidaHealthConnect) throw new Error("Health Connect bridge is not available in this build");
  try {
    const permission = await AidaHealthConnect.connect();
    if (!permission.granted) {
      await updateWearableConnection("android_health_connect", profileId, "permission_denied", {
        code: "HEALTH_CONNECT_PERMISSION_DENIED",
        message: `Granted ${permission.granted_count} of ${permission.required_count} Health Connect permissions`,
      });
      return { state: "permission_denied", permission };
    }
    await updateWearableConnection("android_health_connect", profileId, "connected_no_data");
    return syncHealthConnect(profileId);
  } catch (error: any) {
    await updateWearableConnection("android_health_connect", profileId, "sync_error", {
      code: "HEALTH_CONNECT_CONNECT_FAILED",
      message: error?.message || "Health Connect connection failed",
    }).catch(() => undefined);
    throw error;
  }
}

export async function syncHealthConnect(profileId: string) {
  if (!healthConnectBridgeAvailable() || !AidaHealthConnect) throw new Error("Health Connect bridge is not available in this build");
  try {
    const result = await AidaHealthConnect.sync(30);
    if (!result.granted) {
      await updateWearableConnection("android_health_connect", profileId, "permission_denied", {
        code: "HEALTH_CONNECT_PERMISSION_DENIED",
        message: "Health Connect permission is no longer granted",
      });
      return { state: "permission_denied", inserted: 0, skipped: 0, rejected: 0, sleep_sessions_staged: 0 };
    }
    const wearableSync = await syncWearableProvider("android_health_connect", profileId, result.samples || []);
    const sleepSessionsStaged = await stageHealthConnectSleep(profileId, result.sleep_sessions || []);
    return { ...wearableSync, sleep_sessions_staged: sleepSessionsStaged };
  } catch (error: any) {
    await updateWearableConnection("android_health_connect", profileId, "sync_error", {
      code: "HEALTH_CONNECT_SYNC_FAILED",
      message: error?.message || "Health Connect sync failed",
    }).catch(() => undefined);
    throw error;
  }
}
