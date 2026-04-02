import { useState, useEffect, useRef } from 'react';

// Module-level pub/sub so any panel can hide/show the nav without touching the store
let _hidden = false;
let _locked = false; // when true, nav stays hidden regardless of scroll
const _listeners = new Set<(h: boolean) => void>();

/** Lock prevents scroll handlers from showing the nav (used inside preset editor) */
export function setNavLocked(locked: boolean) {
  _locked = locked;
}

export function setNavHidden(hidden: boolean) {
  // If locked, scroll cannot un-hide the nav
  if (_locked && !hidden) return;
  if (_hidden === hidden) return;
  _hidden = hidden;
  _listeners.forEach(fn => fn(hidden));
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
