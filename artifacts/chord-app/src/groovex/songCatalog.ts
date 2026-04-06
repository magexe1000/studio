export interface StemInfo {
  name: string;
  label: string;
  icon: string;
}

export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  source: string;
  bpm: number;
  key: string;
  duration: string;
  stems: StemInfo[];
  genre: string;
  hasStems: boolean;
}

const RB_STEMS: StemInfo[] = [
  { name: 'kick', label: 'Kick', icon: 'layers' },
  { name: 'snare', label: 'Snare', icon: 'target' },
  { name: 'cymbals', label: 'Cymbals', icon: 'noise_aware' },
  { name: 'bass', label: 'Bass', icon: 'graphic_eq' },
  { name: 'guitar', label: 'Guitar', icon: 'music_note' },
  { name: 'vocals', label: 'Vocals', icon: 'mic' },
  { name: 'backing', label: 'Backing', icon: 'queue_music' },
];

const RB_STEMS_CROWD: StemInfo[] = [
  ...RB_STEMS,
  { name: 'crowd', label: 'Crowd', icon: 'groups' },
];

const RB_STEMS_KEYS: StemInfo[] = [
  ...RB_STEMS,
  { name: 'keys', label: 'Keys', icon: 'piano' },
];

const RB_DRUMS_ONLY: StemInfo[] = [
  { name: 'drums', label: 'Drums', icon: 'layers' },
  { name: 'bass', label: 'Bass', icon: 'graphic_eq' },
  { name: 'guitar', label: 'Guitar', icon: 'music_note' },
  { name: 'vocals', label: 'Vocals', icon: 'mic' },
  { name: 'backing', label: 'Backing', icon: 'queue_music' },
];

const RB_DRUMS_KEYS: StemInfo[] = [
  ...RB_DRUMS_ONLY,
  { name: 'keys', label: 'Keys', icon: 'piano' },
];

const RB_DRUMS_CROWD: StemInfo[] = [
  ...RB_DRUMS_ONLY,
  { name: 'crowd', label: 'Crowd', icon: 'groups' },
];

const RB_NO_BASS_NO_BACKING: StemInfo[] = [
  { name: 'kick', label: 'Kick', icon: 'layers' },
  { name: 'snare', label: 'Snare', icon: 'target' },
  { name: 'cymbals', label: 'Cymbals', icon: 'noise_aware' },
  { name: 'guitar', label: 'Guitar', icon: 'music_note' },
  { name: 'vocals', label: 'Vocals', icon: 'mic' },
];

const RB_SNARE_CYMBALS: StemInfo[] = [
  { name: 'kick', label: 'Kick', icon: 'layers' },
  { name: 'snare_cymbals', label: 'Snare/Cymbals', icon: 'target' },
  { name: 'bass', label: 'Bass', icon: 'graphic_eq' },
  { name: 'guitar', label: 'Guitar', icon: 'music_note' },
  { name: 'vocals', label: 'Vocals', icon: 'mic' },
  { name: 'backing', label: 'Backing', icon: 'queue_music' },
];

const RB_SNARE_CYMBALS_CROWD: StemInfo[] = [
  ...RB_SNARE_CYMBALS,
  { name: 'crowd', label: 'Crowd', icon: 'groups' },
];

export const SONG_CATALOG: SongMeta[] = [
  // ── 4 Non Blondes ──
  { id: '4nonblondes-whats-up', title: "What's Up?", artist: '4 Non Blondes', source: 'Rock Band DLC', bpm: 134, key: 'A Major', duration: '4:57', stems: RB_DRUMS_CROWD, genre: 'Alternative Rock', hasStems: true },

  // ── a-ha ──
  { id: 'aha-take-on-me', title: 'Take on Me', artist: 'a-ha', source: 'Rock Band DLC', bpm: 169, key: 'A Major', duration: '3:47', stems: RB_DRUMS_KEYS, genre: 'New Wave', hasStems: true },

  // ── AC/DC ──
  { id: 'acdc-back-in-black', title: 'Back in Black', artist: 'AC/DC', source: 'AC/DC Live', bpm: 120, key: 'E Minor', duration: '4:15', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-dirty-deeds', title: 'Dirty Deeds Done Dirt Cheap', artist: 'AC/DC', source: 'Rock Band DLC', bpm: 134, key: 'E Major', duration: '3:51', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-fire-your-guns', title: 'Fire Your Guns', artist: 'AC/DC', source: 'AC/DC Live', bpm: 120, key: 'A Major', duration: '2:53', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-heatseeker', title: 'Heatseeker', artist: 'AC/DC', source: 'AC/DC Live', bpm: 136, key: 'A Major', duration: '3:51', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-hell-aint-bad', title: "Hell Ain't a Bad Place to Be", artist: 'AC/DC', source: 'AC/DC Live', bpm: 120, key: 'A Major', duration: '4:11', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-hells-bells', title: 'Hells Bells', artist: 'AC/DC', source: 'AC/DC Live', bpm: 114, key: 'A Minor', duration: '5:12', stems: RB_NO_BASS_NO_BACKING, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-highway-to-hell', title: 'Highway to Hell', artist: 'AC/DC', source: 'AC/DC Live', bpm: 116, key: 'A Major', duration: '3:28', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-let-there-be-rock', title: 'Let There Be Rock', artist: 'AC/DC', source: 'AC/DC Live', bpm: 130, key: 'A Major', duration: '6:06', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-shoot-to-thrill', title: 'Shoot to Thrill', artist: 'AC/DC', source: 'AC/DC Live', bpm: 128, key: 'A Major', duration: '5:17', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-shot-in-the-dark', title: 'Shot in the Dark', artist: 'AC/DC', source: 'Rock Band DLC', bpm: 128, key: 'A Major', duration: '3:05', stems: RB_DRUMS_ONLY, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-the-jack', title: 'The Jack', artist: 'AC/DC', source: 'AC/DC Live', bpm: 122, key: 'E Major', duration: '5:53', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-thunderstruck', title: 'Thunderstruck', artist: 'AC/DC', source: 'AC/DC Live', bpm: 132, key: 'B Minor', duration: '4:52', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-tnt', title: 'T.N.T.', artist: 'AC/DC', source: 'AC/DC Live', bpm: 126, key: 'E Major', duration: '3:35', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-whole-lotta-rosie', title: 'Whole Lotta Rosie', artist: 'AC/DC', source: 'Rock Band DLC', bpm: 128, key: 'A Major', duration: '5:23', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },
  { id: 'acdc-you-shook-me', title: 'You Shook Me All Night Long', artist: 'AC/DC', source: 'AC/DC Live', bpm: 128, key: 'G Major', duration: '3:30', stems: RB_STEMS, genre: 'Hard Rock', hasStems: true },

  // ── Bon Jovi ──
  { id: 'bonjovi-livin', title: 'Livin\' on a Prayer', artist: 'Bon Jovi', source: 'Rock Band 2', bpm: 122, key: 'E Minor', duration: '4:09', stems: RB_STEMS_CROWD, genre: 'Rock', hasStems: true },
  { id: 'bonjovi-runaway', title: 'Runaway', artist: 'Bon Jovi', source: 'Rock Band DLC', bpm: 140, key: 'C Minor', duration: '3:52', stems: RB_STEMS_KEYS, genre: 'Rock', hasStems: true },
  { id: 'bonjovi-wanted', title: 'Wanted Dead or Alive', artist: 'Bon Jovi', source: 'Rock Band 1', bpm: 74, key: 'D Major', duration: '5:08', stems: RB_STEMS_CROWD, genre: 'Rock', hasStems: true },

  // ── Boston ──
  { id: 'boston-more-than-feeling', title: 'More Than a Feeling', artist: 'Boston', source: 'Rock Band DLC', bpm: 110, key: 'D Major', duration: '4:46', stems: RB_STEMS, genre: 'Classic Rock', hasStems: true },
  { id: 'boston-rock-roll-band', title: 'Rock and Roll Band', artist: 'Boston', source: 'Rock Band DLC', bpm: 120, key: 'A Major', duration: '3:00', stems: RB_STEMS, genre: 'Classic Rock', hasStems: true },

  // ── Daft Punk ──
  { id: 'daftpunk-get-lucky', title: 'Get Lucky', artist: 'Daft Punk ft. Pharrell Williams', source: 'Rock Band DLC', bpm: 116, key: 'B Minor', duration: '6:09', stems: RB_DRUMS_ONLY, genre: 'Electronic', hasStems: true },

  // ── Duran Duran ──
  { id: 'duranduran-hungry-wolf', title: 'Hungry Like the Wolf', artist: 'Duran Duran', source: 'Rock Band DLC', bpm: 156, key: 'E Minor', duration: '3:25', stems: RB_SNARE_CYMBALS_CROWD, genre: 'New Wave', hasStems: true },

  // ── Foo Fighters ──
  { id: 'foo-all-my-life', title: 'All My Life', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 152, key: 'F# Minor', duration: '4:23', stems: RB_STEMS_CROWD, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-best-of-you', title: 'Best of You', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 128, key: 'D Minor', duration: '4:16', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-doa', title: 'DOA', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 150, key: 'B Minor', duration: '4:12', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-doll', title: 'Doll', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 100, key: 'A Minor', duration: '3:53', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-enough-space', title: 'Enough Space', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 126, key: 'D Minor', duration: '4:16', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-everlong', title: 'Everlong', artist: 'Foo Fighters', source: 'Rock Band 2', bpm: 158, key: 'B Major', duration: '4:10', stems: RB_STEMS_CROWD, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-february-stars', title: 'February Stars', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 106, key: 'D Major', duration: '4:44', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-hey-johnny-park', title: 'Hey, Johnny Park!', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 147, key: 'A Major', duration: '4:08', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-ill-stick-around', title: "I'll Stick Around", artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 168, key: 'B Minor', duration: '3:53', stems: RB_STEMS_CROWD, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-learn-to-fly', title: 'Learn to Fly', artist: 'Foo Fighters', source: 'Rock Band 1', bpm: 136, key: 'B Major', duration: '3:58', stems: RB_STEMS_CROWD, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-lonely-as-you', title: 'Lonely as You', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 100, key: 'D Major', duration: '4:10', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-monkey-wrench', title: 'Monkey Wrench', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 174, key: 'B Major', duration: '3:51', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-my-hero', title: 'My Hero', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 152, key: 'E Major', duration: '4:20', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-my-poor-brain', title: 'My Poor Brain', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 126, key: 'B Minor', duration: '3:35', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-new-way-home', title: 'New Way Home', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 136, key: 'D Minor', duration: '5:40', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-see-you', title: 'See You', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 132, key: 'E Minor', duration: '2:47', stems: RB_SNARE_CYMBALS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-the-pretender', title: 'The Pretender', artist: 'Foo Fighters', source: 'Rock Band 3', bpm: 172, key: 'A Minor', duration: '4:29', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-these-days', title: 'These Days', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 138, key: 'D Major', duration: '4:56', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-this-is-a-call', title: 'This Is a Call', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 154, key: 'E Major', duration: '3:53', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-times-like-these', title: 'Times Like These', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 144, key: 'D Major', duration: '4:27', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-up-in-arms', title: 'Up in Arms', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 102, key: 'G Major', duration: '2:15', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-walking-after-you', title: 'Walking After You', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 114, key: 'E Major', duration: '5:04', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-wheels', title: 'Wheels', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 134, key: 'D Major', duration: '4:57', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-wind-up', title: 'Wind Up', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 168, key: 'B Major', duration: '2:33', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'foo-word-forward', title: 'Word Forward', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 138, key: 'D Minor', duration: '4:20', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },

  // ── Foreigner ──
  { id: 'foreigner-blue-morning', title: 'Blue Morning, Blue Day', artist: 'Foreigner', source: 'Rock Band DLC', bpm: 136, key: 'E Major', duration: '3:12', stems: RB_STEMS, genre: 'Classic Rock', hasStems: true },
];

export function getArtists(): string[] {
  const set = new Set(SONG_CATALOG.map(s => s.artist));
  return [...set].sort();
}

export function getGenres(): string[] {
  const set = new Set(SONG_CATALOG.map(s => s.genre));
  return [...set].sort();
}

export function getSongsByArtist(artist: string): SongMeta[] {
  return SONG_CATALOG.filter(s => s.artist.toLowerCase() === artist.toLowerCase());
}
