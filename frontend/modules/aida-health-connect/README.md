# Aida Health Connect local Expo module

This local Expo module is auto-linked from `frontend/modules` during native Android builds. It requests the read-only Health Connect permissions already declared in `app.json`, reads recent measurements from the Android Health Connect store, and returns normalized samples to the React Native layer. The JavaScript layer sends those samples through Aida's authenticated wearable ingestion API and persists permission/sync states.

The module intentionally does not fabricate values and does not treat missing permissions or empty data as zero measurements.

## Native verification still required

Run an Android development/test build generated from `frontend` and verify on a physical Android device with Health Connect data. This source integration is not considered production-verified until the native Gradle build and real permission/sync flow pass on-device.
