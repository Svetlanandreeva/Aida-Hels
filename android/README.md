# Aida Android — Health Connect

Aida should use Android Health Connect as the primary system bridge for watches and trackers on Android.

## Why Health Connect

It gives Aida one permission and data model layer instead of maintaining a BLE integration per vendor. Compatible source apps can contribute data from Samsung Galaxy Watch, Fitbit, Xiaomi and other devices into Health Connect.

## Core metrics Aida will read

- Heart rate
- Resting heart rate
- Steps
- Active calories
- Sleep sessions/stages
- Blood oxygen saturation (SpO2)
- Respiratory rate
- VO2 max
- Skin temperature when available
- Weight/body composition when a connected source publishes it

## Android app setup

1. Add the latest stable `androidx.health.connect:connect-client` dependency supported by the app's Android target.
2. Declare only the Health Connect read permissions Aida actually needs in `AndroidManifest.xml`.
3. Add the Health Connect permissions rationale/activity required for Play Store distribution.
4. Request permissions from the user in the native Android shell.
5. Read records incrementally and normalize them to Aida's wearable sample format.
6. Upload batches to `POST /api/health/wearables/android_health_connect/sync` with the logged-in Aida bearer token and selected `profile_id`.

## Server endpoints

- `GET /api/health/wearables/providers`
- `GET /api/health/wearables/status/{profile_id}`
- `POST /api/health/wearables/android_health_connect/sync`

## Important

The web/PWA build cannot access Health Connect directly. Permission prompts and data reads must run in the native Android application.
