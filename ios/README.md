# Aida iOS — Apple Health / HealthKit

This folder contains Aida's native iOS bridge for Apple Health. Apple Watch data reaches Aida through HealthKit on the paired iPhone; the website/PWA cannot access HealthKit directly.

## What is implemented

- HealthKit permission request.
- Reading heart rate, resting heart rate, HRV (SDNN), steps, active energy and walking heart-rate average.
- Reading sleep stages.
- Reading SpO2, respiratory rate, VO2 max, weight and body-fat percentage when those samples exist in HealthKit.
- Reading Apple sleeping wrist temperature on supported iOS/watch hardware.
- Enabling hourly HealthKit background delivery and observer queries.
- `AidaHealthSyncCoordinator` for authorization, initial import, persisted last-sync time and observer-driven incremental sync.
- Mapping HealthKit samples into Aida's API format.
- Authenticated sync to `POST /api/health/apple/sync`.
- Server-side deduplication by HealthKit sample UUID.
- Sleep stages are grouped into contiguous sleep sessions and their bedtime/wake boundaries are staged through `POST /api/circadian/wearable-candidates`.
- Imported sleep anchors remain CandidateRecords until the user confirms or corrects them; raw HealthKit sleep data never becomes a canonical `CircadianEvent` by itself.

## Xcode setup

1. Create/open the Aida iOS target in Xcode.
2. Add `HealthKitManager.swift`, `AppleHealthSyncClient.swift`, `CircadianCandidateClient.swift` and `AidaHealthSyncCoordinator.swift` to the target.
3. In **Signing & Capabilities**, add **HealthKit**.
4. Inside the HealthKit capability enable **Background Delivery**.
5. Add `NSHealthShareUsageDescription` explaining why Aida reads health data. The Expo app config already contains this description and the HealthKit/background-delivery entitlements for generated native projects.
6. Do not enable Clinical Health Records unless Aida actually ships a clinical-record feature.
7. Use `https://aidaassistent.ru` as the production API base URL.
8. Pass the logged-in Aida bearer token and selected `profile_id` when syncing.

## First sync

```swift
let coordinator = AidaHealthSyncCoordinator()
try await coordinator.connect(profileId: profileId, bearerToken: token)
```

The coordinator requests HealthKit access, enables background delivery, imports recent samples, stages sleep/wake candidates for review and starts observer-driven incremental sync.

## Backend endpoints

Existing Apple-compatible endpoints:

- `POST /api/health/apple/sync`
- `GET /api/health/apple/status/{profile_id}`
- `GET /api/health/apple/latest/{profile_id}`

Circadian review endpoint:

- `POST /api/circadian/wearable-candidates`

Unified wearable endpoints:

- `GET /api/health/wearables/providers`
- `GET /api/health/wearables/status/{profile_id}`
- `POST /api/health/wearables/apple_health/sync`

## Required product step

To actually show the Apple Health permission sheet on a user's iPhone, Aida needs a signed native iOS build. A browser tab or installed PWA cannot request HealthKit authorization. The native build can reuse the same Aida account/profile and sync into the existing backend.

The remaining native acceptance gate is an Xcode build with the current SDK plus a real-device smoke test of HealthKit permissions/background delivery. Apple signing credentials are external to the repository and must not be fabricated or committed.
