import { useState, useEffect, useRef } from 'react';

// ─── navHidden — programmatic full-hide (preset editor, modals, etc.) ────────
let _hidden = false;
let _locked = false;
const _listeners = new Set<(h: boolean) => void>();

const AUTO_SHOW_MS = 4000;
let _autoShowTimer: ReturnType<typeof setTimeout> | null = null;

function clearAutoShow() {
  if (_autoShowTimer) { clearTimeout(_autoShowTimer); _autoShowTimer = null; }
}
function emit(hidden: boolean) { _listeners.forEach(fn => fn(hidden)); }

export function setNavLocked(locked: boolean) {
  if (_locked === locked) return;
  _locked = locked;
  if (!locked) {
    clearAutoShow();
    if (_hidden) { _hidden = false; emit(false); }
    // Also un-collapse when unlocking so the bar is always reachable.
    if (_collapsed) { _collapsed = false; emitCollapsed(false); }
  }
}

export function setNavHidden(hidden: boolean) {
  if (_locked && !hidden) return;
  clearAutoShow();
  if (hidden && !_locked) {
    _autoShowTimer = setTimeout(() => {
      _autoShowTimer = null;
      if (_locked || !_hidden) return;
      _hidden = false;
      emit(false);
    }, AUTO_SHOW_MS);
  }
  if (_hidden === hidden) return;
  _hidden = hidden;
  emit(hidden);
}

export function resetNav() {
  clearAutoShow();
  _locked = false;
  if (_hidden)    { _hidden    = false; emit(false); }
  if (_collapsed) { _collapsed = false; emitCollapsed(false); }
}

export function useNavHidden(): boolean {
  const [hidden, setHidden] = useState(_hidden);
  useEffect(() => {
    _listeners.add(setHidden);
    return () => { _listeners.delete(setHidden); };
  }, []);
  return hidden;
}

// ─── navCollapsed — scroll-driven collapse to a floating pill/circle ─────────
// Driven by useScrollHide. Separate from navHidden so preset-editor hides
// never interfere with the scroll-collapse visual.
let _collapsed = false;
const _collapsedListeners = new Set<(c: boolean) => void>();

function emitCollapsed(c: boolean) { _collapsedListeners.forEach(fn => fn(c)); }

export function setNavCollapsed(collapsed: boolean) {
  if (_locked && !collapsed) return;
  if (_collapsed === collapsed) return;
  _collapsed = collapsed;
  emitCollapsed(collapsed);
}

export function useNavCollapsed(): boolean {
  const [c, setC] = useState(_collapsed);
  useEffect(() => {
    _collapsedListeners.add(setC);
    return () => { _collapsedListeners.delete(setC); };
  }, []);
  return c;
}

// ─── useScrollHide — attach to any scrollable container ──────────────────────
// On scroll-down → collapse the nav to a floating circle (setNavCollapsed).
// On scroll-up or near top → expand back.
// Callers that need a full programmatic hide should use setNavHidden() directly.
export function useScrollHide(ref: React.RefObject<HTMLElement | null>) {
  const lastY = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      if (y < 30) { setNavCollapsed(false); lastY.current = y; return; }
      const dy = y - lastY.current;
      if (Math.abs(dy) < 6) return;
      setNavCollapsed(dy > 0);
      lastY.current = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
}
