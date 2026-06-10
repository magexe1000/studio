import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { StudioLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from '../../components/ChordexLogo';

interface LandingLinkPreviewProps {
  children: React.ReactNode;
  src: string;
  className?: string;
  isReduced?: boolean;
}

function StudioHubPreviewCard() {
  return (
    <div className="w-full h-full bg-[#050505] text-[#ffffff] font-sans flex flex-col p-2.5 relative overflow-hidden select-none border border-zinc-900 rounded-lg">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-zinc-900/60 pb-1.5 mb-2.5">
        <div className="flex items-center gap-1.5">
          <StudioLogo size={14} />
          <span className="font-extrabold text-[10px] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Studio Hub</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-wider">Ready</span>
        </div>
      </div>

      {/* Grid of Apps */}
      <div className="grid grid-cols-3 gap-2 flex-grow px-0.5">
        {/* Chordex */}
        <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-md flex flex-col justify-between">
          <div className="flex-shrink-0 text-white">
            <ChordexLogo size={12} />
          </div>
          <div>
            <div className="text-[8px] font-bold">Chordex</div>
            <div className="text-[5px] text-zinc-500">Chord Theory</div>
          </div>
        </div>

        {/* Drumex */}
        <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-md flex flex-col justify-between">
          <div className="flex-shrink-0 text-white">
            <DrumexLogo size={12} />
          </div>
          <div>
            <div className="text-[8px] font-bold">Drumex</div>
            <div className="text-[5px] text-zinc-500">Drum Machine</div>
          </div>
        </div>

        {/* Stagex */}
        <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-md flex flex-col justify-between">
          <div className="flex-shrink-0 text-white">
            <StagexLogoIcon size={12} />
          </div>
          <div>
            <div className="text-[8px] font-bold">Stagex</div>
            <div className="text-[5px] text-zinc-500">Stage Plots</div>
          </div>
        </div>

        {/* Groovex */}
        <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-md flex flex-col justify-between">
          <div className="flex-shrink-0 text-white">
            <GroovexLogo size={12} />
          </div>
          <div>
            <div className="text-[8px] font-bold">Groovex</div>
            <div className="text-[5px] text-zinc-500">Practice Mixer</div>
          </div>
        </div>

        {/* Vocalex */}
        <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-md flex flex-col justify-between">
          <div className="flex-shrink-0 text-white">
            <VocalexLogo size={12} />
          </div>
          <div>
            <div className="text-[8px] font-bold">Vocalex</div>
            <div className="text-[5px] text-zinc-500">Vocal Trainer</div>
          </div>
        </div>

        {/* Settings */}
        <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-md flex flex-col justify-between">
          <div className="flex-shrink-0 text-zinc-400 flex items-center">
            <span className="material-symbols-outlined" style={{ fontSize: 12, display: 'block' }}>settings</span>
          </div>
          <div>
            <div className="text-[8px] font-bold">Settings</div>
            <div className="text-[5px] text-zinc-500">Preferences</div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Dock */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-zinc-950/90 border border-zinc-900 rounded-full py-0.5 px-2 flex items-center gap-2 shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
        <div className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center text-black flex-shrink-0">
          <StudioLogo size={8} />
        </div>
        <div className="text-zinc-500"><ChordexLogo size={8} /></div>
        <div className="text-zinc-500"><DrumexLogo size={8} /></div>
        <div className="text-zinc-500"><StagexLogoIcon size={8} /></div>
        <div className="text-zinc-500"><GroovexLogo size={8} /></div>
        <div className="text-zinc-500"><VocalexLogo size={8} /></div>
      </div>
    </div>
  );
}

export default function LandingLinkPreview({
  children,
  src,
  className = '',
  isReduced = false,
}: LandingLinkPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 180, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isReduced) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      mouseX.set(localX);
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      mouseX.set(localX);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      className={`relative inline-block ${className}`}
    >
      {children}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{
              type: 'spring',
              stiffness: 240,
              damping: 18,
            }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: isReduced ? '50%' : springX,
              x: '-50%',
              marginBottom: '12px',
              zIndex: 50,
              pointerEvents: 'none',
            }}
          >
            <div className="w-[300px] h-[190px] p-1.5 bg-zinc-950/90 backdrop-blur-md border border-zinc-900 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] overflow-hidden">
              <StudioHubPreviewCard />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
