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
}

const STANDARD_STEMS: StemInfo[] = [
  { name: 'drums', label: 'Drums', icon: 'layers' },
  { name: 'bass', label: 'Bass', icon: 'graphic_eq' },
  { name: 'guitar', label: 'Guitar', icon: 'music_note' },
  { name: 'vocals', label: 'Vocals', icon: 'mic' },
];

const WITH_KEYS: StemInfo[] = [
  ...STANDARD_STEMS,
  { name: 'keys', label: 'Keys', icon: 'piano' },
];

const WITH_BACKING: StemInfo[] = [
  ...STANDARD_STEMS,
  { name: 'backing', label: 'Backing', icon: 'queue_music' },
];

export const SONG_CATALOG: SongMeta[] = [
  // ── AC/DC ──
  { id: 'acdc-back-in-black', title: 'Back in Black', artist: 'AC/DC', source: 'AC/DC Live', bpm: 120, key: 'E Minor', duration: '4:15', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-for-those-about-to-rock', title: 'For Those About to Rock (We Salute You)', artist: 'AC/DC', source: 'AC/DC Live', bpm: 118, key: 'A Major', duration: '5:44', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-hells-bells', title: 'Hells Bells', artist: 'AC/DC', source: 'AC/DC Live', bpm: 114, key: 'A Minor', duration: '5:12', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-high-voltage', title: 'High Voltage', artist: 'AC/DC', source: 'AC/DC Live', bpm: 140, key: 'A Major', duration: '4:03', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-highway-to-hell', title: 'Highway to Hell', artist: 'AC/DC', source: 'AC/DC Live', bpm: 116, key: 'A Major', duration: '3:28', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-if-you-want-blood', title: 'If You Want Blood (You\'ve Got It)', artist: 'AC/DC', source: 'AC/DC Live', bpm: 132, key: 'A Major', duration: '4:36', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-let-there-be-rock', title: 'Let There Be Rock', artist: 'AC/DC', source: 'AC/DC Live', bpm: 130, key: 'A Major', duration: '6:06', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-shoot-to-thrill', title: 'Shoot to Thrill', artist: 'AC/DC', source: 'AC/DC Live', bpm: 128, key: 'A Major', duration: '5:17', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-tnt', title: 'T.N.T.', artist: 'AC/DC', source: 'AC/DC Live', bpm: 126, key: 'E Major', duration: '3:35', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-thunderstruck', title: 'Thunderstruck', artist: 'AC/DC', source: 'AC/DC Live', bpm: 132, key: 'B Minor', duration: '4:52', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-you-shook-me', title: 'You Shook Me All Night Long', artist: 'AC/DC', source: 'AC/DC Live', bpm: 128, key: 'G Major', duration: '3:30', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-fire-your-guns', title: 'Fire Your Guns', artist: 'AC/DC', source: 'AC/DC Live', bpm: 120, key: 'A Major', duration: '2:53', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-gone-shootin', title: 'Gone Shootin\'', artist: 'AC/DC', source: 'Rock Band 2', bpm: 108, key: 'A Major', duration: '5:02', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-dirty-deeds', title: 'Dirty Deeds Done Dirt Cheap', artist: 'AC/DC', source: 'Rock Band DLC', bpm: 134, key: 'E Major', duration: '3:51', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'acdc-whole-lotta-rosie', title: 'Whole Lotta Rosie', artist: 'AC/DC', source: 'Rock Band DLC', bpm: 128, key: 'A Major', duration: '5:23', stems: STANDARD_STEMS, genre: 'Hard Rock' },

  // ── Bon Jovi ──
  { id: 'bonjovi-wanted', title: 'Wanted Dead or Alive', artist: 'Bon Jovi', source: 'Rock Band 1', bpm: 74, key: 'D Major', duration: '5:08', stems: STANDARD_STEMS, genre: 'Rock' },
  { id: 'bonjovi-livin', title: 'Livin\' on a Prayer', artist: 'Bon Jovi', source: 'Rock Band 2', bpm: 122, key: 'E Minor', duration: '4:09', stems: STANDARD_STEMS, genre: 'Rock' },
  { id: 'bonjovi-you-give-love', title: 'You Give Love a Bad Name', artist: 'Bon Jovi', source: 'Rock Band DLC', bpm: 124, key: 'C Minor', duration: '3:43', stems: STANDARD_STEMS, genre: 'Rock' },
  { id: 'bonjovi-its-my-life', title: 'It\'s My Life', artist: 'Bon Jovi', source: 'Rock Band 3', bpm: 120, key: 'C Minor', duration: '3:44', stems: WITH_KEYS, genre: 'Rock' },
  { id: 'bonjovi-bad-medicine', title: 'Bad Medicine', artist: 'Bon Jovi', source: 'Rock Band DLC', bpm: 132, key: 'A Major', duration: '5:16', stems: STANDARD_STEMS, genre: 'Rock' },
  { id: 'bonjovi-runaway', title: 'Runaway', artist: 'Bon Jovi', source: 'Rock Band DLC', bpm: 140, key: 'C Minor', duration: '3:52', stems: WITH_KEYS, genre: 'Rock' },

  // ── Boston ──
  { id: 'boston-foreplay', title: 'Foreplay/Long Time', artist: 'Boston', source: 'Rock Band 1', bpm: 116, key: 'E Major', duration: '7:47', stems: WITH_KEYS, genre: 'Classic Rock' },
  { id: 'boston-more-than', title: 'More Than a Feeling', artist: 'Boston', source: 'Rock Band DLC', bpm: 110, key: 'D Major', duration: '4:46', stems: STANDARD_STEMS, genre: 'Classic Rock' },
  { id: 'boston-peace-of-mind', title: 'Peace of Mind', artist: 'Boston', source: 'Rock Band DLC', bpm: 136, key: 'E Major', duration: '5:04', stems: STANDARD_STEMS, genre: 'Classic Rock' },
  { id: 'boston-rock-roll-band', title: 'Rock and Roll Band', artist: 'Boston', source: 'Rock Band DLC', bpm: 120, key: 'A Major', duration: '3:00', stems: STANDARD_STEMS, genre: 'Classic Rock' },

  // ── Daft Punk ──
  { id: 'daftpunk-around-world', title: 'Around the World', artist: 'Daft Punk', source: 'Rock Band DLC', bpm: 121, key: 'B Minor', duration: '7:09', stems: WITH_KEYS, genre: 'Electronic' },
  { id: 'daftpunk-harder-better', title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', source: 'Rock Band DLC', bpm: 123, key: 'F# Minor', duration: '3:44', stems: WITH_KEYS, genre: 'Electronic' },
  { id: 'daftpunk-one-more-time', title: 'One More Time', artist: 'Daft Punk', source: 'Rock Band DLC', bpm: 124, key: 'Bb Major', duration: '5:20', stems: WITH_KEYS, genre: 'Electronic' },

  // ── Foo Fighters ──
  { id: 'foo-learn-to-fly', title: 'Learn to Fly', artist: 'Foo Fighters', source: 'Rock Band 1', bpm: 136, key: 'B Major', duration: '3:58', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'foo-everlong', title: 'Everlong', artist: 'Foo Fighters', source: 'Rock Band 2', bpm: 158, key: 'B Major', duration: '4:10', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'foo-pretender', title: 'The Pretender', artist: 'Foo Fighters', source: 'Rock Band 3', bpm: 172, key: 'A Minor', duration: '4:29', stems: WITH_KEYS, genre: 'Alternative Rock' },
  { id: 'foo-best-of-you', title: 'Best of You', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 128, key: 'D Minor', duration: '4:16', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'foo-monkey-wrench', title: 'Monkey Wrench', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 174, key: 'B Major', duration: '3:51', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'foo-my-hero', title: 'My Hero', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 152, key: 'E Major', duration: '4:20', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'foo-times-like-these', title: 'Times Like These', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 144, key: 'D Major', duration: '4:27', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'foo-all-my-life', title: 'All My Life', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 152, key: 'F# Minor', duration: '4:23', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'foo-walk', title: 'Walk', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 160, key: 'D Minor', duration: '4:15', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'foo-rope', title: 'Rope', artist: 'Foo Fighters', source: 'Rock Band DLC', bpm: 152, key: 'D Minor', duration: '4:19', stems: STANDARD_STEMS, genre: 'Alternative Rock' },

  // ── Foreigner ──
  { id: 'foreigner-cold-as-ice', title: 'Cold as Ice', artist: 'Foreigner', source: 'Rock Band 3', bpm: 126, key: 'E Minor', duration: '3:27', stems: WITH_KEYS, genre: 'Classic Rock' },
  { id: 'foreigner-juke-box-hero', title: 'Juke Box Hero', artist: 'Foreigner', source: 'Rock Band DLC', bpm: 96, key: 'B Minor', duration: '5:59', stems: WITH_KEYS, genre: 'Classic Rock' },
  { id: 'foreigner-feels-first-time', title: 'Feels Like the First Time', artist: 'Foreigner', source: 'Rock Band DLC', bpm: 128, key: 'C Major', duration: '3:39', stems: WITH_KEYS, genre: 'Classic Rock' },
  { id: 'foreigner-hot-blooded', title: 'Hot Blooded', artist: 'Foreigner', source: 'Rock Band DLC', bpm: 116, key: 'G Major', duration: '4:52', stems: STANDARD_STEMS, genre: 'Classic Rock' },
  { id: 'foreigner-urgent', title: 'Urgent', artist: 'Foreigner', source: 'Rock Band DLC', bpm: 130, key: 'A Minor', duration: '4:33', stems: WITH_KEYS, genre: 'Classic Rock' },

  // ── Franz Ferdinand ──
  { id: 'franz-take-me-out', title: 'Take Me Out', artist: 'Franz Ferdinand', source: 'Rock Band 2', bpm: 104, key: 'E Major', duration: '3:56', stems: STANDARD_STEMS, genre: 'Indie Rock' },
  { id: 'franz-do-you-want-to', title: 'Do You Want To', artist: 'Franz Ferdinand', source: 'Rock Band DLC', bpm: 148, key: 'E Minor', duration: '3:28', stems: STANDARD_STEMS, genre: 'Indie Rock' },

  // ── Guns N' Roses ──
  { id: 'gnr-welcome-jungle', title: 'Welcome to the Jungle', artist: 'Guns N\' Roses', source: 'Rock Band 2', bpm: 120, key: 'E Minor', duration: '4:33', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'gnr-sweet-child', title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses', source: 'Rock Band DLC', bpm: 126, key: 'D Major', duration: '5:56', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'gnr-paradise-city', title: 'Paradise City', artist: 'Guns N\' Roses', source: 'Rock Band DLC', bpm: 102, key: 'G Major', duration: '6:46', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'gnr-november-rain', title: 'November Rain', artist: 'Guns N\' Roses', source: 'Rock Band DLC', bpm: 82, key: 'C Major', duration: '8:57', stems: WITH_KEYS, genre: 'Hard Rock' },
  { id: 'gnr-mr-brownstone', title: 'Mr. Brownstone', artist: 'Guns N\' Roses', source: 'Rock Band DLC', bpm: 198, key: 'E Minor', duration: '3:47', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'gnr-patience', title: 'Patience', artist: 'Guns N\' Roses', source: 'Rock Band DLC', bpm: 120, key: 'G Major', duration: '5:56', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'gnr-shacklers', title: 'Shackler\'s Revenge', artist: 'Guns N\' Roses', source: 'Rock Band 2', bpm: 135, key: 'A Minor', duration: '3:34', stems: STANDARD_STEMS, genre: 'Hard Rock' },

  // ── Huey Lewis and the News ──
  { id: 'huey-power-of-love', title: 'The Power of Love', artist: 'Huey Lewis and the News', source: 'Rock Band 3', bpm: 118, key: 'A Major', duration: '3:53', stems: WITH_KEYS, genre: 'Pop Rock' },
  { id: 'huey-hip-to-be-square', title: 'Hip to Be Square', artist: 'Huey Lewis and the News', source: 'Rock Band DLC', bpm: 134, key: 'D Major', duration: '3:54', stems: WITH_KEYS, genre: 'Pop Rock' },
  { id: 'huey-heart-rock-roll', title: 'The Heart of Rock & Roll', artist: 'Huey Lewis and the News', source: 'Rock Band DLC', bpm: 138, key: 'G Major', duration: '5:07', stems: WITH_KEYS, genre: 'Pop Rock' },

  // ── Journey ──
  { id: 'journey-anyway', title: 'Any Way You Want It', artist: 'Journey', source: 'Rock Band 2', bpm: 148, key: 'G Major', duration: '3:22', stems: WITH_KEYS, genre: 'Classic Rock' },
  { id: 'journey-dont-stop', title: 'Don\'t Stop Believin\'', artist: 'Journey', source: 'Rock Band DLC', bpm: 120, key: 'E Major', duration: '4:10', stems: WITH_KEYS, genre: 'Classic Rock' },
  { id: 'journey-separate-ways', title: 'Separate Ways (Worlds Apart)', artist: 'Journey', source: 'Rock Band DLC', bpm: 142, key: 'E Minor', duration: '5:28', stems: WITH_KEYS, genre: 'Classic Rock' },
  { id: 'journey-faithfully', title: 'Faithfully', artist: 'Journey', source: 'Rock Band DLC', bpm: 66, key: 'B Major', duration: '4:27', stems: WITH_KEYS, genre: 'Classic Rock' },
  { id: 'journey-lights', title: 'Lights', artist: 'Journey', source: 'Rock Band DLC', bpm: 118, key: 'D Major', duration: '3:06', stems: WITH_KEYS, genre: 'Classic Rock' },

  // ── Juanes ──
  { id: 'juanes-camisa-negra', title: 'La Camisa Negra', artist: 'Juanes', source: 'Rock Band 2', bpm: 132, key: 'E Minor', duration: '3:36', stems: STANDARD_STEMS, genre: 'Latin Rock' },
  { id: 'juanes-me-enamora', title: 'Me Enamora', artist: 'Juanes', source: 'Rock Band DLC', bpm: 110, key: 'E Minor', duration: '3:25', stems: STANDARD_STEMS, genre: 'Latin Rock' },

  // ── Kenny Loggins ──
  { id: 'kenny-danger-zone', title: 'Danger Zone', artist: 'Kenny Loggins', source: 'Rock Band DLC', bpm: 116, key: 'D Minor', duration: '3:36', stems: WITH_KEYS, genre: 'Pop Rock' },
  { id: 'kenny-footloose', title: 'Footloose', artist: 'Kenny Loggins', source: 'Rock Band DLC', bpm: 176, key: 'A Major', duration: '3:44', stems: WITH_KEYS, genre: 'Pop Rock' },

  // ── Maná ──
  { id: 'mana-oye-mi-amor', title: 'Oye Mi Amor', artist: 'Maná', source: 'Rock Band 3', bpm: 120, key: 'A Minor', duration: '4:15', stems: WITH_KEYS, genre: 'Latin Rock' },
  { id: 'mana-rayando-el-sol', title: 'Rayando el Sol', artist: 'Maná', source: 'Rock Band DLC', bpm: 88, key: 'A Minor', duration: '4:48', stems: STANDARD_STEMS, genre: 'Latin Rock' },
  { id: 'mana-de-pies-cabeza', title: 'De Pies a Cabeza', artist: 'Maná', source: 'Rock Band DLC', bpm: 132, key: 'E Minor', duration: '4:07', stems: STANDARD_STEMS, genre: 'Latin Rock' },

  // ── Megadeth ──
  { id: 'megadeth-peace-sells', title: 'Peace Sells', artist: 'Megadeth', source: 'Rock Band 2', bpm: 144, key: 'E Minor', duration: '4:03', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'megadeth-holy-wars', title: 'Holy Wars...The Punishment Due', artist: 'Megadeth', source: 'Rock Band DLC', bpm: 188, key: 'E Minor', duration: '6:34', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'megadeth-symphony', title: 'Symphony of Destruction', artist: 'Megadeth', source: 'Rock Band DLC', bpm: 130, key: 'E Minor', duration: '4:07', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'megadeth-hangar-18', title: 'Hangar 18', artist: 'Megadeth', source: 'Rock Band DLC', bpm: 162, key: 'E Minor', duration: '5:14', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'megadeth-tornado', title: 'Tornado of Souls', artist: 'Megadeth', source: 'Rock Band DLC', bpm: 178, key: 'F# Minor', duration: '5:22', stems: STANDARD_STEMS, genre: 'Thrash Metal' },

  // ── Men at Work ──
  { id: 'menatwork-down-under', title: 'Down Under', artist: 'Men at Work', source: 'Rock Band 3', bpm: 104, key: 'B Minor', duration: '3:43', stems: WITH_KEYS, genre: 'New Wave' },
  { id: 'menatwork-overkill', title: 'Overkill', artist: 'Men at Work', source: 'Rock Band DLC', bpm: 148, key: 'A Minor', duration: '3:40', stems: WITH_KEYS, genre: 'New Wave' },
  { id: 'menatwork-who-can-it-be', title: 'Who Can It Be Now?', artist: 'Men at Work', source: 'Rock Band DLC', bpm: 116, key: 'D Minor', duration: '3:22', stems: WITH_KEYS, genre: 'New Wave' },

  // ── Metallica ──
  { id: 'metallica-enter-sandman', title: 'Enter Sandman', artist: 'Metallica', source: 'Rock Band 1', bpm: 123, key: 'E Minor', duration: '5:31', stems: STANDARD_STEMS, genre: 'Heavy Metal' },
  { id: 'metallica-battery', title: 'Battery', artist: 'Metallica', source: 'Rock Band 2', bpm: 196, key: 'E Minor', duration: '5:12', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'metallica-ride-lightning', title: 'Ride the Lightning', artist: 'Metallica', source: 'Rock Band DLC', bpm: 152, key: 'E Minor', duration: '6:37', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'metallica-one', title: 'One', artist: 'Metallica', source: 'Rock Band DLC', bpm: 108, key: 'B Minor', duration: '7:25', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'metallica-master-puppets', title: 'Master of Puppets', artist: 'Metallica', source: 'Rock Band DLC', bpm: 212, key: 'E Minor', duration: '8:35', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'metallica-justice', title: '...And Justice for All', artist: 'Metallica', source: 'Rock Band DLC', bpm: 164, key: 'E Minor', duration: '9:45', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'metallica-nothing-else', title: 'Nothing Else Matters', artist: 'Metallica', source: 'Rock Band DLC', bpm: 69, key: 'E Minor', duration: '6:28', stems: STANDARD_STEMS, genre: 'Heavy Metal' },
  { id: 'metallica-sad-but-true', title: 'Sad but True', artist: 'Metallica', source: 'Rock Band DLC', bpm: 90, key: 'D Minor', duration: '5:25', stems: STANDARD_STEMS, genre: 'Heavy Metal' },
  { id: 'metallica-seek-destroy', title: 'Seek & Destroy', artist: 'Metallica', source: 'Rock Band DLC', bpm: 132, key: 'E Minor', duration: '6:55', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'metallica-creeping-death', title: 'Creeping Death', artist: 'Metallica', source: 'Rock Band DLC', bpm: 100, key: 'E Minor', duration: '6:36', stems: STANDARD_STEMS, genre: 'Thrash Metal' },
  { id: 'metallica-fade-to-black', title: 'Fade to Black', artist: 'Metallica', source: 'Rock Band DLC', bpm: 116, key: 'B Minor', duration: '6:57', stems: STANDARD_STEMS, genre: 'Heavy Metal' },
  { id: 'metallica-for-whom', title: 'For Whom the Bell Tolls', artist: 'Metallica', source: 'Rock Band DLC', bpm: 120, key: 'E Minor', duration: '5:09', stems: STANDARD_STEMS, genre: 'Thrash Metal' },

  // ── Player ──
  { id: 'player-baby-come-back', title: 'Baby Come Back', artist: 'Player', source: 'Rock Band DLC', bpm: 106, key: 'F# Minor', duration: '3:52', stems: WITH_KEYS, genre: 'Soft Rock' },

  // ── Queens of the Stone Age ──
  { id: 'qotsa-go-with-flow', title: 'Go with the Flow', artist: 'Queens of the Stone Age', source: 'Rock Band 1', bpm: 126, key: 'A Major', duration: '3:07', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'qotsa-3s-and-7s', title: '3\'s & 7\'s', artist: 'Queens of the Stone Age', source: 'Rock Band DLC', bpm: 148, key: 'E Major', duration: '3:38', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'qotsa-no-one-knows', title: 'No One Knows', artist: 'Queens of the Stone Age', source: 'Rock Band 3', bpm: 172, key: 'C Minor', duration: '4:38', stems: WITH_KEYS, genre: 'Alternative Rock' },
  { id: 'qotsa-little-sister', title: 'Little Sister', artist: 'Queens of the Stone Age', source: 'Rock Band DLC', bpm: 116, key: 'E Minor', duration: '2:50', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'qotsa-sick-sick-sick', title: 'Sick, Sick, Sick', artist: 'Queens of the Stone Age', source: 'Rock Band DLC', bpm: 180, key: 'G Minor', duration: '3:33', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'qotsa-make-it-wit-chu', title: 'Make It wit Chu', artist: 'Queens of the Stone Age', source: 'Rock Band DLC', bpm: 78, key: 'E Major', duration: '4:31', stems: STANDARD_STEMS, genre: 'Alternative Rock' },

  // ── Red Hot Chili Peppers ──
  { id: 'rhcp-dani-california', title: 'Dani California', artist: 'Red Hot Chili Peppers', source: 'Rock Band 1', bpm: 96, key: 'A Minor', duration: '4:42', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rhcp-give-it-away', title: 'Give It Away', artist: 'Red Hot Chili Peppers', source: 'Rock Band 2', bpm: 92, key: 'A Minor', duration: '4:43', stems: STANDARD_STEMS, genre: 'Funk Rock' },
  { id: 'rhcp-under-bridge', title: 'Under the Bridge', artist: 'Red Hot Chili Peppers', source: 'Rock Band 3', bpm: 84, key: 'E Major', duration: '4:24', stems: WITH_KEYS, genre: 'Alternative Rock' },
  { id: 'rhcp-snow', title: 'Snow (Hey Oh)', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 104, key: 'A Minor', duration: '5:34', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rhcp-by-the-way', title: 'By the Way', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 122, key: 'F Major', duration: '3:37', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rhcp-californication', title: 'Californication', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 96, key: 'A Minor', duration: '5:21', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rhcp-cant-stop', title: 'Can\'t Stop', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 92, key: 'E Minor', duration: '4:29', stems: STANDARD_STEMS, genre: 'Funk Rock' },
  { id: 'rhcp-otherside', title: 'Otherside', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 124, key: 'A Minor', duration: '4:15', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rhcp-scar-tissue', title: 'Scar Tissue', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 90, key: 'F Major', duration: '3:37', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rhcp-tell-me-baby', title: 'Tell Me Baby', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 98, key: 'A Minor', duration: '4:07', stems: STANDARD_STEMS, genre: 'Funk Rock' },
  { id: 'rhcp-higher-ground', title: 'Higher Ground', artist: 'Red Hot Chili Peppers', source: 'Rock Band DLC', bpm: 104, key: 'E Minor', duration: '3:23', stems: STANDARD_STEMS, genre: 'Funk Rock' },

  // ── REM ──
  { id: 'rem-man-on-moon', title: 'Man on the Moon', artist: 'R.E.M.', source: 'Rock Band 2', bpm: 106, key: 'C Major', duration: '5:14', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rem-losing-religion', title: 'Losing My Religion', artist: 'R.E.M.', source: 'Rock Band DLC', bpm: 126, key: 'A Minor', duration: '4:26', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rem-everybody-hurts', title: 'Everybody Hurts', artist: 'R.E.M.', source: 'Rock Band DLC', bpm: 78, key: 'D Major', duration: '5:20', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rem-orange-crush', title: 'Orange Crush', artist: 'R.E.M.', source: 'Rock Band DLC', bpm: 124, key: 'E Minor', duration: '3:52', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rem-its-end-world', title: 'It\'s the End of the World as We Know It', artist: 'R.E.M.', source: 'Rock Band DLC', bpm: 152, key: 'D Major', duration: '4:07', stems: STANDARD_STEMS, genre: 'Alternative Rock' },
  { id: 'rem-shiny-happy', title: 'Shiny Happy People', artist: 'R.E.M.', source: 'Rock Band DLC', bpm: 126, key: 'F# Major', duration: '3:44', stems: STANDARD_STEMS, genre: 'Pop Rock' },

  // ── Starship ──
  { id: 'starship-we-built', title: 'We Built This City', artist: 'Starship', source: 'Rock Band 3', bpm: 127, key: 'F Major', duration: '4:55', stems: WITH_KEYS, genre: 'Pop Rock' },
  { id: 'starship-nothing-gonna-stop', title: 'Nothing\'s Gonna Stop Us Now', artist: 'Starship', source: 'Rock Band DLC', bpm: 128, key: 'F Major', duration: '4:29', stems: WITH_KEYS, genre: 'Pop Rock' },

  // ── Tears for Fears ──
  { id: 'tff-everybody-wants', title: 'Everybody Wants to Rule the World', artist: 'Tears for Fears', source: 'Rock Band 3', bpm: 112, key: 'D Major', duration: '4:11', stems: WITH_KEYS, genre: 'New Wave' },
  { id: 'tff-shout', title: 'Shout', artist: 'Tears for Fears', source: 'Rock Band DLC', bpm: 134, key: 'F Minor', duration: '6:31', stems: WITH_KEYS, genre: 'New Wave' },
  { id: 'tff-head-over-heels', title: 'Head Over Heels', artist: 'Tears for Fears', source: 'Rock Band DLC', bpm: 120, key: 'D Major', duration: '4:12', stems: WITH_KEYS, genre: 'New Wave' },

  // ── The Police ──
  { id: 'police-next-to-you', title: 'Next to You', artist: 'The Police', source: 'Rock Band 1', bpm: 152, key: 'A Major', duration: '2:57', stems: STANDARD_STEMS, genre: 'New Wave' },
  { id: 'police-roxanne', title: 'Roxanne', artist: 'The Police', source: 'Rock Band DLC', bpm: 132, key: 'G Minor', duration: '3:12', stems: STANDARD_STEMS, genre: 'New Wave' },
  { id: 'police-message-bottle', title: 'Message in a Bottle', artist: 'The Police', source: 'Rock Band DLC', bpm: 150, key: 'C# Minor', duration: '4:49', stems: STANDARD_STEMS, genre: 'New Wave' },
  { id: 'police-every-breath', title: 'Every Breath You Take', artist: 'The Police', source: 'Rock Band DLC', bpm: 116, key: 'A Major', duration: '4:13', stems: STANDARD_STEMS, genre: 'New Wave' },
  { id: 'police-dont-stand', title: 'Don\'t Stand So Close to Me', artist: 'The Police', source: 'Rock Band DLC', bpm: 144, key: 'D Major', duration: '4:05', stems: STANDARD_STEMS, genre: 'New Wave' },
  { id: 'police-synchronicity-ii', title: 'Synchronicity II', artist: 'The Police', source: 'Rock Band DLC', bpm: 164, key: 'D Minor', duration: '5:02', stems: STANDARD_STEMS, genre: 'New Wave' },

  // ── Toto ──
  { id: 'toto-africa', title: 'Africa', artist: 'Toto', source: 'Rock Band 3', bpm: 92, key: 'A Major', duration: '4:55', stems: WITH_KEYS, genre: 'Pop Rock' },
  { id: 'toto-hold-the-line', title: 'Hold the Line', artist: 'Toto', source: 'Rock Band DLC', bpm: 114, key: 'F Major', duration: '3:56', stems: WITH_KEYS, genre: 'Pop Rock' },
  { id: 'toto-rosanna', title: 'Rosanna', artist: 'Toto', source: 'Rock Band DLC', bpm: 100, key: 'G Major', duration: '5:31', stems: WITH_KEYS, genre: 'Pop Rock' },

  // ── Van Halen ──
  { id: 'vh-panama', title: 'Panama', artist: 'Van Halen', source: 'Rock Band DLC', bpm: 144, key: 'E Major', duration: '3:31', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'vh-hot-for-teacher', title: 'Hot for Teacher', artist: 'Van Halen', source: 'Rock Band DLC', bpm: 252, key: 'A Major', duration: '4:43', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'vh-jump', title: 'Jump', artist: 'Van Halen', source: 'Rock Band DLC', bpm: 128, key: 'C Major', duration: '4:02', stems: WITH_KEYS, genre: 'Hard Rock' },
  { id: 'vh-runnin', title: 'Runnin\' with the Devil', artist: 'Van Halen', source: 'Rock Band DLC', bpm: 96, key: 'E Major', duration: '3:36', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'vh-aint-talkin', title: 'Ain\'t Talkin\' \'Bout Love', artist: 'Van Halen', source: 'Rock Band DLC', bpm: 138, key: 'A Minor', duration: '3:49', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'vh-eruption-youreally', title: 'Eruption / You Really Got Me', artist: 'Van Halen', source: 'Rock Band DLC', bpm: 140, key: 'A Major', duration: '4:22', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'vh-jamie-cryin', title: 'Jamie\'s Cryin\'', artist: 'Van Halen', source: 'Rock Band DLC', bpm: 130, key: 'E Major', duration: '3:30', stems: STANDARD_STEMS, genre: 'Hard Rock' },
  { id: 'vh-beautiful-girls', title: 'Beautiful Girls', artist: 'Van Halen', source: 'Rock Band DLC', bpm: 130, key: 'A Major', duration: '3:56', stems: STANDARD_STEMS, genre: 'Hard Rock' },
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
