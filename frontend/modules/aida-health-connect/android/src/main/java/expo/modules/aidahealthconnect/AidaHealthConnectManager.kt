package expo.modules.aidahealthconnect

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant

internal class AidaHealthConnectManager(context: Context) {
  private val client = HealthConnectClient.getOrCreate(context)

  val readPermissions: Set<String> = setOf(
    HealthPermission.getReadPermission(HeartRateRecord::class),
    HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
    HealthPermission.getReadPermission(StepsRecord::class),
    HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
    HealthPermission.getReadPermission(SleepSessionRecord::class),
    HealthPermission.getReadPermission(OxygenSaturationRecord::class),
    HealthPermission.getReadPermission(RespiratoryRateRecord::class),
    HealthPermission.getReadPermission(Vo2MaxRecord::class),
    HealthPermission.getReadPermission(WeightRecord::class),
    HealthPermission.getReadPermission(BodyFatRecord::class),
  )

  suspend fun grantedPermissions(): Set<String> = client.permissionController.getGrantedPermissions()

  suspend fun hasAllPermissions(): Boolean = grantedPermissions().containsAll(readPermissions)

  suspend fun readRecentSamples(start: Instant, end: Instant = Instant.now()): List<Map<String, Any?>> {
    val filter = TimeRangeFilter.between(start, end)
    val out = mutableListOf<Map<String, Any?>>()

    readAll<HeartRateRecord>(filter).forEach { record ->
      record.samples.forEachIndexed { index, point ->
        out += sample("${record.metadata.id}:$index", "heart_rate", point.beatsPerMinute.toDouble(), "count/min", point.time, point.time, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
      }
    }
    readAll<HeartRateVariabilityRmssdRecord>(filter).forEach { record ->
      out += sample(record.metadata.id, "hrv_rmssd", record.heartRateVariabilityMillis, "ms", record.time, record.time, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
    }
    readAll<StepsRecord>(filter).forEach { record ->
      out += sample(record.metadata.id, "steps", record.count.toDouble(), "count", record.startTime, record.endTime, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
    }
    readAll<ActiveCaloriesBurnedRecord>(filter).forEach { record ->
      out += sample(record.metadata.id, "active_energy", record.energy.inKilocalories, "kcal", record.startTime, record.endTime, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
    }
    readAll<OxygenSaturationRecord>(filter).forEach { record ->
      out += sample(record.metadata.id, "spo2", record.percentage.value, "%", record.time, record.time, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
    }
    readAll<RespiratoryRateRecord>(filter).forEach { record ->
      out += sample(record.metadata.id, "respiratory_rate", record.rate, "breaths/min", record.time, record.time, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
    }
    readAll<Vo2MaxRecord>(filter).forEach { record ->
      out += sample(record.metadata.id, "vo2_max", record.vo2MillilitersPerMinuteKilogram, "mL/kg/min", record.time, record.time, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
    }
    readAll<WeightRecord>(filter).forEach { record ->
      out += sample(record.metadata.id, "weight", record.weight.inKilograms, "kg", record.time, record.time, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
    }
    readAll<BodyFatRecord>(filter).forEach { record ->
      out += sample(record.metadata.id, "body_fat_percentage", record.percentage.value, "%", record.time, record.time, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
    }
    readAll<SleepSessionRecord>(filter).forEach { record ->
      if (record.stages.isEmpty()) {
        out += sample(record.metadata.id, "sleep_session", 1.0, "session", record.startTime, record.endTime, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
      } else {
        record.stages.forEachIndexed { index, stage ->
          out += sample("${record.metadata.id}:stage:$index", "sleep_stage", stage.stage.toDouble(), "health_connect_sleep_stage", stage.startTime, stage.endTime, record.metadata.dataOrigin.packageName, record.metadata.recordingMethod.toString())
        }
      }
    }
    return out.sortedBy { it["start_at"] as String }
  }

  private suspend inline fun <reified T : androidx.health.connect.client.records.Record> readAll(filter: TimeRangeFilter): List<T> {
    val result = mutableListOf<T>()
    var pageToken: String? = null
    do {
      val response = client.readRecords(ReadRecordsRequest(recordType = T::class, timeRangeFilter = filter, pageToken = pageToken, pageSize = 1000))
      result += response.records
      pageToken = response.pageToken
    } while (pageToken != null)
    return result
  }

  private fun sample(id: String, metric: String, value: Double, unit: String, start: Instant, end: Instant, source: String, recordingMethod: String): Map<String, Any?> = mapOf(
    "external_id" to id,
    "metric" to metric,
    "value" to value,
    "unit" to unit,
    "start_at" to start.toString(),
    "end_at" to end.toString(),
    "source_name" to source,
    "recording_method" to recordingMethod,
  )
}
