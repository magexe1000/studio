import React from 'react';
import { FEATURES_DATA } from '../landingData';
import { motion } from 'motion/react';
import { useStudioPreferences } from '../../hooks/useStudioPreferences';

export default function LandingFeatureGrid() {
  const { preferences } = useStudioPreferences();
  const isReduced = preferences.reduceMotion;

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: isReduced ? 0 : 0.06,
      },
    },
  };

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: isReduced ? 0 : 16 
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: isReduced ? 0 : 0.5,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    },
  };

  return (
    <section id="features" className="py-24 border-t border-zinc-900 bg-[#030303] relative select-none">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white uppercase mb-4 landing-font-heading">
            Technical Design Core
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed landing-font-body">
            Studio is engineered to withstand the demanding conditions of live music performance and band rehearsal settings.
          </p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {FEATURES_DATA.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div 
                key={idx}
                variants={itemVariants}
                className="p-6 rounded-lg bg-zinc-950/40 border border-zinc-900 flex flex-col gap-4 transition-all duration-300 hover:border-zinc-800"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800/80 flex items-center justify-center text-zinc-100">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider landing-font-heading">{feat.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed landing-font-body">
                  {feat.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
