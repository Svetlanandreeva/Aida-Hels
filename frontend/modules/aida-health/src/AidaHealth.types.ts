export type AidaHealthSample = {
  external_id: string;
  metric: string;
  value: number;
  unit: string;
  start_at: string;
  end_at?: string;
  source_name?: string;
  device_name?: string;
  metadata?: Record<string, unknown>;
};

export type AidaHealthNativeModule = {
  isAvailable(): boolean;
  requestAuthorization(): Promise<boolean>;
  readRecentSamples(days: number): Promise<AidaHealthSample[]>;
};
