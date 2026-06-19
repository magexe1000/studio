// Stagex Advanced Features — features.js
// Loaded after app.js to extend functionality without modifying core code.

// ════════════════════════════════════════════════════
// 0. STAGEMIND BUILT-IN KNOWLEDGE ENGINE
//    Zero-dependency AI — works offline, forever.
// ════════════════════════════════════════════════════

const SC_KB = [
  // ── Microphones ──────────────────────────────────────────────────────────
  { t:['dynamic mic','dynamic microphone','moving coil','sm58','sm57','shure sm'],
    a:'Dynamic microphones use a moving-coil element — they handle high SPL without a pad, need no phantom power, and are the backbone of live sound. The SM58 is the standard live vocal mic; the SM57 excels on guitar cabs, snare, and brass. They reject off-axis bleed well, making them ideal for loud stages.' },
  { t:['condenser mic','condenser microphone','capacitor mic','large diaphragm','small diaphragm'],
    a:'Condenser mics require +48V phantom power and use an electrically-charged diaphragm — they are far more sensitive than dynamics and capture more transient detail. Use them for overheads, acoustic guitar, choirs, and studio-quality vocal chains. Always engage a pad (typically -10 or -20 dB) on very loud sources to prevent input clipping.' },
  { t:['ribbon mic','ribbon microphone','figure 8','bi-directional'],
    a:'Ribbon mics have a figure-8 polar pattern and a warm, natural high-frequency roll-off that suits brass, strings, and room ambience. Never send phantom power to a passive ribbon — it can destroy the ribbon element. Active ribbons have built-in preamps and accept phantom power safely.' },
  { t:['phantom power','48v','+48v'],
    a:'+48V phantom power is required by condenser and active ribbon mics. It travels down the XLR cable on pins 2 and 3. Dynamic mics are unaffected by phantom power; passive ribbon mics can be damaged by it. Always engage phantom before connecting a condenser and allow a few seconds for the mic to stabilize.' },
  { t:['polar pattern','cardioid','hypercardioid','supercardioid','omnidirectional','figure-8'],
    a:'Cardioid is the standard live pattern — rejects the rear 180°. Hypercardioid has a tighter forward lobe with a small rear lobe, giving better isolation but requiring monitor placement at 110° rather than directly behind. Omni captures sound from all directions and suits ambient recording. Figure-8 (ribbon, blumlein) captures front and rear equally.' },
  { t:['mic placement','microphone placement','close mic','distance'],
    a:'For close-micing, place the mic 1–4 inches from the source to maximize direct sound and minimize bleed. Moving a mic off-axis (angled away from the center) rolls off high frequencies and reduces harsh sibilance on vocals. Drum overheads typically sit 12–18 inches above the cymbals. Bass cabs are often miced at the center of the cone for punch, or off-center for warmth.' },
  { t:['vocal mic','singing mic','lead vocal'],
    a:'For live lead vocals, an SM58 or similar handheld cardioid dynamic is standard. Position monitors to the side (90°) or behind the singer to minimize feedback. If using a condenser for studio-quality live vocal, gate it tightly and watch for bleed. A pop filter reduces plosives in the studio but is rarely used live.' },
  // ── Gain & Levels ─────────────────────────────────────────────────────────
  { t:['gain staging','gain structure','trim','input gain','preamp gain'],
    a:'Gain staging means setting each stage of the signal chain so you have headroom for peaks without clipping. At the console, target –18 dBFS at the channel input after the preamp — this leaves 18 dB of headroom before digital clipping. Start with the preamp trim and work downstream: preamp → channel fader → group/VCA → main fader.' },
  { t:['headroom','dynamic range','peak','transient'],
    a:'Headroom is the difference between your nominal operating level and the clipping point. In digital systems (0 dBFS = clip), maintaining –18 dBFS average leaves 18 dB for peaks — essential for percussion transients. In analog, headroom is typically +20 to +24 dBu above nominal. Always leave more headroom on percussive sources.' },
  { t:['clipping','clip','distortion','overload','saturation'],
    a:'Clipping occurs when a signal exceeds the maximum level of a stage. In digital, clipping is harsh and sounds broken. In analog, clipping is softer and can be musical (tape saturation, transformer saturation). Watch for clip indicators on every stage — preamp, channel, group, and main bus. Reduce the gain at the clipping stage, not downstream.' },
  { t:['dbfs','dbu','dbv','level reference','nominal level'],
    a:'dBFS is the digital scale where 0 = clipping. dBu and dBV are analog references: 0 dBu = 0.775V (professional), 0 dBV = 1V (consumer). The standard operating alignment is 0 dBu = –18 dBFS. Line level (+4 dBu professional, –10 dBV consumer) arrives at the console without needing a preamp.' },
  // ── Signal Flow ───────────────────────────────────────────────────────────
  { t:['signal flow','signal chain','routing','audio path','signal path'],
    a:'Signal flows: source → mic/DI → preamp/trim → channel EQ → dynamics → aux sends → fader → groups/VCAs → main bus → amplifier → speakers. Understanding this chain lets you identify where a problem (noise, distortion, silence) is occurring. Always troubleshoot from the source forward.' },
  { t:['input list','channel list','patch list'],
    a:'An input list maps every source to a console channel: channel number, source name, mic/DI type, stand type, and any special requirements (phantom power, pad, etc.). It allows the FOH and monitor engineer to patch quickly and accurately. Include notes for unusual sources like loop stations or playback devices.' },
  { t:['aux send','aux','monitor send','pre-fader','post-fader'],
    a:'Aux sends tap the channel signal before (pre-fader) or after (post-fader) the channel fader. Pre-fader aux sends are used for monitor mixes — the monitor level is independent of the FOH mix. Post-fader auxes (effects sends) mean the effect follows the main fader, which is usually desirable for reverb and delay.' },
  { t:['group','vca','bus','subgroup'],
    a:'Groups (subgroups) and VCAs let you control multiple channels with one fader. Route all drum channels to a drum subgroup for collective level control and parallel processing. A VCA master controls fader levels without breaking individual channel routing, making it ideal for managing large ensembles.' },
  // ── DI & Connections ──────────────────────────────────────────────────────
  { t:['di box','direct injection','direct input','passive di','active di'],
    a:'A DI (Direct Injection) box converts instrument-level (high-impedance) to mic-level (low-impedance, balanced XLR). Passive DIs work well for medium-output instruments and need no power. Active DIs require phantom power and are better for low-output sources (acoustic guitar piezo, bass). Always use a DI for line-level sources going to a stage snake.' },
  { t:['xlr','balanced cable','xlr cable','3-pin'],
    a:'XLR cables are balanced with 3 conductors: pin 1 (ground/shield), pin 2 (hot/+), pin 3 (cold/–). Balanced lines reject common-mode noise and are essential for long cable runs. Always run balanced XLR from the stage to FOH snake — unbalanced cables over 10 feet accumulate hum and interference.' },
  { t:['trs','ts','jack','quarter inch','instrument cable','unbalanced'],
    a:'TS (Tip-Sleeve) cables are unbalanced — used for short instrument connections (guitar to pedal board). TRS (Tip-Ring-Sleeve) cables can be balanced (insert cable, studio monitor connection) or stereo. For any run over 10–15 feet, convert to balanced XLR or use a DI box.' },
  { t:['snake','stage box','multicore','stagebox'],
    a:'A stage snake (multicore) carries multiple balanced channels from stage to FOH position in a single cable run. Analog snakes use individual XLR pairs per channel. Digital snakes (AES50, DANTE, MADI) carry hundreds of channels over Cat5/Cat6 or fiber with less noise and easier deployment.' },
  { t:['impedance','hi-z','lo-z','impedance matching','loading'],
    a:'Impedance matching is critical for signal transfer. Guitar pickups are high-impedance (Hi-Z, 1MΩ+) and must connect to a Hi-Z input (amp input, active DI, or interface Hi-Z port). Plugging a Hi-Z source into a low-impedance mic preamp causes level loss and tone change. Transformers in DI boxes handle impedance conversion.' },
  // ── PA Systems ────────────────────────────────────────────────────────────
  { t:['pa system','pa speaker','front of house speakers','main speakers','foh system'],
    a:'A PA system amplifies sound for the audience. Full-range tops handle midrange and highs; subwoofers handle low frequencies below ~100 Hz. Delay systems extend coverage to rear areas of large venues. Match speaker dispersion to the room: a narrow-dispersion box for long throws, wide dispersion for shallow rooms.' },
  { t:['line array','line array speaker','vertical array'],
    a:'Line arrays use multiple tightly spaced elements to create a coherent wavefront with controlled vertical dispersion. They maintain level and clarity over long distances better than point-source cabinets. Subwoofers are typically deployed as a ground stack or flown in an end-fire configuration for cardioid sub behavior.' },
  { t:['subwoofer','sub','bass speaker','low frequency'],
    a:'Subwoofers handle frequencies below ~80–120 Hz. Crossover points (typically 80–100 Hz LPF on subs, HPF on tops) must match between the amplifier/DSP and the speaker. Cardioid sub configurations (two subs facing opposite directions with one delayed ~3–4ms) reduce rear bleed and tighten low-end focus.' },
  { t:['amplifier','power amp','class d','class a','amp rack'],
    a:'Power amplifiers drive speakers from line-level signals. Modern touring systems use Class D amps for efficiency and weight reduction. Match amplifier power to speaker program rating (typically 2× the continuous rating). Most powered (active) speakers have built-in amplifiers and DSP, simplifying setup.' },
  { t:['speaker placement','pa placement','delay','speaker aim'],
    a:'Aim main PA tops to cover the audience evenly — both horizontal and vertical dispersion matter. Delay speakers in balconies or rear areas should be delayed 20–30ms beyond the calculated acoustic delay (distance/1125 × 1000) to maintain the Haas effect and keep sound appearing to come from the stage.' },
  // ── Monitors ─────────────────────────────────────────────────────────────
  { t:['floor monitor','wedge','monitor','stage monitor','floor wedge'],
    a:'Floor wedge monitors let performers hear themselves on stage. Aim the wedge directly at the performer\'s ears (not feet) for maximum level before feedback. Set up monitor mixes pre-fader so FOH changes don\'t affect the stage. Ring out each wedge individually before adding content — walk the feedback frequency and apply a narrow EQ notch.' },
  { t:['iem','in ear monitor','in-ear','ear monitor','ears','personal monitor'],
    a:'IEM systems replace floor wedges with in-ear earphones for better isolation and hearing protection. Set transmitter RF power to minimum workable level to avoid interference. Ambience mics mixed into the IEM signal prevent the "in a box" feeling. Always use custom-molded earpieces or comply foam tips for isolation and comfort.' },
  { t:['monitor mix','foldback mix','personal mix'],
    a:'Each performer typically wants a different monitor mix — more of their own voice, less drums, specific instrument balances. Build mixes per performer using pre-fader aux sends. Start each monitor mix flat, then add what the performer asks for rather than pulling everything down. Keep stage volume low to maximize the usable monitor level before feedback.' },
  // ── Wireless ──────────────────────────────────────────────────────────────
  { t:['wireless','radio mic','wireless mic','rf','frequency','uhf','shure ulx','sennheiser ew'],
    a:'Wireless systems use RF to transmit audio from a beltpack or handheld transmitter to a receiver. Always scan for clear frequencies before the show — avoid TV broadcast channels, 700MHz, and cellular bands. Set transmitter output and receiver gain carefully: aim for –12 to –6 dBFS average on the receiver. Use high-quality antennas with proper positioning (above stage height, 5+ feet apart) for reliable reception.' },
  { t:['rf interference','wireless interference','dropouts','rf scan'],
    a:'RF dropouts occur due to multipath reflections, antenna positioning, or frequency conflicts. Use paddle antennas rather than whip antennas for improved directivity. Position antennas at or above stage level, 8–10 feet apart. Scan before every show and re-coordinate if you\'re in a new venue. Intermodulation products from multiple systems require frequency coordination software.' },
  // ── EQ & Dynamics ────────────────────────────────────────────────────────
  { t:['eq','equalization','equalizer','high pass filter','low pass filter','parametric','graphic eq','shelving'],
    a:'EQ shapes the frequency content of a signal. High-pass filters (HPF, typically 80–120 Hz) remove unnecessary low-frequency content from non-bass sources, reducing mud and freeing headroom. Parametric EQ lets you set frequency, gain, and bandwidth (Q). Cut narrow, boost wide — narrow cuts remove problem frequencies precisely; wide boosts sound more musical.' },
  { t:['high pass','hpf','low cut','rumble filter'],
    a:'Apply a high-pass filter to every channel that doesn\'t need low frequencies: vocals (HPF at 100 Hz), guitars (HPF at 80 Hz), overheads (HPF at 80 Hz). This removes stage rumble, handling noise, and low-frequency bleed, cleaning up the mix and leaving headroom for kick and bass to occupy the low-end space.' },
  { t:['compressor','compression','limiting','limiter','threshold','ratio','attack','release'],
    a:'A compressor reduces dynamic range by attenuating signals above a threshold at a set ratio (e.g., 4:1 means 4dB in = 1dB out). Fast attack catches transients; slow attack lets them through for punch. For vocals, try 3:1–6:1 ratio, medium attack (10–30ms), auto-release. Makeup gain compensates for gain reduction. A limiter is a compressor with a ratio above 10:1.' },
  { t:['gate','noise gate','expander','gating'],
    a:'A gate silences a channel when the signal falls below a threshold, reducing bleed from adjacent instruments. Set the threshold just above the noise/bleed floor. Use side-chain filtering on drum gates — key the gate with an HPF/LPF so only the target instrument opens it. Too-fast attack causes click artifacts; too-slow means the start of notes is cut.' },
  // ── Effects ───────────────────────────────────────────────────────────────
  { t:['reverb','reverberation','room sound','reverb time','rt60'],
    a:'Reverb simulates acoustic space. For live sound, use reverb sparingly — too much masks speech intelligibility and adds mud. A short plate or room reverb (0.8–1.5s decay) suits live vocals. Send reverb via post-fader aux to a stereo effects return, not as an insert. Pre-delay of 20–40ms separates the dry signal from the reverb tail.' },
  { t:['delay','echo','slap back','time delay'],
    a:'Delay repeats the signal after a set time. Slap-back delay (80–130ms) adds depth to vocals without obvious repetition. Tempo-synced delays (e.g., quarter-note at 120 BPM = 500ms) lock to the groove. Use post-fader aux sends for delay so it follows the channel fader. Set the feedback (repeats) conservatively to avoid buildup.' },
  { t:['chorus','flanger','phaser','modulation','pitch shift'],
    a:'Modulation effects add movement to sounds. Chorus slightly detunes and delays a copy of the signal for thickening. Flanger uses a very short (0–15ms) delay swept with LFO for a jet-like sweep. Phaser applies phase shift rather than delay for a smoother sweep. These are instrument effects — use sparingly in live sound to avoid a dated sound.' },
  // ── Feedback ─────────────────────────────────────────────────────────────
  { t:['feedback','ringing','howl','ring out','feedback frequency'],
    a:'Feedback occurs when mic gain exceeds the threshold at which the system reinforces itself through the speakers. To ring out: bring one channel up slowly until the first frequency rings, apply a narrow EQ notch (–3 to –6 dB at that frequency), and repeat. Keep mics out of speaker coverage areas and use cardioid patterns aimed away from monitors. Gates don\'t prevent feedback — they just silence it faster.' },
  // ── Console & DSP ─────────────────────────────────────────────────────────
  { t:['digital console','digital desk','mixing board','digi','avid','yamaha','allen heath','digico'],
    a:'Digital consoles (Avid Venue, Yamaha QL/CL, Allen & Heath SQ/dLive, DiGiCo SD/Quantum) process audio in DSP with extremely low noise and full recall. Set the sample rate to 48kHz for live work and check latency (typically 1–3ms through a digital system). Recall shows and scenes between performances. Always have a system backup and know the reset procedure.' },
  { t:['analog console','analog desk','analog mixing','ssl','neve','midas'],
    a:'Analog consoles (Midas Pro, SSL Live, classic Neve/API) have no latency and a distinct character. They require outboard dynamics and effects in the signal chain. Changes cannot be recalled digitally — create a show file by photographing all settings. Ground properly to avoid hum loops in complex analog systems.' },
  { t:['dsp','digital signal processing','system processor','loudspeaker management','crossover'],
    a:'DSP processors (Lake, XTA, Xilica, Dante-enabled devices) handle crossovers, delay, EQ, limiting, and routing for speaker systems. Always protect speaker components with limiters set 3–6 dB below the amplifier clip point. Time-align all speakers from the same point reference (usually the main PA cluster) using measured delay.' },
  // ── Noise & Grounding ────────────────────────────────────────────────────
  { t:['ground loop','hum','buzz','60hz hum','50hz hum','noise floor','interference'],
    a:'Ground loops cause 50/60Hz hum when multiple devices share different ground potentials. Break loops with a DI box (which has a ground lift switch) or use balanced lines throughout. Systematic troubleshooting: disconnect everything and add back one source at a time until the hum reappears. Star-grounding systems (one common ground point) prevent most ground loops.' },
  { t:['noise floor','self noise','snr','signal to noise'],
    a:'Noise floor is the level of unwanted noise in a system, measured in dBu or dBFS. Professional equipment maintains a noise floor of –90 dBu or better. To maximize SNR, set gains correctly at every stage (gain staging), use short cable runs, keep analog cables away from power cables, and use balanced lines throughout.' },
  { t:['latency','delay compensation','roundtrip latency','monitoring latency'],
    a:'Digital systems introduce latency due to A/D conversion, DSP processing, and D/A conversion. A typical digital console adds 1–3ms latency. Stage monitors through a digital system may have 2–5ms — barely perceptible. Long Dante/AVB networks can add more; always measure with a measurement tool and add delay compensation. Performers notice latency above ~25ms.' },
  // ── Stage Plot & Production ───────────────────────────────────────────────
  { t:['stage plot','stage layout','stage design','plot','rider'],
    a:'A stage plot is a visual diagram showing the position of all musicians, instruments, monitors, and equipment on stage. It includes microphone types, stand types, monitor mixes, and power requirements. Submit it to the venue 2–4 weeks before the show alongside your input list and technical rider so they can prepare the correct equipment.' },
  { t:['technical rider','tech rider','rider','production rider'],
    a:'A technical rider specifies minimum technical requirements: PA system size and specification, console type and channel count, monitor system (wedges or IEM), backline, power drops, and any special requirements. Be realistic — list what you actually need, not what you ideally want. Include a contact name for the production manager.' },
  { t:['backline','backline gear','rental backline','hire'],
    a:'Backline refers to the amps and drums provided by the venue or hired separately. Specify your requirements clearly: amp head models, cabinet sizes, and configurations. If sharing backline, list your preferred settings or bring your own preamp/pedalboard to DI from. Drum riders should specify hardware (hi-hat stand, kick pedal, snare) in addition to shells and cymbals.' },
  { t:['load in','load-in','setup','soundcheck','line check','production schedule'],
    a:'A typical load-in schedule: crew arrives → PA deployment and rigging → FOH and monitor rack setup → stage plot setup and cabling → line check (signal from each channel) → soundcheck (full band, mix building) → dinner break → doors → show. Allow 30 minutes per band for soundcheck on multi-act shows, plus 45–60 minutes for the headliner.' },
  { t:['soundcheck','sound check','check','line check'],
    a:'Start with a line check: confirm signal from every channel individually. Then build the FOH mix: drums first (kick, snare, toms, overheads), then bass, guitars, keys, then vocals. Build monitor mixes with the performer present and make adjustments based on their requests. Leave 10–15 minutes for band to play through a song for final mix polish.' },
  // ── Instrument-specific ───────────────────────────────────────────────────
  { t:['kick drum','kick mic','bass drum','kick'],
    a:'The kick drum typically uses a large-diaphragm dynamic mic (Shure Beta 52A, AKG D112, Audix D6) inside the port hole or at the resonant head. Position the mic 2–4 inches from the beater head for attack, or back in the shell for more boom. Apply a high-pass at 40 Hz, boost 60–80 Hz for body, and 3–5 kHz for beater click. Compress heavily (4:1 or more) with fast attack.' },
  { t:['snare drum','snare mic'],
    a:'Snare top is typically miced with an SM57 positioned 1–2 inches above the rim, angled toward the center. Snare bottom (if used) captures the rattle — phase-reverse the bottom mic. Boost 200 Hz for body, 3 kHz for crack, cut 1 kHz for boxiness. Use a tight gate to eliminate bleed between hits.' },
  { t:['drum overhead','overhead mic','cymbal mic','hi hat'],
    a:'Overheads capture the full drum kit in stereo. Spaced pair (2 mics, 3 feet apart, 18 inches above cymbals) is the most common live configuration. Apply a 80–100 Hz HPF to eliminate low-frequency bleed. Keep overhead level lower in the live mix than in studio — the kick and snare close mics do the heavy lifting.' },
  { t:['electric guitar','guitar amp','guitar mic','guitar cabinet'],
    a:'Guitar amps are typically miced with an SM57 close to the speaker cone. Center of the cone gives more brightness and edge; moving off-center toward the dustcap adds warmth and reduces harshness. A second mic (ribbon or large-diaphragm condenser) at distance blends for a room sound. Apply a 100 Hz HPF and a 6 kHz presence boost if needed.' },
  { t:['bass guitar','bass di','bass amp','direct bass'],
    a:'Bass guitar is best captured with a split signal: DI from the instrument (for clean low-end definition) and a mic on the amp (for grind and character). Blend the two in the mix. Apply an HPF at 60 Hz (nothing useful below this for bass guitar), boost 80 Hz for weight, 800 Hz for midrange punch, and 2–3 kHz for string definition.' },
  { t:['acoustic guitar','acoustic','fingerpicking'],
    a:'Acoustic guitar is most commonly miced at the 12th fret (avoiding the soundhole, which booms) with a small-diaphragm condenser. A passive DI from the onboard pickup can blend with the mic for live use. Apply an HPF at 100 Hz, slight cut at 250 Hz to remove boominess, and a gentle boost at 5–8 kHz for sparkle.' },
  { t:['keyboard','keys','piano','synth','synthesizer'],
    a:'Keyboards output line level (+4 dBu professional, –10 dBV consumer) and typically connect via stereo TRS or dual mono to two DI channels. Route to a stereo channel pair on the console. Minimal EQ needed for high-quality keyboards — just verify the output is at the correct level and not clipping the console input.' },
  // ── Safety & Protection ───────────────────────────────────────────────────
  { t:['hearing protection','hearing damage','db spl','loud','volume limit'],
    a:'Prolonged exposure above 85 dB SPL causes permanent hearing damage. OSHA limits continuous 8-hour exposure to 90 dBA; EU regulations limit live concerts to 107 dB(A) Leq 8h averaged. Wear foam earplugs or custom musicians\' earplugs during loud rehearsals and shows. IEM systems with isolation are the best long-term hearing protection for performers.' },
  { t:['power','power distribution','power conditioner','pdp','ac power'],
    a:'Live sound requires clean, stable AC power. Use power distribution panels (PDPs) with isolated ground for audio equipment. Keep lighting and audio on separate circuits to avoid interference. Stage power drops (typically 20A or 30A circuits) should be confirmed with the venue before load-in. Power conditioning removes voltage spikes and high-frequency interference.' },
  // ── Acoustic & Room ───────────────────────────────────────────────────────
  { t:['room acoustics','acoustics','reverb time','reflection','room treatment'],
    a:'Every room has a frequency response and reverb time that affects the mix. Hard surfaces (concrete, glass) cause long, bright reverb; absorptive surfaces (carpet, curtains, people) dry the room. Boost frequencies that the room absorbs and cut frequencies the room reinforces. Always listen to the room from multiple positions before mixing.' },
  { t:['spl','sound pressure level','volume','decibel'],
    a:'SPL (Sound Pressure Level) is measured in dB. Conversational speech is ~60 dB SPL; a typical live rock show is 100–110 dB SPL at FOH position. Every 6 dB requires doubling the amplifier power and roughly doubles perceived loudness (every 10 dB is perceived as twice as loud). Measure with a calibrated SPL meter at the mix position.' },
  // ── Networking & Digital Audio ────────────────────────────────────────────
  { t:['dante','aes67','avb','milan','networked audio','digital audio network'],
    a:'Dante is the most common digital audio networking protocol in professional AV, running over standard Ethernet switches (Gigabit recommended). It carries hundreds of channels at low latency. AES67 is the interoperability standard between Dante, RAVENNA, and AES70. Managed switches with proper DSCP QoS settings are required for reliable low-latency Dante.' },
  { t:['aes','aes3','aes/ebu','digital audio','spdif','optical'],
    a:'AES3 (AES/EBU) is a professional point-to-point digital audio standard carrying 2 channels over XLR cable at 48 or 96 kHz. S/PDIF is the consumer equivalent via RCA or optical (TOSLINK). For more than 2 channels, MADI (AES10) carries 56 or 64 channels over coax or fiber and is widely used in large touring systems.' },
  // ── Miscellaneous ─────────────────────────────────────────────────────────
  { t:['stage volume','stage noise','bleed','spill','isolation'],
    a:'Excessive stage volume makes mixing difficult — every open mic becomes a bleed microphone. Work with performers to reduce stage volume: use IEMs instead of wedges, lower amp volumes and use amp attenuators, use electronic drums or mesh heads for rehearsal. A quieter stage means more control over the FOH mix and less feedback risk.' },
  { t:['talkback','comms','intercom','communication','crew comms'],
    a:'Talkback systems allow the audio engineer to communicate with the stage crew without going through the PA. FOH talkback feeds a separate aux to stage monitors. Production comms (Clear-Com, Riedel, intercom) run as wired or wireless party-line systems for crew coordination during the show.' },
  { t:['patch','patching','studio patch','bay','normalling'],
    a:'A patch bay (patch panel) gives physical access to all studio/venue insert points. Top row is typically the output of a device; bottom row is the input. Normalled connections pass signal without a cable; half-normalled allow monitoring without breaking the connection. In digital systems, patching is handled in the console\'s software routing matrix.' },
  { t:['frequency coordination','intermodulation','imd','wireless coordination','rf planning'],
    a:'When running multiple wireless systems, intermodulation products (spurious frequencies created by RF mixing) can cause interference on used frequencies. Use frequency coordination software (Shure Wireless Workbench, Sennheiser WSM) to calculate clean frequency groups. As a rule, all transmit frequencies must be intermodulation-free from all combinations of three or more transmitters.' },
  { t:['bass management','subwoofer management','lfe','crossover frequency'],
    a:'Route full-range content through a crossover: high-pass the main tops above 80–100 Hz, low-pass the subwoofers below the same point. Time-align the subwoofers to the tops (they are physically closer to the audience and typically need delay added). Use a high-quality Linkwitz-Riley crossover (LR24 or LR48) for the best acoustic summing at the crossover point.' },

  // ── Band Organization & Stage Layout ─────────────────────────────────────
  { t:['organize band','organise band','stage positions','who stands where','how many members','5 members','5-piece','4-piece','6-piece','3-piece','band layout','band arrangement','arrange the band'],
    a:'For a typical 5-piece band (drums, bass, two guitars, vocalist), place the drummer center-rear, bassist stage right, guitarists stage left, and lead vocalist front-center. Keyboards or extra members spread to the sides. Keep amps behind the performers and angled inward. Mark each position on your stage plot so venue crew can set up correctly before you arrive.' },
  { t:['trio','3 piece','three piece','power trio','3-piece band'],
    a:'A power trio (drums, bass, guitar/vocal) is one of the most space-efficient setups. Place drums center-rear, bassist stage right, guitarist stage left or center-front. Channel count is typically 8–12 inputs: kick, snare, overheads, bass DI, guitar mic, one or two vocal channels. Each performer gets one monitor mix.' },
  { t:['rock band','rock setup','rock stage','4 piece rock','5 piece rock'],
    a:'Standard rock stage layout: drums center-rear on a riser, bass amp stage right angled toward the drummer, guitar amp stage left angled toward the drummer, lead vocalist front-center with wireless mic. Use floor wedges per performer or IEMs for better stage volume control. Allow 3–4 feet of clear space in front of the drums for the drum fill monitor.' },
  { t:['jazz','jazz combo','jazz band','jazz setup','jazz stage'],
    a:'Jazz setups favor acoustic balance over heavy reinforcement. Position the piano left, bass right, and drums rear-center; horns and vocalists front. Use small-diaphragm condensers or clip mics on brass. Keep PA levels modest — in smaller rooms the instruments speak naturally and over-reinforcement causes phase issues.' },
  { t:['acoustic act','singer songwriter','unplugged','solo acoustic','solo performer'],
    a:'For a solo acoustic act: one vocal channel (SM58 or condenser), one acoustic guitar channel (DI plus optional mic blend), and a single monitor wedge or IEM pack. Total channel count is 2–4. Add a DI for any loop station or playback. Keep the monitor mix simple — mostly vocal with a touch of guitar for orientation.' },
  { t:['string quartet','orchestra','classical','choir','choral','ensemble'],
    a:'Orchestral and classical ensembles rely on natural room acoustics with gentle reinforcement. Use small-diaphragm condensers 2–3 feet from each section. A Decca tree (three mics in a triangle) captures the ensemble naturally. Keep PA levels low — the goal is support, not coverage. Avoid hard compression; let dynamics breathe.' },
  { t:['monitor mix','how many monitor mixes','aux mixes','mixes for the band','monitor sends'],
    a:'Plan one monitor mix per performer or zone. A 5-piece band typically needs 5–6 monitor sends: drums (plus a drum fill), bassist, guitarist(s), keys, and each vocalist. Label every aux send per performer on your console and note it on the stage plot. Discuss each performer\'s preferences before soundcheck rather than building mixes from scratch during the show.' },
  { t:['how many channels','channel count','input count','console size','desk size','desk channels'],
    a:'Estimate channel count: drums need 6–8 channels (kick, snare, hi-hat, two overheads, toms), each DI instrument needs 1–2, each vocal needs 1. A 5-piece rock band typically requires 16–24 channels; a jazz quartet 8–12; a solo act with loop station 4–6. Always add 20% spare channels — extras and fixes always come up during load-in.' },
  { t:['small stage','stage size','stage depth','tight stage','cramped stage'],
    a:'On small stages (under 20 ft wide), full backline and drum risers quickly become impractical. Consider electronic drums or a drum shield to control bleed, amp-less guitar rigs (digital modelers via DI), and IEMs for all performers. Compact setups also reduce on-stage volume, which gives the engineer far more control over the FOH mix.' },
  { t:['large stage','big stage','arena stage','outdoor stage','festival stage'],
    a:'On large stages (30+ ft), sidefilll monitors become essential — wedges alone can\'t cover wide stage movements. Use a dedicated monitor engineer at a monitor console. Add near-fill speakers at the front edge so downstage performers have coverage. Wireless everywhere avoids cable hazards on large stages, and use a stage manager to coordinate positions.' },
  { t:['what mic should i use','recommend a mic','best mic for','which mic','mic recommendation'],
    a:'For live vocals: SM58 (dynamic, reliable, handles everything). For snare/guitar amp: SM57 (industry standard). For kick drum: Shure Beta 52A, AKG D112, or Audix D6. For drum overheads: small-diaphragm condensers (Shure SM81, Rode NT5). For acoustic guitar: small-diaphragm condenser at the 12th fret, or a DI blend. Budget matters — quality preamps often matter more than the mic brand.' },
  { t:['how to soundcheck','soundcheck tips','soundcheck order','check the band'],
    a:'Soundcheck order: start with a line check on every channel individually, then build the drum mix (kick → snare → toms → overheads), add bass, then guitars and keys, and finish with vocals. Build each monitor mix with the performer present. Always play at least one full song at show volume before declaring soundcheck done — levels change with the room full of people.' },
  { t:['gig checklist','what to bring','what do i need','gig prep','show prep','pre-show checklist'],
    a:'Essential gig checklist: stage plot and input list (send in advance), spare cables (XLR and instrument), spare batteries and strings, gaffer tape, DI boxes, wireless packs fully charged, a power strip and surge protector, earplugs, and a laminated copy of the setlist. Arrive early — a rushed soundcheck is always a bad soundcheck.' },
  { t:['create a plot','make a plot','generate a plot','build a plot','make me a stage plot','create a stage','set up the stage','build my stage','add my band','plot for my band'],
    a:'To generate a stage plot automatically, describe your band in this chat — for example: "I have drums, bass guitar, electric guitar, and a vocalist." I\'ll add all the elements to your stage and arrange them in the correct positions.' },
];

// ── Knowledge query engine ────────────────────────────────────────────────────
function _scScore(query, entry) {
  const q = query.toLowerCase();
  const words = q.split(/\W+/).filter(w => w.length > 2);
  let score = 0;
  for (const tag of entry.t) {
    if (q.includes(tag))       { score += tag.split(' ').length * 4; } // phrase match bonus
    else {
      for (const w of tag.split(' ')) {
        if (w.length > 2 && words.includes(w)) score += 2;
      }
    }
  }
  return score;
}

function _scGetAnswer(query) {
  let best = null, bestScore = 0;
  for (const entry of SC_KB) {
    const s = _scScore(query, entry);
    if (s > bestScore) { bestScore = s; best = entry; }
  }
  if (bestScore >= 4) return best.a;
  // Low-confidence — generic helpful response
  return null;
}

function _scFallback(query) {
  const q = query.toLowerCase();
  if (/hello|hi |hey |howdy/.test(q))
    return 'Hi! I\'m StageMind, your built-in audio engineering assistant. Ask me about microphones, gain staging, PA systems, signal routing, stage plots, monitors, wireless — anything related to live production. Or say something like "I have drums, bass, two guitars, and a vocalist" and I\'ll build the stage plot for you automatically.';
  if (/thank/.test(q)) return 'Happy to help. Got another question about your stage setup or signal chain?';
  if (/who are you|what are you|what can you do/.test(q))
    return 'I\'m StageMind — a built-in AI assistant for live sound and stage production. I work entirely offline with no internet required. I can answer questions about microphones, gain staging, PA setup, signal flow, EQ, compression, monitors, wireless, stage plots, and riders. I can also build a stage plot for you automatically — just describe your band.';
  if (/band|members|musicians|performers|lineup|setup|gig|show|venue|stage/.test(q))
    return 'Happy to help with your band or show setup. For stage positioning, describe your lineup (e.g. "5-piece band with drums, bass, two guitars, vocalist") and I can generate the plot automatically. For general stage advice, try asking about monitor mixes, channel count, or stage layout for your genre.';
  if (/how|what|why|when|which|where/.test(q))
    return 'Good question — I might need a bit more context to give a useful answer. I specialize in live sound and stage production. Try including keywords like the instrument, mic type, or production topic (e.g. "how do I mic a snare drum", "what\'s the best IEM setup", "why is there feedback on my vocal mic").';
  return 'I\'m not sure about that specific topic — try rephrasing with production keywords (e.g. "gain staging", "feedback", "DI box", "monitor mix"). I cover microphones, PA systems, signal flow, monitors, wireless, EQ, compression, stage plots, and live production planning.';
}

// ── Plot generation engine ─────────────────────────────────────────────────────

const _SC_INST_MAP = [
  { kw:['lead vocalist','lead vocal','lead singer','vocalist','singer','rap','mc','lead voice'], type:'Wireless Mic',      name:'Wireless',    icon:'cx-wireless'   },
  { kw:['acoustic drum','drum kit','drummer','drums','drum'],                                    type:'Acoustic Drums',  name:'Drum Kit',    icon:'drum'          },
  { kw:['electronic drum','e-drum','edrum','electric drum'],                                     type:'Electronic Drums',name:'E-Drums',     icon:'cx-edrum'      },
  { kw:['lead guitar','rhythm guitar','electric guitar','elec guitar','guitarist'],              type:'Electric Guitar', name:'Elec Guitar', icon:'cx-elec-guitar'},
  { kw:['acoustic guitar','acoustic guit'],                                                      type:'Acoustic Guitar', name:'Acou Guitar', icon:'guitar'        },
  { kw:['bass guitar','bass player','bassist','bass'],                                           type:'Bass Guitar',     name:'Bass Guitar', icon:'cx-bass-guitar'},
  { kw:['keyboard','keyboardist','keys','pianist','piano'],                                      type:'Keyboard DI',     name:'Keyboard',    icon:'piano'         },
  { kw:['synthesizer','synth'],                                                                  type:'Synthesizer',     name:'Synth',       icon:'cx-synth'      },
  { kw:['violin','violinist','viola','cello','strings'],                                         type:'String Instrument',name:'Strings',    icon:'cx-violin'     },
  { kw:['trumpet','trombone','flugelhorn','brass','horn player'],                                type:'Brass Instrument',name:'Brass / Horn',icon:'cx-trumpet'    },
  { kw:['saxophone','sax'],                                                                      type:'Brass Instrument',name:'Brass / Horn',icon:'cx-trumpet'    },
  { kw:['percussion','percussionist','bongo','conga','timbale'],                                 type:'Percussion',      name:'Percussion',  icon:'cx-percussion' },
  { kw:['cajon','cajón'],                                                                        type:'Cajón',           name:'Cajón',       icon:'cx-cajon'      },
  { kw:['laptop','playback','backing track','click track'],                                      type:'Playback Device', name:'Playback',    icon:'play-circle'   },
  { kw:['loop station','looper'],                                                                type:'Loop Station',    name:'Loop Station',icon:'repeat-2'      },
  { kw:['dj','turntable','decks','cdj'],                                                        type:'Playback Device', name:'Playback',    icon:'play-circle'   },
];

const _SC_NUM_WORDS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, a:1, an:1 };

// Detect if the user wants us to build a stage plot
function _scIsPlotIntent(text) {
  const q = text.toLowerCase();
  return /(create|make|generate|build|set up|setup|draw|add|put).{0,20}(plot|stage|my band|elements?)/i.test(q)
      || /(plot|stage).{0,20}(for me|for my|my band|us)/i.test(q)
      || /(i have|i've got|we have|we've got|i need a plot for|generate for).{0,40}(vocalist|drummer|guitarist|bassist|keyboardist|drummer|violin|trumpet|saxophone|sax|brass|synth|drum|guitar|bass|keys|keyboard|cajon|percussion)/i.test(q)
      || /(my band|our band).{0,10}(has|have|consists|is made up|includes)\b/i.test(q)
      || /\d[\s-]piece band/i.test(q);
}

// Parse instruments and counts from free text
function _scParseInstruments(text) {
  const q = text.toLowerCase();
  const found = [];
  for (const entry of _SC_INST_MAP) {
    for (const kw of entry.kw) {
      if (!q.includes(kw)) continue;
      // Look for a count word immediately before this keyword
      const re = new RegExp('(\\d+|' + Object.keys(_SC_NUM_WORDS).join('|') + ')\\s+(?:\\w+\\s+){0,2}' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const m = q.match(re);
      let count = 1;
      if (m) {
        const n = m[1];
        count = parseInt(n) || _SC_NUM_WORDS[n] || 1;
      }
      for (let i = 0; i < Math.min(count, 4); i++) found.push(entry);
      break;
    }
  }
  return found;
}

// Create elements on the stage from an instrument list, with inline zone placement
function _scBuildPlot(instruments) {
  if (!instruments.length) return false;
  try {
    const allLibItems = Object.values(library).flat();

    // ── Get canvas dimensions (fall back to defaults if not rendered yet) ──────
    const canvas = document.getElementById('stage-canvas');
    const W = (canvas && canvas.offsetWidth  > 50) ? canvas.offsetWidth  : (state.canvasW || 900);
    const H = (canvas && canvas.offsetHeight > 50) ? canvas.offsetHeight : (state.canvasH || 506);

    // ── Create elements (positions overwritten by the shared placer below) ────
    const newEls = [];
    instruments.forEach((inst, idx) => {
      const libItem = allLibItems.find(i => i.type === inst.type) ||
                      { name: inst.name, icon: inst.icon, type: inst.type };
      const chNum = (state.elements.length + newEls.length + 1).toString().padStart(2, '0');
      const el = {
        id: 'el-' + state.nextId++,
        name: libItem.name,
        label: ((libItem.nameKey && typeof T === 'function' ? T(libItem.nameKey) : null) || libItem.name).toUpperCase(),
        icon: libItem.icon, type: libItem.type,
        x: W / 2, y: H / 2,           // overwritten by _smartPlaceElements
        rotation: 0, scale: 100,
        channelId: 'CH-' + chNum, source: 'SL01', output: 'FOH',
        phantom: false, notes: '', color: libItem.color || '#7aafff', roles: [],
      };
      newEls.push(el);
      state.elements.push(el);
    });

    // ── Anchor-based placement (shared with the toolbar's Auto-Arrange) ──────
    if (typeof _smartPlaceElements === 'function') {
      _smartPlaceElements(newEls, W, H);
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    if (typeof renderElements === 'function') renderElements();
    if (typeof pushHistory    === 'function') pushHistory();
    if (typeof updateDropHint === 'function') updateDropHint();
    return true;
  } catch (e) { console.error('[StageMind plot]', e); return false; }
}

// Typewriter simulation — emits the answer word-by-word like streaming
function _scSimulateStream(text, onChunk, onDone) {
  const words = text.split(' ');
  let i = 0;
  function next() {
    if (i >= words.length) { onDone(); return; }
    onChunk((i === 0 ? '' : ' ') + words[i++]);
    setTimeout(next, 18 + Math.random() * 22);
  }
  next();
}

// ════════════════════════════════════════════════════
// 1. STAGEMIND ASSISTANT
// ════════════════════════════════════════════════════
let smConversation = [];
let smStreaming = false;

function _smLang() {
  return (typeof state !== 'undefined' && state.lang === 'es') ? 'es' : 'en';
}

function smSendMessage() {
  const input = document.getElementById('sm-input');
  if (!input || smStreaming) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = '38px';

  // Block AI calls when offline mode is active
  if (typeof offlineModeEnabled !== 'undefined' && offlineModeEnabled) {
    smConversation.push({ role: 'user', content: text });
    smConversation.push({ role: 'assistant', content: '⚡ **Offline Mode is on.** The AI Assistant is disabled. Turn off Offline Mode in Settings to use it.' });
    _smRender();
    _smScrollBottom();
    return;
  }

  const ctx = _buildStageContext();
  smConversation.push({ role: 'user', content: text });
  _smRender();

  smStreaming = true;
  smConversation.push({ role: 'assistant', content: '' });
  _smRender();
  _smScrollBottom();

  const sendBtn = document.getElementById('sm-send-btn');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.5'; }

  // ── Plot generation takes priority ────────────────────────────────────────
  if (_scIsPlotIntent(text)) {
    const instruments = _scParseInstruments(text);
    if (instruments.length > 0) {
      const ok = _scBuildPlot(instruments);
      if (ok) {
        const names = instruments.map(i => i.name);
        const unique = [...new Set(names)];
        const summary = unique.map(n => {
          const c = names.filter(x => x === n).length;
          return c > 1 ? c + '× ' + n : n;
        }).join(', ');
        const reply = 'Done! I\'ve added ' + instruments.length + ' element' + (instruments.length > 1 ? 's' : '') + ' to your stage (' + summary + ') and arranged them into their standard positions. You can drag any element to fine-tune the layout, rename them in the properties panel, or use Auto-Arrange from the toolbar to re-sort at any time.';
        _scSimulateStream(reply, chunk => {
          smConversation[smConversation.length - 1].content += chunk;
          _smRender(); _smScrollBottom();
        }, () => _smFinish());
        return;
      }
    }
  }

  // ── Built-in knowledge engine ──────────────────────────────────────────────
  const answer = _scGetAnswer(text) || _scFallback(text);
  _scSimulateStream(answer,
    chunk => {
      smConversation[smConversation.length - 1].content += chunk;
      _smRender(); _smScrollBottom();
    },
    () => _smFinish()
  );
}

function _smFinish() {
  smStreaming = false;
  const sendBtn = document.getElementById('sm-send-btn');
  if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
  _smRender();
  _smScrollBottom();
}

function _smRender() {
  const list = document.getElementById('sm-messages');
  if (!list) return;
  list.innerHTML = DOMPurify.sanitize('');

  if (smConversation.length === 0) {
    const es = _smLang() === 'es';
    const title = es ? 'Asistente StageMind' : 'StageMind Assistant';
    const sub = es
      ? 'Pregúntame sobre distribución del escenario, enrutamiento de audio, colocación de micrófonos, flujo de señal o riders técnicos.'
      : 'Ask me anything about stage plots, audio routing, mic placement, signal flow, or technical riders.';
    const qe = [
      'How do I set gain staging properly for a live band?',
      'What microphones should I use for a drum kit on stage?',
      'How do I set up in-ear monitor mixes for a full band?',
      'What should be included in a professional technical rider?',
    ];
    const qes = [
      '¿Cómo configuro correctamente los niveles de ganancia para una banda en vivo?',
      '¿Qué micrófonos debo usar para una batería en el escenario?',
      '¿Cómo configuro mezclas de monitores in-ear para una banda completa?',
      '¿Qué debe incluir un rider técnico profesional?',
    ];
    const qs = es ? qes : qe;
    var btns = qs.map(function(q, qi) {
      var sid = 'sm-sugg-' + qi;
      return '<div id="' + sid + '" style="display:flex;align-items:center;gap:4px;">' +
        '<button class="sm-suggestion" style="flex:1;" data-q="' + q.replace(/"/g, '&quot;') + '" onclick="smQuickAsk(this.dataset.q)">' + q + '</button>' +
        '<button onclick="var el=document.getElementById(\'' + sid + '\');if(el)el.remove();" style="background:none;border:none;cursor:pointer;color:#484847;font-size:15px;line-height:1;padding:2px 5px;flex-shrink:0;transition:color .12s;" onmouseover="this.style.color=\'#9a9a9a\'" onmouseout="this.style.color=\'#484847\'" title="Dismiss">×</button>' +
        '</div>';
    }).join('');
    list.innerHTML = DOMPurify.sanitize('<div class="sm-empty-state">' +
      '<p class="sm-empty-title">' + title + '</p>' +
      '<p class="sm-empty-sub">' + sub + '</p>' +
      '<div class="sm-suggestions">' + btns + '</div>' +
      '</div>');

    const inp = document.getElementById('sm-input');
    if (inp) inp.placeholder = es
      ? 'Pregunta sobre escenario, ruteo de señal, micrófonos, ganancia...'
      : 'Ask about stage layout, signal routing, mic placement, gain staging...';
    return;
  }

  smConversation.forEach((msg, i) => {
    const div = document.createElement('div');
    div.className = 'sm-msg sm-msg-' + msg.role;

    if (msg.role === 'user') {
      div.innerHTML = DOMPurify.sanitize(`<div class="sm-bubble sm-bubble-user">${_smEscape(msg.content)}</div>`);
    } else {
      const isStreaming = smStreaming && i === smConversation.length - 1;
      const formatted = _smFormat(msg.content);
      div.innerHTML = DOMPurify.sanitize(`
        <div class="sm-avatar">SM</div>
        <div class="sm-bubble sm-bubble-ai">
          ${formatted || (isStreaming ? '<span class="sm-cursor">▋</span>' : '')}
          ${isStreaming && formatted ? '<span class="sm-cursor">▋</span>' : ''}
        </div>`);
    }
    list.appendChild(div);
  });
}

function _smFormat(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function _smEscape(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _smScrollBottom() {
  const list = document.getElementById('sm-messages');
  if (list) list.scrollTop = list.scrollHeight;
}

function _buildStageContext() {
  if (typeof state === 'undefined') return '';
  const els = (state.elements || []).map(e =>
    `${e.name}${e.type ? ' ('+e.type+')' : ''}${e.chid ? ' ch:'+e.chid : ''}`
  ).join(', ');
  return `Stage has ${(state.elements||[]).length} elements: ${els || 'none'}. ${(state.connections||[]).length} connections.`;
}

function smQuickAsk(text) {
  const input = document.getElementById('sm-input');
  if (input) { input.value = text; }
  smSendMessage();
}

function smClearChat() {
  smConversation = [];
  smStreaming = false;
  const sendBtn = document.getElementById('sm-send-btn');
  if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
  _smRender();
}

function smHandleKey(e) {
  // On mobile (touch), Enter = newline; use send button instead
  if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) {
    e.preventDefault();
    smSendMessage();
  }
}

// Auto-resize textarea
function smAutoResize(el) {
  el.style.height = '38px';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}


// ════════════════════════════════════════════════════
// 2. GAIN STAGING HELPER
// ════════════════════════════════════════════════════
const GAIN_PROFILES = {
  'Dynamic Mic':        { rec: -18, min: -26, max: -12, label: 'Dynamic Mic',   note: 'Preamp gain 50-60dB typical. Works best on loud sources.' },
  'Condenser Mic':      { rec: -24, min: -32, max: -16, label: 'Condenser',     note: 'Requires +48V phantom power. Handle with care near high SPL.' },
  'Instrument Mic':     { rec: -22, min: -30, max: -14, label: 'Inst Mic',      note: 'Close-mic position. Pad if needed for loud amps.' },
  'Instrument Clip':    { rec: -20, min: -28, max: -12, label: 'Clip Mic',      note: 'Position away from rim strikes to reduce bleed.' },
  'PZM Mic':            { rec: -26, min: -34, max: -18, label: 'PZM Boundary',  note: 'High sensitivity. Place on flat surface for best results.' },
  'Wireless Mic':       { rec: -20, min: -28, max: -12, label: 'Wireless',      note: 'Set TX output to match system. Coordinate frequencies pre-show.' },
  'Electric Guitar':    { rec: -16, min: -24, max: -8,  label: 'Electric Gtr',  note: 'Line or instrument level depending on DI/amp routing.' },
  'Acoustic Guitar':    { rec: -24, min: -32, max: -16, label: 'Acoustic Gtr',  note: 'Low output — use high-impedance DI or instrument mic.' },
  'Bass Guitar':        { rec: -14, min: -22, max: -6,  label: 'Bass Guitar',   note: 'High output. Watch for low-end clipping on preamp.' },
  'Guitar Amplifier':   { rec: -16, min: -22, max: -8,  label: 'Amp Mic',       note: 'Dynamic mic close-miked. May need pad at high stage volumes.' },
  'Bass Amplifier':     { rec: -14, min: -20, max: -6,  label: 'Bass Amp Mic',  note: 'Use a large-diaphragm dynamic or DI split.' },
  'Keyboard DI':        { rec: -10, min: -18, max: -2,  label: 'Keyboard',      note: 'Line level output. Minimal preamp gain required.' },
  'Synthesizer':        { rec: -10, min: -18, max: -2,  label: 'Synthesizer',   note: 'Line level. Hot patches may clip — check peak output.' },
  'Acoustic Drums':     { rec: -20, min: -28, max: -12, label: 'Drum Kit',      note: 'Kick mic typically hotter. Set channels individually.' },
  'Electronic Drums':   { rec: -12, min: -18, max: -4,  label: 'E-Drums',       note: 'Line level from module. Stereo DI recommended.' },
  'Percussion':         { rec: -22, min: -30, max: -14, label: 'Percussion',    note: 'Overhead or clip mic. Loud transients — watch peaks.' },
  'Cajón':              { rec: -20, min: -28, max: -12, label: 'Cajón',         note: 'Single close mic or internal pickup. Front hole for thump.' },
  'Loop Station':       { rec: -10, min: -16, max: -2,  label: 'Looper',        note: 'Line out from device. Stereo DI if stereo loop output.' },
  'Playback Device':    { rec: -10, min: -16, max: -2,  label: 'Playback',      note: 'Stereo line level. Set device output to -10dBu nominal.' },
  'In-Ear Monitor':     { rec: -18, min: -24, max: -6,  label: 'IEM Send',      note: 'Aux send to IEM TX. Start at unity (-18dBFS) and adjust.' },
  'Floor Wedge':        { rec: -18, min: -24, max: -6,  label: 'Wedge Send',    note: 'Aux send level pre-fader. Set flat, then ring out.' },
  'DI Box':             { rec: -14, min: -22, max: -6,  label: 'DI Box',        note: 'Passive DI: 20-30dB instrument level. Active: 0-10dB gain.' },
};

function _gainColor(level, min, max) {
  if (level > max)  return { bg: '#ff4444', label: 'CLIPPING',    text: '#ff4444' };
  if (level < min)  return { bg: '#ffcc00', label: 'LOW SIGNAL',  text: '#ffcc00' };
  const pct = (level - min) / (max - min);
  if (pct > 0.85)   return { bg: '#ff4444', label: 'CLIP RISK',   text: '#ff4444' };
  if (pct > 0.65)   return { bg: '#ffaa00', label: 'HIGH',        text: '#ffaa00' };
  return               { bg: '#4ade80', label: 'GOOD',        text: '#4ade80' };
}

function updateGainHelper(el) {
  const sec = document.getElementById('gain-helper-section');
  if (!sec) return;
  if (!el) { sec.style.display = 'none'; return; }

  const profile = GAIN_PROFILES[el.type] || null;
  if (!profile) { sec.style.display = 'none'; return; }

  // Use per-element gainDb if set, otherwise default to recommended
  if (typeof el.gainDb === 'undefined') el.gainDb = profile.rec;
  const level = el.gainDb;

  sec.style.display = 'block';
  const pct = Math.max(0, Math.min(100, ((level - profile.min) / (profile.max - profile.min)) * 100));
  const c = _gainColor(level, profile.min, profile.max);

  const bar     = document.getElementById('gain-bar-fill');
  const labelEl = document.getElementById('gain-status-label');
  const dbEl    = document.getElementById('gain-db-val');
  const typeEl  = document.getElementById('gain-type-name');
  const noteEl  = document.getElementById('gain-note-text');
  const rangeEl = document.getElementById('gain-range-text');
  const warnEl  = document.getElementById('gain-warning-text');

  if (bar)     { bar.style.width = pct + '%'; bar.style.background = c.bg; }
  if (labelEl) { labelEl.textContent = c.label; labelEl.style.color = c.text; }
  if (dbEl)    dbEl.textContent = level + ' dBFS';
  if (typeEl)  typeEl.textContent = profile.label;
  if (noteEl)  noteEl.textContent = profile.note;
  if (rangeEl) rangeEl.textContent = profile.min + ' to ' + profile.max + ' dBFS';

  // Inline warning row
  if (warnEl) {
    if (level > profile.max) {
      warnEl.textContent = '⚠ Signal clipping — reduce gain';
      warnEl.style.color = '#ff4444';
      warnEl.style.display = 'block';
    } else if (level < profile.min) {
      warnEl.textContent = '⚠ Low signal — increase gain';
      warnEl.style.color = '#ffcc00';
      warnEl.style.display = 'block';
    } else {
      warnEl.style.display = 'none';
    }
  }
}

function adjustGain(delta) {
  if (typeof state === 'undefined' || !state.selectedId) return;
  var el = state.elements.find(function(e) { return e.id === state.selectedId; });
  if (!el) return;
  var profile = GAIN_PROFILES[el.type];
  if (!profile) return;
  if (typeof el.gainDb === 'undefined') el.gainDb = profile.rec;
  el.gainDb = Math.max(profile.min - 9, Math.min(profile.max + 9, el.gainDb + delta));
  updateGainHelper(el);
}

// ════════════════════════════════════════════════════
// 3. PA COVERAGE VISUALIZER
// ════════════════════════════════════════════════════
// PA coverage is always-on automatically for amps and audio speakers
// All angle: 90 = pointing toward DOWNSTAGE / AUDIENCE (bottom of canvas)
// Floor Wedge: 0 = pointing toward stage right, let user rotate via element rotation
const PA_SPEAKER_CONFIGS = {
  'Main PA Left':          { angle: 90, spread: 75,  color: 'rgba(255,116,57,0.15)', stroke: 'rgba(255,116,57,0.5)' },
  'Main PA Right':         { angle: 90, spread: 75,  color: 'rgba(197,255,201,0.15)', stroke: 'rgba(197,255,201,0.5)' },
  // Floor Wedge: default faces DOWN (audience side), rotate 180° in properties to flip toward performers
  'Floor Wedge':           { angle: 90, spread: 45,  color: 'rgba(255,215,0,0.12)',   stroke: 'rgba(255,215,0,0.4)' },
  // Side fills: handled dynamically by position (x)
  'Side Fill':             { angle: 90, spread: 50,  color: 'rgba(200,162,255,0.12)', stroke: 'rgba(200,162,255,0.4)' },
  'Front Fill Speaker':    { angle: 90, spread: 30,  color: 'rgba(122,175,255,0.1)',  stroke: 'rgba(122,175,255,0.35)' },
  'Delay Speaker Tower':   { angle: 90, spread: 50,  color: 'rgba(122,175,255,0.1)',  stroke: 'rgba(122,175,255,0.35)' },
  'Powered Floor PA':      { angle: 90, spread: 60,  color: 'rgba(122,175,255,0.1)',  stroke: 'rgba(122,175,255,0.35)' },
  'Stage Sub-Woofer':      { angle: 90, spread: 110, color: 'rgba(122,175,255,0.06)', stroke: 'rgba(122,175,255,0.2)' },
  'Guitar Amplifier':      { angle: 90, spread: 50,  color: 'rgba(200,162,255,0.1)',  stroke: 'rgba(200,162,255,0.4)' },
  'Guitar Cabinet':        { angle: 90, spread: 50,  color: 'rgba(200,162,255,0.1)',  stroke: 'rgba(200,162,255,0.4)' },
  'Bass Amplifier':        { angle: 90, spread: 65,  color: 'rgba(122,175,255,0.1)',  stroke: 'rgba(122,175,255,0.35)' },
  'Bass Cabinet':          { angle: 90, spread: 65,  color: 'rgba(122,175,255,0.1)',  stroke: 'rgba(122,175,255,0.35)' },
};


const PA_COVERAGE_TYPES = new Set(Object.keys(PA_SPEAKER_CONFIGS));

function renderPACoverage() {
  const overlay = document.getElementById('pa-coverage-overlay');
  if (!overlay) return;
  overlay.innerHTML = DOMPurify.sanitize('');
  if (typeof state === 'undefined') return;

  const canvas = document.getElementById('stage-canvas');
  if (!canvas) return;
  const W = canvas.getBoundingClientRect().width || 980;
  const H = canvas.getBoundingClientRect().height || 551;

  state.elements.forEach(el => {
    const cfg = PA_SPEAKER_CONFIGS[el.type];
    if (!cfg) return;
    // Skip if user turned off coverage for this element
    if (el.soundCoverage === false) return;

    // Base angle + element's own rotation (both clockwise in degrees)
    let angle = cfg.angle + (el.rotation || 0);
    // Side fills: base direction toward center of stage, adjusted for position
    if (el.type === 'Side Fill') {
      angle = (el.x < W / 2 ? 70 : 110) + (el.rotation || 0);
    }

    const len = Math.max(W, H) * 0.55;
    const rad = angle * Math.PI / 180;
    const half = (cfg.spread / 2) * Math.PI / 180;

    const x1 = el.x + Math.cos(rad - half) * len;
    const y1 = el.y + Math.sin(rad - half) * len;
    const x2 = el.x + Math.cos(rad + half) * len;
    const y2 = el.y + Math.sin(rad + half) * len;
    const largeArc = cfg.spread > 180 ? 1 : 0;

    const d = `M ${el.x} ${el.y} L ${x1} ${y1} A ${len} ${len} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', cfg.color);
    path.setAttribute('stroke', cfg.stroke);
    path.setAttribute('stroke-width', '1.5');
    overlay.appendChild(path);

    // Label
    const lx = el.x + Math.cos(rad) * 55;
    const ly = el.y + Math.sin(rad) * 55;
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', lx);
    txt.setAttribute('y', ly);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('dominant-baseline', 'middle');
    txt.setAttribute('fill', cfg.stroke);
    txt.setAttribute('font-size', '7');
    txt.setAttribute('font-family', 'Manrope, sans-serif');
    txt.setAttribute('font-weight', '700');
    txt.textContent = (el.label || el.name).toUpperCase();
    overlay.appendChild(txt);
  });
}

// ── Sound Coverage toggle in properties panel ────────────────────────────────
function _injectSoundCoverageUI() {
  const existing = document.getElementById('sound-coverage-section');
  if (existing) existing.remove();

  const el = typeof state !== 'undefined'
    ? state.elements.find(e => e.id === state.selectedId)
    : null;
  if (!el || !PA_COVERAGE_TYPES.has(el.type)) return;

  const controls = document.getElementById('prop-controls');
  if (!controls) return;
  var scrollArea = controls.querySelector('[style*="overflow-y"]') || controls;

  const isOn = el.soundCoverage !== false;
  const sec = document.createElement('div');
  sec.id = 'sound-coverage-section';
  sec.style.cssText = 'border-top:1px solid rgba(72,72,71,0.2);padding:6px 0 4px;';
  sec.innerHTML = DOMPurify.sanitize(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <span style="font-family:'Manrope',sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--accent);">Sound Coverage</span>
      <button id="sc-toggle-btn" onclick="toggleSoundCoverage()" style="width:32px;height:16px;border-radius:8px;border:none;cursor:pointer;background:${isOn ? 'var(--accent)' : 'rgba(72,72,71,0.35)'};position:relative;transition:background 0.2s;flex-shrink:0;">
        <div style="width:12px;height:12px;border-radius:50%;background:#fff;position:absolute;top:2px;transition:left 0.2s;left:${isOn ? '18px' : '2px'};"></div>
      </button>
    </div>
    <p style="font-family:'Manrope',sans-serif;font-size:8px;color:#484847;line-height:1.4;margin:0;">Dispersion cone overlay. Rotate to aim.</p>
  `);
  scrollArea.appendChild(sec);
}

function toggleSoundCoverage() {
  const el = typeof state !== 'undefined'
    ? state.elements.find(e => e.id === state.selectedId)
    : null;
  if (!el) return;
  el.soundCoverage = el.soundCoverage === false ? true : false;
  _injectSoundCoverageUI();
  renderPACoverage();
}

// ── Smooth real-time tracking via MutationObserver ───────────────────────────
// features.js loads after DOM is ready, so set up directly
(function _initPATracking() {
  const layer = document.getElementById('elements-layer');
  if (!layer) return;
  let _paRaf = null;
  new MutationObserver(() => {
    if (_paRaf) return;
    _paRaf = requestAnimationFrame(() => {
      _paRaf = null;
      renderPACoverage();
    });
  }).observe(layer, { attributes: true, subtree: true, attributeFilter: ['style'] });
})();

// ════════════════════════════════════════════════════
// 4. INPUT CONFLICT DETECTION
// ════════════════════════════════════════════════════
function detectConflicts() {
  const seen = {};
  const dupes = [];
  (state.elements || []).forEach(el => {
    if (!el.channelId && !el.chid) return;
    const ch = el.channelId || el.chid;
    if (seen[ch]) {
      dupes.push({ ch, a: seen[ch], b: el });
    } else {
      seen[ch] = el;
    }
  });
  return dupes;
}

let _conflictDismissed = false;

function dismissConflictPopup() {
  _conflictDismissed = true;
  const banner = document.getElementById('conflict-banner');
  if (!banner) return;
  banner.style.opacity = '0';
  banner.style.transform = 'translateY(6px)';
  setTimeout(() => { banner.style.display = 'none'; }, 200);
}

function updateConflictBanner() {
  const banner = document.getElementById('conflict-banner');
  if (!banner) return;

  if (typeof state === 'undefined' || state.currentView !== 'Editor') {
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(6px)';
    setTimeout(() => { banner.style.display = 'none'; }, 200);
    return;
  }

  const conflicts = detectConflicts();

  if (conflicts.length === 0) {
    // Conflicts resolved — reset dismissed flag so new ones show
    _conflictDismissed = false;
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(6px)';
    setTimeout(() => { banner.style.display = 'none'; }, 200);
    return;
  }

  if (_conflictDismissed) return;

  const lines = conflicts.map(c =>
    `${c.ch}: "${c.a.label || c.a.name}" & "${c.b.label || c.b.name}"`
  ).join('\n');
  const el = document.getElementById('conflict-text');
  if (el) el.textContent = lines;

  // Animate in
  banner.style.display = 'block';
  requestAnimationFrame(() => {
    banner.style.opacity = '1';
    banner.style.transform = 'translateY(0)';
  });
}

// ════════════════════════════════════════════════════
// 5. LAYER SYSTEM
// ════════════════════════════════════════════════════
const LAYERS = {
  stage:       { label: 'Stage Layout', visible: true,  color: '#7aafff',  types: ['Acoustic Drums','Electronic Drums','Cajón','Percussion','Electric Guitar','Acoustic Guitar','Bass Guitar','Guitar Amplifier','Bass Amplifier','Guitar Cabinet','Bass Cabinet','Keyboard DI','Synthesizer','Brass Instrument','String Instrument','Shaker','Tambourine','Loop Station','Playback Device','Stage Mixer'] },
  audio:       { label: 'Audio',        visible: true,  color: '#ff7439',  types: ['Dynamic Mic','Condenser Mic','Instrument Mic','Wireless Mic','PZM Mic','Instrument Clip','DI Box','Floor Wedge','Powered Floor PA','Stage Sub-Woofer','In-Ear Monitor','Drum Fill Monitor','Drum Sub Monitor','Side Fill','Main PA Left','Main PA Right','Delay Speaker Tower','Front Fill Speaker','Headphone Amplifier'] },
  power:       { label: 'Power',        visible: true,  color: '#c5ffc9',  types: ['Power Distro'] },
  connections: { label: 'Connections',  visible: true,  color: '#c8a2ff',  types: [] },
  utilities:   { label: 'Utilities',    visible: true,  color: '#ffd700',  types: ['Stage Box','Patch Bay','Network Router','Audio Splitter','FOH Mixing Console','Monitor Console','Amplifier Rack','Effects Rack','Wireless Rack','Laptop / Computer','Intercom System'] },
};

let layerPanelOpen = false;
let _layerCloseTimer = null;

function _layerPositionPanel() {
  const panel = document.getElementById('layer-panel');
  const btn   = document.getElementById('btn-layers');
  if (!panel || !btn) return;
  const r = btn.getBoundingClientRect();
  // Show panel briefly to measure its size
  const prevVis = panel.style.visibility;
  panel.style.visibility = 'hidden';
  panel.style.display    = 'block';
  panel.style.left       = '0px';
  panel.style.top        = '0px';
  const pw = panel.offsetWidth  || 200;
  const ph = panel.offsetHeight || 160;
  panel.style.visibility = prevVis || '';
  // Prefer to the right of the button; fall back to left if no room
  const margin = 8;
  let left = r.right + 10;
  if (left + pw + margin > window.innerWidth) {
    left = Math.max(margin, r.left - pw - 10);
  }
  // Vertically centre on the button, then clamp to viewport
  let top = r.top + r.height / 2 - ph / 2;
  top = Math.max(margin, Math.min(top, window.innerHeight - ph - margin));
  panel.style.left = left + 'px';
  panel.style.top  = top  + 'px';
}

function _layerSetOpen(open) {
  layerPanelOpen = open;
  const panel = document.getElementById('layer-panel');
  const btn   = document.getElementById('btn-layers');
  if (panel) {
    if (open) {
      // Re-parent to body so the toolbar's overflow:hidden doesn't clip us
      if (panel.parentElement !== document.body) {
        document.body.appendChild(panel);
        // Keep open while hovering the panel itself (desktop)
        panel.onmouseenter = () => { if (_layerCloseTimer) { clearTimeout(_layerCloseTimer); _layerCloseTimer = null; } };
        panel.onmouseleave = () => { if (window.innerWidth >= 768) _layerCloseTimer = setTimeout(() => _layerSetOpen(false), 180); };
      }
      try { renderLayerPanel(); } catch(e) {}
      panel.style.display       = 'block';
      panel.style.opacity       = '0';
      panel.style.transform     = 'translateX(-6px)';
      panel.style.pointerEvents = 'none';
      _layerPositionPanel();
      // Force reflow so transition fires
      panel.getBoundingClientRect();
      panel.style.opacity       = '1';
      panel.style.transform     = 'translateX(0)';
      panel.style.pointerEvents = 'all';
    } else {
      panel.style.opacity       = '0';
      panel.style.transform     = 'translateX(-6px)';
      panel.style.pointerEvents = 'none';
      setTimeout(() => {
        if (!layerPanelOpen) panel.style.display = 'none';
      }, 220);
    }
  }
  if (btn) {
    btn.style.color      = open ? '#7aafff' : '#767575';
    btn.style.background = open ? 'rgba(122,175,255,0.15)' : 'transparent';
  }
}

function _layerHoverEnter() {
  if (window.innerWidth < 768) return; // mobile uses tap, not hover
  if (_layerCloseTimer) { clearTimeout(_layerCloseTimer); _layerCloseTimer = null; }
  if (!layerPanelOpen) _layerSetOpen(true);
}

function _layerHoverLeave() {
  if (window.innerWidth < 768) return;
  _layerCloseTimer = setTimeout(() => { _layerSetOpen(false); }, 180);
}

function toggleLayerPanel() {
  _layerSetOpen(!layerPanelOpen);
  if (layerPanelOpen) {
    // Close when tapping outside the button or the panel itself
    const _closeOutside = (e) => {
      const wrapper = document.getElementById('layers-wrapper');
      const panel   = document.getElementById('layer-panel');
      const inWrap  = wrapper && wrapper.contains(e.target);
      const inPanel = panel   && panel.contains(e.target);
      if (!inWrap && !inPanel) {
        _layerSetOpen(false);
        document.removeEventListener('touchstart', _closeOutside, true);
        document.removeEventListener('click', _closeOutside, true);
      }
    };
    setTimeout(() => {
      document.addEventListener('touchstart', _closeOutside, true);
      document.addEventListener('click', _closeOutside, true);
    }, 50);
  }
}

function setLayer(key, visible) {
  if (LAYERS[key]) LAYERS[key].visible = visible;
  applyLayers();
  renderLayerPanel();
}

function applyLayers() {
  if (typeof state === 'undefined') return;
  state.elements.forEach(el => {
    const dom = document.getElementById('elem-' + el.id);
    if (!dom) return;
    let show = true;
    for (const [key, layer] of Object.entries(LAYERS)) {
      if (key === 'connections') continue;
      if (layer.types.includes(el.type || '') && !layer.visible) { show = false; break; }
    }
    dom.style.opacity = show ? '' : '0.08';
    dom.style.pointerEvents = show ? '' : 'none';
  });
  const svg = document.getElementById('connections-svg');
  if (svg) svg.style.opacity = LAYERS.connections.visible ? '1' : '0';
}

function renderLayerPanel() {
  const list = document.getElementById('layer-list');
  if (!list) return;
  list.innerHTML = DOMPurify.sanitize('');
  Object.entries(LAYERS).forEach(([key, layer]) => {
    const row = document.createElement('div');
    row.className = 'layer-row' + (layer.visible ? ' on' : '');
    row.dataset.key = key;
    row.innerHTML = DOMPurify.sanitize(`
      <span class="layer-dot" style="background:${layer.color};color:${layer.color}"></span>
      <span class="layer-name">${layer.label}</span>
      <input type="checkbox" ${layer.visible ? 'checked' : ''} />`);
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      setLayer(key, !LAYERS[key].visible);
    });
    list.appendChild(row);
  });
}

// ════════════════════════════════════════════════════
// 6. MULTI-SELECTION + GROUPING
// ════════════════════════════════════════════════════
var multiSel = new Set(); // stores string IDs extracted from DOM elem-{id}

// Capture-phase listener fires BEFORE any element's pointerdown handler.
// Calling stopPropagation() here prevents the normal select/drag path entirely.
document.addEventListener('pointerdown', function(e) {
  if (!e.ctrlKey && !e.metaKey) return;
  if (e.button !== 0 || e.pointerType === 'touch') return;
  var wrap = e.target.closest('.stage-element');
  if (!wrap) return; // ctrl+click on empty canvas — let msClear handle it elsewhere
  e.stopPropagation(); // stop event reaching element's bubble handler
  var rawId = wrap.id.replace('elem-', '');
  msToggle(rawId);
}, true); // true = capture phase


function msToggle(id) {
  if (multiSel.has(id)) multiSel.delete(id);
  else multiSel.add(id);
  _msRefreshVisuals();
}

function msClear() {
  multiSel.clear();
  _msRefreshVisuals();
}

function _msRefreshVisuals() {
  document.querySelectorAll('.stage-element').forEach(function(wrap) {
    var raw = wrap.id.replace('elem-', '');
    // IDs are always stored as strings in multiSel (parsed from DOM id attribute)
    wrap.classList.toggle('multi-selected', multiSel.has(raw));
  });
}

function msDeleteSelected() {
  if (typeof state === 'undefined' || multiSel.size === 0) return;
  state.elements = state.elements.filter(function(e) { return !multiSel.has(e.id); });
  state.connections = state.connections.filter(function(c) { return !multiSel.has(c.from) && !multiSel.has(c.to); });
  multiSel.clear();
  if (typeof renderAll === 'function') renderAll();
  if (typeof pushHistory === 'function') pushHistory();
}

function msDuplicateSelected() {
  if (typeof state === 'undefined' || multiSel.size === 0) return;
  var clones = [];
  multiSel.forEach(function(id) {
    var el = state.elements.find(function(e) { return e.id === id; });
    if (!el) return;
    var clone = JSON.parse(JSON.stringify(el));
    clone.id = state.nextId++;
    clone.x += 30; clone.y += 30;
    clone.label = (clone.label || clone.name) + ' (copy)';
    clones.push(clone);
  });
  state.elements.push.apply(state.elements, clones);
  msClear();
  if (typeof renderAll === 'function') renderAll();
  if (typeof pushHistory === 'function') pushHistory();
}

function msGroupSelected() {
  if (multiSel.size < 2) return;
  if (typeof showToast === 'function') showToast('Group active — drag any selected element to move them all');
}

// ── Clear group when clicking the empty canvas background ────────────────────
document.addEventListener('pointerdown', function(e) {
  if (multiSel.size === 0) return;
  var target = e.target;
  var onBg = target === document.getElementById('stage-canvas') ||
             target === document.getElementById('elements-layer') ||
             target === document.getElementById('pa-coverage-svg');
  if (onBg) msClear();
}, false);

// ════════════════════════════════════════════════════
// 7. AUTO WIRING
// ════════════════════════════════════════════════════
let autoWireEnabled = false;

const WIRE_RULES = [
  { from: 'Electric Guitar',  to: 'Guitar Amplifier', maxDist: 999 },
  { from: 'Bass Guitar',      to: 'Bass Amplifier',   maxDist: 999 },
  { from: 'Guitar Amplifier', to: 'Dynamic Mic',      maxDist: 300 },
  { from: 'Bass Amplifier',   to: 'Dynamic Mic',      maxDist: 300 },
  { from: 'Keyboard DI',      to: 'DI Box',           maxDist: 999 },
  { from: 'Synthesizer',      to: 'DI Box',           maxDist: 999 },
  { from: 'Playback Device',  to: 'DI Box',           maxDist: 999 },
  { from: 'Loop Station',     to: 'DI Box',           maxDist: 999 },
];

function runAutoWire() {
  if (!autoWireEnabled || typeof state === 'undefined') return;
  let added = 0;
  WIRE_RULES.forEach(rule => {
    const froms = state.elements.filter(e => e.type === rule.from);
    const tos   = state.elements.filter(e => e.type === rule.to);
    froms.forEach(f => {
      if (!tos.length) return;
      const nearest = tos.reduce((best, t) => {
        return Math.hypot(f.x - t.x, f.y - t.y) < Math.hypot(f.x - best.x, f.y - best.y) ? t : best;
      });
      const exists = state.connections.some(c =>
        (c.from === f.id && c.to === nearest.id) || (c.from === nearest.id && c.to === f.id)
      );
      if (!exists) { state.connections.push({ from: f.id, to: nearest.id }); added++; }
    });
  });
  if (typeof renderConnections === 'function') renderConnections();
  if (added > 0 && typeof showToast === 'function') showToast(`Auto Wiring: ${added} connection${added > 1 ? 's' : ''} added`);
}

function toggleAutoWire(on) {
  autoWireEnabled = on;
  const btn = document.getElementById('settings-autowire-toggle');
  if (btn) btn.classList.toggle('on', on);
  if (on) runAutoWire();
}

// ════════════════════════════════════════════════════
// 8. OFFLINE MODE + SERVICE WORKER
// ════════════════════════════════════════════════════


// ── Offline Mode toggle ──────────────────────────────────────────────────────
// When enabled: all cloud/AI calls are blocked; app works fully from cache.
let offlineModeEnabled = localStorage.getItem('sc-offline-mode') === '1';

function _applyOfflineModeUI() {
  const btn = document.getElementById('settings-offline-toggle');
  if (btn) btn.classList.toggle('on', offlineModeEnabled);

  // Show/hide a header badge
  let badge = document.getElementById('offline-mode-badge');
  if (offlineModeEnabled) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'offline-mode-badge';
      badge.title = 'Offline Mode — AI features disabled';
      badge.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);' +
        'background:#1a1a1a;border:1px solid #ffaa00;color:#ffaa00;font-family:"Manrope",sans-serif;' +
        'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;' +
        'padding:3px 10px;border-radius:4px;z-index:9999;pointer-events:none;';
      badge.textContent = '⚡ Offline Mode';
      document.body.appendChild(badge);
    }
  } else {
    if (badge) badge.remove();
  }
}

function toggleOfflineMode() {
  offlineModeEnabled = !offlineModeEnabled;
  localStorage.setItem('sc-offline-mode', offlineModeEnabled ? '1' : '0');
  _applyOfflineModeUI();
  if (typeof showToast === 'function') {
    showToast(offlineModeEnabled
      ? 'Offline Mode ON — AI features disabled, app works from cache'
      : 'Offline Mode OFF — Cloud features re-enabled');
  }
}

// Apply on load
_applyOfflineModeUI();

function _updateOnlineStatus() {
  const dot = document.getElementById('offline-dot');
  const label = document.getElementById('offline-label');
  if (!dot || !label) return;
  const online = navigator.onLine;
  dot.style.background = online ? '#4ade80' : '#ffaa00';
  label.textContent = online ? 'Synced' : 'Offline';
  label.style.color = online ? '#4ade80' : '#ffaa00';
}

window.addEventListener('online',  _updateOnlineStatus);
window.addEventListener('offline', _updateOnlineStatus);

// ════════════════════════════════════════════════════
// PATCH EXISTING FUNCTIONS
// ════════════════════════════════════════════════════

// Patch updatePropertiesPanel to also update gain helper and sound coverage
const _origUPP = window.updatePropertiesPanel;
if (typeof _origUPP === 'function') {
  window.updatePropertiesPanel = function() {
    _origUPP.apply(this, arguments);
    const el = typeof state !== 'undefined'
      ? state.elements.find(e => e.id === state.selectedId)
      : null;
    updateGainHelper(el || null);
    _injectSoundCoverageUI();
  };
}

// Patch renderElements to re-render overlays and apply layers
const _origRE = window.renderElements;
if (typeof _origRE === 'function') {
  window.renderElements = function() {
    _origRE.apply(this, arguments);
    renderPACoverage();
    applyLayers();
    _msRefreshVisuals();
    updateConflictBanner();
  };
}

// Patch handleDrop to run auto-wire + learn behavior after drop
const _origHD = window.handleDrop;
if (typeof _origHD === 'function') {
  window.handleDrop = function() {
    const prevCount = state.elements.length;
    _origHD.apply(this, arguments);
    if (autoWireEnabled) setTimeout(runAutoWire, 150);
    if (state.elements.length > prevCount) {
      const newEl = state.elements[state.elements.length - 1];
      if (newEl && newEl.name && typeof smLearnElement === 'function') smLearnElement(newEl.name);
    }
  };
}

// Patch switchView to init features when views are shown
const _origSV = window.switchView;
if (typeof _origSV === 'function') {
  window.switchView = function(view) {
    _origSV.apply(this, [view]);
    // Assistant view needs display:flex for column layout
    if (view === 'Assistant') {
      const assistantView = document.getElementById('view-Assistant');
      if (assistantView) assistantView.style.display = 'flex';
      // If a stream was in-flight when the user left, unlock the send button
      if (smStreaming) {
        smStreaming = false;
        const sendBtn = document.getElementById('sm-send-btn');
        if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
      }
      _smRender();
      setTimeout(_smScrollBottom, 50);
      // Refresh badge and issue banner when landing on AI view
      setTimeout(smQuickBadge, 50);
    }
    updateConflictBanner();
  };
}

// ════════════════════════════════════════════════════
// 10. STAGEMIND INTELLIGENCE — Three-engine analysis
// ════════════════════════════════════════════════════

// ── Sub-tab switcher ─────────────────────────────
function smSwitchTab(tab) {
  const chatTab   = document.getElementById('sm-tab-chat');
  const intelTab  = document.getElementById('sm-tab-intel');
  const messages  = document.getElementById('sm-messages');
  const intelPanel = document.getElementById('sm-intel-panel');
  const inputArea = document.getElementById('sm-input-area');
  if (!chatTab || !intelTab || !messages || !intelPanel) return;

  if (tab === 'chat') {
    chatTab.classList.add('active');
    intelTab.classList.remove('active');
    messages.style.display  = '';
    intelPanel.style.display = 'none';
    if (inputArea) inputArea.style.display = '';
  } else {
    intelTab.classList.add('active');
    chatTab.classList.remove('active');
    messages.style.display  = 'none';
    intelPanel.style.display = 'flex';
    intelPanel.style.flexDirection = 'column';
    if (inputArea) inputArea.style.display = 'none';
    smRunAnalysis();
  }
}

// ── Badge on Intelligence tab ─────────────────────
function smUpdateBadge(count) {
  const badge = document.getElementById('sm-intel-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

// ── Behavior learning (Predictive Setup) ─────────
const SM_BEHAVIOR_KEY = 'sm_behavior';
function _smGetBehavior() {
  try { return JSON.parse(localStorage.getItem(SM_BEHAVIOR_KEY) || '{}'); } catch { return {}; }
}
function _smSaveBehavior(b) {
  try { localStorage.setItem(SM_BEHAVIOR_KEY, JSON.stringify(b)); } catch {}
}

function smLearnElement(elementName) {
  const b = _smGetBehavior();
  if (!b.counts)    b.counts    = {};
  if (!b.sequences) b.sequences = {};
  b.counts[elementName] = (b.counts[elementName] || 0) + 1;
  if (b.lastAdded && b.lastAdded !== elementName) {
    const key = b.lastAdded;
    if (!b.sequences[key]) b.sequences[key] = {};
    b.sequences[key][elementName] = (b.sequences[key][elementName] || 0) + 1;
  }
  b.lastAdded = elementName;
  _smSaveBehavior(b);
}

// ── Engine 1: Auto Optimization ──────────────────
function smAnalyzeLayout() {
  if (!state.smAutoOptEnabled) return [];
  const els = state.elements;
  if (!els.length) return [];
  const issues = [];
  const total = els.length;

  // Canvas dims — best-effort, only used for balance/off-canvas (not overlap/cluster)
  const canvasW = (state.canvasW > 0 ? state.canvasW : 0)
    || (window.innerWidth > 0 ? window.innerWidth : 800);
  const canvasH = (state.canvasH > 0 ? state.canvasH : 0)
    || (window.innerHeight > 0 ? window.innerHeight : 600);

  // ── 1. Direct overlap — absolute px, no canvas size needed ──────────────
  // Two elements are overlapping if their centres are < 50px apart in x AND y
  const OVERLAP_ABS = 50;
  const overlappingPairs = [];
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      if (Math.abs(els[i].x - els[j].x) < OVERLAP_ABS &&
          Math.abs(els[i].y - els[j].y) < OVERLAP_ABS) {
        overlappingPairs.push([els[i], els[j]]);
      }
    }
  }
  if (overlappingPairs.length) {
    issues.push({
      severity: overlappingPairs.length >= 3 ? 'critical' : 'warning',
      title:    `${overlappingPairs.length} overlapping element${overlappingPairs.length > 1 ? 's' : ''}`,
      desc:     overlappingPairs.slice(0, 2).map(([a, b]) => `${a.label} & ${b.label}`).join(' · ')
                  + (overlappingPairs.length > 2 ? ` and ${overlappingPairs.length - 2} more` : '')
                  + ' — elements are stacked. Drag them to their real stage positions.',
      action:   null,
    });
  }

  // ── 2. Clustered — all elements packed in a small absolute area ─────────
  // 120px spread across all elements = clearly all at center (common after tapping Add)
  if (total >= 2 && !overlappingPairs.length) {
    const xs = els.map(e => e.x), ys = els.map(e => e.y);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    if (spreadX < 130 && spreadY < 130) {
      issues.push({
        severity: 'warning',
        title:    `All ${total} elements clustered in one spot`,
        desc:     'Elements are tightly packed together. Drag each element to its actual stage position to build a useful stage plot.',
        action:   null,
      });
    }
  }

  // ── 3. Repeated element type — catches "spammed mics" ──────────────────
  const nameCounts = {};
  els.forEach(e => {
    const key = (e.name || '').trim();
    if (key) nameCounts[key] = (nameCounts[key] || 0) + 1;
  });
  const repeated = Object.entries(nameCounts).filter(([, n]) => n >= 3);
  if (repeated.length) {
    repeated.forEach(([name, count]) => {
      issues.push({
        severity: 'info',
        title:    `${count}× ${name} on stage`,
        desc:     `You have ${count} "${name}" elements. Check they are all needed — each should represent a distinct real-world input and have a unique channel assignment.`,
        action:   null,
      });
    });
  }

  // ── 4. Stage balance (L/R) ──────────────────────────────────────────────
  if (total >= 2 && canvasW > 0) {
    const midX = canvasW / 2;
    const leftCount  = els.filter(e => e.x < midX).length;
    const rightCount = els.filter(e => e.x >= midX).length;
    if (Math.abs(leftCount - rightCount) / total > 0.7) {
      issues.push({
        severity: 'warning',
        title:    'Stage imbalance',
        desc:     `${leftCount} element${leftCount !== 1 ? 's' : ''} stage-left vs ${rightCount} stage-right. Spread elements more evenly across the stage.`,
        action:   null,
      });
    }
  }

  // ── 5. Drums off-center ─────────────────────────────────────────────────
  const drumsEl = els.find(e => e.name && /drum/i.test(e.name));
  if (drumsEl && canvasW > 0) {
    const ctr = canvasW / 2;
    if (Math.abs(drumsEl.x - ctr) > canvasW * 0.25) {
      issues.push({
        severity: 'info',
        title:    'Drums off-center',
        desc:     'Drums are typically center stage for balanced monitoring and symmetry.',
        action: { label: 'Center Drums', fn() {
          drumsEl.x = canvasW / 2;
          if (typeof renderElements === 'function') renderElements();
          if (typeof renderConnections === 'function') renderConnections();
          if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
          smRunAnalysis();
        }},
      });
    }
  }

  // ── 6. No output elements ───────────────────────────────────────────────
  const hasOutput = els.some(e => /foh|pa speaker|main speaker|monitor|wedge|iem/i.test(e.name || ''));
  const hasInput  = els.some(e => /mic|drum|guitar|bass|key|piano|vocal/i.test(e.name || ''));
  if (hasInput && !hasOutput && els.length >= 2) {
    issues.push({
      severity: 'info',
      title:    'No output elements on stage',
      desc:     'Stage has inputs but no monitors or FOH speakers. Add floor monitors, IEMs, or FOH speakers.',
      action:   null,
    });
  }

  // ── 7. Crowded stage ────────────────────────────────────────────────────
  if (total >= 10) {
    issues.push({
      severity: 'info',
      title:    `${total} elements — stage getting busy`,
      desc:     'Large number of elements. Verify each is needed and spread them out for a clean, readable plot.',
      action:   null,
    });
  }

  // ── 8. Off-canvas elements ──────────────────────────────────────────────
  if (canvasW > 0 && canvasH > 0) {
    const offStage = els.filter(e => e.x < -30 || e.x > canvasW + 30 || e.y < -30 || e.y > canvasH + 30);
    if (offStage.length) {
      issues.push({
        severity: 'warning',
        title:    `${offStage.length} element${offStage.length > 1 ? 's' : ''} off-canvas`,
        desc:     offStage.slice(0, 2).map(e => e.label || e.name).join(', ') + ' — off-screen elements won\'t appear on PDF exports.',
        action:   null,
      });
    }
  }

  return issues;
}

// ── Engine 2: Conflict + Suggestions ─────────────
function smAnalyzeConflicts() {
  if (!state.smConflictEnabled) return [];
  const els  = state.elements;
  const issues = [];

  if (!els.length) {
    issues.push({
      severity: 'info',
      title:    'Empty stage',
      desc:     'Add instruments, microphones, and monitors from the library to get started.',
      action:   null,
    });
    return issues;
  }

  // Duplicate channel IDs
  const channelMap = {};
  els.forEach(e => {
    if (e.channelId) {
      channelMap[e.channelId] = channelMap[e.channelId] || [];
      channelMap[e.channelId].push(e.label || e.name);
    }
    (e.roles || []).forEach(r => {
      if (r.channelId) {
        channelMap[r.channelId] = channelMap[r.channelId] || [];
        channelMap[r.channelId].push((e.label || e.name) + ' (' + (r.type || 'role') + ')');
      }
    });
  });
  const dupes = Object.entries(channelMap).filter(([, names]) => names.length > 1);
  if (dupes.length) {
    issues.push({
      severity: 'critical',
      title:    `${dupes.length} duplicate channel assignment${dupes.length > 1 ? 's' : ''}`,
      desc:     dupes.slice(0,3).map(([ch, names]) => `${ch}: ${names.join(', ')}`).join(' · ')
                  + (dupes.length > 3 ? ` +${dupes.length - 3} more` : ''),
      action: { label: 'Auto-fix', fn: smAutoFixChannels },
    });
  }

  // Elements without a channel ID
  const noChannel = els.filter(e => !e.channelId);
  if (noChannel.length) {
    issues.push({
      severity: 'info',
      title:    `${noChannel.length} element${noChannel.length > 1 ? 's' : ''} with no channel assigned`,
      desc:     noChannel.slice(0,3).map(e => e.label || e.name).join(', ')
                  + (noChannel.length > 3 ? ` +${noChannel.length - 3} more` : ''),
      action:   null,
    });
  }

  // Unconnected mic/DI inputs
  const connected = new Set([
    ...state.connections.map(c => c.from),
    ...state.connections.map(c => c.to),
  ]);
  const unconnected = els.filter(e =>
    !connected.has(e.id) &&
    (e.type === 'Microphone' || /\bmic\b|di box|direct input/i.test(e.name || ''))
  );
  if (unconnected.length) {
    issues.push({
      severity: 'warning',
      title:    `${unconnected.length} unconnected input${unconnected.length > 1 ? 's' : ''}`,
      desc:     unconnected.slice(0,3).map(e => e.label || e.name).join(', ')
                  + ' — connect to FOH or a snake for complete signal routing.',
      action:   null,
    });
  }

  // Elements with phantom set but type that doesn't need it
  const phantomPassiveRibbon = els.filter(e => e.phantom && /ribbon/i.test(e.name || ''));
  if (phantomPassiveRibbon.length) {
    issues.push({
      severity: 'critical',
      title:    'Phantom power on ribbon mic!',
      desc:     phantomPassiveRibbon.map(e => e.label || e.name).join(', ')
                  + ' — phantom power can destroy passive ribbon elements. Disable phantom on these channels.',
      action:   null,
    });
  }

  // Wireless mics with no RF coordination noted
  const wirelessEls = els.filter(e => /wireless|iem|in.ear|radio mic/i.test(e.name || ''));
  if (wirelessEls.length >= 3) {
    issues.push({
      severity: 'info',
      title:    `${wirelessEls.length} wireless systems — coordinate RF`,
      desc:     'Multiple wireless systems detected. Ensure all transmitters are frequency-coordinated to avoid intermodulation.',
      action:   null,
    });
  }

  return issues;
}

// ── Engine 2 helper: Auto-fix duplicate channels ─
function smAutoFixChannels() {
  let next = 1;
  const used = new Set();
  state.elements.forEach(el => {
    function assignNext() {
      while (used.has('CH-' + String(next).padStart(2,'0'))) next++;
      const id = 'CH-' + String(next).padStart(2,'0');
      used.add(id);
      next++;
      return id;
    }
    el.channelId = assignNext();
    (el.roles || []).forEach(r => { r.channelId = assignNext(); });
  });
  if (typeof renderAll === 'function') renderAll();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
  if (typeof updateConflictBanner === 'function') updateConflictBanner();
  smRunAnalysis();
  if (typeof showToast === 'function') showToast('Channels re-assigned');
}

// ── Engine 3: Predictive Setup ────────────────────
const SMI_RULES = {
  'Acoustic Drums':     ['Vocal Mic', 'Guitar Amp', 'Bass Amp', 'Floor Monitor'],
  'Electric Guitar':    ['Guitar Amp', 'DI Box', 'Floor Monitor'],
  'Bass Guitar':        ['Bass Amp', 'DI Box'],
  'Keyboard':           ['DI Box', 'Floor Monitor', 'IEM Transmitter'],
  'Vocal Mic':          ['Floor Monitor', 'IEM Transmitter'],
  'Guitar Amp':         ['Vocal Mic', 'DI Box'],
  'Acoustic Guitar':    ['DI Box', 'Floor Monitor'],
  'DJ Setup':           ['DI Box', 'FOH Speakers'],
  'Piano':              ['DI Box', 'Floor Monitor'],
  'Violin':             ['Pickup DI', 'Floor Monitor'],
  'FOH Speakers':       ['Subwoofer', 'Amplifier'],
  'Floor Monitor':      ['IEM Transmitter', 'Amplifier'],
};

function smGetPredictions() {
  if (!state.smPredictEnabled) return [];
  const els = state.elements;
  if (!els.length) return [];

  const currentNames = new Set(els.map(e => e.name));
  const lastEl = els[els.length - 1];
  const suggestions = [];

  // Rule-based
  if (lastEl && SMI_RULES[lastEl.name]) {
    SMI_RULES[lastEl.name].forEach(suggested => {
      if (!currentNames.has(suggested)) {
        suggestions.push({ name: suggested, reason: `Often paired with ${lastEl.label || lastEl.name}`, type: 'rule' });
      }
    });
  }

  // Behavior-based (learned from usage)
  const b = _smGetBehavior();
  if (b.sequences && lastEl) {
    const afterLast = b.sequences[lastEl.name] || {};
    Object.entries(afterLast)
      .sort(([,a],[,bb]) => bb - a)
      .slice(0, 2)
      .forEach(([name, count]) => {
        if (!currentNames.has(name) && !suggestions.find(s => s.name === name)) {
          suggestions.push({ name, reason: `You usually add this after ${lastEl.name} (${count}×)`, type: 'learned' });
        }
      });
  }

  // Generic: missing FOH if there are many inputs
  const hasFOH = els.some(e => /foh|pa speaker|main speaker/i.test(e.name || ''));
  if (!hasFOH && els.length >= 4 && !suggestions.find(s => /foh|speaker/i.test(s.name))) {
    suggestions.push({ name: 'FOH Speakers', reason: 'Add front-of-house output for a complete signal chain', type: 'rule' });
  }

  return suggestions.slice(0, 4);
}

// ── Main analysis runner ──────────────────────────
function smRunAnalysis() {
  const results = document.getElementById('sm-intel-results');
  if (!results) return;

  // Visual feedback: briefly dim the button
  const analyzeBtn = document.querySelector('#sm-intel-panel button');
  if (analyzeBtn) {
    analyzeBtn.textContent = '⏳ Scanning…';
    analyzeBtn.style.opacity = '0.55';
    analyzeBtn.style.pointerEvents = 'none';
    setTimeout(() => {
      analyzeBtn.innerHTML = DOMPurify.sanitize('⚡ Analyze Stage');
      analyzeBtn.style.opacity = '';
      analyzeBtn.style.pointerEvents = '';
    }, 700);
  }

  try {
    const els = (state && state.elements) || [];
    const now = new Date();
    const ts = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

    // ── Empty stage ───────────────────────────────────────────
    if (!els.length) {
      results.innerHTML = DOMPurify.sanitize(`
        <div style="padding:0 0 12px;">
          <p style="font-family:'Manrope',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#2a2a2a;margin:0 0 10px;">No elements on stage</p>
          <p style="font-family:'Inter';font-size:11px;color:#484847;line-height:1.6;margin:0 0 10px;">Drag microphones, instruments, and audio gear onto the canvas, then run Analyze Stage again to get a full report.</p>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${_smiHintRow('mic','Start with mics — drag from the MICS category in the sidebar.')}
            ${_smiHintRow('piano','Add instruments in their real stage positions.')}
            ${_smiHintRow('volume_up','Add monitors and PA to complete your rider.')}
          </div>
        </div>
        <p style="font-family:'Manrope',sans-serif;font-size:9px;color:#2a2a2a;text-align:right;margin-top:12px;letter-spacing:0.05em;">Scanned at ${ts}</p>`);
      smUpdateBadge(0);
      return;
    }

    // ── Run engines ───────────────────────────────────────────
    const layoutIssues   = (state.smAutoOptEnabled   !== false) ? smAnalyzeLayout()    : [];
    const conflictIssues = (state.smConflictEnabled  !== false) ? smAnalyzeConflicts() : [];
    const predictions    = (state.smPredictEnabled   !== false) ? smGetPredictions()   : [];

    const allIssues = [...layoutIssues, ...conflictIssues];
    const warnings  = allIssues.filter(i => i.severity === 'warning' || i.severity === 'critical');
    const totalWarnings = warnings.length;
    smUpdateBadge(totalWarnings);

    // ── Build element breakdown ───────────────────────────────
    const typeCounts = {};
    els.forEach(e => {
      const k = e.type || e.name || 'Other';
      typeCounts[k] = (typeCounts[k] || 0) + 1;
    });
    const typeList = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, n]) => `${n}× ${k}`)
      .join(' &nbsp;·&nbsp; ');

    // ── Score color ───────────────────────────────────────────
    const scoreColor = totalWarnings === 0 ? '#4caf7d' : totalWarnings <= 2 ? '#ffaa00' : '#ff716c';
    const scoreLabel = totalWarnings === 0 ? 'All clear' : totalWarnings === 1 ? '1 issue found' : `${totalWarnings} issues found`;

    let html = '';

    // Summary card
    html += `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(72,72,71,0.18);padding:10px 12px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-family:'Manrope',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#484847;">Scan complete · ${els.length} element${els.length !== 1 ? 's' : ''}</span>
        <span style="font-family:'Manrope',sans-serif;font-size:9px;font-weight:700;color:${scoreColor};">${scoreLabel}</span>
      </div>
      <p style="font-family:'Inter';font-size:10px;color:#2a2a2a;margin:0;line-height:1.5;">${typeList}</p>
    </div>`;

    // ── Layout findings ───────────────────────────────────────
    html += '<div class="smi-section"><p class="smi-section-title">Layout</p>';
    if (!layoutIssues.length) {
      // Generate specific positive observations
      const obs = _smLayoutObservations(els);
      if (obs.length) {
        obs.forEach(o => { html += `<div class="smi-ok-state"><span class="smi-ok-icon material-symbols-outlined">check_circle</span><span class="smi-ok-text">${o}</span></div>`; });
      } else {
        html += `<div class="smi-ok-state"><span class="smi-ok-icon material-symbols-outlined">check_circle</span><span class="smi-ok-text">No layout problems detected</span></div>`;
      }
    } else {
      layoutIssues.forEach(issue => { html += _smiItemHtml(issue); });
    }
    html += '</div>';

    // ── Conflict findings ─────────────────────────────────────
    html += '<div class="smi-section"><p class="smi-section-title">Channel Conflicts</p>';
    if (!conflictIssues.length) {
      const chCount = els.filter(e => e.channelId || e.chid).length;
      html += `<div class="smi-ok-state"><span class="smi-ok-icon material-symbols-outlined">check_circle</span><span class="smi-ok-text">${chCount} channel${chCount !== 1 ? 's' : ''} assigned — no conflicts</span></div>`;
    } else {
      conflictIssues.forEach(issue => { html += _smiItemHtml(issue); });
    }
    html += '</div>';

    // ── Suggestions ───────────────────────────────────────────
    if (predictions.length) {
      html += '<div class="smi-section"><p class="smi-section-title">Suggested Next Elements</p>';
      predictions.forEach((p, i) => {
        const typeIcon = p.type === 'learned' ? '🧠' : '💡';
        html += `<div class="smi-predict-item" id="smi-pred-${i}" style="display:flex;align-items:center;"><span style="font-size:14px;flex-shrink:0;">${typeIcon}</span><div style="flex:1;min-width:0;"><div class="smi-predict-name">${p.name}</div><div class="smi-predict-reason">${p.reason}</div></div><button onclick="document.getElementById('smi-pred-${i}').remove()" style="background:none;border:none;cursor:pointer;color:#484847;font-size:15px;line-height:1;padding:2px 4px;flex-shrink:0;transition:color .12s;" onmouseover="this.style.color='#9a9a9a'" onmouseout="this.style.color='#484847'" title="Dismiss">×</button></div>`;
      });
      html += '</div>';
    }

    // Timestamp
    html += `<p style="font-family:'Manrope',sans-serif;font-size:9px;color:#2a2a2a;text-align:right;margin-top:10px;letter-spacing:0.05em;">Scanned at ${ts}</p>`;

    results.innerHTML = DOMPurify.sanitize(html);

    // Attach action button handlers
    results.querySelectorAll('[data-smi-action]').forEach((btn, idx) => {
      const allActions = allIssues.map(i => i.action).filter(Boolean);
      if (allActions[idx]) btn.addEventListener('click', allActions[idx].fn);
    });

  } catch(err) {
    console.error('[StageMind]', err);
    results.innerHTML = DOMPurify.sanitize(`<div style="padding:16px 0;"><p style="font-family:'Inter';font-size:12px;color:#ff716c;margin:0 0 6px;">Analysis error</p><p style="font-family:'Inter';font-size:11px;color:#484847;margin:0;">${err.message}</p></div>`);
  }
}

// Positive layout observations for a clean stage
function _smLayoutObservations(els) {
  const obs = [];
  if (!els.length) return obs;

  const canvasW = (state && state.canvasW) || 800;
  const canvasH = (state && state.canvasH) || 600;

  // Balance check
  const midX = canvasW / 2;
  const left  = els.filter(e => e.x < midX).length;
  const right = els.filter(e => e.x >= midX).length;
  const total = els.length;
  if (total >= 2 && Math.abs(left - right) / total <= 0.4) {
    obs.push('Stage balance looks even — elements spread across both sides');
  }

  // Spread check
  if (total >= 2) {
    const xs = els.map(e => e.x), ys = els.map(e => e.y);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    if (spreadX >= 130 || spreadY >= 130) {
      obs.push(`Elements well spaced — ${Math.round(spreadX)}px × ${Math.round(spreadY)}px spread`);
    }
  }

  // All elements on canvas
  const offCanvas = els.filter(e => e.x < 0 || e.y < 0 || e.x > canvasW + 80 || e.y > canvasH + 80);
  if (!offCanvas.length) obs.push('All elements are within the stage boundary');

  // Mic coverage
  const mics = els.filter(e => /mic|microphone/i.test(e.type || e.name || ''));
  if (mics.length >= 1) obs.push(`${mics.length} mic${mics.length !== 1 ? 's' : ''} detected — check positions match front-of-stage stands`);

  return obs.slice(0, 3);
}

function _smiHintRow(icon, text) {
  return `<div style="display:flex;align-items:center;gap:8px;">
    <span class="material-symbols-outlined" style="font-size:14px;color:#2a2a2a;flex-shrink:0;">${icon}</span>
    <span style="font-family:'Inter';font-size:10px;color:#484847;line-height:1.4;">${text}</span>
  </div>`;
}

function _smiItemHtml(issue) {
  const actionBtn = issue.action
    ? `<button class="smi-action-btn" data-smi-action="1">${issue.action.label}</button>`
    : '';
  return `<div class="smi-item">
    <span class="smi-badge ${issue.severity}">${issue.severity === 'critical' ? '!' : issue.severity === 'warning' ? '⚠' : 'i'}</span>
    <div class="smi-item-body">
      <p class="smi-item-title">${issue.title}</p>
      <p class="smi-item-desc">${issue.desc}</p>
    </div>
    ${actionBtn}
  </div>`;
}

// ── Live badge: updates AI nav button + Intel sub-tab badge after any element change ──
function smQuickBadge() {
  if (!state.smIntelligenceEnabled) { smUpdateBadge(0); _smUpdateNavBadge(0); return; }
  try {
    const layout   = smAnalyzeLayout();
    const conflict = smAnalyzeConflicts();
    const total    = [...layout, ...conflict].filter(i => i.severity !== 'info').length;
    const info     = [...layout, ...conflict].length;
    smUpdateBadge(total);
    _smUpdateNavBadge(total || info);
    // Re-render intel panel if it's already open
    const intelPanel = document.getElementById('sm-intel-panel');
    if (intelPanel && intelPanel.style.display !== 'none') smRunAnalysis();
    // Show/update the issue prompt banner inside chat view
    _smUpdateIssueBanner(layout, conflict);
  } catch(e) { /* silent — never block element add */ }
}

function _smUpdateNavBadge(count) {
  const aiBtn = document.querySelector('#mobile-nav-bar [data-view="Assistant"]');
  if (!aiBtn) return;
  const badge = aiBtn.querySelector('.sm-nav-badge');
  if (badge) badge.remove();
}

function _smUpdateIssueBanner(layoutIssues, conflictIssues) {
  const msgs = document.getElementById('sm-messages');
  if (!msgs) return;
  const all     = [...layoutIssues, ...conflictIssues];
  const warns   = all.filter(i => i.severity === 'warning' || i.severity === 'critical');
  let banner    = document.getElementById('sm-issue-banner');
  if (!all.length) { if (banner) banner.remove(); return; }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'sm-issue-banner';
    Object.assign(banner.style, {
      margin:'0 0 12px', padding:'10px 14px', background:'rgba(255,113,108,0.08)',
      border:'1px solid rgba(255,113,108,0.25)', cursor:'pointer', userSelect:'none',
    });
    banner.onclick = () => smSwitchTab('intel');
    msgs.parentNode.insertBefore(banner, msgs);
  }
  const icon  = warns.length ? '⚠️' : 'ℹ️';
  const label = warns.length
    ? `${warns.length} issue${warns.length > 1 ? 's' : ''} detected on stage`
    : `${all.length} suggestion${all.length > 1 ? 's' : ''} available`;
  banner.innerHTML = DOMPurify.sanitize(`<span style="font-family:'Manrope',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${warns.length ? '#ff716c' : '#7aafff'};">${icon} ${label}</span><span style="font-family:'Inter';font-size:10px;color:#484847;margin-left:6px;">Tap to review →</span>`);
}

// ── Hook: Learn from addItemToStage ──────────────
const _origAddItemToStage = window.addItemToStage;
if (typeof _origAddItemToStage === 'function') {
  window.addItemToStage = function(item) {
    _origAddItemToStage.apply(this, arguments);
    smLearnElement(item.name);
    setTimeout(smQuickBadge, 80); // slight delay so state.elements is updated
  };
}

// ════════════════════════════════════════════════════
// 11. PROFESSIONAL TOOLS
//   Context Menu · Lock · AutoChannel · Zones
//   Cable Estimator · Measure · Zoom-to-Fit · Signal Chain
// ════════════════════════════════════════════════════


// ─── A. CONTEXT MENU + LOCK ────────────────────────
(function _initContextMenu() {
  const menu = document.createElement('div');
  menu.id = 'sc-ctx';
  menu.style.display = 'none';
  document.body.appendChild(menu);

  function _item(label, fn, danger) {
    const d = document.createElement('div');
    d.className = 'ctx-r' + (danger ? ' ctx-dn' : '');
    d.textContent = label;
    d.onclick = () => { _hide(); fn(); };
    return d;
  }
  function _sep() { const d = document.createElement('div'); d.className = 'ctx-sep'; return d; }

  function _show(x, y, el) {
    menu.innerHTML = '';
    if (!el) return;
    menu.appendChild(_item('Duplicate', () => scDuplicateEl(el)));
    menu.appendChild(_item('Add Mic Nearby', () => scAddMicNear(el)));
    menu.appendChild(_item('Assign Channel\u2026', () => scAssignChannel(el)));
    menu.appendChild(_sep());
    menu.appendChild(_item(el.locked ? 'Unlock' : 'Lock', () => scToggleLock(el)));
    menu.style.display = '';
    if (typeof _injectCtxExtras === 'function') _injectCtxExtras(el);
    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = menu.offsetWidth || 170, mh = menu.offsetHeight || 200;
    menu.style.left = Math.min(x, vw - mw - 8) + 'px';
    menu.style.top  = (y + mh > vh ? Math.max(0, y - mh) : y) + 'px';
  }
  function _hide() { menu.style.display = 'none'; }

  function _haptic() {
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function _findEl(target) {
    const wrap = target.closest('.stage-element');
    if (!wrap) return null;
    const id = wrap.id.replace('elem-', '');
    return state.elements.find(el => String(el.id) === id) || null;
  }

  setTimeout(() => {
    const canvas = document.getElementById('stage-canvas');
    if (!canvas) return;

    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      const el = _findEl(e.target);
      if (el) { _haptic(); _show(e.clientX, e.clientY, el); }
    });

    let _lpTimer = null;
    let _lpTouch = null;
    let _lpMoved = false;
    const LP_DELAY = 420;
    const LP_MOVE_THRESH = 10;

    canvas.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      _lpMoved = false;
      const t = e.touches[0];
      _lpTouch = { x: t.clientX, y: t.clientY, target: e.target };
      _lpTimer = setTimeout(() => {
        if (_lpMoved) return;
        const el = _findEl(_lpTouch.target);
        if (el) {
          e.preventDefault();
          _haptic();
          _show(_lpTouch.x, _lpTouch.y, el);
        }
        _lpTimer = null;
      }, LP_DELAY);
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      if (!_lpTimer || !_lpTouch) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - _lpTouch.x) > LP_MOVE_THRESH || Math.abs(t.clientY - _lpTouch.y) > LP_MOVE_THRESH) {
        _lpMoved = true;
        clearTimeout(_lpTimer);
        _lpTimer = null;
      }
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
      _lpTouch = null;
    }, { passive: true });

    canvas.addEventListener('touchcancel', () => {
      if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
      _lpTouch = null;
    }, { passive: true });
  }, 300);

  document.addEventListener('pointerdown', e => { if (!e.target.closest('#sc-ctx')) _hide(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _hide(); });

  document.addEventListener('pointerdown', e => {
    const wrap = e.target.closest('.stage-element');
    if (!wrap) return;
    const id = wrap.id.replace('elem-', '');
    const el = state.elements.find(s => String(s.id) === id);
    if (el && el.locked) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  document.addEventListener('dblclick', e => {
    const wrap = e.target.closest('.stage-element');
    if (!wrap) return;
    const id = wrap.id.replace('elem-', '');
    const el = state.elements.find(s => String(s.id) === id);
    if (el && el.locked) { e.stopPropagation(); scToggleLock(el); }
  }, true);
})();

function scDuplicateEl(el) {
  if (typeof pushHistory === 'function') pushHistory();
  const copy = JSON.parse(JSON.stringify(el));
  copy.id = Date.now(); copy.x += 30; copy.y += 30; delete copy.locked;
  state.elements.push(copy);
  if (typeof renderElements === 'function') renderElements();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
}

// ── Mic types offered in the picker ──────────────────────────────────────────
const SC_MIC_TYPES = [
  { name: 'SM58',      type: 'Dynamic Mic',     icon: 'mic',          label: 'VOCAL MIC',  color: '#ff7439', phantom: false },
  { name: 'Condenser', type: 'Condenser Mic',   icon: 'mic-2',        label: 'CONDENSER',  color: '#7aafff', phantom: true  },
  { name: 'Amp Mic',   type: 'Instrument Mic',  icon: 'mic',          label: 'AMP MIC',    color: '#c5ffc9', phantom: false },
  { name: 'Wireless',  type: 'Wireless Mic',    icon: 'cx-wireless',  label: 'WIRELESS',   color: '#ff7439', phantom: false },
  { name: 'Boundary',  type: 'PZM Mic',         icon: 'cx-boundary',  label: 'BOUNDARY',   color: '#ffd700', phantom: true  },
  { name: 'Drum Clip', type: 'Instrument Clip', icon: 'cx-drum-clip', label: 'DRUM CLIP',  color: '#c5ffc9', phantom: false },
];

function scAddMicNear(el) {
  // Show picker dialog
  const overlay = document.createElement('div');
  overlay.className = 'sc-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'sc-dialog';

  dialog.innerHTML = DOMPurify.sanitize(`
    <div class="sc-dialog-hd">
      <div>
        <div class="sc-dialog-title">Add Mic Nearby</div>
        <div class="sc-dialog-sub">For: ${el.label || el.name || 'Element'}</div>
      </div>
      <button class="sc-dialog-close">×</button>
    </div>
    <div class="sc-dialog-body">
      <div class="sc-mic-grid">
        ${SC_MIC_TYPES.map((m, i) => `
          <button class="sc-mic-opt" data-mic-idx="${i}">
            <span class="sc-mic-opt-icon">${typeof iconHtml === 'function' ? iconHtml(m.icon, 28) : m.icon}</span>
            <span class="sc-mic-opt-name">${m.name}</span>
            <span class="sc-mic-opt-type">${m.type}</span>
          </button>`).join('')}
      </div>
    </div>`);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  function close() { document.body.removeChild(overlay); }

  dialog.querySelector('.sc-dialog-close').onclick = close;
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  dialog.querySelectorAll('.sc-mic-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const mic = SC_MIC_TYPES[+btn.dataset.micIdx];
      close();
      if (typeof pushHistory === 'function') pushHistory();
      const cw = state.canvasW || 800;
      const usedNums = (state.elements || [])
        .map(e => e.channelId || e.chid || '')
        .map(c => { const m = c.match(/^CH-?(\d+)$/i); return m ? parseInt(m[1], 10) : 0; });
      const nextNum = Math.max(0, ...usedNums) + 1;
      state.elements.push({
        id: 'el-' + (state.nextId ? state.nextId++ : Date.now()),
        name: mic.name, label: mic.label, icon: mic.icon,
        type: mic.type, x: Math.min(cw - 40, el.x + 64), y: el.y,
        rotation: 0, scale: el.scale || 100,
        channelId: 'CH-' + String(nextNum).padStart(2, '0'),
        source: 'SL01', output: 'FOH', phantom: mic.phantom,
        notes: '', color: mic.color, roles: [],
      });
      if (typeof renderElements === 'function') renderElements();
      if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
    });
  });
}

function scAssignChannel(el) {
  const overlay = document.createElement('div');
  overlay.className = 'sc-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'sc-dialog';

  // Map of channelId → element name for all other elements
  const usedMap = {};
  (state.elements || []).forEach(e => {
    if (e.id === el.id) return;
    const ch = (e.channelId || e.chid || '').toUpperCase();
    if (ch) usedMap[ch] = e.label || e.name || ch;
  });
  const curCh = (el.channelId || '').toUpperCase();

  // Build list rows for CH-01 … CH-32
  const rows = Array.from({ length: 32 }, (_, i) => {
    const n = 'CH-' + String(i + 1).padStart(2, '0');
    const isCur = n === curCh;
    const who = usedMap[n];
    return `<div class="sc-ch-row${isCur ? ' sc-ch-cur' : ''}" data-ch="${n}">
      <span class="sc-ch-row-num">${n}</span>
      <span class="sc-ch-row-who${who ? '' : ' free'}">${who ? who : '—'}</span>
      ${who ? `<span class="sc-ch-row-badge">in use</span>` : ''}
      <span class="sc-ch-row-check">${isCur ? '✓' : ''}</span>
    </div>`;
  }).join('');

  dialog.innerHTML = DOMPurify.sanitize(`
    <div class="sc-dialog-hd">
      <div>
        <div class="sc-dialog-title">Assign Channel</div>
        <div class="sc-dialog-sub">${el.label || el.name || 'Element'}</div>
      </div>
      <button class="sc-dialog-close">×</button>
    </div>
    <div class="sc-dialog-body" style="padding-bottom:18px;">
      <div class="sc-ch-list">${rows}</div>
      <div class="sc-ch-sep"></div>
      <div class="sc-ch-custom">
        <label>Custom channel</label>
        <div style="display:flex;gap:6px;">
          <input id="sc-ch-input" type="text" placeholder="e.g. AUX-1" value="${el.channelId || ''}" autocomplete="off" style="flex:1;" />
          <button class="sc-btn sc-btn-primary" id="sc-ch-assign" style="white-space:nowrap;">Assign</button>
        </div>
      </div>
    </div>`);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Scroll current channel into view
  const curRow = dialog.querySelector('.sc-ch-cur');
  if (curRow) curRow.scrollIntoView({ block: 'center' });

  function close() { document.body.removeChild(overlay); }

  function applyChannel(ch) {
    el.channelId = ch;
    if (typeof renderElements === 'function') renderElements();
    if (typeof updateConflictBanner === 'function') updateConflictBanner();
    if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
    close();
  }

  function assignCustom() {
    const val = dialog.querySelector('#sc-ch-input').value.trim();
    if (!val) return;
    const ch = /^CH/i.test(val) ? val.toUpperCase() : 'CH-' + val;
    applyChannel(ch);
  }

  dialog.querySelector('.sc-dialog-close').onclick = close;
  dialog.querySelector('#sc-ch-assign').onclick = assignCustom;
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });
  dialog.querySelector('#sc-ch-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') assignCustom();
    if (e.key === 'Escape') close();
  });

  // Click a list row → assign immediately
  dialog.querySelectorAll('.sc-ch-row').forEach(row => {
    row.addEventListener('click', () => applyChannel(row.dataset.ch));
  });
}

function scToggleLock(el) {
  el.locked = !el.locked;
  if (typeof renderElements === 'function') renderElements();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
  _scToast(el.locked ? 'Element locked' : 'Element unlocked');
}

function scCtxDelete(el) {
  if (typeof pushHistory === 'function') pushHistory();
  state.elements = state.elements.filter(e => e.id !== el.id);
  state.connections = state.connections.filter(c => c.from !== el.id && c.to !== el.id);
  if (typeof renderElements === 'function') renderElements();
  if (typeof renderConnections === 'function') renderConnections();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
}

let _lockBadgeKey = '';
function _applyLockVisuals() {
  const els = state.elements || [];
  const key = els.map(e => `${e.id}:${e.locked ? 1 : 0}`).join(',');
  if (key === _lockBadgeKey) return;
  _lockBadgeKey = key;
  els.forEach(el => {
    const dom = document.getElementById('elem-' + el.id);
    if (!dom) return;
    if (el.locked) {
      dom.classList.add('sc-locked');
      if (!dom.querySelector('.sc-lock-badge')) {
        const b = document.createElement('span');
        b.className = 'sc-lock-badge'; b.textContent = '🔒';
        dom.appendChild(b);
      }
    } else {
      dom.classList.remove('sc-locked');
      const b = dom.querySelector('.sc-lock-badge');
      if (b) b.remove();
    }
  });
}

// ─── B. AUTO CHANNEL NUMBERING ─────────────────────
function scAutoNumberChannels() {
  const priority = name => {
    if (!name) return 99; const n = name.toLowerCase();
    if (/drum|kick|snare|hihat|tom|cymbal/.test(n)) return 1;
    if (/bass guitar|bass amp|bass di/.test(n)) return 2;
    if (/vocal|singer/.test(n)) return 3;
    if (/guitar|gtr/.test(n)) return 4;
    if (/key|piano|synth|organ/.test(n)) return 5;
    if (/\bmic\b/.test(n)) return 6;
    if (/di box|direct/.test(n)) return 7;
    return 10;
  };
  const inputs = state.elements.filter(e => !/speaker|monitor|wedge|iem|foh|pa\b/i.test(e.name || ''));
  inputs.sort((a, b) => priority(a.name) - priority(b.name));
  let ch = 1;
  inputs.forEach(el => { el.channelId = 'CH-' + String(ch++).padStart(2, '0'); });
  if (typeof renderElements === 'function') renderElements();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
  _scToast(`✓ Channels assigned: CH-01 – CH-${String(ch - 1).padStart(2, '0')}`);
}

function _scToast(msg) {
  let t = document.getElementById('sc-toast');
  if (!t) { t = document.createElement('div'); t.id = 'sc-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.transform = 'translateX(-50%) translateY(8px)';
  t.style.opacity = '0';
  void t.offsetWidth;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(-4px)';
  }, 1600);
}

// ─── C. ZOOM TO FIT ────────────────────────────────
function scZoomToFit() {
  if (!state.elements.length) { state.zoom = 1; if (typeof applyZoom === 'function') applyZoom(); return; }
  const xs = state.elements.map(e => e.x), ys = state.elements.map(e => e.y);
  const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 120;
  const cW = state.canvasW || 800, cH = state.canvasH || 500;
  state.zoom = Math.max(0.3, Math.min(2.5, Math.min(cW / spread, cH / spread)));
  if (typeof applyZoom === 'function') applyZoom();
  _scToast('Zoom to fit');
}

// ─── D. STAGE ZONES ────────────────────────────────
let scZonesVisible = false;

function scToggleZones() {
  // Disabled in v3.6.29
}

function _renderZones() {
  const svg = document.getElementById('sc-zones-svg');
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

// Re-render zones on canvas resize so labels and borders stay correctly
// positioned at any viewport size. ResizeObserver fires once on attach,
// so this also covers the initial layout.
(function _wireZonesResize() {
  // Disabled in v3.6.29
})();

function _renderStageLayout() {
  const svg = document.getElementById('stage-layout-svg');
  if (!svg) return;
  // Clear existing content (createElementNS-built nodes — no sanitizer needed)
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const canvasEl = document.getElementById('stage-canvas');
  const W = canvasEl ? canvasEl.clientWidth  : 800;
  const H = canvasEl ? canvasEl.clientHeight : 500;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.removeAttribute('preserveAspectRatio');

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  // 1. Dashed Performance Boundary (8% margin)
  const bX = W * 0.08;
  const bY = H * 0.08;
  const bW = W * 0.84;
  const bH = H * 0.84;

  svg.appendChild(mk('rect', {
    x: bX, y: bY, width: bW, height: bH,
    fill: 'none', stroke: 'var(--stage-layout-stroke)',
    'stroke-width': '1.2', 'stroke-dasharray': '6 6',
    rx: '4', ry: '4'
  }));

  // 2. Center Crosshairs (dashed line)
  const cx = W / 2;
  const cy = H / 2;
  // Vertical center line
  svg.appendChild(mk('line', {
    x1: cx, y1: bY, x2: cx, y2: bY + bH,
    stroke: 'var(--stage-layout-stroke-dim)', 'stroke-width': '0.8',
    'stroke-dasharray': '2 4'
  }));
  // Horizontal center line
  svg.appendChild(mk('line', {
    x1: bX, y1: cy, x2: bX + bW, y2: cy,
    stroke: 'var(--stage-layout-stroke-dim)', 'stroke-width': '0.8',
    'stroke-dasharray': '2 4'
  }));

  // 3. Zone Separators (Vertical dashed lines at 35% and 65% width)
  const sep1X = W * 0.35;
  const sep2X = W * 0.65;
  svg.appendChild(mk('line', {
    x1: sep1X, y1: bY, x2: sep1X, y2: bY + bH,
    stroke: 'var(--stage-layout-stroke-dim)', 'stroke-width': '0.8',
    'stroke-dasharray': '2 4'
  }));
  svg.appendChild(mk('line', {
    x1: sep2X, y1: bY, x2: sep2X, y2: bY + bH,
    stroke: 'var(--stage-layout-stroke-dim)', 'stroke-width': '0.8',
    'stroke-dasharray': '2 4'
  }));

  // 4. Subtle Bare Text Labels (no background pills)
  const labels = [
    { text: 'BACK', x: W * 0.5, y: bY + 14 },
    { text: 'FRONT', x: W * 0.5, y: bY + bH - 14 },
    { text: 'LEFT', x: W * 0.21, y: cy },
    { text: 'CENTER', x: W * 0.5, y: cy - 12 }, // offset slightly from center point
    { text: 'RIGHT', x: W * 0.79, y: cy }
  ];

  labels.forEach(l => {
    const t = mk('text', {
      x: l.x, y: l.y,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': "'Manrope', sans-serif",
      'font-weight': '800', 'font-size': '9px',
      fill: 'var(--stage-layout-label)',
      'letter-spacing': '0.2em',
      style: 'pointer-events: none; user-select: none; transition: fill 0.2s;'
    });
    t.textContent = l.text;
    svg.appendChild(t);
  });
}
window._renderStageLayout = _renderStageLayout;

(function _wireStageLayoutResize() {
  if (typeof ResizeObserver === 'undefined') return;
  const attach = () => {
    const el = document.getElementById('stage-canvas');
    if (!el) { setTimeout(attach, 200); return; }
    let raf = 0;
    new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; _renderStageLayout(); });
    }).observe(el);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();



// ─── E. CABLE LENGTH ESTIMATOR ─────────────────────
let scCableLengthVisible = false;

function scToggleCableLength() {
  scCableLengthVisible = !scCableLengthVisible;
  const btn = document.getElementById('btn-sc-cable');
  if (btn) btn.classList.toggle('active', scCableLengthVisible);
  _renderCableLabels();
  _scToast(scCableLengthVisible ? 'Cable lengths on' : 'Cable lengths off');
}

function _renderCableLabels() {
  const svg = document.getElementById('sc-cable-svg');
  if (!svg) return;
  if (!scCableLengthVisible || !state.connections.length) { if (svg.firstChild) svg.innerHTML = DOMPurify.sanitize(''); return; }
  svg.innerHTML = DOMPurify.sanitize('');
  const canvasW = state.canvasW || 800;
  const mPerPx = 10 / canvasW;

  state.connections.forEach(c => {
    const a = state.elements.find(e => e.id === c.from);
    const b = state.elements.find(e => e.id === c.to);
    if (!a || !b) return;
    const dist = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    const meters = (dist * mPerPx).toFixed(1);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 6;

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const lbl = `~${meters}m`;
    const tw = lbl.length * 4.5 + 6;
    bg.setAttribute('x', mx - tw / 2); bg.setAttribute('y', my - 8);
    bg.setAttribute('width', tw); bg.setAttribute('height', 10);
    bg.setAttribute('rx', '2'); bg.setAttribute('fill', 'rgba(14,14,14,0.75)');
    svg.appendChild(bg);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', mx); txt.setAttribute('y', my);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-family', 'Manrope, sans-serif');
    txt.setAttribute('font-weight', '700');
    txt.setAttribute('font-size', '7');
    txt.setAttribute('fill', '#7aafff');
    txt.setAttribute('letter-spacing', '0.05em');
    txt.textContent = lbl;
    svg.appendChild(txt);
  });
}

// ─── F. MEASUREMENT TOOL ───────────────────────────
const _measure = { active: false, start: null };

function _scMeasureReset(keepSvg) {
  _measure.active = false;
  _measure.start  = null;
  const btn  = document.getElementById('btn-sc-measure');
  const cont = document.getElementById('canvas-container');
  if (btn)  btn.classList.remove('active');
  if (cont) cont.classList.remove('canvas-measure-active');
  if (!keepSvg) {
    const svg = document.getElementById('sc-measure-svg');
    if (svg) svg.innerHTML = DOMPurify.sanitize('');
  }
}

function scActivateMeasure() {
  if (_measure.active) { _scMeasureReset(); _scToast('Measure off'); return; }
  _scMeasureReset();
  // Defer activation by one tick so the button's own click event finishes
  // propagating through the canvas listener before measure mode turns on.
  // This prevents the activating click from being treated as a first point.
  setTimeout(() => {
    _measure.active = true;
    const btn  = document.getElementById('btn-sc-measure');
    const cont = document.getElementById('canvas-container');
    if (btn)  btn.classList.add('active');
    if (cont) cont.classList.add('canvas-measure-active');
    _scToast('Click two points to measure · Esc to cancel');
  }, 0);
}

function _scMeasureClick(e) {
  const svg = document.getElementById('sc-measure-svg');

  // If not active but a completed result is showing, any click clears it
  if (!_measure.active) {
    if (svg && svg.children.length) svg.innerHTML = DOMPurify.sanitize('');
    return;
  }

  const canvas = document.getElementById('stage-canvas');
  if (!canvas || e.target.closest('.stage-element') || e.target.closest('#sc-ctx')) return;

  const rect = canvas.getBoundingClientRect();
  const zoom = state.zoom || 1;
  const px   = (e.clientX - rect.left) / zoom;
  const py   = (e.clientY - rect.top)  / zoom;

  function mkDot(x, y) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y);
    c.setAttribute('r', '3'); c.setAttribute('fill', '#ff7439');
    return c;
  }

  if (!_measure.start) {
    // First point
    _measure.start = { x: px, y: py };
    if (svg) { svg.innerHTML = DOMPurify.sanitize(''); svg.appendChild(mkDot(px, py)); }
  } else {
    // Second point — draw result
    const s    = _measure.start;
    const dist = Math.sqrt((px - s.x) ** 2 + (py - s.y) ** 2);
    const meters = (dist * 10 / (state.canvasW || 800)).toFixed(2);
    if (svg) {
      svg.innerHTML = DOMPurify.sanitize('');
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', s.x); line.setAttribute('y1', s.y);
      line.setAttribute('x2', px);  line.setAttribute('y2', py);
      line.setAttribute('stroke', '#ff7439');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '5,3');
      svg.appendChild(line);
      svg.appendChild(mkDot(s.x, s.y));
      svg.appendChild(mkDot(px, py));
      const mx = (s.x + px) / 2, my = (s.y + py) / 2;
      const lbl = `${meters}m`;
      const tw  = lbl.length * 5 + 10;
      const bg  = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', mx - tw / 2); bg.setAttribute('y', my - 12);
      bg.setAttribute('width', tw); bg.setAttribute('height', 14);
      bg.setAttribute('rx', '3'); bg.setAttribute('fill', 'rgba(14,14,14,0.9)');
      bg.setAttribute('stroke', 'rgba(255,116,57,0.5)'); bg.setAttribute('stroke-width', '1');
      svg.appendChild(bg);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', mx); txt.setAttribute('y', my - 2);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-family', 'Manrope, sans-serif');
      txt.setAttribute('font-weight', '700'); txt.setAttribute('font-size', '8');
      txt.setAttribute('fill', '#ff7439');
      txt.textContent = lbl;
      svg.appendChild(txt);
    }
    _scMeasureReset(true); // keep SVG, turn off active state
    _scToast(`${meters}m · click to clear`);
  }
}

// Cancel measure on Escape or right-click
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _measure.active) _scMeasureReset();
});
document.addEventListener('contextmenu', e => {
  if (_measure.active) { e.preventDefault(); _scMeasureReset(); }
}, true);

// ─── G. SIGNAL CHAIN BUILDER ───────────────────────
function scShowSignalChain() {
  let panel = document.getElementById('sc-chain-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'sc-chain-panel';
    panel.innerHTML = DOMPurify.sanitize(`
      <div style="display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid rgba(72,72,71,0.25);flex-shrink:0;">
        <span style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#e0e0e0;flex:1;">Signal Chain</span>
        <button onclick="scHideSignalChain()" style="background:none;border:none;color:#484847;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;" onmouseover="this.style.color='#e0e0e0'" onmouseout="this.style.color='#484847'">×</button>
      </div>
      <div id="sc-chain-content" style="flex:1;overflow-y:auto;padding:16px 20px;"></div>
      <div style="padding:12px 20px;border-top:1px solid rgba(72,72,71,0.2);flex-shrink:0;">
        <button onclick="scAutoNumberChannels()" style="width:100%;padding:8px;font-family:'Manrope',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;background:rgba(122,175,255,0.1);border:1px solid rgba(122,175,255,0.25);color:#7aafff;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='rgba(122,175,255,0.18)'" onmouseout="this.style.background='rgba(122,175,255,0.1)'">⚡ Auto-number Channels</button>
      </div>`);
    document.body.appendChild(panel);
  }
  _buildChainView(document.getElementById('sc-chain-content'));
  setTimeout(() => panel.classList.add('open'), 10);
}

function scHideSignalChain() {
  const panel = document.getElementById('sc-chain-panel');
  if (panel) { panel.classList.remove('open'); }
}

function _buildChainView(container) {
  if (!container) return;
  const els = state.elements, conns = state.connections;
  if (!els.length) {
    container.innerHTML = DOMPurify.sanitize(`<p style="font-family:'Inter';font-size:12px;color:#484847;text-align:center;padding:24px 0;">Add elements to the stage<br>to visualize signal chains.</p>`);
    return;
  }

  // Find source elements: not the target of any connection
  const targetIds = new Set(conns.map(c => c.to));
  const sources = els.filter(e => !targetIds.has(e.id));
  const visited = new Set();

  function traceChain(el, depth) {
    if (visited.has(el.id) || depth > 10) return '';
    visited.add(el.id);
    const outgoing = conns.filter(c => c.from === el.id);
    const next = outgoing.map(c => els.find(e => e.id === c.to)).filter(Boolean);
    const chLabel = el.channelId ? `<span style="color:#7aafff;font-size:9px;font-weight:700;"> ${el.channelId}</span>` : '';
    const indent = depth * 16;
    let html = `<div style="display:flex;align-items:center;gap:8px;padding:6px 0 6px ${indent}px;">
      <span style="font-size:16px;flex-shrink:0;">${el.icon || '🎵'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Inter';font-size:11px;color:#c4c4c3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${el.label || el.name}${chLabel}</div>
        ${el.type ? `<div style="font-family:'Manrope',sans-serif;font-size:8px;color:#484847;text-transform:uppercase;letter-spacing:.1em;">${el.type}</div>` : ''}
      </div>
    </div>`;
    if (next.length) {
      html += `<div style="margin-left:${indent + 20}px;border-left:1px dashed rgba(122,175,255,0.18);padding-left:8px;">`;
      next.forEach(n => { html += traceChain(n, depth + 1); });
      html += `</div>`;
    }
    return html;
  }

  let html = '';
  if (!conns.length) {
    html += `<p style="font-family:'Manrope',sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#484847;margin:0 0 12px;">All Elements (No Connections)</p>`;
    els.forEach(el => { html += traceChain(el, 0); });
  } else {
    if (sources.length) {
      html += `<p style="font-family:'Manrope',sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#484847;margin:0 0 12px;">Signal Chains</p>`;
      sources.forEach(s => { html += traceChain(s, 0); });
    }
    const unrouted = els.filter(e => !visited.has(e.id));
    if (unrouted.length) {
      html += `<p style="font-family:'Manrope',sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#484847;margin:14px 0 8px;">Unrouted</p>`;
      unrouted.forEach(e => { html += traceChain(e, 0); });
    }
  }
  container.innerHTML = DOMPurify.sanitize(html || `<p style="font-family:'Inter';font-size:12px;color:#484847;text-align:center;padding:24px 0;">No signal chains detected.</p>`);
}

// ─── H. PATCHES + INIT ─────────────────────────────
// Deselect when clicking outside the stage canvas (but not UI panels that interact with selection)
(function() {
  const _keepIds = [
    'properties-panel', 'sc-ctx', 'sc-tools-fab',
    'sc-el-presets-panel', 'sc-presets-drop', 'sc-hist-panel', 'layer-panel',
    'sm-panel', 'sc-vtools', 'sc-fab-wrap', 'sc-dial-backdrop',
  ];
  function _isUiPanel(target) {
    return _keepIds.some(function(id) {
      const el = document.getElementById(id);
      return el && el.contains(target);
    });
  }
  document.addEventListener('mousedown', function(e) {
    if (!state || !state.selectedId) return;
    const canvas = document.getElementById('stage-canvas');
    if (!canvas) return;
    if (!canvas.contains(e.target) && !_isUiPanel(e.target)) {
      if (typeof deselectAll === 'function') deselectAll();
    }
  }, true);
  document.addEventListener('touchstart', function(e) {
    if (!state || !state.selectedId) return;
    const canvas = document.getElementById('stage-canvas');
    if (!canvas) return;
    const t = e.touches.length && e.touches[0].target;
    if (t && !canvas.contains(t) && !_isUiPanel(t)) {
      if (typeof deselectAll === 'function') deselectAll();
    }
  }, { passive: true, capture: true });
})();

// Secondary renderElements patch: lock visuals + cable labels
(function() {
  const _prev = window.renderElements;
  if (typeof _prev === 'function') {
    window.renderElements = function() {
      _prev.apply(this, arguments);
      _applyLockVisuals();
      _renderCableLabels();
    };
  }
})();

// Patch renderConnections to also refresh cable labels
(function() {
  const _prev = window.renderConnections;
  if (typeof _prev === 'function') {
    window.renderConnections = function() {
      _prev.apply(this, arguments);
      _renderCableLabels();
    };
  }
})();

// Inject canvas SVG overlays + toolbar buttons on DOM ready
function _initProfessionalTools() {
  // Inject SVG overlays into stage canvas
  const canvas = document.getElementById('stage-canvas');
  if (canvas) {
    // Zones (lowest z-index — behind elements)
    if (!document.getElementById('sc-zones-svg')) {
      const z = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      z.id = 'sc-zones-svg'; canvas.insertBefore(z, canvas.firstChild);
    }
    // Cable labels (above connections-svg z-index:10)
    if (!document.getElementById('sc-cable-svg')) {
      const cl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      cl.id = 'sc-cable-svg'; canvas.appendChild(cl);
    }
    // Measurement (top)
    if (!document.getElementById('sc-measure-svg')) {
      const ms = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ms.id = 'sc-measure-svg'; canvas.appendChild(ms);
    }
    // Measure click listener
    canvas.addEventListener('click', _scMeasureClick);

    // FAB: tools button (+) in top-right corner of stage canvas
    if (!document.getElementById('sc-tools-fab')) {
      const fab = document.createElement('div');
      fab.id = 'sc-tools-fab';

      const iconSpan = ic => `<span class="material-symbols-outlined" style="font-size:13px;line-height:1;">${ic}</span>`;
      const mkFabBtn = (id, ic, label, fn) => {
        const b = document.createElement('button');
        b.id = id; b.className = 'sc-fab-btn';
        b.innerHTML = DOMPurify.sanitize(`${iconSpan(ic)}${label}`);
        b.onclick = fn;
        return b;
      };

      const menu = document.createElement('div');
      menu.id = 'sc-tools-menu';
      menu.appendChild(mkFabBtn('btn-sc-measure', 'straighten', 'Measure', scActivateMeasure));
      menu.appendChild(mkFabBtn('btn-sc-cable', 'cable', 'Length', scToggleCableLength));
      menu.appendChild(mkFabBtn('btn-sc-hist', 'history', 'History', openTimelinePanel));
      menu.appendChild(mkFabBtn('btn-sc-scenes', 'layers', 'Scenes', () => {
        fab.classList.remove('open');
        if (typeof window.scOpenMobileScenes === 'function') {
          window.scOpenMobileScenes();
        }
      }));

      const trigger = document.createElement('button');
      trigger.id = 'sc-tools-trigger';
      trigger.title = 'Canvas Tools';
      trigger.innerHTML = DOMPurify.sanitize('<span class="material-symbols-outlined" style="font-size:16px;">add</span>');
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        fab.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!fab.contains(e.target)) fab.classList.remove('open');
      }, { capture: true });

      fab.appendChild(menu);
      fab.appendChild(trigger);
      canvas.appendChild(fab);
    }
  }

  // Inject toolbar buttons (Chain only — Fit removed, Measure/Zones/Cable on FAB)
  const toolbar = document.getElementById('bottom-toolbar');
  if (toolbar) {
    const S = (t, bStyle) => {
      const btn = document.createElement('button');
      btn.className = 'sc-tool-btn';
      btn.style.cssText = 'padding:5px 9px;display:flex;align-items:center;gap:4px;border:none;cursor:pointer;font-family:"Manrope",sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;background:transparent;color:#767575;transition:all .15s;';
      if (bStyle) Object.assign(btn.style, bStyle);
      btn.innerHTML = DOMPurify.sanitize(t);
      btn.addEventListener('mouseenter', function() { if (!this.classList.contains('active')) this.style.color='#c5ffc9'; });
      btn.addEventListener('mouseleave', function() { if (!this.classList.contains('active')) this.style.color='#767575'; });
      return btn;
    };
    const divider = () => { const d = document.createElement('div'); d.style.cssText = 'width:1px;height:18px;background:rgba(72,72,71,0.4);margin:0 3px;flex-shrink:0;'; return d; };
    const icon = ic => `<span class="material-symbols-outlined" style="font-size:16px;">${ic}</span>`;

    // Find the Clear button and insert Chain + Presets + separator before it
    const clearBtn = [...toolbar.querySelectorAll('button')].find(b => b.onclick && b.onclick.toString().includes('clearStage'));

    const bChain = S(`${icon('account_tree')}<span class="desktop-only">Chain</span>`);
    bChain.title = 'Signal Chain Builder'; bChain.onclick = scShowSignalChain;

    if (clearBtn) {
      toolbar.insertBefore(divider(), clearBtn);
      toolbar.insertBefore(bChain, clearBtn);
    } else {
      toolbar.appendChild(divider());
      toolbar.appendChild(bChain);
    }
  }

  // Add Smart Zoom toggle to Settings if not present
  const smiSection = document.querySelector('.settings-section:last-of-type');
  if (smiSection && !document.getElementById('settings-smart-zoom-row')) {
    const row = document.createElement('div');
    row.id = 'settings-smart-zoom-row';
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:12px;';
    row.innerHTML = DOMPurify.sanitize(`<span class="settings-section-hint" style="margin:0;">Smart Zoom on Select</span><button id="settings-smart-zoom-toggle" class="toggle-switch" onclick="scToggleSmartZoom()" title="Auto-focus selected element"></button>`);
    smiSection.appendChild(row);
  }
}

function scToggleSmartZoom() {
  state.smartZoomEnabled = !state.smartZoomEnabled;
  const btn = document.getElementById('settings-smart-zoom-toggle');
  if (btn) btn.classList.toggle('on', state.smartZoomEnabled);
  if (typeof saveSettings === 'function') saveSettings();
  _scToast(state.smartZoomEnabled ? 'Smart zoom on' : 'Smart zoom off');
}

// Patch selectEl for Smart Zoom
(function() {
  const _prev = window.selectEl;
  if (typeof _prev === 'function') {
    window.selectEl = function(id) {
      _prev.apply(this, arguments);
      if (!state.smartZoomEnabled || !id) return;
      const el = state.elements.find(e => String(e.id) === String(id));
      if (!el) return;
      const dom = document.getElementById('elem-' + id);
      if (dom) dom.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    };
  }
})();

// ════════════════════════════════════════════════════
// ADVANCED FEATURES v2
// 1. Readiness Score + Safety Check (StageMind Intel)
// 2. Element Presets
// 3. History Timeline
// 4. Pin Elements
// 5. Share with Password
// ════════════════════════════════════════════════════

// ── 1. READINESS SCORE ───────────────────────────────────────────────────────

function smComputeReadinessScore() {
  const els = state.elements || [];
  if (!els.length) {
    return { score: 0, label: 'No Setup', color: '#484847',
      breakdown: { layout: 0, inputs: 0, routing: 0, balance: 0, completeness: 0 } };
  }
  const canvasW = state.canvasW || 800;

  // Layout (0-20): penalise overlaps and total clustering
  let layout = 20;
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      if (Math.abs(els[i].x - els[j].x) < 50 && Math.abs(els[i].y - els[j].y) < 50) {
        layout = Math.max(0, layout - 5);
      }
    }
  }
  if (els.length >= 2) {
    const xs = els.map(e => e.x), ys = els.map(e => e.y);
    if (Math.max(...xs) - Math.min(...xs) < 100 && Math.max(...ys) - Math.min(...ys) < 100)
      layout = Math.max(0, layout - 10);
  }
  layout = Math.min(20, layout);

  // Inputs / channel completeness (0-20)
  const inputEls = els.filter(e => !/speaker|monitor|wedge|iem|foh|pa\b/i.test(e.name || ''));
  let inputs = 20;
  if (inputEls.length > 0) {
    const assigned = inputEls.filter(e => e.channelId).length;
    inputs = Math.round((assigned / inputEls.length) * 20);
  }

  // Signal routing (0-20)
  let routing = 0;
  const conns = state.connections || [];
  if (conns.length > 0) {
    const connectedIds = new Set([...conns.map(c => c.from), ...conns.map(c => c.to)]);
    routing = Math.min(20, Math.round((connectedIds.size / els.length) * 20));
  } else if (els.length <= 2) {
    routing = 10;
  }

  // Stage balance L/R (0-20)
  let balance = 20;
  if (els.length >= 2 && canvasW > 0) {
    const mid = canvasW / 2;
    const left  = els.filter(e => e.x <  mid).length;
    const right = els.filter(e => e.x >= mid).length;
    balance = Math.round((1 - Math.abs(left - right) / els.length) * 20);
  }

  // Setup completeness (0-20)
  let completeness = 0;
  if (els.some(e => /mic|drum|guitar|bass|key|piano|vocal/i.test(e.name || '')))       completeness += 8;
  if (els.some(e => /foh|pa speaker|main speaker|monitor|wedge|iem/i.test(e.name || ''))) completeness += 8;
  if (state.members && state.members.length > 0) completeness += 4;
  completeness = Math.min(20, completeness);

  const score = layout + inputs + routing + balance + completeness;
  const label = score >= 80 ? 'Excellent' : score >= 55 ? 'Good' : 'Needs Improvement';
  const color = score >= 80 ? '#4caf7d' : score >= 55 ? '#ffaa00' : '#ff716c';
  return { score, label, color, breakdown: { layout, inputs, routing, balance, completeness } };
}

function _buildReadinessHtml(rs) {
  const { score: s, label, color, breakdown: bd } = rs;
  const used = Math.round(s / 100 * 175.9); // circumference of r=28 circle ≈ 176
  const bdLabels = { layout: 'Layout', inputs: 'Inputs', routing: 'Routing', balance: 'Balance', completeness: 'Setup' };
  return `
  <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(72,72,71,0.22);padding:14px 14px 10px;margin-bottom:14px;">
    <div style="font-family:'Manrope',sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#767575;margin-bottom:10px;">Show Readiness Score</div>
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
      <div style="position:relative;width:60px;height:60px;flex-shrink:0;">
        <svg width="60" height="60" viewBox="0 0 64 64" style="transform:rotate(-90deg);">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(72,72,71,0.25)" stroke-width="5"/>
          <circle cx="32" cy="32" r="28" fill="none" stroke="${color}" stroke-width="5"
            stroke-dasharray="${used} 176" stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
          <span style="font-family:'Manrope',sans-serif;font-size:17px;font-weight:900;color:${color};line-height:1;">${s}</span>
        </div>
      </div>
      <div>
        <div style="font-family:'Manrope',sans-serif;font-size:15px;font-weight:900;color:${color};line-height:1.1;">${label}</div>
        <div style="font-family:'Inter';font-size:9px;color:#767575;margin-top:3px;">out of 100 points</div>
      </div>
    </div>
    ${Object.entries(bd).map(([k, v]) => `
      <div style="margin-bottom:5px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
          <span style="font-family:'Inter';font-size:9px;color:#767575;">${bdLabels[k] || k}</span>
          <span style="font-family:'Manrope',sans-serif;font-size:9px;font-weight:700;color:${v >= 16 ? '#4caf7d' : v >= 10 ? '#ffaa00' : '#ff716c'};">${v}/20</span>
        </div>
        <div style="height:3px;background:rgba(72,72,71,0.3);overflow:hidden;">
          <div style="height:100%;width:${v * 5}%;background:${v >= 16 ? '#4caf7d' : v >= 10 ? '#ffaa00' : '#ff716c'};"></div>
        </div>
      </div>`).join('')}
  </div>`;
}

// ── 2. SAFETY CHECK ──────────────────────────────────────────────────────────

function smAnalyzeSafety() {
  const els = state.elements || [];
  const conns = state.connections || [];
  if (!els.length) return [];
  const issues = [];

  // 1. Overlapping / dangerously close elements
  const critical = [], crowded = [];
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      const d = Math.hypot(els[i].x - els[j].x, els[i].y - els[j].y);
      if (d < 30)      critical.push([els[i].id, els[j].id]);
      else if (d < 50) crowded.push([els[i].id, els[j].id]);
    }
  }
  if (critical.length)
    issues.push({ risk: 'high',
      title: `${critical.length} critically overlapping element${critical.length > 1 ? 's' : ''}`,
      desc: 'Equipment is dangerously stacked — real-world collision / trip hazard. Separate these items immediately.',
      ids: [...new Set(critical.flat())] });
  if (crowded.length)
    issues.push({ risk: 'medium',
      title: `${crowded.length} crowded element pair${crowded.length > 1 ? 's' : ''}`,
      desc: 'Equipment is too close together. Allow at least 50 cm between items for safe performer movement.',
      ids: [...new Set(crowded.flat())] });

  // 2. Cable crossings (signal path intersections)
  function segsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-8) return false;
    const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross;
    const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross;
    return t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95;
  }
  const lines = conns.map(c => {
    const a = els.find(e => e.id === c.from);
    const b = els.find(e => e.id === c.to);
    return a && b ? [a.x, a.y, b.x, b.y] : null;
  }).filter(Boolean);
  let crossings = 0;
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++)
      if (segsIntersect(...lines[i], ...lines[j])) crossings++;
  if (crossings > 0)
    issues.push({ risk: crossings > 3 ? 'high' : 'medium',
      title: `${crossings} cable crossing${crossings > 1 ? 's' : ''}`,
      desc: 'Signal cables cross on stage — trip hazard and potential interference. Reposition elements to route cables cleanly.',
      ids: [] });

  // 3. Uneven stage density (≥75 % of elements in one quadrant)
  if (els.length >= 4) {
    const cw = state.canvasW || 800, ch = state.canvasH || 500;
    const q = [0, 0, 0, 0];
    els.forEach(e => { q[(e.y >= ch / 2 ? 2 : 0) + (e.x >= cw / 2 ? 1 : 0)]++; });
    if (Math.max(...q) > els.length * 0.75)
      issues.push({ risk: 'low',
        title: 'Uneven stage density',
        desc: 'Most equipment is concentrated in one area. Distribute gear across the full stage for safer access.',
        ids: [] });
  }

  return issues;
}

function _buildSafetyHtml(issues) {
  if (!issues.length) {
    return `<div class="smi-section">
      <p class="smi-section-title">Safety Check</p>
      <div class="smi-ok-state">
        <span class="smi-ok-icon material-symbols-outlined">shield</span>
        <span class="smi-ok-text">No safety issues detected.</span>
      </div>
    </div>`;
  }
  const rc = { high: '#ff716c', medium: '#ffaa00', low: '#7aafff' };
  const rl = { high: 'HIGH', medium: 'MED', low: 'LOW' };
  return `
  <div class="smi-section">
    <p class="smi-section-title">Safety Check</p>
    ${issues.map(i => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid rgba(72,72,71,0.1);">
        <span style="font-family:'Manrope',sans-serif;font-size:7px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:${rc[i.risk]};background:${rc[i.risk]}22;padding:2px 5px;flex-shrink:0;margin-top:1px;">${rl[i.risk]}</span>
        <div>
          <p style="font-family:'Manrope',sans-serif;font-size:10px;font-weight:700;color:#c4c4c3;margin:0 0 2px;">${i.title}</p>
          <p style="font-family:'Inter';font-size:10px;color:#484847;margin:0;line-height:1.4;">${i.desc}</p>
        </div>
      </div>`).join('')}
  </div>`;
}

function _applySafetyHighlights(issues) {
  // Remove previous highlights
  document.querySelectorAll('.sc-safety-hl').forEach(el => el.classList.remove('sc-safety-hl', 'sc-safety-high', 'sc-safety-medium'));
  const highIds  = new Set(issues.filter(i => i.risk === 'high').flatMap(i => i.ids).map(String));
  const medIds   = new Set(issues.filter(i => i.risk === 'medium').flatMap(i => i.ids).map(String));
  highIds.forEach(id => {
    const el = document.getElementById('elem-' + id);
    if (el) el.classList.add('sc-safety-hl', 'sc-safety-high');
  });
  medIds.forEach(id => {
    const el = document.getElementById('elem-' + id);
    if (el && !highIds.has(id)) el.classList.add('sc-safety-hl', 'sc-safety-medium');
  });
}

// Patch smRunAnalysis to inject Readiness Score + Safety Check
(function() {
  const _prev = window.smRunAnalysis;
  if (typeof _prev !== 'function') return;
  window.smRunAnalysis = function() {
    try { _prev.apply(this, arguments); } catch(e) { console.warn('[SC] smRunAnalysis base error:', e); return; }
    try {
      const results = document.getElementById('sm-intel-results');
      if (!results || !(state.elements && state.elements.length)) {
        _applySafetyHighlights([]);
        return;
      }
      const rs = smComputeReadinessScore();
      const safetyIssues = smAnalyzeSafety();

      // Inject readiness at top
      const scoreWrap = document.createElement('div');
      scoreWrap.innerHTML = DOMPurify.sanitize(_buildReadinessHtml(rs));
      results.insertBefore(scoreWrap, results.firstChild);

      // Append safety before the final timestamp paragraph
      const safetyWrap = document.createElement('div');
      safetyWrap.innerHTML = DOMPurify.sanitize(_buildSafetyHtml(safetyIssues));
      const lastP = results.querySelector('p:last-child');
      if (lastP) results.insertBefore(safetyWrap, lastP);
      else results.appendChild(safetyWrap);

      _applySafetyHighlights(safetyIssues);
    } catch(e) { console.warn('[SC] smRunAnalysis extras error:', e); }
  };
})();

// ── 3. ELEMENT PRESETS ───────────────────────────────────────────────────────

const SC_EL_PRESETS_KEY = 'sc_el_presets_v1';
let _elPresetsOpen = false;

function _getElPresets() {
  try { return JSON.parse(localStorage.getItem(SC_EL_PRESETS_KEY) || '[]'); } catch { return []; }
}
function _setElPresets(arr) {
  try { localStorage.setItem(SC_EL_PRESETS_KEY, JSON.stringify(arr)); } catch {}
}

function _scPrompt(title, defaultVal, onConfirm) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);';
  const box = document.createElement('div');
  box.style.cssText = 'background:#111217;border:1px solid rgba(122,175,255,0.2);border-radius:10px;padding:20px 22px 16px;min-width:270px;box-shadow:0 12px 48px rgba(0,0,0,0.8);display:flex;flex-direction:column;gap:12px;';
  const lbl = document.createElement('p');
  lbl.textContent = title;
  lbl.style.cssText = 'margin:0;font-family:"Manrope",sans-serif;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#c8c8c6;';
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = defaultVal || '';
  inp.style.cssText = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(122,175,255,0.2);border-radius:6px;padding:8px 10px;font-family:"Manrope",sans-serif;font-size:13px;color:#f0f0ee;outline:none;';
  inp.addEventListener('focus', () => inp.style.borderColor = 'rgba(122,175,255,0.6)');
  inp.addEventListener('blur',  () => inp.style.borderColor = 'rgba(122,175,255,0.2)');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancel';
  btnCancel.style.cssText = 'padding:7px 14px;font-family:"Manrope",sans-serif;font-size:11px;font-weight:600;background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#888;cursor:pointer;';
  const btnSave = document.createElement('button');
  btnSave.textContent = 'Save';
  btnSave.style.cssText = 'padding:7px 16px;font-family:"Manrope",sans-serif;font-size:11px;font-weight:700;background:#7aafff;border:none;border-radius:6px;color:#0e0e0e;cursor:pointer;';
  function confirm() {
    const v = inp.value.trim();
    if (!v) { inp.style.borderColor = 'rgba(255,80,80,0.7)'; inp.focus(); return; }
    document.body.removeChild(overlay);
    onConfirm(v);
  }
  function cancel() { document.body.removeChild(overlay); }
  btnSave.addEventListener('click', confirm);
  btnCancel.addEventListener('click', cancel);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); else if (e.key === 'Escape') cancel(); });
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) cancel(); });
  row.appendChild(btnCancel); row.appendChild(btnSave);
  box.appendChild(lbl); box.appendChild(inp); box.appendChild(row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { inp.focus(); inp.select(); });
}

function scSaveAsPreset(nameHint) {
  const selIds = (typeof multiSel !== 'undefined' && multiSel.size > 0)
    ? [...multiSel].map(String)
    : (state.selectedId ? [String(state.selectedId)] : null);
  if (!selIds || !selIds.length) { _scToast('Select elements first, then save as preset'); return; }

  const selEls = state.elements.filter(e => selIds.includes(String(e.id)));
  if (!selEls.length) { _scToast('No elements found'); return; }

  const minX = Math.min(...selEls.map(e => e.x));
  const minY = Math.min(...selEls.map(e => e.y));
  const normEls = selEls.map(e => ({ ...e, x: e.x - minX, y: e.y - minY }));
  const selIdSet = new Set(selIds);
  const selConns = (state.connections || []).filter(
    c => selIdSet.has(String(c.from)) && selIdSet.has(String(c.to))
  );

  function _doSave(name) {
    const presets = _getElPresets();
    presets.unshift({ id: Date.now(), name, count: normEls.length,
      savedAt: new Date().toLocaleString(), elements: normEls, connections: selConns });
    if (presets.length > 20) presets.length = 20;
    _setElPresets(presets);
    _scToast(`"${name}" preset saved`);
    if (_elPresetsOpen) _renderElPresetsPanel();
    else _refreshPresetsDrop();
  }

  if (nameHint && nameHint.trim()) { _doSave(nameHint.trim()); }
  else { _scPrompt('Name this preset', '', _doSave); }
}

function scOpenElPresets() {
  // Close the item sheet if open so they don't overlap
  const itemSheet = document.getElementById('sc-item-sheet');
  if (itemSheet) itemSheet.classList.remove('sc-sheet-open');
  const fabWrap = document.getElementById('sc-fab-wrap');
  if (fabWrap) fabWrap.classList.remove('sc-items-open');

  let panel = document.getElementById('sc-el-presets-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'sc-el-presets-panel';
    panel.style.cssText = [
      'position:absolute;bottom:142px;right:14px;width:212px;max-height:400px;',
      'z-index:5001;display:flex;flex-direction:column;overflow:hidden;',
      'border-radius:18px;',
      'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);',
      'transform:translateY(18px) scale(0.93);opacity:0;pointer-events:none;',
      'transition:transform 330ms cubic-bezier(0.34,1.56,0.64,1),opacity 240ms ease;',
    ].join('');
    document.body.appendChild(panel);
  }
  // Sync visual style to current theme
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  panel.style.background = isLight ? 'rgba(248,248,250,0.98)' : 'rgba(16,16,20,0.97)';
  panel.style.border = isLight ? '1px solid rgba(0,0,0,0.09)' : '1px solid rgba(255,255,255,0.10)';
  panel.style.boxShadow = isLight ? '0 8px 40px rgba(0,0,0,0.12)' : '0 8px 40px rgba(0,0,0,0.60)';

  _elPresetsOpen = true;
  _renderElPresetsPanel();
  requestAnimationFrame(() => {
    panel.style.transform = 'translateY(0) scale(1)';
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'all';
  });
}

function scCloseElPresets() {
  const panel = document.getElementById('sc-el-presets-panel');
  if (panel) {
    panel.style.transform = 'translateY(18px) scale(0.93)';
    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
  }
  _elPresetsOpen = false;
}

// ── Hover dropdown for the bookmark button in the category bar ──
let _presetsDropTimer = null;

function _showPresetsDrop() {
  clearTimeout(_presetsDropTimer);
  const btn = document.getElementById('desk-presets-btn');
  if (!btn) return;
  let drop = document.getElementById('sc-presets-drop');
  if (!drop) {
    drop = document.createElement('div');
    drop.id = 'sc-presets-drop';
    drop.style.cssText = 'position:absolute;z-index:9100;background:#111217;border:1px solid rgba(122,175,255,0.13);border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.85);width:260px;max-height:420px;display:flex;flex-direction:column;opacity:0;transform:translateY(-4px);transition:opacity .15s ease,transform .15s ease;pointer-events:none;';
    drop.addEventListener('mouseenter', () => clearTimeout(_presetsDropTimer));
    drop.addEventListener('mouseleave', _scheduleHideDrop);
    document.body.appendChild(drop);
  }
  const r = btn.getBoundingClientRect();
  drop.style.left = Math.min(r.right - 260, window.innerWidth - 268) + 'px';
  drop.style.top = (r.bottom + 6) + 'px';
  _renderPresetsDrop(drop);
  drop.style.display = 'flex';
  drop.style.pointerEvents = 'auto';
  requestAnimationFrame(() => { drop.style.opacity = '1'; drop.style.transform = 'translateY(0)'; });
}

function _hidePresetsDrop() {
  const drop = document.getElementById('sc-presets-drop');
  if (!drop) return;
  drop.style.opacity = '0';
  drop.style.transform = 'translateY(-4px)';
  drop.style.pointerEvents = 'none';
  setTimeout(() => { if (drop.style.opacity === '0') drop.style.display = 'none'; }, 150);
}

function _scheduleHideDrop() {
  _presetsDropTimer = setTimeout(_hidePresetsDrop, 320);
}

function _refreshPresetsDrop() {
  const drop = document.getElementById('sc-presets-drop');
  if (drop && drop.style.display !== 'none' && drop.style.opacity !== '0') _renderPresetsDrop(drop);
}

function _renderPresetsDrop(drop) {
  const presets = _getElPresets();
  drop.innerHTML = DOMPurify.sanitize(`
    <div style="padding:10px 14px 8px;border-bottom:1px solid rgba(72,72,71,0.2);flex-shrink:0;display:flex;align-items:center;gap:8px;">
      <span class="material-symbols-outlined" style="font-size:14px;color:#f0b429;">bookmark</span>
      <span style="font-family:'Manrope',sans-serif;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#e0e0e0;flex:1;">Element Presets</span>
      <button onclick="scSaveAsPreset()" style="padding:3px 9px;font-family:'Manrope',sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;background:rgba(122,175,255,0.1);border:1px solid rgba(122,175,255,0.25);color:#7aafff;cursor:pointer;border-radius:4px;" onmouseover="this.style.background='rgba(122,175,255,0.2)'" onmouseout="this.style.background='rgba(122,175,255,0.1)'">+ Save</button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:8px 10px;">
      ${presets.length === 0
        ? '<p style="font-family:\'Inter\';font-size:10px;color:#484847;text-align:center;margin:20px 0;line-height:1.6;">No presets saved yet.<br>Select elements on stage,<br>then press + Save.</p>'
        : presets.map(p => `
          <div style="background:#0e0e0e;border:1px solid rgba(72,72,71,0.18);margin-bottom:6px;padding:8px 10px;border-radius:5px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
              <span style="font-family:'Manrope',sans-serif;font-size:10px;font-weight:700;color:#e0e0e0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.name}">${p.name}</span>
              <span style="font-family:'Inter';font-size:8px;color:#484847;">${p.count} elem</span>
            </div>
            <div style="display:flex;gap:5px;">
              <button onclick="scLoadElPreset(${p.id})" style="flex:1;padding:4px 0;font-family:'Manrope',sans-serif;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;background:rgba(122,175,255,0.08);border:1px solid rgba(122,175,255,0.2);color:#7aafff;cursor:pointer;border-radius:3px;" onmouseover="this.style.background='rgba(122,175,255,0.18)'" onmouseout="this.style.background='rgba(122,175,255,0.08)'">Load onto Stage</button>
              <button onclick="_renameElPreset(${p.id})" title="Rename" style="padding:4px 8px;background:transparent;border:1px solid rgba(72,72,71,0.3);color:#484847;cursor:pointer;font-size:11px;border-radius:3px;" onmouseover="this.style.color='#e0e0e0'" onmouseout="this.style.color='#484847'">✎</button>
              <button onclick="_deleteElPreset(${p.id})" title="Delete" style="padding:4px 8px;background:transparent;border:1px solid rgba(180,40,40,0.25);color:#484847;cursor:pointer;font-size:11px;border-radius:3px;" onmouseover="this.style.color='#ff5050'" onmouseout="this.style.color='#484847'">✕</button>
            </div>
          </div>`).join('')
      }
    </div>`);
}

// Initialise hover behaviour once DOM is ready
(function() {
  function _initPresetsHover() {
    const btn = document.getElementById('desk-presets-btn');
    if (!btn) return;
    btn.addEventListener('mouseenter', _showPresetsDrop);
    btn.addEventListener('mouseleave', _scheduleHideDrop);
    btn.addEventListener('click', _showPresetsDrop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _initPresetsHover);
  else setTimeout(_initPresetsHover, 200);
})();

function _renderElPresetsPanel() {
  const panel = document.getElementById('sc-el-presets-panel');
  if (!panel) return;
  const presets = _getElPresets();
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const sepColor = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)';
  const delColor = isLight ? 'rgba(0,0,0,0.2)' : 'rgba(120,120,120,0.3)';

  const presetRows = presets.length === 0
    ? `<p style="font-family:'Inter';font-size:10px;color:#484847;text-align:center;margin:18px 4px;line-height:1.7;padding:0 6px;">No presets yet.<br>Select elements<br>and save.</p>`
    : presets.map(p => `
        <div style="position:relative;">
          <button class="sc-item-btn" onclick="scLoadElPreset(${p.id});scCloseElPresets();">
            <span class="sc-item-btn-icon">
              <span class="material-symbols-outlined" style="font-size:14px;">bookmark</span>
            </span>
            <span class="sc-item-btn-name" title="${p.name}">${p.name}</span>
            <span style="font-family:'Inter';font-size:9px;color:#484847;flex-shrink:0;padding-right:18px;">${p.count}</span>
          </button>
          <button onclick="event.stopPropagation();_deleteElPreset(${p.id})" title="Delete"
            style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:${delColor};cursor:pointer;font-size:15px;line-height:1;padding:4px;-webkit-tap-highlight-color:transparent;transition:color .12s;"
            onmouseover="this.style.color='#ff5050'" onmouseout="this.style.color='${delColor}'">×</button>
        </div>`).join('');

  panel.innerHTML = DOMPurify.sanitize(`
    <div style="display:flex;align-items:center;gap:9px;padding:12px 14px 9px;flex-shrink:0;border-bottom:1px solid ${sepColor};">
      <button onclick="scCloseElPresets()"
        style="width:26px;height:26px;border-radius:8px;background:rgba(128,128,128,0.12);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#888;-webkit-tap-highlight-color:transparent;flex-shrink:0;transition:background 120ms ease;">
        <span class="material-symbols-outlined" style="font-size:15px;">arrow_back_ios_new</span>
      </button>
      <span style="font-family:'Manrope',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#888;flex:1;">Presets</span>
    </div>
    <div style="overflow-y:auto;overflow-x:hidden;padding:6px;display:flex;flex-direction:column;gap:1px;-webkit-overflow-scrolling:touch;scrollbar-width:none;max-height:340px;">
      <button class="sc-item-btn sc-item-btn--create" onclick="scSaveAsPreset()">
        <span class="sc-item-btn-icon">
          <span class="material-symbols-outlined" style="font-size:15px;">add</span>
        </span>
        <span class="sc-item-btn-name">Save as Preset</span>
      </button>
      ${presetRows}
    </div>`);
  _refreshPresetsDrop();
}

function scLoadElPreset(id) {
  const presets = _getElPresets();
  const p = presets.find(x => x.id === id);
  if (!p) return;
  if (typeof pushHistory === 'function') pushHistory();
  const cx = (state.canvasW || 800) / 2 - 100;
  const cy = (state.canvasH || 500) / 2 - 80;
  const now = Date.now();
  const idMap = {};
  const newEls = p.elements.map((el, i) => {
    const nid = 'ep' + (now + i);
    idMap[String(el.id)] = nid;
    return { ...el, id: nid, x: el.x + cx, y: el.y + cy, pinned: false };
  });
  const newConns = p.connections.map(c => ({
    ...c,
    from: idMap[String(c.from)] || c.from,
    to:   idMap[String(c.to)]   || c.to,
  }));
  state.elements.push(...newEls);
  state.connections.push(...newConns);
  if (typeof renderElements === 'function') renderElements();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
  _scToast(`"${p.name}" loaded — ${newEls.length} element${newEls.length !== 1 ? 's' : ''} added`);
  scCloseElPresets();
}

function _renameElPreset(id) {
  const presets = _getElPresets();
  const p = presets.find(x => x.id === id);
  if (!p) return;
  _scPrompt('Rename preset', p.name, function(name) {
    p.name = name;
    _setElPresets(presets);
    _renderElPresetsPanel();
  });
}

function _deleteElPreset(id) {
  _setElPresets(_getElPresets().filter(p => p.id !== id));
  _renderElPresetsPanel();
  _scToast('Preset deleted');
}

// ── 4. HISTORY TIMELINE ──────────────────────────────────────────────────────

const _histTimeline = [];    // [index] → { label, time }
let _histNextLabel  = null;
let _histTimelineOpen = false;

// Patch pushHistory to record timestamps + labels
(function() {
  const _prev = window.pushHistory;
  if (typeof _prev !== 'function') return;
  window.pushHistory = function() {
    try { _prev.apply(this, arguments); } catch(e) { console.warn('[SC] pushHistory base error:', e); return; }
    try {
      const label = _histNextLabel || _guessHistLabel();
      _histNextLabel = null;
      if (state.historyIndex >= 0) {
        _histTimeline[state.historyIndex] = { label, time: Date.now() };
      }
      if (_histTimelineOpen) _renderHistTimeline();
    } catch(e) { console.warn('[SC] pushHistory extras error:', e); }
  };
})();

function _guessHistLabel() {
  const n = (state.elements || []).length;
  return n === 0 ? 'Stage cleared' : `${n} element${n !== 1 ? 's' : ''} on stage`;
}

function _scIsLight() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function openTimelinePanel() {
  // Toggle: close if already open
  if (_histTimelineOpen) { closeTimelinePanel(); return; }

  // Mutual exclusion: never overlap with the presets panel
  if (typeof closePresetsPanel === 'function') {
    try { closePresetsPanel(); } catch(e) { /* noop */ }
  }

  // ── Compact floating sheet anchored near the top of the viewport ──
  // Sits just below the React top toolbar so it doesn't cover the stage.
  const isNarrow = window.innerWidth < 520;
  const panelW = isNarrow ? Math.min(window.innerWidth - 16, 320) : 320;
  const panelTop = 8;
  const panelLeft = Math.round((window.innerWidth - panelW) / 2);
  const maxH = Math.min(260, Math.round(window.innerHeight * 0.5));

  let panel = document.getElementById('sc-hist-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'sc-hist-panel';
    document.body.appendChild(panel);
  }
  const light = _scIsLight();
  const bg = light ? 'rgba(252,252,253,0.98)' : 'rgba(10,10,12,0.97)';
  const border = light ? 'rgba(0,0,0,0.10)' : 'rgba(72,72,71,0.35)';
  const shadow = light
    ? '0 12px 40px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)'
    : '0 24px 60px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)';
  panel.style.cssText = [
    `position:fixed;top:${panelTop}px;left:${panelLeft}px;width:${panelW}px;`,
    `max-height:${maxH}px;`,
    `background:${bg};`,
    `border:1px solid ${border};`,
    'border-radius:12px;',
    `box-shadow:${shadow};`,
    'z-index:9000;display:flex;flex-direction:column;overflow:hidden;',
    'transform:translateY(-12px);opacity:0;',
    'transition:transform 0.22s cubic-bezier(.16,1,.3,1), opacity 0.18s ease;',
  ].join('');

  _histTimelineOpen = true;
  _renderHistTimeline();
  requestAnimationFrame(() => {
    panel.style.transform = 'translateY(0)';
    panel.style.opacity = '1';
  });

  // Backdrop tap closes the panel (mobile-friendly)
  let backdrop = document.getElementById('sc-hist-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'sc-hist-backdrop';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', closeTimelinePanel);
  }
  backdrop.style.cssText =
    'position:fixed;inset:0;background:transparent;z-index:8999;';

  if (typeof closeShareModal === 'function') closeShareModal();
}

function closeTimelinePanel() {
  const panel = document.getElementById('sc-hist-panel');
  if (panel) {
    panel.style.transform = 'translateY(-12px)';
    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
  }
  const backdrop = document.getElementById('sc-hist-backdrop');
  if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
  _histTimelineOpen = false;
}

function _renderHistTimeline() {
  const panel = document.getElementById('sc-hist-panel');
  if (!panel) return;
  const entries = state.history || [];
  const cur     = state.historyIndex;
  const light   = _scIsLight();

  const c = light ? {
    headerBorder: 'rgba(0,0,0,0.10)',
    title: '#1a1a1c',
    closeIdle: '#7a7a7d',
    closeHover: '#1a1a1c',
    emptyText: '#6c6c70',
    footerBorder: 'rgba(0,0,0,0.08)',
    btnBorder: 'rgba(0,0,0,0.14)',
    btnText: '#5c5c60',
    btnHoverText: '#1a1a1c',
    btnHoverBorder: 'rgba(122,175,255,0.45)',
    scrollThumb: 'rgba(0,0,0,0.18)',
  } : {
    headerBorder: 'rgba(72,72,71,0.22)',
    title: '#e0e0e0',
    closeIdle: '#484847',
    closeHover: '#e0e0e0',
    emptyText: '#767575',
    footerBorder: 'rgba(72,72,71,0.15)',
    btnBorder: 'rgba(72,72,71,0.3)',
    btnText: '#767575',
    btnHoverText: '#e0e0e0',
    btnHoverBorder: 'rgba(122,175,255,0.35)',
    scrollThumb: 'rgba(72,72,71,0.4)',
  };

  const rows = entries.map((_, i) => {
    const meta  = _histTimeline[i] || {};
    const label = meta.label || `Step ${i + 1}`;
    const time  = meta.time
      ? new Date(meta.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '';
    const isNow = i === cur;
    return `
      <div onclick="scJumpToHistory(${i})" class="sc-hist-row${isNow ? ' sc-hist-now' : ''}">
        <div class="sc-hist-dot${isNow ? ' sc-hist-dot-now' : ''}"></div>
        <div style="flex:1;min-width:0;">
          <div class="sc-hist-label${isNow ? ' sc-hist-label-now' : ''}">${label}</div>
          ${time ? `<div class="sc-hist-time">${time}</div>` : ''}
        </div>
        ${isNow ? '<span class="sc-hist-badge">NOW</span>' : ''}
      </div>`;
  }).reverse().join('');

  panel.innerHTML = DOMPurify.sanitize(`
    <div style="display:flex;align-items:center;padding:8px 10px;border-bottom:1px solid ${c.headerBorder};flex-shrink:0;gap:6px;">
      <span class="material-symbols-outlined" style="font-size:12px;color:#7aafff;">history</span>
      <span style="font-family:'Manrope',sans-serif;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:${c.title};flex:1;">History</span>
      <button onclick="closeTimelinePanel()" style="background:none;border:none;color:${c.closeIdle};cursor:pointer;font-size:15px;line-height:1;padding:0 2px;" onmouseover="this.style.color='${c.closeHover}'" onmouseout="this.style.color='${c.closeIdle}'">×</button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:4px 0;scrollbar-width:thin;scrollbar-color:${c.scrollThumb} transparent;">
      ${entries.length === 0
        ? `<p style="font-family:'Inter';font-size:9px;color:${c.emptyText};text-align:center;margin:14px 0;line-height:1.5;">No history yet.<br>Make edits to see your timeline.</p>`
        : rows}
    </div>
    <div style="padding:6px 8px;border-top:1px solid ${c.footerBorder};display:flex;gap:5px;flex-shrink:0;">
      <button onclick="undo();_renderHistTimeline();" style="flex:1;padding:4px 4px;font-family:'Manrope',sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;background:transparent;border:1px solid ${c.btnBorder};color:${c.btnText};cursor:pointer;transition:all .12s;border-radius:4px;" onmouseover="this.style.color='${c.btnHoverText}';this.style.borderColor='${c.btnHoverBorder}'" onmouseout="this.style.color='${c.btnText}';this.style.borderColor='${c.btnBorder}'">← Undo</button>
      <button onclick="redo();_renderHistTimeline();" style="flex:1;padding:4px 4px;font-family:'Manrope',sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;background:transparent;border:1px solid ${c.btnBorder};color:${c.btnText};cursor:pointer;transition:all .12s;border-radius:4px;" onmouseover="this.style.color='${c.btnHoverText}';this.style.borderColor='${c.btnHoverBorder}'" onmouseout="this.style.color='${c.btnText}';this.style.borderColor='${c.btnBorder}'">Redo →</button>
    </div>`);
}

function scJumpToHistory(index) {
  if (index < 0 || index >= (state.history || []).length) return;
  state.historyIndex = index;
  const s = JSON.parse(state.history[index]);
  state.elements    = s.elements;
  state.connections = s.connections;
  if (s.setlist)  state.setlist  = s.setlist;
  if (s.segments) state.segments = s.segments;
  state.selectedId = null;
  if (typeof renderAll             === 'function') renderAll();
  if (typeof renderSetlist         === 'function') renderSetlist();
  if (typeof updateHistoryButtons  === 'function') updateHistoryButtons();
  _renderHistTimeline();
}

// ── 5. PIN ELEMENTS ──────────────────────────────────────────────────────────

function scTogglePin(el) {
  el.pinned = !el.pinned;
  if (typeof renderElements    === 'function') renderElements();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
  _scToast(el.pinned ? '📌 Element pinned' : 'Element unpinned');
}

// Patch renderElements to apply/remove pin badges
(function() {
  const _prev = window.renderElements;
  if (typeof _prev !== 'function') return;
  window.renderElements = function() {
    try { _prev.apply(this, arguments); } catch(e) { console.warn('[SC] renderElements chain error:', e); }
    try { _applyPinBadges(); } catch(e) { console.warn('[SC] _applyPinBadges error:', e); }
  };
})();

let _pinBadgeKey = '';
function _applyPinBadges() {
  const els = state.elements || [];
  const key = els.map(e => `${e.id}:${e.pinned ? 1 : 0}`).join(',');
  if (key === _pinBadgeKey) return;
  _pinBadgeKey = key;
  els.forEach(el => {
    const dom = document.getElementById('elem-' + el.id);
    if (!dom) return;
    let badge = dom.querySelector('.sc-pin-badge');
    if (el.pinned) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'sc-pin-badge';
        badge.textContent = '📌';
        dom.appendChild(badge);
      }
    } else {
      if (badge) badge.remove();
    }
  });
}

// ── 6. SHARE WITH PASSWORD ───────────────────────────────────────────────────

async function _sha256Hex(str) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Patch generateShareLink to support password protection
(function() {
  const _prev = window.generateShareLink;
  if (typeof _prev !== 'function') return;
  window.generateShareLink = async function() {
    const pwToggle = document.getElementById('share-pw-toggle');
    const pwInput  = document.getElementById('share-pw-value');
    const usePw    = pwToggle && pwToggle.checked && pwInput && pwInput.value.trim();

    if (!usePw) { _prev.apply(this, arguments); return; }

    const pw = pwInput.value.trim();
    const elements = state.elements.map(el => {
      const c = { ...el };
      if (c.imageData && c.imageData.length > 2000) delete c.imageData;
      return c;
    });
    const payload = {
      v: 1, projectName: state.projectName || 'Stage Plot',
      elements, connections: state.connections, setlist: state.setlist,
      riderNeeds: state.riderNeeds, segments: state.segments, canvasBg: state.canvasBg,
    };
    let encoded;
    try {
      encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    } catch(e) {
      if (typeof showToast === 'function') showToast('Failed to encode project.'); return;
    }
    const hash     = await _sha256Hex(pw);
    const shortHash = hash.slice(0, 16);
    const pwUrl    = `${window.location.origin}${window.location.pathname}#share=pw:${shortHash}:${encoded}`;
    window._shareUrl = pwUrl;
    const inp = document.getElementById('share-url-input');
    if (inp) inp.value = pwUrl;
    const warn = document.getElementById('share-size-warn');
    if (warn) warn.style.display = encoded.length > 50000 ? 'block' : 'none';
    const qrOut = document.getElementById('qr-output');
    if (qrOut) qrOut.innerHTML = DOMPurify.sanitize('<span style="font-size:11px;color:#aaa;text-align:center;padding:10px;">Click Generate QR</span>');
    const dlBtn = document.getElementById('btn-dl-qr');
    if (dlBtn) dlBtn.disabled = true;
    if (typeof showToast === 'function') showToast('🔒 Password-protected link generated!');
  };
})();

// Toggle password input visibility in share modal
function scTogglePwField() {
  const toggle = document.getElementById('share-pw-toggle');
  const field  = document.getElementById('share-pw-field');
  if (!toggle || !field) return;
  field.style.display = toggle.checked ? 'block' : 'none';
  // Reset generated URL when toggling protection on/off
  const inp = document.getElementById('share-url-input');
  if (inp) inp.value = '';
  window._shareUrl = '';
}

// On load: detect password-protected share link (runs after app.js IIFE fails silently)
(function _detectPwShare() {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=pw:')) return;
  const rest   = hash.slice(10);          // strip '#share=pw:'
  const colon  = rest.indexOf(':');
  if (colon === -1) return;
  const storedHash    = rest.slice(0, colon);
  const encodedPayload = rest.slice(colon + 1);
  // Defer to let app.js finish painting the UI first
  window.addEventListener('DOMContentLoaded', () => _showPwGate(storedHash, encodedPayload), { once: true });
  // Also fire immediately in case DOMContentLoaded already fired
  if (document.readyState !== 'loading') _showPwGate(storedHash, encodedPayload);
})();

function _showPwGate(storedHash, encodedPayload) {
  if (document.getElementById('sc-pw-gate')) return;
  const overlay = document.createElement('div');
  overlay.id = 'sc-pw-gate';
  overlay.style.cssText = 'position:absolute;inset:0;z-index:99999;background:#0a0a0c;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = DOMPurify.sanitize(`
    <div style="background:#111;border:1px solid rgba(122,175,255,0.25);padding:32px;width:340px;max-width:90vw;position:relative;">
      <button onclick="document.getElementById('sc-pw-gate').remove();history.replaceState(null,'',location.pathname)"
        style="position:absolute;top:12px;right:14px;background:none;border:none;color:#484847;cursor:pointer;font-size:20px;line-height:1;"
        title="Dismiss" onmouseover="this.style.color='#e0e0e0'" onmouseout="this.style.color='#484847'">×</button>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span class="material-symbols-outlined" style="font-size:18px;color:#7aafff;">lock</span>
        <span style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#7aafff;">Protected Stage Plot</span>
      </div>
      <p style="font-family:'Inter';font-size:12px;color:#484847;margin:0 0 20px;line-height:1.5;">This share link is password-protected. Enter the password to view.</p>
      <label style="font-family:'Manrope',sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#767575;display:block;margin-bottom:6px;">Password</label>
      <input id="sc-pw-input" type="password" autocomplete="current-password"
        style="width:100%;background:#0a0a0c;border:1px solid rgba(72,72,71,0.4);color:#e0e0e0;padding:10px 12px;font-family:'Manrope',sans-serif;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:10px;transition:border-color .15s;"
        placeholder="Enter password" />
      <div id="sc-pw-err" style="font-family:'Inter';font-size:11px;color:#ff716c;margin-bottom:10px;display:none;">Incorrect password. Please try again.</div>
      <button onclick="_verifyPwShare('${storedHash}','${encodedPayload.replace(/'/g, "\\'")}')"
        style="width:100%;padding:11px;font-family:'Manrope',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;background:rgba(122,175,255,0.1);border:1px solid rgba(122,175,255,0.3);color:#7aafff;cursor:pointer;transition:background .15s;"
        onmouseover="this.style.background='rgba(122,175,255,0.18)'" onmouseout="this.style.background='rgba(122,175,255,0.1)'">Unlock →</button>
    </div>`);
  document.body.appendChild(overlay);
  const _escHandler = e => {
    if (e.key === 'Escape') {
      overlay.remove();
      history.replaceState(null, '', location.pathname);
      document.removeEventListener('keydown', _escHandler, true);
    }
  };
  document.addEventListener('keydown', _escHandler, true);
  setTimeout(() => {
    const inp = document.getElementById('sc-pw-input');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') _verifyPwShare(storedHash, encodedPayload);
      });
    }
  }, 80);
}

async function _verifyPwShare(storedHash, encodedPayload) {
  const inp    = document.getElementById('sc-pw-input');
  const errEl  = document.getElementById('sc-pw-err');
  if (!inp) return;
  const pw = inp.value;
  if (!pw) return;
  try {
    const hash  = await _sha256Hex(pw);
    const short = hash.slice(0, 16);
    if (short !== storedHash) {
      if (errEl) errEl.style.display = 'block';
      inp.style.borderColor = '#ff716c';
      inp.value = '';
      inp.focus();
      return;
    }
    const json = decodeURIComponent(escape(atob(encodedPayload)));
    const d    = JSON.parse(json);
    if (d.elements)    state.elements    = d.elements;
    if (d.connections) state.connections = d.connections;
    if (d.setlist)     state.setlist     = d.setlist;
    if (d.riderNeeds)  state.riderNeeds  = d.riderNeeds;
    if (d.segments)    state.segments    = d.segments;
    if (d.canvasBg) {
      state.canvasBg = d.canvasBg;
      const cv = document.getElementById('stage-canvas');
      if (cv) cv.style.backgroundColor = d.canvasBg;
    }
    document.body.classList.add('share-mode');
    const gate = document.getElementById('sc-pw-gate');
    if (gate) gate.remove();
    if (typeof renderAll     === 'function') renderAll();
    if (typeof renderSetlist === 'function') renderSetlist();
    if (typeof renderRider   === 'function') renderRider();
  } catch(e) {
    if (errEl) { errEl.textContent = 'Failed to decode link.'; errEl.style.display = 'block'; }
  }
}

// ── CONTEXT MENU INJECTION (Pin + Preset + Delete) ───────────────────────────
// Fires after the original handler (300 ms setup) via listener added at 400 ms
function _injectCtxExtras(el) {
  const menu = document.getElementById('sc-ctx');
  if (!menu || menu.style.display === 'none' || !el) return;
  menu.querySelectorAll('.sc-ctx-injected').forEach(n => n.remove());
  function _irow(label, fn, danger) {
    const r = document.createElement('div');
    r.className = 'ctx-r sc-ctx-injected' + (danger ? ' ctx-dn' : '');
    r.textContent = label;
    r.onclick = () => { menu.style.display = 'none'; fn(); };
    return r;
  }
  function _isep() {
    const s = document.createElement('div');
    s.className = 'ctx-sep sc-ctx-injected';
    return s;
  }
  menu.appendChild(_isep());
  menu.appendChild(_irow(el.pinned ? 'Unpin Element' : 'Pin Element', () => scTogglePin(el)));
  menu.appendChild(_irow('Save as Preset', () => scSaveAsPreset()));
  menu.appendChild(_isep());
  menu.appendChild(_irow('Delete', () => {
    if (typeof scCtxDelete === 'function') scCtxDelete(el);
    else {
      if (typeof pushHistory === 'function') pushHistory();
      state.elements    = state.elements.filter(x => x.id !== el.id);
      state.connections = (state.connections || []).filter(c => c.from !== el.id && c.to !== el.id);
      if (typeof renderElements    === 'function') renderElements();
      if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
    }
  }, true));
  const mRect = menu.getBoundingClientRect();
  if (mRect.bottom > window.innerHeight - 6)
    menu.style.top = Math.max(0, window.innerHeight - mRect.height - 10) + 'px';
}

// Extras (Pin, Preset, Delete) are now injected directly from _show() above

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════
(function featuresInit() {
  // Add Assistant to navOrder
  if (typeof state !== 'undefined' && Array.isArray(state.navOrder)) {
    if (!state.navOrder.includes('Assistant')) {
      state.navOrder.push('Assistant');
    }
    if (typeof renderNav === 'function') renderNav();
  }

  // Init
  setTimeout(() => {
    try { _updateOnlineStatus(); } catch(e) { console.warn('[SC] _updateOnlineStatus error:', e); }
    try { renderLayerPanel(); } catch(e) { console.warn('[SC] renderLayerPanel error:', e); }
    try { updateConflictBanner(); } catch(e) { console.warn('[SC] updateConflictBanner error:', e); }
    try { _smRender(); } catch(e) { console.warn('[SC] _smRender error:', e); }
    try { _initProfessionalTools(); } catch(e) { console.warn('[SC] _initProfessionalTools error:', e); }
  }, 100);
})();
