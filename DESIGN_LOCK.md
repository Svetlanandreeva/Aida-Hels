# Aida design lock

## Non-negotiable product rule

The currently approved Aida UI/design system is **locked**.

### Core project rule

**Do not change the existing design, visual style, layout, or already approved UI elements unless the user explicitly says to replace or redesign that specific element.**

This means:

- New functionality must be added **inside the current approved visual language**.
- Existing screens, cards, controls, spacing, typography, colors, gradients, icons, hierarchy, and compositions stay as they are unless the user gives a direct instruction such as: **“replace this element”, “redesign this screen”, “change this card”, or equivalent explicit approval for that exact part**.
- Requests such as **“add functionality”, “continue development”, “connect”, “implement”, “make it work”, “optimize”, “fix”, “integrate”, “add a section”, “add a feature”** are permission to extend behavior — **not permission to redesign existing UI**.
- When a new feature needs UI, reuse the existing design system, components, tokens, shapes, spacing, typography, icon language, gradients and interaction patterns.
- New controls should look as if they were always part of the current design.
- Do not remove, restyle, relocate, simplify, merge, reinterpret, or replace an existing approved element just because a new implementation would be easier that way.
- If implementation appears to require changing an existing approved element, keep it unchanged and ask the user for explicit approval before modifying it.
- Functional refactoring is allowed behind the UI as long as the visible approved result does not change unexpectedly.
- Bug fixes may correct broken rendering, clipping, responsiveness, accessibility, safe areas or clearly unintended behavior, but must preserve the approved visual intent.

### Explicit-change threshold

A design change is authorized only when the user clearly identifies the target and asks for its visual replacement/change. Examples:

- “Замени эту карточку.”
- “Переделай этот экран.”
- “Убери этот элемент.”
- “Измени цвет этой кнопки.”
- “Пересобери навигацию вот так.”

Without that level of explicit instruction, the default rule is: **preserve what already exists and add new functionality in the same style.**

## Approved Home reference

The approved Home/Puzzle layout is the compact dashboard version with:

1. profile/avatar + language control in the header;
2. two compact metric cards (“В норме” / “Вне нормы”);
3. gradient “Готовность аналитики” card;
4. “Требует внимания” card;
5. side-by-side “Загрузить анализ” and gradient “Подключить устройство” cards;
6. existing bottom navigation.

Do not replace this with a large editorial hero, oversized health ring, alternate navigation, or a different visual system unless the user explicitly requests it.

## Approved responsive-navigation exception — 16.08.2026

The user explicitly approved refinement of the navigation shell and responsive behavior across device sizes.

Allowed without further redesign approval:
- polish the desktop left sidebar while preserving the same destinations and icon language;
- adapt sidebar width, item sizing and spacing to desktop viewport width;
- adapt the existing mobile bottom navigation to narrow phones, regular phones and tablets;
- hide mobile tab labels only on extremely narrow screens when required to prevent clipping;
- respect device safe areas, orientation changes and small-screen text constraints;
- make profile/header controls compact when necessary for narrow devices.

This exception does **not** authorize rebuilding screen cards, gradients, content hierarchy, typography system or product flows. Those remain locked unless separately approved.
