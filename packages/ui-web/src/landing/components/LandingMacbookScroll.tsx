import { useStudioPreferences } from '@workspace/studio-core';
import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { renderMockupByName } from './StudioScreenMockups';

interface LandingMacbookScrollProps {
  mockupName?: string;
}

export default function LandingMacbookScroll({ mockupName = 'hub' }: LandingMacbookScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  });

  const { preferences } = useStudioPreferences();
  const isReduced = preferences.reduceMotion;

  // Scroll lid opens from fully closed (-90deg) to upright (-10deg)
  const rotateXTransform = useTransform(scrollYProgress, [0.1, 0.45], [-90, -10]);
  const rotateX = useSpring(rotateXTransform, { stiffness: 100, damping: 22 });

  return (
    <div 
      ref={containerRef} 
      className="w-full flex flex-col items-center justify-center py-12 overflow-hidden"
      style={{ perspective: '1500px', transformStyle: 'preserve-3d' }}
    >
      <div 
        className="relative flex flex-col items-center select-none"
        style={{
          transform: 'rotateX(15deg) translateY(0px)',
          transformStyle: 'preserve-3d'
        }}
      >
        {/* LAPTOP LID */}
        <motion.div
          style={{
            transformOrigin: 'bottom center',
            transformStyle: 'preserve-3d',
            rotateX: isReduced ? -10 : rotateX,
            zIndex: 2
          }}
          className="relative w-[320px] h-[200px] sm:w-[520px] sm:h-[330px] md:w-[680px] md:h-[430px] rounded-t-xl bg-[#09090b] border-[8px] sm:border-[12px] md:border-[16px] border-[#1d1d1f] shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Inner bezel wrapper */}
          <div className="absolute inset-0 flex flex-col">
            {/* Camera */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-zinc-800 z-10" />
            
            {/* Screen Content */}
            <div className="flex-1 w-full h-full overflow-hidden bg-black relative">
              {renderMockupByName(mockupName)}
            </div>

            {/* Bottom bezel bar */}
            <div className="h-4 sm:h-5 md:h-6 bg-[#1d1d1f] w-full flex items-center justify-center border-t border-black/25">
              <span className="text-[5px] sm:text-[7px] font-bold text-zinc-500 tracking-wider uppercase">Studio Dashboard</span>
            </div>
          </div>
        </motion.div>

        {/* HINGE */}
        <div className="w-[324px] h-[6px] sm:w-[526px] sm:h-[10px] md:w-[686px] md:h-[12px] bg-[#121213] rounded-b-sm border-t border-black/30 z-10 relative" />

        {/* KEYBOARD DECK */}
        <div 
          className="w-[340px] h-[8px] sm:w-[550px] sm:h-[12px] md:w-[720px] md:h-[14px] bg-[#2d2d30] border-t border-l border-r border-[#3a3a3c] rounded-b-xl relative shadow-2xl flex flex-col"
          style={{
            transformOrigin: 'top center',
            transform: 'rotateX(0deg)'
          }}
        >
          {/* Trackpad notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-[2px] sm:w-28 sm:h-[3px] md:w-36 md:h-[4px] bg-[#18181a] rounded-b" />
          {/* Reflection */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none rounded-b-xl" />
        </div>

        {/* Shadow */}
        <div className="w-[310px] h-[20px] sm:w-[500px] sm:h-[35px] md:w-[650px] md:h-[45px] bg-black/60 blur-xl rounded-full absolute -bottom-6 z-0" />
      </div>
    </div>
  );
}
