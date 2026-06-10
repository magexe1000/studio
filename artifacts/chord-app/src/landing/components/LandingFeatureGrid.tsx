import React from 'react';
import { FEATURES_DATA } from '../landingData';

export default function LandingFeatureGrid() {
  return (
    <section id="features" className="py-24 border-t border-zinc-900 bg-[#030303] relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white uppercase mb-4">
            Technical Design Core
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
            Studio is engineered to withstand the demanding conditions of live music performance and band rehearsal settings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {FEATURES_DATA.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div 
                key={idx}
                className="p-6 rounded-lg bg-zinc-950/40 border border-zinc-900 flex flex-col gap-4 transition-all duration-300 hover:border-zinc-800"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800/80 flex items-center justify-center text-zinc-100">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{feat.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
