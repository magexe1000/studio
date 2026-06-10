import { 
  Music, 
  Layers, 
  Sliders, 
  Activity, 
  Mic, 
  CloudLightning, 
  ShieldCheck, 
  Zap, 
  Monitor 
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
    name: 'Chordex Library',
    badge: 'Chords & Songs',
    desc: 'Organize song chord sheets, transpose keys on the fly, and search custom guitar fingering diagrams.',
    bullets: [
      'Interactive guitar chord library & diagrams',
      'Key transpositions & setlist manager',
      'Custom fingering templates support'
    ],
    colorClass: 'border-white/10 group-hover:border-zinc-200/40',
    hoverColor: 'rgba(255, 255, 255, 0.04)'
  },
  {
    key: 'stage',
    name: 'Stagex Layout',
    badge: 'Stage Plots',
    desc: 'Design stage gear arrangements. Build input grids and share layout rider sheets directly with sound crews.',
    bullets: [
      'Drag-and-drop gear, amp, and monitor nodes',
      'Technical rider exports & input charts',
      'Band setup template configurations'
    ],
    colorClass: 'border-white/10 group-hover:border-zinc-200/40',
    hoverColor: 'rgba(255, 255, 255, 0.04)'
  },
  {
    key: 'groovex',
    name: 'Groovex Mixer',
    badge: 'Stems Player',
    desc: 'Rehearse with multitracks. Adjust levels, mute backing channels, speed-train tempos, and loop sections.',
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
    name: 'Drumex Sheets',
    badge: 'Drum Sheets & Click',
    desc: 'Arrange snare sheets, practice rudiments, and synchronize timing with visual metronome indicators.',
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
    name: 'Vocalex Training',
    badge: 'Voice Pitch',
    desc: 'Train vocal control. Track pitch accuracy in real-time, trace notes, and record multiple vocal takes.',
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
    icon: CloudLightning,
    title: 'Instant Cloud Sync',
    desc: 'Sync favorites, setlists, and stage layouts across your devices automatically using your secure account.'
  },
  {
    icon: ShieldCheck,
    title: 'Offline-First Engine',
    desc: 'Rehearse in deep basement studios or perform on stage. Local storage keeps you responsive without internet.'
  },
  {
    icon: Zap,
    title: 'Optimized Framework',
    desc: 'Built cleanly without heavy layout shifts. Conserves battery life on older stage tablets and mobile phones.'
  },
  {
    icon: Monitor,
    title: 'Web Audio Core',
    desc: 'Integrates real-time, low-latency pitch detection and multitrack stem audio directly in standard web engines.'
  }
];
