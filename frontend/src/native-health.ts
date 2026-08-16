import { NativeModules, Platform } from "react-native";
import { getApiToken } from "@/src/api";
import AidaHealthConnect from "../modules/aida-health-connect";
import { syncWearableProvider, updateWearableConnection } from "@/src/wearables";

export type AppleHealthMedication = {
  external_id: string;
  display_text: string;
  nickname?: string | null;
  is_archived: boolean;
  has_schedule: boolean;
  general_form?: string | null;
  rxnorm_code?: string | null;
  codings?: Array<{ system: string; code: string; version?: string | null }>;
};

const healthKit = NativeModules.AidaHealthKit as undefined | {
  connect: (profileId: string, bearerToken: string) => Promise<any>;
  sync: (profileId: string, bearerToken: string) => Promise<any>;
  disconnect: () => Promise<any>;
  requestMedicationAccess?: () => Promise<{ granted: boolean }>;
  listMedications?: () => Promise<AppleHealthMedication[]>;
};

function authToken() {
  const token = getApiToken();
  if (!token) throw new Error("Authentication required");
  return token;
}

export function appleHealthBridgeAvailable() {
  return Platform.OS === "ios" && !!healthKit;
}

export function appleMedicationBridgeAvailable() {
  return Platform.OS === "ios" && !!healthKit?.requestMedicationAccess && !!healthKit?.listMedications;
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

export async function requestAppleMedicationAccess() {
  if (!appleMedicationBridgeAvailable() || !healthKit?.requestMedicationAccess) {
    throw new Error("Apple Health medication import is not available in this build");
  }
  return healthKit.requestMedicationAccess();
}

export async function listAppleHealthMedications() {
  if (!appleMedicationBridgeAvailable() || !healthKit?.listMedications) {
    throw new Error("Apple Health medication import is not available in this build");
  }
  return healthKit.listMedications();
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
