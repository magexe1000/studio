import React from 'react';

// ── Shared Layout Wrapper for Real App Look ──────────────────────────────
interface RealAppLayoutWrapperProps {
  activeApp: 'hub' | 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex' | 'preferences';
  appTitle: string;
  tabs?: string[];
  activeTabIdx?: number;
  children: React.ReactNode;
}

function RealAppLayoutWrapper({
  activeApp,
  appTitle,
  tabs = [],
  activeTabIdx = 0,
  children
}: RealAppLayoutWrapperProps) {
  return (
    <div className="w-full h-full bg-[#050505] text-[#f2f1ef] flex font-sans select-none overflow-hidden text-[9px] border border-zinc-800/10 rounded-xl">
      {/* Mock Sidebar */}
      <div className="w-[75px] md:w-[90px] bg-[#0c0c0c] border-r border-zinc-900/60 flex flex-col justify-between py-2 px-1.5 flex-shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <div className="text-white flex-shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 512 512" fill="none">
                <path d="M 72 256 C 128 60 192 60 256 256 S 384 452 440 256" stroke="currentColor" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <span className="font-extrabold text-[8px] md:text-[9px] tracking-tight text-white uppercase select-none">Studio</span>
          </div>
          
          {/* Menu items */}
          <div className="space-y-0.5">
            {[
              { id: 'hub', label: 'Hub', icon: 'home' },
              { id: 'chords', label: 'Chordex', icon: 'music_note' },
              { id: 'drums', label: 'Drumex', icon: 'drum' },
              { id: 'stage', label: 'Stagex', icon: 'layers' },
              { id: 'groovex', label: 'Groovex', icon: 'volume_2' },
              { id: 'vocalex', label: 'Vocalex', icon: 'mic' }
            ].map(item => {
              const isActive = activeApp === item.id;
              return (
                <div 
                  key={item.id}
                  className={`flex items-center gap-1.5 px-1.5 py-1 rounded transition-colors ${
                    isActive ? 'bg-zinc-800/60 text-white font-bold' : 'text-zinc-600'
                  }`}
                >
                  <span className="w-1 h-1 rounded-full flex-shrink-0 bg-current" style={{ opacity: isActive ? 1 : 0.4 }} />
                  <span className="truncate text-[7px] uppercase tracking-wider">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-1 space-y-0.5 border-t border-zinc-900 pt-2 text-[6.5px] text-zinc-600 font-bold">
          <div className="truncate text-zinc-500 font-medium">Guest User</div>
          <div>Web v4.0.0</div>
        </div>
      </div>

      {/* Mock Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
        {/* Panel Header */}
        <div className="h-9 border-b border-zinc-900 px-3 flex items-center justify-between bg-[#080808]/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[8.5px] uppercase text-white tracking-wide">{appTitle}</span>
          </div>
          
          {/* Panel Tabs */}
          {tabs.length > 0 && (
            <div className="flex gap-1 p-0.5 bg-zinc-950 border border-zinc-900 rounded-md">
              {tabs.map((tab, idx) => {
                const isActive = activeTabIdx === idx;
                return (
                  <span 
                    key={tab} 
                    className={`px-1.5 py-0.5 rounded text-[6.5px] uppercase font-bold tracking-wider ${
                      isActive ? 'bg-zinc-800 text-white' : 'text-zinc-500'
                    }`}
                  >
                    {tab}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Panel Content */}
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── 1. Studio Hub Mockup ───────────────────────────────────────────────────
export function StudioHubMockup() {
  return (
    <RealAppLayoutWrapper activeApp="hub" appTitle="Studio Hub">
      <div className="w-full h-full flex flex-col items-center justify-center p-3 select-none">
        <div className="w-full max-w-[190px] bg-zinc-950 border border-zinc-900 rounded-xl p-3 flex flex-col gap-2 shadow-2xl">
          <div className="pb-1.5 border-b border-zinc-900/60">
            <div className="text-[9px] font-extrabold text-white uppercase tracking-tight">Welcome to Studio</div>
            <div className="text-[6.5px] text-zinc-500 mt-0.5">Select a sub-app below to start practicing.</div>
          </div>
          <div className="space-y-1">
            {[
              { name: 'Chordex', desc: 'Guitar charts & library' },
              { name: 'Drumex', desc: 'Sequencer & drum sheets' },
              { name: 'Stagex', desc: 'Stage plots & rider planning' },
              { name: 'Groovex', desc: 'Multitrack stems mixer' },
              { name: 'Vocalex', desc: 'Real-time pitch tracker' }
            ].map(app => (
              <div key={app.name} className="flex items-center gap-2 p-1 rounded-lg border border-zinc-900 bg-zinc-900/40">
                <div className="w-4 h-4 rounded bg-zinc-900 border border-zinc-800/80 flex items-center justify-center text-white font-extrabold text-[7px]">S</div>
                <div className="min-w-0">
                  <div className="text-[7.5px] font-bold text-zinc-300 leading-none">{app.name}</div>
                  <div className="text-[6px] text-zinc-500 truncate mt-0.5">{app.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RealAppLayoutWrapper>
  );
}

// ── 2. Chordex Library Mockup ──────────────────────────────────────────────
export function ChordexLibraryMockup() {
  const chords = ['C Major', 'D Major', 'G Major', 'E Minor', 'A Minor'];
  return (
    <RealAppLayoutWrapper 
      activeApp="chords" 
      appTitle="Chordex" 
      tabs={['Songs', 'Library', 'Chords', 'Settings']} 
      activeTabIdx={1}
    >
      <div className="w-full h-full flex text-[8px] select-none p-2.5 gap-2.5">
        {/* Category List */}
        <div className="w-1/3 border-r border-zinc-900/60 pr-2.5 flex flex-col gap-1.5">
          <span className="text-[7.5px] font-extrabold tracking-wider text-zinc-500 uppercase">Categories</span>
          <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
            {chords.map((chord, i) => (
              <div 
                key={chord} 
                className={`px-1.5 py-1 rounded text-[7px] font-semibold truncate ${
                  i === 1 ? 'bg-zinc-100 text-zinc-950 font-bold' : 'text-zinc-500 hover:bg-zinc-900/30'
                }`}
              >
                {chord}
              </div>
            ))}
          </div>
        </div>
        
        {/* Chord Diagram */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-baseline justify-between mb-1.5 border-b border-zinc-900/60 pb-1">
              <span className="text-[9px] font-bold text-zinc-200">D Major</span>
              <span className="text-[6.5px] text-zinc-500">Standard tuning</span>
            </div>
            
            <div className="border border-zinc-900 rounded-lg p-2 flex items-center justify-center bg-zinc-900/20 h-20">
              <svg width="45" height="50" viewBox="0 0 60 70" className="text-zinc-200">
                {/* Frets */}
                {[12, 26, 40, 54].map(y => <line key={y} x1="5" y1={y} x2="55" y2={y} stroke="currentColor" strokeWidth="1" strokeOpacity="0.15"/>)}
                {/* Strings */}
                {[5, 15, 25, 35, 45, 55].map(x => <line key={x} x1={x} y1="12" x2={x} y2="54" stroke="currentColor" strokeWidth="1" strokeOpacity="0.15"/>)}
                {/* Dots */}
                <circle cx="35" cy="26" r="3.5" fill="currentColor" />
                <circle cx="45" cy="40" r="3.5" fill="currentColor" />
                <circle cx="55" cy="26" r="3.5" fill="currentColor" />
                {/* Mutes/Opens */}
                <text x="3" y="9" fill="currentColor" opacity="0.3" fontSize="8" fontFamily="monospace">x</text>
                <text x="13" y="9" fill="currentColor" opacity="0.3" fontSize="8" fontFamily="monospace">o</text>
              </svg>
            </div>
          </div>
          <div className="text-[6.5px] text-zinc-500 font-mono tracking-wider truncate">Fingering: T - 0 - 0 - 2 - 3 - 2</div>
        </div>
      </div>
    </RealAppLayoutWrapper>
  );
}

// ── 3. Chordex Songs Mockup ────────────────────────────────────────────────
export function ChordexSongsMockup() {
  const songs = ['Wish You Were Here', 'Stairway to Heaven', 'Blackbird'];
  return (
    <RealAppLayoutWrapper 
      activeApp="chords" 
      appTitle="Chordex" 
      tabs={['Songs', 'Library', 'Chords', 'Settings']} 
      activeTabIdx={0}
    >
      <div className="w-full h-full flex text-[8px] select-none p-2.5 gap-2.5">
        {/* Setlist Sidebar */}
        <div className="w-1/3 border-r border-zinc-900/60 pr-2.5 flex flex-col gap-1.5">
          <span className="text-[7.5px] font-extrabold tracking-wider text-zinc-500 uppercase">Setlist</span>
          <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
            {songs.map((song, i) => (
              <div 
                key={song} 
                className={`px-1.5 py-1 rounded text-[7px] font-semibold truncate ${
                  i === 0 ? 'bg-zinc-900 border border-zinc-800/80 text-zinc-200 font-bold' : 'text-zinc-500'
                }`}
              >
                {song}
              </div>
            ))}
          </div>
        </div>
        
        {/* Chord Sheet */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          <div className="overflow-hidden">
            <div className="flex items-baseline justify-between mb-2 border-b border-zinc-900/60 pb-1">
              <span className="text-[8.5px] font-bold text-zinc-200">Wish You Were Here</span>
              <span className="text-[6px] text-zinc-500 font-bold">Key: G Major</span>
            </div>
            
            <div className="space-y-1.5 font-mono text-[6.5px] text-zinc-400">
              <div>
                <div className="flex gap-4 text-zinc-200 font-bold leading-none">
                  <span>[G]</span>
                  <span>[C]</span>
                  <span>[D]</span>
                </div>
                <div className="leading-tight mt-0.5">So, so you think you can tell</div>
              </div>
              <div>
                <div className="flex gap-4 text-zinc-200 font-bold leading-none">
                  <span>[Am]</span>
                  <span>[G]</span>
                </div>
                <div className="leading-tight mt-0.5">Heaven from hell, blue skies from pain</div>
              </div>
            </div>
          </div>
          <div className="text-[6px] text-zinc-600 truncate border-t border-zinc-900/60 pt-1 mt-1">Pink Floyd · organizat.</div>
        </div>
      </div>
    </RealAppLayoutWrapper>
  );
}

// ── 4. Chordex Chords Mockup ───────────────────────────────────────────────
export function ChordexChordsMockup() {
  const gridChords = ['C', 'D', 'G', 'Em', 'Am', 'F'];
  return (
    <RealAppLayoutWrapper 
      activeApp="chords" 
      appTitle="Chordex" 
      tabs={['Songs', 'Library', 'Chords', 'Settings']} 
      activeTabIdx={2}
    >
      <div className="w-full h-full p-2 flex flex-col justify-between overflow-hidden">
        <span className="text-[7.5px] font-extrabold tracking-wider text-zinc-500 uppercase px-1">Chords Catalog</span>
        <div className="grid grid-cols-3 gap-1.5 flex-1 overflow-hidden mt-1 pb-1">
          {gridChords.map(c => (
            <div key={c} className="p-1 rounded bg-zinc-900/40 border border-zinc-900 flex flex-col items-center justify-between">
              <span className="text-[8px] font-extrabold text-zinc-200 leading-none">{c}</span>
              {/* Mini chord diagram */}
              <div className="w-6 h-8 opacity-45 flex items-center justify-center">
                <svg viewBox="0 0 10 12" className="w-full h-full stroke-white" strokeWidth="0.8">
                  <line x1="1" y1="2" x2="9" y2="2" />
                  <line x1="1" y1="6" x2="9" y2="6" />
                  <line x1="1" y1="10" x2="9" y2="10" />
                  <line x1="2" y1="2" x2="2" y2="10" />
                  <line x1="5" y1="2" x2="5" y2="10" />
                  <line x1="8" y1="2" x2="8" y2="10" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </RealAppLayoutWrapper>
  );
}

// ── 5. Drumex Mockup ───────────────────────────────────────────────────────
export function DrumexMockup() {
  const insts = ['Crash', 'HH', 'Snare', 'Kick'];
  return (
    <RealAppLayoutWrapper 
      activeApp="drums" 
      appTitle="Drumex" 
      tabs={['Songs', 'Patterns', 'Settings']} 
      activeTabIdx={1}
    >
      <div className="w-full h-full p-2 flex flex-col justify-between select-none overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[7.5px] font-extrabold tracking-wider text-zinc-500 uppercase">Step Sequencer</span>
          <span className="text-[6.5px] text-zinc-400 font-bold bg-zinc-900 border border-zinc-800 px-1 rounded">120 BPM</span>
        </div>
        
        {/* Timeline Grid */}
        <div className="flex-1 flex flex-col border border-zinc-900/60 rounded overflow-hidden bg-zinc-950/20">
          {insts.map((inst, rowIdx) => (
            <div key={inst} className="flex border-b border-zinc-900/40 last:border-none flex-1 items-center">
              <div className="w-10 pl-1.5 text-[6.5px] font-bold text-zinc-500 border-r border-zinc-900/60 truncate uppercase tracking-wider">{inst}</div>
              <div className="flex-1 grid grid-cols-8 h-full">
                {Array.from({ length: 8 }).map((_, stepIdx) => {
                  const isActive = 
                    (rowIdx === 3 && stepIdx % 2 === 0) || // Kick on every beat
                    (rowIdx === 2 && stepIdx % 4 === 2) || // Snare on backbeat
                    (rowIdx === 1 && stepIdx % 1 === 0) || // HH on eighth notes
                    (rowIdx === 0 && stepIdx === 0);       // Crash on 1
                  return (
                    <div 
                      key={stepIdx} 
                      className={`border-r border-zinc-900/30 last:border-none flex items-center justify-center ${
                        stepIdx % 4 >= 2 ? 'bg-zinc-900/10' : ''
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-zinc-100 shadow-sm shadow-white/10' : 'bg-zinc-900 border border-zinc-800'
                      }`} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </RealAppLayoutWrapper>
  );
}

// ── 6. Stagex Mockup ───────────────────────────────────────────────────────
export function StagexMockup() {
  return (
    <RealAppLayoutWrapper 
      activeApp="stage" 
      appTitle="Stagex" 
      tabs={['Plotter', 'Inputs', 'Settings']} 
      activeTabIdx={0}
    >
      <div className="w-full h-full p-2.5 flex flex-col justify-between select-none overflow-hidden">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[7.5px] font-extrabold tracking-wider text-zinc-500 uppercase">Stage Plot View</span>
          <span className="text-[6.5px] text-zinc-400 font-bold bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">FOH Rider</span>
        </div>
        
        {/* Canvas grid */}
        <div className="flex-1 border border-zinc-900 rounded-lg relative bg-zinc-950/20 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]"></div>
          
          {/* Nodes */}
          {/* Backline */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 font-bold text-[6px] uppercase tracking-wider">Drums</div>
          {/* Frontline */}
          <div className="absolute bottom-2 left-1/4 -translate-x-1/2 w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center flex-col shadow-lg shadow-black/40">
            <span className="text-[5.5px] text-zinc-200 font-bold">Vocal 1</span>
            <span className="text-[4.5px] text-zinc-500">Guitar DI</span>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center flex-col shadow-lg shadow-black/40">
            <span className="text-[5.5px] text-zinc-200 font-bold">Vocal 2</span>
            <span className="text-[4.5px] text-zinc-500">Bass DI</span>
          </div>
          <div className="absolute bottom-2 right-1/4 translate-x-1/2 w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center flex-col shadow-lg shadow-black/40">
            <span className="text-[5.5px] text-zinc-200 font-bold">Vocal 3</span>
            <span className="text-[4.5px] text-zinc-500">Keys DI</span>
          </div>
        </div>
      </div>
    </RealAppLayoutWrapper>
  );
}

// ── 7. Groovex Mockup ──────────────────────────────────────────────────────
export function GroovexMockup() {
  const channels = [
    { name: 'Lead Vocals', vol: '68%' },
    { name: 'Guitar Cab', vol: '80%' },
    { name: 'Bass Direct', vol: '55%' },
    { name: 'Stereo Drums', vol: '90%' }
  ];
  return (
    <RealAppLayoutWrapper 
      activeApp="groovex" 
      appTitle="Groovex" 
      tabs={['Player', 'Mixer', 'Settings']} 
      activeTabIdx={1}
    >
      <div className="w-full h-full p-2 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[7.5px] font-extrabold tracking-wider text-zinc-500 uppercase">Multitrack Mixer</span>
          <span className="text-[6px] text-zinc-400 font-mono truncate max-w-[90px]">Song_Stems_Main.wav</span>
        </div>
        
        {/* Mixer Tracks */}
        <div className="flex-1 flex gap-1 justify-around items-end pb-1 overflow-hidden">
          {channels.map(ch => (
            <div key={ch.name} className="flex flex-col items-center gap-1.5 h-full justify-end w-1/4">
              <div className="w-1.5 bg-zinc-950 border border-zinc-900 rounded-full h-20 relative overflow-hidden flex items-end">
                <div style={{ height: ch.vol }} className="w-full bg-zinc-200 rounded-full" />
              </div>
              <span className="text-[6px] font-semibold text-zinc-500 tracking-wider truncate w-full text-center uppercase">{ch.name}</span>
            </div>
          ))}
        </div>
      </div>
    </RealAppLayoutWrapper>
  );
}

// ── 8. Vocalex Mockup ──────────────────────────────────────────────────────
export function VocalexMockup() {
  return (
    <RealAppLayoutWrapper 
      activeApp="vocalex" 
      appTitle="Vocalex" 
      tabs={['Tuner', 'Training', 'Settings']} 
      activeTabIdx={0}
    >
      <div className="w-full h-full p-2.5 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[7.5px] font-extrabold tracking-wider text-zinc-500 uppercase">Vocal Pitch Analysis</span>
          <span className="text-[6.5px] text-zinc-400 font-bold bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">C# Minor</span>
        </div>
        
        {/* Tuner Canvas */}
        <div className="flex-1 border border-zinc-900 rounded-lg relative bg-zinc-950/20 flex flex-col justify-center overflow-hidden">
          <svg viewBox="0 0 160 80" className="w-full h-full opacity-60">
            {/* grids */}
            <line x1="0" y1="20" x2="160" y2="20" stroke="rgba(255,255,255,0.03)" strokeDasharray="1 3" />
            <line x1="0" y1="40" x2="160" y2="40" stroke="rgba(255,255,255,0.03)" strokeDasharray="1 3" />
            <line x1="0" y1="60" x2="160" y2="60" stroke="rgba(255,255,255,0.03)" strokeDasharray="1 3" />
            {/* Pitch wave */}
            <path d="M 5 45 Q 35 15, 75 55 T 155 35" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
            {/* Center Lock notes */}
            <rect x="65" y="49" width="18" height="2" fill="rgba(255,255,255,0.12)" rx="1" />
            <rect x="115" y="33" width="22" height="2" fill="rgba(255,255,255,0.12)" rx="1" />
          </svg>
          
          <div className="absolute top-2 right-2 text-[7px] text-zinc-300 font-bold font-mono">Deviation: -2 cents</div>
        </div>
      </div>
    </RealAppLayoutWrapper>
  );
}

// ── 9. Preferences Mockup ──────────────────────────────────────────────────
export function PreferencesMockup() {
  const rows = [
    { label: 'Cloud Sync Engine', desc: 'Sync settings & workspace', val: 'Active' },
    { label: 'Appearance Theme', desc: 'Dark / Light / AMOLED selector', val: 'AMOLED' },
    { label: 'Reduce Interface Motion', desc: 'Disables scrolling transitions', val: 'Off' }
  ];
  return (
    <RealAppLayoutWrapper 
      activeApp="preferences" 
      appTitle="Preferences" 
      tabs={['General', 'Appearance', 'Language', 'Updater']} 
      activeTabIdx={1}
    >
      <div className="w-full h-full p-2.5 flex flex-col justify-between overflow-hidden">
        <span className="text-[7.5px] font-extrabold tracking-wider text-zinc-500 uppercase border-b border-zinc-900 pb-1.5 mb-1">Appearance Settings</span>
        
        <div className="flex-1 flex flex-col justify-between py-1">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between items-center py-1 border-b border-zinc-900/40 last:border-none">
              <div>
                <div className="text-[7.5px] font-bold text-zinc-300">{row.label}</div>
                <div className="text-[5.5px] text-zinc-500 leading-none mt-0.5">{row.desc}</div>
              </div>
              <span className="text-[6.5px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">{row.val}</span>
            </div>
          ))}
        </div>
      </div>
    </RealAppLayoutWrapper>
  );
}

// ── Mockup Map ─────────────────────────────────────────────────────────────
const MOCKUP_MAP: Record<string, React.ComponentType> = {
  hub: StudioHubMockup,
  chordLib: ChordexLibraryMockup,
  chordSongs: ChordexSongsMockup,
  chordChords: ChordexChordsMockup,
  drumex: DrumexMockup,
  stage: StagexMockup,
  groovex: GroovexMockup,
  vocalex: VocalexMockup,
  preferences: PreferencesMockup
};

export function renderMockupByName(name: string) {
  const Comp = MOCKUP_MAP[name] || StudioHubMockup;
  return <Comp />;
}
