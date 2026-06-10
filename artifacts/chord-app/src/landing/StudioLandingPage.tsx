import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Download, 
  Layers, 
  Smartphone, 
  Monitor, 
  Globe, 
  Check, 
  Sparkles, 
  Music, 
  Users, 
  Sliders, 
  Activity,
  Mic,
  Clock,
  CloudLightning,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { 
  StudioLogo, 
  ChordexLogo, 
  DrumexLogo, 
  StagexLogoIcon, 
  GroovexLogo, 
  VocalexLogo 
} from '../components/ChordexLogo';
import { 
  MacbookScroll, 
  ContainerScroll, 
  Marquee3D 
} from './LandingComponents';

interface StudioLandingPageProps {
  navigateTo: (path: string) => void;
}

interface ReleaseInfo {
  version: string;
  apkUrl: string;
  apkSizeBytes?: number;
}

export default function StudioLandingPage({ navigateTo }: StudioLandingPageProps) {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loadingRelease, setLoadingRelease] = useState(true);

  useEffect(() => {
    fetch('/app-release.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP error ${r.status}`);
        return r.json();
      })
      .then(data => {
        setRelease({
          version: data.version || data.versionName || '3.6.28',
          apkUrl: data.apkUrl || data.download_url || 'https://github.com/MAGEXE1000/Studio/releases/download/v3.6.28/studio-3.6.28.apk',
          apkSizeBytes: data.apkSizeBytes || 14125258
        });
        setLoadingRelease(false);
      })
      .catch(err => {
        console.warn('Failed to fetch app-release.json metadata, using fallback:', err);
        setRelease({
          version: '3.6.28',
          apkUrl: 'https://github.com/MAGEXE1000/Studio/releases/download/v3.6.28/studio-3.6.28.apk',
          apkSizeBytes: 14125258
        });
        setLoadingRelease(false);
      });
  }, []);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `(${mb.toFixed(1)} MB)`;
  };

  return (
    <div className="min-h-screen bg-[#030303] text-[#f2f1ef] font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* ── HEADER / NAVIGATION ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#030303]/75 backdrop-blur-md transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-extrabold text-white shadow-lg shadow-blue-500/20">
              S
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-blue-400">
              Studio
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
            <a href="#suite" className="hover:text-white transition-colors duration-200">Apps</a>
            <a href="#features" className="hover:text-white transition-colors duration-200">Features</a>
            <a href="#downloads" className="hover:text-white transition-colors duration-200">Downloads</a>
          </nav>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigateTo('/app')}
              className="px-4 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200 backdrop-blur-sm"
            >
              Use Studio Web
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 px-4 overflow-hidden bg-grid-pattern">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] md:w-[600px] h-[350px] md:h-[600px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none z-0" />
        <div className="absolute top-10 right-10 w-[200px] h-[200px] rounded-full bg-indigo-500/5 blur-[80px] pointer-events-none z-0" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] md:text-xs font-bold tracking-wide uppercase mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            Adaptive Web Version 4.0.0 Live
          </div>

          {/* Heading */}
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight leading-none mb-6">
            One workspace for your <br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500">
              entire music workflow.
            </span>
          </h1>

          {/* Description */}
          <p className="max-w-2xl mx-auto text-base md:text-xl text-white/60 leading-relaxed mb-10">
            Studio is a premium music productivity suite for organizing songs, exploring chords, planning stages, practicing grooves, and building better live workflows.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => navigateTo('/app')}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02]"
            >
              Use Studio Web
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href={release?.apkUrl}
              className="w-full sm:w-auto px-8 py-3.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02]"
            >
              <Download className="w-4 h-4 text-blue-400" />
              Download Android APK
            </a>
            <button
              disabled
              className="w-full sm:w-auto px-8 py-3.5 bg-white/[0.02] text-white/30 font-medium rounded-xl border border-white/5 cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Monitor className="w-4 h-4 text-white/20" />
              Windows App (Soon)
            </button>
          </div>
        </div>

        {/* Hero Laptop Showcase (Integrated) */}
        <div className="w-full max-w-5xl mx-auto mt-4">
          <MacbookScroll mockupName="hub" />
        </div>
      </section>

      {/* ── APP SUITE SECTION ────────────────────────────────────────────── */}
      <section id="suite" className="py-24 border-t border-white/5 bg-[#050508]/40 relative">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              Integrated Music Suite
            </h2>
            <p className="text-white/50 text-base md:text-lg">
              No more switching between separate apps. Studio houses five tailored tools built to run together as a single unified ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Chordex */}
            <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-blue-500/30 transition-all duration-300 flex flex-col justify-between shadow-xl hover:-translate-y-1">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                    <ChordexLogo size={28} />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full">Chordex</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">Chordex Songs & Library</h3>
                <p className="text-sm text-white/50 mb-6 leading-relaxed">
                  Organize songs, explore chord diagrams, and transpose keys instantly on the fly. Keep your entire backing library at your fingertips.
                </p>
                <ul className="space-y-2.5 text-xs text-white/70">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    Interactive guitar chord chart library
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    Key transposition & song setlists
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    Custom fingering templates
                  </li>
                </ul>
              </div>
            </div>

            {/* Stagex */}
            <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between shadow-xl hover:-translate-y-1">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <StagexLogoIcon size={28} />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">Stagex</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">Stagex Layout Planner</h3>
                <p className="text-sm text-white/50 mb-6 leading-relaxed">
                  Design stage plots and prepare clean setups. Keep your live gigs organized and communicate layouts directly with tech crews.
                </p>
                <ul className="space-y-2.5 text-xs text-white/70">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    Drag-and-drop monitors, amps, and gear
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    Custom tech rider exports
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    Clear channel input lists
                  </li>
                </ul>
              </div>
            </div>

            {/* Groovex */}
            <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-amber-500/30 transition-all duration-300 flex flex-col justify-between shadow-xl hover:-translate-y-1">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                    <GroovexLogo size={28} />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">Groovex</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">Groovex Mixer Studio</h3>
                <p className="text-sm text-white/50 mb-6 leading-relaxed">
                  Practice with backing tracks. Load stems, isolate instruments, adjust volumes, and loop sections with a gorgeous glass fader deck.
                </p>
                <ul className="space-y-2.5 text-xs text-white/70">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    Independent multitrack faders
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    A-B looping & section training
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    Dynamic speed / tempo scale controls
                  </li>
                </ul>
              </div>
            </div>

            {/* Drumex */}
            <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-purple-500/30 transition-all duration-300 flex flex-col justify-between shadow-xl hover:-translate-y-1">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                    <DrumexLogo size={28} />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full">Drumex</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">Drumex Sheets & Tempo</h3>
                <p className="text-sm text-white/50 mb-6 leading-relaxed">
                  Build snare charts, practice rudiments, and sync tempos. Master your rhythm with interactive, low-latency visual click tracking.
                </p>
                <ul className="space-y-2.5 text-xs text-white/70">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    Snare sheets & rudiment designer
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    Interactive beat indicator grid
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    Tempo accelerator practice trainer
                  </li>
                </ul>
              </div>
            </div>

            {/* Vocalex */}
            <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-pink-500/30 transition-all duration-300 flex flex-col justify-between shadow-xl hover:-translate-y-1">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-pink-500/10 text-pink-400 rounded-xl">
                    <VocalexLogo size={28} />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-pink-400 bg-pink-500/10 px-2.5 py-0.5 rounded-full">Vocalex</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-pink-400 transition-colors">Vocalex Pitch & Recording</h3>
                <p className="text-sm text-white/50 mb-6 leading-relaxed">
                  Train your vocals with real-time feedback. Track pitch accuracy, practice warmups, and record takes to watch your progress.
                </p>
                <ul className="space-y-2.5 text-xs text-white/70">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                    Real-time vocal pitch visual tracing
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                    Audio take recorder & file logger
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                    Target warmups & target scaling
                  </li>
                </ul>
              </div>
            </div>

            {/* Core Hub */}
            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 flex flex-col justify-between shadow-xl hover:-translate-y-1">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/15 text-blue-400 rounded-xl">
                    <StudioLogo size={28} />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-500/20 px-2.5 py-0.5 rounded-full">Studio Hub</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Central App Dashboard</h3>
                <p className="text-sm text-white/50 mb-6 leading-relaxed">
                  Switch instantly between all apps. Seamlessly integrates settings, notifications, updates, and your backup systems.
                </p>
                <ul className="space-y-2.5 text-xs text-white/70">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    One-tap app mode selector
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    Integrated update alerts & installer
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    Backup imports & settings syncer
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTAINER SCROLL SECTION ────────────────────────────────────── */}
      <section className="py-12 border-t border-white/5 bg-[#030303]">
        <ContainerScroll
          titleComponent={
            <div className="max-w-3xl mx-auto px-4">
              <h2 className="text-3xl md:text-6xl font-extrabold tracking-tight text-white mb-4">
                From idea to performance.
              </h2>
              <p className="text-white/60 text-sm md:text-lg max-w-xl mx-auto">
                Move from chords and songs to stage planning and practice without switching between scattered tools.
              </p>
            </div>
          }
        >
          <div className="aspect-video w-full">
            <iframe 
              src="/app" 
              title="Studio App Preview" 
              className="w-full h-full border-none pointer-events-none scale-100 origin-top opacity-90"
              style={{ minHeight: '480px' }}
            />
          </div>
        </ContainerScroll>
      </section>

      {/* ── MACBOOK SHOWCASE SECTION ─────────────────────────────────────── */}
      <section className="py-24 border-t border-white/5 bg-[#050508]/40 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -bottom-48 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                Cross-Platform Power
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Built for desktop, tablet, and mobile.
              </h2>
              <p className="text-white/60 text-base leading-relaxed">
                Studio features an adaptive 4.0.0 navigation layout. It transforms dynamically to fit your screen size—whether on a laptop, iPad, or mobile phone.
              </p>
              
              <div className="space-y-4 pt-2">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-blue-400 flex-shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Responsive Web Dock</h4>
                    <p className="text-xs text-white/50 mt-1">Saves layout space on wider screens while collapsing on phones.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Full Keyboard Shortcuts</h4>
                    <p className="text-xs text-white/50 mt-1">Accelerate workflows using desktop shortcuts for chord searching and transport playback.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Single-Page App Navigation</h4>
                    <p className="text-xs text-white/50 mt-1">No layout flashes. Smooth state transitions keep you focused on rehearsal.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex justify-center">
              <MacbookScroll mockupName="chords" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 3D MARQUEE GALLERY SECTION ───────────────────────────────────── */}
      <section className="py-24 border-t border-white/5 bg-[#030303] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            Designed for real music settings.
          </h2>
          <p className="text-white/50 text-sm md:text-lg max-w-xl mx-auto">
            A moving look at active dashboards, song libraries, mixers, and stage plot tools in action.
          </p>
        </div>

        <Marquee3D />
      </section>

      {/* ── FEATURE SHOWCASE GRID ───────────────────────────────────────── */}
      <section id="features" className="py-24 border-t border-white/5 bg-[#050508]/40 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              Premium Core Features
            </h2>
            <p className="text-white/50 text-base md:text-lg">
              Behind the beautiful layout lies a professional engine designed to support your music career.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Sync */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <CloudLightning className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Instant Cloud Sync</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Connect your account to sync favorites, active progressions, presets, and customized stage grids. Real-time updates push automatically across your laptop and tablet.
              </p>
            </div>

            {/* Offline-First */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Offline-First Design</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Rehearse in basement studios or perform on offline stages. Local storage ensures your song list, chords, and layouts remain responsive even without an internet connection.
              </p>
            </div>

            {/* Web Audio */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Music className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Web Audio Core</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Built-in low latency audio tools support recording voice warmups, scaling multitrack backing tempos, and generating rudiment metronome clicks directly inside the web engine.
              </p>
            </div>

            {/* No Lag */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Zero Overhead</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                We avoid bulky layout shifting and slow particle scripts. Lightweight rendering is optimized for older stage tablets, saving processor battery life during live shows.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORMS / DOWNLOADS SECTION ─────────────────────────────────── */}
      <section id="downloads" className="py-24 border-t border-white/5 bg-[#030303] relative">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              Get Studio on your devices.
            </h2>
            <p className="text-white/50 text-base md:text-lg">
              Open the Web app instantly or download the APK to run Studio natively on your Android setup.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Web App */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Studio Web</h3>
                    <span className="text-[10px] text-blue-400 uppercase font-extrabold">Instant Access</span>
                  </div>
                </div>
                <p className="text-sm text-white/50 leading-relaxed mb-6">
                  Access the complete suite directly in your browser. Fully adaptive layout optimized for all viewport sizes.
                </p>
                <div className="space-y-2 mb-8 text-xs text-white/60">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Web Version</span>
                    <span className="font-bold text-white">4.0.0</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Browser Compatibility</span>
                    <span className="font-bold text-white">Chrome, Safari, Firefox</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Automatic Updates</span>
                    <span className="font-bold text-emerald-400">Yes (Instant)</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => navigateTo('/app')}
                className="w-full py-3 bg-white text-[#030303] hover:bg-white/90 font-bold rounded-xl transition-all duration-200"
              >
                Use Studio Web
              </button>
            </div>

            {/* Android APK */}
            <div className="p-8 rounded-2xl bg-[#09090c] border border-blue-500/30 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Android Native</h3>
                    <span className="text-[10px] text-indigo-400 uppercase font-extrabold">Direct APK</span>
                  </div>
                </div>
                <p className="text-sm text-white/50 leading-relaxed mb-6">
                  Download the companion Android APK. Installs on mobile phones and tablets for offline native control.
                </p>
                <div className="space-y-2 mb-8 text-xs text-white/60">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>APK Version</span>
                    <span className="font-bold text-white">{loadingRelease ? '3.6.28' : release?.version}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>APK Size</span>
                    <span className="font-bold text-white">{loadingRelease ? '~13.5 MB' : formatBytes(release?.apkSizeBytes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min OS Target</span>
                    <span className="font-bold text-white">Android 8.0+</span>
                  </div>
                </div>
              </div>
              <div>
                <a 
                  href={release?.apkUrl}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  <Download className="w-4.5 h-4.5" />
                  Download Android APK
                </a>
                <p className="text-[9px] text-white/40 text-center mt-3 leading-normal">
                  * Note: Requires allowing installation from unknown sources in Android system settings since this is a manual APK install.
                </p>
              </div>
            </div>

            {/* Windows App */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between shadow-2xl relative opacity-85">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-white/5 text-white/40 flex items-center justify-center">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white/80">Windows Desktop</h3>
                    <span className="text-[10px] text-white/40 uppercase font-extrabold">Auto-updating EXE</span>
                  </div>
                </div>
                <p className="text-sm text-white/40 leading-relaxed mb-6">
                  Coming soon. A native auto-updating Windows desktop application for band rooms and live workstations.
                </p>
                <div className="space-y-2 mb-8 text-xs text-white/40">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Windows Version</span>
                    <span className="font-bold">In Development</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Installer Format</span>
                    <span className="font-bold">EXE</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target OS</span>
                    <span className="font-bold">Windows 10/11</span>
                  </div>
                </div>
              </div>
              <button 
                disabled 
                className="w-full py-3 bg-white/5 text-white/30 font-bold rounded-xl border border-white/5 cursor-not-allowed"
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#030303] py-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start mb-12">
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-extrabold text-white">
                  S
                </div>
                <span className="font-extrabold text-base tracking-tight text-white">
                  Studio
                </span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed max-w-sm">
                Studio is a product-suite designed for band managers, music performers, and sound technicians. Build chord sequences, arrange stage layouts, practice beats, and trace vocals in one dashboard.
              </p>
            </div>

            <div className="md:col-span-7 grid grid-cols-3 gap-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-4">Products</h4>
                <ul className="space-y-2 text-xs text-white/40">
                  <li><button onClick={() => navigateTo('/app')} className="hover:text-white transition-colors">Chordex</button></li>
                  <li><button onClick={() => navigateTo('/app')} className="hover:text-white transition-colors">Stagex</button></li>
                  <li><button onClick={() => navigateTo('/app')} className="hover:text-white transition-colors">Groovex</button></li>
                  <li><button onClick={() => navigateTo('/app')} className="hover:text-white transition-colors">Drumex</button></li>
                  <li><button onClick={() => navigateTo('/app')} className="hover:text-white transition-colors">Vocalex</button></li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-4">Downloads</h4>
                <ul className="space-y-2 text-xs text-white/40">
                  <li><button onClick={() => navigateTo('/app')} className="hover:text-white transition-colors">Use Web App</button></li>
                  <li><a href={release?.apkUrl} className="hover:text-white transition-colors">Download APK</a></li>
                  <li><span className="text-white/20 cursor-not-allowed">Windows (Soon)</span></li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-4">Resources</h4>
                <ul className="space-y-2 text-xs text-white/40">
                  <li><span className="text-white/20 cursor-not-allowed">Release Notes</span></li>
                  <li><span className="text-white/20 cursor-not-allowed">GitHub Releases</span></li>
                  <li><span className="text-white/20 cursor-not-allowed">Privacy Policy</span></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-white/30">
            <p>Copyright © 2026 Mag Studio. All rights reserved.</p>
            <div className="flex gap-6">
              <span>Web Version 4.0.0</span>
              <span>Android Version {loadingRelease ? '3.6.28' : release?.version}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
