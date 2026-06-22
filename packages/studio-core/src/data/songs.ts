import { type Genre } from './progressions';

export interface ChordMarker {
  chord: string;
  offset: number;      // Character index in the lyrics line
  timestamp?: number;  // Optional start time in ms
}

export interface LyricsLine {
  lyrics: string;
  chords: ChordMarker[];
  timestamp?: number;  // Optional start time in ms
  duration?: number;   // Optional duration in ms
}

export interface SongChartSection {
  name: string;
  lines: LyricsLine[];
}

export interface SongChart {
  id: string;
  title: string;
  artist: string;
  album?: string;
  year?: string;
  era?: string;
  genre: Genre;
  key: string;
  bpm?: number;
  capo?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  availabilityStatus: 'available' | 'coming-soon' | 'restricted';
  progression: string[];
  progressionLabel: string;
  description: string;
  sections: SongChartSection[];
}

export const ENJAMBRE_SONGS: SongChart[] = [
  {
    id: 'dulce-soledad',
    title: 'Dulce Soledad',
    artist: 'Enjambre',
    album: 'Daltónico',
    year: '2010',
    genre: 'spanish-rock',
    key: 'Am',
    bpm: 124,
    capo: 0,
    difficulty: 'easy',
    tags: ['Melancholic', 'Indie', 'Sing-along'],
    availabilityStatus: 'available',
    progression: ['Am', 'C', 'G', 'F'],
    progressionLabel: 'i – bIII – bVII – bVI',
    description: 'Enjambre’s breakout indie anthem. A driving rhythm with a haunting, melancholic chord progression.',
    sections: [
      {
        name: 'Intro',
        lines: [
          { lyrics: ' ', chords: [{ chord: 'Am', offset: 0 }, { chord: 'C', offset: 10 }] }
        ]
      },
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Agradecido de tenerte dulce soledad', chords: [{ chord: 'Am', offset: 0 }, { chord: 'C', offset: 21 }] },
          { lyrics: 'No me cabe duda que me vienes a buscar', chords: [{ chord: 'G', offset: 0 }, { chord: 'F', offset: 23 }] },
          { lyrics: 'Cuando los demas deciden irse a retirar', chords: [{ chord: 'Am', offset: 0 }, { chord: 'C', offset: 22 }] }
        ]
      },
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Dulce soledad, ven y baila conmigo', chords: [{ chord: 'C', offset: 0 }, { chord: 'G', offset: 15 }, { chord: 'Am', offset: 31 }] },
          { lyrics: 'Dulce soledad, se mi unico abrigo', chords: [{ chord: 'F', offset: 0 }, { chord: 'G', offset: 15 }, { chord: 'C', offset: 28 }] }
        ]
      }
    ]
  },
  {
    id: 'visita',
    title: 'Visita',
    artist: 'Enjambre',
    album: 'Daltónico',
    year: '2010',
    genre: 'spanish-rock',
    key: 'C',
    bpm: 118,
    capo: 0,
    difficulty: 'easy',
    tags: ['Upbeat', 'Indie', 'Romantic'],
    availabilityStatus: 'available',
    progression: ['C', 'Em', 'F', 'G'],
    progressionLabel: 'I – iii – IV – V',
    description: 'A romantic indie pop track featuring a bright, optimistic chord sequence with vintage synthesizers.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Que buena visita recibi hoy en mi portal', chords: [{ chord: 'C', offset: 0 }, { chord: 'Em', offset: 23 }] },
          { lyrics: 'Trajo flores de su jardin para mi altar', chords: [{ chord: 'F', offset: 0 }, { chord: 'G', offset: 25 }] }
        ]
      },
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Y me da gusto ver que sigues aqui', chords: [{ chord: 'C', offset: 0 }, { chord: 'Em', offset: 22 }] },
          { lyrics: 'Y me da gusto ver que no te perdi', chords: [{ chord: 'F', offset: 0 }, { chord: 'G', offset: 22 }] }
        ]
      }
    ]
  },
  {
    id: 'mania-cardiaca',
    title: 'Manía Cardíaca',
    artist: 'Enjambre',
    album: 'El Segundo es Felino',
    year: '2008',
    genre: 'spanish-rock',
    key: 'Dm',
    bpm: 130,
    capo: 0,
    difficulty: 'medium',
    tags: ['Energetic', 'Classic', 'Tension'],
    availabilityStatus: 'available',
    progression: ['Dm', 'A', 'F', 'G'],
    progressionLabel: 'i – V – bIII – IV',
    description: 'A high-energy classic featuring driving keyboards and dramatic minor-key chord transitions.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Tengo una mania que me late en el pecho', chords: [{ chord: 'Dm', offset: 0 }, { chord: 'A', offset: 20 }] },
          { lyrics: 'Una condicion que me tiene insatisfecho', chords: [{ chord: 'F', offset: 0 }, { chord: 'G', offset: 20 }] }
        ]
      },
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Mania cardiaca, me roba la calma', chords: [{ chord: 'Dm', offset: 0 }, { chord: 'F', offset: 15 }, { chord: 'A', offset: 27 }] }
        ]
      }
    ]
  },
  {
    id: 'camara-de-faltas',
    title: 'Cámara de Faltas',
    artist: 'Enjambre',
    album: 'Imperfecto Extraño',
    year: '2017',
    genre: 'spanish-rock',
    key: 'F#m',
    bpm: 112,
    capo: 2,
    difficulty: 'medium',
    tags: ['Groovy', 'Modern', 'Bass-heavy'],
    availabilityStatus: 'available',
    progression: ['F#m', 'D', 'Bm', 'C#'],
    progressionLabel: 'i – bVI – iv – V',
    description: 'A smooth, modern track with a groovy rhythm section and lush minor chord changes.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Entrando a la camara de las faltas sin avisar', chords: [{ chord: 'F#m', offset: 0 }, { chord: 'D', offset: 23 }] },
          { lyrics: 'No queda paciencia para poder disimular', chords: [{ chord: 'Bm', offset: 0 }, { chord: 'C#', offset: 22 }] }
        ]
      }
    ]
  },
  {
    id: 'somos-ajenos',
    title: 'Somos Ajenos',
    artist: 'Enjambre',
    album: 'Huéspedes del Orbe',
    year: '2012',
    genre: 'spanish-rock',
    key: 'Em',
    bpm: 120,
    capo: 0,
    difficulty: 'medium',
    tags: ['Melancholic', 'Indie', 'Synth-rock'],
    availabilityStatus: 'available',
    progression: ['Em', 'C', 'Am', 'B'],
    progressionLabel: 'i – bVI – iv – V',
    description: 'A dynamic synth-rock track exploring themes of alienation with a powerful, emotional minor chorus.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Tu y yo somos de mundos distintos al fin', chords: [{ chord: 'Em', offset: 0 }, { chord: 'C', offset: 18 }] },
          { lyrics: 'No intentes fingir que todo gira en torno a ti', chords: [{ chord: 'Am', offset: 0 }, { chord: 'B', offset: 24 }] }
        ]
      }
    ]
  },
  {
    id: 'impacto',
    title: 'Impacto',
    artist: 'Enjambre',
    album: 'El Segundo es Felino',
    year: '2008',
    genre: 'spanish-rock',
    key: 'G',
    bpm: 126,
    capo: 0,
    difficulty: 'easy',
    tags: ['Energetic', 'Classic', 'Live-favorite'],
    availabilityStatus: 'available',
    progression: ['G', 'C', 'D', 'Em'],
    progressionLabel: 'I – IV – V – vi',
    description: 'An upbeat, organ-driven classic with simple major-key chord changes that generate intense crowd energy.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Fue un impacto directo al corazon', chords: [{ chord: 'G', offset: 0 }, { chord: 'C', offset: 14 }, { chord: 'D', offset: 25 }] }
        ]
      }
    ]
  },
  {
    id: 'vida-en-el-espejo',
    title: 'Vida en el Espejo',
    artist: 'Enjambre',
    album: 'Imperfecto Extraño',
    year: '2017',
    genre: 'spanish-rock',
    key: 'A',
    bpm: 98,
    capo: 0,
    difficulty: 'medium',
    tags: ['Melodic', 'Introspective', 'Dreamy'],
    availabilityStatus: 'available',
    progression: ['A', 'C#m', 'D', 'Dm'],
    progressionLabel: 'I – iii – IV – iv',
    description: 'A melodic, introspective track featuring a classic minor-IV resolution that highlights the nostalgic vocal melody.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Miro mi reflejo y no logro reconocer', chords: [{ chord: 'A', offset: 0 }, { chord: 'C#m', offset: 18 }] },
          { lyrics: 'El paso del tiempo que me empieza a vencer', chords: [{ chord: 'D', offset: 0 }, { chord: 'Dm', offset: 22 }] }
        ]
      }
    ]
  },
  {
    id: 'elemento',
    title: 'Elemento',
    artist: 'Enjambre',
    album: 'Huéspedes del Orbe',
    year: '2012',
    genre: 'spanish-rock',
    key: 'Fm',
    bpm: 110,
    capo: 1,
    difficulty: 'hard',
    tags: ['Dramatic', 'Heavy', 'Intense'],
    availabilityStatus: 'available',
    progression: ['Fm', 'Db', 'Bbm', 'C'],
    progressionLabel: 'i – bVI – iv – V',
    description: 'A heavy, dramatic song with driving guitar lines and dark, complex chord textures.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Eres el elemento que me falta aqui', chords: [{ chord: 'Fm', offset: 0 }, { chord: 'Db', offset: 19 }, { chord: 'C', offset: 31 }] }
        ]
      }
    ]
  },
  {
    id: 'enemigo',
    title: 'Enemigo',
    artist: 'Enjambre',
    album: 'Daltónico',
    year: '2010',
    genre: 'spanish-rock',
    key: 'Bm',
    bpm: 122,
    capo: 2,
    difficulty: 'medium',
    tags: ['Tension', 'Indie', 'Synth-rich'],
    availabilityStatus: 'available',
    progression: ['Bm', 'G', 'D', 'F#'],
    progressionLabel: 'i – bVI – bIII – V',
    description: 'A tense, upbeat song with alternating synth patterns and sharp, staccato chord accents.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'No te quiero ver cerca de mi lugar', chords: [{ chord: 'Bm', offset: 0 }, { chord: 'G', offset: 16 }] },
          { lyrics: 'Te has convertido en alguien singular', chords: [{ chord: 'D', offset: 0 }, { chord: 'F#', offset: 18 }] }
        ]
      }
    ]
  },
  {
    id: 'y-la-esperanza',
    title: 'Y La Esperanza',
    artist: 'Enjambre',
    album: 'Próximos Prójimos',
    year: '2020',
    genre: 'spanish-rock',
    key: 'C#m',
    bpm: 115,
    capo: 4,
    difficulty: 'medium',
    tags: ['Hopeful', 'Modern', 'Acoustic-mix'],
    availabilityStatus: 'available',
    progression: ['C#m', 'A', 'E', 'B'],
    progressionLabel: 'i – bVI – bIII – bVII',
    description: 'A modern, acoustic-mix track carrying themes of resilience with a bright, soaring chorus.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Y la esperanza volvera a brillar', chords: [{ chord: 'E', offset: 0 }, { chord: 'B', offset: 15 }, { chord: 'C#m', offset: 27 }, { chord: 'A', offset: 32 }] }
        ]
      }
    ]
  },
  {
    id: 'sabado-perpetuo',
    title: 'Sábado Perpetuo',
    artist: 'Enjambre',
    album: 'Consuelo en Domingo',
    year: '2005',
    genre: 'spanish-rock',
    key: 'G#m',
    bpm: 128,
    capo: 4,
    difficulty: 'hard',
    tags: ['Classic', 'Guitar-solo', 'Indie-rock'],
    availabilityStatus: 'available',
    progression: ['G#m', 'E', 'C#m', 'D#'],
    progressionLabel: 'i – bVI – iv – V',
    description: 'An early indie-rock classic driven by sharp guitar parts, prominent bass, and dynamic chord builds.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Esperando el fin de semana para salir', chords: [{ chord: 'G#m', offset: 0 }, { chord: 'E', offset: 20 }] }
        ]
      }
    ]
  },
  {
    id: 'secuaz',
    title: 'Secuaz',
    artist: 'Enjambre',
    album: 'Imperfecto Extraño',
    year: '2017',
    genre: 'spanish-rock',
    key: 'D',
    bpm: 105,
    capo: 0,
    difficulty: 'easy',
    tags: ['Groovy', 'Romantic', 'Chill'],
    availabilityStatus: 'available',
    progression: ['D', 'F#m', 'G', 'Gm'],
    progressionLabel: 'I – iii – IV – iv',
    description: 'A laid-back, groovy track utilizing a major-to-minor IV modulation for a warm, nostalgic feel.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Sere tu secuaz en la oscuridad', chords: [{ chord: 'D', offset: 0 }, { chord: 'F#m', offset: 12 }, { chord: 'G', offset: 20 }, { chord: 'Gm', offset: 25 }] }
        ]
      }
    ]
  },
  {
    id: 'tercer-tipo',
    title: 'Tercer Tipo',
    artist: 'Enjambre',
    album: 'Imperfecto Extraño',
    year: '2017',
    genre: 'spanish-rock',
    key: 'C',
    bpm: 120,
    capo: 0,
    difficulty: 'medium',
    tags: ['Spacey', 'Upbeat', 'Synth-pop'],
    availabilityStatus: 'available',
    progression: ['C', 'Am', 'Dm', 'G'],
    progressionLabel: 'I – vi – ii – V',
    description: 'A retro-future synth-pop song utilizing a classic I–vi–ii–V progression with modern guitar styling.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Es un encuentro del tercer tipo entre tu y yo', chords: [{ chord: 'C', offset: 0 }, { chord: 'Am', offset: 20 }, { chord: 'Dm', offset: 35 }] }
        ]
      }
    ]
  },
  {
    id: 'nueve',
    title: 'Nueve',
    artist: 'Enjambre',
    album: 'Consuelo en Domingo',
    year: '2005',
    genre: 'spanish-rock',
    key: 'Am',
    bpm: 110,
    capo: 0,
    difficulty: 'medium',
    tags: ['Melodramatic', 'Indie', 'Acoustic'],
    availabilityStatus: 'available',
    progression: ['Am', 'Dm', 'E', 'Am'],
    progressionLabel: 'i – iv – V – i',
    description: 'A melancholic early work relying heavily on acoustic guitar picking and standard minor chord movements.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Nueve veces te dije que no volviera a pasar', chords: [{ chord: 'Am', offset: 0 }, { chord: 'Dm', offset: 18 }, { chord: 'E', offset: 28 }] }
        ]
      }
    ]
  },
  {
    id: 'de-lunes-a-lunes',
    title: 'De Lunes a Lunes',
    artist: 'Enjambre',
    album: 'Próximos Prójimos',
    year: '2020',
    genre: 'spanish-rock',
    key: 'F',
    bpm: 100,
    capo: 0,
    difficulty: 'easy',
    tags: ['Chill', 'Indie-pop', 'Smooth'],
    availabilityStatus: 'available',
    progression: ['F', 'Bb', 'C', 'Am'],
    progressionLabel: 'I – IV – V – iii',
    description: 'A relaxed indie pop song about routine, using simple major scale changes for a comforting texture.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'De lunes a lunes te vuelvo a soñar', chords: [{ chord: 'F', offset: 0 }, { chord: 'Bb', offset: 16 }, { chord: 'C', offset: 25 }] }
        ]
      }
    ]
  },
  {
    id: 'rosa-nautica',
    title: 'Rosa Náutica',
    artist: 'Enjambre',
    album: 'Huéspedes del Orbe',
    year: '2012',
    genre: 'spanish-rock',
    key: 'Em',
    bpm: 116,
    capo: 0,
    difficulty: 'medium',
    tags: ['Classic', 'Dreamy', 'Vocal-driven'],
    availabilityStatus: 'available',
    progression: ['Em', 'G', 'D', 'C'],
    progressionLabel: 'i – bIII – bVII – bVI',
    description: 'A dreamy, soaring song featuring lush background vocals and expansive guitar textures.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Perdido en el mar de mi propia mente', chords: [{ chord: 'Em', offset: 0 }, { chord: 'G', offset: 18 }] }
        ]
      }
    ]
  },
  {
    id: 'divergencia',
    title: 'Divergencia',
    artist: 'Enjambre',
    album: 'Próximos Prójimos',
    year: '2020',
    genre: 'spanish-rock',
    key: 'A',
    bpm: 125,
    capo: 0,
    difficulty: 'easy',
    tags: ['Danceable', 'Upbeat', 'Synthesizer'],
    availabilityStatus: 'available',
    progression: ['A', 'D', 'E', 'F#m'],
    progressionLabel: 'I – IV – V – vi',
    description: 'A danceable, high-tempo synth track with simple major power movements and classic hook melodies.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Es nuestra divergencia lo mejor', chords: [{ chord: 'A', offset: 0 }, { chord: 'D', offset: 12 }, { chord: 'E', offset: 25 }] }
        ]
      }
    ]
  },
  {
    id: 'el-ultimo-tema',
    title: 'El Último Tema',
    artist: 'Enjambre',
    album: 'Próximos Prójimos',
    year: '2020',
    genre: 'spanish-rock',
    key: 'C',
    bpm: 90,
    capo: 0,
    difficulty: 'easy',
    tags: ['Soft', 'Acoustic', 'Nostalgic'],
    availabilityStatus: 'available',
    progression: ['C', 'F', 'G', 'C'],
    progressionLabel: 'I – IV – V – I',
    description: 'A quiet acoustic ballad meant to close live sets, featuring simple progressions and strong vocal harmonies.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Este es el ultimo tema que te cantare', chords: [{ chord: 'C', offset: 0 }, { chord: 'F', offset: 19 }, { chord: 'G', offset: 31 }] }
        ]
      }
    ]
  },
  {
    id: 'madrugada',
    title: 'Madrugada',
    artist: 'Enjambre',
    album: 'Daltónico',
    year: '2010',
    genre: 'spanish-rock',
    key: 'G#m',
    bpm: 114,
    capo: 4,
    difficulty: 'medium',
    tags: ['Indie', 'Introspective', 'Melodic'],
    availabilityStatus: 'available',
    progression: ['G#m', 'D#', 'E', 'B'],
    progressionLabel: 'i – V – bVI – bIII',
    description: 'A slow-burning introspective track that captures the quiet stillness of the early morning hours.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Caminando solo en la madrugada sin parar', chords: [{ chord: 'G#m', offset: 0 }, { chord: 'E', offset: 23 }] }
        ]
      }
    ]
  },
  {
    id: 'relampago',
    title: 'Relámpago',
    artist: 'Enjambre',
    album: 'Próximos Prójimos',
    year: '2020',
    genre: 'spanish-rock',
    key: 'F#m',
    bpm: 136,
    capo: 2,
    difficulty: 'hard',
    tags: ['Heavy', 'Rock', 'Fast-paced'],
    availabilityStatus: 'available',
    progression: ['F#m', 'D', 'A', 'E'],
    progressionLabel: 'i – bVI – bIII – bVII',
    description: 'A fast-paced, high-energy rock song characterized by heavy guitar distortion and intense drum patterns.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Como un relampago caeras sobre mi', chords: [{ chord: 'F#m', offset: 0 }, { chord: 'D', offset: 16 }, { chord: 'E', offset: 28 }] }
        ]
      }
    ]
  },
  {
    id: 'cobarde',
    title: 'Cobarde',
    artist: 'Enjambre',
    album: 'Daltónico',
    year: '2010',
    genre: 'spanish-rock',
    key: 'Am',
    bpm: 104,
    capo: 0,
    difficulty: 'easy',
    tags: ['Ballad', 'Vocal-centric', 'Emotional'],
    availabilityStatus: 'available',
    progression: ['Am', 'Dm', 'G', 'C'],
    progressionLabel: 'i – iv – bVII – bIII',
    description: 'A powerful indie ballad that starts softly and builds into an emotional vocal climax.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Fui un cobarde al no decirte la verdad', chords: [{ chord: 'Am', offset: 0 }, { chord: 'Dm', offset: 16 }] }
        ]
      }
    ]
  },
  {
    id: 'ausencia-de-retorno',
    title: 'Ausencia de Retorno',
    artist: 'Enjambre',
    album: 'Consuelo en Domingo',
    year: '2005',
    genre: 'spanish-rock',
    key: 'Em',
    bpm: 118,
    capo: 0,
    difficulty: 'medium',
    tags: ['Classic', 'Melancholic', 'Indie'],
    availabilityStatus: 'available',
    progression: ['Em', 'Am', 'C', 'B7'],
    progressionLabel: 'i – iv – bVI – V7',
    description: 'A classic early track demonstrating the band’s signature blend of vintage and modern sounds.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'En la ausencia de tu retorno todo esta gris', chords: [{ chord: 'Em', offset: 0 }, { chord: 'Am', offset: 25 }] }
        ]
      }
    ]
  },
  {
    id: 'fe-linea-de-frente',
    title: 'Fe, Línea de Frente',
    artist: 'Enjambre',
    album: 'Consuelo en Domingo',
    year: '2005',
    genre: 'spanish-rock',
    key: 'Dm',
    bpm: 122,
    capo: 5,
    difficulty: 'hard',
    tags: ['Energetic', 'Complex', 'Classic'],
    availabilityStatus: 'available',
    progression: ['Dm', 'Gm', 'C', 'F'],
    progressionLabel: 'i – iv – bVII – bIII',
    description: 'An energetic early track featuring shifting structures and complex keyboard melodies.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Mantendre la fe en la linea de frente', chords: [{ chord: 'Dm', offset: 0 }, { chord: 'Gm', offset: 17 }, { chord: 'C', offset: 27 }] }
        ]
      }
    ]
  },
  {
    id: 'nudo',
    title: 'Nudo',
    artist: 'Enjambre',
    album: 'Consuelo en Domingo',
    year: '2005',
    genre: 'spanish-rock',
    key: 'Bm',
    bpm: 108,
    capo: 2,
    difficulty: 'medium',
    tags: ['Acoustic', 'Melodramatic', 'Intimate'],
    availabilityStatus: 'available',
    progression: ['Bm', 'Em', 'A', 'F#m'],
    progressionLabel: 'i – iv – bVII – v',
    description: 'An intimate, acoustic-heavy ballad built on arpeggiated guitar parts and dramatic dynamic swells.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Tengo un nudo en la garganta al cantar', chords: [{ chord: 'Bm', offset: 0 }, { chord: 'Em', offset: 20 }] }
        ]
      }
    ]
  },
  {
    id: 'espacio-vacio',
    title: 'Espacio Vacío',
    artist: 'Enjambre',
    album: 'El Segundo es Felino',
    year: '2008',
    genre: 'spanish-rock',
    key: 'Am',
    bpm: 116,
    capo: 0,
    difficulty: 'easy',
    tags: ['Chill', 'Vintage', 'Dreamy'],
    availabilityStatus: 'available',
    progression: ['Am', 'F', 'C', 'G'],
    progressionLabel: 'i – bVI – bIII – bVII',
    description: 'A spacious, retro-leaning song featuring sparse instrumentation and a deep, repeating groove.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Queda un espacio vacio en la habitacion', chords: [{ chord: 'Am', offset: 0 }, { chord: 'F', offset: 19 }] }
        ]
      }
    ]
  },
  {
    id: 'tulipanes',
    title: 'Tulipanes',
    artist: 'Enjambre',
    album: 'El Segundo es Felino',
    year: '2008',
    genre: 'spanish-rock',
    key: 'C',
    bpm: 110,
    capo: 0,
    difficulty: 'easy',
    tags: ['Bright', 'Indie', 'Acoustic'],
    availabilityStatus: 'available',
    progression: ['C', 'F', 'Am', 'G'],
    progressionLabel: 'I – IV – vi – V',
    description: 'A bright acoustic-pop track with warm backing synthesizers and straightforward chord transitions.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Traje tulipanes para decorar tu mesa', chords: [{ chord: 'C', offset: 0 }, { chord: 'F', offset: 15 }, { chord: 'G', offset: 31 }] }
        ]
      }
    ]
  },
  {
    id: 'enredado',
    title: 'Enredado',
    artist: 'Enjambre',
    album: 'Huéspedes del Orbe',
    year: '2012',
    genre: 'spanish-rock',
    key: 'Dm',
    bpm: 124,
    capo: 5,
    difficulty: 'medium',
    tags: ['Synth-heavy', 'Upbeat', 'Energetic'],
    availabilityStatus: 'available',
    progression: ['Dm', 'Bb', 'F', 'C'],
    progressionLabel: 'i – bVI – bIII – bVII',
    description: 'A driving, synthesizer-heavy track featuring fast chord changes and a punchy drum loop.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Me quedo enredado en tus mentiras otra vez', chords: [{ chord: 'Dm', offset: 0 }, { chord: 'Bb', offset: 18 }] }
        ]
      }
    ]
  },
  {
    id: 'estentoreo',
    title: 'Estentóreo',
    artist: 'Enjambre',
    album: 'Imperfecto Extraño',
    year: '2017',
    genre: 'spanish-rock',
    key: 'Em',
    bpm: 118,
    capo: 0,
    difficulty: 'hard',
    tags: ['Groovy', 'Modern', 'Complex'],
    availabilityStatus: 'available',
    progression: ['Em', 'Cmaj7', 'Am7', 'B7'],
    progressionLabel: 'i – bVI7 – iv7 – V7',
    description: 'A modern jazz-tinged indie rock track with complex bass movement and rich 7th chord voicings.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Es un grito estentoreo en el vacio', chords: [{ chord: 'Em', offset: 0 }, { chord: 'Cmaj7', offset: 18 }, { chord: 'Am7', offset: 32 }] }
        ]
      }
    ]
  },
  {
    id: 'hematoma',
    title: 'Hematoma',
    artist: 'Enjambre',
    album: 'Daltónico',
    year: '2010',
    genre: 'spanish-rock',
    key: 'Am',
    bpm: 120,
    capo: 0,
    difficulty: 'medium',
    tags: ['Tension', 'Guitar-driven', 'Indie'],
    availabilityStatus: 'available',
    progression: ['Am', 'E', 'F', 'C'],
    progressionLabel: 'i – V – bVI – bIII',
    description: 'A tense, guitar-focused track with alternating clean chords and distorted power runs.',
    sections: [
      {
        name: 'Verse',
        lines: [
          { lyrics: 'Quedo un hematoma en mi orgullo al final', chords: [{ chord: 'Am', offset: 0 }, { chord: 'E', offset: 18 }] }
        ]
      }
    ]
  },
  {
    id: 'intruso',
    title: 'Intruso',
    artist: 'Enjambre',
    album: 'Daltónico',
    year: '2010',
    genre: 'spanish-rock',
    key: 'F#m',
    bpm: 126,
    capo: 2,
    difficulty: 'hard',
    tags: ['Heavy', 'Synth-rock', 'Dramatic'],
    availabilityStatus: 'available',
    progression: ['F#m', 'D', 'Bm', 'C#'],
    progressionLabel: 'i – bVI – iv – V',
    description: 'A dramatic synth-rock track featuring shifting dynamic sections and heavy chord drops.',
    sections: [
      {
        name: 'Chorus',
        lines: [
          { lyrics: 'Como un intruso me meti en tu habitacion', chords: [{ chord: 'F#m', offset: 0 }, { chord: 'D', offset: 15 }, { chord: 'Bm', offset: 28 }] }
        ]
      }
    ]
  }
];
