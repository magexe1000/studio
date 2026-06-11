import React from 'react';
import { motion } from 'motion/react';
import { useStudioPreferences } from '../../hooks/useStudioPreferences';
import { 
  ChordexFeatureSkeleton, 
  StagexFeatureSkeleton, 
  GroovexFeatureSkeleton 
} from './StudioFeatureSkeletons';

export default function LandingAppSuite() {
  const { preferences } = useStudioPreferences();
  const isReduced = preferences.reduceMotion;

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: isReduced ? 0 : 0.1,
      },
    },
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: isReduced ? 0 : 28 
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: isReduced ? 0 : 0.65,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    },
  };

  const features = [
    {
      app: 'chordex',
      title: 'Organize songs, chords, and setlists.',
      desc: 'Build song presets, browse chord shapes, manage progressions, and keep your set material ready.',
      Skeleton: ChordexFeatureSkeleton,
    },
    {
      app: 'stagex',
      title: 'Plan the stage before the gig.',
      desc: 'Map stage layouts, organize gear placement, and prepare cleaner setup information for live shows.',
      Skeleton: StagexFeatureSkeleton,
    },
    {
      app: 'groovex',
      title: 'Practice with a focused groove workspace.',
      desc: 'Use mixer-style controls and practice views to stay locked into rhythm and arrangement ideas.',
      Skeleton: GroovexFeatureSkeleton,
    },
  ];

  return (
    <section id="suite" className="py-24 border-t border-zinc-900 bg-[#050508]/40 relative select-none">
      {/* Decorative background grid effect */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header Block */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white uppercase mb-5 leading-tight landing-font-heading">
            Built for focused music workflows.
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed max-w-2xl mx-auto landing-font-body">
            Studio connects the core parts of a modern music workflow: organizing songs and chords, preparing stage layouts, and practicing with groove-focused tools.
          </p>
        </div>

        {/* Features Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {features.map(({ app, title, desc, Skeleton }) => (
            <motion.div
              key={app}
              variants={cardVariants}
              className="group relative flex flex-col rounded-2xl bg-zinc-950/40 border border-zinc-900 overflow-hidden transition-all duration-300 hover:border-zinc-800 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.8)]"
            >
              {/* Skeleton Area */}
              <div className="h-[210px] w-full border-b border-zinc-900 bg-[#020202] relative overflow-hidden shadow-[inset_0_4px_24px_rgba(0,0,0,0.6)]">
                <div className="absolute inset-0 bg-grid-pattern opacity-[0.015] pointer-events-none" />
                <Skeleton />
              </div>

              {/* Text Description Area */}
              <div className="p-6 flex flex-col flex-1 gap-2">
                <h3 className="text-sm md:text-base font-bold text-white uppercase tracking-wider leading-snug landing-font-heading">
                  {title}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed landing-font-body">
                  {desc}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
