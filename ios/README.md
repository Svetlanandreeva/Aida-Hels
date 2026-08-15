# Aida iOS — Apple Health / HealthKit

This folder contains the first native iOS bridge for Apple Health data.

## What is implemented

- HealthKit permission request.
- Reading recent heart rate, resting heart rate, HRV (SDNN), steps, active energy, walking heart-rate average, and sleep stages.
- Mapping HealthKit samples into Aida's API format.
- Authenticated sync to `POST /api/health/apple/sync`.
- Server-side deduplication by HealthKit sample UUID.

## Xcode setup

1. Create/open the Aida iOS target in Xcode.
2. Add `HealthKitManager.swift` and `AppleHealthSyncClient.swift` to the target.
3. In **Signing & Capabilities**, add the **HealthKit** capability.
4. Add usage descriptions to the app target's Info configuration:
   - `NSHealthShareUsageDescription`: `Aida uses your health data to show your health trends and daily summaries.`
   - `NSHealthUpdateUsageDescription`: only needed later if Aida writes data to HealthKit.
5. Use the production Aida HTTPS base URL when creating `AppleHealthSyncClient`.
6. Pass the logged-in Aida account bearer token and selected `profile_id` when syncing.

## Suggested first sync flow

```swift
let healthKit = HealthKitManager()
try await healthKit.requestAuthorization()

let since = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
let samples = try await healthKit.readRecentSamples(since: since)

let client = AppleHealthSyncClient(baseURL: URL(string: "https://YOUR-AIDA-DOMAIN")!)
let response = try await client.sync(
    profileId: profileId,
    bearerToken: token,
    samples: samples,
    deviceName: UIDevice.current.name,
    deviceModel: UIDevice.current.model,
    osVersion: UIDevice.current.systemVersion
)
```

## Backend endpoints

- `POST /api/health/apple/sync` — upload samples.
- `GET /api/health/apple/status/{profile_id}` — connection/last-sync status.
- `GET /api/health/apple/latest/{profile_id}` — latest synced Apple Health samples.

## Next step

Add a small native Aida iOS shell with a **Connect Apple Health** button, auth session reuse, background/periodic sync, and a web/native bridge if the main UI remains web-based.
