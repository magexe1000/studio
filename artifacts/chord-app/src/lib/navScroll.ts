import { useState, useEffect, useRef } from 'react';

// Module-level pub/sub so any panel can hide/show the nav without touching the store
let _hidden = false;
let _locked = false; // when true, nav stays hidden regardless of scroll
const _listeners = new Set<(h: boolean) => void>();

// Safety net: if the nav is hidden for longer than this without anything
// re-asserting the hide (e.g. another scroll event), auto-show it. This
// guarantees the user can never get stuck without a way to navigate.
const AUTO_SHOW_MS = 4000;
let _autoShowTimer: ReturnType<typeof setTimeout> | null = null;

function clearAutoShow() {
  if (_autoShowTimer) {
    clearTimeout(_autoShowTimer);
    _autoShowTimer = null;
  }
}

function emit(hidden: boolean) {
  _listeners.forEach(fn => fn(hidden));
}

/** Lock prevents scroll handlers from showing the nav (used inside preset editor) */
export function setNavLocked(locked: boolean) {
  if (_locked === locked) return;
  _locked = locked;
  // When unlocking, always reveal the nav so the user can never get stuck
  // with a hidden+locked state lingering from a previous screen.
  if (!locked && _hidden) {
    clearAutoShow();
    _hidden = false;
    emit(false);
  }
}

export function setNavHidden(hidden: boolean) {
  // If locked, scroll cannot un-hide the nav
  if (_locked && !hidden) return;

  // (Re)arm the safety timer on EVERY hide call — even if state didn't
  // actually change. While the user keeps scrolling, every scroll event
  // refreshes the timer, so the nav stays hidden. As soon as scrolling
  // stops, the timer fires and reveals the nav after AUTO_SHOW_MS.
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

/** Force the nav into a clean visible state. Use on screen transitions
 *  (e.g. exiting a lockdown / modal flow) to guarantee no stale hidden
 *  state survives. */
export function resetNav() {
  clearAutoShow();
  _locked = false;
  if (_hidden) {
    _hidden = false;
    emit(false);
  }
}

/** Subscribe to nav visibility changes — call from BottomNav */
export function useNavHidden(): boolean {
  const [hidden, setHidden] = useState(_hidden);
  useEffect(() => {
    _listeners.add(setHidden);
    return () => { _listeners.delete(setHidden); };
  }, []);
  return hidden;
}

/** Attach to a scrollable element — hides nav on scroll down, shows on scroll up */
export function useScrollHide(ref: React.RefObject<HTMLElement | null>) {
  const lastY = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      if (y < 30) { setNavHidden(false); lastY.current = y; return; }
      const dy = y - lastY.current;
      if (Math.abs(dy) < 6) return;
      setNavHidden(dy > 0);
      lastY.current = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
}
