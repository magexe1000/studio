import React from 'react';
import { ArrowRight, Download, Monitor } from 'lucide-react';

interface LandingHeroProps {
  navigateTo: (path: string) => void;
  apkUrl?: string;
}

export default function LandingHero({ navigateTo, apkUrl }: LandingHeroProps) {
  return (
    <section className="relative pt-24 pb-20 px-6 overflow-hidden bg-[#030303]">
      {/* Premium Minimal Grid Overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />
      
      {/* Subtle Minimal Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-zinc-100/[0.015] blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Upper Brand tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/40 text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-8 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
          Studio Platform Suite v4.0
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.08] uppercase">
          Your music workflow, <br />
          <span className="text-zinc-500">in one focused workspace.</span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-xl mx-auto text-sm md:text-base text-zinc-400 leading-relaxed mb-10">
          Studio brings songs, chords, stage planning, groove practice, and vocal tools into a single cross-platform workspace. Built for instant performance.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <button
            onClick={() => {
              sessionStorage.setItem('studio:entered_from_landing', 'true');
              navigateTo('/app');
            }}
            className="w-full sm:w-auto px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs uppercase tracking-wider font-bold rounded-lg flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98]"
          >
            Use Studio Web
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          
          {apkUrl ? (
            <a
              href={apkUrl}
              className="w-full sm:w-auto px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs uppercase tracking-wider font-bold rounded-lg border border-zinc-800 hover:border-zinc-700 flex items-center justify-center gap-2 transition-all duration-300"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              Download APK
            </a>
          ) : (
            <button
              disabled
              className="w-full sm:w-auto px-6 py-3 bg-zinc-950 text-zinc-600 text-xs uppercase tracking-wider font-bold rounded-lg border border-zinc-900 cursor-not-allowed flex items-center justify-center gap-2"
            >
              APK Unavailable
            </button>
          )}

          <button
            disabled
            className="w-full sm:w-auto px-6 py-3 bg-zinc-950 text-zinc-600 text-xs uppercase tracking-wider font-bold rounded-lg border border-zinc-900 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Monitor className="w-3.5 h-3.5 text-zinc-700" />
            Windows App
          </button>
        </div>
      </div>
    </section>
  );
}
