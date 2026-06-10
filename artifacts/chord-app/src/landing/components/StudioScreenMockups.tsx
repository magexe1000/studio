import React from 'react';

export function StudioHubMockup() {
  const apps = [
    { name: 'Chordex Library', desc: 'Guitar chord chart sets & songs', tag: 'Chords' },
    { name: 'Stagex Layout', desc: 'Drag stage plots & input sheets', tag: 'Plots' },
    { name: 'Groovex Mixer', desc: 'Stem volume playback mixer', tag: 'Mixer' },
    { name: 'Drumex Sheets', desc: 'Snare sheets & speed timings', tag: 'Tempo' },
    { name: 'Vocalex Trainer', desc: 'Real-time voice pitch tracker', tag: 'Vocal' }
  ];

  return (
    <div className="w-full h-full bg-[#09090b] text-zinc-100 p-4 md:p-6 flex flex-col font-sans select-none overflow-hidden justify-between border border-zinc-800/20 rounded-xl">
      <div>
        <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center text-[10px] font-extrabold text-[#09090b]">S</div>
            <span className="text-xs font-bold tracking-tight text-zinc-200">Studio Hub</span>
          </div>
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-800"></span>
            <span className="w-2 h-2 rounded-full bg-zinc-800"></span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {apps.map((app) => (
            <div key={app.name} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/40 flex flex-col justify-between hover:border-zinc-700/60 transition-all duration-300">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-zinc-200 truncate">{app.name}</div>
                  <span className="text-[7px] text-zinc-400 font-bold bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-700/20">{app.tag}</span>
                </div>
                <div className="text-[8px] text-zinc-500 leading-normal mt-1 truncate">{app.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center text-[8px] text-zinc-500 pt-3 border-t border-zinc-800/20 mt-4">
        <span>Connected to Cloud Database</span>
        <span>Version 4.0.0</span>
      </div>
    </div>
  );
}

export function ChordexLibraryMockup() {
  const chords = ['C Major', 'D Major', 'G Major', 'E Minor', 'A Minor'];

  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex font-sans select-none overflow-hidden justify-between border border-zinc-800/20 rounded-xl">
      {/* List */}
      <div className="w-1/3 border-r border-zinc-800/40 pr-3 flex flex-col gap-2">
        <div className="text-[9px] font-extrabold tracking-wider text-zinc-500 uppercase">Chords</div>
        <div className="flex flex-col gap-1 flex-1 overflow-hidden">
          {chords.map((chord, i) => (
            <div 
              key={chord} 
              className={`p-1.5 rounded-lg text-[8px] font-semibold truncate ${
                i === 1 ? 'bg-zinc-100 text-zinc-950 font-bold' : 'text-zinc-400 hover:bg-zinc-900'
              }`}
            >
              {chord}
            </div>
          ))}
        </div>
      </div>
      
      {/* Chord visual representation */}
      <div className="flex-1 pl-3 flex flex-col justify-between">
        <div>
          <div className="flex items-baseline justify-between mb-2 border-b border-zinc-800/20 pb-1">
            <span className="text-xs font-bold text-zinc-200">D Major</span>
            <span className="text-[7px] text-zinc-500">Standard tuning</span>
          </div>
          
          <div className="border border-zinc-800/40 rounded-xl p-3 flex items-center justify-center bg-zinc-900/30 h-28">
            <svg width="55" height="65" viewBox="0 0 60 70" className="opacity-80">
              {/* Frets */}
              {[12, 26, 40, 54].map(y => <line key={y} x1="5" y1={y} x2="55" y2={y} stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>)}
              {/* Strings */}
              {[5, 15, 25, 35, 45, 55].map(x => <line key={x} x1={x} y1="12" x2={x} y2="54" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>)}
              {/* Dots */}
              <circle cx="35" cy="26" r="3" fill="#ffffff" />
              <circle cx="45" cy="40" r="3" fill="#ffffff" />
              <circle cx="55" cy="26" r="3" fill="#ffffff" />
              {/* Mutes/Opens */}
              <text x="3" y="9" fill="rgba(255,255,255,0.3)" fontSize="6" fontFamily="monospace">x</text>
              <text x="13" y="9" fill="rgba(255,255,255,0.3)" fontSize="6" fontFamily="monospace">o</text>
            </svg>
          </div>
        </div>
        <div className="text-[7px] text-zinc-500 font-mono mt-2">Fingering: T - 0 - 0 - 2 - 3 - 2</div>
      </div>
    </div>
  );
}

export function ChordexSongsMockup() {
  const songs = ['Wish You Were Here', 'Stairway to Heaven', 'Blackbird'];

  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex font-sans select-none overflow-hidden justify-between border border-zinc-800/20 rounded-xl">
      {/* Left Sidebar */}
      <div className="w-1/3 border-r border-zinc-800/40 pr-3 flex flex-col gap-2">
        <div className="text-[9px] font-extrabold tracking-wider text-zinc-500 uppercase">Setlist</div>
        <div className="flex flex-col gap-1 flex-1 overflow-hidden">
          {songs.map((song, i) => (
            <div 
              key={song} 
              className={`p-1.5 rounded-lg text-[8px] font-semibold truncate ${
                i === 0 ? 'bg-zinc-900 border border-zinc-800 text-zinc-200' : 'text-zinc-500 hover:bg-zinc-900/30'
              }`}
            >
              {song}
            </div>
          ))}
        </div>
      </div>
      
      {/* Right Song Content */}
      <div className="flex-1 pl-3 flex flex-col justify-between overflow-hidden">
        <div className="overflow-hidden">
          <div className="flex items-baseline justify-between mb-3 border-b border-zinc-800/20 pb-1">
            <span className="text-xs font-bold text-zinc-200">Wish You Were Here</span>
            <span className="text-[7px] text-zinc-500">Key: G Major</span>
          </div>
          
          <div className="space-y-3 font-mono text-[7px] text-zinc-400">
            <div>
              <div className="flex gap-4 text-zinc-300 font-bold mb-0.5">
                <span>[C]</span>
                <span className="pl-6">[D]</span>
              </div>
              <div>So, so you think you can tell</div>
            </div>
            <div>
              <div className="flex gap-4 text-zinc-300 font-bold mb-0.5">
                <span>[Am]</span>
                <span className="pl-6">[G]</span>
              </div>
              <div>Heaven from hell, blue skies from pain</div>
            </div>
          </div>
        </div>
        <div className="text-[7px] text-zinc-600 truncate border-t border-zinc-800/20 pt-2 mt-2">Original artist: Pink Floyd</div>
      </div>
    </div>
  );
}

export function StagexMockup() {
  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex flex-col font-sans select-none overflow-hidden justify-between border border-zinc-800/20 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-zinc-200">Stagex Layout</span>
        <span className="text-[8px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-bold border border-zinc-700/20">Acoustic Set</span>
      </div>
      {/* Stage visual grid */}
      <div className="flex-1 border border-zinc-800/50 rounded-xl relative bg-zinc-900/10 overflow-hidden flex items-center justify-center h-28">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.04]"></div>
        {/* Stage Nodes */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-col">
          <span className="text-[5px] text-zinc-500 font-bold">Drums</span>
        </div>
        <div className="absolute bottom-4 left-1/3 -translate-x-1/2 w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-col">
          <span className="text-[5px] text-zinc-400 font-bold">Vocal 1</span>
        </div>
        <div className="absolute bottom-4 right-1/3 translate-x-1/2 w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-col">
          <span className="text-[5px] text-zinc-400 font-bold">Vocal 2</span>
        </div>
        <div className="absolute bottom-2 left-6 w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <span className="text-[5px] text-zinc-500">Guitar</span>
        </div>
        <div className="absolute bottom-2 right-6 w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <span className="text-[5px] text-zinc-500">Bass</span>
        </div>
      </div>
      <div className="text-[7px] text-zinc-500 text-right mt-1.5">Inputs: 4 Channels</div>
    </div>
  );
}

export function GroovexMockup() {
  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex flex-col font-sans select-none overflow-hidden justify-between border border-zinc-800/20 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-zinc-200">Groovex Mixer</span>
        <span className="text-[8px] text-zinc-500 truncate">Song: Backing_Stems.wav</span>
      </div>
      {/* Mixer channels */}
      <div className="flex-1 flex gap-2 justify-around items-end pb-1 h-28">
        {[
          { name: 'Vocals', val: '65%' },
          { name: 'Guitar', val: '80%' },
          { name: 'Bass', val: '40%' },
          { name: 'Drums', val: '90%' }
        ].map(ch => (
          <div key={ch.name} className="flex flex-col items-center gap-2 h-full justify-end w-1/4">
            <div className="w-2.5 bg-zinc-900 border border-zinc-800/60 rounded-full h-20 relative overflow-hidden flex items-end">
              <div style={{ height: ch.val }} className="w-full bg-zinc-100 rounded-full" />
            </div>
            <span className="text-[7px] font-semibold text-zinc-400 tracking-wider truncate w-full text-center">{ch.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VocalexMockup() {
  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex flex-col font-sans select-none overflow-hidden justify-between border border-zinc-800/20 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-zinc-200">Vocalex Pitch</span>
        <span className="text-[8px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-bold border border-zinc-700/20">C# Minor</span>
      </div>
      {/* Pitch graph */}
      <div className="flex-1 border border-zinc-800/40 rounded-xl relative bg-zinc-900/10 flex flex-col justify-center overflow-hidden h-28">
        <svg viewBox="0 0 160 80" className="w-full h-full opacity-70">
          {/* horizontal reference grids */}
          <line x1="0" y1="20" x2="160" y2="20" stroke="rgba(255,255,255,0.03)" strokeDasharray="1 3" />
          <line x1="0" y1="40" x2="160" y2="40" stroke="rgba(255,255,255,0.03)" strokeDasharray="1 3" />
          <line x1="0" y1="60" x2="160" y2="60" stroke="rgba(255,255,255,0.03)" strokeDasharray="1 3" />
          {/* Pitch drawing */}
          <path d="M 5 45 Q 35 15, 75 55 T 155 35" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          <rect x="65" y="48" width="18" height="3" fill="rgba(255,255,255,0.15)" rx="1.5" />
          <rect x="115" y="32" width="22" height="3" fill="rgba(255,255,255,0.15)" rx="1.5" />
        </svg>
      </div>
      <div className="text-[6px] text-zinc-500 font-mono mt-1 text-right">Deviation: -2 cents</div>
    </div>
  );
}

export function PreferencesMockup() {
  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex flex-col font-sans select-none overflow-hidden justify-between border border-zinc-800/20 rounded-xl">
      <div>
        <div className="text-xs font-bold text-zinc-200 border-b border-zinc-800/30 pb-2 mb-3">Settings</div>
        <div className="space-y-2.5">
          {[
            { label: 'Cloud Sync Engine', desc: 'Sync settings and setlists', val: 'Active' },
            { label: 'Appearance Mode', desc: 'Amoled and theme options', val: 'Dark' },
            { label: 'Reduce Interface Motion', desc: 'Freezes heavy animations', val: 'Off' }
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-zinc-900 pb-2">
              <div>
                <div className="text-[9px] font-semibold text-zinc-300">{row.label}</div>
                <div className="text-[7px] text-zinc-500 leading-normal">{row.desc}</div>
              </div>
              <span className="text-[8px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">{row.val}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-[7px] text-zinc-600 text-center pt-2">Mag Studio © 2026</div>
    </div>
  );
}

const MOCKUP_MAP: Record<string, React.ComponentType> = {
  hub: StudioHubMockup,
  chordLib: ChordexLibraryMockup,
  chordSongs: ChordexSongsMockup,
  stage: StagexMockup,
  groovex: GroovexMockup,
  vocalex: VocalexMockup,
  preferences: PreferencesMockup
};

export function renderMockupByName(name: string) {
  const Comp = MOCKUP_MAP[name] || StudioHubMockup;
  return <Comp />;
}
