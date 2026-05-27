import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type HTMLMotionProps,
} from 'motion/react';

// ── Module-level intro signal ─────────────────────────────────────────────────
// StudioSolarIntro calls triggerIntroReveal() when it finishes (or is skipped).
// Any StudioTitleReveal mounted after that fires its sweep immediately.

let _introDone = false;
const INTRO_EVENT = 'studio-intro-done';

export function triggerIntroReveal(): void {
  _introDone = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(INTRO_EVENT));
  }
}

// ── DiaTextReveal core (ported from magicui.design/r/dia-text-reveal) ─────────

const DEFAULT_COLORS = ['#c679c4', '#fa3d1d', '#ffb005', '#e1e1fe', '#0358f7'];
const BAND_HALF = 17;
const SWEEP_START = -BAND_HALF;
const SWEEP_END = 100 + BAND_HALF;

const sweepEase = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

function buildGradient(pos: number, colors: string[], textColor: string) {
  const bandStart = pos - BAND_HALF;
  const bandEnd = pos + BAND_HALF;

  if (bandStart >= 100) {
    return `linear-gradient(90deg, ${textColor}, ${textColor})`;
  }

  const n = colors.length;
  const parts: string[] = [];

  if (bandStart > 0)
    parts.push(`${textColor} 0%`, `${textColor} ${bandStart.toFixed(2)}%`);

  colors.forEach((c, i) => {
    const pct = n === 1 ? pos : bandStart + (i / (n - 1)) * BAND_HALF * 2;
    parts.push(`${c} ${pct.toFixed(2)}%`);
  });

  if (bandEnd < 100)
    parts.push(`transparent ${bandEnd.toFixed(2)}%`, `transparent 100%`);

  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

function measureWidths(el: HTMLElement, texts: string[]) {
  const ghost = el.cloneNode() as HTMLElement;
  Object.assign(ghost.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: 'auto',
    whiteSpace: 'nowrap',
  });
  el.parentElement!.appendChild(ghost);
  const widths = texts.map(t => {
    ghost.textContent = t;
    return ghost.getBoundingClientRect().width;
  });
  ghost.remove();
  return widths;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface StudioTitleRevealProps
  extends Omit<
    HTMLMotionProps<'span'>,
    'ref' | 'children' | 'style' | 'animate' | 'transition' | 'color'
  > {
  text: string | string[];
  colors?: string[];
  /** Defaults to var(--c-text-primary) — white in dark mode, black in light. */
  textColor?: string;
  duration?: number;
  delay?: number;
  repeat?: boolean;
  repeatDelay?: number;
  /**
   * When true, sweep starts when element enters the viewport.
   * When false (default), sweep waits for the intro-done signal.
   */
  startOnView?: boolean;
  once?: boolean;
  fixedWidth?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudioTitleReveal({
  text,
  colors = DEFAULT_COLORS,
  textColor = 'var(--c-text-primary)',
  duration = 1.5,
  delay = 0,
  repeat = false,
  repeatDelay = 0.5,
  startOnView = false,
  once = true,
  className,
  fixedWidth = false,
  ...props
}: StudioTitleRevealProps) {
  const texts = Array.isArray(text) ? text : [text];
  const isMulti = texts.length > 1;
  const prefersReducedMotion = useReducedMotion();

  const spanRef = useRef<HTMLSpanElement>(null);
  const optsRef = useRef({ colors, textColor, duration, delay, repeat, repeatDelay, texts });
  optsRef.current = { colors, textColor, duration, delay, repeat, repeatDelay, texts };

  const indexRef = useRef(0);
  const hasPlayedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const playRef = useRef<() => void>(null!);
  const stopRef = useRef<(() => void) | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [measuredWidths, setMeasuredWidths] = useState<number[]>([]);

  const sweepPos = useMotionValue(SWEEP_START);
  const backgroundImage = useTransform(sweepPos, pos =>
    buildGradient(pos, optsRef.current.colors, optsRef.current.textColor),
  );

  const isInView = useInView(spanRef, { once, amount: 0.1 });

  useEffect(() => {
    const el = spanRef.current;
    if (!el || !isMulti) return;
    setMeasuredWidths(measureWidths(el, texts));
  }, [Array.isArray(text) ? text.join('\0') : text]);

  playRef.current = () => {
    const { duration, delay, repeat, repeatDelay, texts } = optsRef.current;
    sweepPos.set(SWEEP_START);
    const controls = animate(sweepPos, SWEEP_END, {
      duration,
      delay,
      ease: sweepEase,
      onComplete() {
        if (!repeat) return;
        timerRef.current = setTimeout(() => {
          const next = (indexRef.current + 1) % texts.length;
          indexRef.current = next;
          setActiveIndex(next);
          playRef.current();
        }, repeatDelay * 1000);
      },
    });
    stopRef.current = () => controls.stop();
  };

  useEffect(() => {
    // Reduced motion: skip to final state immediately.
    if (prefersReducedMotion) {
      sweepPos.set(SWEEP_END);
      return;
    }

    // startOnView mode: use in-view detection.
    if (startOnView) {
      if (!isInView) return;
      if (once && hasPlayedRef.current) return;
      hasPlayedRef.current = true;
      playRef.current();
      return () => { stopRef.current?.(); clearTimeout(timerRef.current); };
    }

    // Default mode: wait for studio-intro-done signal.
    // If it already fired (or intro was skipped/not shown), play immediately.
    if (_introDone) {
      if (once && hasPlayedRef.current) return;
      hasPlayedRef.current = true;
      playRef.current();
      return () => { stopRef.current?.(); clearTimeout(timerRef.current); };
    }

    // Safety: if the intro overlay is already gone from the DOM (e.g., the
    // component mounted after the intro finished without firing the event),
    // play immediately and mark done so future instances follow suit.
    if (typeof document !== 'undefined') {
      const introInDom = !!document.getElementById('intro') ||
                         !!document.querySelector('[data-solar-intro]');
      if (!introInDom) {
        _introDone = true;
        if (!(once && hasPlayedRef.current)) {
          hasPlayedRef.current = true;
          playRef.current();
        }
        return () => { stopRef.current?.(); clearTimeout(timerRef.current); };
      }
    }

    const handler = () => {
      if (once && hasPlayedRef.current) return;
      hasPlayedRef.current = true;
      playRef.current();
    };

    // Hard safety net: if the intro-done event never fires (e.g., the intro
    // was removed without dispatching, or the page loaded in a weird state),
    // play the sweep after a maximum wait so the text never stays invisible.
    const safetyTimer = setTimeout(() => {
      if (!hasPlayedRef.current) {
        _introDone = true;
        hasPlayedRef.current = true;
        playRef.current();
      }
    }, 10_000);

    window.addEventListener(INTRO_EVENT, handler, { once: true });
    return () => {
      window.removeEventListener(INTRO_EVENT, handler);
      clearTimeout(safetyTimer);
      stopRef.current?.();
      clearTimeout(timerRef.current);
    };
  }, [isInView, startOnView, once, prefersReducedMotion, sweepPos]);

  const fixedW =
    isMulti && fixedWidth && measuredWidths.length > 0
      ? Math.max(...measuredWidths)
      : undefined;

  const animatedW =
    isMulti && !fixedWidth && measuredWidths[activeIndex] != null
      ? measuredWidths[activeIndex]
      : undefined;

  return (
    <motion.span
      ref={spanRef}
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'bottom',
        lineHeight: 'inherit',
        transform: 'translateY(-1px)',
        color: 'transparent',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        backgroundSize: '100% 100%',
        backgroundImage,
        ...(isMulti && {
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          ...(fixedW != null && { width: fixedW }),
        }),
      }}
      animate={animatedW != null ? { width: animatedW } : undefined}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      {...props}
    >
      {texts[activeIndex]}
    </motion.span>
  );
}
