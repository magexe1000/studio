import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';

interface LandingLinkPreviewProps {
  children: React.ReactNode;
  src: string;
  className?: string;
  isReduced?: boolean;
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
            <div className="w-[280px] h-[175px] p-1.5 bg-zinc-950/90 backdrop-blur-md border border-zinc-900 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] overflow-hidden">
              <img
                src={src}
                alt="Studio Web Preview"
                className="w-full h-full object-cover rounded-lg border border-zinc-900/60"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
