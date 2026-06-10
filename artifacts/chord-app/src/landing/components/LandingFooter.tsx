import React from 'react';

interface LandingFooterProps {
  navigateTo: (path: string) => void;
  apkUrl?: string;
  apkVersion?: string;
}

export default function LandingFooter({ navigateTo, apkUrl, apkVersion = '3.6.28' }: LandingFooterProps) {
  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="border-t border-zinc-900 bg-[#030303] py-16 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start mb-16">
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-xs font-extrabold text-[#030303]">
                S
              </div>
              <span className="font-extrabold text-base tracking-tight text-white uppercase">
                Studio
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed max-w-sm">
              Studio is a specialized, integrated single-page application containing tools for guitarists, drummers, audio engineers, vocalists, and music directors. Built for live setups.
            </p>
          </div>

          <div className="md:col-span-7 grid grid-cols-3 gap-6">
            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 mb-4">Suite Tools</h4>
              <ul className="space-y-2 text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                <li><button onClick={(e) => handleScrollTo(e, 'suite')} className="hover:text-white transition-colors">Chordex</button></li>
                <li><button onClick={(e) => handleScrollTo(e, 'suite')} className="hover:text-white transition-colors">Stagex</button></li>
                <li><button onClick={(e) => handleScrollTo(e, 'suite')} className="hover:text-white transition-colors">Groovex</button></li>
                <li><button onClick={(e) => handleScrollTo(e, 'suite')} className="hover:text-white transition-colors">Drumex</button></li>
                <li><button onClick={(e) => handleScrollTo(e, 'suite')} className="hover:text-white transition-colors">Vocalex</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 mb-4">Platforms</h4>
              <ul className="space-y-2 text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                <li><button onClick={() => navigateTo('/app')} className="hover:text-white transition-colors">Web Version</button></li>
                <li>{apkUrl ? <a href={apkUrl} className="hover:text-white transition-colors">Android APK</a> : <span className="text-zinc-700">APK</span>}</li>
                <li><span className="text-zinc-700 cursor-not-allowed">Windows EXE</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 mb-4">Resources</h4>
              <ul className="space-y-2 text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                <li><a href="#suite" onClick={(e) => handleScrollTo(e, 'suite')} className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#downloads" onClick={(e) => handleScrollTo(e, 'downloads')} className="hover:text-white transition-colors">Downloads</a></li>
                <li><span className="text-zinc-700 cursor-not-allowed">Changelog</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-900 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] uppercase font-bold tracking-wider text-zinc-600">
          <p>Mag Studio © 2026. All rights reserved.</p>
          <div className="flex gap-6">
            <span>Web v4.0.0</span>
            <span>Android v{apkVersion}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
