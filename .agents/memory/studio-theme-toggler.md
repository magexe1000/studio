---
name: StudioThemeToggler animation contract
description: How StudioThemeToggler hooks into the existing App.tsx theme system without double-transitioning.
---

## Rule
DOM classes must be applied synchronously inside `startViewTransition → flushSync`. The `onChange` (zustand) call goes in `transition.finished.finally`, not inside flushSync.

## Why
App.tsx has a `useEffect` watching `activeVis.theme / activeVis.amoledMode` that adds `.theme-transitioning` and re-applies classes. If onChange fires inside flushSync, React re-renders synchronously, the useEffect fires mid-transition and adds `.theme-transitioning`, causing conflicting CSS transitions. Deferring to `finally` means App.tsx's effect runs after the clip-path animation completes — by then the classes are already correct, so the property transitions from `.theme-transitioning` are no-ops (values already at target).

## How to apply
Any future component that animates theme switching should follow the same pattern:
1. `applyThemeClasses(theme, amoled)` inside `flushSync` → drives the animation snapshot
2. `onChange(theme, amoled)` in `transition.finished.finally` → syncs zustand
3. If View Transitions API absent: apply classes + call onChange immediately (no-op fallback)

## CSS required (already in index.css)
```css
[data-studio-theme-vt="active"] ::view-transition-group(root) { animation-duration: var(--studio-theme-vt-duration, 380ms); }
[data-studio-theme-vt="active"] ::view-transition-old(root)   { animation: none; z-index: 1; }
[data-studio-theme-vt="active"] ::view-transition-new(root)   { clip-path: var(--studio-theme-vt-clip-from); animation: none; opacity: 1; z-index: 2; }
```
