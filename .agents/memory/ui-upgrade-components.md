---
name: UI upgrade components
description: Three shared components added for the 5 UI/UX upgrades; which surfaces use each one
---

## AnimatedBorderButton
`src/components/AnimatedBorderButton.tsx`
Wraps any button with the existing `gb-border-ring` rotating gradient border trail.
Uses CSS `@property --gb-angle` / `gb-spin` already in `index.css` — no new CSS needed.
Speed controlled via `speed` prop (seconds, default 4). `wrapStyle` spreads onto wrapper div.

**Used on:**
- Generate Progression — `ProgressionGenerator.tsx`
- Update Now — `UpdateIndicator.tsx` (UpdateModal)
- Email Sign In / Register — `AccountCard.tsx`
- Start Recording — `LabPanel.tsx`

## AppSpinner
`src/components/AppSpinner.tsx`
SVG arc spinner (270° arc, smooth rotate). Replaces `progress_activity` + `check-spin`/`sync-spin` CSS pattern.
Props: `size` (default 20), `color` (default `--accent-from`), `strokeWidth` (default 2.5).

**Used on:**
- OTA checking indicator — `UpdateIndicator.tsx`
- Downloading state in Update Now button — `UpdateIndicator.tsx`
- Sync icon when isSyncing — `AccountCard.tsx`
- Email login submit busy state — `AccountCard.tsx`

## ElasticSlider
`src/components/ElasticSlider.tsx`
Pointer-event custom slider. Thumb springs to scale(1.35) on drag (cubic-bezier spring back).
Filled track in accent color. Keyboard accessible (arrow/home/end).
Props: `min/max/step/value/onChange/accentColor/trackColor/disabled/style`.

**Used on:**
- SliderRow (volume, stem, etc.) — `GroovexPreferences.tsx`
- Volume slider per layer — `LabPanel.tsx` MixerView
- Pan slider per layer — `LabPanel.tsx` MixerView

## Theme toggler animation (StudioHub.tsx)
No new component — enhanced in place.
Active button: `scale(1.04)` spring transform + `drop-shadow` glow on icon.
Dynamic row: `scale(1.02)` when active.
Transition: `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring overshoot).
