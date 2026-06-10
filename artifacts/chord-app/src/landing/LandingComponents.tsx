import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, MotionValue } from 'motion/react';
import { useStudioPreferences } from '../hooks/useStudioPreferences';

// =========================================================================
// ── CSS APP MOCKUPS (Vector HTML/CSS) ────────────────────────────────────
// =========================================================================

export function StudioHubMockup() {
  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex flex-col font-sans select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-extrabold text-white">S</div>
          <span className="text-xs font-bold tracking-tight">Studio Hub</span>
        </div>
        <div className="flex gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
        </div>
      </div>
      {/* App grid */}
      <div className="grid grid-cols-2 gap-2.5 flex-1 overflow-hidden">
        {[
          { name: 'Chordex', desc: 'Guitar chords & songs', color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/20' },
          { name: 'Drumex', desc: 'Snare sheets & tempo', color: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/20' },
          { name: 'Stagex', desc: 'Stage plots & riders', color: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/20' },
          { name: 'Groovex', desc: 'Multitrack mixer', color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/20' }
        ].map((app) => (
          <div key={app.name} className={`p-2.5 rounded-xl bg-gradient-to-br ${app.color} border ${app.border} flex flex-col justify-between`}>
            <div>
              <div className="text-[11px] font-bold">{app.name}</div>
              <div className="text-[8px] text-white/40 leading-normal mt-0.5">{app.desc}</div>
            </div>
            <div className="flex justify-end mt-2">
              <span className="text-[8px] font-bold text-white/80 bg-white/5 px-2 py-0.5 rounded-md">Launch</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChordexMockup() {
  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex font-sans select-none overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-1/3 border-r border-white/5 pr-3 flex flex-col gap-2">
        <div className="text-[9px] font-extrabold tracking-wider text-white/30 uppercase">Chordex Songs</div>
        <div className="flex flex-col gap-1 flex-1 overflow-hidden">
          {['Hotel California', 'Stairway to Heaven', 'Wish You Were Here'].map((song, i) => (
            <div key={song} className={`p-1.5 rounded-md text-[8px] font-semibold truncate ${i === 0 ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' : 'text-white/60 hover:bg-white/5'}`}>
              {song}
            </div>
          ))}
        </div>
      </div>
      {/* Right Content Chord Grid */}
      <div className="flex-1 pl-3 flex flex-col justify-between">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-bold text-blue-400">D Major</span>
            <span className="text-[7px] text-white/40">Open tuning</span>
          </div>
          {/* Mock Chord Grid */}
          <div className="border border-white/10 rounded-lg p-2.5 flex items-center justify-center bg-white/[0.02] h-28">
            <svg width="60" height="70" viewBox="0 0 60 70" className="opacity-80">
              {/* Frets */}
              {[10, 25, 40, 55].map(y => <line key={y} x1="5" y1={y} x2="55" y2={y} stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>)}
              {/* Strings */}
              {[5, 15, 25, 35, 45, 55].map(x => <line key={x} x1={x} y1="10" x2={x} y2="55" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>)}
              {/* Dots */}
              <circle cx="35" cy="25" r="3" fill="#60a5fa" />
              <circle cx="45" cy="40" r="3" fill="#60a5fa" />
              <circle cx="55" cy="25" r="3" fill="#60a5fa" />
              {/* Mutes/Opens */}
              <text x="3" y="8" fill="rgba(255,255,255,0.4)" fontSize="6">x</text>
              <text x="13" y="8" fill="rgba(255,255,255,0.4)" fontSize="6">o</text>
            </svg>
          </div>
        </div>
        <div className="text-[7px] text-white/30 truncate mt-2">Fingerings: T - 0 - 0 - 2 - 3 - 2</div>
      </div>
    </div>
  );
}

export function StagexMockup() {
  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex flex-col font-sans select-none overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-emerald-400">Stagex Layout</span>
        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Standard Band</span>
      </div>
      {/* Stage visual */}
      <div className="flex-1 border border-white/10 rounded-xl relative bg-white/[0.01] overflow-hidden flex items-center justify-center">
        {/* Backline grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        {/* Drums */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-col">
          <span className="text-[6px] text-emerald-400 font-bold">Drums</span>
        </div>
        {/* Vocals */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <span className="text-[6px] text-white font-bold">L-Vox</span>
        </div>
        {/* Bass */}
        <div className="absolute bottom-6 left-6 w-8 h-8 rounded bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <span className="text-[6px] text-emerald-400">Bass</span>
        </div>
        {/* Guitar */}
        <div className="absolute bottom-6 right-6 w-8 h-8 rounded bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <span className="text-[6px] text-emerald-400">Gtr</span>
        </div>
        {/* Monitors */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-4">
          <div className="w-3 h-2 bg-emerald-500/30 border border-emerald-500/50 transform rotate-12"></div>
        </div>
      </div>
    </div>
  );
}

export function GroovexMockup() {
  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex flex-col font-sans select-none overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-amber-400">Groovex Mixer</span>
        <span className="text-[8px] text-white/50">Track: Backing_Stems.wav</span>
      </div>
      {/* Mixer channels */}
      <div className="flex-1 flex gap-2 justify-around items-end pb-1">
        {[
          { name: 'Vox', level: '70%', active: true },
          { name: 'Bass', level: '50%', active: true },
          { name: 'Drums', level: '90%', active: true },
          { name: 'Back', level: '35%', active: false }
        ].map(ch => (
          <div key={ch.name} className="flex flex-col items-center gap-1.5 h-full justify-end w-1/4">
            <div className="w-3 bg-white/5 border border-white/10 rounded-full h-20 relative overflow-hidden flex items-end">
              <div style={{ height: ch.level }} className={`w-full rounded-full ${ch.active ? 'bg-gradient-to-t from-amber-500 to-yellow-400' : 'bg-white/20'}`} />
            </div>
            <span className="text-[7px] font-bold text-white/60 tracking-wider truncate">{ch.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VocalexMockup() {
  return (
    <div className="w-full h-full bg-[#09090b] text-[#f2f1ef] p-4 flex flex-col font-sans select-none overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-purple-400">Vocalex Pitch</span>
        <span className="text-[8px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-md font-bold">C# Min</span>
      </div>
      {/* Pitch track graph */}
      <div className="flex-1 border border-white/10 rounded-xl relative bg-white/[0.01] flex flex-col justify-center overflow-hidden">
        <div className="absolute left-2 top-2 text-[7px] text-white/30">Pitch (Hz)</div>
        {/* Draw a wavy pitch line */}
        <svg viewBox="0 0 160 80" className="w-full h-full opacity-80">
          {/* Note Lines */}
          <line x1="0" y1="20" x2="160" y2="20" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
          <line x1="0" y1="40" x2="160" y2="40" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
          <line x1="0" y1="60" x2="160" y2="60" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
          {/* Pitch curve */}
          <path d="M 0 50 Q 30 10, 60 45 T 120 35 T 160 55" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" />
          {/* Target bars */}
          <rect x="50" y="38" width="20" height="4" fill="rgba(168,85,247,0.3)" rx="2" />
          <rect x="100" y="32" width="25" height="4" fill="rgba(168,85,247,0.3)" rx="2" />
        </svg>
      </div>
    </div>
  );
}

// Helper object mapping mockup elements
const MOCKUP_MAP: Record<string, React.ComponentType> = {
  hub: StudioHubMockup,
  chords: ChordexMockup,
  stage: StagexMockup,
  groovex: GroovexMockup,
  vocalex: VocalexMockup,
};

// =========================================================================
// ── CONTAINER SCROLL ANIMATION ───────────────────────────────────────────
// =========================================================================

export function ContainerScroll({
  children,
  titleComponent,
}: {
  children: React.ReactNode;
  titleComponent: string | React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const { preferences } = useStudioPreferences();
  const isReduced = preferences.reduceMotion;

  // Transform rotations and scales based on scroll
  const rotateXTransform = useTransform(scrollYProgress, [0, 0.45], [20, 0]);
  const scaleTransform = useTransform(scrollYProgress, [0, 0.45], [0.92, 1]);
  const translateTransform = useTransform(scrollYProgress, [0, 0.45], [50, 0]);

  // Smoothen transitions
  const rotateX = useSpring(rotateXTransform, { stiffness: 120, damping: 18 });
  const scale = useSpring(scaleTransform, { stiffness: 120, damping: 18 });
  const translateY = useSpring(translateTransform, { stiffness: 120, damping: 18 });

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center py-12 md:py-24 px-4 overflow-hidden w-full"
      style={{ perspective: '1000px' }}
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
        <div className="mb-12 text-center">{titleComponent}</div>
        <motion.div
          style={{
            rotateX: isReduced ? 0 : rotateX,
            scale: isReduced ? 1 : scale,
            y: isReduced ? 0 : translateY,
            transformStyle: 'preserve-3d',
          }}
          className="w-full border border-white/10 rounded-2xl md:rounded-[2rem] bg-[#0c0c0e] p-2 md:p-4 shadow-2xl relative"
        >
          <div className="w-full h-full overflow-hidden rounded-xl md:rounded-2xl border border-white/5 bg-[#09090b]">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// =========================================================================
// ── MACBOOK SCROLL ───────────────────────────────────────────────────────
// =========================================================================

export function MacbookScroll({
  mockupName = 'chords',
}: {
  mockupName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const { preferences } = useStudioPreferences();
  const isReduced = preferences.reduceMotion;

  // Scroll lid opens from fully closed (-90deg relative to base axis) to open (-10deg)
  const lidRotationTransform = useTransform(scrollYProgress, [0.1, 0.55], [-90, -10]);
  const lidRotation = useSpring(lidRotationTransform, { stiffness: 140, damping: 20 });

  const Mockup = MOCKUP_MAP[mockupName] || ChordexMockup;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center py-20 px-4 w-full overflow-hidden"
      style={{ perspective: '1600px', transformStyle: 'preserve-3d' }}
    >
      {/* 3D Laptop Positioning Grid */}
      <div
        className="relative flex flex-col items-center"
        style={{
          transform: 'rotateX(20deg) translateY(20px)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* LAPTOP LID (SCREEN) */}
        <motion.div
          style={{
            transformOrigin: 'bottom center',
            transformStyle: 'preserve-3d',
            rotateX: isReduced ? -10 : lidRotation,
            zIndex: 2,
          }}
          className="relative w-[340px] h-[220px] md:w-[600px] md:h-[390px] rounded-t-2xl bg-[#09090b] border-[10px] md:border-[16px] border-[#1d1d1f] shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Inner bezel wrapper */}
          <div className="absolute inset-0 flex flex-col">
            {/* Camera dot */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#3a3a3c] z-10"></div>
            {/* Screen content */}
            <div className="flex-1 w-full h-full overflow-hidden bg-black relative">
              <Mockup />
            </div>
            {/* Bottom bezel bar */}
            <div className="h-4 md:h-6 bg-[#1d1d1f] w-full flex items-center justify-center border-t border-black/25">
              <span className="text-[5px] md:text-[8px] font-bold text-[#8e8e93] tracking-widest uppercase">Studio Web</span>
            </div>
          </div>
        </motion.div>

        {/* LAPTOP HINGE BAR */}
        <div className="w-[344px] h-[8px] md:w-[606px] md:h-[12px] bg-[#121213] rounded-b-sm border-t border-black/40 z-3 relative"></div>

        {/* LAPTOP BASE (KEYBOARD DECK) */}
        <div
          className="w-[360px] h-[10px] md:w-[640px] md:h-[16px] bg-[#2d2d30] border-t border-l border-r border-[#3a3a3c] rounded-b-xl relative shadow-2xl flex flex-col"
          style={{
            transformOrigin: 'top center',
            transform: 'rotateX(0deg)',
          }}
        >
          {/* Top casing deck lines */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-white/10"></div>
          {/* Trackpad notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-[3px] md:w-36 md:h-[5px] bg-[#18181a] rounded-b-md"></div>
          {/* Subtle reflection overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none rounded-b-xl"></div>
        </div>

        {/* Shadow underneath */}
        <div className="w-[330px] h-[24px] md:w-[580px] md:h-[48px] bg-black/50 blur-xl md:blur-2xl rounded-full absolute -bottom-4 z-1"></div>
      </div>
    </div>
  );
}

// =========================================================================
// ── 3D MARQUEE SHOWCASE ──────────────────────────────────────────────────
// =========================================================================

export function Marquee3D() {
  const cards = [
    { name: 'Studio Hub', comp: StudioHubMockup },
    { name: 'Chordex Suite', comp: ChordexMockup },
    { name: 'Stagex Planner', comp: StagexMockup },
    { name: 'Groovex Backing', comp: GroovexMockup },
    { name: 'Vocalex Trainer', comp: VocalexMockup },
  ];

  // Duplicate cards for infinite loop
  const list = [...cards, ...cards, ...cards];

  return (
    <div className="w-full overflow-hidden py-16 relative flex items-center justify-center bg-black/40">
      {/* Radial fading gradients to hide edges */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#030303] to-transparent z-10 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#030303] to-transparent z-10 pointer-events-none"></div>

      {/* Perspective wrapper */}
      <div
        className="w-full flex justify-center py-6"
        style={{
          perspective: '1200px',
        }}
      >
        {/* Rotated scroll track */}
        <div
          className="flex gap-6 relative"
          style={{
            transform: 'rotateX(22deg) rotateY(-8deg) rotateZ(-6deg)',
            transformStyle: 'preserve-3d',
            width: '100%',
          }}
        >
          <div className="animate-marquee-scroll flex gap-6">
            {list.map((item, idx) => {
              const Comp = item.comp;
              return (
                <div
                  key={idx}
                  className="w-[220px] h-[150px] md:w-[280px] md:h-[190px] rounded-2xl bg-white/[0.02] border border-white/10 shadow-2xl p-1.5 flex flex-col overflow-hidden transform transition-all duration-350 hover:scale-[1.03] hover:border-blue-500/30"
                  style={{
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <div className="flex-1 rounded-xl overflow-hidden border border-white/5 relative">
                    <Comp />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
