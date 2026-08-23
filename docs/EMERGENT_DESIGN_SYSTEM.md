# Emergent product UI

This document is the implementation contract for the product interface captured from the Emergent preview on 2026-08-23. The preview defines presentation only; production APIs and persisted user data remain authoritative.

## Visual tokens

| Role | Value |
| --- | --- |
| Canvas | `#050505` |
| Card surface | `#111111` |
| Raised/control surface | `#1C1C1E` |
| Primary text | `#FFFFFF` |
| Muted text | `#8E8E93` |
| Brand/action | `#FF2D55` |
| Brand tint | `#3A000A` |
| Success | `#30D158` |
| Information | `#0A84FF` |
| Border / strong border | `#38383A` / `#48484A` |
| Type family | Manrope Regular–ExtraBold |
| Content width | 720 px maximum |
| Card radius / compact radius | 24 px / 16 px |
| Spacing scale | 4, 8, 12, 16, 24, 32, 48 px |

The authenticated shell always uses a centered single column and a bottom tab bar. It does not turn into a sidebar on desktop.

## Screen map

| Emergent screen | Production route | Production data and behavior |
| --- | --- | --- |
| Landing | `/` | Registration, login and legal routes |
| Authentication | `/auth`, `/register`, `/reset-password` | Password auth, Yandex/VK OAuth and session restore |
| Onboarding | `/onboarding*` | Puzzle v2 answers, profile and medical/lifestyle/medication steps |
| Home | `/(tabs)` | `/home`, Puzzle v2 widgets, readiness, AI permission, tasks, medications and check-in |
| Mind | `/(tabs)/mind` | Diagnoses, medications and mental-health diary |
| Pressure | `/(tabs)/pressure` | Blood-pressure history, create and delete actions |
| Body | `/(tabs)/body` | Body systems plus links to nutrition, cycle, sleep, measurements and records |
| Labs | `/(tabs)/labs` | Lab documents, biomarkers, filters and trends |
| Aida | `/(tabs)/chat` | Existing chat history, send and clear APIs; no preview canned responses |
| Tasks | `/(tabs)/tasks` | Existing task CRUD, reminders and action routes |
| Add sheet | Global logging sheet | Symptoms, pressure, labs and other supported records |
| Pet | `/(tabs)/companion`, `/pet` | Server-owned XP, level-2 wheel, pet rarity, coins, care and rare entitlements |

Secondary production screens absent from the visual preview—nutrition, medications, documents, cycle/women's health, notifications, integrations, AI permissions, family profiles and medical history—reuse the same tokens, cards, headers, forms and states. They are not removed or replaced with mock data.

## Navigation and module rules

The primary order is Home, Mind, Pressure, Body, Labs, Aida and Tasks. ModuleConfig controls visibility of configurable health modules. The Pet tab is appended only after the game API reports the level/claim state required by the existing entitlement flow. Puzzle v2 continues to control home widget order and visibility. Hidden UI never deletes module data.

## State contract

- `no_data` shows an honest empty state and an available data-entry action.
- `error` is visually distinct from no data and offers retry where appropriate.
- Loading preserves the canvas and layout instead of displaying invented values.
- AI summaries render only when AI analytics permission is enabled.
- All mutations continue through existing production APIs; the visual migration introduces no local-only success path.

## Verification

Every design change must pass frontend lint, TypeScript, web export, backend tests and the repository regression suite. Compare the landing page and authenticated Home at desktop and mobile widths against the reference before merging. Merge and deployment require green CI; production smoke follows deployment.
