# Aida iOS — Apple Health / HealthKit

This folder contains Aida's native iOS bridge for Apple Health. Apple Watch data reaches Aida through HealthKit on the paired iPhone; the website/PWA cannot access HealthKit directly.

## What is implemented

- HealthKit permission request.
- Reading heart rate, resting heart rate, HRV (SDNN), steps, active energy and walking heart-rate average.
- Reading sleep stages.
- Reading SpO2, respiratory rate, VO2 max, weight and body-fat percentage when those samples exist in HealthKit.
- Reading Apple sleeping wrist temperature on supported iOS/watch hardware.
- Enabling hourly HealthKit background delivery and observer queries.
- Mapping HealthKit samples into Aida's API format.
- Authenticated sync to `POST /api/health/apple/sync`.
- Server-side deduplication by HealthKit sample UUID.

## Xcode setup

1. Create/open the Aida iOS target in Xcode.
2. Add `HealthKitManager.swift` and `AppleHealthSyncClient.swift` to the target.
3. In **Signing & Capabilities**, add **HealthKit**.
4. Inside the HealthKit capability enable **Background Delivery**.
5. Add `NSHealthShareUsageDescription` explaining why Aida reads health data.
6. Do not enable Clinical Health Records unless Aida actually ships a clinical-record feature.
7. Use `https://aidaassistent.ru` as the production API base URL.
8. Pass the logged-in Aida bearer token and selected `profile_id` when syncing.

## First sync

```swift
let healthKit = HealthKitManager()
try await healthKit.requestAuthorization()
try await healthKit.enableBackgroundDelivery()

let since = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
let samples = try await healthKit.readRecentSamples(since: since)

let client = AppleHealthSyncClient(baseURL: URL(string: "https://aidaassistent.ru")!)
let response = try await client.sync(
    profileId: profileId,
    bearerToken: token,
    samples: samples,
    deviceName: UIDevice.current.name,
    deviceModel: UIDevice.current.model,
    osVersion: UIDevice.current.systemVersion
)
```

## Background sync

After authorization, start HealthKit observer queries with `startObservingChanges`. When HealthKit reports changes, read only the period since the last successful sync and upload the resulting batch. Persist the last successful sync timestamp locally so background wakes do not repeatedly scan the full history.

## Backend endpoints

Existing Apple-compatible endpoints:

- `POST /api/health/apple/sync`
- `GET /api/health/apple/status/{profile_id}`
- `GET /api/health/apple/latest/{profile_id}`

Unified wearable endpoints:

- `GET /api/health/wearables/providers`
- `GET /api/health/wearables/status/{profile_id}`
- `POST /api/health/wearables/apple_health/sync`

## Required product step

To actually show the Apple Health permission sheet on a user's iPhone, Aida needs a signed native iOS build. A browser tab or installed PWA cannot request HealthKit authorization. The native build can reuse the same Aida account/profile and sync into the existing backend.
