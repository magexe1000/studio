import { useRef, useState, useCallback, useEffect } from 'react';

interface ElasticSliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  accentColor?: string;
  trackColor?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Elastic slider — custom pointer-event based range input.
 * Features:
 *  - Thumb springs up on grab (scale 1.35, brief glow)
 *  - Filled track portion shown in accent color
 *  - Smooth touch interaction, no lag
 *  - Values and logic are identical to a standard <input type="range">
 */
export default function ElasticSlider({
  min = 0,
  max = 1,
  step = 0.01,
  value,
  onChange,
  accentColor = 'var(--accent-from, #679cff)',
  trackColor = 'var(--app-surface-high, rgba(128,128,128,0.22))',
  disabled = false,
  className,
  style,
}: ElasticSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const snapToStep = useCallback(
    (v: number) => {
      if (step <= 0) return clamp(v);
      const snapped = Math.round((v - min) / step) * step + min;
      return clamp(parseFloat(snapped.toFixed(10)));
    },
    [min, max, step],
  );

  const pct = ((value - min) / (max - min)) * 100;

  const valueFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return value;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return snapToStep(min + ratio * (max - min));
    },
    [min, max, snapToStep, value],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      const newVal = valueFromPointer(e.clientX);
      if (newVal !== value) onChange(newVal);
    },
    [disabled, valueFromPointer, value, onChange],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || disabled) return;
      const newVal = valueFromPointer(e.clientX);
      if (newVal !== value) onChange(newVal);
    },
    [dragging, disabled, valueFromPointer, value, onChange],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDragging(false);
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;
    const preventScroll = (e: TouchEvent) => e.preventDefault();
    window.addEventListener('touchmove', preventScroll, { passive: false });
    return () => window.removeEventListener('touchmove', preventScroll);
  }, [dragging]);

  const trackHeight = 4;
  const thumbSize = dragging ? 20 : 16;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (disabled) return;
        const stepSize = step || (max - min) / 100;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          onChange(snapToStep(clamp(value + stepSize)));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          onChange(snapToStep(clamp(value - stepSize)));
        } else if (e.key === 'Home') {
          e.preventDefault();
          onChange(min);
        } else if (e.key === 'End') {
          e.preventDefault();
          onChange(max);
        }
      }}
      style={{
        position: 'relative',
        height: 28,
        display: 'flex',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        opacity: disabled ? 0.4 : 1,
        outline: 'none',
        ...style,
      }}
    >
      {/* Track background */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: trackHeight,
          borderRadius: 9999,
          background: trackColor,
          overflow: 'hidden',
        }}
      >
        {/* Filled portion */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            borderRadius: 9999,
            background: accentColor,
            transition: dragging ? 'none' : 'width 80ms ease-out',
          }}
        />
      </div>

      {/* Thumb */}
      <div
        style={{
          position: 'absolute',
          left: `${pct}%`,
          transform: `translateX(-50%) scale(${dragging ? 1.35 : 1})`,
          width: thumbSize,
          height: thumbSize,
          borderRadius: '50%',
          background: accentColor,
          boxShadow: dragging
            ? `0 0 0 6px color-mix(in srgb, ${accentColor} 22%, transparent), 0 2px 8px rgba(0,0,0,0.28)`
            : '0 1px 4px rgba(0,0,0,0.28)',
          transition: 'transform 180ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 180ms ease, width 180ms ease, height 180ms ease',
          flexShrink: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
