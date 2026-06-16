import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { useChordStore } from '../store/useChordStore';

// Helper to check if reduced motion is preferred by the system or settings
export function usePrefersReducedMotion() {
  const { settings } = useChordStore();
  const speed = settings.animationSpeed;
  
  // If the user explicitly configured 'normal' or 'fast' in settings,
  // we prioritize that and play animations even if their OS/browser reports prefers-reduced-motion.
  if (speed === 'reduced') return true;
  if (speed === 'normal' || speed === 'fast') return false;

  return (
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

// Helper to check the animation duration speed coefficient
export function useAnimationSpeed() {
  const { settings } = useChordStore();
  const speed = settings.animationSpeed;
  return speed === 'fast' ? 0.6 : 1.0;
}

/**
 * 1. APP ENTRY TRANSITION
 * Wraps the outer frame of any app/panel. Animates scale, y, and opacity on mount.
 * Uses a premium, smooth slightly bouncy spring transition.
 */
export function AppEntryTransition({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const prefersReduced = usePrefersReducedMotion();
  const speedScale = useAnimationSpeed();

  if (prefersReduced) {
    return (
      <div className={className} style={{ width: '100%', height: '100%', ...style }}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16, scale: 0.972 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 120,
        damping: 14,
        mass: 0.85,
        velocity: 2,
        duration: 0.45 * speedScale,
      }}
      style={{
        width: '100%',
        height: '100%',
        ...style,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * 2. STAGGERED CONTENT REVEAL
 * Wraps any layout container (e.g. list, card grid, controls panel) and progressively
 * animates direct children using staggered index-based delays.
 */
export function StaggeredReveal({
  children,
  delayOffset = 0.05,
  staggerInterval = 45, // ms between items
  style,
  className,
}: {
  children: React.ReactNode;
  delayOffset?: number;
  staggerInterval?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const prefersReduced = usePrefersReducedMotion();
  const speedScale = useAnimationSpeed();
  const childrenArray = React.Children.toArray(children);

  if (prefersReduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div className={className} style={{ ...style, display: 'contents' }}>
      {childrenArray.map((child, index) => {
        if (!React.isValidElement(child)) return child;

        const childElement = child as React.ReactElement<any>;
        const delay = delayOffset + index * (staggerInterval / 1000) * speedScale;

        // Extract layout-affecting classes from the child (like col-span-2 or flex-1)
        // and forward them to the motion.div wrapper so grid and flex parents layout perfectly
        let wrapperClassName = "";
        if (childElement.props && childElement.props.className) {
          const classes = childElement.props.className.split(/\s+/);
          const layoutClasses = classes.filter((c: string) => 
            c.startsWith('col-span-') || 
            c.startsWith('row-span-') || 
            c.startsWith('flex-') || 
            c === 'grow' || 
            c === 'shrink'
          );
          if (layoutClasses.length > 0) {
            wrapperClassName = layoutClasses.join(' ');
          }
        }

        return (
          <motion.div
            key={index}
            className={wrapperClassName}
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 130,
              damping: 15,
              mass: 0.8,
              delay,
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              willChange: 'transform, opacity',
            }}
          >
            {child}
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * 3. TEXT ANIMATIONS (AnimatedAppHeader)
 * Main app headings with a gorgeous character reveal effect.
 * Uses inline-block splits to prevent page/line overflow and preserve text styling.
 */
export function AnimatedAppHeader({
  title,
  subtitle,
  titleClassName = "font-extrabold tracking-tighter leading-none mb-3",
  subtitleClassName = "",
  titleStyle = {},
  subtitleStyle = {},
  staggerInterval = 20, // ms per character
  delayOffset = 0.06,
}: {
  title: string;
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  titleStyle?: React.CSSProperties;
  subtitleStyle?: React.CSSProperties;
  staggerInterval?: number;
  delayOffset?: number;
}) {
  const prefersReduced = usePrefersReducedMotion();
  const speedScale = useAnimationSpeed();

  const mergedTitleStyle: React.CSSProperties = {
    fontFamily: 'Manrope, sans-serif',
    fontWeight: 900,
    fontSize: '2.6rem',
    color: 'var(--c-text-primary)',
    letterSpacing: '-0.04em',
    lineHeight: 1,
    marginTop: '12px',
    marginBottom: '8px',
    ...titleStyle,
  };

  const mergedSubtitleStyle: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    fontSize: '13px',
    color: 'var(--c-text-secondary)',
    marginTop: '4px',
    marginBottom: '24px',
    lineHeight: 1.4,
    ...subtitleStyle,
  };

  if (prefersReduced) {
    return (
      <>
        <h2 className={titleClassName} style={mergedTitleStyle}>{title}</h2>
        {subtitle && <p className={subtitleClassName} style={mergedSubtitleStyle}>{subtitle}</p>}
      </>
    );
  }

  const chars = title.split("");

  return (
    <>
      <h2
        className={titleClassName}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          overflow: 'hidden',
          lineHeight: '1.15',
          ...mergedTitleStyle,
        }}
      >
        {chars.map((char, index) => {
          const delay = delayOffset + index * (staggerInterval / 1000) * speedScale;

          return (
            <motion.span
              key={index}
              className="inline-block origin-bottom"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                type: 'spring',
                stiffness: 160,
                damping: 12,
                mass: 0.75,
                delay,
              }}
              style={{
                display: char === " " ? "inline" : "inline-block",
                marginRight: char === " " ? "0.25em" : 0,
              }}
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          );
        })}
      </h2>
      {subtitle && (
        <motion.p
          className={subtitleClassName}
          style={mergedSubtitleStyle}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 110,
            damping: 14,
            delay: delayOffset + Math.min(0.35, chars.length * (staggerInterval / 1000) * speedScale + 0.05),
          }}
        >
          {subtitle}
        </motion.p>
      )}
    </>
  );
}
