# Legacy Aida Vite UI archive

The former root-level Vite/React/Express application was removed from the active `main` tree to prevent it from being confused with the production Aida application.

A complete snapshot is preserved in the branch:

`archive/legacy-vite-ui-2026-08-15`

Archive point:

`547eca54227c0762a9bd000cc9d0fa6aec35b824`

## Canonical production application

- `frontend/` — Expo Router application and the only web frontend deployed to RU VDS.
- `backend/` — Python/FastAPI production backend.
- `ios/` — iOS/HealthKit native source.
- `DESIGN_LOCK.md` — approved design lock.

Do not restore the legacy root `src/`, root `package.json`, `server.ts`, Vite configuration, Docker/Yandex deployment, or one-shot redesign workflows into `main` unless a deliberate historical rollback is required.
