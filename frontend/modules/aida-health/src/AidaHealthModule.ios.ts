import { requireNativeModule } from "expo-modules-core";
import type { AidaHealthNativeModule } from "./AidaHealth.types";

export default requireNativeModule<AidaHealthNativeModule>("AidaHealth");
