import { useRef, useState } from 'react';
import { useDrumStore } from '../store/useDrumStore';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { Toggle, SectionHeader, SettingRow } from '../components/SettingControls';
import { useT } from '../lib/useT';
import { useScrollHide } from '../lib/navScroll';
import { useIsWebDesktop } from '../hooks/useIsWebDesktop';

function IconDrumSongs({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6; const ao = active ? 0.13 : 0;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={ao} />
      <line x1="7.5" y1="8"  x2="16.5" y2="8"  stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
      <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
      <line x1="7.5" y1="16" x2="13"   y2="16" stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
    </svg>
  );
}
function IconPatterns({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={sw} />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth={sw * 0.7} />
      <circle cx="7" cy="6" r="1.2" fill="currentColor" />
      <circle cx="12" cy="6" r="1.2" fill="currentColor" />
      <circle cx="17" cy="12" r="1.2" fill="currentColor" />
      <circle cx="7" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="18" r="1.2" fill="currentColor" />
      <circle cx="17" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}
function IconPrefs({ active }: { active: boolean }) {
  const sw = active ? 2.2 : 1.7;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <line x1="4" y1="6"  x2="20" y2="6"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="8" y1="3"  x2="8"  y2="9"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="14" y1="9" x2="14" y2="15" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="10" y1="15" x2="10" y2="21" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

export default function DrumPrefsPanel() {
  const { settings, updateSettings } = useChordStore();
  const { drumPrefs, updateDrumPrefs } = useDrumStore();
  const t = useT();
  const dp = t.drumPrefs;
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);

  const acc = ACCENT_COLORS[(settings.perApp?.drums?.accentColor ?? settings.accentColor) as keyof typeof ACCENT_COLORS] ?? ACCENT_COLORS.blue;
  const cardStyle: React.CSSProperties = {
    background: 'var(--app-surface)',
    borderRadius: '1.5rem',
    overflow: 'hidden',
  };

  const isWebDesktop = useIsWebDesktop();
  const [activeCat, setActiveCat] = useState<'all' | 'editor' | 'playback' | 'display' | 'startup'>('all');

  const drumsVis = settings.perApp?.drums ?? { theme: settings.theme ?? 'dark', amoledMode: settings.amoledMode ?? false };
  const isLight = drumsVis.theme === 'light' ||
    (drumsVis.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) ||
    (drumsVis.theme === 'dynamic' && (() => {
      const h = new Date().getHours();
      const lightStart = settings.dynamicLightStart ?? 7;
      const lightEnd   = settings.dynamicLightEnd   ?? 20;
      return h >= lightStart && h < lightEnd;
    })());

  function CleanToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full relative transition-colors duration-200 cursor-pointer flex-shrink-0 ${
          value 
            ? (isLight ? 'bg-blue-600' : 'bg-blue-500') 
            : (isLight ? 'bg-zinc-200' : 'bg-zinc-800')
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 bg-white shadow-sm ${
            value ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    );
  }

  function PrefsSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="flex flex-col gap-2">
        <span className={`text-[9.5px] font-extrabold tracking-widest uppercase px-1 ${isLight ? 'text-zinc-500' : 'text-zinc-450'}`}>
          {title}
        </span>
        <div className={`border rounded-xl overflow-hidden ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-900 bg-[#000000]'}`}>
          {children}
        </div>
      </div>
    );
  }

  function PrefsRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
    return (
      <div className={`flex justify-between items-center px-4 py-3 border-b last:border-none ${isLight ? 'border-zinc-100' : 'border-zinc-900/60'}`}>
        <div className="flex-1 pr-4">
          <div className={`text-xs font-bold ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{label}</div>
          {desc && <div className={`text-[10px] leading-snug mt-0.5 ${isLight ? 'text-zinc-455' : 'text-zinc-500'}`}>{desc}</div>}
        </div>
        <div className="flex-shrink-0">
          {children}
        </div>
      </div>
    );
  }

  function row(key: keyof typeof drumPrefs, label: string, desc: string) {
    if (isWebDesktop) {
      return (
        <PrefsRow label={label} desc={desc}>
          <CleanToggle
            value={drumPrefs[key] as boolean}
            onChange={v => updateDrumPrefs({ [key]: v })}
          />
        </PrefsRow>
      );
    }
    const acc = ACCENT_COLORS[(settings.perApp?.drums?.accentColor ?? settings.accentColor) as keyof typeof ACCENT_COLORS] ?? ACCENT_COLORS.blue;
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

  if (isWebDesktop) {
    return (
      <div className={`flex flex-col h-full overflow-hidden p-6 ${isLight ? 'bg-zinc-50' : 'bg-[#000000]'}`}>
        {/* Category Tabs */}
        <div className="flex gap-1.5 mb-6 flex-wrap">
          {([
            { id: 'all', label: 'All Settings' },
            { id: 'editor', label: 'Editor Behavior' },
            { id: 'playback', label: 'Playback & Dynamics' },
            { id: 'display', label: 'Display & Visuals' },
            { id: 'startup', label: 'Startup & Default' }
          ] as const).map(c => {
            const active = activeCat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`px-3.5 py-1.5 rounded-lg border text-[9.5px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                  active 
                    ? (isLight 
                        ? 'bg-blue-50 text-blue-600 border-blue-200' 
                        : 'bg-blue-950/40 text-blue-400 border-blue-900/60') 
                    : (isLight 
                        ? 'bg-transparent text-zinc-500 border-zinc-200 hover:border-zinc-350 hover:text-black' 
                        : 'bg-transparent text-zinc-500 border-zinc-900 hover:border-zinc-800 hover:text-white')
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: '120px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
            {/* Column 1: Editor Behavior */}
            {(activeCat === 'all' || activeCat === 'editor') && (
              <div className="space-y-6">
                <PrefsSection title={dp.editorBehavior}>
                  {row('noteVariationsCycle', dp.noteVariations, dp.noteVariationsDesc)}
                  {row('autoExpandPattern', dp.autoExpand, dp.autoExpandDesc)}
                  {row('snapToGrid', dp.snapToGrid, dp.snapToGridDesc)}
                  {row('dragToFill', dp.dragToFill, dp.dragToFillDesc)}
                </PrefsSection>
              </div>
            )}

            {/* Column 2: Playback & Dynamics */}
            {(activeCat === 'all' || activeCat === 'playback') && (
              <div className="space-y-6">
                <PrefsSection title={dp.playback}>
                  {row('autoPlayOnEdit', dp.autoPlay, dp.autoPlayDesc)}
                  {row('loopPlayback', dp.loopPlayback, dp.loopPlaybackDesc)}
                  {row('metronome', dp.metronome, dp.metronomeDesc)}
                  {row('countIn', dp.countIn, dp.countInDesc)}
                  {row('humanizeVelocity', dp.humanizeVelocity, dp.humanizeVelocityDesc)}
                </PrefsSection>
              </div>
            )}

            {/* Column 3: Display & Start On */}
            {(activeCat === 'all' || activeCat === 'display' || activeCat === 'startup') && (
              <div className="space-y-6">
                {(activeCat === 'all' || activeCat === 'display') && (
                  <>
                    <PrefsSection title={dp.interaction}>
                      {row('showNoteVariations', dp.showVariations, dp.showVariationsDesc)}
                      {row('highlightActiveInst', dp.highlightActive, dp.highlightActiveDesc)}
                    </PrefsSection>

                    <PrefsSection title={dp.visual}>
                      {row('gridLinesEmphasis', dp.gridEmphasis, dp.gridEmphasisDesc)}
                    </PrefsSection>
                  </>
                )}

                {(activeCat === 'all' || activeCat === 'startup') && (
                  <PrefsSection title={dp.startOn}>
                    <PrefsRow label={dp.startOn} desc={dp.startOnDesc}>
                      {(() => {
                        const cur = settings.defaultDrumTab ?? 'songs';
                        const tabs: { value: 'songs' | 'patterns' | 'prefs'; Icon: React.FC<{ active: boolean }> }[] = [
                          { value: 'songs',    Icon: IconDrumSongs },
                          { value: 'patterns', Icon: IconPatterns  },
                          { value: 'prefs',    Icon: IconPrefs     },
                        ];
                        return (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {tabs.map(({ value, Icon }) => {
                              const active = cur === value;
                              return (
                                <button
                                  key={value}
                                  onClick={() => updateSettings({ defaultDrumTab: value })}
                                  className={`w-9 h-9 flex items-center justify-center rounded-lg border cursor-pointer transition-all ${
                                    active 
                                      ? (isLight
                                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                                          : 'bg-blue-950/40 text-blue-400 border-blue-900/60')
                                      : (isLight
                                          ? 'bg-transparent text-zinc-500 border-zinc-200 hover:text-black hover:border-zinc-350'
                                          : 'bg-transparent text-zinc-500 border-zinc-900 hover:text-zinc-350 hover:border-zinc-800')
                                  }`}
                                >
                                  <Icon active={active} />
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </PrefsRow>
                  </PrefsSection>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
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
        <div className="spring-in" style={{ marginTop: 12, marginBottom: 24 }}>
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
          {row('humanizeVelocity', dp.humanizeVelocity, dp.humanizeVelocityDesc)}
        </div>

        <SectionHeader icon="touch_app" title={dp.interaction} />
        <div style={cardStyle}>
          {row('showNoteVariations', dp.showVariations, dp.showVariationsDesc)}
          {row('highlightActiveInst', dp.highlightActive, dp.highlightActiveDesc)}
        </div>

        <SectionHeader icon="grid_on" title={dp.visual} />
        <div style={cardStyle}>
          {row('gridLinesEmphasis', dp.gridEmphasis, dp.gridEmphasisDesc)}
        </div>

        <SectionHeader icon="dashboard" title={dp.startOn} />
        <div style={cardStyle}>
          <SettingRow label={dp.startOn} desc={dp.startOnDesc}>
            {(() => {
              const cur = settings.defaultDrumTab ?? 'songs';
              const tabs: { value: 'songs' | 'patterns' | 'prefs'; Icon: React.FC<{ active: boolean }> }[] = [
                { value: 'songs',    Icon: IconDrumSongs },
                { value: 'patterns', Icon: IconPatterns  },
                { value: 'prefs',    Icon: IconPrefs     },
              ];
              return (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {tabs.map(({ value, Icon }) => {
                    const active = cur === value;
                    return (
                      <button
                        key={value}
                        onClick={() => updateSettings({ defaultDrumTab: value })}
                        style={{
                          width: '40px', height: '40px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '10px',
                          border: active ? `2px solid ${acc.from}` : '2px solid transparent',
                          background: active ? `linear-gradient(135deg, ${acc.from}22, ${acc.to}18)` : 'var(--app-surface-low)',
                          color: active ? acc.from : 'var(--c-text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                          flexShrink: 0,
                        }}
                      >
                        <Icon active={active} />
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </SettingRow>
        </div>
      </div>
    </div>
  );
}
