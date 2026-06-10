import React from 'react';
import { APPS_DATA } from '../landingData';
import { 
  ChordexLogo, 
  StagexLogoIcon, 
  GroovexLogo, 
  DrumexLogo, 
  VocalexLogo 
} from '../../components/ChordexLogo';
import { Check } from 'lucide-react';

// Render logo according to key
function renderLogoByKey(key: string) {
  switch (key) {
    case 'chords': return <ChordexLogo size={24} />;
    case 'stage': return <StagexLogoIcon size={24} />;
    case 'groovex': return <GroovexLogo size={24} />;
    case 'drums': return <DrumexLogo size={24} />;
    case 'vocalex': return <VocalexLogo size={24} />;
    default: return null;
  }
}

export default function LandingAppSuite() {
  return (
    <section id="suite" className="py-24 border-t border-zinc-900 bg-[#050508]/40 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white uppercase mb-4">
            Integrated Music Suite
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
            Stop juggling separate browser tabs and software tools. Studio aggregates five core workflows into a single cross-platform platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {APPS_DATA.map((app) => (
            <div 
              key={app.key}
              className="group relative p-6 rounded-xl bg-zinc-950 border border-zinc-900 transition-all duration-300 hover:border-zinc-700 hover:-translate-y-1 shadow-2xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-800/80">
                    {renderLogoByKey(app.key)}
                  </div>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                    {app.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">
                  {app.name}
                </h3>
                <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                  {app.desc}
                </p>

                <ul className="space-y-2.5 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                  {app.bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
