package expo.modules.aidahealth

import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.Instant
import java.time.temporal.ChronoUnit

class AidaHealthModule : Module() {
  private lateinit var permissionLauncher: ActivityResultLauncher<Set<String>>
  private var pendingPermissionPromise: Promise? = null

  private val readPermissions: Set<String> = setOf(
    HealthPermission.getReadPermission(HeartRateRecord::class),
    HealthPermission.getReadPermission(RestingHeartRateRecord::class),
    HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
    HealthPermission.getReadPermission(StepsRecord::class),
    HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
    HealthPermission.getReadPermission(RespiratoryRateRecord::class),
    HealthPermission.getReadPermission(OxygenSaturationRecord::class),
    HealthPermission.getReadPermission(Vo2MaxRecord::class),
    HealthPermission.getReadPermission(SleepSessionRecord::class),
  )

  override fun definition() = ModuleDefinition {
    Name("AidaHealth")

    RegisterActivityContracts {
      permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
      ) { _, grantedPermissions ->
        val promise = pendingPermissionPromise
        pendingPermissionPromise = null
        promise?.resolve(grantedPermissions.containsAll(readPermissions))
      }
    }

    Function("isAvailable") {
      val context = requireNotNull(appContext.reactContext)
      HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    }

    AsyncFunction("requestAuthorization") { promise: Promise ->
      val context = appContext.reactContext
      val activity = appContext.currentActivity
      if (context == null || activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
        promise.resolve(false)
        return@AsyncFunction
      }
      if (pendingPermissionPromise != null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      pendingPermissionPromise = promise
      activity.runOnUiThread {
        permissionLauncher.launch(readPermissions)
      }
    }

    AsyncFunction("readRecentSamples") Coroutine { days: Int ->
      val context = requireNotNull(appContext.reactContext)
      check(HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
        "Health Connect is not available on this device."
      }
      val client = HealthConnectClient.getOrCreate(context)
      val granted = client.permissionController.getGrantedPermissions()
      check(granted.containsAll(readPermissions)) {
        "Health Connect permissions are not granted."
      }

      val safeDays = days.coerceIn(1, 30)
      val since = Instant.now().minus(safeDays.toLong(), ChronoUnit.DAYS)
      readSamples(client, since)
        .sortedBy { it["start_at"] as? String ?: "" }
    }
  }

  private suspend fun readSamples(
    client: HealthConnectClient,
    since: Instant,
  ): List<Map<String, Any?>> {
    val filter = TimeRangeFilter.after(since)
    val rows = mutableListOf<Map<String, Any?>>()

    client.readRecords(ReadRecordsRequest<HeartRateRecord>(timeRangeFilter = filter))
      .records.forEach { record ->
        record.samples.forEachIndexed { index, sample ->
          rows += sampleMap(
            metadata = record.metadata,
            externalId = "${record.metadata.id}:${sample.time}:$index",
            metric = "heart_rate",
            value = sample.beatsPerMinute.toDouble(),
            unit = "bpm",
            start = sample.time,
            end = sample.time,
          )
        }
      }

    client.readRecords(ReadRecordsRequest<RestingHeartRateRecord>(timeRangeFilter = filter))
      .records.forEach { record ->
        rows += sampleMap(
          metadata = record.metadata,
          externalId = record.metadata.id,
          metric = "resting_heart_rate",
          value = record.beatsPerMinute.toDouble(),
          unit = "bpm",
          start = record.time,
          end = record.time,
        )
      }

    client.readRecords(ReadRecordsRequest<HeartRateVariabilityRmssdRecord>(timeRangeFilter = filter))
      .records.forEach { record ->
        rows += sampleMap(
          metadata = record.metadata,
          externalId = record.metadata.id,
          metric = "hrv_rmssd",
          value = record.heartRateVariabilityMillis,
          unit = "ms",
          start = record.time,
          end = record.time,
        )
      }

    client.readRecords(ReadRecordsRequest<StepsRecord>(timeRangeFilter = filter))
      .records.forEach { record ->
        rows += sampleMap(
          metadata = record.metadata,
          externalId = record.metadata.id,
          metric = "steps",
          value = record.count.toDouble(),
          unit = "count",
          start = record.startTime,
          end = record.endTime,
        )
      }

    client.readRecords(ReadRecordsRequest<ActiveCaloriesBurnedRecord>(timeRangeFilter = filter))
      .records.forEach { record ->
        rows += sampleMap(
          metadata = record.metadata,
          externalId = record.metadata.id,
          metric = "active_energy",
          value = record.energy.inKilocalories,
          unit = "kcal",
          start = record.startTime,
          end = record.endTime,
        )
      }

    client.readRecords(ReadRecordsRequest<RespiratoryRateRecord>(timeRangeFilter = filter))
      .records.forEach { record ->
        rows += sampleMap(
          metadata = record.metadata,
          externalId = record.metadata.id,
          metric = "respiratory_rate",
          value = record.rate,
          unit = "breaths/min",
          start = record.time,
          end = record.time,
        )
      }

    client.readRecords(ReadRecordsRequest<OxygenSaturationRecord>(timeRangeFilter = filter))
      .records.forEach { record ->
        rows += sampleMap(
          metadata = record.metadata,
          externalId = record.metadata.id,
          metric = "oxygen_saturation",
          value = record.percentage.value,
          unit = "%",
          start = record.time,
          end = record.time,
        )
      }

    client.readRecords(ReadRecordsRequest<Vo2MaxRecord>(timeRangeFilter = filter))
      .records.forEach { record ->
        rows += sampleMap(
          metadata = record.metadata,
          externalId = record.metadata.id,
          metric = "vo2_max",
          value = record.vo2MillilitersPerMinuteKilogram,
          unit = "mL/kg/min",
          start = record.time,
          end = record.time,
        )
      }

    client.readRecords(ReadRecordsRequest<SleepSessionRecord>(timeRangeFilter = filter))
      .records.forEach { record ->
        if (record.stages.isEmpty()) {
          rows += sampleMap(
            metadata = record.metadata,
            externalId = record.metadata.id,
            metric = "sleep_session",
            value = 1.0,
            unit = "session",
            start = record.startTime,
            end = record.endTime,
          )
        } else {
          record.stages.forEachIndexed { index, stage ->
            rows += sampleMap(
              metadata = record.metadata,
              externalId = "${record.metadata.id}:stage:$index",
              metric = "sleep_stage",
              value = stage.stage.toDouble(),
              unit = "HealthConnectSleepStage",
              start = stage.startTime,
              end = stage.endTime,
              extraMetadata = mapOf("stage" to stage.stage),
            )
          }
        }
      }

    return rows
  }

  private fun sampleMap(
    metadata: Metadata,
    externalId: String,
    metric: String,
    value: Double,
    unit: String,
    start: Instant,
    end: Instant,
    extraMetadata: Map<String, Any?> = emptyMap(),
  ): Map<String, Any?> {
    val device = metadata.device
    return mapOf(
      "external_id" to externalId,
      "metric" to metric,
      "value" to value,
      "unit" to unit,
      "start_at" to start.toString(),
      "end_at" to end.toString(),
      "source_name" to metadata.dataOrigin.packageName,
      "device_name" to (device?.model ?: device?.manufacturer),
      "metadata" to (mapOf("recording_method" to metadata.recordingMethod) + extraMetadata),
    )
  }
}
