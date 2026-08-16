# Aida user-testing readiness

This document is the operational checklist for moving Aida from implementation to real user testing. It must reflect the production Python/Expo application, not legacy prototype code.

## Product readiness contract

Aida is ready for the first user-testing round only when:

- a new account contains no fabricated medical values;
- authentication, recovery, onboarding and active-profile switching work end to end;
- Home, Health, Aida, Tasks and Profile use only profile-scoped backend data;
- lab/document imports have a review/confirmation step before canonical writes;
- measurements, blood pressure, symptoms, mental check-ins, medications and medication events are profile-scoped;
- timeline aggregates canonical events server-side;
- device integrations expose honest states such as `not_connected`, `permission_denied`, `connected_no_data`, `syncing`, `stale` and `sync_error`;
- Apple Health and Android Health Connect use native permissions and upload normalized records with provenance and idempotency;
- web production build and backend smoke tests are green;
- Android native build compiles;
- iOS project/configuration compiles and is ready for signing/physical HealthKit testing;
- all P0/P1 security/privacy issues are either closed or explicitly blocked by an external credential/action.

## Implemented foundations

The repository already contains the production Python backend, Google storage adapter, auth/profile isolation, Puzzle configuration, timeline, lab pipeline, document storage/import foundation, AI context/candidate records, medication/circadian logic, family profiles, wearable ingestion, HealthKit/Health Connect bridges, device UI, notification flows and responsive Expo UI.

The cycle branch additionally contains personalized cycle tracking with uncertainty and no population-default cycle length, a profile-scoped calendar, soft reminder handling, evidence-based phase estimates and a separate pregnancy context that never infers pregnancy from cycle data.

## Production runner and deployment state

RU VDS now has a dedicated GitHub self-hosted runner labeled `aida-prod`. Production deployment is restricted to trusted `main` pushes and runs frontend lint/typecheck/web export plus backend compile/import/security tests before upload and restart.

Automatic pull-request workflows that require GitHub-hosted minutes are temporarily manual-only while the private repository has no hosted minutes. This prevents false red checks caused by jobs that never receive a runner. Do not interpret this as a passed PR build: branch validation must still be distinguished from production-main validation.

The production self-hosted runner must not be used for automatic execution of arbitrary pull-request code.

## Cycle verification gate

Code-level guards currently cover:

- no hidden 28-day cycle default;
- no hidden five-day menstrual default;
- no universal day-14 ovulation inference;
- ovulation window only from the selected profile's repeated positive ovulation-test history;
- predicted phase labels remain explicitly derived/predicted;
- calendar markers use actual period start/end events;
- cycle reminder storage is profile-scoped, replaceable after forecast changes and privacy-aware.

Still required on a physical app build before calling cycle UX verified:

1. Open the cycle module with an empty profile and confirm no fake prediction/phase appears.
2. Add period-start and period-end events from calendar-selected dates and confirm they persist after reload.
3. Add enough personal history to produce a forecast and verify the displayed uncertainty window changes with the history.
4. Add positive ovulation tests across separate cycles and verify the UI uses a predicted window, never a statement that ovulation occurred.
5. Enable reminders, grant notification permission and verify one local reminder is scheduled for the profile.
6. Change the forecast and verify the old reminder is replaced; disable reminders and verify it is cancelled.
7. Disable notification details and verify lock-screen copy is neutral.
8. Switch family profiles and confirm events/reminders never cross profile boundaries.

## External blockers that code cannot invent

### Apple Health physical testing and installable iOS build

Required outside the repository:

1. An active Apple Developer team/account able to sign the Aida bundle identifier.
2. A development/distribution signing certificate and provisioning profile, or EAS credentials configured for the project.
3. A physical iPhone paired with Apple Watch for HealthKit permission and real sensor-data verification.
4. HealthKit + Background Delivery capabilities must remain enabled in the signed target.

No browser/PWA can request HealthKit access.

### Garmin / Oura / Fitbit / Withings direct cloud APIs

Aida must not claim a direct provider is connected until official vendor credentials are issued and configured server-side.

Required production secrets are documented in `backend/.env.example`:

- `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`
- `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET`
- `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`, plus the approved authorization URL if required by the registered app
- `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`, approved Garmin OAuth endpoints after partner access
- `OAUTH_STATE_SECRET`
- `AIDA_TOKEN_ENCRYPTION_KEY`

Tokens must remain encrypted server-side. Vendor approval/partner access is an external dependency, not something to fake in development.

### RU VDS credential hygiene

The deploy path must keep using a restricted non-root account, pinned `known_hosts`, a dedicated deploy key and least-privilege `systemctl` sudo. Private keys must remain in GitHub Secrets/server configuration and never in repository source.

### GitHub Actions native-build availability

Android/iOS native build workflows remain real release gates. While GitHub-hosted minutes are unavailable, those workflows are manual-only and cannot be called green until an actual runner executes them successfully. A local/EAS build can also satisfy the native-build gate if recorded explicitly.

## Integration routing

- Apple Watch and compatible iOS devices: device/vendor app -> Apple Health -> HealthKit native bridge -> Aida wearable ingestion.
- Android watches and compatible vendor apps: device/vendor app -> Health Connect -> Aida native module -> Aida wearable ingestion.
- Cloud provider integration is used only where the system aggregation layer is insufficient and official access exists.

## Release rule

Do not merge a readiness PR solely because static checks are green. Before calling the app ready, record the outcome of the end-to-end scenarios and distinguish code-complete items from external credential/signing blockers.