import { useState, useRef, useEffect, useCallback } from 'react';

interface Tip {
  title: string;
  body: string;
}

interface Section {
  id: string;
  name: string;
  icon: string;
  color: string;
  tips: Tip[];
}

const SECTIONS: Section[] = [
  {
    id: 'warmup',
    name: 'Warming Up',
    icon: 'local_fire_department',
    color: '#f59e0b',
    tips: [
      {
        title: 'Lip trills',
        body: 'Blow air through closed lips so they vibrate loosely. Slide from your lowest comfortable note up to your highest and back down. This loosens your lips, jaw, and engages diaphragmatic airflow without straining your vocal folds. Do 5-6 slides over about 2 minutes.',
      },
      {
        title: 'Humming scales',
        body: 'Hum gently on "mmm" through a 5-note scale (do-re-mi-fa-sol) starting in a comfortable mid-range. Feel the buzz in your lips, nose, and forehead — that vibration means your resonators are engaged. Move the starting note up by a half-step each repetition. Keep your jaw relaxed and teeth slightly apart behind closed lips.',
      },
      {
        title: 'Tongue trills',
        body: 'Roll your tongue on an "rrr" while sliding pitch up and down your range. This warms up the tongue muscles and coordinates breath support with phonation. If you can\'t roll your tongue, substitute with a lip trill or a "vvv" buzz on your bottom lip.',
      },
      {
        title: 'Gentle sirens',
        body: 'On an "ooh" or "eee", glide smoothly from the bottom of your range to the top and back down in one breath — like an ambulance siren. Keep the volume soft. This stretches your vocal folds gradually and reveals where your register transitions (breaks) are so you can smooth them out over time.',
      },
      {
        title: 'Jaw and neck release',
        body: 'Before you sing a single note, massage your jaw joints (in front of your ears) in small circles. Drop your jaw open and let it hang — don\'t force it. Roll your neck slowly side to side. Tension in the jaw and neck directly restricts your larynx and limits your range.',
      },
    ],
  },
  {
    id: 'breath',
    name: 'Breath Control',
    icon: 'air',
    color: '#34d399',
    tips: [
      {
        title: 'Diaphragmatic breathing',
        body: 'Place one hand on your chest and one on your belly. Breathe in through your nose — only your belly hand should move outward. Your chest stays still. This engages your diaphragm, which is the muscle that controls airflow for singing. Practice this lying down first, then standing. 5 minutes daily will rewire your breathing habit.',
      },
      {
        title: 'The straw exercise',
        body: 'Breathe in fully, then exhale through a thin straw (or purse your lips tightly to simulate one). Try to keep a steady, consistent airflow for as long as possible — aim for 20-30 seconds. This trains your body to regulate air pressure, which directly translates to better sustain and dynamic control when singing.',
      },
      {
        title: 'Counted breathing',
        body: 'Inhale for 4 counts, hold for 4 counts, exhale on a sustained "sss" for 8 counts. As you improve, extend the exhale: 12, 16, even 20 counts. The exhale phase trains the slow, controlled release of air that powers sustained notes and long phrases without running out of breath.',
      },
      {
        title: 'Panting for support awareness',
        body: 'Do quick, short pants like a dog — "huh huh huh" — with your hand on your belly. You\'ll feel your abdominal muscles pulsing. That\'s your support mechanism. Now slow the pants down to a steady "huh... huh... huh..." and feel how each pulse connects to a controlled burst of air. This awareness transfers directly to staccato and dynamic singing.',
      },
      {
        title: 'Sustained tone on one breath',
        body: 'Pick a comfortable note and sing "ahh" on one breath for as long as you can. Time yourself. Don\'t push — keep the volume at a comfortable medium. Track your time weekly. A healthy untrained voice sustains about 15 seconds; with training, 25-35 seconds is achievable. This is the most direct measure of your breath support.',
      },
    ],
  },
  {
    id: 'pitch',
    name: 'Pitch & Ear Training',
    icon: 'music_note',
    color: '#007aff',
    tips: [
      {
        title: 'Matching single notes',
        body: 'Play a note on a piano, guitar, or app — then sing it back. Hold it and listen carefully. Are you slightly above (sharp) or below (flat)? Most people sing slightly flat when they start. Use a tuner app to check. Do this with random notes across your range, 10-15 per session. Accurate single-note matching is the foundation of all pitch work.',
      },
      {
        title: 'Interval training',
        body: 'Learn to hear and sing the common intervals by associating them with songs you know. A major 2nd sounds like the first two notes of "Happy Birthday." A perfect 5th is "Star Wars." A perfect 4th is "Here Comes the Bride." Practice singing these intervals up and down from any starting note until they become automatic.',
      },
      {
        title: 'Scale singing with a drone',
        body: 'Play a sustained root note (a drone) and sing a major scale over it: do-re-mi-fa-sol-la-ti-do. Listen to how each scale degree sounds against the drone. The 4th and 7th want to resolve — feel that tension. This trains relative pitch, which is far more useful than perfect pitch for real-world singing.',
      },
      {
        title: 'Singing back melodies',
        body: 'Listen to a short phrase from a song you like — just 4-8 notes. Pause it, then sing it back from memory. Check yourself by playing it again. Start with simple melodies and work up to more complex ones. This builds your musical memory and your ability to reproduce what you hear internally, which is the core of singing in tune.',
      },
      {
        title: 'Sliding vs. stepping',
        body: 'Many pitch problems come from sliding between notes instead of stepping cleanly. Practice singing two notes a whole step apart: sing the first, stop completely (brief silence), then sing the second. No scooping, no sliding. Once clean, remove the silence gap. This trains precision in your vocal fold tension changes.',
      },
    ],
  },
  {
    id: 'resonance',
    name: 'Resonance & Tone',
    icon: 'record_voice_over',
    color: '#a78bfa',
    tips: [
      {
        title: 'Finding your mask resonance',
        body: 'Hum on "mmm" and focus the buzz into the front of your face — the area around your nose, cheekbones, and forehead. This is called "mask resonance" or "forward placement." Now open to "mmm-ahh" while keeping that frontal buzz. If the buzz disappears, you\'ve fallen back into your throat. This forward placement is what gives a voice carry and brightness without volume.',
      },
      {
        title: 'The ng exercise',
        body: 'Sing "ng" (like the end of "sing") on a sustained note. This forces the sound through your nasal resonators. Now open to "ng-ah" while maintaining the nasal ring. Cycle through "ng-ah-ng-ah" on a single pitch. This is one of the most effective exercises for finding mix voice — the blend between chest and head voice that sounds full everywhere.',
      },
      {
        title: 'Vowel modification',
        body: 'As you sing higher, pure vowels stop working — "ee" becomes shrill, "ah" becomes shouty. The fix is subtle vowel modification: "ee" shifts toward "ih", "ah" shifts toward "uh", "oh" closes toward "oo". Practice singing a scale on "ah" and consciously rounding the vowel as you ascend. It should feel like the vowel narrows slightly. This is how professional singers sing high notes that sound effortless.',
      },
      {
        title: 'Chest voice vs. head voice',
        body: 'Place your hand on your chest and sing a low note on "ahh" — feel the vibration. That\'s chest voice. Now sing a high, light "ooh" and feel the vibration move to your head/skull. That\'s head voice. Practice the transition zone (your "bridge" or "passaggio") where one hands off to the other. The goal is to make this transition smooth and inaudible. Sirens on "ooh" through the bridge zone are the best exercise.',
      },
      {
        title: 'Open throat technique',
        body: 'Yawn — feel how the back of your throat opens up and your larynx drops? That\'s an open throat. Now try to recreate that feeling while singing "ahh" without actually yawning. Think "beginning of a yawn" rather than a full yawn. This space in your throat is where rich, warm tone comes from. If your throat feels tight or closed while singing, you\'re losing resonance and risking strain.',
      },
    ],
  },
  {
    id: 'range',
    name: 'Extending Your Range',
    icon: 'expand',
    color: '#ec4899',
    tips: [
      {
        title: 'Know your current range',
        body: 'Sing down to your lowest comfortable note and record it. Then sing up to your highest comfortable note (not falsetto — full voice) and record it. That\'s your current usable range. Most untrained singers have about 1.5 octaves. With training, 2-3 octaves is achievable. Track this monthly to see real progress.',
      },
      {
        title: 'Extending low notes',
        body: 'Low range is mostly about relaxation. Sing a descending scale on "oh" and let your voice get heavy and relaxed as you descend. Don\'t push for volume — low notes are naturally quieter. Practice vocal fry (that creaky sound) at your lowest pitches to train your vocal folds to vibrate at those slower rates. Over months, you can gain 2-4 low notes.',
      },
      {
        title: 'Extending high notes safely',
        body: 'Never shout your way to high notes. Instead, practice in head voice or falsetto first — get comfortable with those pitches. Then gradually add more chest voice energy through mix voice. Lip trills and "nay nay nay" (like a bratty child) through your break are the safest way to build high range. If it hurts or feels strained, you\'re pushing too hard. Back off and try again lighter.',
      },
      {
        title: 'The mix voice bridge',
        body: 'Your voice has a "break" (passaggio) where chest voice can\'t keep going up and head voice hasn\'t kicked in. For most men, this is around E4-G4; for most women, around A4-C5. Practice "nay" or "gee" scales through this zone at medium volume. These bright, twangy syllables help your vocal folds find the right coordination for mix voice without flipping or cracking.',
      },
      {
        title: 'Patience with range building',
        body: 'Range builds slowly — expect to gain maybe 2-3 notes over several months of consistent practice. Your vocal folds are muscles and the coordinating muscles need time to develop. Daily 15-minute sessions are far more effective than occasional hour-long sessions. Never sacrifice tone quality for range — a beautiful note in your comfortable range is worth more than a strained note at your limit.',
      },
    ],
  },
  {
    id: 'performance',
    name: 'Performance & Expression',
    icon: 'theater_comedy',
    color: '#ef4444',
    tips: [
      {
        title: 'Dynamics tell the story',
        body: 'Singing everything at the same volume is the fastest way to bore a listener. Practice singing a phrase starting soft, growing to loud, and pulling back to soft — even if the original song doesn\'t do this. Master the extremes: can you sing a phrase barely above a whisper? Can you belt the same phrase? The space between those extremes is your dynamic range, and it\'s what makes a performance compelling.',
      },
      {
        title: 'Phrasing and breath marks',
        body: 'Before you sing a song, decide where you\'ll breathe. Mark the lyrics — put a check mark where you\'ll take a breath. Breathe at natural phrase endings, not in the middle of words or thoughts. Plan your breaths so you always have enough air to finish each phrase with control. Running out of air mid-phrase is the most common amateur mistake and the easiest to fix with planning.',
      },
      {
        title: 'Consonants carry the words',
        body: 'Vowels carry the tone, but consonants carry the meaning. Exaggerate your consonants when practicing — really pop your P\'s, snap your T\'s, buzz your Z\'s. When performing, pull back to about 80% of that exaggeration. Most singers under-articulate, making lyrics muddy and unintelligible. Clear diction doesn\'t require volume — it requires intention.',
      },
      {
        title: 'Microphone technique',
        body: 'Hold the mic 1-3 inches from your mouth for normal singing. Pull back slightly on loud/belted notes, move closer for soft/intimate phrases. This is called "working the mic" and it\'s how professionals maintain consistent volume despite singing with huge dynamics. Never cup the mic head with your hand — it causes feedback and muddies the sound.',
      },
      {
        title: 'Emotional connection',
        body: 'Before you sing a song, decide what emotion you want to convey. Speak the lyrics out loud as if you\'re telling someone the story. Notice where you naturally emphasize words, where you slow down, where you get intense. Now sing it with those same intentions. Technical perfection without emotional connection sounds impressive but doesn\'t move anyone. Connection first, technique second.',
      },
    ],
  },
  {
    id: 'harmonies',
    name: 'Singing Harmonies',
    icon: 'stacked_line_chart',
    color: '#10b981',
    tips: [
      {
        title: 'What a harmony actually is',
        body: 'A harmony is a second voice singing a different note that sounds good with the melody. The most common harmony is a "third" — you sing the note that\'s two scale steps above or below the melody note. For example, if the melody sings C, the harmony sings E (a third above) or A (a third below). Every note the melody hits, your harmony note changes by the same interval relative to the scale. This is why harmonies follow the melody\'s shape but at a different pitch.',
      },
      {
        title: 'Start with thirds above',
        body: 'The easiest harmony to learn is singing a major or minor third above the melody. Pick a simple song you know well. Sing the melody once, then sing it again but start every note two scale steps higher. In C major: if the melody goes C-D-E, your harmony goes E-F-G. Some thirds will be major (4 semitones) and some minor (3 semitones) — this happens automatically if you stay in the key. Record the melody first in the Lab, then try singing the third on top.',
      },
      {
        title: 'Thirds below the melody',
        body: 'A third below is the harmony you hear in most country, folk, and pop music. If the melody sings E, you sing C. If the melody sings G, you sing E. The pattern: always drop two scale degrees. This sounds warmer and more grounded than a third above. Practice by playing a slow melody and singing along two notes lower in the scale. It feels like you\'re shadowing the melody from underneath.',
      },
      {
        title: 'Fifths for power and openness',
        body: 'A fifth above the melody (C melody → G harmony) creates a wide, powerful sound — think church music and anthems. Count up 4 scale steps from each melody note to find the fifth. Fifths are harmonically very stable and almost never clash. The drawback: they sound "hollow" compared to thirds and can feel generic if overused. Use fifths for choruses or climactic moments, and thirds for verses and intimate passages.',
      },
      {
        title: 'How to lock in with the melody',
        body: 'Harmony only works if you match the melody\'s rhythm exactly. Every syllable, every hold, every breath — precisely together. Record the melody track first, play it back through headphones (one ear only), and sing your harmony part along with it. If your timing drifts even slightly, the harmony falls apart. This is why practicing with your own recorded melody in the Lab is so valuable — you control the tempo and can loop sections.',
      },
      {
        title: 'Hearing the interval, not the melody',
        body: 'The hardest skill in harmony singing is hearing the melody and resisting the urge to sing it. You need to hear the melody in one "ear" of your brain while your voice produces a different note. Practice this: play and sustain a C note, then sing an E over it. Hold both. Feel the blend. Now have someone play a simple 3-note melody while you sing a third above each note. Start incredibly slow — speed comes after accuracy.',
      },
      {
        title: 'When harmony notes clash',
        body: 'Not every note harmonizes well at every interval. When a third above creates a dissonance (you\'ll hear it — it sounds "wrong"), shift to a fourth or a unison for that one note, then resume the third. These adjustments are called "voice leading" and they\'re what separates a good harmony from a mechanical one. Trust your ear: if it sounds sour on one note, move your harmony up or down by a half step until it resolves.',
      },
      {
        title: 'Building a three-part harmony',
        body: 'Once you can sing one harmony, stack a third one. The classic three-part: melody (middle), harmony a third above (high), harmony a third below (low). In C major on a C melody note: low voice sings A, melody sings C, high voice sings E — that\'s an A minor chord. On a G melody note: low sings E, melody sings G, high sings B — that\'s an E minor chord. Every melody note generates a chord. Use the Lab to record all three parts yourself.',
      },
      {
        title: 'Practice workflow in the Lab',
        body: 'Here\'s a concrete workflow: 1) Record the melody as Track 1. 2) Play it back and record a third above as Track 2. 3) Play both back and record a third below as Track 3. 4) Adjust volumes so all three blend — typically melody loudest, upper harmony slightly softer, lower harmony softest. 5) Pan the melody center, upper harmony slightly right, lower harmony slightly left. This creates a professional vocal stack from just your voice.',
      },
      {
        title: 'Intervals reference by semitones',
        body: 'Know your intervals by ear and by semitone count. Unison: 0 semitones (same note). Minor 2nd: 1 (dissonant, "Jaws" theme). Major 2nd: 2 ("Happy Birthday" first two notes). Minor 3rd: 3 (sad, minor key feel). Major 3rd: 4 (bright, major key feel). Perfect 4th: 5 ("Here Comes the Bride"). Perfect 5th: 7 ("Star Wars" opening). Octave: 12 (same note, higher). For harmony singing, thirds (3-4 semitones) and fifths (7 semitones) are your bread and butter.',
      },
    ],
  },
  {
    id: 'health',
    name: 'Vocal Health',
    icon: 'health_and_safety',
    color: '#06b6d4',
    tips: [
      {
        title: 'Hydration is non-negotiable',
        body: 'Your vocal folds need to be hydrated to vibrate efficiently. Drink water consistently throughout the day — not just right before singing. Room temperature water is best. Avoid caffeine and alcohol before singing as they dehydrate. If your voice feels "thick" or "sticky", you\'re probably dehydrated. Steam inhalation (hot shower, humidifier) helps hydrate the folds directly.',
      },
      {
        title: 'Rest days matter',
        body: 'Your vocal folds are muscles — they need recovery. If you sing intensely, take the next day easy. Signs you need rest: hoarseness lasting more than a day, feeling like you need to clear your throat constantly, a "scratchy" feeling when speaking. Pushing through these signals can lead to nodes (calluses on your vocal folds) that may require surgery.',
      },
      {
        title: 'Avoid throat clearing',
        body: 'That "ahem" throat clear is like slamming your vocal folds together violently. Instead, swallow hard, take a sip of water, or do a gentle hum. If you constantly feel the need to clear your throat, it might be reflux (acid reaching your throat) — talk to a doctor. Chronic throat clearing is one of the most damaging habits for singers.',
      },
      {
        title: 'Speaking voice habits',
        body: 'Most vocal damage happens from speaking, not singing. Don\'t speak in noisy environments (bars, concerts) without amplification — you\'ll unconsciously shout. Don\'t speak in a pitch that\'s too low for your natural voice (vocal fry speech). Don\'t whisper when your voice is tired — whispering actually strains the folds more than normal soft speech.',
      },
      {
        title: 'When to see a professional',
        body: 'See an ENT (ear, nose, throat doctor) or a voice specialist if: hoarseness lasts more than 2 weeks, you experience pain while singing or speaking, your range suddenly decreases, or you hear breathiness that wasn\'t there before. Early intervention prevents small problems from becoming permanent. A good voice teacher is also invaluable — even a few lessons can correct habits that take years to unlearn alone.',
      },
    ],
  },
];

const ANIM_CSS = `
@keyframes pp-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pp-slide-in {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes pp-slide-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-40px); }
}
@keyframes pp-expand {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

function useAnimStyle() {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const s = document.createElement('style');
    s.textContent = ANIM_CSS;
    document.head.appendChild(s);
    return () => { s.remove(); injected.current = false; };
  }, []);
}

function TipCard({ tip, color, index }: { tip: Tip; color: string; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyH, setBodyH] = useState(0);

  useEffect(() => {
    if (expanded && bodyRef.current) {
      setBodyH(bodyRef.current.scrollHeight);
    }
  }, [expanded]);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: '#161717',
        borderRadius: 16,
        padding: '18px 20px',
        cursor: 'pointer',
        border: `1px solid ${expanded ? color + '30' : '#1f2020'}`,
        transition: 'border-color 250ms ease, box-shadow 250ms ease',
        boxShadow: expanded ? `0 0 20px ${color}08` : 'none',
        animation: `pp-fade-up 400ms cubic-bezier(0.22,1,0.36,1) ${index * 60}ms both`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14,
          color: color, opacity: 0.5, minWidth: 20,
          transition: 'opacity 200ms ease',
          ...(expanded ? { opacity: 0.9 } : {}),
        }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15,
          color: '#e7e5e4', flex: 1,
        }}>
          {tip.title}
        </span>
        <span className="material-symbols-outlined" style={{
          fontSize: 18, color: expanded ? color : '#484848',
          transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1), color 250ms ease',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          expand_more
        </span>
      </div>
      <div style={{
        overflow: 'hidden',
        maxHeight: expanded ? bodyH + 20 : 0,
        transition: 'max-height 350ms cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div ref={bodyRef}>
          <div style={{
            maxHeight: 200,
            overflowY: 'auto',
            marginTop: 14,
            paddingLeft: 34,
            WebkitOverflowScrolling: 'touch',
          }}>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#a8a6a5',
              lineHeight: 1.7, margin: 0,
              animation: expanded ? 'pp-expand 300ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}>
              {tip.body}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionView({ section }: { section: Section }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {section.tips.map((tip, i) => (
        <TipCard key={i} tip={tip} color={section.color} index={i} />
      ))}
    </div>
  );
}

export default function PracticePanel() {
  useAnimStyle();
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [displaySection, setDisplaySection] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const goToSection = useCallback((id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDirection('in');
    setTransitioning(true);
    setDisplaySection(id);
    timerRef.current = setTimeout(() => {
      setTransitioning(false);
      timerRef.current = null;
    }, 400);
  }, []);

  const goBack = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDirection('out');
    setTransitioning(true);
    timerRef.current = setTimeout(() => {
      setDisplaySection(null);
      setTransitioning(false);
      timerRef.current = null;
    }, 250);
  }, []);

  if (displaySection) {
    const section = SECTIONS.find(s => s.id === displaySection)!;
    return (
      <div style={{
        padding: '16px 20px', minHeight: '100%',
        animation: direction === 'in'
          ? 'pp-slide-in 350ms cubic-bezier(0.22,1,0.36,1) both'
          : (transitioning ? 'pp-slide-out 250ms cubic-bezier(0.22,1,0.36,1) both' : 'none'),
      }}>
        <button
          onClick={goBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13,
            padding: 0, marginBottom: 24,
            transition: 'color 150ms ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          Back
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
          animation: 'pp-fade-up 400ms cubic-bezier(0.22,1,0.36,1) 50ms both',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${section.color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: section.color }}>
              {section.icon}
            </span>
          </div>
          <div>
            <h2 style={{
              fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22,
              color: '#e7e5e4', margin: 0,
            }}>
              {section.name}
            </h2>
            <span style={{
              fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#767575',
            }}>
              {section.tips.length} tips
            </span>
          </div>
        </div>

        <SectionView section={section} />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 20px', minHeight: '100%' }}>
      <h2 style={{
        fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 24,
        color: '#e7e5e4', margin: '0 0 6px',
        animation: 'pp-fade-up 400ms cubic-bezier(0.22,1,0.36,1) both',
      }}>
        Tips
      </h2>
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#767575',
        margin: '0 0 28px', lineHeight: 1.5,
        animation: 'pp-fade-up 400ms cubic-bezier(0.22,1,0.36,1) 60ms both',
      }}>
        Real vocal techniques that actually work. Pick a section and learn at your own pace.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SECTIONS.map((section, i) => (
          <div
            key={section.id}
            onClick={() => goToSection(section.id)}
            style={{
              background: '#161717',
              borderRadius: 16,
              padding: '20px',
              cursor: 'pointer',
              border: '1px solid #1f2020',
              transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), border-color 200ms ease, box-shadow 200ms ease',
              display: 'flex', alignItems: 'center', gap: 16,
              animation: `pp-fade-up 400ms cubic-bezier(0.22,1,0.36,1) ${100 + i * 50}ms both`,
            }}
            onPointerDown={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
            }}
            onPointerUp={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
            onPointerLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `${section.color}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: section.color }}>
                {section.icon}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16,
                color: '#e7e5e4', margin: 0,
              }}>
                {section.name}
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#767575',
                margin: '3px 0 0',
              }}>
                {section.tips.length} tips
              </p>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#484848' }}>
              chevron_right
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
