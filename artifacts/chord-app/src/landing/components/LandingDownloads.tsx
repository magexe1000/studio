import React from 'react';
import { Globe, Smartphone, Monitor, Download } from 'lucide-react';
import { formatBytes } from '../landingUtils';

interface LandingDownloadsProps {
  navigateTo: (path: string) => void;
  apkUrl?: string;
  apkVersion?: string;
  apkSizeBytes?: number;
  loadingRelease?: boolean;
}

export default function LandingDownloads({
  navigateTo,
  apkUrl,
  apkVersion = '3.6.28',
  apkSizeBytes,
  loadingRelease
}: LandingDownloadsProps) {
  return (
    <section id="downloads" className="py-24 border-t border-zinc-900 bg-[#030303] relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white uppercase mb-4">
            Deployment & Platforms
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
            Choose the best runtime version for your music setup. Open the instant Web platform or sideload the native Android build.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Web App */}
          <div className="p-8 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase text-white tracking-wide">Studio Web</h3>
                  <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Instant Sandbox</span>
                </div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                Mount the fully adaptive responsive client directly in any browser. Supports active syncing and full layout custom sizing.
              </p>
              <div className="space-y-2.5 mb-8 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span>Version</span>
                  <span className="text-white">4.0.0</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span>Requirements</span>
                  <span className="text-white">Modern Browser</span>
                </div>
                <div className="flex justify-between">
                  <span>Hot Updates</span>
                  <span className="text-zinc-400">Automatic</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => {
                sessionStorage.setItem('studio:entered_from_landing', 'true');
                navigateTo('/app');
              }}
              className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 active:scale-[0.98]"
            >
              Use Studio Web
            </button>
          </div>

          {/* Android APK */}
          <div className="p-8 rounded-xl bg-zinc-950 border border-zinc-100/[0.15] flex flex-col justify-between shadow-2xl relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-100/[0.01] rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase text-white tracking-wide">Android Client</h3>
                  <span className="text-[9px] text-zinc-300 uppercase tracking-widest font-bold">Direct Install</span>
                </div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                Install the companion APK for tablets, touch displays, and handheld hardware. Optimized for offline stage setups.
              </p>
              <div className="space-y-2.5 mb-8 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span>APK Version</span>
                  <span className="text-white">{apkVersion}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span>Download Size</span>
                  <span className="text-white">{loadingRelease ? '~13.5 MB' : formatBytes(apkSizeBytes)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum Target</span>
                  <span className="text-white">Android 8.0+</span>
                </div>
              </div>
            </div>
            <div>
              {apkUrl ? (
                <a 
                  href={apkUrl}
                  className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Download Android APK
                </a>
              ) : (
                <button 
                  disabled
                  className="w-full py-3 bg-zinc-900 text-zinc-600 text-xs font-bold uppercase tracking-wider rounded-lg border border-zinc-800 cursor-not-allowed"
                >
                  APK Unavailable
                </button>
              )}
              <p className="text-[9px] text-zinc-500 text-center mt-3 leading-normal">
                * Note: Sideloading direct APK builds requires allowing Unknown App Installation in Android developer settings.
              </p>
            </div>
          </div>

          {/* Windows App */}
          <div className="p-8 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col justify-between shadow-2xl opacity-75">
            <div>
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-600">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase text-zinc-500 tracking-wide">Windows Desktop</h3>
                  <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Auto-Updating EXE</span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed mb-6">
                Auto-updating desktop wrapper for band rooms, keyboard desks, and sound consoles. In active prototype phase.
              </p>
              <div className="space-y-2.5 mb-8 text-[10px] uppercase font-semibold text-zinc-600 tracking-wider">
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span>EXE Status</span>
                  <span>In Development</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span>Architecture</span>
                  <span>x64 / ARM64</span>
                </div>
                <div className="flex justify-between">
                  <span>OS Target</span>
                  <span>Windows 10/11</span>
                </div>
              </div>
            </div>
            <button 
              disabled 
              className="w-full py-3 bg-zinc-950 text-zinc-600 text-xs font-bold uppercase tracking-wider rounded-lg border border-zinc-900 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
