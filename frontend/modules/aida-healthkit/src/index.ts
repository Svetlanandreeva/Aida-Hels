import { requireOptionalNativeModule } from "expo-modules-core";

export type NativeHealthSample = {
  external_id: string;
  metric: string;
  value: number;
  unit: string;
  start_at_ms: number;
  end_at_ms: number;
  source_name?: string | null;
  device_name?: string | null;
};

type AidaHealthKitNative = {
  isAvailable(): Promise<boolean>;
  requestAuthorization(): Promise<boolean>;
  readRecentSamples(sinceMs: number): Promise<NativeHealthSample[]>;
};

const native = requireOptionalNativeModule<AidaHealthKitNative>("AidaHealthKit");

export const AidaHealthKit = {
  isLinked: Boolean(native),
  async isAvailable() {
    return native ? native.isAvailable() : false;
  },
  async requestAuthorization() {
    if (!native) throw new Error("HealthKit native module is not available in this build");
    return native.requestAuthorization();
  },
  async readRecentSamples(since: Date) {
    if (!native) throw new Error("HealthKit native module is not available in this build");
    return native.readRecentSamples(since.getTime());
  },
};
