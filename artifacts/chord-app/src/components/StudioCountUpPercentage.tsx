import React, { useEffect, useRef, useState } from "react";

interface StudioCountUpPercentageProps {
  value: number; // raw value, can be 0-100 or 0-1 (we'll detect and handle both!)
  className?: string;
  style?: React.CSSProperties;
}

export default function StudioCountUpPercentage({
  value,
  className,
  style,
}: StudioCountUpPercentageProps) {
  // Gracefully handle values passed as decimal ratios (0 to 1) or percentage values (0 to 100)
  const isDecimal = value <= 1.05 && value > 0;
  const rawTarget = isDecimal ? value * 100 : value;
  const targetPct = Math.min(100, Math.max(0, Math.round(rawTarget)));

  const [currentPct, setCurrentPct] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const animationRef = useRef<number | null>(null);
  const renderedPctRef = useRef<number>(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setCurrentPct(targetPct);
      renderedPctRef.current = targetPct;
      return;
    }

    const startVal = renderedPctRef.current;
    const endVal = targetPct;
    if (startVal === endVal) {
      setCurrentPct(endVal);
      renderedPctRef.current = endVal;
      return;
    }

    const duration = 650; // Calming 650ms progress transition
    const startTime = performance.now();

    const animateCount = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Butter-smooth cubic ease-out curve
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const current = Math.round(startVal + (endVal - startVal) * easeOut);
      setCurrentPct(current);
      renderedPctRef.current = current;

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateCount);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animateCount);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetPct, reducedMotion]);

  return (
    <span className={className} style={{ fontFamily: "inherit", fontWeight: "inherit", ...style }}>
      {currentPct}
    </span>
  );
}
