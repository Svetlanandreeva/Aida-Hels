import { NativeModules, Platform } from "react-native";
import { getApiToken } from "@/src/api";

const healthKit = NativeModules.AidaHealthKit as undefined | {
  connect: (profileId: string, bearerToken: string) => Promise<any>;
  sync: (profileId: string, bearerToken: string) => Promise<any>;
  disconnect: () => Promise<any>;
};

const healthConnect = NativeModules.AidaHealthConnect as undefined | {
  connect: (profileId: string, bearerToken: string) => Promise<any>;
  sync: (profileId: string, bearerToken: string) => Promise<any>;
  disconnect?: () => Promise<any>;
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
  return Platform.OS === "android" && !!healthConnect;
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
  if (!healthConnectBridgeAvailable() || !healthConnect) throw new Error("Health Connect bridge is not available in this build");
  return healthConnect.connect(profileId, authToken());
}

export async function syncHealthConnect(profileId: string) {
  if (!healthConnectBridgeAvailable() || !healthConnect) throw new Error("Health Connect bridge is not available in this build");
  return healthConnect.sync(profileId, authToken());
}
