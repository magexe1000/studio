import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { useStudioPreferences } from '../../hooks/useStudioPreferences';
import { renderMockupByName } from './StudioScreenMockups';

interface LandingContainerScrollProps {
  titleText: string;
  descriptionText: string;
  mockupName?: string;
}

export default function LandingContainerScroll({ 
  titleText, 
  descriptionText, 
  mockupName = 'groovex' 
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

  return (
    <div 
      ref={containerRef} 
      className="w-full flex flex-col items-center py-20 px-6 overflow-hidden bg-[#030303]"
      style={{ perspective: '1000px' }}
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
        {/* Title Block */}
        <div className="mb-14 text-center max-w-2xl">
          <h2 className="text-3xl md:text-5xl font-extrabold uppercase tracking-tight text-white mb-4 landing-font-heading">
            {titleText}
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed landing-font-body">
            {descriptionText}
          </p>
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
            {renderMockupByName(mockupName)}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
