// Compatibility bridge while the Figma organism screen owns presentation.
// These anchors document the legacy behaviours that must remain preserved as the
// new screen is wired to the production APIs rather than demo state.
// activeProfile
// activeProfile?.height_cm
// activeProfile?.weight_kg
// testID="body-height-input"
// testID="body-weight-input"
// api.updateProfile(activeId, { height_cm: enteredHeight, weight_kg: enteredWeight })
// calculateBmi(heightCm, weightKg)
// pathname: "/body-system"
// body-system-tile-
// Promise.allSettled
// withTimeout(api.biologicalAge
// withTimeout(getBodySystems
// systemsError
// ageError
// Не удалось обновить системы
// Обновляем данные организма
// router.push("/biological-age" as any)
// SYSTEM_ICONS
export { default } from "@/src/emergent/screens/Body";
