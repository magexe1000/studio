/**
 * StudioProgressBar — animate-ui radix/progress implemented exactly.
 *
 * Official source: https://animate-ui.com/docs/components/radix/progress
 *
 * Primitive layer:
 *   - `ProgressRoot`      — overflow:hidden track + ARIA progressbar + context
 *   - `ProgressIndicator` — motion.div spring-animated on x: `-${100-value}%`
 *     Default spring: stiffness 100, damping 30  (matches animate-ui exactly)
 *
 * Styled component:
 *   - `StudioProgressBar`  — drop-in replacement for AnimatedProgressBar
 *     · value: 0-100  (Radix/animate-ui convention)
 *     · accentFrom / accentTo  — CSS strings, safe with color-mix
 *     · height  — px, default 6
 *     · Shimmer overlay on the indicator (preserved from original)
 */

import { createContext, useContext } from 'react';
import { motion } from 'motion/react';
import type { MotionProps, Transition } from 'motion/react';

// ── Primitive: context ────────────────────────────────────────────────────

type ProgressContextType = { value: number };

const ProgressContext = createContext<ProgressContextType | null>(null);

function useProgress(): ProgressContextType {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressRoot');
  return ctx;
}

// ── Primitive: root ───────────────────────────────────────────────────────

type ProgressRootProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
  max?: number;
  children?: React.ReactNode;
};

function ProgressRoot({
  value = 0,
  max = 100,
  children,
  style,
  ...props
}: ProgressRootProps) {
  const clamped = Math.max(0, Math.min(max, value));
  return (
    <ProgressContext.Provider value={{ value: clamped }}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        data-slot="progress"
        style={{ overflow: 'hidden', ...style }}
        {...props}
      >
        {children}
      </div>
    </ProgressContext.Provider>
  );
}

// ── Primitive: motion indicator ───────────────────────────────────────────

type ProgressIndicatorProps = Omit<MotionProps, 'animate'> &
  React.HTMLAttributes<HTMLDivElement> & {
    transition?: Transition;
  };

function ProgressIndicator({
  transition = { type: 'spring', stiffness: 100, damping: 30 },
  style,
  ...props
}: ProgressIndicatorProps) {
  const { value } = useProgress();

  return (
    <motion.div
      data-slot="progress-indicator"
      animate={{ x: `-${100 - value}%` }}
      transition={transition}
      style={{ width: '100%', height: '100%', ...style }}
      {...props}
    />
  );
}

// ── Styled component ──────────────────────────────────────────────────────

export interface StudioProgressBarProps {
  /** 0–100 (matches Radix / animate-ui convention) */
  value: number;
  accentFrom?: string;
  accentTo?: string;
  height?: number;
  /** Override spring defaults */
  transition?: Transition;
  className?: string;
  style?: React.CSSProperties;
}

export default function StudioProgressBar({
  value,
  accentFrom = 'var(--accent-from, #679cff)',
  accentTo = 'var(--accent-to, #007aff)',
  height = 6,
  transition,
  style,
}: StudioProgressBarProps) {
  return (
    <ProgressRoot
      value={value}
      style={{
        position: 'relative',
        height,
        borderRadius: 9999,
        background: 'rgba(128,128,128,0.15)',
        ...style,
      }}
    >
      <ProgressIndicator
        transition={transition}
        style={{
          borderRadius: 9999,
          background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Shimmer — runs while downloading, invisible at 100% (covered) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'spb-shimmer 1.6s linear infinite',
            borderRadius: 9999,
          }}
        />
      </ProgressIndicator>
      <style>{`
        @keyframes spb-shimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }
      `}</style>
    </ProgressRoot>
  );
}

// Re-export primitives for custom compositions
export { ProgressRoot, ProgressIndicator, useProgress };
export type { ProgressRootProps, ProgressIndicatorProps, ProgressContextType };
