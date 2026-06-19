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

interface BackEntry {
  id: string;
  priority: BackPriority;
  fn: () => boolean;
}

let _entries: BackEntry[] = [];
let _idSeq = 0;

/**
 * Register a back handler at the given priority level.
 * Returns a cleanup function — call it (or return it from useEffect) to deregister.
 *
 * Within the same priority level, the most-recently-registered handler wins.
 */
export function pushBackHandler(priority: BackPriority, fn: () => boolean): () => void {
  const id = `bh_${++_idSeq}`;
  _entries.push({ id, priority, fn });
  return () => { _entries = _entries.filter(e => e.id !== id); };
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
      if (handler.fn()) return true;
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

// ── React hook ───────────────────────────────────────────────────────────────

/**
 * Register a back handler while the component is mounted.
 * Auto-deregisters on unmount. Re-registers when deps change.
 *
 * @example
 *   useBackHandler('modal', () => {
 *     if (!isOpen) return false;
 *     setIsOpen(false);
 *     return true;
 *   }, [isOpen]);
 */
export function useBackHandler(
  priority: BackPriority,
  fn: () => boolean,
  deps: unknown[] = [],
): void {
  useEffect(() => {
    return pushBackHandler(priority, fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
