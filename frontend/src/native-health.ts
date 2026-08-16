import { NativeModules, Platform } from "react-native";
import { getApiToken } from "@/src/api";
import AidaHealthConnect from "../modules/aida-health-connect";
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
      return { state: "permission_denied", inserted: 0, skipped: 0, rejected: 0 };
    }
    return await syncWearableProvider("android_health_connect", profileId, result.samples || []);
  } catch (error: any) {
    await updateWearableConnection("android_health_connect", profileId, "sync_error", {
      code: "HEALTH_CONNECT_SYNC_FAILED",
      message: error?.message || "Health Connect sync failed",
    }).catch(() => undefined);
    throw error;
  }
}
