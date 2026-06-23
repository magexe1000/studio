import { type SongChartSection } from './songs';

export const AUTHORIZED_CHORD_CHARTS: Record<string, SongChartSection[]> = {
  'dulce-soledad': [
    {
      name: 'Intro',
      lines: [
        {
          lyrics: ' ',
          chords: [
            { chord: 'Am', offset: 0, timestamp: 0 },
            { chord: 'C', offset: 4, timestamp: 2000 },
            { chord: 'G', offset: 8, timestamp: 4000 },
            { chord: 'F', offset: 12, timestamp: 6000 }
          ],
          timestamp: 0,
          duration: 8000
        }
      ]
    },
    {
      name: 'Verse 1',
      lines: [
        {
          lyrics: 'Agradecido de tenerte dulce soledad',
          chords: [
            { chord: 'Am', offset: 0, timestamp: 8000 },
            { chord: 'C', offset: 22, timestamp: 12000 }
          ],
          timestamp: 8000,
          duration: 8000
        },
        {
          lyrics: 'No me cabe duda que me vienes a buscar',
          chords: [
            { chord: 'G', offset: 0, timestamp: 16000 },
            { chord: 'F', offset: 23, timestamp: 20000 }
          ],
          timestamp: 16000,
          duration: 8000
        },
        {
          lyrics: 'Cuando me encuentro más perdido y sin un lugar',
          chords: [
            { chord: 'Am', offset: 0, timestamp: 24000 },
            { chord: 'C', offset: 33, timestamp: 28000 }
          ],
          timestamp: 24000,
          duration: 8000
        },
        {
          lyrics: 'Tú te sientas a mi lado y me empiezas a arrullar',
          chords: [
            { chord: 'G', offset: 0, timestamp: 32000 },
            { chord: 'F', offset: 24, timestamp: 36000 }
          ],
          timestamp: 32000,
          duration: 8000
        }
      ]
    },
    {
      name: 'Chorus',
      lines: [
        {
          lyrics: 'Dulce soledad, dulce soledad',
          chords: [
            { chord: 'C', offset: 0, timestamp: 40000 },
            { chord: 'G', offset: 15, timestamp: 44000 }
          ],
          timestamp: 40000,
          duration: 8000
        },
        {
          lyrics: 'Quédate conmigo un momento más',
          chords: [
            { chord: 'Am', offset: 0, timestamp: 48000 },
            { chord: 'F', offset: 15, timestamp: 52000 }
          ],
          timestamp: 48000,
          duration: 8000
        },
        {
          lyrics: 'Dulce soledad, dulce soledad',
          chords: [
            { chord: 'C', offset: 0, timestamp: 56000 },
            { chord: 'G', offset: 15, timestamp: 60000 }
          ],
          timestamp: 56000,
          duration: 8000
        },
        {
          lyrics: 'Que tu silencio me da paz',
          chords: [
            { chord: 'Am', offset: 0, timestamp: 64000 },
            { chord: 'F', offset: 16, timestamp: 68000 }
          ],
          timestamp: 64000,
          duration: 8000
        }
      ]
    },
    {
      name: 'Outro',
      lines: [
        {
          lyrics: ' ',
          chords: [
            { chord: 'Am', offset: 0, timestamp: 72000 },
            { chord: 'C', offset: 4, timestamp: 74000 },
            { chord: 'G', offset: 8, timestamp: 76000 },
            { chord: 'F', offset: 12, timestamp: 78000 },
            { chord: 'Am', offset: 16, timestamp: 80000 }
          ],
          timestamp: 72000,
          duration: 10000
        }
      ]
    }
  ],
  'visita': [
    {
      name: 'Intro',
      lines: [
        {
          lyrics: ' ',
          chords: [
            { chord: 'C', offset: 0, timestamp: 0 },
            { chord: 'Em', offset: 4, timestamp: 2000 },
            { chord: 'F', offset: 8, timestamp: 4000 },
            { chord: 'G', offset: 12, timestamp: 6000 }
          ],
          timestamp: 0,
          duration: 8000
        }
      ]
    },
    {
      name: 'Verse 1',
      lines: [
        {
          lyrics: 'He venido a visitarte de nuevo',
          chords: [
            { chord: 'C', offset: 0, timestamp: 8000 },
            { chord: 'Em', offset: 19, timestamp: 12000 }
          ],
          timestamp: 8000,
          duration: 8000
        },
        {
          lyrics: 'A decirte lo mucho que te quiero',
          chords: [
            { chord: 'F', offset: 0, timestamp: 16000 },
            { chord: 'G', offset: 19, timestamp: 20000 }
          ],
          timestamp: 16000,
          duration: 8000
        },
        {
          lyrics: 'No me importa la distancia ni el tiempo',
          chords: [
            { chord: 'C', offset: 0, timestamp: 24000 },
            { chord: 'Em', offset: 25, timestamp: 28000 }
          ],
          timestamp: 24000,
          duration: 8000
        },
        {
          lyrics: 'En mis pensamientos siempre te tengo',
          chords: [
            { chord: 'F', offset: 0, timestamp: 32000 },
            { chord: 'G', offset: 20, timestamp: 36000 }
          ],
          timestamp: 32000,
          duration: 8000
        }
      ]
    },
    {
      name: 'Chorus',
      lines: [
        {
          lyrics: 'Oh mi amor, hoy estoy aquí',
          chords: [
            { chord: 'F', offset: 0, timestamp: 40000 },
            { chord: 'G', offset: 11, timestamp: 42000 },
            { chord: 'C', offset: 20, timestamp: 44000 }
          ],
          timestamp: 40000,
          duration: 6000
        },
        {
          lyrics: 'Para hacerte sonreír',
          chords: [
            { chord: 'F', offset: 0, timestamp: 46000 },
            { chord: 'G', offset: 12, timestamp: 48000 },
            { chord: 'C', offset: 17, timestamp: 50000 }
          ],
          timestamp: 46000,
          duration: 6000
        }
      ]
    }
  ],
  'mania-cardiaca': [
    {
      name: 'Intro',
      lines: [
        {
          lyrics: ' ',
          chords: [
            { chord: 'Dm', offset: 0, timestamp: 0 },
            { chord: 'A', offset: 4, timestamp: 2000 },
            { chord: 'F', offset: 8, timestamp: 4000 },
            { chord: 'G', offset: 12, timestamp: 6000 }
          ],
          timestamp: 0,
          duration: 8000
        }
      ]
    },
    {
      name: 'Verse 1',
      lines: [
        {
          lyrics: 'Es una manía cardíaca',
          chords: [
            { chord: 'Dm', offset: 0, timestamp: 8000 },
            { chord: 'A', offset: 15, timestamp: 12000 }
          ],
          timestamp: 8000,
          duration: 8000
        },
        {
          lyrics: 'Tenerte en mi cabeza',
          chords: [
            { chord: 'F', offset: 0, timestamp: 16000 },
            { chord: 'G', offset: 14, timestamp: 20000 }
          ],
          timestamp: 16000,
          duration: 8000
        },
        {
          lyrics: 'Es una dulce amenaza',
          chords: [
            { chord: 'Dm', offset: 0, timestamp: 24000 },
            { chord: 'A', offset: 13, timestamp: 28000 }
          ],
          timestamp: 24000,
          duration: 8000
        },
        {
          lyrics: 'Perder la entereza',
          chords: [
            { chord: 'F', offset: 0, timestamp: 32000 },
            { chord: 'G', offset: 10, timestamp: 36000 }
          ],
          timestamp: 32000,
          duration: 8000
        }
      ]
    },
    {
      name: 'Chorus',
      lines: [
        {
          lyrics: 'Y no me digas que no',
          chords: [
            { chord: 'Bb', offset: 0, timestamp: 40000 },
            { chord: 'C', offset: 16, timestamp: 44000 }
          ],
          timestamp: 40000,
          duration: 8000
        },
        {
          lyrics: 'Cuando sabes que sí',
          chords: [
            { chord: 'Dm', offset: 0, timestamp: 48000 },
            { chord: 'F', offset: 14, timestamp: 52000 }
          ],
          timestamp: 48000,
          duration: 8000
        },
        {
          lyrics: 'Esta manía me mata por ti',
          chords: [
            { chord: 'Bb', offset: 0, timestamp: 56000 },
            { chord: 'C', offset: 17, timestamp: 60000 },
            { chord: 'Dm', offset: 23, timestamp: 62000 }
          ],
          timestamp: 56000,
          duration: 8000
        }
      ]
    }
  ]
};
