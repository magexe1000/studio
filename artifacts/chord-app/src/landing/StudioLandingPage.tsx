import React, { useState, useEffect } from 'react';
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
    <div className="min-h-screen bg-[#030303] text-[#f2f1ef] font-sans selection:bg-zinc-800/40 overflow-x-hidden">
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
        <LandingMacbookScroll mockupName="hub" />
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
    </div>
  );
}
