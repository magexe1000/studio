import { useRef } from 'react';
import { useDrumStore } from '../store/useDrumStore';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { Toggle, SectionHeader, SettingRow } from '../components/SettingControls';

interface Props {
  onClose: () => void;
}

export default function DrumPrefsPanel({ onClose }: Props) {
  const { settings } = useChordStore();
  const { drumPrefs, updateDrumPrefs } = useDrumStore();
  const acc = ACCENT_COLORS[settings.accentColor];
  const scrollRef = useRef<HTMLDivElement>(null);

  const cardStyle: React.CSSProperties = {
    background: 'var(--app-surface)',
    borderRadius: '1.5rem',
    overflow: 'hidden',
  };

  function row(
    key: keyof typeof drumPrefs,
    label: string,
    desc: string,
  ) {
    return (
      <SettingRow label={label} desc={desc}>
        <Toggle
          value={drumPrefs[key] as boolean}
          onChange={v => updateDrumPrefs({ [key]: v })}
          accentFrom={acc.from}
          accentTo={acc.to}
        />
      </SettingRow>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* safe-area top */}
      <div style={{ height: 'env(safe-area-inset-top)', flexShrink: 0 }} />

      {/* header */}
      <div style={{
        flexShrink: 0, height: 52, display: 'flex', alignItems: 'center',
        padding: '10px 14px 0', gap: 8,
      }}>
        <button
          onClick={onClose}
          className="btn-smooth"
          style={{
            height: 30, padding: '0 10px 0 7px', borderRadius: 999,
            background: 'rgba(128,128,128,0.09)',
            border: '1px solid rgba(128,128,128,0.12)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
            color: 'var(--c-text-secondary)', flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>Back</span>
        </button>
        <div style={{ flex: 1 }} />
      </div>

      {/* scrollable content */}
      <div
        ref={scrollRef}
        className="no-scrollbar"
        style={{
          flex: 1, overflowY: 'auto',
          padding: '0 20px',
          paddingBottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 80px)',
        }}
      >
        {/* page title */}
        <div style={{ marginTop: 8, marginBottom: 24 }}>
          <h2 style={{
            fontFamily: 'Manrope', fontWeight: 900, fontSize: '2.6rem',
            color: 'var(--c-text-primary)', letterSpacing: '-0.04em',
            lineHeight: 1, margin: 0,
          }}>
            Preferences
          </h2>
          <p style={{
            color: 'var(--c-text-secondary)', fontFamily: 'Inter',
            fontSize: 13, marginTop: 4,
          }}>
            Customize how Drumex feels
          </p>
        </div>

        {/* ── EDITOR BEHAVIOR ── */}
        <SectionHeader icon="edit_note" title="Editor Behavior" />
        <div style={cardStyle}>
          {row('noteVariationsCycle', 'Note Variations Cycle',
            'Tap repeatedly to cycle through note types (rim, ghost, flam…)')}
          {row('autoExpandPattern', 'Auto-Expand Pattern',
            'Adds new measures automatically when reaching the end')}
          {row('snapToGrid', 'Snap to Grid',
            'Keeps notes aligned to the timing grid')}
          {row('dragToFill', 'Drag to Fill Notes',
            'Hold and drag to quickly create repeated notes')}
        </div>

        {/* ── PLAYBACK ── */}
        <SectionHeader icon="play_circle" title="Playback" />
        <div style={cardStyle}>
          {row('autoPlayOnEdit', 'Auto Play on Edit',
            'Play sound immediately when placing a note')}
          {row('loopPlayback', 'Loop Playback',
            'Loop the pattern continuously during playback')}
          {row('metronome', 'Metronome',
            'Enable click track while playing')}
          {row('countIn', 'Count-In',
            'Short count before playback starts')}
        </div>

        {/* ── INTERACTION ── */}
        <SectionHeader icon="touch_app" title="Interaction" />
        <div style={cardStyle}>
          {row('quickDeleteMode', 'Quick Delete Mode',
            'Tap removes a note instantly instead of cycling variations')}
          {row('showNoteVariations', 'Show Note Variations',
            'Visually differentiate ghost, rim, flam and other types')}
          {row('highlightActiveInst', 'Highlight Active Instrument',
            'Emphasize the currently selected drum row')}
        </div>

        {/* ── VISUAL ── */}
        <SectionHeader icon="grid_on" title="Visual" />
        <div style={cardStyle}>
          {row('gridLinesEmphasis', 'Grid Lines Emphasis',
            'Highlight main beats (1, 2, 3, 4) for better readability')}
        </div>

        {/* ── PERFORMANCE ── */}
        <SectionHeader icon="speed" title="Performance" />
        <div style={cardStyle}>
          {row('lowLatencyMode', 'Low Latency Mode',
            'Improve real-time responsiveness when tapping notes')}
          {row('performanceMode', 'Performance Mode',
            'Reduce heavy processing for a smoother experience')}
        </div>
      </div>
    </div>
  );
}
