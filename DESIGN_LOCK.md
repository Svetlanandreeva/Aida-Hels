# Aida design lock

## Non-negotiable product rule

The currently approved Aida UI/design system is **locked**.

- Product/feature work must **add functionality inside the existing approved UI**.
- Do **not** redesign, restyle, replace, reinterpret, or rebuild screens, navigation, typography, spacing, card shapes, colors, gradients, icon language, information hierarchy, or component composition unless the user explicitly asks for a design-system change.
- A request such as “add”, “connect”, “implement”, “make functional”, “optimize”, “fix”, or “integrate” is **not permission to redesign**.
- When functionality needs a new control, reuse the existing components/tokens and place it with the minimum visual change necessary.
- If a requested feature appears to require a visual redesign, preserve the current design and ask for explicit approval before changing it.

## Approved Home reference

The approved Home/Puzzle layout is the compact dashboard version with:

1. profile/avatar + language control in the header;
2. two compact metric cards (“В норме” / “Вне нормы”);
3. gradient “Готовность аналитики” card;
4. “Требует внимания” card;
5. side-by-side “Загрузить анализ” and gradient “Подключить устройство” cards;
6. existing bottom navigation (“Пазл / Здоровье / Аида / Задачи / Профиль”).

Do not replace this with a large editorial hero, oversized health ring, alternate navigation, or a different visual system unless the user explicitly requests it.

## Approved responsive-navigation exception — 16.08.2026

The user explicitly approved refinement of the navigation shell and responsive behavior across device sizes.

Allowed without further redesign approval:
- polish the desktop left sidebar while preserving the same five destinations and icon language;
- adapt sidebar width, item sizing and spacing to desktop viewport width;
- adapt the existing mobile bottom navigation to narrow phones, regular phones and tablets;
- hide mobile tab labels only on extremely narrow screens when required to prevent clipping;
- respect device safe areas, orientation changes and small-screen text constraints;
- make profile/header controls compact when necessary for narrow devices.

This exception does **not** authorize rebuilding screen cards, gradients, content hierarchy, typography system or product flows. Those remain locked unless separately approved.
