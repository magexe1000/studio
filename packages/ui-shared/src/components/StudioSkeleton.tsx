import React from 'react';

// ── GLOBAL RESUSABLE SKELETON WIDGETS ─────────────────────────────────────────

export function StudioSkeletonCard({
  height = 120,
  borderRadius = '1.25rem',
  style,
}: {
  height?: number | string;
  borderRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="studio-shimmer"
      style={{
        width: '100%',
        height,
        borderRadius,
        border: '1px solid rgba(128,128,128,0.07)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        boxSizing: 'border-box',
        ...style,
      }}
    />
  );
}

export function StudioSkeletonRow({
  circleSize = 40,
  circleRadius = '50%',
  style,
}: {
  circleSize?: number;
  circleRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        className="studio-shimmer"
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: circleRadius,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="studio-shimmer" style={{ width: '65%', height: 13, borderRadius: 4 }} />
        <div className="studio-shimmer" style={{ width: '40%', height: 9, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function StudioSkeletonList({
  count = 4,
  circleSize = 40,
  circleRadius = '50%',
  style,
}: {
  count?: number;
  circleSize?: number;
  circleRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', ...style }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--app-surface)',
            borderRadius: '1rem',
            border: '1px solid rgba(128,128,128,0.07)',
          }}
        >
          <StudioSkeletonRow circleSize={circleSize} circleRadius={circleRadius} />
        </div>
      ))}
    </div>
  );
}

export function StudioSkeletonHeader({
  titleWidth = 140,
  showButtons = true,
  style,
}: {
  titleWidth?: number;
  showButtons?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '24px 20px 8px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div className="studio-shimmer" style={{ width: titleWidth, height: 26, borderRadius: 6 }} />
      {showButtons && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="studio-shimmer" style={{ width: 34, height: 34, borderRadius: '50%' }} />
          <div className="studio-shimmer" style={{ width: 34, height: 34, borderRadius: '50%' }} />
        </div>
      )}
    </div>
  );
}

export function StudioSkeletonProfile({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      className="studio-shimmer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        padding: '28px 20px 24px',
        background: 'var(--app-surface)',
        borderRadius: '1.25rem',
        border: '1px solid rgba(128,128,128,0.07)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Avatar circle */}
      <div
        className="studio-shimmer"
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          marginBottom: 14,
          background: 'var(--app-surface-highest)',
        }}
      />
      {/* Display name bar */}
      <div className="studio-shimmer" style={{ width: '45%', height: 16, borderRadius: 4, marginBottom: 8 }} />
      {/* Email bar */}
      <div className="studio-shimmer" style={{ width: '60%', height: 11, borderRadius: 4 }} />
    </div>
  );
}

export function StudioSkeletonGrid({
  count = 4,
  columns = 2,
  height = 100,
  style,
}: {
  count?: number;
  columns?: number;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 12,
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <StudioSkeletonCard key={i} height={height} />
      ))}
    </div>
  );
}

// ── CUSTOM STUDIO HUB LOADING SKELETON ─────────────────────────────────────────

export function StudioHubSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 20px',
        paddingBottom: 'var(--content-bottom-pad)',
        background: 'var(--app-bg)',
        minHeight: '100dvh',
        boxSizing: 'border-box',
      }}
    >
      {/* Logo Area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 'clamp(36px, 7vh, 56px)',
        }}
      >
        <div
          className="studio-shimmer"
          style={{ width: 56, height: 56, borderRadius: '28%', marginBottom: 12 }}
        />
        <div className="studio-shimmer" style={{ width: 90, height: 20, borderRadius: 4 }} />
      </div>

      {/* Main Apps Combined Card */}
      <div
        className="studio-shimmer"
        style={{
          width: '100%',
          maxWidth: 380,
          borderRadius: 24,
          background: 'var(--app-surface)',
          border: '1px solid rgba(128,128,128,0.07)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          marginTop: 'clamp(28px, 6vh, 48px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Welcome greeting */}
        <div style={{ padding: '22px 22px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="studio-shimmer" style={{ width: '55%', height: 18, borderRadius: 4 }} />
          <div className="studio-shimmer" style={{ width: '75%', height: 11, borderRadius: 4 }} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '0 16px' }} />

        {/* Apps List rows */}
        <div style={{ padding: '8px 12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '13px 12px',
                gap: 14,
              }}
            >
              {/* App icon circle */}
              <div
                className="studio-shimmer"
                style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }}
              />
              {/* Info text details */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="studio-shimmer" style={{ width: '35%', height: 13, borderRadius: 4 }} />
                <div className="studio-shimmer" style={{ width: '70%', height: 9, borderRadius: 4 }} />
              </div>
              {/* Arrow */}
              <div className="studio-shimmer" style={{ width: 14, height: 14, borderRadius: '50%' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Floating Bottom Nav Outlines */}
      <div
        style={{
          position: 'fixed',
          bottom: 'var(--nav-safe-bottom)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: 380,
          height: 64,
          background: 'rgba(28,28,30,0.3)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(128,128,128,0.08)',
          borderRadius: 22,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '0 10px',
        }}
      >
        <div className="studio-shimmer" style={{ width: 38, height: 38, borderRadius: 10 }} />
        <div className="studio-shimmer" style={{ width: 38, height: 38, borderRadius: 10 }} />
        <div className="studio-shimmer" style={{ width: 38, height: 38, borderRadius: 10 }} />
      </div>
    </div>
  );
}

// ── CUSTOM VOCALEX TAKES LOADING SKELETON ──────────────────────────────────────

export function VocalexTakesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', boxSizing: 'border-box' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="studio-shimmer"
          style={{
            background: 'var(--vx-edge)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: 68,
            boxSizing: 'border-box',
          }}
        >
          {/* Circular play button skeleton */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--vx-card-2)',
              flexShrink: 0,
            }}
          />
          {/* Text details */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ width: '60%', height: 14, background: 'var(--vx-card-2)', borderRadius: 4 }} />
            <div style={{ width: '40%', height: 10, background: 'var(--vx-card-2)', borderRadius: 4 }} />
          </div>
          {/* Mini waveform representation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 24, flexShrink: 0, opacity: 0.15 }}>
            {[14, 28, 42, 21, 35, 48, 17, 30].map((h, j) => (
              <div key={j} style={{ width: 2, height: `${h}%`, background: 'var(--vx-text)', borderRadius: 9999 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── CUSTOM GROOVEX SESSIONS SKELETON ──────────────────────────────────────────

export function GroovexAppSkeleton() {
  return (
    <div style={{ padding: '0 20px', paddingBottom: 'var(--content-bottom-pad)', width: '100%', boxSizing: 'border-box' }}>
      <section style={{ paddingTop: 32, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="studio-shimmer" style={{ width: 150, height: 32, borderRadius: 6 }} />
        <div className="studio-shimmer" style={{ width: 100, height: 12, borderRadius: 4 }} />
      </section>

      {/* Search Input + Chips */}
      <section style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="studio-shimmer" style={{ width: '100%', height: 46, borderRadius: 14 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="studio-shimmer" style={{ width: 85, height: 38, borderRadius: 14 }} />
          <div className="studio-shimmer" style={{ width: 75, height: 38, borderRadius: 14 }} />
        </div>
      </section>

      {/* Song rows catalog */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="studio-shimmer" style={{ width: 110, height: 11, borderRadius: 3 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="studio-shimmer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'var(--gx-surface-low)',
              borderRadius: 14,
              boxSizing: 'border-box',
              height: 66,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              {/* Album art circle */}
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'var(--gx-surface-lowest)',
                  flexShrink: 0,
                }}
              />
              {/* Title & Artist lines */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ width: '55%', height: 13, background: 'var(--gx-surface-lowest)', borderRadius: 4 }} />
                <div style={{ width: '35%', height: 9, background: 'var(--gx-surface-lowest)', borderRadius: 4 }} />
              </div>
            </div>
            {/* Audio Stem tag markers */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0, opacity: 0.4 }}>
              <div style={{ width: 26, height: 14, borderRadius: 4, background: 'var(--gx-surface-lowest)' }} />
              <div style={{ width: 26, height: 14, borderRadius: 4, background: 'var(--gx-surface-lowest)' }} />
              <div style={{ width: 26, height: 14, borderRadius: 4, background: 'var(--gx-surface-lowest)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CUSTOM STAGEX PLOT BUILDER SKELETON ───────────────────────────────────────

export function StagexPanelSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        padding: '24px 20px',
        gap: 16,
        background: 'var(--app-bg)',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Title Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="studio-shimmer" style={{ width: 36, height: 36, borderRadius: '50%' }} />
          <div className="studio-shimmer" style={{ width: 120, height: 24, borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="studio-shimmer" style={{ width: 34, height: 34, borderRadius: '50%' }} />
          <div className="studio-shimmer" style={{ width: 34, height: 34, borderRadius: '50%' }} />
        </div>
      </div>

      {/* Main grid Plot Stage layout */}
      <div
        className="studio-shimmer"
        style={{
          flex: 1,
          borderRadius: 20,
          background: 'var(--app-surface-low)',
          border: '2px dashed rgba(128,128,128,0.15)',
          position: 'relative',
          minHeight: 280,
          boxSizing: 'border-box',
        }}
      >
        {/* Stage layout node representations */}
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '20%',
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--app-surface-highest)',
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            width: 50,
            height: 32,
            borderRadius: 6,
            background: 'var(--app-surface-highest)',
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '25%',
            right: '20%',
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--app-surface-highest)',
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '25%',
            left: '35%',
            width: 38,
            height: 38,
            borderRadius: 6,
            background: 'var(--app-surface-highest)',
            opacity: 0.4,
          }}
        />
      </div>

      {/* Plots lists preview row */}
      <div style={{ display: 'flex', gap: 12, overflowX: 'hidden', flexShrink: 0, paddingBottom: 'var(--nav-safe-bottom)' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="studio-shimmer"
            style={{
              width: 140,
              height: 72,
              borderRadius: 14,
              background: 'var(--app-surface-high)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 6,
              flexShrink: 0,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: '80%', height: 12, background: 'var(--app-surface-highest)', borderRadius: 3 }} />
            <div style={{ width: '50%', height: 9, background: 'var(--app-surface-highest)', borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CUSTOM DRUMEX SEQUENCER SKELETON ──────────────────────────────────────────

export function DrumEditorSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        padding: '24px 20px',
        gap: 16,
        background: 'var(--app-bg)',
        boxSizing: 'border-box',
      }}
    >
      {/* Kit headers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div className="studio-shimmer" style={{ width: 130, height: 24, borderRadius: 6 }} />
        <div className="studio-shimmer" style={{ width: 80, height: 28, borderRadius: 14 }} />
      </div>

      {/* MPC Pads Grid selection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, flexShrink: 0 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="studio-shimmer"
            style={{
              aspectRatio: '1',
              borderRadius: 16,
              background: 'var(--app-surface-low)',
              border: '1px solid rgba(128,128,128,0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: 10,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: '60%', height: 10, background: 'var(--app-surface-highest)', borderRadius: 3 }} />
          </div>
        ))}
      </div>

      {/* Step drum Sequencer tracks listing */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'hidden' }}>
        <div className="studio-shimmer" style={{ width: 110, height: 14, borderRadius: 4 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="studio-shimmer"
            style={{
              height: 48,
              borderRadius: 12,
              background: 'var(--app-surface-low)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
            }}
          >
            {/* Pad label outline */}
            <div style={{ width: 80, height: 12, background: 'var(--app-surface-highest)', borderRadius: 3 }} />
            {/* Sequential step circle placeholders */}
            <div style={{ display: 'flex', gap: 6, opacity: 0.35 }}>
              {Array.from({ length: 8 }).map((_, j) => (
                <div
                  key={j}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: j % 4 === 0 ? 'var(--app-surface-highest)' : 'var(--app-surface-high)',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CUSTOM CHORDEX PAGES SKELETON ──────────────────────────────────────────────

export function ChordexPanelSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        padding: '24px 20px',
        gap: 16,
        background: 'var(--app-bg)',
        boxSizing: 'border-box',
      }}
    >
      {/* Header bar and search layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="studio-shimmer" style={{ width: 120, height: 26, borderRadius: 6 }} />
          <div className="studio-shimmer" style={{ width: 34, height: 34, borderRadius: '50%' }} />
        </div>
        <div className="studio-shimmer" style={{ width: '100%', height: 42, borderRadius: 14 }} />
      </div>

      {/* Grid of Chord cells representing standard guitar frets diagrams */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, flex: 1, overflow: 'hidden' }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="studio-shimmer"
            style={{
              borderRadius: 16,
              background: 'var(--app-surface-low)',
              border: '1px solid rgba(128,128,128,0.06)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              boxSizing: 'border-box',
              height: 114,
            }}
          >
            {/* Chord name placeholder */}
            <div style={{ width: '60%', height: 12, background: 'var(--app-surface-highest)', borderRadius: 3 }} />
            {/* Guitar fret lines mock diagram */}
            <div
              style={{
                width: '100%',
                flex: 1,
                border: '1px solid rgba(128,128,128,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                position: 'relative',
                background: 'var(--app-surface-lowest)',
                opacity: 0.4,
              }}
            >
              <div style={{ width: '100%', height: 1, background: 'rgba(128,128,128,0.15)', position: 'absolute', top: '30%' }} />
              <div style={{ width: '100%', height: 1, background: 'rgba(128,128,128,0.15)', position: 'absolute', top: '65%' }} />
              {/* String lines */}
              <div style={{ width: 1, height: '100%', background: 'rgba(128,128,128,0.2)' }} />
              <div style={{ width: 1, height: '100%', background: 'rgba(128,128,128,0.2)' }} />
              <div style={{ width: 1, height: '100%', background: 'rgba(128,128,128,0.2)' }} />
              {/* Finger circle dot */}
              <div style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: 'var(--c-text-primary)', top: '40%', left: '30%' }} />
              <div style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: 'var(--c-text-primary)', top: '50%', left: '70%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroovexMixerSkeleton({ tracksCount = 4 }: { tracksCount?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Array.from({ length: tracksCount }).map((_, i) => (
        <div
          key={i}
          className="studio-shimmer"
          style={{
            height: 52,
            borderRadius: 12,
            background: 'var(--gx-surface-low)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          {/* Track name label skeleton */}
          <div style={{ width: 70, height: 12, background: 'var(--gx-surface-high)', borderRadius: 3 }} />
          {/* Slider and M/S controls skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end', maxWidth: '70%' }}>
            {/* Slider bar */}
            <div style={{ flex: 1, height: 4, background: 'var(--gx-surface-high)', borderRadius: 2, maxWidth: 120 }} />
            {/* M/S button circles */}
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--gx-surface-high)' }} />
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--gx-surface-high)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

