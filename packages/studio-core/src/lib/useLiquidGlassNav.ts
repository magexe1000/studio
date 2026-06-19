import { useEffect, useMemo } from 'react';
import {
  enableLiquidGlass,
  tagLiquidTarget,
  untagLiquidTarget,
  liquidGlassPlatformSupported,
} from './liquidGlass';

/**
 * Wire a bottom-nav element into the shared liquid-glass filter. The hook:
 *   • Lazy-injects the SVG filter on first mount when the platform supports
 *     `backdrop-filter`.
 *   • Tags the element with `.liquidGL-nav` so the filter applies.
 *   • Drives a scroll-coupled `--lg-shine-x` CSS variable so the specular
 *     streak slides across the bar as the user scrolls — mirrors the
 *     parallax shine in Kyant0/AndroidLiquidGlass.
 *   • Removes the tag on unmount.
 *
 * No re-snapshot logic is needed — the filter is GPU-evaluated against the
 * live page background every frame, so theme/panel/app changes Just Work.
 */
export function useLiquidGlassNav(ref: React.RefObject<HTMLElement | null>) {
  const platformOk = useMemo(() => liquidGlassPlatformSupported(), []);
  const reduceMotion = useMemo(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !platformOk) return;
    enableLiquidGlass();
    tagLiquidTarget(el);

    // Scroll-driven shine. Suppressed when reduce-motion is on, but the glass
    // visual itself is always shown (that's a static effect, not an animation).
    let shine = 50;            // current shine position in %
    let target = 50;           // target position the shine eases toward
    let rafId: number | null = null;
    let idleTimer: number | null = null;
    let disposed = false;

    // Skip the scroll-animation wiring entirely if reduced motion is preferred.
    if (reduceMotion) {
      el.style.setProperty('--lg-shine-x', '50%');
      return () => { untagLiquidTarget(el); };
    }

    const tick = () => {
      if (disposed) { rafId = null; return; }
      shine += (target - shine) * 0.18;
      el.style.setProperty('--lg-shine-x', shine.toFixed(2) + '%');
      if (Math.abs(target - shine) > 0.2) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };

    const handleDelta = (dy: number) => {
      if (disposed) return;
      target = Math.max(10, Math.min(90, target + dy * 0.4));
      if (rafId === null) rafId = requestAnimationFrame(tick);
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        target = 50;
        if (!disposed && rafId === null) rafId = requestAnimationFrame(tick);
      }, 220);
    };

    let lastWindowY = window.scrollY;
    const onWindowScroll = () => {
      const y = window.scrollY;
      handleDelta(y - lastWindowY);
      lastWindowY = y;
    };
    window.addEventListener('scroll', onWindowScroll, { passive: true });

    // Find nearest scrollable ancestor (NOT including the nav itself, which
    // is fixed-positioned and doesn't scroll the page).
    let attachedScroller: Element | null = null;
    let lastScrollerTop = 0;
    let walk: Element | null = el.parentElement;
    while (walk && walk !== document.body) {
      const cs = getComputedStyle(walk);
      if (/(auto|scroll)/.test(cs.overflowY) && walk.scrollHeight > walk.clientHeight) {
        attachedScroller = walk;
        lastScrollerTop = walk.scrollTop;
        break;
      }
      walk = walk.parentElement;
    }
    const onScrollerScroll = (e: Event) => {
      const t = e.currentTarget as Element;
      const top = t.scrollTop;
      handleDelta(top - lastScrollerTop);
      lastScrollerTop = top;
    };
    if (attachedScroller) {
      attachedScroller.addEventListener('scroll', onScrollerScroll, { passive: true });
    }

    return () => {
      disposed = true;
      window.removeEventListener('scroll', onWindowScroll);
      if (attachedScroller) attachedScroller.removeEventListener('scroll', onScrollerScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (idleTimer !== null) clearTimeout(idleTimer);
      untagLiquidTarget(el);
    };
  }, [ref, platformOk]);
}
