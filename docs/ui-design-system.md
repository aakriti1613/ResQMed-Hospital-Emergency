# UI design system (ResQMed)

Goal: **astonishing UI** that remains **calm, legible, and panic-safe** during emergencies.

## Layout principles

- **Two-mode mental model**: `Book Care` vs `SOS` (top tabs + bottom nav).
- **SOS is panic-safe**: minimal choices, large tap targets, strong contrast, no clutter.
- **Mobile-first**: every primary action is reachable by thumb; cards are stacked and readable.

## Visual language

- **Core palette**
  - Background: `slate-950`
  - Surfaces: `white/5`, `slate-950/40`
  - Care accent: violet
  - SOS accent: rose
  - Success: emerald
  - Warning: amber
- **Depth**
  - Subtle borders: `border-white/10`
  - Glow accents only for SOS + primary CTAs
- **Typography**
  - Headlines: heavy/black
  - Body: short sentences, high contrast, comfortable line-height

## Components (MVP set)

- **Button**
  - Variants: `primary`, `secondary`, `danger`, `ghost`
  - Sizes: `sm`, `md`, `lg`
- **Card**
  - Variants: `surface`, `gradient`, `danger`
- **Badge**
  - Variants: `primary`, `danger`, `success`, `muted`

## Motion rules (Framer Motion)

- Use motion to clarify hierarchy: **enter fades**, subtle **y** shifts, no distracting loops.
- SOS button can pulse **only before confirmation**; do not animate text during countdown.

## Accessibility

- Minimum 44px tap targets.
- Avoid relying on color alone for severity; use labels + icons.
- Respect reduced-motion preferences (later: `prefers-reduced-motion` hook).

