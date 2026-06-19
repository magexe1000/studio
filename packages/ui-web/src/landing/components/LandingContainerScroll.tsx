import { useStudioPreferences } from '@workspace/studio-core';
import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { renderMockupByName } from './StudioScreenMockups';

interface LandingContainerScrollProps {
  titleText: string;
  descriptionText: string;
  mockupName?: string;
}

export default function LandingContainerScroll({ 
  titleText, 
  descriptionText, 
  mockupName = 'stage' 
}: LandingContainerScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  });

  const { preferences } = useStudioPreferences();
  const isReduced = preferences.reduceMotion;

  // Rotation and scale transformation mapping
  const rotateXTransform = useTransform(scrollYProgress, [0, 0.45], [16, 0]);
  const scaleTransform = useTransform(scrollYProgress, [0, 0.45], [0.94, 1]);
  const translateYTransform = useTransform(scrollYProgress, [0, 0.45], [40, 0]);

  const rotateX = useSpring(rotateXTransform, { stiffness: 100, damping: 20 });
  const scale = useSpring(scaleTransform, { stiffness: 100, damping: 20 });
  const translateY = useSpring(translateYTransform, { stiffness: 100, damping: 20 });

  const [activeStep, setActiveStep] = useState<'chordSongs' | 'chordLib' | 'stage'>('chordSongs');

  const steps = [
    { id: 'chordSongs', label: '1. Songs', desc: 'Organize setlists and chord sheets' },
    { id: 'chordLib', label: '2. Chords', desc: 'Explore chords and fingering' },
    { id: 'stage', label: '3. Stage', desc: 'Design stage plots and tech riders' }
  ];

  return (
    <div 
      ref={containerRef} 
      className="w-full flex flex-col items-center py-20 px-6 overflow-hidden bg-[#030303]"
      style={{ perspective: '1000px' }}
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
        {/* Title Block */}
        <div className="mb-10 text-center max-w-2xl">
          <h2 className="text-3xl md:text-5xl font-extrabold uppercase tracking-tight text-white mb-4 landing-font-heading">
            {titleText}
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed landing-font-body">
            {descriptionText}
          </p>
        </div>

        {/* Step Switcher */}
        <div className="mb-4 flex flex-wrap justify-center gap-1.5 p-1.5 bg-[#0a0a0c] border border-zinc-900 rounded-xl max-w-md w-full">
          {steps.map(step => {
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id as any)}
                className={`flex-1 min-w-[90px] px-3 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border-none outline-none ${
                  isActive 
                    ? 'bg-zinc-100 text-[#030303] shadow-md shadow-white/5' 
                    : 'text-zinc-500 hover:text-zinc-300 bg-transparent'
                }`}
              >
                {step.label}
              </button>
            );
          })}
        </div>

        {/* Active Step Subtext */}
        <div className="mb-8 h-4 text-center">
          <span className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
            {steps.find(s => s.id === activeStep)?.desc}
          </span>
        </div>

        {/* Scrolling Animated Container */}
        <motion.div
          style={{
            rotateX: isReduced ? 0 : rotateX,
            scale: isReduced ? 1 : scale,
            y: isReduced ? 0 : translateY,
            transformStyle: 'preserve-3d'
          }}
          className="w-full border border-zinc-800 bg-zinc-950 p-2 sm:p-4 rounded-2xl md:rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative"
        >
          <div className="w-full overflow-hidden rounded-xl bg-black aspect-video border border-zinc-900 flex items-center justify-center relative min-h-[300px] md:min-h-[480px]">
            {renderMockupByName(activeStep)}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
