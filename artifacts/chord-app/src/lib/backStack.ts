// Global back navigation stack with priority levels.
// Multiple handlers can be registered; the highest-priority active one wins.
// Falls back to App-level exit logic (double-press to exit) when nothing handles the event.
//
// Priority order (highest first):
//   modal > sheet > overlay > nested > panel
//
// Usage:
//   // Functional registration (returns cleanup):
//   const cleanup = pushBackHandler('modal', () => { closeModal(); return true; });
//   return cleanup; // inside useEffect
//
//   // React hook:
//   useBackHandler('sheet', () => { if (open) { setOpen(false); return true; } return false; });

import { useEffect } from 'react';

export type BackPriority = 'modal' | 'sheet' | 'overlay' | 'nested' | 'panel';

const PRIORITY_ORDER: BackPriority[] = ['modal', 'sheet', 'overlay', 'nested', 'panel'];

export interface BackEntry {
  id: string;
  priority: BackPriority;
  app?: string;
  view?: string;
  fn: () => boolean;
}

let _entries: BackEntry[] = [];
let _idSeq = 0;

/**
 * Register a back handler at the given priority level.
 * Context parameters `app` and `view` are optional and provide context for gestures.
 * Returns a cleanup function — call it (or return it from useEffect) to deregister.
 */
export function pushBackHandler(
  priority: BackPriority,
  fn: () => boolean,
): () => void;
export function pushBackHandler(
  priority: BackPriority,
  app: string,
  view: string,
  fn: () => boolean,
): () => void;
export function pushBackHandler(
  priority: BackPriority,
  arg2: string | (() => boolean),
  arg3?: string,
  arg4?: () => boolean,
): () => void {
  const id = `bh_${++_idSeq}`;
  let app: string | undefined;
  let view: string | undefined;
  let fn: () => boolean;

  if (typeof arg2 === 'function') {
    fn = arg2;
  } else {
    app = arg2;
    view = arg3;
    fn = arg4!;
  }

  _entries.push({ id, priority, app, view, fn });
  return () => { _entries = _entries.filter(e => e.id !== id); };
}

export function triggerBackFeedbackAnimation(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('predictive-back-press-active');
  void root.offsetHeight; // Force reflow
  root.classList.add('predictive-back-press-active');
  setTimeout(() => {
    root.classList.remove('predictive-back-press-active');
  }, 285);
}

/**
 * Try all registered handlers from highest to lowest priority.
 * Returns true if any handler consumed the back event.
 */
export function handleGlobalBack(): boolean {
  for (const priority of PRIORITY_ORDER) {
    const matching = _entries.filter(e => e.priority === priority);
    if (matching.length > 0) {
      const handler = matching[matching.length - 1];
      if (handler.fn()) {
        triggerBackFeedbackAnimation();
        return true;
      }
    }
  }
  return false;
}

// ── Backward-compatible API ──────────────────────────────────────────────────
// Existing panels use setBackHandler(fn) / setBackHandler(null).
// These are mapped to 'panel' priority to preserve existing behavior.

let _legacyCleanup: (() => void) | null = null;

export function setBackHandler(fn: (() => boolean) | null): void {
  _legacyCleanup?.();
  _legacyCleanup = null;
  if (fn) _legacyCleanup = pushBackHandler('panel', fn);
}

// ── React hooks & Helpers ───────────────────────────────────────────────────

/** Get the top-most active back handler. */
export function getTopBackEntry(): BackEntry | null {
  for (const priority of PRIORITY_ORDER) {
    const matching = _entries.filter(e => e.priority === priority);
    if (matching.length > 0) {
      return matching[matching.length - 1];
    }
  }
  return null;
}

/**
 * Register a back handler while the component is mounted.
 * Auto-deregisters on unmount. Re-registers when deps change.
 */
export function useBackHandler(
  priority: BackPriority,
  fn: () => boolean,
  deps?: unknown[],
): void;
export function useBackHandler(
  priority: BackPriority,
  app: string,
  view: string,
  fn: () => boolean,
  deps?: unknown[],
): void;
export function useBackHandler(
  priority: BackPriority,
  arg2: string | (() => boolean),
  arg3?: string | unknown[],
  arg4?: () => boolean,
  arg5?: unknown[],
): void {
  let app: string | undefined;
  let view: string | undefined;
  let fn: () => boolean;
  let deps: unknown[] = [];

  if (typeof arg2 === 'function') {
    fn = arg2;
    deps = (arg3 as unknown[]) ?? [];
  } else {
    app = arg2;
    view = arg3 as string;
    fn = arg4!;
    deps = arg5 ?? [];
  }

  useEffect(() => {
    return pushBackHandler(priority, app!, view!, fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Check if there are active registered back handlers. */
export function hasBackEntries(): boolean {
  return _entries.length > 0;
}
