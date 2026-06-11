import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { StudioLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from '../../components/ChordexLogo';

interface LandingLinkPreviewProps {
  children: React.ReactNode;
  src: string;
  className?: string;
  isReduced?: boolean;
}

interface PreviewAppRowProps {
  Logo: React.FC<{ size: number }>;
  name: string;
  desc: string;
}

function PreviewAppRow({ Logo, name, desc }: PreviewAppRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      padding: '7px 10px',
      background: 'rgba(255, 255, 255, 0.01)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      marginBottom: '6px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#ffffff',
      }}>
        <Logo size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {name}
        </p>
        <p style={{ fontSize: 8, color: '#a1a1aa', margin: '1px 0 0', fontWeight: 500, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {desc}
        </p>
      </div>
      <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#52525b', flexShrink: 0 }}>
        chevron_right
      </span>
    </div>
  );
}

function StudioHubPreviewCard() {
  return (
    <div className="w-full h-full bg-[#050505] text-[#ffffff] font-sans flex flex-col p-3 relative overflow-hidden select-none border border-zinc-900 rounded-lg">
      {/* Centered logo area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 16px' }}>
        <div style={{ color: 'white', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <StudioLogo size={32} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 800, margin: '6px 0 0', letterSpacing: '-0.03em', lineHeight: 1, color: '#ffffff', fontFamily: 'Manrope, sans-serif' }}>
          Studio
        </p>
      </div>

      {/* Combined welcome + apps card */}
      <div style={{
        width: '100%',
        background: '#09090b',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Welcome header */}
        <div style={{ padding: '12px 14px 10px' }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em', fontFamily: 'Manrope, sans-serif' }}>
            Welcome back.
          </p>
          <p style={{ fontSize: 9.5, color: '#a1a1aa', margin: '3px 0 0', fontWeight: 500 }}>
            Ready to lay something down?
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '0 10px' }} />

        {/* App rows */}
        <div style={{ padding: '8px', boxSizing: 'border-box' }}>
          <PreviewAppRow Logo={ChordexLogo} name="Chordex" desc="Chord theory & editor" />
          <PreviewAppRow Logo={DrumexLogo} name="Drumex" desc="Realtime drum machine" />
          <PreviewAppRow Logo={StagexLogoIcon} name="Stagex" desc="Live stage plot manager" />
          <PreviewAppRow Logo={GroovexLogo} name="Groovex" desc="Multitrack practice mixer" />
          <PreviewAppRow Logo={VocalexLogo} name="Vocalex" desc="Vocal trainer & tuner" />
        </div>
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
            <div className="w-[300px] h-[350px] p-1.5 bg-zinc-950/90 backdrop-blur-md border border-zinc-900 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] overflow-hidden">
              <StudioHubPreviewCard />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
