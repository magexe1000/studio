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

const RB_SNARE_CYMBALS_KEYS: StemInfo[] = [
  ...RB_SNARE_CYMBALS,
  { name: 'keys', label: 'Keys', icon: 'piano' },
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
  { id: 'foreigner-feels-first-time', title: 'Feels Like the First Time', artist: 'Foreigner', source: 'Rock Band DLC', bpm: 120, key: 'C Major', duration: '3:44', stems: RB_STEMS_CROWD, genre: 'Classic Rock', hasStems: true },
  { id: 'foreigner-headknocker', title: 'Head Games', artist: 'Foreigner', source: 'Rock Band DLC', bpm: 128, key: 'E Major', duration: '3:36', stems: RB_STEMS_CROWD, genre: 'Classic Rock', hasStems: true },
  { id: 'foreigner-i-want-to-know', title: 'I Want to Know What Love Is', artist: 'Foreigner', source: 'Rock Band DLC', bpm: 80, key: 'F Major', duration: '5:01', stems: [
    { name: 'kick', label: 'Kick', icon: 'layers' },
    { name: 'snare_cymbals', label: 'Snare/Cymbals', icon: 'target' },
    { name: 'bass', label: 'Bass', icon: 'graphic_eq' },
    { name: 'keys', label: 'Keys', icon: 'piano' },
    { name: 'vocals', label: 'Vocals', icon: 'mic' },
    { name: 'backing', label: 'Backing', icon: 'queue_music' },
  ], genre: 'Classic Rock', hasStems: true },
  { id: 'foreigner-juke-box-hero', title: 'Juke Box Hero', artist: 'Foreigner', source: 'Rock Band DLC', bpm: 94, key: 'E Minor', duration: '4:12', stems: RB_STEMS, genre: 'Classic Rock', hasStems: true },
  { id: 'foreigner-waiting', title: 'Waiting for a Girl Like You', artist: 'Foreigner', source: 'Rock Band DLC', bpm: 96, key: 'A Minor', duration: '4:34', stems: RB_STEMS_KEYS, genre: 'Classic Rock', hasStems: true },

  // ── Franz Ferdinand ──
  { id: 'franz-take-me-out', title: 'Take Me Out', artist: 'Franz Ferdinand', source: 'Rock Band DLC', bpm: 162, key: 'E Minor', duration: '3:58', stems: RB_STEMS, genre: 'Indie Rock', hasStems: true },

  // ── Huey Lewis & The News ──
  { id: 'huey-heart-rock-roll', title: 'The Heart of Rock & Roll', artist: 'Huey Lewis and the News', source: 'Rock Band DLC', bpm: 150, key: 'C Major', duration: '4:47', stems: RB_SNARE_CYMBALS_KEYS, genre: 'Pop Rock', hasStems: true },
  { id: 'huey-power-of-love', title: 'The Power of Love', artist: 'Huey Lewis and the News', source: 'Rock Band DLC', bpm: 120, key: 'Ab Major', duration: '4:06', stems: RB_STEMS_KEYS, genre: 'Pop Rock', hasStems: true },

  // ── Journey ──
  { id: 'journey-anyway', title: 'Any Way You Want It', artist: 'Journey', source: 'Rock Band 2', bpm: 148, key: 'G Major', duration: '3:22', stems: RB_STEMS_CROWD, genre: 'Classic Rock', hasStems: true },
  { id: 'journey-dont-stop', title: "Don't Stop Believin'", artist: 'Journey', source: 'Rock Band DLC', bpm: 120, key: 'E Major', duration: '4:10', stems: RB_STEMS, genre: 'Classic Rock', hasStems: true },
  { id: 'journey-dont-stop-rb3', title: "Don't Stop Believin' (RB3)", artist: 'Journey', source: 'Rock Band 3', bpm: 120, key: 'E Major', duration: '4:10', stems: RB_DRUMS_KEYS, genre: 'Classic Rock', hasStems: true },

  // ── Juanes ──
  { id: 'juanes-a-dios-le-pido', title: 'A Dios le Pido', artist: 'Juanes', source: 'Rock Band DLC', bpm: 132, key: 'A Minor', duration: '3:47', stems: RB_DRUMS_ONLY, genre: 'Latin Rock', hasStems: true },
  { id: 'juanes-camisa-negra', title: 'La Camisa Negra', artist: 'Juanes', source: 'Rock Band DLC', bpm: 132, key: 'A Minor', duration: '3:33', stems: RB_DRUMS_ONLY, genre: 'Latin Rock', hasStems: true },

  // ── Kenny Loggins ──
  { id: 'kenny-danger-zone', title: 'Danger Zone', artist: 'Kenny Loggins', source: 'Rock Band DLC', bpm: 132, key: 'D Minor', duration: '3:36', stems: RB_DRUMS_ONLY, genre: 'Pop Rock', hasStems: true },

  // ── Loverboy ──
  { id: 'loverboy-working', title: 'Working for the Weekend', artist: 'Loverboy', source: 'Rock Band DLC', bpm: 148, key: 'B Major', duration: '3:33', stems: RB_STEMS_KEYS, genre: 'Pop Rock', hasStems: true },

  // ── Mana ──
  { id: 'mana-oye-mi-amor', title: 'Oye Mi Amor', artist: 'Mana', source: 'Rock Band DLC', bpm: 138, key: 'D Minor', duration: '4:02', stems: RB_STEMS_KEYS, genre: 'Latin Rock', hasStems: true },

  // ── Megadeth ──
  { id: 'megadeth-symphony', title: 'Symphony of Destruction', artist: 'Megadeth', source: 'Rock Band DLC', bpm: 128, key: 'E Minor', duration: '4:05', stems: RB_STEMS, genre: 'Thrash Metal', hasStems: true },

  // ── Men at Work ──
  { id: 'menatwork-down-under', title: 'Down Under', artist: 'Men at Work', source: 'Rock Band DLC', bpm: 126, key: 'B Minor', duration: '3:44', stems: RB_SNARE_CYMBALS_KEYS, genre: 'New Wave', hasStems: true },
  { id: 'menatwork-overkill', title: 'Overkill', artist: 'Men at Work', source: 'Rock Band DLC', bpm: 144, key: 'D Major', duration: '3:32', stems: RB_SNARE_CYMBALS_KEYS, genre: 'New Wave', hasStems: true },

  // ── Metallica ──
  { id: 'metallica-enter-sandman', title: 'Enter Sandman', artist: 'Metallica', source: 'Rock Band DLC', bpm: 123, key: 'E Minor', duration: '5:31', stems: RB_STEMS_CROWD, genre: 'Thrash Metal', hasStems: true },
  { id: 'metallica-ride-lightning', title: 'Ride the Lightning', artist: 'Metallica', source: 'Rock Band DLC', bpm: 152, key: 'E Minor', duration: '6:36', stems: RB_STEMS, genre: 'Thrash Metal', hasStems: true },

  // ── Player ──
  { id: 'player-baby-come-back', title: 'Baby Come Back', artist: 'Player', source: 'Rock Band DLC', bpm: 96, key: 'D Major', duration: '4:15', stems: RB_DRUMS_ONLY, genre: 'Soft Rock', hasStems: true },

  // ── The Police ──
  { id: 'police-cant-stand', title: "Can't Stand Losing You", artist: 'The Police', source: 'Rock Band DLC', bpm: 150, key: 'D Minor', duration: '2:57', stems: RB_STEMS, genre: 'New Wave', hasStems: true },
  { id: 'police-every-breath', title: 'Every Breath You Take', artist: 'The Police', source: 'Rock Band DLC', bpm: 117, key: 'Ab Major', duration: '4:13', stems: RB_STEMS_KEYS, genre: 'New Wave', hasStems: true },
  { id: 'police-message-bottle', title: 'Message in a Bottle', artist: 'The Police', source: 'Rock Band DLC', bpm: 150, key: 'C# Minor', duration: '4:50', stems: RB_SNARE_CYMBALS, genre: 'New Wave', hasStems: true },
  { id: 'police-next-to-you', title: 'Next to You', artist: 'The Police', source: 'Rock Band DLC', bpm: 154, key: 'A Major', duration: '2:55', stems: RB_STEMS, genre: 'New Wave', hasStems: true },
  { id: 'police-roxanne', title: 'Roxanne', artist: 'The Police', source: 'Rock Band DLC', bpm: 132, key: 'E Minor', duration: '3:11', stems: RB_STEMS, genre: 'New Wave', hasStems: true },

  // ── Queens of the Stone Age ──
  { id: 'qotsa-go-with-flow', title: 'Go with the Flow', artist: 'Queens of the Stone Age', source: 'Rock Band DLC', bpm: 121, key: 'E Minor', duration: '3:08', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },
  { id: 'qotsa-no-one-knows', title: 'No One Knows', artist: 'Queens of the Stone Age', source: 'Rock Band 2', bpm: 168, key: 'E Minor', duration: '4:38', stems: RB_STEMS, genre: 'Alternative Rock', hasStems: true },

  // ── R.E.M. ──
  { id: 'rem-losing-religion', title: 'Losing My Religion', artist: 'R.E.M.', source: 'Rock Band DLC', bpm: 126, key: 'A Minor', duration: '4:26', stems: RB_STEMS_CROWD, genre: 'Alternative Rock', hasStems: true },
  { id: 'rem-one-i-love', title: 'The One I Love', artist: 'R.E.M.', source: 'Rock Band DLC', bpm: 124, key: 'E Minor', duration: '3:17', stems: RB_DRUMS_ONLY, genre: 'Alternative Rock', hasStems: true },

  // ── Red Hot Chili Peppers ──
  { id: 'rhcp-blood-sugar', title: 'Blood Sugar Sex Magik', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 84, key: 'E Minor', duration: '4:32', stems: RB_STEMS, genre: 'Funk Rock', hasStems: true },
  { id: 'rhcp-californication', title: 'Californication', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 96, key: 'A Minor', duration: '5:21', stems: RB_STEMS_KEYS, genre: 'Funk Rock', hasStems: true },
  { id: 'rhcp-dani-california', title: 'Dani California', artist: 'Red Hot Chili Peppers', source: 'Rock Band 1', bpm: 96, key: 'A Minor', duration: '4:42', stems: RB_STEMS_CROWD, genre: 'Funk Rock', hasStems: true },
  { id: 'rhcp-give-it-away', title: 'Give It Away', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 92, key: 'A Minor', duration: '4:43', stems: RB_STEMS, genre: 'Funk Rock', hasStems: true },
  { id: 'rhcp-give-it-away-rb3', title: 'Give It Away (RB3)', artist: 'Red Hot Chili Peppers', source: 'Rock Band 3', bpm: 92, key: 'A Minor', duration: '4:43', stems: RB_STEMS_KEYS, genre: 'Funk Rock', hasStems: true },
  { id: 'rhcp-scar-tissue', title: 'Scar Tissue', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 90, key: 'F Major', duration: '3:37', stems: RB_STEMS, genre: 'Funk Rock', hasStems: true },
  { id: 'rhcp-snow', title: 'Snow (Hey Oh)', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 105, key: 'E Minor', duration: '5:34', stems: RB_STEMS, genre: 'Funk Rock', hasStems: true },
  { id: 'rhcp-suck-my-kiss', title: 'Suck My Kiss', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 84, key: 'E Minor', duration: '3:37', stems: RB_STEMS, genre: 'Funk Rock', hasStems: true },
  { id: 'rhcp-tell-me-baby', title: 'Tell Me Baby', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 110, key: 'D Major', duration: '4:07', stems: RB_STEMS, genre: 'Funk Rock', hasStems: true },
  { id: 'rhcp-under-bridge', title: 'Under the Bridge', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 84, key: 'E Major', duration: '4:24', stems: RB_STEMS, genre: 'Funk Rock', hasStems: true },

  // ── Tears for Fears ──
  { id: 'tears-everybody', title: 'Everybody Wants to Rule the World', artist: 'Tears for Fears', source: 'Rock Band DLC', bpm: 112, key: 'D Major', duration: '4:11', stems: RB_STEMS_KEYS, genre: 'New Wave', hasStems: true },

  // ── Toto ──
  { id: 'toto-rosanna', title: 'Rosanna', artist: 'Toto', source: 'Rock Band DLC', bpm: 98, key: 'G Major', duration: '5:32', stems: RB_SNARE_CYMBALS_KEYS, genre: 'Pop Rock', hasStems: true },

  // ── Van Halen ──
  { id: 'vanhalen-aint-talkin', title: "Ain't Talkin' 'Bout Love", artist: 'Van Halen', source: 'Rock Band DLC', bpm: 138, key: 'A Minor', duration: '3:50', stems: RB_DRUMS_ONLY, genre: 'Hard Rock', hasStems: true },
  { id: 'vanhalen-panama', title: 'Panama', artist: 'Van Halen', source: 'Rock Band DLC', bpm: 144, key: 'E Major', duration: '3:31', stems: RB_DRUMS_CROWD, genre: 'Hard Rock', hasStems: true },
];

export function getArtists(): string[] {
  const set = new Set(SONG_CATALOG.map(s => s.artist));
  return [...set].sort();
}

export function getGenres(): string[] {
  const set = new Set(SONG_CATALOG.map(s => s.genre));
  return [...set].sort();
}

