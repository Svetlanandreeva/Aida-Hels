# Emergent design migration map

Source preview: `aida-health-data.preview.emergentagent.com` (reviewed 2026-08-23).

This document is the implementation contract for moving the Emergent visual language onto the existing Aida architecture. The preview supplies presentation and information hierarchy; the repository remains the source of truth for authentication, data, permissions, ModuleConfig v2, Puzzle v2, health logic, and the pet economy.

## Visual system

| Layer | Preview | Repository implementation |
| --- | --- | --- |
| Canvas | Near-black, low-glare background | Semantic `--aida-*` dark tokens applied after legacy styles |
| Surfaces | Charcoal cards, subtle translucent borders, glass panels | Shared shell/card/input/button rules; no component data rewrite |
| Accent | Coral/red for primary actions and findings; blue for selected metrics | Coral brand action token plus semantic info/success/warning/error tokens |
| Typography | Editorial serif display headings, compact sans-serif UI text | Display serif for headings; Manrope/Inter/system stack for controls and body |
| Shape | Large rounded cards and pill controls | 14/18/24/30 px radius scale |
| Navigation | Persistent product rail/bottom bar with seven primary entries | ModuleConfig-filtered desktop rail and adaptive mobile dock; overflow exposes every enabled module |
| States | Explicit "Недостаточно данных", attention and empty cards | Existing loading/empty/error logic restyled; no invented medical values |

## Screen and component mapping

| Preview route/surface | Preview components | Existing Aida destination | Integration rule |
| --- | --- | --- | --- |
| `/` | Marketing header, hero insight card, benefits, comparison, workflow, modules, statistics, reviews, security, FAQ, CTA | `StartScreen` / `PromoLanding` | Keep existing truthful copy and CTA logic; port dark composition and tokens |
| `/auth?mode=login` | Login/register tabs, email/password, recovery, Yandex/VK buttons, legal links | `AuthScreen` plus backend auth/social OAuth/session APIs | Preserve real auth, OAuth callbacks, session hardening and errors |
| onboarding | Not exposed by demo route | `Questionnaire` q1-q5, Puzzle v2 completion | Keep clinical/onboarding flow; restyle with same token system |
| `/home` | Health status, analytics readiness, AI daily summary, attention, medication/task agenda, check-in, body systems, biological age, women health, latest metrics | `Dashboard` main tab and existing dashboard sections | Populate only from existing APIs/state; ModuleConfig controls widgets |
| `/mind` | Fast check-in, mental history empty state | `MentalDiaryScreen`, `DailyCheckin`, sleep diary | Use real diary/check-in persistence; Mind ModuleConfig gate |
| `/pressure` | Last measurement, add measurement, empty state | `PressureDiary` | Keep validation, history, charts and persistence |
| `/body` | Overall state, biological age, body map, nine systems, trends, Aida observations, sources | `BodyMap`, `WellnessOverview`, `OrganismAgeBlock` | Reuse calculated profile and body-insights API; no synthetic scores |
| `/labs` | Add analysis, analyses empty state | Dashboard `lab` tab / `LabResearchScreen` | Keep document upload/OCR/trends/Gemini and web-runtime behavior |
| `/aida` | Daily summary, suggested prompts, composer | `AiAssistant` | Replace preview's "chat soon" placeholder with production chat and permission gates |
| `/tasks` | Progress, task list, new task | `RemindersScreen` and task API | Keep create/edit/complete/notification behavior |
| profile header | User/date/language/theme/profile controls | `MedicalProfile`, `SettingsDrawer`, subject-profile switcher | Keep account isolation and family profiles |
| preview omissions | — | Nutrition, medications, documents, cycle/women, sleep, timeline, integrations, permissions, notifications | Keep as enabled modules in the same design system; never hide unless ModuleConfig says disabled |
| game omission | — | Pet claim/care/journal, XP, coins, rarity and rare entitlement | Keep backend economy authoritative; expose the Pet module when Puzzle/game eligibility enables it |

## Navigation and ModuleConfig v2

- Navigation reads `/api/profiles/{profile_id}/modules` and filters only health modules explicitly disabled by the profile.
- A failed or unavailable ModuleConfig request is non-destructive: existing modules remain visible.
- Primary order follows the preview where possible: Home, Mind, Pressure, Body, Labs, Aida, Tasks.
- Additional existing modules remain reachable in the same rail/dock and follow the stored ModuleConfig order.
- `show_on_home` affects dashboard widgets, not whether a module route exists.
- `allow_ai_analytics` and AI permissions remain separate gates; a visible module does not grant AI access.

## Functional completion rules

1. Preview-only controls must call an existing API/state transition or be implemented end-to-end before release.
2. Empty, loading, denied and error states must be visible and actionable; medical numbers are never fabricated.
3. Existing API paths and stored user records remain unchanged. Additive fields and endpoints only.
4. Auth/session/OAuth, Puzzle v2, subject isolation, notification permission, AI permission and entitlement checks remain authoritative.
5. Pet coins/XP/rarity are calculated by the backend; the frontend only renders returned state.

## Release gates

- TypeScript typecheck and production safety audit.
- Frontend production build.
- Backend tests on the CI Python version (3.12).
- Smoke coverage for auth, onboarding/Puzzle, every enabled navigation module, upload flows, Aida permission denial/allow, empty/error states, and pet level-2 reward path.
- Pull request only; no merge to `main` until CI and deploy gate are green.
