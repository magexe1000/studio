export type VisualType = 'breathBar' | 'pitchLadder' | 'sustainHold' | 'vowelShape' | 'trillWave' | 'sirene' | 'intervalJump' | 'dynamicBar';

export interface ExerciseStep {
  instruction: string;
  durationSec: number;
  targetNote?: string;
  syllable?: string;
  visualType: VisualType;
  listenForPitch?: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  durationMin: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  color: string;
  description: string;
  category: string;
  steps: ExerciseStep[];
}

export interface ExerciseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const CATEGORIES: ExerciseCategory[] = [
  { id: 'warmup',      name: 'Warm-ups',              icon: 'local_fire_department', color: '#f59e0b', description: 'Gentle exercises to prepare your voice' },
  { id: 'breath',      name: 'Breath Control',        icon: 'air',                   color: '#34d399', description: 'Build diaphragmatic support and stamina' },
  { id: 'pitch',       name: 'Pitch & Intonation',    icon: 'music_note',            color: '#007aff', description: 'Accuracy, scales, and interval training' },
  { id: 'resonance',   name: 'Resonance & Placement', icon: 'record_voice_over',     color: '#a78bfa', description: 'Vowel shaping and tonal placement' },
  { id: 'range',       name: 'Range Extension',       icon: 'expand',                color: '#ec4899', description: 'Expand your chest, head, and mixed voice' },
  { id: 'agility',     name: 'Agility & Runs',        icon: 'electric_bolt',         color: '#ef4444', description: 'Fast passages, ornaments, and flexibility' },
  { id: 'articulation',name: 'Articulation & Diction', icon: 'edit_note',            color: '#06b6d4', description: 'Crisp consonants and clear delivery' },
];

export const NOTE_FREQ: Record<string, number> = {
  'A2': 110.00, 'B2': 123.47,
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00,
};

export const EXERCISES: Exercise[] = [

  // ═══════════════════════════════════════
  //  WARM-UPS
  // ═══════════════════════════════════════

  {
    id: 'humming-warmup',
    category: 'warmup',
    name: 'Humming Warm-up',
    subtitle: 'Gentle Activation',
    icon: 'music_note',
    durationMin: '3:00',
    level: 'Beginner',
    color: '#f59e0b',
    description: 'Hum gently with closed lips on each note. Feel the vibration in your nose, lips, and forehead. This wakes up your voice without strain.',
    steps: [
      { instruction: 'Hum on a comfortable low note', durationSec: 6, targetNote: 'C3', syllable: 'mmm', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Hum one step higher', durationSec: 6, targetNote: 'D3', syllable: 'mmm', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Continue up to E', durationSec: 6, targetNote: 'E3', syllable: 'mmm', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Hum on F', durationSec: 6, targetNote: 'F3', syllable: 'mmm', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Hum back down to C', durationSec: 6, targetNote: 'C3', syllable: 'mmm', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'lip-trills',
    category: 'warmup',
    name: 'Lip Trills',
    subtitle: 'Tension Release',
    icon: 'waves',
    durationMin: '3:00',
    level: 'Beginner',
    color: '#f59e0b',
    description: 'Relax your lips and blow air to create a "brrr" vibration. Slide up and down — this releases jaw and throat tension.',
    steps: [
      { instruction: 'Lip trill on a comfortable low note', durationSec: 6, targetNote: 'C3', syllable: 'brrr', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Trill sliding up a 5th', durationSec: 6, targetNote: 'G3', syllable: 'brrr↑', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Trill sliding back down', durationSec: 6, targetNote: 'C3', syllable: 'brrr↓', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Trill up an octave slowly', durationSec: 8, targetNote: 'C4', syllable: 'brrr↑↑', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Trill back down the octave', durationSec: 8, targetNote: 'C3', syllable: 'brrr↓↓', visualType: 'sirene', listenForPitch: true },
    ],
  },
  {
    id: 'tongue-trills',
    category: 'warmup',
    name: 'Tongue Trills',
    subtitle: 'Tongue Flexibility',
    icon: 'vibration',
    durationMin: '2:30',
    level: 'Beginner',
    color: '#f59e0b',
    description: 'Roll your tongue in a "rrr" sound while sustaining a pitch. This loosens the tongue root and improves airflow control.',
    steps: [
      { instruction: 'Tongue trill on D3', durationSec: 6, targetNote: 'D3', syllable: 'rrr', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Trill sliding up to A3', durationSec: 8, targetNote: 'A3', syllable: 'rrr↑', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Trill sliding back down', durationSec: 8, targetNote: 'D3', syllable: 'rrr↓', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Full octave trill glide', durationSec: 10, targetNote: 'D4', syllable: 'rrr↑↑', visualType: 'sirene', listenForPitch: true },
    ],
  },
  {
    id: 'yawn-sigh',
    category: 'warmup',
    name: 'Yawn-Sigh',
    subtitle: 'Throat Opening',
    icon: 'sentiment_satisfied',
    durationMin: '2:00',
    level: 'Beginner',
    color: '#f59e0b',
    description: 'Start with a gentle yawn feeling, then sigh downward on "hah". This opens the throat and relaxes the larynx.',
    steps: [
      { instruction: 'Open throat in a yawn position, sigh from high to low', durationSec: 6, syllable: 'haaah↓', visualType: 'sirene' },
      { instruction: 'Repeat — sigh from even higher', durationSec: 6, syllable: 'haaah↓', visualType: 'sirene' },
      { instruction: 'Yawn-sigh on "hoo"', durationSec: 6, syllable: 'hoooo↓', visualType: 'sirene' },
      { instruction: 'Gentle yawn-sigh on "hee"', durationSec: 6, syllable: 'heeee↓', visualType: 'sirene' },
    ],
  },

  // ═══════════════════════════════════════
  //  BREATH CONTROL
  // ═══════════════════════════════════════

  {
    id: 'diaphragm-breath',
    category: 'breath',
    name: 'Diaphragmatic Breathing',
    subtitle: 'Foundation & Support',
    icon: 'air',
    durationMin: '4:00',
    level: 'Beginner',
    color: '#34d399',
    description: 'Build breath support with timed inhale-hold-exhale cycles. Expand your belly, not your chest.',
    steps: [
      { instruction: 'Breathe in slowly through your nose (belly expands)', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Hold your breath gently', durationSec: 4, visualType: 'sustainHold' },
      { instruction: 'Exhale slowly on "sss"', durationSec: 8, syllable: 'sss', visualType: 'breathBar' },
      { instruction: 'Breathe in again, deeper this time', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Hold', durationSec: 4, visualType: 'sustainHold' },
      { instruction: 'Exhale on "zzz" (feel the buzz)', durationSec: 8, syllable: 'zzz', visualType: 'breathBar' },
    ],
  },
  {
    id: 'sustained-exhale',
    category: 'breath',
    name: 'Sustained Exhale',
    subtitle: 'Endurance Builder',
    icon: 'timer',
    durationMin: '3:00',
    level: 'Beginner',
    color: '#34d399',
    description: 'Exhale on a steady "sss" for as long as possible. Goal: sustain for at least 15 seconds. This builds the muscles of breath support.',
    steps: [
      { instruction: 'Deep inhale — 4 counts', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Sustain "sss" — try to reach 15 seconds', durationSec: 15, syllable: 'sss', visualType: 'sustainHold' },
      { instruction: 'Deep inhale again', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Sustain "sss" — push for 20 seconds', durationSec: 20, syllable: 'sss', visualType: 'sustainHold' },
      { instruction: 'Final deep inhale', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Sustain "zzz" — controlled buzz', durationSec: 15, syllable: 'zzz', visualType: 'sustainHold' },
    ],
  },
  {
    id: 'panting-breath',
    category: 'breath',
    name: 'Panting Exercise',
    subtitle: 'Diaphragm Agility',
    icon: 'speed',
    durationMin: '2:00',
    level: 'Intermediate',
    color: '#34d399',
    description: 'Quick, light "huh huh huh" panting like a dog. Engages the diaphragm rapidly. Keep your shoulders still — all movement should be in the belly.',
    steps: [
      { instruction: 'Quick panting — 8 counts, belly bouncing', durationSec: 8, syllable: 'huh huh huh', visualType: 'dynamicBar' },
      { instruction: 'Rest — deep slow breath', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Faster panting — 12 counts', durationSec: 10, syllable: 'huh huh huh', visualType: 'dynamicBar' },
      { instruction: 'Rest — deep slow breath', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Sustained slow panting — feel control', durationSec: 12, syllable: 'huh... huh... huh...', visualType: 'dynamicBar' },
    ],
  },
  {
    id: 'counted-breath',
    category: 'breath',
    name: 'Counted Breath Hold',
    subtitle: 'Capacity Training',
    icon: 'hourglass_top',
    durationMin: '3:30',
    level: 'Advanced',
    color: '#34d399',
    description: 'Inhale for 4, hold for 7, exhale for 8 (4-7-8 pattern). A classic technique used by singers and wind players to extend lung capacity.',
    steps: [
      { instruction: 'Inhale — 4 counts', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Hold — 7 counts', durationSec: 7, visualType: 'sustainHold' },
      { instruction: 'Exhale on "fff" — 8 counts', durationSec: 8, syllable: 'fff', visualType: 'breathBar' },
      { instruction: 'Inhale — 4 counts', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Hold — 7 counts', durationSec: 7, visualType: 'sustainHold' },
      { instruction: 'Exhale on "sss" — 8 counts', durationSec: 8, syllable: 'sss', visualType: 'breathBar' },
      { instruction: 'Inhale — 4 counts', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Hold — 7 counts', durationSec: 7, visualType: 'sustainHold' },
      { instruction: 'Exhale on a sung "ah" — 8 counts', durationSec: 8, syllable: 'ahhh', targetNote: 'C4', visualType: 'breathBar', listenForPitch: true },
    ],
  },

  // ═══════════════════════════════════════
  //  PITCH & INTONATION
  // ═══════════════════════════════════════

  {
    id: 'major-scale',
    category: 'pitch',
    name: 'Major Scale',
    subtitle: 'Pitch Accuracy',
    icon: 'piano',
    durationMin: '3:00',
    level: 'Intermediate',
    color: '#007aff',
    description: 'Sing each note of the C major scale on "la". Match each pitch precisely using the visual guide.',
    steps: [
      { instruction: 'Sing Do (root)', durationSec: 4, targetNote: 'C4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing Re', durationSec: 4, targetNote: 'D4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing Mi', durationSec: 4, targetNote: 'E4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing Fa', durationSec: 4, targetNote: 'F4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing Sol', durationSec: 4, targetNote: 'G4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing La', durationSec: 4, targetNote: 'A4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing Ti', durationSec: 4, targetNote: 'B4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing Do (octave)', durationSec: 4, targetNote: 'C5', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'minor-scale',
    category: 'pitch',
    name: 'Natural Minor Scale',
    subtitle: 'Minor Tonality',
    icon: 'piano',
    durationMin: '3:00',
    level: 'Intermediate',
    color: '#007aff',
    description: 'Sing the A natural minor scale on "nah". The minor scale trains your ear for darker tonalities common in pop, rock, and R&B.',
    steps: [
      { instruction: 'Sing A (root)', durationSec: 4, targetNote: 'A3', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing B', durationSec: 4, targetNote: 'B3', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing C', durationSec: 4, targetNote: 'C4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing D', durationSec: 4, targetNote: 'D4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing E', durationSec: 4, targetNote: 'E4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing F', durationSec: 4, targetNote: 'F4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing G', durationSec: 4, targetNote: 'G4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sing A (octave)', durationSec: 4, targetNote: 'A4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'octave-jumps',
    category: 'pitch',
    name: 'Octave Jumps',
    subtitle: 'Interval Training',
    icon: 'swap_vert',
    durationMin: '3:00',
    level: 'Advanced',
    color: '#007aff',
    description: 'Jump a full octave up, then back down. Trains register transitions and pitch accuracy across large intervals.',
    steps: [
      { instruction: 'Sing C3, then jump to C4', durationSec: 5, targetNote: 'C4', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Sing C4, then drop to C3', durationSec: 5, targetNote: 'C3', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Sing D3, then jump to D4', durationSec: 5, targetNote: 'D4', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Sing D4, then drop to D3', durationSec: 5, targetNote: 'D3', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Sing E3 to E4', durationSec: 5, targetNote: 'E4', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Sing E4 to E3', durationSec: 5, targetNote: 'E3', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
    ],
  },
  {
    id: 'fifth-intervals',
    category: 'pitch',
    name: 'Perfect 5th Drill',
    subtitle: 'Interval Recognition',
    icon: 'straighten',
    durationMin: '2:30',
    level: 'Intermediate',
    color: '#007aff',
    description: 'Sing the root, then jump a perfect 5th (e.g., C→G). The 5th is the most consonant interval — training it builds strong pitch anchoring.',
    steps: [
      { instruction: 'Sing C4', durationSec: 3, targetNote: 'C4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Jump to G4 (5th)', durationSec: 4, targetNote: 'G4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Sing D4', durationSec: 3, targetNote: 'D4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Jump to A4 (5th)', durationSec: 4, targetNote: 'A4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Sing E4', durationSec: 3, targetNote: 'E4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Jump to B4 (5th)', durationSec: 4, targetNote: 'B4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
    ],
  },
  {
    id: 'chromatic-climb',
    category: 'pitch',
    name: 'Chromatic Climb',
    subtitle: 'Half-Step Precision',
    icon: 'stacked_line_chart',
    durationMin: '3:00',
    level: 'Advanced',
    color: '#007aff',
    description: 'Sing every half step from C4 up to G4 and back. Chromatic training is the ultimate pitch accuracy exercise.',
    steps: [
      { instruction: 'Sing C4', durationSec: 3, targetNote: 'C4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Half step up — C#4', durationSec: 3, targetNote: 'C4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'D4', durationSec: 3, targetNote: 'D4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'E4', durationSec: 3, targetNote: 'E4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'F4', durationSec: 3, targetNote: 'F4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'G4', durationSec: 3, targetNote: 'G4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Back down to F4', durationSec: 3, targetNote: 'F4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'E4', durationSec: 3, targetNote: 'E4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'D4', durationSec: 3, targetNote: 'D4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Resolve to C4', durationSec: 3, targetNote: 'C4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },

  // ═══════════════════════════════════════
  //  RESONANCE & PLACEMENT
  // ═══════════════════════════════════════

  {
    id: 'vowel-placement',
    category: 'resonance',
    name: 'Vowel Resonance',
    subtitle: 'Placement & Clarity',
    icon: 'record_voice_over',
    durationMin: '3:00',
    level: 'Beginner',
    color: '#a78bfa',
    description: 'Sustain each pure vowel on a comfortable pitch. Feel where each vowel resonates — front, middle, or back of your mouth.',
    steps: [
      { instruction: 'Sustain "EE" — feel it in your mask/forehead', durationSec: 6, syllable: 'EE', targetNote: 'A3', visualType: 'vowelShape', listenForPitch: true },
      { instruction: 'Sustain "EH" — slightly more open', durationSec: 6, syllable: 'EH', targetNote: 'A3', visualType: 'vowelShape', listenForPitch: true },
      { instruction: 'Sustain "AH" — wide open, resonant', durationSec: 6, syllable: 'AH', targetNote: 'A3', visualType: 'vowelShape', listenForPitch: true },
      { instruction: 'Sustain "OH" — round your lips', durationSec: 6, syllable: 'OH', targetNote: 'A3', visualType: 'vowelShape', listenForPitch: true },
      { instruction: 'Sustain "OO" — small opening, feel the chest', durationSec: 6, syllable: 'OO', targetNote: 'A3', visualType: 'vowelShape', listenForPitch: true },
    ],
  },
  {
    id: 'ng-resonance',
    category: 'resonance',
    name: '"NG" Nasal Resonance',
    subtitle: 'Mask Placement',
    icon: 'hearing',
    durationMin: '2:30',
    level: 'Intermediate',
    color: '#a78bfa',
    description: 'Sing "ng" (like the end of "sing") to direct all resonance into the nasal cavity. Then open to "ah" while keeping the buzz. This trains forward placement.',
    steps: [
      { instruction: 'Sustain "ng" — feel the buzz in your nose', durationSec: 6, targetNote: 'D4', syllable: 'ng', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Open from "ng" to "ah" — keep the buzz', durationSec: 6, targetNote: 'D4', syllable: 'ng→ah', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"ng" to "ee" — bright forward sound', durationSec: 6, targetNote: 'E4', syllable: 'ng→ee', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"ng" to "oh" — rounded but forward', durationSec: 6, targetNote: 'E4', syllable: 'ng→oh', visualType: 'vowelShape', listenForPitch: true },
    ],
  },
  {
    id: 'messa-di-voce',
    category: 'resonance',
    name: 'Messa di Voce',
    subtitle: 'Dynamic Control',
    icon: 'graphic_eq',
    durationMin: '3:00',
    level: 'Advanced',
    color: '#a78bfa',
    description: 'Start a note very quietly, crescendo to full volume, then decrescendo back to silence — all on one breath. The ultimate resonance and breath control exercise.',
    steps: [
      { instruction: 'Start pianissimo on "ah" — barely audible', durationSec: 4, targetNote: 'C4', syllable: 'ah (pp)', visualType: 'dynamicBar', listenForPitch: true },
      { instruction: 'Gradually grow louder — mezzo forte', durationSec: 4, targetNote: 'C4', syllable: 'ah (mf)', visualType: 'dynamicBar', listenForPitch: true },
      { instruction: 'Peak at fortissimo — full resonance', durationSec: 3, targetNote: 'C4', syllable: 'AH (ff)', visualType: 'dynamicBar', listenForPitch: true },
      { instruction: 'Decrescendo — getting softer', durationSec: 4, targetNote: 'C4', syllable: 'ah (mf→p)', visualType: 'dynamicBar', listenForPitch: true },
      { instruction: 'Fade to almost nothing', durationSec: 4, targetNote: 'C4', syllable: 'ah (pp)', visualType: 'dynamicBar', listenForPitch: true },
      { instruction: 'Repeat on E4 — pp to ff to pp', durationSec: 12, targetNote: 'E4', syllable: 'oh', visualType: 'dynamicBar', listenForPitch: true },
    ],
  },
  {
    id: 'vowel-mod',
    category: 'resonance',
    name: 'Vowel Modification',
    subtitle: 'Passaggio Training',
    icon: 'tune',
    durationMin: '3:00',
    level: 'Advanced',
    color: '#a78bfa',
    description: 'Modify vowels as you ascend to maintain resonance through your passaggio (break). "EE" rounds slightly to "IH", "AH" narrows to "UH".',
    steps: [
      { instruction: 'Sing "AH" on C4', durationSec: 4, targetNote: 'C4', syllable: 'AH', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"AH" on E4 — begin to narrow', durationSec: 4, targetNote: 'E4', syllable: 'AH→UH', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"UH" on G4 — cover the vowel', durationSec: 4, targetNote: 'G4', syllable: 'UH', visualType: 'vowelShape', listenForPitch: true },
      { instruction: 'Descend on "OH" — G4 to C4', durationSec: 4, targetNote: 'C4', syllable: 'OH', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"EE" on C4 — bright', durationSec: 4, targetNote: 'C4', syllable: 'EE', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"EE→IH" on E4 — round slightly', durationSec: 4, targetNote: 'E4', syllable: 'EE→IH', visualType: 'vowelShape', listenForPitch: true },
    ],
  },

  // ═══════════════════════════════════════
  //  RANGE EXTENSION
  // ═══════════════════════════════════════

  {
    id: 'sirene-slides',
    category: 'range',
    name: 'Sirene Slides',
    subtitle: 'Range & Registers',
    icon: 'trending_up',
    durationMin: '3:00',
    level: 'Intermediate',
    color: '#ec4899',
    description: 'Glide smoothly from your lowest to highest comfortable note on "oo". Connects chest and head voice seamlessly.',
    steps: [
      { instruction: 'Gentle slide from low to mid range', durationSec: 8, syllable: 'oo↑', visualType: 'sirene' },
      { instruction: 'Continue from mid to high', durationSec: 8, syllable: 'oo↑↑', visualType: 'sirene' },
      { instruction: 'Slide from high all the way down', durationSec: 10, syllable: 'oo↓↓', visualType: 'sirene' },
      { instruction: 'Full range sirene — bottom to top to bottom', durationSec: 12, syllable: 'oo↑↓', visualType: 'sirene' },
    ],
  },
  {
    id: 'chest-voice-build',
    category: 'range',
    name: 'Chest Voice Builder',
    subtitle: 'Low Range Power',
    icon: 'arrow_downward',
    durationMin: '3:00',
    level: 'Intermediate',
    color: '#ec4899',
    description: 'Strengthen your chest voice with descending 5-note patterns. Keep the tone full and resonant — feel the vibration in your chest.',
    steps: [
      { instruction: 'Sing G3 on "goh"', durationSec: 4, targetNote: 'G3', syllable: 'goh', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Descend to F3', durationSec: 4, targetNote: 'F3', syllable: 'goh', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Descend to E3', durationSec: 4, targetNote: 'E3', syllable: 'goh', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Descend to D3', durationSec: 4, targetNote: 'D3', syllable: 'goh', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Bottom — C3, full chest', durationSec: 5, targetNote: 'C3', syllable: 'goh', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'head-voice-float',
    category: 'range',
    name: 'Head Voice Float',
    subtitle: 'High Range Ease',
    icon: 'arrow_upward',
    durationMin: '3:00',
    level: 'Intermediate',
    color: '#ec4899',
    description: 'Ascend into head voice on "oo". Keep the sound light and floaty — never push. Think of the sound floating above your head.',
    steps: [
      { instruction: 'Start on E4 — light "oo"', durationSec: 4, targetNote: 'E4', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Float up to F4', durationSec: 4, targetNote: 'F4', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'G4 — keep it light', durationSec: 4, targetNote: 'G4', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'A4 — no pushing', durationSec: 4, targetNote: 'A4', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'B4 — pure head voice', durationSec: 4, targetNote: 'B4', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'C5 — float at the top', durationSec: 5, targetNote: 'C5', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'mix-voice-bridge',
    category: 'range',
    name: 'Mixed Voice Bridge',
    subtitle: 'Register Blending',
    icon: 'compare_arrows',
    durationMin: '4:00',
    level: 'Advanced',
    color: '#ec4899',
    description: 'Sing through your passaggio on "nay" — the nasal consonant helps you stay connected. Resist the urge to flip into falsetto.',
    steps: [
      { instruction: 'Start in chest — C4 on "nay"', durationSec: 4, targetNote: 'C4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'D4 — still chest dominant', durationSec: 4, targetNote: 'D4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'E4 — approaching the bridge', durationSec: 4, targetNote: 'E4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'F4 — blend here, feel the mix', durationSec: 5, targetNote: 'F4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'G4 — mixed voice territory', durationSec: 5, targetNote: 'G4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'A4 — stay connected', durationSec: 5, targetNote: 'A4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Descend smoothly to C4', durationSec: 8, targetNote: 'C4', syllable: 'nay↓', visualType: 'sirene', listenForPitch: true },
    ],
  },

  // ═══════════════════════════════════════
  //  AGILITY & RUNS
  // ═══════════════════════════════════════

  {
    id: 'staccato-control',
    category: 'agility',
    name: 'Staccato Agility',
    subtitle: 'Precision & Speed',
    icon: 'electric_bolt',
    durationMin: '3:00',
    level: 'Advanced',
    color: '#ef4444',
    description: 'Short, sharp notes on "ha" — one per beat. Trains diaphragm control and vocal cord closure for clean onsets.',
    steps: [
      { instruction: 'Staccato on C4 — short "ha" bursts', durationSec: 8, syllable: 'ha ha ha ha', targetNote: 'C4', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Move up to E4', durationSec: 8, syllable: 'ha ha ha ha', targetNote: 'E4', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Move up to G4', durationSec: 8, syllable: 'ha ha ha ha', targetNote: 'G4', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Descend: G4 → E4 → C4', durationSec: 8, syllable: 'ha ha ha', targetNote: 'C4', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'triad-arpeggios',
    category: 'agility',
    name: 'Triad Arpeggios',
    subtitle: 'Melodic Flexibility',
    icon: 'moving',
    durationMin: '3:00',
    level: 'Intermediate',
    color: '#ef4444',
    description: 'Sing 1-3-5-3-1 arpeggio patterns on "ya". This builds the agility needed for runs and melodic passages in songs.',
    steps: [
      { instruction: 'C major: C4-E4-G4-E4-C4', durationSec: 6, targetNote: 'C4', syllable: 'ya', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'D major: D4-F4-A4-F4-D4', durationSec: 6, targetNote: 'D4', syllable: 'ya', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'E major: E4-G4-B4-G4-E4', durationSec: 6, targetNote: 'E4', syllable: 'ya', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Descend back: D4-F4-A4-F4-D4', durationSec: 6, targetNote: 'D4', syllable: 'ya', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Resolve: C4-E4-G4-E4-C4', durationSec: 6, targetNote: 'C4', syllable: 'ya', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'five-note-runs',
    category: 'agility',
    name: '5-Note Scale Runs',
    subtitle: 'Speed Training',
    icon: 'sprint',
    durationMin: '3:00',
    level: 'Advanced',
    color: '#ef4444',
    description: 'Sing 5-note ascending/descending patterns (1-2-3-4-5-4-3-2-1) increasing tempo each round. The foundation of melismatic singing.',
    steps: [
      { instruction: 'Slow: C-D-E-F-G-F-E-D-C on "da"', durationSec: 8, targetNote: 'C4', syllable: 'da da da...', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Medium speed — same pattern', durationSec: 6, targetNote: 'C4', syllable: 'da da da...', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Move up: D-E-F-G-A-G-F-E-D', durationSec: 6, targetNote: 'D4', syllable: 'da da da...', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Fast: E-F-G-A-B-A-G-F-E', durationSec: 5, targetNote: 'E4', syllable: 'da da da...', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Descend all the way back to C', durationSec: 8, targetNote: 'C4', syllable: 'da da da...', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'trill-flexibility',
    category: 'agility',
    name: 'Vocal Trill',
    subtitle: 'Ornamental Agility',
    icon: 'gesture',
    durationMin: '2:30',
    level: 'Advanced',
    color: '#ef4444',
    description: 'Rapidly alternate between two adjacent notes (like a classical trill). Start slow and increase speed. Essential for gospel, classical, and R&B riffing.',
    steps: [
      { instruction: 'Slow trill: alternate C4-D4 on "ah"', durationSec: 6, targetNote: 'C4', syllable: 'ah-ah-ah', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Speed up the alternation', durationSec: 6, targetNote: 'C4', syllable: 'ahahah', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Move up: D4-E4 trill', durationSec: 6, targetNote: 'D4', syllable: 'ahahah', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'E4-F4 trill — as fast as clean', durationSec: 6, targetNote: 'E4', syllable: 'ahahah', visualType: 'trillWave', listenForPitch: true },
    ],
  },

  // ═══════════════════════════════════════
  //  ARTICULATION & DICTION
  // ═══════════════════════════════════════

  {
    id: 'consonant-drill',
    category: 'articulation',
    name: 'Consonant Precision',
    subtitle: 'Clean Attacks',
    icon: 'format_bold',
    durationMin: '3:00',
    level: 'Beginner',
    color: '#06b6d4',
    description: 'Sing each consonant-vowel combo on one pitch to train crisp, clean word beginnings. Essential for lyrics clarity.',
    steps: [
      { instruction: '"Ba Ba Ba Ba" on C4 — crisp B', durationSec: 5, targetNote: 'C4', syllable: 'Ba Ba Ba Ba', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: '"Da Da Da Da" — tongue tip precision', durationSec: 5, targetNote: 'C4', syllable: 'Da Da Da Da', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: '"Ga Ga Ga Ga" — back of tongue', durationSec: 5, targetNote: 'C4', syllable: 'Ga Ga Ga Ga', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: '"Ma Ma Ma Ma" — nasal onset', durationSec: 5, targetNote: 'D4', syllable: 'Ma Ma Ma Ma', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: '"Na Na Na Na" — alveolar nasal', durationSec: 5, targetNote: 'D4', syllable: 'Na Na Na Na', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: '"La La La La" — lateral flow', durationSec: 5, targetNote: 'E4', syllable: 'La La La La', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'tongue-twisters',
    category: 'articulation',
    name: 'Tongue Twisters',
    subtitle: 'Diction & Speed',
    icon: 'record_voice_over',
    durationMin: '3:00',
    level: 'Intermediate',
    color: '#06b6d4',
    description: 'Speak/sing classic tongue twisters on a pitch. Start slow, then increase speed while maintaining clarity. "Red leather, yellow leather."',
    steps: [
      { instruction: '"Red leather, yellow leather" — slow', durationSec: 6, targetNote: 'C4', syllable: 'Red leather...', visualType: 'sustainHold' },
      { instruction: 'Same phrase — medium speed', durationSec: 5, syllable: 'Red leather...', visualType: 'sustainHold' },
      { instruction: '"Unique New York" — slow', durationSec: 6, targetNote: 'D4', syllable: 'Unique New York', visualType: 'sustainHold' },
      { instruction: 'Same — faster', durationSec: 5, syllable: 'Unique New York', visualType: 'sustainHold' },
      { instruction: '"She sells seashells" — sung on E4', durationSec: 6, targetNote: 'E4', syllable: 'She sells...', visualType: 'sustainHold', listenForPitch: true },
      { instruction: 'Same — as fast as clear', durationSec: 5, syllable: 'She sells...', visualType: 'sustainHold' },
    ],
  },
  {
    id: 'legato-line',
    category: 'articulation',
    name: 'Legato Line',
    subtitle: 'Smooth Connections',
    icon: 'horizontal_rule',
    durationMin: '3:00',
    level: 'Intermediate',
    color: '#06b6d4',
    description: 'Sing a connected phrase with no gaps between notes. Focus on smooth transitions — the opposite of staccato. This is how professional singers sound "effortless".',
    steps: [
      { instruction: 'Sustain C4, glide smoothly to D4', durationSec: 5, targetNote: 'D4', syllable: 'mah→', visualType: 'sirene', listenForPitch: true },
      { instruction: 'D4 smoothly to E4', durationSec: 5, targetNote: 'E4', syllable: 'mah→', visualType: 'sirene', listenForPitch: true },
      { instruction: 'E4 to F4 — no breaks', durationSec: 5, targetNote: 'F4', syllable: 'mah→', visualType: 'sirene', listenForPitch: true },
      { instruction: 'F4 to G4 — seamless', durationSec: 5, targetNote: 'G4', syllable: 'mah→', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Descend smoothly G4-F4-E4-D4-C4', durationSec: 10, targetNote: 'C4', syllable: 'mah→', visualType: 'sirene', listenForPitch: true },
    ],
  },
];
