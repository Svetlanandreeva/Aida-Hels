import { requireOptionalNativeModule } from "expo";

export type HealthConnectSample = {
  external_id: string;
  metric: string;
  value: number;
  unit: string;
  start_at: string;
  end_at: string;
  source_name?: string | null;
  recording_method?: string | null;
};

export type HealthConnectSleepSession = {
  external_id: string;
  start_at: string;
  end_at: string;
  source_name?: string | null;
  recording_method?: string | null;
  stage_count: number;
};

type HealthConnectNativeModule = {
  connect(): Promise<{ granted: boolean; granted_count: number; required_count: number }>;
  sync(days?: number): Promise<{ samples: HealthConnectSample[]; sleep_sessions: HealthConnectSleepSession[]; granted: boolean }>;
  status(): Promise<{ available: boolean; granted: boolean; granted_count: number; required_count: number }>;
};

export default requireOptionalNativeModule<HealthConnectNativeModule>("AidaHealthConnect");
