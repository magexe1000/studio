import { useStudioPreferences } from '@workspace/studio-core';
import { StudioLogo } from '@workspace/ui-shared';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import LandingNavbar from './components/LandingNavbar';
import LandingHero from './components/LandingHero';
import LandingAppSuite from './components/LandingAppSuite';
import LandingFeatureGrid from './components/LandingFeatureGrid';
import LandingContainerScroll from './components/LandingContainerScroll';
import LandingMacbookScroll from './components/LandingMacbookScroll';
import Landing3DMarquee from './components/Landing3DMarquee';
import LandingDownloads from './components/LandingDownloads';
import LandingFooter from './components/LandingFooter';

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

  const { preferences } = useStudioPreferences();
  const isReduced = preferences.reduceMotion;

  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('studio:landingIntroSeen');
  });

  const [introStep, setIntroStep] = useState<'logo-in' | 'logo-hold' | 'logo-out' | 'done'>(() => {
    if (typeof window === 'undefined') return 'done';
    if (sessionStorage.getItem('studio:landingIntroSeen')) return 'done';
    return 'logo-in';
  });

  useEffect(() => {
    if (introStep === 'done') {
      setShowIntro(false);
      return;
    }

    if (isReduced) {
      sessionStorage.setItem('studio:landingIntroSeen', 'true');
      setShowIntro(false);
      setIntroStep('done');
      return;
    }

    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;

    if (introStep === 'logo-in') {
      t1 = setTimeout(() => {
        setIntroStep('logo-hold');
      }, 550);
    } else if (introStep === 'logo-hold') {
      t2 = setTimeout(() => {
        setIntroStep('logo-out');
      }, 800);
    } else if (introStep === 'logo-out') {
      t3 = setTimeout(() => {
        sessionStorage.setItem('studio:landingIntroSeen', 'true');
        setIntroStep('done');
        setShowIntro(false);
      }, 650);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [introStep, isReduced]);

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
        console.warn('Failed to fetch app-release.json, using fallback:', err);
        setRelease({
          version: '3.6.28',
          apkUrl: 'https://github.com/MAGEXE1000/Studio/releases/download/v3.6.28/studio-3.6.28.apk',
          apkSizeBytes: 14125258
        });
        setLoadingRelease(false);
      });
  }, []);

  return (
    <>
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center select-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, filter: 'blur(4px)' }}
              animate={
                introStep === 'logo-in'
                  ? { opacity: 1, scale: 1, filter: 'blur(0px)' }
                  : introStep === 'logo-hold'
                  ? { opacity: 1, scale: 1, filter: 'blur(0px)' }
                  : { opacity: 0, scale: 0.96, filter: 'blur(2px)' }
              }
              transition={{ duration: introStep === 'logo-out' ? 0.5 : 0.55, ease: 'easeInOut' }}
              className="text-white flex flex-col items-center gap-4"
            >
              <StudioLogo size={80} />
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={introStep !== 'logo-out' ? { opacity: 0.6, y: 0 } : { opacity: 0, y: -2 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-400 select-none landing-font-heading"
              >
                Studio
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={showIntro ? { opacity: 0 } : { opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-screen bg-[#030303] text-[#f2f1ef] font-sans selection:bg-zinc-800/40 overflow-x-hidden"
      >
      {/* Navbar */}
      <LandingNavbar navigateTo={navigateTo} />

      {/* Hero Section */}
      <LandingHero navigateTo={navigateTo} apkUrl={release?.apkUrl} />

      {/* MacBook Scroll Showcase */}
      <section id="showcase" className="py-12 bg-[#030303] border-t border-zinc-900/60">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-xl md:text-3xl font-extrabold tracking-tight uppercase text-zinc-400 select-none">
            A Live Music Suite in Your Hands
          </h2>
        </div>
        <LandingMacbookScroll mockupName="chordLib" />
      </section>

      {/* App Bento Suite */}
      <LandingAppSuite />

      {/* Container Scroll Section */}
      <LandingContainerScroll 
        titleText="From songs to stage-ready workflows."
        descriptionText="Start with songs and chords, plan your live setup, then practice with groove and vocal tools without leaving Studio."
        mockupName="stage"
      />

      {/* 3D Marquee Showcases */}
      <Landing3DMarquee />

      {/* Core Technical Grid */}
      <LandingFeatureGrid />

      {/* Downloads / Platforms Block */}
      <LandingDownloads 
        navigateTo={navigateTo} 
        apkUrl={release?.apkUrl} 
        apkVersion={release?.version} 
        apkSizeBytes={release?.apkSizeBytes}
        loadingRelease={loadingRelease}
      />

      {/* Footer */}
      <LandingFooter 
        navigateTo={navigateTo} 
        apkUrl={release?.apkUrl} 
        apkVersion={release?.version} 
      />
      </motion.div>
    </>
  );
}
