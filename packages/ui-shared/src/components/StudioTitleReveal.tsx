import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

// ── Module-level intro signal ─────────────────────────────────────────────────
// StudioSolarIntro calls triggerIntroReveal() when it finishes (or is skipped).
// Any StudioTitleReveal mounted after that fires its animation immediately.

let _introDone = false;
const INTRO_EVENT = 'studio-intro-done';

export function triggerIntroReveal(): void {
  _introDone = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(INTRO_EVENT));
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface StudioTitleRevealProps {
  text: string | string[];
  className?: string;
  style?: React.CSSProperties;
  /**
   * Duration of each character's tween in seconds.
   * @default 0.72
   */
  duration?: number;
  /**
   * Stagger delay between characters in milliseconds.
   * @default 58
   */
  delay?: number;
  /**
   * GSAP ease string.
   * @default "power3.out"
   */
  ease?: string;
  /**
   * When true, animation triggers on scroll-into-view instead of the intro signal.
   * @default false
   */
  startOnView?: boolean;
  onComplete?: () => void;
}

// ── Component (official reactbits.dev/text-animations/split-text, adapted) ───

export default function StudioTitleReveal({
  text,
  className,
  style,
  duration = 0.72,
  delay = 58,
  ease = 'power3.out',
  startOnView = false,
  onComplete,
}: StudioTitleRevealProps) {
  const displayText = Array.isArray(text) ? text[0] : text;
  const ref = useRef<HTMLSpanElement>(null);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced-motion: skip to final state, no animation.
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      gsap.set(el, { opacity: 1 });
      onComplete?.();
      return;
    }

    // ── Official SplitText setup (reactbits.dev implementation) ──────────────
    const split = new SplitText(el, { type: 'chars' });
    const targets = split.chars;

    if (!targets || targets.length === 0) {
      gsap.set(el, { opacity: 1 });
      onComplete?.();
      return () => { split.revert(); };
    }

    // GPU acceleration + initial hidden state
    gsap.set(targets, { willChange: 'transform, opacity', opacity: 0, y: 20 });

    let tween: gsap.core.Tween | null = null;
    let io: IntersectionObserver | null = null;
    let safetyTimer: any = null;

    function play() {
      if (hasPlayedRef.current) return;
      hasPlayedRef.current = true;

      tween = gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration,
        ease,
        stagger: delay / 1000,
        onComplete() {
          gsap.set(targets, { willChange: 'auto' });
          onComplete?.();
        },
      });
    }

    const handler = () => play();

    // ── startOnView mode: IntersectionObserver ────────────────────────────────
    if (startOnView) {
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) { play(); observer.disconnect(); } },
        { threshold: 0.1 },
      );
      io = observer;
      observer.observe(el);
    } else {
      // ── Default mode: wait for studio-intro-done signal ───────────────────────
      if (_introDone || (typeof window !== 'undefined' && (window as any).__introDone)) {
        play();
      } else if (
        typeof document !== 'undefined' &&
        !document.getElementById('intro') &&
        !document.querySelector('[data-solar-intro]')
      ) {
        _introDone = true;
        play();
      } else {
        // Hard safety net: if the intro-done event never fires, show text after 3.5s.
        safetyTimer = setTimeout(() => {
          if (!hasPlayedRef.current) {
            _introDone = true;
            play();
          }
        }, 3_500);

        window.addEventListener(INTRO_EVENT, handler, { once: true });
      }
    }

    return () => {
      if (io) {
        io.disconnect();
      }
      window.removeEventListener(INTRO_EVENT, handler);
      if (safetyTimer) {
        clearTimeout(safetyTimer);
      }
      if (tween) {
        tween.kill();
      }
      if (targets && targets.length > 0) {
        gsap.killTweensOf(targets);
      }
      split.revert();
    };
  }, [displayText]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: 'inline-block', lineHeight: 'inherit', ...style }}
    >
      {displayText}
    </span>
  );
}
