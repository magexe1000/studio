let preferredVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

function loadVoices(): SpeechSynthesisVoice[] {
  const all = speechSynthesis.getVoices();
  if (all.length > 0) voicesLoaded = true;
  return all;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (preferredVoice) return preferredVoice;
  const voices = loadVoices();
  if (!voices.length) return null;

  const ranked = [
    (v: SpeechSynthesisVoice) => /samantha/i.test(v.name) && v.lang.startsWith('en'),
    (v: SpeechSynthesisVoice) => /karen/i.test(v.name) && v.lang.startsWith('en'),
    (v: SpeechSynthesisVoice) => /google.*us.*female/i.test(v.name),
    (v: SpeechSynthesisVoice) => /google.*uk.*female/i.test(v.name),
    (v: SpeechSynthesisVoice) => /microsoft.*zira/i.test(v.name),
    (v: SpeechSynthesisVoice) => /female/i.test(v.name) && v.lang.startsWith('en'),
    (v: SpeechSynthesisVoice) => v.lang.startsWith('en') && v.localService,
    (v: SpeechSynthesisVoice) => v.lang.startsWith('en'),
  ];

  for (const test of ranked) {
    const match = voices.find(test);
    if (match) { preferredVoice = match; return match; }
  }

  preferredVoice = voices[0];
  return voices[0];
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener('voiceschanged', () => {
    preferredVoice = null;
    pickVoice();
  });
  loadVoices();
}

export function stopCoach() {
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel();
  }
}

export function speak(text: string, opts?: { rate?: number; pitch?: number; onEnd?: () => void }) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = 'en-US';
  u.rate = opts?.rate ?? 0.92;
  u.pitch = opts?.pitch ?? 1.05;
  u.volume = 0.85;
  if (opts?.onEnd) u.onend = opts.onEnd;
  speechSynthesis.speak(u);
}

export function speakInstruction(instruction: string) {
  const cleaned = instruction
    .replace(/[↑↓→]/g, '')
    .replace(/…/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  speak(cleaned, { rate: 0.88 });
}

export function speakCoachingTip(tip: string) {
  speak(tip, { rate: 0.9, pitch: 1.0 });
}

export function speakCountdown(n: number, onDone?: () => void) {
  speak(String(n), { rate: 1.0, pitch: 1.1, onEnd: onDone });
}

export function speakNote(note: string) {
  const name = note.replace(/\d/g, ' ').replace('#', ' sharp').trim();
  speak(name, { rate: 1.0, pitch: 1.1 });
}

export function announceExercise(name: string, description: string) {
  speak(`${name}. ${description}`, { rate: 0.88, pitch: 1.0 });
}

export function announceStepChange(instruction: string) {
  const cleaned = instruction
    .replace(/[↑↓→"…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  speak(cleaned, { rate: 0.92 });
}

export function announceCompletion(score: number) {
  const pct = Math.round(score);
  let msg: string;
  if (pct >= 90) msg = `Great job! You scored ${pct} percent. Excellent work.`;
  else if (pct >= 70) msg = `Nice work! You scored ${pct} percent. Keep it up.`;
  else if (pct >= 50) msg = `You scored ${pct} percent. Good effort, keep practicing.`;
  else msg = `You scored ${pct} percent. Don't worry, practice makes progress.`;
  speak(msg, { rate: 0.88, pitch: 1.0 });
}
