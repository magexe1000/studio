import { useRef, useState } from 'react';

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
 * No useCallback/useEffect to avoid stale closure / infinite-render issues.
 * Thumb springs up on grab (scale 1.35, brief glow).
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
  const isDragging = useRef(false);
  const [dragging, setDragging] = useState(false);

  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  function snap(v: number): number {
    const clamped = Math.max(min, Math.min(max, v));
    if (step <= 0) return clamped;
    const snapped = Math.round((clamped - min) / step) * step + min;
    return parseFloat(Math.max(min, Math.min(max, snapped)).toFixed(10));
  }

  function fromPointer(clientX: number): number {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return snap(min + ratio * (max - min));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    setDragging(true);
    const v = fromPointer(e.clientX);
    if (v !== value) onChange(v);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current || disabled) return;
    const v = fromPointer(e.clientX);
    if (v !== value) onChange(v);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDragging.current = false;
    setDragging(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    const s = step || (max - min) / 100;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(snap(value + s)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(snap(value - s)); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(min); }
    else if (e.key === 'End') { e.preventDefault(); onChange(max); }
  }

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
      onKeyDown={onKeyDown}
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
      <div style={{
        position: 'absolute', left: 0, right: 0,
        height: 4, borderRadius: 9999,
        background: trackColor, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`, borderRadius: 9999, background: accentColor,
          transition: dragging ? 'none' : 'width 60ms ease-out',
        }} />
      </div>

      {/* Thumb */}
      <div style={{
        position: 'absolute',
        left: `${pct}%`,
        transform: `translateX(-50%) scale(${dragging ? 1.35 : 1})`,
        width: 16, height: 16, borderRadius: '50%',
        background: accentColor,
        boxShadow: dragging
          ? `0 0 0 5px color-mix(in srgb, ${accentColor} 20%, transparent), 0 2px 6px rgba(0,0,0,0.25)`
          : '0 1px 4px rgba(0,0,0,0.25)',
        transition: 'transform 160ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 160ms ease',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
