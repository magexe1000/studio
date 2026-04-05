import type { DrumMeasure, DrumHit, DrumInstrument } from '../store/useDrumStore';

export type LibraryCategory = 'Grooves' | 'Fills' | 'Basic Beats';
export type LibraryGenre = 'Rock' | 'Pop' | 'Funk' | 'Jazz' | 'Latin' | 'Electronic' | 'Hip Hop' | 'Metal';

export interface LibraryPattern {
  id: string;
  name: string;
  category: LibraryCategory;
  genre: LibraryGenre;
  bpm: number;
  subdivision: 8 | 16;
  measures: DrumMeasure[];
}

let _mid = 0;
function m(): string { return `lib-m-${++_mid}`; }

function hits(inst: DrumInstrument, steps: number[], variation?: DrumHit['variation']): [DrumInstrument, DrumHit[]] {
  return [inst, steps.map(s => ({ step: s, length: 1, variation }))];
}

function measure(...entries: [DrumInstrument, DrumHit[]][]): DrumMeasure {
  const h: Partial<Record<DrumInstrument, DrumHit[]>> = {};
  for (const [inst, arr] of entries) {
    const existing = h[inst] ?? [];
    for (const hit of arr) {
      const idx = existing.findIndex(e => e.step === hit.step);
      if (idx >= 0) existing[idx] = hit;
      else existing.push(hit);
    }
    h[inst] = existing;
  }
  return { id: m(), hits: h };
}

export const LIBRARY_CATEGORIES: LibraryCategory[] = ['Grooves', 'Fills', 'Basic Beats'];
export const LIBRARY_GENRES: LibraryGenre[] = ['Rock', 'Pop', 'Funk', 'Jazz', 'Latin', 'Electronic', 'Hip Hop', 'Metal'];

export const DRUM_LIBRARY: LibraryPattern[] = [
  // ═══════════════════════════════════════════════════════════════════
  //  BASIC BEATS
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'lib-basic-44', name: 'Classic 4/4', category: 'Basic Beats', genre: 'Rock', bpm: 120, subdivision: 8,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7]),
      hits('snare', [2,6]),
      hits('kick', [0,4]),
    )],
  },
  {
    id: 'lib-basic-8th', name: 'Driving 8ths', category: 'Basic Beats', genre: 'Rock', bpm: 130, subdivision: 8,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7]),
      hits('snare', [2,6]),
      hits('kick', [0,3,4,7]),
    )],
  },
  {
    id: 'lib-basic-16th', name: 'Straight 16ths', category: 'Basic Beats', genre: 'Pop', bpm: 100, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
      hits('snare', [4,12]),
      hits('kick', [0,8]),
    )],
  },
  {
    id: 'lib-basic-half', name: 'Half-Time Feel', category: 'Basic Beats', genre: 'Rock', bpm: 140, subdivision: 8,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7]),
      hits('snare', [4]),
      hits('kick', [0,6]),
    )],
  },
  {
    id: 'lib-basic-pop', name: 'Pop Standard', category: 'Basic Beats', genre: 'Pop', bpm: 110, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,12]),
      hits('kick', [0,6,8]),
    )],
  },
  {
    id: 'lib-basic-open-hh', name: 'Open Hat Pulse', category: 'Basic Beats', genre: 'Pop', bpm: 105, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('hihat-closed', [6,14], 'open'),
      hits('snare', [4,12]),
      hits('kick', [0,8,10]),
    )],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  ROCK GROOVES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'lib-rock-heavy', name: 'Heavy Rock', category: 'Grooves', genre: 'Rock', bpm: 130, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,12]),
      hits('kick', [0,1,8,10]),
    )],
  },
  {
    id: 'lib-rock-anthem', name: 'Arena Rock', category: 'Grooves', genre: 'Rock', bpm: 128, subdivision: 16,
    measures: [measure(
      hits('crash', [0,8], 'ride'),
      hits('hihat-closed', [2,4,6,10,12,14]),
      hits('snare', [4,12]),
      hits('kick', [0,6,8,14]),
    )],
  },
  {
    id: 'lib-rock-punk', name: 'Punk Drive', category: 'Grooves', genre: 'Rock', bpm: 175, subdivision: 8,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7]),
      hits('snare', [2,6]),
      hits('kick', [0,1,4,5]),
    )],
  },
  {
    id: 'lib-rock-halftime', name: 'Rock Half-Time', category: 'Grooves', genre: 'Rock', bpm: 145, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [8]),
      hits('kick', [0,4,12]),
    )],
  },
  {
    id: 'lib-rock-shuffle', name: 'Rock Shuffle', category: 'Grooves', genre: 'Rock', bpm: 125, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,3,4,7,8,11,12,15]),
      hits('snare', [4,12]),
      hits('kick', [0,7,8]),
    )],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  POP GROOVES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'lib-pop-verse', name: 'Verse Groove', category: 'Grooves', genre: 'Pop', bpm: 95, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,12]),
      hits('kick', [0,5,8,10]),
    )],
  },
  {
    id: 'lib-pop-chorus', name: 'Pop Chorus', category: 'Grooves', genre: 'Pop', bpm: 118, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('hihat-closed', [14], 'open'),
      hits('snare', [4,12]),
      hits('kick', [0,3,8,11]),
    )],
  },
  {
    id: 'lib-pop-four-floor', name: 'Four on the Floor', category: 'Grooves', genre: 'Pop', bpm: 120, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,12]),
      hits('kick', [0,4,8,12]),
    )],
  },
  {
    id: 'lib-pop-ballad', name: 'Ballad', category: 'Grooves', genre: 'Pop', bpm: 72, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,12]),
      hits('kick', [0,10]),
    )],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  FUNK GROOVES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'lib-funk-ghost', name: 'Ghost Note Funk', category: 'Grooves', genre: 'Funk', bpm: 95, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,12]),
      hits('snare', [2,6,10,14], 'ghost'),
      hits('kick', [0,7,8,11]),
    )],
  },
  {
    id: 'lib-funk-pocket', name: 'Pocket Groove', category: 'Grooves', genre: 'Funk', bpm: 92, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,12]),
      hits('snare', [1,9,14], 'ghost'),
      hits('kick', [0,5,8,13]),
    )],
  },
  {
    id: 'lib-funk-syncopated', name: 'Syncopated Funk', category: 'Grooves', genre: 'Funk', bpm: 100, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
      hits('hihat-closed', [4,12], 'open'),
      hits('snare', [4,12]),
      hits('snare', [3,7,11,15], 'ghost'),
      hits('kick', [0,6,8,9,14]),
    )],
  },
  {
    id: 'lib-funk-breakbeat', name: 'Breakbeat', category: 'Grooves', genre: 'Funk', bpm: 110, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,10]),
      hits('kick', [0,6,8,14]),
    )],
  },
  {
    id: 'lib-funk-james', name: 'JB Funk', category: 'Grooves', genre: 'Funk', bpm: 108, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('hihat-closed', [6], 'open'),
      hits('snare', [4,13]),
      hits('snare', [2,7,10], 'ghost'),
      hits('kick', [0,5,8,11]),
    )],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  JAZZ GROOVES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'lib-jazz-swing', name: 'Swing Ride', category: 'Grooves', genre: 'Jazz', bpm: 140, subdivision: 16,
    measures: [measure(
      hits('crash', [0,4,7,8,12,15], 'ride'),
      hits('hihat-closed', [4,12], 'pedal'),
      hits('kick', [0,11]),
    )],
  },
  {
    id: 'lib-jazz-brush', name: 'Brush Comping', category: 'Grooves', genre: 'Jazz', bpm: 120, subdivision: 16,
    measures: [measure(
      hits('crash', [0,3,4,7,8,11,12,15], 'ride'),
      hits('hihat-closed', [4,12], 'pedal'),
      hits('snare', [3,11], 'ghost'),
      hits('kick', [0,10]),
    )],
  },
  {
    id: 'lib-jazz-bossa', name: 'Bossa Nova', category: 'Grooves', genre: 'Jazz', bpm: 130, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [3,7,11,15], 'ghost'),
      hits('kick', [0,6]),
    )],
  },
  {
    id: 'lib-jazz-waltz', name: 'Jazz Waltz', category: 'Grooves', genre: 'Jazz', bpm: 160, subdivision: 16,
    measures: [measure(
      hits('crash', [0,4,8,12], 'ride'),
      hits('hihat-closed', [4,12], 'pedal'),
      hits('kick', [0]),
    )],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  LATIN GROOVES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'lib-latin-samba', name: 'Samba', category: 'Grooves', genre: 'Latin', bpm: 100, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [3,7,11,15], 'ghost'),
      hits('snare', [4,12]),
      hits('kick', [0,5,8,13]),
    )],
  },
  {
    id: 'lib-latin-tumbao', name: 'Tumbao', category: 'Grooves', genre: 'Latin', bpm: 105, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [7,15]),
      hits('kick', [0,4,8,12]),
      hits('tom-floor', [3,11]),
    )],
  },
  {
    id: 'lib-latin-reggaeton', name: 'Reggaeton', category: 'Grooves', genre: 'Latin', bpm: 95, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [3,7,11,15]),
      hits('kick', [0,4,8,12]),
    )],
  },
  {
    id: 'lib-latin-cha', name: 'Cha-Cha', category: 'Grooves', genre: 'Latin', bpm: 120, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,8,12]),
      hits('kick', [0,6]),
    )],
  },
  {
    id: 'lib-latin-afrobeat', name: 'Afrobeat', category: 'Grooves', genre: 'Latin', bpm: 112, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
      hits('hihat-closed', [6,14], 'open'),
      hits('snare', [4,12]),
      hits('snare', [2,10], 'ghost'),
      hits('kick', [0,5,8,11]),
    )],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  ELECTRONIC GROOVES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'lib-elec-house', name: 'House Pulse', category: 'Grooves', genre: 'Electronic', bpm: 128, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('hihat-closed', [6,14], 'open'),
      hits('snare', [4,12]),
      hits('kick', [0,4,8,12]),
    )],
  },
  {
    id: 'lib-elec-techno', name: 'Techno Drive', category: 'Grooves', genre: 'Electronic', bpm: 135, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('hihat-closed', [2,6,10,14], 'open'),
      hits('snare', [4,12], 'rimshot'),
      hits('kick', [0,4,8,12]),
    )],
  },
  {
    id: 'lib-elec-dnb', name: 'DnB Amen', category: 'Grooves', genre: 'Electronic', bpm: 174, subdivision: 16,
    measures: [measure(
      hits('crash', [0,2,4,6,8,10,12,14], 'ride'),
      hits('snare', [4,10]),
      hits('kick', [0,6,8,14]),
    )],
  },
  {
    id: 'lib-elec-garage', name: '2-Step Garage', category: 'Grooves', genre: 'Electronic', bpm: 138, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,3,6,8,10,11,14]),
      hits('snare', [4,12]),
      hits('kick', [0,7,11]),
    )],
  },
  {
    id: 'lib-elec-synthwave', name: 'Synthwave', category: 'Grooves', genre: 'Electronic', bpm: 118, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,12]),
      hits('kick', [0,4,8,12]),
      hits('tom-mid', [14]),
    )],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  HIP HOP GROOVES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'lib-hh-boom', name: 'Boom Bap', category: 'Grooves', genre: 'Hip Hop', bpm: 90, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('snare', [4,12]),
      hits('kick', [0,5,8,10]),
    )],
  },
  {
    id: 'lib-hh-trap', name: 'Trap Beat', category: 'Grooves', genre: 'Hip Hop', bpm: 140, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
      hits('snare', [4,12]),
      hits('kick', [0,3,7,8,11]),
    )],
  },
  {
    id: 'lib-hh-lofi', name: 'Lo-Fi Chill', category: 'Grooves', genre: 'Hip Hop', bpm: 80, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,3,6,8,10,14]),
      hits('snare', [4,12]),
      hits('snare', [9], 'ghost'),
      hits('kick', [0,6,10]),
    )],
  },
  {
    id: 'lib-hh-drill', name: 'Drill Slide', category: 'Grooves', genre: 'Hip Hop', bpm: 142, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
      hits('hihat-closed', [3,7,11,15], 'open'),
      hits('snare', [4,12]),
      hits('kick', [0,2,8,10,14]),
    )],
  },
  {
    id: 'lib-hh-old-school', name: 'Old School', category: 'Grooves', genre: 'Hip Hop', bpm: 94, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10,12,14]),
      hits('hihat-closed', [6], 'open'),
      hits('snare', [4,12]),
      hits('kick', [0,3,8,11]),
    )],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  METAL GROOVES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'lib-metal-thrash', name: 'Thrash Beat', category: 'Grooves', genre: 'Metal', bpm: 200, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
      hits('snare', [4,12]),
      hits('kick', [0,2,4,6,8,10,12,14]),
    )],
  },
  {
    id: 'lib-metal-blast', name: 'Blast Beat', category: 'Grooves', genre: 'Metal', bpm: 220, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
      hits('snare', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
      hits('kick', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
    )],
  },
  {
    id: 'lib-metal-double', name: 'Double Kick', category: 'Grooves', genre: 'Metal', bpm: 160, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,4,8,12]),
      hits('crash', [0], 'ride'),
      hits('snare', [4,12]),
      hits('kick', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
    )],
  },
  {
    id: 'lib-metal-halftime', name: 'Metal Half-Time', category: 'Grooves', genre: 'Metal', bpm: 130, subdivision: 16,
    measures: [measure(
      hits('crash', [0,2,4,6,8,10,12,14], 'ride'),
      hits('snare', [8]),
      hits('kick', [0,2,4,12,14]),
    )],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  FILLS
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'lib-fill-basic', name: 'Snare Roll', category: 'Fills', genre: 'Rock', bpm: 120, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6]),
      hits('snare', [4]),
      hits('kick', [0]),
      hits('snare', [8,9,10,11,12,13,14,15]),
    )],
  },
  {
    id: 'lib-fill-toms-down', name: 'Tom Cascade', category: 'Fills', genre: 'Rock', bpm: 120, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6]),
      hits('snare', [4]),
      hits('kick', [0]),
      hits('tom-high', [8,9]),
      hits('tom-mid', [10,11]),
      hits('tom-floor', [12,13]),
      hits('crash', [14,15]),
    )],
  },
  {
    id: 'lib-fill-funk', name: 'Funk Fill', category: 'Fills', genre: 'Funk', bpm: 100, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6]),
      hits('snare', [4]),
      hits('kick', [0]),
      hits('snare', [8,11,14]),
      hits('kick', [9,12]),
      hits('tom-floor', [10,13,15]),
    )],
  },
  {
    id: 'lib-fill-triplet', name: 'Triplet Fill', category: 'Fills', genre: 'Rock', bpm: 110, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6]),
      hits('snare', [4]),
      hits('kick', [0]),
      hits('tom-high', [8,10]),
      hits('snare', [9,11]),
      hits('tom-mid', [12,14]),
      hits('tom-floor', [13,15]),
    )],
  },
  {
    id: 'lib-fill-buildup', name: 'Buildup', category: 'Fills', genre: 'Electronic', bpm: 128, subdivision: 16,
    measures: [measure(
      hits('snare', [0,4,6,8,9,10,11,12,13,14,15]),
      hits('kick', [0,4,8,12]),
    )],
  },
  {
    id: 'lib-fill-linear', name: 'Linear Fill', category: 'Fills', genre: 'Funk', bpm: 95, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6]),
      hits('snare', [4]),
      hits('kick', [0]),
      hits('kick', [8,11,14]),
      hits('snare', [9,12,15]),
      hits('hihat-closed', [10,13]),
    )],
  },
  {
    id: 'lib-fill-half-bar', name: 'Quick Turnaround', category: 'Fills', genre: 'Pop', bpm: 115, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6,8,10]),
      hits('snare', [4]),
      hits('kick', [0,8]),
      hits('snare', [12,13]),
      hits('tom-floor', [14]),
      hits('crash', [15]),
    )],
  },
  {
    id: 'lib-fill-jazz', name: 'Jazz Turnaround', category: 'Fills', genre: 'Jazz', bpm: 140, subdivision: 16,
    measures: [measure(
      hits('crash', [0,4,8], 'ride'),
      hits('snare', [3,7], 'ghost'),
      hits('kick', [0]),
      hits('tom-high', [10]),
      hits('tom-mid', [11]),
      hits('snare', [12]),
      hits('tom-floor', [13]),
      hits('crash', [14]),
      hits('kick', [15]),
    )],
  },
  {
    id: 'lib-fill-metal', name: 'Double Kick Fill', category: 'Fills', genre: 'Metal', bpm: 180, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,4]),
      hits('snare', [4]),
      hits('kick', [0,1,2,3]),
      hits('tom-high', [8,9]),
      hits('snare', [10,11]),
      hits('kick', [12,13,14,15]),
    )],
  },
  {
    id: 'lib-fill-latin', name: 'Latin Fill', category: 'Fills', genre: 'Latin', bpm: 105, subdivision: 16,
    measures: [measure(
      hits('hihat-closed', [0,2,4,6]),
      hits('snare', [4]),
      hits('kick', [0]),
      hits('tom-high', [8,10]),
      hits('snare', [9,11], 'rimshot'),
      hits('tom-floor', [12,14]),
      hits('kick', [13,15]),
    )],
  },
];
