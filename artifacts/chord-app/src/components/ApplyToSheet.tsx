import React, { useState, useEffect, useRef } from 'react';
import { StudioLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import type { AppKey } from '../store/useChordStore';
import { useT } from '../lib/useT';

interface AppCard {
  key: AppKey;
  label: string;
  Logo: React.ComponentType<{ size?: number }>;
}

const APP_CARDS: AppCard[] = [
  { key: 'hub',     label: 'Studio',  Logo: StudioLogo       },
  { key: 'chords',  label: 'Chordex', Logo: ChordexLogo      },
  { key: 'drums',   label: 'Drumex',  Logo: DrumexLogo       },
  { key: 'stage',   label: 'Stagex',  Logo: StagexLogoIcon   },
  { key: 'groovex', label: 'Groovex', Logo: GroovexLogo      },
  { key: 'vocalex', label: 'Vocalex', Logo: VocalexLogo      },
];

interface ApplyToSheetProps {
  show: boolean;
  onApply: (apps: AppKey[]) => void;
  onClose: () => void;
}

export default function ApplyToSheet({ show, onApply, onClose }: ApplyToSheetProps) {
  const { settings } = useChordStore();
  const t = useT();
  const appKey = (settings.appMode ?? 'hub') as AppKey;
  const perApp = settings.perApp;
  const vis    = perApp?.[appKey] ?? { accentColor: 'blue' };
  const accent = ACCENT_COLORS[vis.accentColor as keyof typeof ACCENT_COLORS];

  const [selected, setSelected] = useState<Set<AppKey>>(new Set(['hub', 'chords', 'drums', 'stage', 'groovex', 'vocalex']));
  const [mounted, setMounted] = useState(false);
  const [open,    setOpen]    = useState(false);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show) {
      if (unmountTimer.current) { clearTimeout(unmountTimer.current); unmountTimer.current = null; }
      setSelected(new Set(['hub', 'chords', 'drums', 'stage', 'groovex', 'vocalex']));
      setMounted(true);
    } else {
      setOpen(false);
      unmountTimer.current = setTimeout(() => setMounted(false), 220);
    }
    return () => {
      if (unmountTimer.current) clearTimeout(unmountTimer.current);
    };
  }, [show]);

  useEffect(() => {
    if (mounted && show) {
      const el = sheetRef.current;
      if (el) void el.offsetHeight;
      requestAnimationFrame(() => setOpen(true));
    }
  }, [mounted, show]);

  if (!mounted) return null;

  function toggle(key: AppKey) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleApply() {
    onApply(Array.from(selected));
  }

  const sheetTranslate  = open ? '0%'  : '105%';
  const backdropOpacity = open ? 1     : 0;

  return (
    <div
      data-theme-exempt
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: `rgba(0,0,0,0.55)`,
        opacity: backdropOpacity,
        pointerEvents: open ? 'auto' : 'none',
        transition: open
          ? 'opacity 180ms cubic-bezier(0.0,0.0,0.2,1)'
          : 'opacity 200ms cubic-bezier(0.4,0,1,1)',
        display: 'flex', alignItems: 'flex-end',
        contain: 'layout style',
      }}
    >
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--app-surface)',
          borderRadius: '24px 24px 0 0',
          padding: '12px 20px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
          transform: `translate3d(0, ${sheetTranslate}, 0)`,
          transition: open
            ? 'transform 260ms cubic-bezier(0.34,1.08,0.64,1)'
            : 'transform 200ms cubic-bezier(0.4,0,1,1)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
          willChange: 'transform',
          backfaceVisibility: 'hidden' as const,
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(128,128,128,0.3)' }} />
        </div>

        {/* Heading */}
        <p style={{
          textAlign: 'center', margin: '0 0 6px',
          fontSize: 17, fontWeight: 800, color: 'var(--c-text-primary)',
          letterSpacing: '-0.02em', fontFamily: 'Manrope',
        }}>
          {t.applyTo.title}
        </p>
        <p style={{
          textAlign: 'center', margin: '0 0 20px',
          fontSize: 13, color: 'var(--c-text-secondary)', fontFamily: 'Inter',
        }}>
          {t.applyTo.subtitle}
        </p>

        {/* App cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          {APP_CARDS.map(({ key, label, Logo }) => {
            const active = selected.has(key);
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className="btn-smooth"
                style={{
                  width: 'calc(33.333% - 8px)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 10, padding: '18px 8px',
                  borderRadius: 18,
                  background: active ? `${accent.from}18` : 'var(--app-surface-high)',
                  border: `2px solid ${active ? accent.from + '55' : 'rgba(128,128,128,0.12)'}`,
                  transition: 'background 200ms ease, border-color 200ms ease, transform 120ms ease',
                  transform: active ? 'scale(1.03)' : 'scale(1)',
                  boxShadow: active ? `0 4px 20px ${accent.from}28` : 'none',
                  position: 'relative',
                }}
              >
                {/* Check badge */}
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 20, height: 20, borderRadius: '50%',
                  background: active ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(128,128,128,0.15)',
                  border: active ? 'none' : '1.5px solid rgba(128,128,128,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 200ms ease, border 200ms ease',
                }}>
                  {active && (
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#fff', fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
                  )}
                </div>

                {/* Logo */}
                <div style={{
                  width: 52, height: 52,
                  borderRadius: 16,
                  background: active ? `${accent.from}22` : 'rgba(128,128,128,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 200ms ease',
                }}>
                  <Logo size={32} />
                </div>

                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 700,
                  fontFamily: 'Manrope',
                  color: active ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
                  transition: 'color 200ms ease',
                }}>
                  {label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Apply button */}
        <button
          onClick={handleApply}
          className="btn-smooth"
          style={{
            width: '100%', padding: '15px 0',
            borderRadius: 14, border: 'none',
            background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            color: '#fff', fontSize: 15, fontWeight: 800,
            fontFamily: 'Manrope', letterSpacing: '-0.01em',
            boxShadow: `0 4px 20px ${accent.to}50`,
            cursor: 'pointer',
          }}
        >
          {t.applyTo.apply}
        </button>
      </div>
    </div>
  );
}
