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

function H(inst: DrumInstrument, steps: number[], v?: DrumHit['variation']): [DrumInstrument, DrumHit[]] {
  return [inst, steps.map(s => ({ step: s, length: 1, variation: v }))];
}

function M(...entries: [DrumInstrument, DrumHit[]][]): DrumMeasure {
  const h: Partial<Record<DrumInstrument, DrumHit[]>> = {};
  for (const [inst, arr] of entries) {
    const ex = h[inst] ?? [];
    for (const hit of arr) {
      const idx = ex.findIndex(e => e.step === hit.step);
      if (idx >= 0) ex[idx] = hit; else ex.push(hit);
    }
    h[inst] = ex;
  }
  return { id: m(), hits: h };
}

function P(id: string, name: string, cat: LibraryCategory, genre: LibraryGenre, bpm: number, sub: 8|16, ...measures: DrumMeasure[]): LibraryPattern {
  return { id, name, category: cat, genre, bpm, subdivision: sub, measures };
}

export const LIBRARY_CATEGORIES: LibraryCategory[] = ['Grooves', 'Fills', 'Basic Beats'];
export const LIBRARY_GENRES: LibraryGenre[] = ['Rock', 'Pop', 'Funk', 'Jazz', 'Latin', 'Electronic', 'Hip Hop', 'Metal'];

const hh = 'hihat-closed' as DrumInstrument;
const sn = 'snare' as DrumInstrument;
const kk = 'kick' as DrumInstrument;
const cr = 'crash' as DrumInstrument;
const th = 'tom-high' as DrumInstrument;
const tm = 'tom-mid' as DrumInstrument;
const tf = 'tom-floor' as DrumInstrument;

export const DRUM_LIBRARY: LibraryPattern[] = [

  // ═══════════════════════════════════════════════════════════════════════
  //  BASIC BEATS (12)
  // ═══════════════════════════════════════════════════════════════════════
  P('bb-01','Classic 4/4','Basic Beats','Rock',120,8,
    M(H(hh,[0,1,2,3,4,5,6,7]),H(sn,[2,6]),H(kk,[0,4]))),
  P('bb-02','Driving 8ths','Basic Beats','Rock',130,8,
    M(H(hh,[0,1,2,3,4,5,6,7]),H(sn,[2,6]),H(kk,[0,3,4,7]))),
  P('bb-03','Straight 16ths','Basic Beats','Pop',100,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(sn,[4,12]),H(kk,[0,8]))),
  P('bb-04','Half-Time Feel','Basic Beats','Rock',140,8,
    M(H(hh,[0,1,2,3,4,5,6,7]),H(sn,[4]),H(kk,[0,6]))),
  P('bb-05','Pop Standard','Basic Beats','Pop',110,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,6,8]))),
  P('bb-06','Open Hat Pulse','Basic Beats','Pop',105,16,
    M(H(hh,[0,2,4,8,10,12]),H(hh,[6,14],'open'),H(sn,[4,12]),H(kk,[0,8,10]))),
  P('bb-07','Simple Rock','Basic Beats','Rock',112,8,
    M(H(hh,[0,1,2,3,4,5,6,7]),H(sn,[2,6]),H(kk,[0,2,4,6]))),
  P('bb-08','Quarter Notes','Basic Beats','Pop',96,8,
    M(H(hh,[0,2,4,6]),H(sn,[2,6]),H(kk,[0,4]))),
  P('bb-09','Sparse Groove','Basic Beats','Jazz',85,16,
    M(H(hh,[0,4,8,12]),H(sn,[4,12]),H(kk,[0,10]))),
  P('bb-10','Country Two-Step','Basic Beats','Pop',115,8,
    M(H(hh,[0,1,2,3,4,5,6,7]),H(sn,[2,6]),H(kk,[0,1,4,5]))),
  P('bb-11','Disco Beat','Basic Beats','Pop',118,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(hh,[2,6,10,14],'open'),H(sn,[4,12]),H(kk,[0,4,8,12]))),
  P('bb-12','Reggae One Drop','Basic Beats','Latin',80,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[12]),H(kk,[12]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  ROCK GROOVES (12)
  // ═══════════════════════════════════════════════════════════════════════
  P('gr-r01','Heavy Rock','Grooves','Rock',130,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,1,8,10]))),
  P('gr-r02','Arena Rock','Grooves','Rock',128,16,
    M(H(cr,[0,8],'ride'),H(hh,[2,4,6,10,12,14]),H(sn,[4,12]),H(kk,[0,6,8,14]))),
  P('gr-r03','Punk Drive','Grooves','Rock',175,8,
    M(H(hh,[0,1,2,3,4,5,6,7]),H(sn,[2,6]),H(kk,[0,1,4,5]))),
  P('gr-r04','Rock Half-Time','Grooves','Rock',145,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[8]),H(kk,[0,4,12]))),
  P('gr-r05','Rock Shuffle','Grooves','Rock',125,16,
    M(H(hh,[0,3,4,7,8,11,12,15]),H(sn,[4,12]),H(kk,[0,7,8]))),
  P('gr-r06','Classic Rock','Grooves','Rock',120,16,
    M(H(cr,[0,2,4,6,8,10,12,14],'ride'),H(sn,[4,12]),H(kk,[0,6,8]))),
  P('gr-r07','Garage Rock','Grooves','Rock',135,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,3,6,8,11]))),
  P('gr-r08','Power Pop','Grooves','Rock',148,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,4,8,12]))),
  P('gr-r09','Grunge Drag','Grooves','Rock',108,16,
    M(H(hh,[0,4,8,12]),H(sn,[4,12]),H(sn,[2,10],'ghost'),H(kk,[0,6,7]))),
  P('gr-r10','Indie Rock','Grooves','Rock',132,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(hh,[14],'open'),H(sn,[4,12]),H(kk,[0,5,8,13]))),
  P('gr-r11','Southern Rock','Grooves','Rock',115,16,
    M(H(cr,[0,4,8,12],'ride'),H(hh,[2,6,10,14]),H(sn,[4,12]),H(kk,[0,3,8,10]))),
  P('gr-r12','Stoner Rock','Grooves','Rock',95,16,
    M(H(hh,[0,4,8,12]),H(sn,[4,12]),H(kk,[0,2,6,8,10,14]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  POP GROOVES (10)
  // ═══════════════════════════════════════════════════════════════════════
  P('gr-p01','Verse Groove','Grooves','Pop',95,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,5,8,10]))),
  P('gr-p02','Pop Chorus','Grooves','Pop',118,16,
    M(H(hh,[0,2,4,6,8,10,12]),H(hh,[14],'open'),H(sn,[4,12]),H(kk,[0,3,8,11]))),
  P('gr-p03','Four on the Floor','Grooves','Pop',120,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,4,8,12]))),
  P('gr-p04','Ballad','Grooves','Pop',72,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,10]))),
  P('gr-p05','Synth Pop','Grooves','Pop',125,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,4,8,12]),H(tm,[14]))),
  P('gr-p06','Indie Pop','Grooves','Pop',108,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(sn,[7],'ghost'),H(kk,[0,6,10]))),
  P('gr-p07','Anthem Pop','Grooves','Pop',132,16,
    M(H(cr,[0],'ride'),H(hh,[2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,3,8,11,14]))),
  P('gr-p08','Soft Pop','Grooves','Pop',88,16,
    M(H(hh,[0,4,8,12]),H(sn,[4,12]),H(kk,[0,8]))),
  P('gr-p09','Dance Pop','Grooves','Pop',128,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(hh,[6,14],'open'),H(sn,[4,12]),H(kk,[0,4,8,12]))),
  P('gr-p10','R&B Pop','Grooves','Pop',92,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(sn,[2,10],'ghost'),H(kk,[0,5,8,13]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  FUNK GROOVES (10)
  // ═══════════════════════════════════════════════════════════════════════
  P('gr-f01','Ghost Note Funk','Grooves','Funk',95,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(sn,[2,6,10,14],'ghost'),H(kk,[0,7,8,11]))),
  P('gr-f02','Pocket Groove','Grooves','Funk',92,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(sn,[1,9,14],'ghost'),H(kk,[0,5,8,13]))),
  P('gr-f03','Syncopated Funk','Grooves','Funk',100,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(hh,[4,12],'open'),H(sn,[4,12]),H(sn,[3,7,11,15],'ghost'),H(kk,[0,6,8,9,14]))),
  P('gr-f04','Breakbeat','Grooves','Funk',110,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,10]),H(kk,[0,6,8,14]))),
  P('gr-f05','JB Funk','Grooves','Funk',108,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(hh,[6],'open'),H(sn,[4,13]),H(sn,[2,7,10],'ghost'),H(kk,[0,5,8,11]))),
  P('gr-f06','Slap Funk','Grooves','Funk',98,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(sn,[1,3,9,11],'ghost'),H(kk,[0,6,7,8,14]))),
  P('gr-f07','Disco Funk','Grooves','Funk',112,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(sn,[4,12]),H(kk,[0,4,8,12]))),
  P('gr-f08','Swamp Funk','Grooves','Funk',88,16,
    M(H(hh,[0,3,4,7,8,11,12,15]),H(sn,[4,12]),H(sn,[7,15],'ghost'),H(kk,[0,5,8,10]))),
  P('gr-f09','New Orleans','Grooves','Funk',102,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,7,12,15]),H(sn,[2,10],'ghost'),H(kk,[0,5,8]))),
  P('gr-f10','Parliament Groove','Grooves','Funk',105,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(hh,[6,14],'open'),H(sn,[4,12]),H(sn,[1,3,9,11],'ghost'),H(kk,[0,5,7,8,13]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  JAZZ GROOVES (8)
  // ═══════════════════════════════════════════════════════════════════════
  P('gr-j01','Swing Ride','Grooves','Jazz',140,16,
    M(H(cr,[0,4,7,8,12,15],'ride'),H(hh,[4,12],'pedal'),H(kk,[0,11]))),
  P('gr-j02','Brush Comping','Grooves','Jazz',120,16,
    M(H(cr,[0,3,4,7,8,11,12,15],'ride'),H(hh,[4,12],'pedal'),H(sn,[3,11],'ghost'),H(kk,[0,10]))),
  P('gr-j03','Bossa Nova','Grooves','Jazz',130,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[3,7,11,15],'ghost'),H(kk,[0,6]))),
  P('gr-j04','Jazz Waltz','Grooves','Jazz',160,16,
    M(H(cr,[0,4,8,12],'ride'),H(hh,[4,12],'pedal'),H(kk,[0]))),
  P('gr-j05','Bebop','Grooves','Jazz',180,16,
    M(H(cr,[0,3,4,7,8,11,12,15],'ride'),H(hh,[4,12],'pedal'),H(kk,[0,7]))),
  P('gr-j06','Cool Jazz','Grooves','Jazz',110,16,
    M(H(cr,[0,4,8,12],'ride'),H(hh,[4,12],'pedal'),H(sn,[7,15],'ghost'),H(kk,[0,10]))),
  P('gr-j07','Swing Shuffle','Grooves','Jazz',135,16,
    M(H(cr,[0,3,4,7,8,11,12,15],'ride'),H(hh,[4,12],'pedal'),H(sn,[4,12]),H(kk,[0,6]))),
  P('gr-j08','Jazz Fusion','Grooves','Jazz',125,16,
    M(H(cr,[0,2,4,6,8,10,12,14],'ride'),H(sn,[4,12]),H(sn,[2,7,10],'ghost'),H(kk,[0,5,8,13]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  LATIN GROOVES (10)
  // ═══════════════════════════════════════════════════════════════════════
  P('gr-l01','Samba','Grooves','Latin',100,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[3,7,11,15],'ghost'),H(sn,[4,12]),H(kk,[0,5,8,13]))),
  P('gr-l02','Tumbao','Grooves','Latin',105,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[7,15]),H(kk,[0,4,8,12]),H(tf,[3,11]))),
  P('gr-l03','Reggaeton','Grooves','Latin',95,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[3,7,11,15]),H(kk,[0,4,8,12]))),
  P('gr-l04','Cha-Cha','Grooves','Latin',120,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,8,12]),H(kk,[0,6]))),
  P('gr-l05','Afrobeat','Grooves','Latin',112,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(hh,[6,14],'open'),H(sn,[4,12]),H(sn,[2,10],'ghost'),H(kk,[0,5,8,11]))),
  P('gr-l06','Cumbia','Grooves','Latin',90,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,3,8,11]))),
  P('gr-l07','Salsa','Grooves','Latin',180,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,6,8]),H(th,[3,11]))),
  P('gr-l08','Merengue','Grooves','Latin',140,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[2,6,10,14]),H(kk,[0,4,8,12]))),
  P('gr-l09','Baião','Grooves','Latin',115,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[3,11]),H(kk,[0,4,8,12]),H(tf,[7,15]))),
  P('gr-l10','Dembow','Grooves','Latin',100,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[3,7,11,15]),H(kk,[0,4,8,12]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  ELECTRONIC GROOVES (10)
  // ═══════════════════════════════════════════════════════════════════════
  P('gr-e01','House Pulse','Grooves','Electronic',128,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(hh,[6,14],'open'),H(sn,[4,12]),H(kk,[0,4,8,12]))),
  P('gr-e02','Techno Drive','Grooves','Electronic',135,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(hh,[2,6,10,14],'open'),H(sn,[4,12],'rimshot'),H(kk,[0,4,8,12]))),
  P('gr-e03','DnB Amen','Grooves','Electronic',174,16,
    M(H(cr,[0,2,4,6,8,10,12,14],'ride'),H(sn,[4,10]),H(kk,[0,6,8,14]))),
  P('gr-e04','2-Step Garage','Grooves','Electronic',138,16,
    M(H(hh,[0,2,3,6,8,10,11,14]),H(sn,[4,12]),H(kk,[0,7,11]))),
  P('gr-e05','Synthwave','Grooves','Electronic',118,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,4,8,12]),H(tm,[14]))),
  P('gr-e06','Deep House','Grooves','Electronic',122,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(hh,[4,12],'open'),H(sn,[4,12],'rimshot'),H(kk,[0,4,8,12]))),
  P('gr-e07','Minimal Techno','Grooves','Electronic',130,16,
    M(H(hh,[0,4,8,12]),H(cr,[2,10],'ride'),H(sn,[4,12],'rimshot'),H(kk,[0,4,8,12]))),
  P('gr-e08','Breakcore','Grooves','Electronic',180,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(sn,[2,5,10,13]),H(kk,[0,3,6,8,11,14]))),
  P('gr-e09','Future Bass','Grooves','Electronic',150,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(hh,[3,7,11,15],'open'),H(sn,[4,12]),H(kk,[0,8]))),
  P('gr-e10','Dubstep Half','Grooves','Electronic',140,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[8]),H(kk,[0,3,5,12,14]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  HIP HOP GROOVES (10)
  // ═══════════════════════════════════════════════════════════════════════
  P('gr-h01','Boom Bap','Grooves','Hip Hop',90,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,5,8,10]))),
  P('gr-h02','Trap Beat','Grooves','Hip Hop',140,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(sn,[4,12]),H(kk,[0,3,7,8,11]))),
  P('gr-h03','Lo-Fi Chill','Grooves','Hip Hop',80,16,
    M(H(hh,[0,3,6,8,10,14]),H(sn,[4,12]),H(sn,[9],'ghost'),H(kk,[0,6,10]))),
  P('gr-h04','Drill Slide','Grooves','Hip Hop',142,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(hh,[3,7,11,15],'open'),H(sn,[4,12]),H(kk,[0,2,8,10,14]))),
  P('gr-h05','Old School','Grooves','Hip Hop',94,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(hh,[6],'open'),H(sn,[4,12]),H(kk,[0,3,8,11]))),
  P('gr-h06','Phonk','Grooves','Hip Hop',130,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(sn,[4,12]),H(kk,[0,2,5,8,10,13]))),
  P('gr-h07','Jersey Club','Grooves','Hip Hop',150,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(sn,[3,7,11,15]),H(kk,[0,4,8,12]))),
  P('gr-h08','Cloud Rap','Grooves','Hip Hop',68,16,
    M(H(hh,[0,4,8,12]),H(sn,[4,12]),H(kk,[0,7,10]))),
  P('gr-h09','Bounce','Grooves','Hip Hop',98,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,7,12,15]),H(kk,[0,3,8,11]))),
  P('gr-h10','Abstract Hip Hop','Grooves','Hip Hop',85,16,
    M(H(hh,[0,3,5,8,11,14]),H(sn,[4,12]),H(sn,[7],'ghost'),H(kk,[0,6,9]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  METAL GROOVES (8)
  // ═══════════════════════════════════════════════════════════════════════
  P('gr-m01','Thrash Beat','Grooves','Metal',200,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(sn,[4,12]),H(kk,[0,2,4,6,8,10,12,14]))),
  P('gr-m02','Blast Beat','Grooves','Metal',220,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(sn,[0,2,4,6,8,10,12,14]),H(kk,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]))),
  P('gr-m03','Double Kick','Grooves','Metal',160,16,
    M(H(cr,[0],'ride'),H(hh,[4,8,12]),H(sn,[4,12]),H(kk,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]))),
  P('gr-m04','Metal Half-Time','Grooves','Metal',130,16,
    M(H(cr,[0,2,4,6,8,10,12,14],'ride'),H(sn,[8]),H(kk,[0,2,4,12,14]))),
  P('gr-m05','Djent Groove','Grooves','Metal',115,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,1,3,5,8,9,11,13]))),
  P('gr-m06','D-Beat','Grooves','Metal',190,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[0,4,8,12]),H(kk,[2,6,10,14]))),
  P('gr-m07','Doom Crawl','Grooves','Metal',60,16,
    M(H(cr,[0,8],'ride'),H(sn,[4,12]),H(kk,[0,8]))),
  P('gr-m08','Groove Metal','Grooves','Metal',105,16,
    M(H(hh,[0,2,4,6,8,10,12,14]),H(sn,[4,12]),H(kk,[0,1,3,8,10,11]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  FILLS — ROCK (12)
  // ═══════════════════════════════════════════════════════════════════════
  P('fl-r01','Snare Roll','Fills','Rock',120,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(sn,[8,9,10,11,12,13,14,15]))),
  P('fl-r02','Tom Cascade','Fills','Rock',120,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(th,[8,9]),H(tm,[10,11]),H(tf,[12,13]),H(cr,[14,15]))),
  P('fl-r03','Triplet Fill','Fills','Rock',110,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(th,[8,10]),H(sn,[9,11]),H(tm,[12,14]),H(tf,[13,15]))),
  P('fl-r04','Buildup Crash','Fills','Rock',130,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(sn,[8,10,12,13,14]),H(kk,[9,11]),H(cr,[15]))),
  P('fl-r05','Quick Snare','Fills','Rock',125,16,
    M(H(hh,[0,2,4,6,8,10]),H(sn,[4]),H(kk,[0,8]),H(sn,[12,13,14,15]))),
  P('fl-r06','Tom Doubles','Fills','Rock',118,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(th,[8,9]),H(tm,[10,11]),H(tf,[12,13]),H(sn,[14]),H(kk,[15]))),
  P('fl-r07','Crash Lead-In','Fills','Rock',122,16,
    M(H(hh,[0,2,4,6,8]),H(sn,[4]),H(kk,[0]),H(sn,[10,12,14]),H(cr,[11,13,15]))),
  P('fl-r08','Half-Bar Slam','Fills','Rock',128,16,
    M(H(hh,[0,2,4,6,8,10]),H(sn,[4]),H(kk,[0,8]),H(sn,[12]),H(tf,[13]),H(kk,[14]),H(cr,[15]))),
  P('fl-r09','Singles Down','Fills','Rock',115,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(th,[8]),H(sn,[9]),H(tm,[10]),H(sn,[11]),H(tf,[12]),H(sn,[13]),H(kk,[14]),H(cr,[15]))),
  P('fl-r10','Kick-Snare Roll','Fills','Rock',120,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(kk,[8,10,12,14]),H(sn,[9,11,13,15]))),
  P('fl-r11','Open Hat Fill','Fills','Rock',120,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(hh,[8,10,12,14],'open'),H(sn,[9,11,13,15]))),
  P('fl-r12','Power Tom March','Fills','Rock',110,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(th,[8]),H(th,[9]),H(tm,[10]),H(tm,[11]),H(tf,[12]),H(tf,[13]),H(kk,[14]),H(cr,[15]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  FILLS — POP (10)
  // ═══════════════════════════════════════════════════════════════════════
  P('fl-p01','Quick Turnaround','Fills','Pop',115,16,
    M(H(hh,[0,2,4,6,8,10]),H(sn,[4]),H(kk,[0,8]),H(sn,[12,13]),H(tf,[14]),H(cr,[15]))),
  P('fl-p02','Snare Tap','Fills','Pop',100,16,
    M(H(hh,[0,2,4,6,8,10]),H(sn,[4]),H(kk,[0,8]),H(sn,[12,14]),H(kk,[13,15]))),
  P('fl-p03','Subtle Build','Fills','Pop',108,16,
    M(H(hh,[0,2,4,6,8]),H(sn,[4]),H(kk,[0]),H(sn,[10],'ghost'),H(sn,[12,14]),H(cr,[15]))),
  P('fl-p04','Pop Intro Fill','Fills','Pop',118,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(th,[8]),H(sn,[10]),H(tm,[12]),H(cr,[14]))),
  P('fl-p05','Soft Descent','Fills','Pop',95,16,
    M(H(hh,[0,2,4,6,8]),H(sn,[4]),H(kk,[0]),H(th,[10,11]),H(tm,[12]),H(tf,[13]),H(sn,[14]),H(kk,[15]))),
  P('fl-p06','Synth Pop Fill','Fills','Pop',125,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(sn,[8,9,10,11]),H(kk,[12,13]),H(cr,[14,15]))),
  P('fl-p07','Verse Exit','Fills','Pop',110,16,
    M(H(hh,[0,2,4,6,8,10,12]),H(sn,[4]),H(kk,[0,8]),H(sn,[13]),H(cr,[14]),H(kk,[15]))),
  P('fl-p08','Chorus Drop','Fills','Pop',120,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(sn,[8,10,12,14]),H(kk,[9,11,13]),H(cr,[15]))),
  P('fl-p09','Rimshot Roll','Fills','Pop',105,16,
    M(H(hh,[0,2,4,6,8]),H(sn,[4]),H(kk,[0]),H(sn,[10,11,12,13,14,15],'rimshot'))),
  P('fl-p10','Kick Pump','Fills','Pop',128,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(kk,[8,9,10,11,12,13,14,15]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  FILLS — FUNK (10)
  // ═══════════════════════════════════════════════════════════════════════
  P('fl-k01','Funk Fill','Fills','Funk',100,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(sn,[8,11,14]),H(kk,[9,12]),H(tf,[10,13,15]))),
  P('fl-k02','Linear Fill','Fills','Funk',95,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(kk,[8,11,14]),H(sn,[9,12,15]),H(hh,[10,13]))),
  P('fl-k03','Ghost Flurry','Fills','Funk',98,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(sn,[8,9,10,11],'ghost'),H(sn,[12]),H(sn,[13,14,15],'ghost'))),
  P('fl-k04','Funky Toms','Fills','Funk',105,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(th,[8,9]),H(kk,[10]),H(tm,[11,12]),H(kk,[13]),H(tf,[14,15]))),
  P('fl-k05','Synco Fill','Fills','Funk',100,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(sn,[7,10,13]),H(kk,[8,11,14]),H(cr,[15]))),
  P('fl-k06','Kick Ghost Combo','Fills','Funk',92,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(kk,[8,12]),H(sn,[9,11,13,15],'ghost'),H(sn,[10,14]))),
  P('fl-k07','One-Bar Linear','Fills','Funk',96,16,
    M(H(kk,[0,3,6,9,12]),H(sn,[1,4,7,10,13]),H(hh,[2,5,8,11,14]),H(cr,[15]))),
  P('fl-k08','Rimshot Pop','Fills','Funk',102,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(sn,[8,10,12,14],'rimshot'),H(kk,[9,11,13,15]))),
  P('fl-k09','Open Hat Funk Fill','Fills','Funk',98,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(hh,[8,10,12,14],'open'),H(sn,[9,11]),H(kk,[13]),H(cr,[15]))),
  P('fl-k10','Pocket Exit','Fills','Funk',90,16,
    M(H(hh,[0,2,4,6,8]),H(sn,[4]),H(kk,[0]),H(sn,[10,12],'ghost'),H(sn,[14]),H(kk,[11,13,15]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  FILLS — JAZZ (8)
  // ═══════════════════════════════════════════════════════════════════════
  P('fl-j01','Jazz Turnaround','Fills','Jazz',140,16,
    M(H(cr,[0,4,8],'ride'),H(sn,[3,7],'ghost'),H(kk,[0]),H(th,[10]),H(tm,[11]),H(sn,[12]),H(tf,[13]),H(cr,[14]),H(kk,[15]))),
  P('fl-j02','Brush Sweep','Fills','Jazz',120,16,
    M(H(cr,[0,4],'ride'),H(kk,[0]),H(sn,[3,7],'ghost'),H(sn,[8,9,10,11,12,13,14,15],'ghost'))),
  P('fl-j03','Ride to Toms','Fills','Jazz',135,16,
    M(H(cr,[0,3,4,7],'ride'),H(kk,[0]),H(th,[8,9]),H(tm,[10,11]),H(tf,[12,13]),H(cr,[14]))),
  P('fl-j04','Swing Kick Fill','Fills','Jazz',145,16,
    M(H(cr,[0,3,4,7],'ride'),H(kk,[0]),H(sn,[4]),H(kk,[8,10,12]),H(sn,[11,13]),H(cr,[14]),H(kk,[15]))),
  P('fl-j05','Comping Fill','Fills','Jazz',130,16,
    M(H(cr,[0,4],'ride'),H(kk,[0]),H(sn,[3,7],'ghost'),H(sn,[8]),H(th,[10]),H(sn,[12]),H(tm,[14]),H(cr,[15]))),
  P('fl-j06','Triplet Swing','Fills','Jazz',140,16,
    M(H(cr,[0,4],'ride'),H(kk,[0]),H(th,[8,10,12]),H(sn,[9,11,13]),H(cr,[14]),H(kk,[15]))),
  P('fl-j07','Soft Roll Out','Fills','Jazz',115,16,
    M(H(cr,[0,4,8],'ride'),H(sn,[3,7],'ghost'),H(kk,[0]),H(sn,[10,11,12,13,14,15],'ghost'))),
  P('fl-j08','Four-Bar Turnaround','Fills','Jazz',150,16,
    M(H(cr,[0,3,4,7],'ride'),H(kk,[0]),H(sn,[8,10]),H(th,[9]),H(tm,[11]),H(tf,[12]),H(sn,[13]),H(kk,[14]),H(cr,[15]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  FILLS — LATIN (8)
  // ═══════════════════════════════════════════════════════════════════════
  P('fl-la01','Latin Fill','Fills','Latin',105,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(th,[8,10]),H(sn,[9,11],'rimshot'),H(tf,[12,14]),H(kk,[13,15]))),
  P('fl-la02','Timbale Run','Fills','Latin',110,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(th,[8,9,10,11]),H(tm,[12,13]),H(tf,[14]),H(cr,[15]))),
  P('fl-la03','Samba Roll','Fills','Latin',100,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(sn,[8,9,10,11,12,13],'ghost'),H(sn,[14]),H(cr,[15]))),
  P('fl-la04','Salsa Break','Fills','Latin',180,16,
    M(H(hh,[0,2,4]),H(sn,[4]),H(kk,[0]),H(sn,[6,8,10,12,14]),H(kk,[7,9,11,13]),H(cr,[15]))),
  P('fl-la05','Cumbia Stop','Fills','Latin',90,16,
    M(H(hh,[0,2,4,6,8]),H(sn,[4]),H(kk,[0]),H(th,[10]),H(tm,[11]),H(tf,[12]),H(kk,[13]),H(sn,[14]),H(cr,[15]))),
  P('fl-la06','Afro Fill','Fills','Latin',112,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(kk,[8,10,12]),H(sn,[9,11,13],'rimshot'),H(kk,[14]),H(cr,[15]))),
  P('fl-la07','Bossa Turn','Fills','Latin',130,16,
    M(H(hh,[0,2,4,6,8]),H(sn,[3,7],'ghost'),H(kk,[0]),H(sn,[10,12,14]),H(kk,[11,13]),H(cr,[15]))),
  P('fl-la08','Reggaeton Drop','Fills','Latin',95,16,
    M(H(hh,[0,2,4,6]),H(sn,[3,7]),H(kk,[0,4]),H(sn,[8,10,12,14]),H(kk,[9,11,13,15]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  FILLS — ELECTRONIC (10)
  // ═══════════════════════════════════════════════════════════════════════
  P('fl-e01','Buildup','Fills','Electronic',128,16,
    M(H(sn,[0,4,6,8,9,10,11,12,13,14,15]),H(kk,[0,4,8,12]))),
  P('fl-e02','Snare Riser','Fills','Electronic',130,16,
    M(H(sn,[4,6,8,9,10,11,12,13,14,15]),H(kk,[0,8]))),
  P('fl-e03','Kick Buildup','Fills','Electronic',128,16,
    M(H(kk,[0,2,4,6,8,9,10,11,12,13,14,15]),H(cr,[15]))),
  P('fl-e04','Hat Ramp','Fills','Electronic',135,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(hh,[8,9,10,11,12,13,14,15]),H(cr,[15]))),
  P('fl-e05','Stutter Fill','Fills','Electronic',140,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(kk,[8]),H(sn,[9]),H(kk,[10]),H(sn,[11]),H(kk,[12]),H(sn,[13]),H(kk,[14]),H(cr,[15]))),
  P('fl-e06','Reverse Build','Fills','Electronic',128,16,
    M(H(sn,[0]),H(kk,[2]),H(sn,[4,5]),H(kk,[6]),H(sn,[8,9,10]),H(kk,[11]),H(sn,[12,13,14]),H(cr,[15]))),
  P('fl-e07','Drop Fill','Fills','Electronic',150,16,
    M(H(hh,[0,2,4,6,8,10]),H(sn,[4]),H(kk,[0,8]),H(sn,[12,13,14,15]),H(cr,[15]))),
  P('fl-e08','Glitch Fill','Fills','Electronic',138,16,
    M(H(hh,[0,1]),H(sn,[2]),H(kk,[3]),H(hh,[4,5]),H(sn,[6]),H(kk,[7,8]),H(hh,[9]),H(sn,[10,11]),H(kk,[12]),H(sn,[13]),H(kk,[14]),H(cr,[15]))),
  P('fl-e09','Synth Toms','Fills','Electronic',130,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(th,[8,9]),H(tm,[10,11]),H(tf,[12,13]),H(kk,[14]),H(cr,[15]))),
  P('fl-e10','Trap Riser','Fills','Electronic',140,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(sn,[4,8,10,12,13,14,15]),H(kk,[0,8]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  FILLS — HIP HOP (10)
  // ═══════════════════════════════════════════════════════════════════════
  P('fl-hh01','Trap Roll','Fills','Hip Hop',140,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(sn,[4,12,13,14,15]),H(kk,[0,8]))),
  P('fl-hh02','808 Fill','Fills','Hip Hop',130,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(kk,[8,10,12,14]),H(sn,[9,11,13,15]))),
  P('fl-hh03','Lo-Fi Turn','Fills','Hip Hop',80,16,
    M(H(hh,[0,3,6]),H(sn,[4]),H(kk,[0]),H(sn,[8,10],'ghost'),H(sn,[12,14]),H(kk,[13]),H(cr,[15]))),
  P('fl-hh04','Boom Bap Fill','Fills','Hip Hop',90,16,
    M(H(hh,[0,2,4,6,8]),H(sn,[4]),H(kk,[0]),H(sn,[10,12,14]),H(kk,[11,13]),H(cr,[15]))),
  P('fl-hh05','Drill Stutter','Fills','Hip Hop',142,16,
    M(H(hh,[0,1,2,3,4,5,6,7]),H(sn,[4]),H(kk,[0]),H(hh,[8,9,10,11,12,13,14,15],'open'),H(sn,[12,14]),H(kk,[13,15]))),
  P('fl-hh06','Hat Machine','Fills','Hip Hop',140,16,
    M(H(hh,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),H(hh,[7,11,15],'open'),H(sn,[4]),H(kk,[0]),H(sn,[12,14]),H(kk,[13]))),
  P('fl-hh07','Jersey Flip','Fills','Hip Hop',150,16,
    M(H(hh,[0,2,4,6]),H(sn,[3,7]),H(kk,[0,4]),H(sn,[8,10,12,14]),H(kk,[9,11,13]),H(cr,[15]))),
  P('fl-hh08','Phonk Drop','Fills','Hip Hop',130,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0]),H(kk,[8,9,10,11]),H(sn,[12]),H(kk,[13,14]),H(cr,[15]))),
  P('fl-hh09','Cloud Transition','Fills','Hip Hop',68,16,
    M(H(hh,[0,4,8]),H(sn,[4]),H(kk,[0]),H(sn,[10,12,14],'ghost'),H(cr,[15]))),
  P('fl-hh10','Bounce Fill','Fills','Hip Hop',98,16,
    M(H(hh,[0,2,4,6]),H(sn,[4,7]),H(kk,[0,3]),H(th,[8,9]),H(sn,[10]),H(tm,[11,12]),H(tf,[13]),H(cr,[14]),H(kk,[15]))),

  // ═══════════════════════════════════════════════════════════════════════
  //  FILLS — METAL (10)
  // ═══════════════════════════════════════════════════════════════════════
  P('fl-m01','Double Kick Fill','Fills','Metal',180,16,
    M(H(hh,[0,4]),H(sn,[4]),H(kk,[0,1,2,3]),H(th,[8,9]),H(sn,[10,11]),H(kk,[12,13,14,15]))),
  P('fl-m02','Blast Intro','Fills','Metal',220,16,
    M(H(sn,[0,1,2,3,4,5,6,7]),H(kk,[0,1,2,3,4,5,6,7]),H(th,[8,9]),H(tm,[10,11]),H(tf,[12,13]),H(cr,[14,15]))),
  P('fl-m03','Thrash Descent','Fills','Metal',200,16,
    M(H(hh,[0,2,4,6]),H(sn,[4]),H(kk,[0,2]),H(th,[8]),H(sn,[9]),H(tm,[10]),H(sn,[11]),H(tf,[12]),H(sn,[13]),H(kk,[14]),H(cr,[15]))),
  P('fl-m04','Machine Gun','Fills','Metal',190,16,
    M(H(hh,[0,4]),H(sn,[4]),H(kk,[0,1,2,3]),H(sn,[8,9,10,11,12,13,14,15]))),
  P('fl-m05','Gravity Blast','Fills','Metal',240,16,
    M(H(sn,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14]),H(kk,[0,2,4,6,8,10,12,14]),H(cr,[15]))),
  P('fl-m06','Djent Stop','Fills','Metal',115,16,
    M(H(hh,[0,2]),H(sn,[4]),H(kk,[0,1,3]),H(kk,[8,9,10,11,12,13]),H(sn,[14]),H(cr,[15]))),
  P('fl-m07','Double Pedal Cascade','Fills','Metal',170,16,
    M(H(kk,[0,1,2,3,4,5,6,7]),H(th,[8]),H(tm,[9]),H(tf,[10]),H(sn,[11]),H(th,[12]),H(tm,[13]),H(tf,[14]),H(cr,[15]))),
  P('fl-m08','War March','Fills','Metal',100,16,
    M(H(sn,[0,2,4,6,8,10,12,14]),H(kk,[0,2,4,6,8,10,12,14]),H(cr,[14]))),
  P('fl-m09','Cymbal Choke Fill','Fills','Metal',150,16,
    M(H(hh,[0,2,4]),H(sn,[4]),H(kk,[0]),H(cr,[6],'choke'),H(th,[8,9]),H(sn,[10,11]),H(kk,[12,13]),H(cr,[14]),H(kk,[15]))),
  P('fl-m10','Speed Toms','Fills','Metal',200,16,
    M(H(hh,[0,4]),H(sn,[4]),H(kk,[0,1,2,3]),H(th,[8,9,10,11]),H(tm,[12,13]),H(tf,[14]),H(cr,[15]))),
];
