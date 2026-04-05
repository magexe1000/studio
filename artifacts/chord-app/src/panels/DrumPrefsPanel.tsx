import { useRef } from 'react';
import { useDrumStore } from '../store/useDrumStore';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { Toggle, SectionHeader, SettingRow } from '../components/SettingControls';
import { useT } from '../lib/useT';

export default function DrumPrefsPanel() {
  const { settings } = useChordStore();
  const { drumPrefs, updateDrumPrefs } = useDrumStore();
  const t = useT();
  const dp = t.drumPrefs;
  const acc = ACCENT_COLORS[(settings.perApp?.drums?.accentColor ?? settings.accentColor) as keyof typeof ACCENT_COLORS] ?? ACCENT_COLORS.blue;
  const scrollRef = useRef<HTMLDivElement>(null);

  const cardStyle: React.CSSProperties = {
    background: 'var(--app-surface)',
    borderRadius: '1.5rem',
    overflow: 'hidden',
  };

  function row(key: keyof typeof drumPrefs, label: string, desc: string) {
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
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={scrollRef}
        className="no-scrollbar"
        style={{
          flex: 1, overflowY: 'auto',
          padding: '0 20px',
          paddingBottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 90px)',
        }}
      >
        <div style={{ marginTop: 12, marginBottom: 24 }}>
          <h2 style={{
            fontFamily: 'Manrope', fontWeight: 900, fontSize: '2.6rem',
            color: 'var(--c-text-primary)', letterSpacing: '-0.04em',
            lineHeight: 1, margin: 0,
          }}>
            {dp.title}
          </h2>
          <p style={{
            color: 'var(--c-text-secondary)', fontFamily: 'Inter',
            fontSize: 13, marginTop: 4,
          }}>
            {dp.subtitle}
          </p>
        </div>

        <SectionHeader icon="edit_note" title={dp.editorBehavior} />
        <div style={cardStyle}>
          {row('noteVariationsCycle', dp.noteVariations, dp.noteVariationsDesc)}
          {row('autoExpandPattern', dp.autoExpand, dp.autoExpandDesc)}
          {row('snapToGrid', dp.snapToGrid, dp.snapToGridDesc)}
          {row('dragToFill', dp.dragToFill, dp.dragToFillDesc)}
        </div>

        <SectionHeader icon="play_circle" title={dp.playback} />
        <div style={cardStyle}>
          {row('autoPlayOnEdit', dp.autoPlay, dp.autoPlayDesc)}
          {row('loopPlayback', dp.loopPlayback, dp.loopPlaybackDesc)}
          {row('metronome', dp.metronome, dp.metronomeDesc)}
          {row('countIn', dp.countIn, dp.countInDesc)}
        </div>

        <SectionHeader icon="touch_app" title={dp.interaction} />
        <div style={cardStyle}>
          {row('quickDeleteMode', dp.quickDelete, dp.quickDeleteDesc)}
          {row('showNoteVariations', dp.showVariations, dp.showVariationsDesc)}
          {row('highlightActiveInst', dp.highlightActive, dp.highlightActiveDesc)}
        </div>

        <SectionHeader icon="grid_on" title={dp.visual} />
        <div style={cardStyle}>
          {row('gridLinesEmphasis', dp.gridEmphasis, dp.gridEmphasisDesc)}
        </div>

        <SectionHeader icon="speed" title={dp.performance} />
        <div style={cardStyle}>
          {row('lowLatencyMode', dp.lowLatency, dp.lowLatencyDesc)}
          {row('performanceMode', dp.performanceMode, dp.performanceModeDesc)}
        </div>
      </div>
    </div>
  );
}
