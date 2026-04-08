import { useState } from 'react';

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

function TipCard({ tip, color, index }: { tip: Tip; color: string; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: '#161717',
        borderRadius: 16,
        padding: '18px 20px',
        cursor: 'pointer',
        border: `1px solid ${expanded ? color + '30' : '#1f2020'}`,
        transition: 'all 200ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14,
          color: color, opacity: 0.5, minWidth: 20,
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
          fontSize: 18, color: '#484848',
          transition: 'transform 200ms ease',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          expand_more
        </span>
      </div>
      {expanded && (
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#a8a6a5',
          lineHeight: 1.7, margin: '14px 0 0', paddingLeft: 34,
        }}>
          {tip.body}
        </p>
      )}
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
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (activeSection) {
    const section = SECTIONS.find(s => s.id === activeSection)!;
    return (
      <div style={{ padding: '16px 20px', minHeight: '100%' }}>
        <button
          onClick={() => setActiveSection(null)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13,
            padding: 0, marginBottom: 24,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
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
      }}>
        Tips & Techniques
      </h2>
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#767575',
        margin: '0 0 28px', lineHeight: 1.5,
      }}>
        Real vocal techniques that actually work. Pick a section and learn at your own pace.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SECTIONS.map(section => (
          <div
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              background: '#161717',
              borderRadius: 16,
              padding: '20px',
              cursor: 'pointer',
              border: '1px solid #1f2020',
              transition: 'all 150ms ease',
              display: 'flex', alignItems: 'center', gap: 16,
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
