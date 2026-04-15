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
  level: 'Principiante' | 'Intermedio' | 'Avanzado';
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
  { id: 'warmup',      name: 'Calentamiento',             icon: 'local_fire_department', color: '#f59e0b', description: 'Ejercicios suaves para preparar la voz' },
  { id: 'breath',      name: 'Control de respiración',    icon: 'air',                   color: '#34d399', description: 'Construye el soporte diafragmático y la resistencia' },
  { id: 'pitch',       name: 'Afinación e Intonación',    icon: 'music_note',            color: '#007aff', description: 'Precisión, escalas y entrenamiento de intervalos' },
  { id: 'resonance',   name: 'Resonancia y Colocación',   icon: 'record_voice_over',     color: '#a78bfa', description: 'Formación de vocales y colocación del sonido' },
  { id: 'range',       name: 'Extensión de Rango',        icon: 'expand',                color: '#ec4899', description: 'Amplía tu voz de pecho, cabeza y mixta' },
  { id: 'agility',     name: 'Agilidad y Runs',           icon: 'electric_bolt',         color: '#ef4444', description: 'Pasajes rápidos, adornos y flexibilidad' },
  { id: 'articulation',name: 'Articulación y Dicción',    icon: 'edit_note',             color: '#06b6d4', description: 'Consonantes claras y pronunciación precisa' },
];

export const NOTE_FREQ: Record<string, number> = {
  'A2': 110.00, 'B2': 123.47,
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00,
};

export const EXERCISES: Exercise[] = [

  // ═══════════════════════════════════════
  //  CALENTAMIENTO
  // ═══════════════════════════════════════

  {
    id: 'humming-warmup',
    category: 'warmup',
    name: 'Tararear para calentar',
    subtitle: 'Activación suave',
    icon: 'music_note',
    durationMin: '3:00',
    level: 'Principiante',
    color: '#f59e0b',
    description: 'Tararea suavemente con los labios cerrados en cada nota. Siente la vibración en la nariz, los labios y la frente. Esto despierta la voz sin forzar.',
    steps: [
      { instruction: 'Tararea en una nota grave cómoda', durationSec: 6, targetNote: 'C3', syllable: 'mmm', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sube un paso', durationSec: 6, targetNote: 'D3', syllable: 'mmm', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Continúa subiendo a Mi', durationSec: 6, targetNote: 'E3', syllable: 'mmm', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Tararea en Fa', durationSec: 6, targetNote: 'F3', syllable: 'mmm', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Baja de vuelta a Do', durationSec: 6, targetNote: 'C3', syllable: 'mmm', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'lip-trills',
    category: 'warmup',
    name: 'Trinos de labios',
    subtitle: 'Soltar la tensión',
    icon: 'waves',
    durationMin: '3:00',
    level: 'Principiante',
    color: '#f59e0b',
    description: 'Relaja los labios y sopla aire para crear una vibración "brrr". Deslízate hacia arriba y hacia abajo — esto suelta la tensión de la mandíbula y la garganta.',
    steps: [
      { instruction: 'Trino de labios en una nota grave cómoda', durationSec: 6, targetNote: 'C3', syllable: 'brrr', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Trino subiendo una quinta', durationSec: 6, targetNote: 'G3', syllable: 'brrr↑', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Trino bajando', durationSec: 6, targetNote: 'C3', syllable: 'brrr↓', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Trino subiendo una octava despacio', durationSec: 8, targetNote: 'C4', syllable: 'brrr↑↑', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Trino bajando la octava', durationSec: 8, targetNote: 'C3', syllable: 'brrr↓↓', visualType: 'sirene', listenForPitch: true },
    ],
  },
  {
    id: 'tongue-trills',
    category: 'warmup',
    name: 'Trinos de lengua',
    subtitle: 'Flexibilidad de lengua',
    icon: 'vibration',
    durationMin: '2:30',
    level: 'Principiante',
    color: '#f59e0b',
    description: 'Vibra la lengua con un sonido "rrr" mientras sostienes el tono. Esto suelta la raíz de la lengua y mejora el control del flujo de aire.',
    steps: [
      { instruction: 'Trino de lengua en Re3', durationSec: 6, targetNote: 'D3', syllable: 'rrr', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Trino subiendo hasta La3', durationSec: 8, targetNote: 'A3', syllable: 'rrr↑', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Trino bajando', durationSec: 8, targetNote: 'D3', syllable: 'rrr↓', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Deslizamiento de una octava completa', durationSec: 10, targetNote: 'D4', syllable: 'rrr↑↑', visualType: 'sirene', listenForPitch: true },
    ],
  },
  {
    id: 'yawn-sigh',
    category: 'warmup',
    name: 'Bostezo-Suspiro',
    subtitle: 'Apertura de garganta',
    icon: 'sentiment_satisfied',
    durationMin: '2:00',
    level: 'Principiante',
    color: '#f59e0b',
    description: 'Empieza con una sensación de bostezo suave, luego suspira hacia abajo con "hah". Esto abre la garganta y relaja la laringe.',
    steps: [
      { instruction: 'Abre la garganta como un bostezo, suspira de agudo a grave', durationSec: 6, syllable: 'haaah↓', visualType: 'sirene' },
      { instruction: 'Repite — suspira desde aún más agudo', durationSec: 6, syllable: 'haaah↓', visualType: 'sirene' },
      { instruction: 'Bostezo-suspiro con "hoo"', durationSec: 6, syllable: 'hoooo↓', visualType: 'sirene' },
      { instruction: 'Bostezo-suspiro suave con "hee"', durationSec: 6, syllable: 'heeee↓', visualType: 'sirene' },
    ],
  },

  // ═══════════════════════════════════════
  //  CONTROL DE RESPIRACIÓN
  // ═══════════════════════════════════════

  {
    id: 'diaphragm-breath',
    category: 'breath',
    name: 'Respiración diafragmática',
    subtitle: 'Base y soporte',
    icon: 'air',
    durationMin: '4:00',
    level: 'Principiante',
    color: '#34d399',
    description: 'Construye soporte respiratorio con ciclos de inhalación-retención-exhalación. Expande el abdomen, no el pecho.',
    steps: [
      { instruction: 'Inhala despacio por la nariz (el abdomen se expande)', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Retén el aire suavemente', durationSec: 4, visualType: 'sustainHold' },
      { instruction: 'Exhala despacio con "sss"', durationSec: 8, syllable: 'sss', visualType: 'breathBar' },
      { instruction: 'Inhala de nuevo, más profundo', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Retén', durationSec: 4, visualType: 'sustainHold' },
      { instruction: 'Exhala con "zzz" (siente el zumbido)', durationSec: 8, syllable: 'zzz', visualType: 'breathBar' },
    ],
  },
  {
    id: 'sustained-exhale',
    category: 'breath',
    name: 'Exhalación sostenida',
    subtitle: 'Resistencia respiratoria',
    icon: 'timer',
    durationMin: '3:00',
    level: 'Principiante',
    color: '#34d399',
    description: 'Exhala con un "sss" constante el mayor tiempo posible. Meta: sostener al menos 15 segundos. Esto fortalece los músculos del soporte respiratorio.',
    steps: [
      { instruction: 'Inhalación profunda — 4 tiempos', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Sostén "sss" — intenta llegar a 15 segundos', durationSec: 15, syllable: 'sss', visualType: 'sustainHold' },
      { instruction: 'Inhalación profunda de nuevo', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Sostén "sss" — apunta a 20 segundos', durationSec: 20, syllable: 'sss', visualType: 'sustainHold' },
      { instruction: 'Inhalación profunda final', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Sostén "zzz" — zumbido controlado', durationSec: 15, syllable: 'zzz', visualType: 'sustainHold' },
    ],
  },
  {
    id: 'panting-breath',
    category: 'breath',
    name: 'Ejercicio de jadeo',
    subtitle: 'Agilidad del diafragma',
    icon: 'speed',
    durationMin: '2:00',
    level: 'Intermedio',
    color: '#34d399',
    description: 'Jadeos rápidos y ligeros tipo "ja ja ja". Activa el diafragma de forma rápida. Mantén los hombros quietos — todo el movimiento debe estar en el abdomen.',
    steps: [
      { instruction: 'Jadeos rápidos — 8 tiempos, abdomen rebotando', durationSec: 8, syllable: 'ja ja ja', visualType: 'dynamicBar' },
      { instruction: 'Descanso — respiración profunda y lenta', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Jadeos más rápidos — 12 tiempos', durationSec: 10, syllable: 'ja ja ja', visualType: 'dynamicBar' },
      { instruction: 'Descanso — respiración profunda y lenta', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Jadeo lento sostenido — siente el control', durationSec: 12, syllable: 'ja... ja... ja...', visualType: 'dynamicBar' },
    ],
  },
  {
    id: 'counted-breath',
    category: 'breath',
    name: 'Respiración contada',
    subtitle: 'Entrenamiento de capacidad',
    icon: 'hourglass_top',
    durationMin: '3:30',
    level: 'Avanzado',
    color: '#34d399',
    description: 'Inhala 4 tiempos, retén 7, exhala 8 (patrón 4-7-8). Técnica clásica usada por cantantes y músicos de viento para ampliar la capacidad pulmonar.',
    steps: [
      { instruction: 'Inhala — 4 tiempos', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Retén — 7 tiempos', durationSec: 7, visualType: 'sustainHold' },
      { instruction: 'Exhala con "fff" — 8 tiempos', durationSec: 8, syllable: 'fff', visualType: 'breathBar' },
      { instruction: 'Inhala — 4 tiempos', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Retén — 7 tiempos', durationSec: 7, visualType: 'sustainHold' },
      { instruction: 'Exhala con "sss" — 8 tiempos', durationSec: 8, syllable: 'sss', visualType: 'breathBar' },
      { instruction: 'Inhala — 4 tiempos', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Retén — 7 tiempos', durationSec: 7, visualType: 'sustainHold' },
      { instruction: 'Exhala cantando "ah" — 8 tiempos', durationSec: 8, syllable: 'ahhh', targetNote: 'C4', visualType: 'breathBar', listenForPitch: true },
    ],
  },

  // ═══════════════════════════════════════
  //  AFINACIÓN E INTONACIÓN
  // ═══════════════════════════════════════

  {
    id: 'major-scale',
    category: 'pitch',
    name: 'Escala mayor',
    subtitle: 'Precisión de afinación',
    icon: 'piano',
    durationMin: '3:00',
    level: 'Intermedio',
    color: '#007aff',
    description: 'Canta cada nota de la escala de Do mayor con "la". Ajusta cada tono con precisión usando la guía visual.',
    steps: [
      { instruction: 'Canta Do (raíz)', durationSec: 4, targetNote: 'C4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Re', durationSec: 4, targetNote: 'D4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Mi', durationSec: 4, targetNote: 'E4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Fa', durationSec: 4, targetNote: 'F4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Sol', durationSec: 4, targetNote: 'G4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta La', durationSec: 4, targetNote: 'A4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Si', durationSec: 4, targetNote: 'B4', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Do (octava)', durationSec: 4, targetNote: 'C5', syllable: 'la', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'minor-scale',
    category: 'pitch',
    name: 'Escala menor natural',
    subtitle: 'Tonalidad menor',
    icon: 'piano',
    durationMin: '3:00',
    level: 'Intermedio',
    color: '#007aff',
    description: 'Canta la escala de La menor natural con "nah". La escala menor entrena el oído para tonalidades más oscuras, comunes en pop, rock y R&B.',
    steps: [
      { instruction: 'Canta La (raíz)', durationSec: 4, targetNote: 'A3', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Si', durationSec: 4, targetNote: 'B3', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Do', durationSec: 4, targetNote: 'C4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Re', durationSec: 4, targetNote: 'D4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Mi', durationSec: 4, targetNote: 'E4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Fa', durationSec: 4, targetNote: 'F4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta Sol', durationSec: 4, targetNote: 'G4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Canta La (octava)', durationSec: 4, targetNote: 'A4', syllable: 'nah', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'octave-jumps',
    category: 'pitch',
    name: 'Saltos de octava',
    subtitle: 'Entrenamiento de intervalos',
    icon: 'swap_vert',
    durationMin: '3:00',
    level: 'Avanzado',
    color: '#007aff',
    description: 'Salta una octava completa hacia arriba y luego hacia abajo. Entrena las transiciones de registro y la precisión en intervalos grandes.',
    steps: [
      { instruction: 'Canta Do3, luego salta a Do4', durationSec: 5, targetNote: 'C4', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Canta Do4, luego baja a Do3', durationSec: 5, targetNote: 'C3', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Canta Re3, luego salta a Re4', durationSec: 5, targetNote: 'D4', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Canta Re4, luego baja a Re3', durationSec: 5, targetNote: 'D3', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Canta Mi3 a Mi4', durationSec: 5, targetNote: 'E4', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Canta Mi4 a Mi3', durationSec: 5, targetNote: 'E3', syllable: 'ah', visualType: 'intervalJump', listenForPitch: true },
    ],
  },
  {
    id: 'fifth-intervals',
    category: 'pitch',
    name: 'Ejercicio de quintas',
    subtitle: 'Reconocimiento de intervalos',
    icon: 'straighten',
    durationMin: '2:30',
    level: 'Intermedio',
    color: '#007aff',
    description: 'Canta la raíz y luego salta una quinta justa (ej. Do→Sol). La quinta es el intervalo más consonante — entrenarlo genera un fuerte anclaje tonal.',
    steps: [
      { instruction: 'Canta Do4', durationSec: 3, targetNote: 'C4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Salta a Sol4 (quinta)', durationSec: 4, targetNote: 'G4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Canta Re4', durationSec: 3, targetNote: 'D4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Salta a La4 (quinta)', durationSec: 4, targetNote: 'A4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Canta Mi4', durationSec: 3, targetNote: 'E4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
      { instruction: 'Salta a Si4 (quinta)', durationSec: 4, targetNote: 'B4', syllable: 'la', visualType: 'intervalJump', listenForPitch: true },
    ],
  },
  {
    id: 'chromatic-climb',
    category: 'pitch',
    name: 'Escala cromática',
    subtitle: 'Precisión por semitonos',
    icon: 'stacked_line_chart',
    durationMin: '3:00',
    level: 'Avanzado',
    color: '#007aff',
    description: 'Canta cada semitono de Do4 a Sol4 y de regreso. El entrenamiento cromático es el ejercicio de precisión máxima.',
    steps: [
      { instruction: 'Canta Do4', durationSec: 3, targetNote: 'C4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Semitono arriba — Do#4', durationSec: 3, targetNote: 'C4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Re4', durationSec: 3, targetNote: 'D4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Mi4', durationSec: 3, targetNote: 'E4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Fa4', durationSec: 3, targetNote: 'F4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sol4', durationSec: 3, targetNote: 'G4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Bajando a Fa4', durationSec: 3, targetNote: 'F4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Mi4', durationSec: 3, targetNote: 'E4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Re4', durationSec: 3, targetNote: 'D4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Resuelve en Do4', durationSec: 3, targetNote: 'C4', syllable: 'nee', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },

  // ═══════════════════════════════════════
  //  RESONANCIA Y COLOCACIÓN
  // ═══════════════════════════════════════

  {
    id: 'vowel-placement',
    category: 'resonance',
    name: 'Resonancia de vocales',
    subtitle: 'Colocación y claridad',
    icon: 'record_voice_over',
    durationMin: '3:00',
    level: 'Principiante',
    color: '#a78bfa',
    description: 'Sostén cada vocal pura en un tono cómodo. Siente dónde resuena cada una — al frente, en el centro o al fondo de la boca.',
    steps: [
      { instruction: 'Sostén "I" — siéntela en la máscara/frente', durationSec: 6, syllable: 'EE', targetNote: 'A3', visualType: 'vowelShape', listenForPitch: true },
      { instruction: 'Sostén "E" — un poco más abierta', durationSec: 6, syllable: 'EH', targetNote: 'A3', visualType: 'vowelShape', listenForPitch: true },
      { instruction: 'Sostén "A" — bien abierta, resonante', durationSec: 6, syllable: 'AH', targetNote: 'A3', visualType: 'vowelShape', listenForPitch: true },
      { instruction: 'Sostén "O" — redondea los labios', durationSec: 6, syllable: 'OH', targetNote: 'A3', visualType: 'vowelShape', listenForPitch: true },
      { instruction: 'Sostén "U" — apertura pequeña, siente el pecho', durationSec: 6, syllable: 'OO', targetNote: 'A3', visualType: 'vowelShape', listenForPitch: true },
    ],
  },
  {
    id: 'ng-resonance',
    category: 'resonance',
    name: 'Resonancia nasal "NG"',
    subtitle: 'Colocación de máscara',
    icon: 'hearing',
    durationMin: '2:30',
    level: 'Intermedio',
    color: '#a78bfa',
    description: 'Canta "ng" para dirigir toda la resonancia a la cavidad nasal. Luego abre a "ah" manteniendo el zumbido. Entrena la colocación frontal.',
    steps: [
      { instruction: 'Sostén "ng" — siente el zumbido en la nariz', durationSec: 6, targetNote: 'D4', syllable: 'ng', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Abre de "ng" a "ah" — mantén el zumbido', durationSec: 6, targetNote: 'D4', syllable: 'ng→ah', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"ng" a "i" — sonido brillante y frontal', durationSec: 6, targetNote: 'E4', syllable: 'ng→ee', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"ng" a "o" — redondeado pero frontal', durationSec: 6, targetNote: 'E4', syllable: 'ng→oh', visualType: 'vowelShape', listenForPitch: true },
    ],
  },
  {
    id: 'messa-di-voce',
    category: 'resonance',
    name: 'Messa di Voce',
    subtitle: 'Control dinámico',
    icon: 'graphic_eq',
    durationMin: '3:00',
    level: 'Avanzado',
    color: '#a78bfa',
    description: 'Empieza una nota muy suave, crece hasta el máximo volumen, luego decae hasta el silencio — todo en una sola respiración. El ejercicio definitivo de resonancia y control.',
    steps: [
      { instruction: 'Empieza pianissimo con "ah" — apenas audible', durationSec: 4, targetNote: 'C4', syllable: 'ah (pp)', visualType: 'dynamicBar', listenForPitch: true },
      { instruction: 'Crece gradualmente — mezzo forte', durationSec: 4, targetNote: 'C4', syllable: 'ah (mf)', visualType: 'dynamicBar', listenForPitch: true },
      { instruction: 'Pico en fortissimo — resonancia plena', durationSec: 3, targetNote: 'C4', syllable: 'AH (ff)', visualType: 'dynamicBar', listenForPitch: true },
      { instruction: 'Decrescendo — bajando el volumen', durationSec: 4, targetNote: 'C4', syllable: 'ah (mf→p)', visualType: 'dynamicBar', listenForPitch: true },
      { instruction: 'Desvanece casi al silencio', durationSec: 4, targetNote: 'C4', syllable: 'ah (pp)', visualType: 'dynamicBar', listenForPitch: true },
      { instruction: 'Repite en Mi4 — pp a ff a pp', durationSec: 12, targetNote: 'E4', syllable: 'oh', visualType: 'dynamicBar', listenForPitch: true },
    ],
  },
  {
    id: 'vowel-mod',
    category: 'resonance',
    name: 'Modificación de vocales',
    subtitle: 'Entrenamiento del passaggio',
    icon: 'tune',
    durationMin: '3:00',
    level: 'Avanzado',
    color: '#a78bfa',
    description: 'Modifica las vocales al subir para mantener la resonancia a través del passaggio. La "A" se redondea a "O", la "I" se cierra a "E".',
    steps: [
      { instruction: 'Canta "AH" en Do4', durationSec: 4, targetNote: 'C4', syllable: 'AH', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"AH" en Mi4 — empieza a redondear', durationSec: 4, targetNote: 'E4', syllable: 'AH→UH', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"UH" en Sol4 — cubre la vocal', durationSec: 4, targetNote: 'G4', syllable: 'UH', visualType: 'vowelShape', listenForPitch: true },
      { instruction: 'Desciende en "OH" — Sol4 a Do4', durationSec: 4, targetNote: 'C4', syllable: 'OH', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"I" en Do4 — brillante', durationSec: 4, targetNote: 'C4', syllable: 'EE', visualType: 'vowelShape', listenForPitch: true },
      { instruction: '"I→E" en Mi4 — redondea ligeramente', durationSec: 4, targetNote: 'E4', syllable: 'EE→IH', visualType: 'vowelShape', listenForPitch: true },
    ],
  },

  // ═══════════════════════════════════════
  //  EXTENSIÓN DE RANGO
  // ═══════════════════════════════════════

  {
    id: 'sirene-slides',
    category: 'range',
    name: 'Sirenas',
    subtitle: 'Rango y registros',
    icon: 'trending_up',
    durationMin: '3:00',
    level: 'Intermedio',
    color: '#ec4899',
    description: 'Deslízate suavemente desde tu nota más grave hasta la más aguda con "u". Conecta la voz de pecho y de cabeza sin interrupciones.',
    steps: [
      { instruction: 'Deslizamiento suave del registro grave al medio', durationSec: 8, syllable: 'oo↑', visualType: 'sirene' },
      { instruction: 'Continúa del medio al agudo', durationSec: 8, syllable: 'oo↑↑', visualType: 'sirene' },
      { instruction: 'Deslizamiento desde el agudo hacia abajo', durationSec: 10, syllable: 'oo↓↓', visualType: 'sirene' },
      { instruction: 'Sirena de rango completo — de abajo a arriba y de regreso', durationSec: 12, syllable: 'oo↑↓', visualType: 'sirene' },
    ],
  },
  {
    id: 'chest-voice-build',
    category: 'range',
    name: 'Fortalecimiento de voz de pecho',
    subtitle: 'Potencia en el registro grave',
    icon: 'arrow_downward',
    durationMin: '3:00',
    level: 'Intermedio',
    color: '#ec4899',
    description: 'Fortalece la voz de pecho con patrones descendentes de 5 notas. Mantén el tono lleno y resonante — siente la vibración en el pecho.',
    steps: [
      { instruction: 'Canta Sol3 con "goh"', durationSec: 4, targetNote: 'G3', syllable: 'goh', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Desciende a Fa3', durationSec: 4, targetNote: 'F3', syllable: 'goh', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Desciende a Mi3', durationSec: 4, targetNote: 'E3', syllable: 'goh', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Desciende a Re3', durationSec: 4, targetNote: 'D3', syllable: 'goh', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Base — Do3, pecho completo', durationSec: 5, targetNote: 'C3', syllable: 'goh', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'head-voice-float',
    category: 'range',
    name: 'Voz de cabeza liviana',
    subtitle: 'Facilidad en el registro agudo',
    icon: 'arrow_upward',
    durationMin: '3:00',
    level: 'Intermedio',
    color: '#ec4899',
    description: 'Sube hacia la voz de cabeza con "u". Mantén el sonido ligero y flotante — nunca empujes. Imagina que el sonido flota sobre tu cabeza.',
    steps: [
      { instruction: 'Empieza en Mi4 — "u" ligero', durationSec: 4, targetNote: 'E4', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Flota hacia Fa4', durationSec: 4, targetNote: 'F4', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sol4 — mantenlo ligero', durationSec: 4, targetNote: 'G4', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'La4 — sin forzar', durationSec: 4, targetNote: 'A4', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Si4 — voz de cabeza pura', durationSec: 4, targetNote: 'B4', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Do5 — flota en lo más agudo', durationSec: 5, targetNote: 'C5', syllable: 'oo', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'mix-voice-bridge',
    category: 'range',
    name: 'Voz mixta en el puente',
    subtitle: 'Mezcla de registros',
    icon: 'compare_arrows',
    durationMin: '4:00',
    level: 'Avanzado',
    color: '#ec4899',
    description: 'Canta a través del passaggio con "ney" — la consonante nasal ayuda a mantener la conexión. Evita el impulso de pasar al falsete.',
    steps: [
      { instruction: 'Empieza en pecho — Do4 con "ney"', durationSec: 4, targetNote: 'C4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Re4 — sigue con pecho dominante', durationSec: 4, targetNote: 'D4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Mi4 — acercándose al puente', durationSec: 4, targetNote: 'E4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Fa4 — mezcla aquí, siente la voz mixta', durationSec: 5, targetNote: 'F4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sol4 — territorio de voz mixta', durationSec: 5, targetNote: 'G4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'La4 — mantén la conexión', durationSec: 5, targetNote: 'A4', syllable: 'nay', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Desciende suavemente a Do4', durationSec: 8, targetNote: 'C4', syllable: 'nay↓', visualType: 'sirene', listenForPitch: true },
    ],
  },

  // ═══════════════════════════════════════
  //  AGILIDAD Y RUNS
  // ═══════════════════════════════════════

  {
    id: 'staccato-control',
    category: 'agility',
    name: 'Agilidad staccato',
    subtitle: 'Precisión y velocidad',
    icon: 'electric_bolt',
    durationMin: '3:00',
    level: 'Avanzado',
    color: '#ef4444',
    description: 'Notas cortas y nítidas con "ja" — una por tiempo. Entrena el control del diafragma y el cierre de cuerdas vocales para ataques limpios.',
    steps: [
      { instruction: 'Staccato en Do4 — golpes cortos de "ja"', durationSec: 8, syllable: 'ja ja ja ja', targetNote: 'C4', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sube a Mi4', durationSec: 8, syllable: 'ja ja ja ja', targetNote: 'E4', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sube a Sol4', durationSec: 8, syllable: 'ja ja ja ja', targetNote: 'G4', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Desciende: Sol4 → Mi4 → Do4', durationSec: 8, syllable: 'ja ja ja', targetNote: 'C4', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'triad-arpeggios',
    category: 'agility',
    name: 'Arpegios de tríada',
    subtitle: 'Flexibilidad melódica',
    icon: 'moving',
    durationMin: '3:00',
    level: 'Intermedio',
    color: '#ef4444',
    description: 'Canta patrones de arpegio 1-3-5-3-1 con "ya". Desarrolla la agilidad necesaria para los runs y pasajes melódicos en canciones.',
    steps: [
      { instruction: 'Do mayor: Do4-Mi4-Sol4-Mi4-Do4', durationSec: 6, targetNote: 'C4', syllable: 'ya', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Re mayor: Re4-Fa4-La4-Fa4-Re4', durationSec: 6, targetNote: 'D4', syllable: 'ya', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Mi mayor: Mi4-Sol4-Si4-Sol4-Mi4', durationSec: 6, targetNote: 'E4', syllable: 'ya', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Desciende: Re4-Fa4-La4-Fa4-Re4', durationSec: 6, targetNote: 'D4', syllable: 'ya', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Resuelve: Do4-Mi4-Sol4-Mi4-Do4', durationSec: 6, targetNote: 'C4', syllable: 'ya', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'five-note-runs',
    category: 'agility',
    name: 'Runs de 5 notas',
    subtitle: 'Entrenamiento de velocidad',
    icon: 'sprint',
    durationMin: '3:00',
    level: 'Avanzado',
    color: '#ef4444',
    description: 'Canta patrones ascendentes y descendentes de 5 notas (1-2-3-4-5-4-3-2-1) aumentando el tempo cada ronda. La base del canto melismático.',
    steps: [
      { instruction: 'Lento: Do-Re-Mi-Fa-Sol-Fa-Mi-Re-Do con "da"', durationSec: 8, targetNote: 'C4', syllable: 'da da da...', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Velocidad media — mismo patrón', durationSec: 6, targetNote: 'C4', syllable: 'da da da...', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Sube: Re-Mi-Fa-Sol-La-Sol-Fa-Mi-Re', durationSec: 6, targetNote: 'D4', syllable: 'da da da...', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Rápido: Mi-Fa-Sol-La-Si-La-Sol-Fa-Mi', durationSec: 5, targetNote: 'E4', syllable: 'da da da...', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: 'Desciende de regreso a Do', durationSec: 8, targetNote: 'C4', syllable: 'da da da...', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'trill-flexibility',
    category: 'agility',
    name: 'Trino vocal',
    subtitle: 'Agilidad ornamental',
    icon: 'gesture',
    durationMin: '2:30',
    level: 'Avanzado',
    color: '#ef4444',
    description: 'Alterna rápidamente entre dos notas adyacentes (como un trino clásico). Empieza despacio y aumenta la velocidad. Esencial para gospel, clásico y R&B.',
    steps: [
      { instruction: 'Trino lento: alterna Do4-Re4 con "ah"', durationSec: 6, targetNote: 'C4', syllable: 'ah-ah-ah', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Acelera la alternancia', durationSec: 6, targetNote: 'C4', syllable: 'ahahah', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Sube: trino Re4-Mi4', durationSec: 6, targetNote: 'D4', syllable: 'ahahah', visualType: 'trillWave', listenForPitch: true },
      { instruction: 'Trino Mi4-Fa4 — tan rápido como salga limpio', durationSec: 6, targetNote: 'E4', syllable: 'ahahah', visualType: 'trillWave', listenForPitch: true },
    ],
  },

  // ═══════════════════════════════════════
  //  ARTICULACIÓN Y DICCIÓN
  // ═══════════════════════════════════════

  {
    id: 'consonant-drill',
    category: 'articulation',
    name: 'Precisión de consonantes',
    subtitle: 'Ataques limpios',
    icon: 'format_bold',
    durationMin: '3:00',
    level: 'Principiante',
    color: '#06b6d4',
    description: 'Canta cada combinación consonante-vocal en un tono para entrenar inicios de palabras nítidos y limpios. Fundamental para la claridad de la letra.',
    steps: [
      { instruction: '"Ba Ba Ba Ba" en Do4 — B nítida', durationSec: 5, targetNote: 'C4', syllable: 'Ba Ba Ba Ba', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: '"Da Da Da Da" — precisión de punta de lengua', durationSec: 5, targetNote: 'C4', syllable: 'Da Da Da Da', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: '"Ga Ga Ga Ga" — parte trasera de la lengua', durationSec: 5, targetNote: 'C4', syllable: 'Ga Ga Ga Ga', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: '"Ma Ma Ma Ma" — inicio nasal', durationSec: 5, targetNote: 'D4', syllable: 'Ma Ma Ma Ma', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: '"Na Na Na Na" — nasal alveolar', durationSec: 5, targetNote: 'D4', syllable: 'Na Na Na Na', visualType: 'pitchLadder', listenForPitch: true },
      { instruction: '"La La La La" — flujo lateral', durationSec: 5, targetNote: 'E4', syllable: 'La La La La', visualType: 'pitchLadder', listenForPitch: true },
    ],
  },
  {
    id: 'tongue-twisters',
    category: 'articulation',
    name: 'Trabalenguas',
    subtitle: 'Dicción y velocidad',
    icon: 'record_voice_over',
    durationMin: '3:00',
    level: 'Intermedio',
    color: '#06b6d4',
    description: 'Habla o canta trabalenguas en un tono. Empieza despacio, luego aumenta la velocidad sin perder claridad. "Tres tristes tigres."',
    steps: [
      { instruction: '"Tres tristes tigres" — lento', durationSec: 6, targetNote: 'C4', syllable: 'Tres tristes...', visualType: 'sustainHold' },
      { instruction: 'La misma frase — velocidad media', durationSec: 5, syllable: 'Tres tristes...', visualType: 'sustainHold' },
      { instruction: '"Pablito clavó un clavito" — lento', durationSec: 6, targetNote: 'D4', syllable: 'Pablito...', visualType: 'sustainHold' },
      { instruction: 'Lo mismo — más rápido', durationSec: 5, syllable: 'Pablito...', visualType: 'sustainHold' },
      { instruction: '"El cielo está enladrillado" — cantado en Mi4', durationSec: 6, targetNote: 'E4', syllable: 'El cielo...', visualType: 'sustainHold', listenForPitch: true },
      { instruction: 'Lo mismo — tan rápido como salga claro', durationSec: 5, syllable: 'El cielo...', visualType: 'sustainHold' },
    ],
  },
  {
    id: 'legato-line',
    category: 'articulation',
    name: 'Línea legato',
    subtitle: 'Conexiones suaves',
    icon: 'horizontal_rule',
    durationMin: '3:00',
    level: 'Intermedio',
    color: '#06b6d4',
    description: 'Canta una frase conectada sin pausas entre notas. Enfócate en las transiciones suaves — lo opuesto al staccato. Así suenan los cantantes profesionales.',
    steps: [
      { instruction: 'Sostén Do4, deslízate suavemente a Re4', durationSec: 5, targetNote: 'D4', syllable: 'mah→', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Re4 suavemente a Mi4', durationSec: 5, targetNote: 'E4', syllable: 'mah→', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Mi4 a Fa4 — sin cortes', durationSec: 5, targetNote: 'F4', syllable: 'mah→', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Fa4 a Sol4 — fluido', durationSec: 5, targetNote: 'G4', syllable: 'mah→', visualType: 'sirene', listenForPitch: true },
      { instruction: 'Desciende suavemente Sol4-Fa4-Mi4-Re4-Do4', durationSec: 10, targetNote: 'C4', syllable: 'mah→', visualType: 'sirene', listenForPitch: true },
    ],
  },
];
