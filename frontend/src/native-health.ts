import { NativeModules, Platform } from "react-native";
import { getApiToken } from "@/src/api";

const healthKit = NativeModules.AidaHealthKit as undefined | {
  connect: (profileId: string, bearerToken: string) => Promise<any>;
  sync: (profileId: string, bearerToken: string) => Promise<any>;
  disconnect: () => Promise<any>;
};

export function appleHealthBridgeAvailable() {
  return Platform.OS === "ios" && !!healthKit;
}

export async function connectAppleHealth(profileId: string) {
  if (!appleHealthBridgeAvailable() || !healthKit) throw new Error("Apple Health bridge is not available in this build");
  const token = getApiToken();
  if (!token) throw new Error("Authentication required");
  return healthKit.connect(profileId, token);
}

export async function syncAppleHealth(profileId: string) {
  if (!appleHealthBridgeAvailable() || !healthKit) throw new Error("Apple Health bridge is not available in this build");
  const token = getApiToken();
  if (!token) throw new Error("Authentication required");
  return healthKit.sync(profileId, token);
}
