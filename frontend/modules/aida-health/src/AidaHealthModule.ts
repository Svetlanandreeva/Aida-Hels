import type { AidaHealthNativeModule } from "./AidaHealth.types";

const unavailable: AidaHealthNativeModule = {
  isAvailable: () => false,
  requestAuthorization: async () => false,
  readRecentSamples: async () => [],
};

export default unavailable;
