import { integrationsService } from './integrationsService';

export class WearablesService {
  /**
   * Process wearable payload through the 7-stage adapter pipeline:
   * Provider -> Adapter -> Raw/Staging -> Validation -> Normalization -> Dedup -> Canonical entity
   */
  public async processWearableData(userId: string, payload: any) {
    if (!userId) {
      throw new Error('UserId requirement missing for wearable ingestion');
    }

    const providerId = payload.source || 'apple_health';
    const rawSamples: any[] = [];

    if (payload.metrics) {
      const ts = payload.timestamp || new Date().toISOString();
      if (payload.metrics.heartRateBpm !== undefined) {
        rawSamples.push({ type: 'heart_rate', value: payload.metrics.heartRateBpm, unit: 'bpm', timestamp: ts });
      }
      if (payload.metrics.systolicBp !== undefined && payload.metrics.diastolicBp !== undefined) {
        rawSamples.push({
          type: 'blood_pressure',
          systolic: payload.metrics.systolicBp,
          diastolic: payload.metrics.diastolicBp,
          value: payload.metrics.systolicBp,
          unit: 'mmHg',
          timestamp: ts,
        });
      }
      if (payload.metrics.stepsCount !== undefined) {
        rawSamples.push({ type: 'steps', value: payload.metrics.stepsCount, unit: 'steps', timestamp: ts });
      }
      if (payload.metrics.sleepHours !== undefined) {
        rawSamples.push({ type: 'sleep', value: payload.metrics.sleepHours, unit: 'hours', timestamp: ts });
      }
      if (payload.metrics.spo2Percentage !== undefined) {
        rawSamples.push({ type: 'spo2', value: payload.metrics.spo2Percentage, unit: '%', timestamp: ts });
      }
    } else if (Array.isArray(payload.samples)) {
      rawSamples.push(...payload.samples);
    }

    return await integrationsService.executeAdapterPipeline(userId, providerId, rawSamples);
  }
}

export const wearablesService = new WearablesService();

