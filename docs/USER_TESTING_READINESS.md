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

The cycle branch additionally contains personalized cycle tracking with uncertainty and no population-default cycle length.

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

### RU VDS deploy-key rotation

The previously exposed deploy key must be replaced outside source control:

1. Generate a new SSH keypair locally or in a secure admin environment.
2. Install only the new public key for the restricted `aida` deploy user on RU VDS.
3. Replace the GitHub Actions `RUVDS_SSH_KEY` secret with the new private key.
4. Replace/update `RUVDS_SSH_KNOWN_HOSTS` from a trusted out-of-band host-key fingerprint.
5. Revoke/remove the old public key from the server.
6. Run the deploy workflow and verify restricted sudo + production smoke checks.

The repository cannot safely manufacture or rotate the server credential without access to the server and Actions secrets.

### GitHub Actions native-build billing/runner availability

If Android/iOS native workflows are rejected before a runner starts because of GitHub billing/spending limits, the build result remains externally blocked. The source configuration can still be validated, but a successful native artifact requires an available runner or a local/EAS build environment.

## Integration routing

- Apple Watch and compatible iOS devices: device/vendor app -> Apple Health -> HealthKit native bridge -> Aida wearable ingestion.
- Android watches and compatible vendor apps: device/vendor app -> Health Connect -> Aida native module -> Aida wearable ingestion.
- Cloud provider integration is used only where the system aggregation layer is insufficient and official access exists.

## Release rule

Do not merge a readiness PR solely because static checks are green. Before calling the app ready, record the outcome of the end-to-end scenarios and distinguish code-complete items from external credential/signing blockers.