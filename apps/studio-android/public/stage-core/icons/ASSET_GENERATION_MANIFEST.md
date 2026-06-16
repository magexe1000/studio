# Stagex Realistic Asset Generation Manifest

This manifest specifies the requirements for generating realistic, top-down technical stage plot assets to replace the existing temporary icons.

## General Acceptance Criteria for All Assets

- **Perspective**: Strict top-down orthographic (flat technical blueprint/CAD style). No isometric or angled views.
- **Background**: Pure alpha transparency (cleanly cutout, no black/colored borders or halos).
- **Lighting**: Even, shadowless, studio-style lighting (no harsh directional or drop shadows that conflict with canvas placements).
- **Style**: Hyperrealistic silhouette/diagram style (realistic equipment or person details, not simplified cartoons or colorful toy-like icons).
- **Format**: Optimized WebP (or PNG if WebP transparent support requires fallback) with low file size (< 10 KB per asset).
- **Dimensions**: exactly `256x256` pixels.
- **Scale**: Consistent scaling relative to other elements (e.g., a mic stand element is smaller than a drum kit).

---

## Asset Directory Map & Prompts

| Category | Filename | Dimensions | Format | Mapping Target in Stagex | Prompt |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **People** | `person.webp` | 256x256 | WebP | `cx-person` | Top-down orthographic view of a professional sound engineer, isolated on black background, CAD technical symbol style, slate grey shoulders and circular head silhouette |
| **People** | `vocalist.webp` | 256x256 | WebP | `cx-vocalist` | Top-down orthographic view of a vocalist performer, isolated on black background, holding a dynamic vocal microphone on a boom stand, clean technical style |
| **People** | `guitarist.webp` | 256x256 | WebP | `cx-guitarist` | Top-down orthographic view of a guitar performer, isolated on black background, holding a red electric guitar diagonally, clean technical CAD style |
| **People** | `bassist.webp` | 256x256 | WebP | `cx-bassist` | Top-down orthographic view of a bass performer, isolated on black background, holding an indigo electric bass guitar diagonally, clean technical CAD style |
| **People** | `drummer.webp` | 256x256 | WebP | `cx-drummer` | Top-down orthographic view of a drummer, isolated on black background, seated on a drum throne with two drumsticks in hand, clean technical CAD style |
| **People** | `keyboardist.webp` | 256x256 | WebP | `cx-keyboardist` | Top-down orthographic view of a keyboardist, isolated on black background, standing in front of a flat synthesizer keyboard on a stand, clean technical CAD style |
| **People** | `saxophonist.webp` | 256x256 | WebP | `cx-saxophonist` | Top-down orthographic view of a saxophone performer, isolated on black background, holding a brass saxophone extending forward, clean technical CAD style |
| **People** | `tech.webp` | 256x256 | WebP | `cx-tech` | Top-down orthographic view of a stage technician, isolated on black background, wearing a green communication headset and carrying a clipboard, clean technical CAD style |
| **Instruments** | `elec-guitar.webp` | 256x256 | WebP | `cx-elec-guitar` | Top-down orthographic view of an electric guitar (solid body, double cutaway, red finish), isolated on black background, clean product style |
| **Instruments** | `acoustic-guitar.webp`| 256x256 | WebP | `guitar` | Top-down orthographic view of an acoustic guitar (spruce top, classic dreadnought body), isolated on black background, clean product style |
| **Instruments** | `bass-guitar.webp` | 256x256 | WebP | `cx-bass-guitar` | Top-down orthographic view of an electric bass guitar (4 strings, blue finish), isolated on black background, clean product style |
| **Instruments** | `keyboard.webp` | 256x256 | WebP | `piano` | Top-down orthographic view of a black 61-key electronic keyboard, isolated on black background, clean product style |
| **Instruments** | `synth.webp` | 256x256 | WebP | `cx-synth` | Top-down orthographic view of a desktop synthesizer unit with knobs and LED displays, isolated on black background, clean product style |
| **Instruments** | `trumpet.webp` | 256x256 | WebP | `cx-trumpet` | Top-down orthographic view of a brass trumpet instrument, isolated on black background, clean product style |
| **Instruments** | `violin.webp` | 256x256 | WebP | `cx-violin` | Top-down orthographic view of a wooden violin with its bow alongside, isolated on black background, clean product style |
| **Instruments** | `shaker.webp` | 256x256 | WebP | `cx-shaker` | Top-down orthographic view of a steel cylinder percussion shaker, isolated on black background, clean product style |
| **Instruments** | `tambourine.webp` | 256x256 | WebP | `cx-tambourine` | Top-down orthographic view of a circular wooden tambourine with brass jingles, isolated on black background, clean product style |
| **Mics** | `mic-sm58.webp` | 256x256 | WebP | `mic` | Top-down view of a dynamic vocal microphone (silver grille, black handle), isolated on black background, clean product style |
| **Mics** | `mic-condenser.webp` | 256x256 | WebP | `mic-2` | Top-down view of a professional studio condenser microphone inside a shockmount, isolated on black background, clean product style |
| **Mics** | `mic-wireless.webp` | 256x256 | WebP | `cx-wireless` | Top-down view of a wireless handheld vocal microphone with an antenna base, isolated on black background, clean product style |
| **Mics** | `boundary-mic.webp` | 256x256 | WebP | `cx-boundary` | Top-down view of a flat boundary plate microphone (PZM), isolated on black background, clean product style |
| **Mics** | `drum-clip.webp` | 256x256 | WebP | `cx-drum-clip` | Top-down view of a drum rim clip microphone, isolated on black background, clean product style |
| **Mics** | `mic-stand.webp` | 256x256 | WebP | `cx-mic-stand` | Top-down view of a round-base boom microphone stand, isolated on black background, clean technical style |
| **Amps / Audio**| `guitar-amp.webp` | 256x256 | WebP | `cx-guitar-amp` | Top-down view of a guitar combo amplifier (control dials visible on the top plate, black vinyl case), isolated on black background, clean product style |
| **Amps / Audio**| `bass-amp.webp` | 256x256 | WebP | `cx-bass-amp` | Top-down view of a bass amplifier head sitting on a speaker cabinet, isolated on black background, clean product style |
| **Amps / Audio**| `amp-cab.webp` | 256x256 | WebP | `cx-amp-cab` | Top-down view of a 4x12 guitar speaker cabinet, isolated on black background, clean product style |
| **Amps / Audio**| `bass-cab.webp` | 256x256 | WebP | `cx-bass-cab` | Top-down view of a 4x10 bass speaker cabinet, isolated on black background, clean product style |
| **Amps / Audio**| `wedge.webp` | 256x256 | WebP | `cx-wedge` | Top-down view of a slanted stage floor monitor wedge speaker, isolated on black background, clean product style |
| **Amps / Audio**| `main-pa.webp` | 256x256 | WebP | `volume-2` | Top-down view of a large front-of-house main PA speaker cabinet, isolated on black background, clean product style |
| **Amps / Audio**| `stage-sub.webp` | 256x256 | WebP | `disc` | Top-down view of a large square stage subwoofer cabinet, isolated on black background, clean product style |
| **Amps / Audio**| `iem-pack.webp` | 256x256 | WebP | `headphones` | Top-down view of a wireless in-ear monitor beltpack receiver, isolated on black background, clean product style |
| **Amps / Audio**| `drum-fill.webp` | 256x256 | WebP | `speaker` | Top-down view of a heavy drum fill active monitor speaker cabinet, isolated on black background, clean product style |
| **Amps / Audio**| `drum-sub.webp` | 256x256 | WebP | `disc-2` | Top-down view of a drum monitor subwoofer box, isolated on black background, clean product style |
| **Amps / Audio**| `side-fill.webp` | 256x256 | WebP | `megaphone` | Top-down view of a side-fill stage speaker column, isolated on black background, clean product style |
| **Amps / Audio**| `delay-tower.webp` | 256x256 | WebP | `radio` | Top-down view of a delay tower line array speaker unit, isolated on black background, clean product style |
| **Amps / Audio**| `front-fill.webp` | 256x256 | WebP | `cx-front-fill` | Top-down view of a compact horizontal front-fill stage lip speaker, isolated on black background, clean product style |
| **Amps / Audio**| `headphone-amp.webp`| 256x256 | WebP | `headset` | Top-down view of a rackmount 4-channel headphone amplifier unit, isolated on black background, clean product style |
| **Amps / Audio**| `di-box.webp` | 256x256 | WebP | `cx-di-box` | Top-down view of a passive direct injection (DI) box (metallic chassis, ground lift toggle), isolated on black background, clean product style |
| **Drums** | `drum-kit.webp` | 256x256 | WebP | `drum` | Top-down view of a 5-piece acoustic drum kit (bass drum, snare, hi-hat, 2 rack toms, floor tom, 2 cymbals), isolated on black background, clean CAD style |
| **Drums** | `edrum.webp` | 256x256 | WebP | `cx-edrum` | Top-down view of an electronic drum kit with hexagonal mesh drum pads and cymbal triggers, isolated on black background, clean CAD style |
| **Drums** | `percussion.webp` | 256x256 | WebP | `cx-percussion` | Top-down view of a percussion setup containing congas, bongos, and a cowbell, isolated on black background, clean CAD style |
| **Drums** | `cajon.webp` | 256x256 | WebP | `cx-cajon` | Top-down view of a rectangular wooden cajón drum box, isolated on black background, clean product style |
| **Utilities** | `mixer.webp` | 256x256 | WebP | `sliders-horizontal` | Top-down view of a 16-channel analog mixing console with faders and dials, isolated on black background, clean product style |
| **Utilities** | `power-distro.webp`| 256x256 | WebP | `zap` | Top-down view of a power distribution rack unit with socket indicators, isolated on black background, clean product style |
| **Utilities** | `stage-box.webp` | 256x256 | WebP | `box` | Top-down view of a stage snake box with multiple XLR female inputs, isolated on black background, clean product style |
| **Utilities** | `patch-bay.webp` | 256x256 | WebP | `grid-3x3` | Top-down view of a 48-point balanced patchbay rack unit, isolated on black background, clean product style |
| **Utilities** | `router.webp` | 256x256 | WebP | `network` | Top-down view of a rackmount wireless network router with dual antennas, isolated on black background, clean product style |
| **Utilities** | `splitter.webp` | 256x256 | WebP | `git-branch` | Top-down view of a rackmount mic splitter box with transformer outputs, isolated on black background, clean product style |
| **Utilities** | `foh-console.webp` | 256x256 | WebP | `sliders-vertical` | Top-down view of a large digital front-of-house mixing console, isolated on black background, clean product style |
| **Utilities** | `mon-console.webp` | 256x256 | WebP | `sliders-horizontal` | Top-down view of a monitor mixing console board, isolated on black background, clean product style |
| **Utilities** | `amp-rack.webp` | 256x256 | WebP | `server` | Top-down view of a flightcase containing three power amplifiers, isolated on black background, clean product style |
| **Utilities** | `effects-rack.webp`| 256x256 | WebP | `cpu` | Top-down view of a flightcase containing outboard effects compressors and processors, isolated on black background, clean product style |
| **Utilities** | `wireless-rack.webp`| 256x256 | WebP | `cx-wireless-rack` | Top-down view of a flightcase containing multiple wireless microphone receivers with front antennas, isolated on black background, clean product style |
| **Utilities** | `laptop.webp` | 256x256 | WebP | `laptop` | Top-down view of a sleek open aluminum laptop computer (keyboard and black screen bezel), isolated on black background, clean product style |
| **Utilities** | `loop-station.webp`| 256x256 | WebP | `repeat-2` | Top-down view of a multi-pedal loop station processor board, isolated on black background, clean product style |
| **Utilities** | `playback.webp` | 256x256 | WebP | `play-circle` | Top-down view of a rackmount media player playback deck, isolated on black background, clean product style |
| **Utilities** | `outlet.webp` | 256x256 | WebP | `cx-outlet` | Top-down view of a professional power socket box, isolated on black background, clean product style |
