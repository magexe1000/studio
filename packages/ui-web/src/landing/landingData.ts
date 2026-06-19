import { 
  ShieldCheck, 
  Zap, 
  Layout,
  Smartphone,
  Sliders
} from 'lucide-react';
import React from 'react';

export interface AppInfo {
  key: string;
  name: string;
  badge: string;
  desc: string;
  bullets: string[];
  colorClass: string;
  hoverColor: string;
}

export const APPS_DATA: AppInfo[] = [
  {
    key: 'chords',
    name: 'Chordex',
    badge: 'Songs & Chords',
    desc: 'Manage song databases, organize chord sheets, transpose keys instantly, and reference chord fingering diagrams.',
    bullets: [
      'Interactive chord library & diagrams',
      'Key transpositions & setlist manager',
      'Custom song chord sheet configurations'
    ],
    colorClass: 'border-white/10 group-hover:border-zinc-200/40',
    hoverColor: 'rgba(255, 255, 255, 0.04)'
  },
  {
    key: 'stage',
    name: 'Stagex',
    badge: 'Stage Plots',
    desc: 'Map out stage plots and gear placements, construct input grids, and export technical riders for sound engineers.',
    bullets: [
      'Drag-and-drop gear, monitor, and amp nodes',
      'Technical rider exports & input charts',
      'Band setup template configurations'
    ],
    colorClass: 'border-white/10 group-hover:border-zinc-200/40',
    hoverColor: 'rgba(255, 255, 255, 0.04)'
  },
  {
    key: 'groovex',
    name: 'Groovex',
    badge: 'Practice Mixer',
    desc: 'Rehearse with multitrack stem files. Control volume levels, mute channels, loop segments, and speed-train tempo.',
    bullets: [
      'Low-latency multitrack fader mixing',
      'Flexible A-B segment loops & scale trainer',
      'Custom backing stem integrations'
    ],
    colorClass: 'border-white/10 group-hover:border-zinc-200/40',
    hoverColor: 'rgba(255, 255, 255, 0.04)'
  },
  {
    key: 'drums',
    name: 'Drumex',
    badge: 'Rhythm & Click',
    desc: 'Write snare sheets, practice complex rhythms, and synchronize tempo using visual click and metronome indicators.',
    bullets: [
      'Snare drum chart rudiment editor',
      'Dynamic speed tempo click system',
      'Interactive visual beat-pulse grid'
    ],
    colorClass: 'border-white/10 group-hover:border-zinc-200/40',
    hoverColor: 'rgba(255, 255, 255, 0.04)'
  },
  {
    key: 'vocalex',
    name: 'Vocalex',
    badge: 'Vocal Tools',
    desc: 'Evaluate vocal pitch in real-time, trace accuracy, and record multiple audio takes to local device storage.',
    bullets: [
      'Real-time vocal pitch visual tracing',
      'Safe local audio take recorder & logger',
      'Warmup scales & target interval training'
    ],
    colorClass: 'border-white/10 group-hover:border-zinc-200/40',
    hoverColor: 'rgba(255, 255, 255, 0.04)'
  }
];

export interface FeatureInfo {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}

export const FEATURES_DATA: FeatureInfo[] = [
  {
    icon: Layout,
    title: 'Adaptive Layout',
    desc: 'Web 4.0.0 responsive dashboard fits perfectly on high-res monitors, staging tablets, and mobile phones.'
  },
  {
    icon: Smartphone,
    title: 'Android APK',
    desc: 'Download and install the native Android package for lightweight, dedicated performance on the move.'
  },
  {
    icon: Sliders,
    title: 'Local Preferences',
    desc: 'Retain custom settings, appearance options, and tool states directly within your browser cache.'
  },
  {
    icon: ShieldCheck,
    title: 'No Setup Required',
    desc: 'Access your full music workspace instantly over secure HTTPS without running any installers.'
  }
];
