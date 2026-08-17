package expo.modules.aidahealthconnect

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import expo.modules.kotlin.Promise
import expo.modules.kotlin.activityresult.ActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.Instant
import java.time.temporal.ChronoUnit

class AidaHealthConnectModule : Module() {
  private lateinit var permissionLauncher: ActivityResultLauncher<Set<String>>
  private var pendingPermissionPromise: Promise? = null

  private val reactContext
    get() = appContext.reactContext ?: throw IllegalStateException("React context is unavailable")

  private val manager by lazy { AidaHealthConnectManager(reactContext) }

  override fun definition() = ModuleDefinition {
    Name("AidaHealthConnect")

    RegisterActivityContracts {
      permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
      ) { _, granted ->
        val promise = pendingPermissionPromise
        pendingPermissionPromise = null
        promise?.resolve(
          mapOf(
            "granted" to granted.containsAll(manager.readPermissions),
            "granted_count" to granted.intersect(manager.readPermissions).size,
            "required_count" to manager.readPermissions.size,
          )
        )
      }
    }

    AsyncFunction("connect") { promise: Promise ->
      val status = HealthConnectClient.getSdkStatus(reactContext)
      if (status != HealthConnectClient.SDK_AVAILABLE) {
        promise.reject("HEALTH_CONNECT_UNAVAILABLE", "Health Connect is unavailable on this device", null)
        return@AsyncFunction
      }
      if (pendingPermissionPromise != null) {
        promise.reject("HEALTH_CONNECT_BUSY", "A Health Connect permission request is already in progress", null)
        return@AsyncFunction
      }
      pendingPermissionPromise = promise
      permissionLauncher.launch(manager.readPermissions)
    }

    AsyncFunction("status") Coroutine { ->
      val sdkStatus = HealthConnectClient.getSdkStatus(reactContext)
      if (sdkStatus != HealthConnectClient.SDK_AVAILABLE) {
        return@Coroutine mapOf(
          "available" to false,
          "granted" to false,
          "granted_count" to 0,
          "required_count" to manager.readPermissions.size,
        )
      }
      val granted = manager.grantedPermissions()
      return@Coroutine mapOf(
        "available" to true,
        "granted" to granted.containsAll(manager.readPermissions),
        "granted_count" to granted.intersect(manager.readPermissions).size,
        "required_count" to manager.readPermissions.size,
      )
    }

    AsyncFunction("sync") Coroutine { days: Int? ->
      val sdkStatus = HealthConnectClient.getSdkStatus(reactContext)
      if (sdkStatus != HealthConnectClient.SDK_AVAILABLE) {
        throw IllegalStateException("Health Connect is unavailable on this device")
      }
      val granted = manager.hasAllPermissions()
      if (!granted) {
        return@Coroutine mapOf(
          "granted" to false,
          "samples" to emptyList<Map<String, Any?>>(),
          "sleep_sessions" to emptyList<Map<String, Any?>>(),
        )
      }
      val safeDays = (days ?: 30).coerceIn(1, 90)
      val start = Instant.now().minus(safeDays.toLong(), ChronoUnit.DAYS)
      val samples = manager.readRecentSamples(start)
      val sleepSessions = manager.readSleepSessions(start)
      return@Coroutine mapOf(
        "granted" to true,
        "samples" to samples,
        "sleep_sessions" to sleepSessions,
      )
    }

    OnDestroy {
      pendingPermissionPromise?.reject("HEALTH_CONNECT_CANCELLED", "Health Connect module was destroyed", null)
      pendingPermissionPromise = null
    }
  }
}
