import { setBackHandler, useBackHandler, useChordStore, ACCENT_COLORS, translations, useT, useLiquidGlassNav, useNavCollapsed, setNavCollapsed, useIsWebDesktop, registerDebugProvider, unregisterDebugProvider, updateStagexDiagnostics, getStagexDiagnostics } from '@workspace/studio-core';
import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  AnimatedActionButton,
  AppModeMenuLogo,
  WebAppSectionDock,
  SmartLoading,
  StagexPanelSkeleton,
  WebToolbar,
  WebButton
} from '@workspace/ui-shared';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

type StageWin = Window & {
  stageGoBack?: () => boolean;
  openPresetsPanel?: () => void;
  switchView?: (v: string) => void;
  __onViewChange?: (view: string) => void;
  scActivateMeasure?: () => void;
  scToggleZones?: () => void;
  scToggleCableLength?: () => void;
  openTimelinePanel?: () => void;
};

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function injectAccentVars(iframe: HTMLIFrameElement, from: string, to: string) {
  try {
    const doc  = iframe.contentDocument;
    const root = doc?.documentElement;
    if (!root) return;
    const [r, g, b] = hexToRgb(from);
    const [hr, hg, hb] = hexToRgb(to);
    root.style.setProperty('--accent',      from);
    root.style.setProperty('--accent-dark', '#fff');
    root.style.setProperty('--accent-08', `rgba(${r},${g},${b},0.08)`);
    root.style.setProperty('--accent-10', `rgba(${r},${g},${b},0.10)`);
    root.style.setProperty('--accent-12', `rgba(${r},${g},${b},0.12)`);
    root.style.setProperty('--accent-14', `rgba(${r},${g},${b},0.14)`);
    root.style.setProperty('--accent-20', `rgba(${r},${g},${b},0.20)`);
    root.style.setProperty('--accent-22', `rgba(${r},${g},${b},0.22)`);
    root.style.setProperty('--accent-30', `rgba(${r},${g},${b},0.30)`);
    root.style.setProperty('--accent-40', `rgba(${r},${g},${b},0.40)`);
    root.style.setProperty('--accent-50', `rgba(${r},${g},${b},0.50)`);
    root.style.setProperty('--accent-60', `rgba(${r},${g},${b},0.60)`);
    root.style.setProperty('--accent-70', `rgba(${r},${g},${b},0.70)`);
    root.style.setProperty('--hot',      to);
    root.style.setProperty('--hot-dark', `rgba(${hr},${hg},${hb},0.25)`);
    root.style.setProperty('--hot-10',   `rgba(${hr},${hg},${hb},0.10)`);
    root.style.setProperty('--hot-20',   `rgba(${hr},${hg},${hb},0.20)`);
    const pill = doc?.getElementById('sc-nav-pill');
    if (pill) {
      pill.style.background = `linear-gradient(135deg, ${from}, ${to})`;
      pill.style.boxShadow  = `0 2px 18px rgba(${r},${g},${b},0.35)`;
    }
  } catch {}
}

function injectTheme(iframe: HTMLIFrameElement, theme: string) {
  try {
    const root = iframe.contentDocument?.documentElement;
    if (!root) return;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      const win = iframe.contentWindow as (Window & { updateCanvasBg?: (c: string) => void }) | null;
      win?.updateCanvasBg?.('#ffffff');
    } else {
      root.removeAttribute('data-theme');
      const win = iframe.contentWindow as (Window & { updateCanvasBg?: (c: string) => void }) | null;
      win?.updateCanvasBg?.('#0e0e0e');
    }
  } catch {}
}

function injectAmoled(iframe: HTMLIFrameElement, amoled: boolean) {
  try {
    const root = iframe.contentDocument?.documentElement;
    if (!root) return;
    if (amoled) {
      root.setAttribute('data-amoled', '1');
      const win = iframe.contentWindow as (Window & { updateCanvasBg?: (c: string) => void }) | null;
      win?.updateCanvasBg?.('#000000');
    } else {
      root.removeAttribute('data-amoled');
    }
  } catch {}
}

function injectStartOnPicker(iframe: HTMLIFrameElement) {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return;
    const prefsScroll = doc.querySelector('.sc-prefs-scroll');
    if (!prefsScroll || doc.getElementById('sc-start-on-injected')) return;

    const store = useChordStore.getState();
    const lang = store.settings.language ?? 'en';
    const t = translations[lang as keyof typeof translations] ?? translations.en;
    const sp = t.stagePrefs;
    const cur = store.settings.defaultStageView ?? 'Editor';
    const accentKey = (store.settings.perApp?.stage?.accentColor ?? store.settings.accentColor ?? 'blue') as keyof typeof ACCENT_COLORS;
    const accent = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;

    const section = doc.createElement('div');
    section.id = 'sc-start-on-injected';

    const label = doc.createElement('div');
    label.className = 'sc-prefs-section-label';
    label.innerHTML = `<span class="material-symbols-outlined sc-sec-icon">dashboard</span><span class="sc-sec-text">${sp.startOn}</span>`;
    section.appendChild(label);

    const card = doc.createElement('div');
    card.className = 'sc-prefs-card';

    const row = doc.createElement('div');
    row.className = 'sc-prefs-row';
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';

    const textCol = doc.createElement('div');
    const rl = doc.createElement('p');
    rl.className = 'sc-prefs-row-label';
    rl.textContent = sp.startOn;
    const rh = doc.createElement('p');
    rh.className = 'sc-prefs-row-hint';
    rh.textContent = sp.startOnDesc;
    textCol.appendChild(rl);
    textCol.appendChild(rh);
    row.appendChild(textCol);

    const btnWrap = doc.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

    const views: { value: string; icon: string }[] = [
      { value: 'Editor',      icon: 'grid_view' },
      { value: 'Setup',       icon: 'folder_open' },
      { value: 'Preferences', icon: 'tune' },
    ];

    views.forEach(({ value, icon }) => {
      const btn = doc.createElement('button');
      const active = cur === value;
      btn.style.cssText = `
        width:40px;height:40px;display:flex;align-items:center;justify-content:center;
        border-radius:10px;cursor:pointer;transition:all 150ms ease;flex-shrink:0;
        border:${active ? `2px solid ${accent.from}` : '2px solid transparent'};
        background:${active ? `linear-gradient(135deg, ${accent.from}22, ${accent.to}18)` : 'rgba(255,255,255,0.06)'};
        color:${active ? accent.from : 'rgba(160,160,180,0.8)'};
      `;
      const ic = doc.createElement('span');
      ic.className = 'material-symbols-outlined';
      ic.style.fontSize = '20px';
      ic.textContent = icon;
      btn.appendChild(ic);

      btn.onclick = () => {
        useChordStore.getState().updateSettings({ defaultStageView: value as 'Editor' | 'Setup' | 'Preferences' });
        const updated = useChordStore.getState().settings.defaultStageView ?? 'Editor';
        const a2 = ACCENT_COLORS[(useChordStore.getState().settings.perApp?.stage?.accentColor ?? useChordStore.getState().settings.accentColor ?? 'blue') as keyof typeof ACCENT_COLORS] ?? ACCENT_COLORS.blue;
        btnWrap.querySelectorAll('button').forEach((b, idx) => {
          const isActive = views[idx].value === updated;
          (b as HTMLButtonElement).style.border = isActive ? `2px solid ${a2.from}` : '2px solid transparent';
          (b as HTMLButtonElement).style.background = isActive ? `linear-gradient(135deg, ${a2.from}22, ${a2.to}18)` : 'rgba(255,255,255,0.06)';
          (b as HTMLButtonElement).style.color = isActive ? a2.from : 'rgba(160,160,180,0.8)';
        });
      };

      btnWrap.appendChild(btn);
    });

    row.appendChild(btnWrap);
    card.appendChild(row);
    section.appendChild(card);
    prefsScroll.appendChild(section);
  } catch {}
}

const STAGEX_LIBRARY: Record<string, { name: string; icon: string; type: string }[]> = {
  mics: [
    { name: 'SM58',        icon: 'mic',              type: 'Dynamic Mic' },
    { name: 'Condenser',   icon: 'mic-2',            type: 'Condenser Mic' },
    { name: 'Amp Mic',     icon: 'mic',              type: 'Instrument Mic' },
    { name: 'Wireless',    icon: 'cx-wireless',      type: 'Wireless Mic' },
    { name: 'Boundary',    icon: 'cx-boundary',      type: 'PZM Mic' },
    { name: 'Drum Clip',   icon: 'cx-drum-clip',     type: 'Instrument Clip' },
    { name: 'Mic Stand',   icon: 'cx-mic-stand',     type: 'Mic Stand' },
  ],
  drums: [
    { name: 'Drum Kit',    icon: 'drum',              type: 'Acoustic Drums' },
    { name: 'E-Drums',     icon: 'cx-edrum',         type: 'Electronic Drums' },
    { name: 'Percussion',  icon: 'cx-percussion',    type: 'Percussion' },
    { name: 'Cajón',       icon: 'cx-cajon',          type: 'Cajón' },
  ],
  inst: [
    { name: 'Elec Guitar', icon: 'cx-elec-guitar',   type: 'Electric Guitar' },
    { name: 'Acou Guitar', icon: 'guitar',            type: 'Acoustic Guitar' },
    { name: 'Bass Guitar', icon: 'cx-bass-guitar',   type: 'Bass Guitar' },
    { name: 'Keyboard',    icon: 'piano',             type: 'Keyboard DI' },
    { name: 'Synth',       icon: 'cx-synth',         type: 'Synthesizer' },
    { name: 'Brass / Horn',icon: 'cx-trumpet',       type: 'Brass Instrument' },
    { name: 'Strings',     icon: 'cx-violin',        type: 'String Instrument' },
    { name: 'Shaker',      icon: 'cx-shaker',         type: 'Shaker' },
    { name: 'Tambourine',  icon: 'cx-tambourine',     type: 'Tambourine' },
  ],
  amps: [
    { name: 'Guitar Amp',  icon: 'cx-guitar-amp',   type: 'Guitar Amplifier' },
    { name: 'Bass Amp',    icon: 'cx-bass-amp',     type: 'Bass Amplifier' },
    { name: 'Amp Cab',     icon: 'cx-amp-cab',      type: 'Guitar Cabinet' },
    { name: 'Bass Cab',    icon: 'cx-bass-cab',     type: 'Bass Cabinet' },
  ],
  mon: [
    { name: 'Wedge',        icon: 'cx-wedge',        type: 'Floor Wedge' },
    { name: 'Floor PA',     icon: 'volume-2',         type: 'Powered Floor PA' },
    { name: 'Stage Sub',    icon: 'disc',             type: 'Stage Sub-Woofer' },
    { name: 'IEM Pack',     icon: 'headphones',       type: 'In-Ear Monitor' },
    { name: 'Drum Fill',    icon: 'speaker',          type: 'Drum Fill Monitor' },
    { name: 'Drum Sub',     icon: 'disc-2',           type: 'Drum Sub Monitor' },
    { name: 'Side Fill',    icon: 'megaphone',        type: 'Side Fill' },
    { name: 'Main PA L',    icon: 'volume-2',         type: 'Main PA Left' },
    { name: 'Main PA R',    icon: 'volume-2',         type: 'Main PA Right' },
    { name: 'Delay Tower',  icon: 'radio',            type: 'Delay Speaker Tower' },
    { name: 'Front Fill',   icon: 'cx-front-fill',    type: 'Front Fill Speaker' },
    { name: 'Headphone Amp',icon: 'headset',          type: 'Headphone Amplifier' },
  ],
  util: [
    { name: 'Mixer',        icon: 'sliders-horizontal', type: 'Stage Mixer' },
    { name: 'Power Distro', icon: 'zap',              type: 'Power Distro' },
    { name: 'Stage Box',    icon: 'box',              type: 'Stage Box' },
    { name: 'Patch Bay',    icon: 'grid-3x3',         type: 'Patch Bay' },
    { name: 'Router',       icon: 'network',          type: 'Network Router' },
    { name: 'Splitter',     icon: 'git-branch',       type: 'Audio Splitter' },
    { name: 'FOH Console',  icon: 'sliders-vertical', type: 'FOH Mixing Console' },
    { name: 'MON Console',  icon: 'sliders-horizontal', type: 'Monitor Console' },
    { name: 'Amp Rack',     icon: 'server',           type: 'Amplifier Rack' },
    { name: 'Effects Rack', icon: 'cpu',              type: 'Effects Rack' },
    { name: 'Wireless Rack',icon: 'cx-wireless-rack', type: 'Wireless Rack' },
    { name: 'Laptop',       icon: 'laptop',           type: 'Laptop / Computer' },
    { name: 'Intercom',     icon: 'headset',          type: 'Intercom System' },
    { name: 'DI Box',       icon: 'cx-di-box',         type: 'DI Box' },
    { name: 'Loop Station', icon: 'repeat-2',          type: 'Loop Station' },
    { name: 'Playback',     icon: 'play-circle',       type: 'Playback Device' },
    { name: 'Outlet',       icon: 'cx-outlet',         type: 'Power Outlet' },
  ],
  people: [
    { name: 'Performer',   icon: 'cx-person',        type: 'Person' },
    { name: 'Vocalist',    icon: 'cx-vocalist',      type: 'Person' },
    { name: 'Guitarist',   icon: 'cx-guitarist',     type: 'Person' },
    { name: 'Bassist',     icon: 'cx-bassist',       type: 'Person' },
    { name: 'Drummer',     icon: 'cx-drummer',       type: 'Person' },
    { name: 'Keyboardist', icon: 'cx-keyboardist',   type: 'Person' },
    { name: 'Saxophonist', icon: 'cx-saxophonist',   type: 'Person' },
    { name: 'Tech',        icon: 'cx-tech',          type: 'Person' },
  ],
};

const STAGEX_ICON_MAP: Record<string, string> = {
  'mic':                '/stage-core/icons/mic-sm58.png',
  'mic-2':              '/stage-core/icons/mic-condenser.png',
  'cx-wireless':        '/stage-core/icons/wireless-handheld.png',
  'cx-boundary':        '/stage-core/icons/boundary-mic.png',
  'cx-drum-clip':       '/stage-core/icons/drum-clip.png',
  'cx-mic-stand':       '/stage-core/icons/mic-stand.svg',
  'drum':               '/stage-core/icons/drum-kit.png',
  'cx-edrum':           '/stage-core/icons/edrum.png',
  'cx-percussion':      '/stage-core/icons/percussion.png',
  'cx-cajon':           '/stage-core/icons/cajon.svg',
  'cx-elec-guitar':     '/stage-core/icons/elec-guitar.png',
  'guitar':             '/stage-core/icons/acoustic-guitar.png',
  'cx-bass-guitar':     '/stage-core/icons/bass-guitar.png',
  'piano':              '/stage-core/icons/keyboard.png',
  'cx-synth':           '/stage-core/icons/synth.png',
  'cx-trumpet':         '/stage-core/icons/trumpet.png',
  'cx-violin':          '/stage-core/icons/violin.png',
  'cx-shaker':          '/stage-core/icons/shaker.svg',
  'cx-tambourine':      '/stage-core/icons/tambourine.svg',
  'cx-guitar-amp':      '/stage-core/icons/guitar-amp.png',
  'cx-bass-amp':        '/stage-core/icons/bass-amp.png',
  'cx-amp-cab':         '/stage-core/icons/amp-cab.png',
  'cx-bass-cab':        '/stage-core/icons/bass-cab.png',
  'cx-wedge':           '/stage-core/icons/wedge.png',
  'volume-2':           '/stage-core/icons/main-pa.png',
  'disc':               '/stage-core/icons/stage-sub.png',
  'headphones':         '/stage-core/icons/iem-pack.png',
  'speaker':            '/stage-core/icons/drum-fill.png',
  'disc-2':             '/stage-core/icons/drum-sub.svg',
  'megaphone':          '/stage-core/icons/side-fill.png',
  'radio':              '/stage-core/icons/delay-tower.svg',
  'cx-front-fill':      '/stage-core/icons/front-fill.png',
  'headset':            '/stage-core/icons/headphone-amp.svg',
  'sliders-horizontal': '/stage-core/icons/mon-console.png',
  'zap':                '/stage-core/icons/power-distro.png',
  'box':                '/stage-core/icons/stage-box.png',
  'grid-3x3':           '/stage-core/icons/patch-bay.png',
  'network':            '/stage-core/icons/router.svg',
  'git-branch':         '/stage-core/icons/splitter.png',
  'sliders-vertical':   '/stage-core/icons/foh-console.png',
  'server':             '/stage-core/icons/amp-rack.png',
  'cpu':                '/stage-core/icons/effects-rack.png',
  'cx-wireless-rack':   '/stage-core/icons/wireless-rack.png',
  'laptop':             '/stage-core/icons/laptop.svg',
  'cx-di-box':          '/stage-core/icons/di-box.png',
  'repeat-2':           '/stage-core/icons/loop-station.svg',
  'play-circle':        '/stage-core/icons/playback.svg',
  'cx-outlet':          '/stage-core/icons/outlet.webp',
  'cx-person':          '/stage-core/icons/person.png',
  'cx-vocalist':        '/stage-core/icons/vocalist.png',
  'cx-guitarist':       '/stage-core/icons/guitarist.png',
  'cx-bassist':         '/stage-core/icons/bassist.png',
  'cx-drummer':         '/stage-core/icons/drummer.png',
  'cx-keyboardist':     '/stage-core/icons/keyboardist.png',
  'cx-saxophonist':     '/stage-core/icons/saxophonist.png',
  'cx-tech':            '/stage-core/icons/tech.png',
};

const CATEGORY_ICONS: Record<string, string> = {
  mics: 'mic',
  drums: 'music_note',
  inst: 'electric_bolt',
  amps: 'speaker',
  mon: 'volume_up',
  util: 'settings_input_component',
  people: 'person',
  custom: 'add_circle',
  presets: 'bookmark',
};

const CATEGORY_LABELS: Record<string, string> = {
  mics: 'Mics',
  drums: 'Drums',
  inst: 'Instruments',
  amps: 'Amps',
  mon: 'Audio',
  util: 'Utilities',
  people: 'People',
  custom: 'Custom',
  presets: 'Presets',
};

const HIDE_IFRAME_UI = `
  #sc-fab-btn { display: none !important; }
  #sc-fab-wrap { display: none !important; }
  #sc-item-sheet { display: none !important; }
  #sc-dial-backdrop { display: none !important; }
  #sc-el-presets-panel { bottom: 80px !important; }
  #mobile-nav-bar { opacity: 0 !important; pointer-events: none !important; }
  @media screen and (orientation: landscape) and (max-width: 960px) {
    #sc-fab-wrap { display: none !important; }
  }
`;

const HIDE_IFRAME_UI_MOBILE = `
  #sc-fab-btn { display: none !important; }
  #mobile-nav-bar { opacity: 0 !important; pointer-events: none !important; }
`;

export default function StagexPanel() {
  const isWebDesktop = useIsWebDesktop();
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [isLargeDesktop, setIsLargeDesktop] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  });

  useEffect(() => {
    if (!isWebDesktop) return;
    const handleResize = () => {
      setIsLargeDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isWebDesktop]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const { settings } = useChordStore();
  const tr = useT();
  const [searchQuery, setSearchQuery] = useState('');
  const [customElements, setCustomElements] = useState<any[]>([]);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    mics: false,
    drums: false,
    inst: false,
    amps: false,
    mon: false,
    util: false,
    people: false,
    custom: false,
    presets: false,
  });

  const loadCustomElements = useCallback(() => {
    try {
      const raw = localStorage.getItem('scCustomElements');
      if (raw) {
        setCustomElements(JSON.parse(raw));
      } else {
        setCustomElements([]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadCustomElements();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'scCustomElements') {
        loadCustomElements();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [loadCustomElements]);

  // Removed redundant expandedCats.custom loader to optimize performance and prevent duplicate calls.

  const handleAddElement = useCallback((item: any) => {
    try {
      const win = iframeRef.current?.contentWindow as any;
      if (win && typeof win.addItemToStage === 'function') {
        win.addItemToStage(item);
      }
    } catch (err) {
      console.error('Failed to add element to stage', err);
    }
  }, []);

  const getSearchResults = useCallback(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];

    const results: any[] = [];

    Object.entries(STAGEX_LIBRARY).forEach(([cat, items]) => {
      items.forEach(item => {
        if (item.name.toLowerCase().includes(query) || item.type.toLowerCase().includes(query)) {
          results.push({ ...item, category: cat });
        }
      });
    });

    customElements.forEach(item => {
      if (item.name && item.name.toLowerCase().includes(query)) {
        results.push({ ...item, category: 'custom' });
      }
    });

    return results;
  }, [searchQuery, customElements]);

  // Restore the last Stagex sub-view (Editor / Setup / Preferences / Export)
  // from the persisted session. The iframe's internal view is switched to
  // match below in handleLoad, after the iframe finishes loading.
  const [curView, setCurView] = useState<string>(() => {
    const s = useChordStore.getState();
    const saved = s.settings.restoreLastSession ? s.lastSession?.stagexView : undefined;
    return saved || s.settings.defaultStageView || 'Editor';
  });

  const curViewRef = useRef(curView);
  curViewRef.current = curView;

  useEffect(() => {
    useChordStore.getState().setLastSession({ stagexView: curView });
  }, [curView]);

  const returnToStudioHub = useCallback(() => {
    if (typeof (window as any).returnToStudioHub === 'function') {
      (window as any).returnToStudioHub();
    }
  }, []);

  /* ── Glassmorphism bottom nav state ─────────────────────── */
  const stageNavRef    = useRef<HTMLDivElement | null>(null);
  useLiquidGlassNav(stageNavRef as React.RefObject<HTMLElement | null>);
  const stageBtnRefs   = useRef<(HTMLButtonElement | null)[]>([]);
  const prevTabRef     = useRef(0);
  const stageStretchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stagePill, setStagePill] = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const [fabOpen, setFabOpen] = useState(false);
  const [hasOpenOverlay, setHasOpenOverlay] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const navCollapsed = useNavCollapsed();
  const [expandedStageH, setExpandedStageH] = useState(52);
  const [expandedStageW, setExpandedStageW] = useState(380);
  const [propPanelOpen, setPropPanelOpen] = useState(false);
  const [pdfSheetOpen, setPdfSheetOpen] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  // Scenes feature (v3.0.63+) — picker for which stage plot(s) to include
  const [pdfSceneInfo, setPdfSceneInfo] = useState<{ count: number; currentIdx: number; names: string[] }>({ count: 1, currentIdx: 0, names: ['Scene 1'] });
  const [pdfSceneChoice, setPdfSceneChoice] = useState<'current' | 'all' | number>('current');
  const [isStageExpanded, setIsStageExpanded] = useState(false);

  // ── Diagnostics & Safe Mode state ──────────────────────────
  const [showDiagnostics, setShowDiagnostics] = useState(() => {
    try {
      return localStorage.getItem('stagex_diagnostics_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [safeMode, setSafeMode] = useState(() => {
    try {
      return localStorage.getItem('stagex_safe_mode_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const [diagTaps, setDiagTaps] = useState({
    bottomNav: 0,
    plus: 0,
    eye: 0,
    picker: 0,
    toolbar: 0,
    sentMsgs: 0,
    recvMsgs: 0,
  });

  const [lastDiagLog, setLastDiagLog] = useState<string>('System initialized.');

  const logDiagnostic = useCallback((msg: string) => {
    setLastDiagLog(prev => {
      const lines = prev.split('\n');
      if (lines.length > 25) {
        return msg + '\n' + lines.slice(0, 25).join('\n');
      }
      return msg + '\n' + prev;
    });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setShowDiagnostics(!!detail);
    };
    window.addEventListener('stagex:diagnostics-toggle', handler);
    return () => window.removeEventListener('stagex:diagnostics-toggle', handler);
  }, []);

  // Safe Mode CSS injection
  useEffect(() => {
    const applySafeMode = (doc: Document, active: boolean) => {
      let el = doc.getElementById('stagex-safe-mode-css');
      if (active) {
        if (!el) {
          el = doc.createElement('style');
          el.id = 'stagex-safe-mode-css';
          el.textContent = `
            * {
              transition: none !important;
              animation: none !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
            .modal-backdrop, .overlay, #presets-backdrop, #sc-dial-backdrop {
              display: none !important;
              pointer-events: none !important;
            }
          `;
          doc.head.appendChild(el);
        }
      } else {
        if (el) el.remove();
      }
    };

    applySafeMode(document, safeMode);
    try {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (iframeDoc) applySafeMode(iframeDoc, safeMode);
    } catch {}
  }, [safeMode, iframeLoading]);

  // Capture touch event targets
  useEffect(() => {
    if (!showDiagnostics) return;

    const handleEvent = (name: string, isIframe: boolean) => (e: Event) => {
      const pe = e as PointerEvent;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const style = window.getComputedStyle(target);
      const bounds = target.getBoundingClientRect();
      const path: string[] = [];
      let curr: HTMLElement | null = target;
      while (curr) {
        let tag = curr.tagName.toLowerCase();
        if (curr.id) tag += '#' + curr.id;
        if (curr.className && typeof curr.className === 'string') {
          tag += '.' + curr.className.split(/\s+/).slice(0, 2).join('.');
        }
        path.push(tag);
        curr = curr.parentElement;
      }

      // Check if it's bottomNav, plus, or eye
      let controlName = 'none';
      if (target.closest('.glass-nav') || target.closest('.stage-nav-btn')) {
        controlName = 'bottomNav';
      } else if (target.closest('#stagex-plus-button') || target.id === 'stagex-plus-button') {
        controlName = 'plus';
      } else if (target.closest('#stagex-eye-button') || target.id === 'stagex-eye-button') {
        controlName = 'eye';
      } else if (isIframe && (target.closest('#sc-dial-backdrop') || target.closest('.sc-dial-chip') || target.closest('#sc-item-sheet'))) {
        controlName = 'picker';
      } else if (isIframe && (target.closest('#sc-vtools') || target.closest('#sc-vtools-body') || target.closest('.el-resize-bar') || target.closest('.el-resize-btn'))) {
        controlName = 'toolbar';
      }

      // If click event, increment corresponding diagnostic counter
      if (e.type === 'click' && controlName !== 'none') {
        setDiagTaps(prev => ({
          ...prev,
          [controlName]: prev[controlName as keyof typeof prev] + 1
        }));
      }

      const hitElement = isIframe
        ? (iframeRef.current?.contentDocument?.elementFromPoint(pe.clientX || 0, pe.clientY || 0) as HTMLElement | null)
        : (document.elementFromPoint(pe.clientX || 0, pe.clientY || 0) as HTMLElement | null);

      const logMsg = `[${isIframe ? 'IFRAME' : 'PARENT'} - ${e.type.toUpperCase()}]
Target: ${target.tagName.toLowerCase()}${target.id ? '#' + target.id : ''}
Hit target (elementFromPoint): ${hitElement ? hitElement.tagName.toLowerCase() + (hitElement.id ? '#' + hitElement.id : '') : 'none'}
pointer-events: ${style.pointerEvents} | z-index: ${style.zIndex || 'auto'}
Bounds: L=${Math.round(bounds.left)} T=${Math.round(bounds.top)} W=${Math.round(bounds.width)} H=${Math.round(bounds.height)}
ComposedPath: ${path.slice(0, 3).join(' > ')}`;

      logDiagnostic(logMsg);
    };

    const attach = (doc: Document, isIframe: boolean) => {
      ['pointerdown', 'pointerup', 'click'].forEach(evt => {
        doc.addEventListener(evt, handleEvent(evt, isIframe), true);
      });
    };

    const detach = (doc: Document, isIframe: boolean) => {
      ['pointerdown', 'pointerup', 'click'].forEach(evt => {
        doc.removeEventListener(evt, handleEvent(evt, isIframe), true);
      });
    };

    attach(document, false);

    let iframeDoc: Document | null = null;
    try {
      iframeDoc = iframeRef.current?.contentDocument || null;
      if (iframeDoc) attach(iframeDoc, true);
    } catch {}

    return () => {
      detach(document, false);
      if (iframeDoc) {
        try { detach(iframeDoc, true); } catch {}
      }
    };
  }, [showDiagnostics, logDiagnostic]);

  // ── Automated interaction test runner ───────────────────────
  const [testActive, setTestActive] = useState(false);
  const [testCycle, setTestCycle] = useState(0);
  const [testStep, setTestStep] = useState('');
  const [scenesTestResult, setScenesTestResult] = useState<string>('Not Run');
  const [sceneTouchTelemetry, setSceneTouchTelemetry] = useState<any[]>([]);
  const [hitboxDebugActive, setHitboxDebugActive] = useState(false);

  const toggleHitboxDebugAction = useCallback(() => {
    setHitboxDebugActive(prev => {
      const next = !prev;
      try {
        const iframe = iframeRef.current;
        if (iframe?.contentWindow) {
          (iframe.contentWindow as any).toggleHitboxDebug?.(next);
        }
      } catch (err: any) {
        logDiagnostic(`[Hitbox Debug Error] Failed to toggle: ${err.message || String(err)}`);
      }
      logDiagnostic(`[Hitbox Debug] Toggled Stagex hitbox debug: ${next}`);
      return next;
    });
  }, [logDiagnostic]);

  useEffect(() => {
    if (!iframeLoading && iframeRef.current) {
      try {
        const win = iframeRef.current.contentWindow as any;
        win?.toggleHitboxDebug?.(hitboxDebugActive);
      } catch {}
    }
  }, [hitboxDebugActive, iframeLoading]);

  const runInteractionTest = async () => {
    if (testActive) return;
    setTestActive(true);
    setTestCycle(0);
    setTestStep('Starting test...');
    logDiagnostic('[TEST START] Running 25 cycles of interaction test...');

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const checkHitTarget = (el: HTMLElement, name: string): boolean => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      if (!hit) {
        logDiagnostic(`[TEST ERROR] Hit target for ${name} at (${cx}, ${cy}) is null`);
        return false;
      }
      if (hit !== el && !el.contains(hit) && !hit.contains(el)) {
        logDiagnostic(`[TEST ERROR] Hit target for ${name} is intercepted by: ${hit.tagName.toLowerCase()}${hit.id ? '#' + hit.id : ''}${hit.className ? '.' + hit.className.split(' ').join('.') : ''}`);
        return false;
      }
      return true;
    };

    try {
      for (let cycle = 1; cycle <= 25; cycle++) {
        setTestCycle(cycle);
        logDiagnostic(`[CYCLE ${cycle}/25] Beginning...`);

        // 1. Ensure we are in Editor view
        setTestStep('Ensuring Editor view...');
        if ((curViewRef.current as any) !== 'Editor') {
          handleNavTap('Editor');
          await delay(300);
        }

        // 2. Tap Setup tab
        setTestStep('Tapping Setup tab...');
        const setupBtn = stageBtnRefs.current[1];
        if (!setupBtn) throw new Error('Setup button ref missing');
        if (!checkHitTarget(setupBtn, 'Setup tab')) throw new Error('Setup tab click intercepted');
        setupBtn.click();
        await delay(400);
        if (!['SetupHub', 'Rider', 'Setlist', 'Gear', 'Members'].includes(curViewRef.current as any)) {
          throw new Error('Section did not switch to Setup');
        }

        // 3. Tap Preferences tab
        setTestStep('Tapping Preferences tab...');
        const prefBtn = stageBtnRefs.current[2];
        if (!prefBtn) throw new Error('Preferences button ref missing');
        if (!checkHitTarget(prefBtn, 'Preferences tab')) throw new Error('Preferences tab click intercepted');
        prefBtn.click();
        await delay(400);
        if ((curViewRef.current as any) !== 'Preferences') {
          throw new Error('Section did not switch to Preferences');
        }

        // 4. Return to Editor
        setTestStep('Returning to Editor...');
        const editorBtn = stageBtnRefs.current[0];
        if (!editorBtn) throw new Error('Editor button ref missing');
        if (!checkHitTarget(editorBtn, 'Editor tab')) throw new Error('Editor tab click intercepted');
        editorBtn.click();
        await delay(400);
        if ((curViewRef.current as any) !== 'Editor') {
          throw new Error('Section did not switch back to Editor');
        }

        // 5. Tap Plus button
        setTestStep('Tapping Plus button...');
        const plusBtn = document.getElementById('stagex-plus-button');
        if (!plusBtn) throw new Error('Plus button missing');
        if (!checkHitTarget(plusBtn, 'Plus button')) throw new Error('Plus button click intercepted');
        plusBtn.click();
        await delay(400);
        if (!fabOpen) throw new Error('FAB did not open / picker not visible');

        // 6. Select element inside iframe
        setTestStep('Selecting element in picker...');
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentDocument) throw new Error('Iframe not loaded');
        const win = iframe.contentWindow as any;
        const doc = iframe.contentDocument;
        const chip = doc.querySelector('.sc-dial-chip') as HTMLElement | null;
        if (!chip) throw new Error('No element chips found in picker');
        chip.click();
        await delay(600);
        if (win.state.elements.length === 0) throw new Error('Element was not added to stage');
        const newEl = win.state.elements[win.state.elements.length - 1];
        const newElId = newEl.id;

        // 7. Tap Eye button (first time)
        setTestStep('Tapping Eye button (enable live)...');
        const eyeBtn = document.getElementById('stagex-eye-button');
        if (!eyeBtn) throw new Error('Eye button missing');
        if (!checkHitTarget(eyeBtn, 'Eye button')) throw new Error('Eye button click intercepted');
        eyeBtn.click();
        await delay(400);
        if (!liveMode) throw new Error('Live mode did not activate');

        // 8. Tap Eye button (second time)
        setTestStep('Tapping Eye button (disable live)...');
        if (!checkHitTarget(eyeBtn, 'Eye button')) throw new Error('Eye button click intercepted');
        eyeBtn.click();
        await delay(400);
        if (liveMode) throw new Error('Live mode did not deactivate');

        // 9. Select element and run toolbar actions
        setTestStep('Selecting element on canvas...');
        win.selectElement(newElId);
        await delay(300);

        setTestStep('Rotating element...');
        const initialRotation = newEl.rotation || 0;
        callIframe('rotateSelectedElement');
        await delay(400);
        if (newEl.rotation === initialRotation) throw new Error('Element rotation did not change');

        setTestStep('Scaling element up...');
        const initialScale = newEl.scale || 100;
        callIframe('scaleSelectedElement', 10);
        await delay(400);
        if ((newEl.scale || 100) <= initialScale) throw new Error('Element scale did not increase');

        setTestStep('Scaling element down...');
        const currentScale = newEl.scale || 100;
        callIframe('scaleSelectedElement', -10);
        await delay(400);
        if ((newEl.scale || 100) >= currentScale) throw new Error('Element scale did not decrease');

        setTestStep('Deleting element...');
        callIframe('deleteSelectedElement');
        await delay(500);
        if (win.state.elements.some((e: any) => e.id === newElId)) {
          throw new Error('Element was not deleted from stage');
        }

        // 10. Rotate orientation (landscape then portrait)
        setTestStep('Rotating to landscape...');
        toggleStageExpanded();
        await delay(800);

        setTestStep('Rotating back to portrait...');
        toggleStageExpanded();
        await delay(800);

        // 11. Return to Hub
        setTestStep('Returning to Hub...');
        if (typeof (window as any).returnToStudioHub === 'function') {
          (window as any).returnToStudioHub();
          await delay(800);
        } else {
          throw new Error('returnToStudioHub function missing');
        }

        // 12. Reopen Stagex
        setTestStep('Reopening Stagex...');
        const store = useChordStore.getState();
        store.updateSettings({ appMode: 'stage' });
        await delay(1000);
      }

      setTestActive(false);
      setTestStep('Test Complete');
      logDiagnostic('[TEST PASSED] All 25 cycles completed successfully!');
    } catch (err: any) {
      setTestActive(false);
      setTestStep('Test Failed');
      logDiagnostic(`[TEST FAILED] ${err.message || err}`);
      console.error(err);
    }
  };

  const toggleStageExpanded = () => {
    const nextVal = !isStageExpanded;
    setRotationTransition(true);
    setIsStageExpanded(nextVal);
    
    (async () => {
      try {
        if (nextVal) {
          if (Capacitor.isNativePlatform()) {
            await ScreenOrientation.lock({ orientation: 'landscape' });
          } else if (window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
            await (window.screen.orientation as any).lock('landscape');
          }
        } else {
          if (Capacitor.isNativePlatform()) {
            await ScreenOrientation.lock({ orientation: 'portrait' });
          } else if (window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
            await (window.screen.orientation as any).lock('portrait');
          }
        }
      } catch (e) {
        console.warn('Screen orientation lock/unlock failed:', e);
      }
    })();

    setTimeout(() => setRotationTransition(false), 320);
  };

  useEffect(() => {
    return () => {
      try {
        if (Capacitor.isNativePlatform()) {
          ScreenOrientation.unlock().catch(() => {});
        } else if (window.screen && window.screen.orientation && (window.screen.orientation as any).unlock) {
          (window.screen.orientation as any).unlock();
        }
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    // Always show the share button when navigator.share exists. Android WebView
    // often returns false from canShare({files}) even when share() actually
    // works; the iframe-side export will attempt the share and fall back to
    // saving the PDF if the share is unsupported or fails.
    setCanShareFiles(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const openPdfSheet = useCallback(() => {
    setPdfFileName('Stagex_Export');
    setPdfSceneInfo({ count: 1, currentIdx: 0, names: ['Scene 1'] });
    setPdfSceneChoice('current');
    setPdfBusy(false);
    setPdfSheetOpen(true);
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: 'requestSceneInfo' }, '*');
    } catch (e) {}
  }, []);

  const runPdfExport = useCallback(async (action: 'save' | 'share') => {
    setPdfBusy(true);
    try {
      iframeRef.current?.contentWindow?.postMessage({
        type: 'sc-call',
        fn: 'exportPDFWithOptions',
        arg: {
          name: pdfFileName.trim() || 'Stagex_Export',
          action,
          scene: pdfSceneChoice,
        }
      }, '*');
    } catch (e) {}
    // Reset state after a short delay since the export runs asynchronously inside the iframe
    setTimeout(() => {
      setPdfBusy(false);
      setPdfSheetOpen(false);
    }, 1500);
  }, [pdfFileName, pdfSceneChoice]);

  const mediaQueryString = useMemo(() => {
    return (typeof window !== 'undefined' && Capacitor.isNativePlatform())
      ? '(orientation: landscape)'
      : '(orientation: landscape) and (max-width: 960px)';
  }, []);

  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(mediaQueryString).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(mediaQueryString);
    const handler = (e: MediaQueryListEvent) => {
      setIsLandscape(e.matches);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mediaQueryString]);

  const [rotationTransition, setRotationTransition] = useState(false);
  useEffect(() => {
    setRotationTransition(true);
    const timer = setTimeout(() => setRotationTransition(false), 320);
    return () => clearTimeout(timer);
  }, [isLandscape]);

  const stageVis  = settings.perApp?.stage ?? { theme: 'dark' as const, accentColor: 'blue' as const, amoledMode: false };
  const accentKey = (stageVis.accentColor ?? settings.accentColor ?? 'blue') as keyof typeof ACCENT_COLORS;
  const accent    = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;
  const isLight   = (() => {
    if (stageVis.theme === 'light') return true;
    if (stageVis.theme === 'system') {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    if (stageVis.theme === 'dynamic') {
      const h = new Date().getHours();
      const lightStart = settings.dynamicLightStart ?? 7;
      const lightEnd   = settings.dynamicLightEnd   ?? 20;
      return h >= lightStart && h < lightEnd;
    }
    return false;
  })();
  const isAmoled  = isLight ? false : (isWebDesktop ? true : stageVis.amoledMode);

  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const iframeSrc = useRef(
    `${baseOrigin}/stage-core/index.html#${isLight ? 'light' : 'dark'},${encodeURIComponent(accent.from)},${encodeURIComponent(accent.to)},${isAmoled ? '1' : '0'}`
  ).current;
  const stageBg   = isLight ? '#f2f1ef' : '#000000';
  const stageHdr  = isLight ? '#f2f1ef' : '#000000';

  const showBack = curView === 'Rider' || curView === 'Setlist' || curView === 'Gear' || curView === 'Members' || curView === 'Export';

  const lastCallTime = useRef(0);
  // Functions that are idempotent navigation actions and should never be
  // throttled — spam-tapping Stage/Setup/Preferences must always feel instant.
  const NO_THROTTLE_FNS = new Set(['switchView', 'stageGoBack']);
  const pendingAcks = useRef<Map<string, { fn: string; timer: ReturnType<typeof setTimeout> }>>(new Map());
  const callIframe = useCallback((fn: string, arg?: string | number) => {
    if (!NO_THROTTLE_FNS.has(fn)) {
      const now = Date.now();
      if (now - lastCallTime.current < 200) return;
      lastCallTime.current = now;
    }
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Increment sent message counter
    setDiagTaps(prev => ({ ...prev, sentMsgs: prev.sentMsgs + 1 }));

    const msgId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    updateStagexDiagnostics({
      messagesSent: getStagexDiagnostics().messagesSent + 1,
      lastCommandSent: fn,
      lastMsgId: msgId,
      sentWithTargetOriginWildcard: true
    });

    // Set up ACK timeout
    const timeout = setTimeout(() => {
      console.warn(`[Diagnostics] No ACK received for command: ${fn} (msgId: ${msgId})`);
      logDiagnostic(`[ERROR] No ACK for ${fn}`);
      updateStagexDiagnostics({
        timeoutCount: getStagexDiagnostics().timeoutCount + 1,
        lastTimeout: fn
      });
    }, 1500);
    pendingAcks.current.set(msgId, { fn, timer: timeout });

    try {
      const win = iframe.contentWindow as Record<string, unknown> | null;
      const f = win?.[fn];
      if (typeof f === 'function') {
        arg !== undefined ? (f as (a: string | number) => void)(arg) : (f as () => void)();
        clearTimeout(timeout);
        pendingAcks.current.delete(msgId);
        updateStagexDiagnostics({
          ackCount: getStagexDiagnostics().ackCount + 1,
          lastAckReceived: new Date().toLocaleTimeString()
        });
        return;
      }
    } catch {}
    try {
      iframe.contentWindow?.postMessage({ type: 'sc-call', fn, arg, msgId }, '*');
    } catch {}
  }, [logDiagnostic]);

  const runScenesInputTest = useCallback(() => {
    setScenesTestResult('Running...');
    const iframe = iframeRef.current;
    if (!iframe) {
      setScenesTestResult('Failed: iframe element not found');
      return;
    }
    
    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument || iframe.contentWindow?.document || null;
    } catch (e) {
      console.warn('[Test] Cannot access iframe document directly due to origin restrictions:', e);
    }

    if (!doc) {
      setScenesTestResult('Failed: Cannot access iframe DOM (origin restriction)');
      return;
    }

    const scenesBar = doc.getElementById('sc-scenes-bar');
    if (!scenesBar) {
      setScenesTestResult('Failed: #sc-scenes-bar element not found in iframe DOM');
      return;
    }

    const barRect = scenesBar.getBoundingClientRect();
    const sceneBtnEls = Array.from(doc.querySelectorAll('.sc-scene-btn'));
    const sceneButtonRects = sceneBtnEls.map(el => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    });
    
    const addBtnEl = doc.querySelector('.sc-scene-add-btn');
    const addButtonRect = addBtnEl ? (() => {
      const r = addBtnEl.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    })() : null;

    const deleteBtnEl = doc.querySelector('.sc-scene-close');
    const deleteButtonRect = deleteBtnEl ? (() => {
      const r = deleteBtnEl.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    })() : null;

    // Get telemetry of last tap
    const lastTouch = sceneTouchTelemetry[sceneTouchTelemetry.length - 1];
    const lastTapX = lastTouch?.debugData?.lastTapX ?? lastTouch?.endX ?? lastTouch?.startX ?? 0;
    const lastTapY = lastTouch?.debugData?.lastTapY ?? lastTouch?.endY ?? lastTouch?.startY ?? 0;
    const matchedButton = lastTouch?.targetClass || lastTouch?.debugData?.pointerPath || 'None';
    const verticalDelta = lastTouch?.debugData?.tapDeltaY ?? 0;
    const horizontalDelta = lastTouch?.debugData?.tapDeltaX ?? 0;
    const insideVisual = lastTouch?.debugData?.insideVisual ?? false;
    const insideTouch = lastTouch?.debugData?.insideTouch ?? false;

    // Evaluate alignment: Check if there's any vertical shift between touch rect and visual rect centers of close/add buttons
    let pass = true;
    let shiftMessage = '';
    const checkEl = deleteBtnEl || addBtnEl;
    if (checkEl) {
      const rect = checkEl.getBoundingClientRect();
      const isCloseOrAdd = checkEl.classList.contains('sc-scene-close') || checkEl.classList.contains('sc-scene-add-btn');
      const borderSize = isCloseOrAdd ? 12 : 0;
      
      const touchCenterY = rect.top + rect.height / 2;
      const visualCenterY = (rect.top + borderSize) + (rect.height - borderSize * 2) / 2;
      const shift = touchCenterY - visualCenterY;
      
      if (Math.abs(shift) > 0.5) {
        pass = false;
        shiftMessage = `Touch rect is shifted down by ${shift.toFixed(1)} px.`;
      }
    }

    const report = [
      `sceneBarRect: ${JSON.stringify({ left: barRect.left, top: barRect.top, width: barRect.width, height: barRect.height })}`,
      `sceneButtonRects: ${JSON.stringify(sceneButtonRects)}`,
      `addButtonRect: ${JSON.stringify(addButtonRect)}`,
      `deleteButtonRect: ${JSON.stringify(deleteButtonRect)}`,
      `lastTapX: ${lastTapX}`,
      `lastTapY: ${lastTapY}`,
      `matchedButton: ${matchedButton}`,
      `verticalDelta: ${verticalDelta.toFixed(1)}px`,
      `horizontalDelta: ${horizontalDelta.toFixed(1)}px`,
      `whether tap landed inside visual rect: ${insideVisual ? 'YES' : 'NO'}`,
      `whether tap landed inside touch rect: ${insideTouch ? 'YES' : 'NO'}`,
      '',
      pass ? 'PASS:\nVisual rect and touch rect aligned.' : `FAIL:\n${shiftMessage}`
    ].join('\n');

    setScenesTestResult(report);
  }, [sceneTouchTelemetry]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      setIframeLoading(false);
      iframeReady.current = true;
      updateStagexDiagnostics({
        iframeLoadFired: true,
        contentWindowAvailable: !!iframe.contentWindow
      });
      try { iframe.contentWindow?.postMessage('stage-core-ping', '*'); } catch {}
      injectAccentVars(iframe, accent.from, accent.to);
      injectTheme(iframe, stageVis.theme ?? 'dark');
      injectAmoled(iframe, isAmoled);
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          let s = doc.getElementById('react-parent-overrides');
          if (!s) {
            s = doc.createElement('style');
            s.id = 'react-parent-overrides';
            s.textContent = isWebDesktop ? HIDE_IFRAME_UI : HIDE_IFRAME_UI_MOBILE;
            doc.head.appendChild(s);
          }
          if (!doc.getElementById('sc-scroll-spy')) {
            const scr = doc.createElement('script');
            scr.id = 'sc-scroll-spy';
            scr.textContent = `(function(){
              var ly=0;
              function h(e){
                var t=e.target;
                if(t&&t.closest&&t.closest('#bottom-toolbar,#properties-panel'))return;
                var y=t.scrollTop;
                if(typeof y!=='number')return;
                if(y<30){window.parent.postMessage({type:'sc-scroll-dir',down:false},'*');ly=y;return;}
                var dy=y-ly;
                if(Math.abs(dy)<6)return;
                window.parent.postMessage({type:'sc-scroll-dir',down:dy>0},'*');
                ly=y;
              }
              document.addEventListener('scroll',h,{passive:true,capture:true});
            })();`;
            doc.body.appendChild(scr);
          }
        }
      } catch {}
      try {
        (iframe.contentWindow as StageWin).__onViewChange = (view: string) => {
          setCurView(view === 'Assistant' ? 'Preferences' : view);
        };
      } catch {}

      const s2 = useChordStore.getState();
      const savedStageView = s2.settings.restoreLastSession ? s2.lastSession?.stagexView : undefined;
      const defView = savedStageView || settings.defaultStageView;
      if (defView && defView !== 'Editor') {
        setTimeout(() => {
          try {
            const win = iframe.contentWindow as StageWin;
            if (defView === 'Setup' || defView === 'SetupHub') {
              win?.switchView?.('SetupHub');
            } else if (defView === 'Preferences' || defView === 'Assistant') {
              win?.switchView?.('Assistant');
            } else if (defView === 'Export') {
              win?.switchView?.('Export');
            }
          } catch {}
        }, 200);
      }

      injectStartOnPicker(iframe);
    };
    iframe.addEventListener('load', handleLoad);
    let docComplete = false;
    try {
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        docComplete = true;
      }
    } catch (e) {
      console.warn('Failed to access contentDocument on mount:', e);
    }
    if (docComplete) {
      handleLoad();
    }
    return () => iframe.removeEventListener('load', handleLoad);
  }, [accent.from, accent.to, stageVis.theme, isAmoled, isWebDesktop, settings.defaultStageView]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const origin = e.origin || '';
      updateStagexDiagnostics({
        actualEventOrigin: origin
      });
      const isAllowedOrigin = !origin || origin === 'null' ||
        origin === window.location.origin ||
        origin.startsWith('https://localhost') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('capacitor://localhost');
      if (!isAllowedOrigin) {
        updateStagexDiagnostics({ originRejected: true });
        return;
      }
      if (e.source !== iframeRef.current?.contentWindow) return;

      // Increment received message counter
      setDiagTaps(prev => ({ ...prev, recvMsgs: prev.recvMsgs + 1 }));
      updateStagexDiagnostics({
        messagesReceived: getStagexDiagnostics().messagesReceived + 1
      });

      if (showDiagnostics) {
        logDiagnostic(`[MSG RECV] type: ${e.data?.type || 'unknown'} | data: ${JSON.stringify(e.data || {})}`);
      }

      if (e.data?.type === 'sc-diagnostic') {
        const detail = e.data.detail;
        if (detail === 'sc-runtime-ready') {
          updateStagexDiagnostics({ stageCoreReadyReceived: true });
        } else if (detail === 'sc-listener-installed') {
          updateStagexDiagnostics({ iframeListenerInstalled: true });
        } else if (detail === 'sc-origin-rejected') {
          updateStagexDiagnostics({ originRejected: true, lastError: `Origin rejected: actual=${e.data.actual} expected=${e.data.expected}` });
        } else if (detail === 'sc-command-received') {
          // command received
        } else if (detail === 'sc-command-dispatched') {
          // command completed
        } else if (detail === 'sc-command-handler-missing') {
          updateStagexDiagnostics({ handlerMissing: true, lastError: `Handler missing for command: ${e.data.fn}` });
        } else if (detail === 'sc-command-handler-error') {
          updateStagexDiagnostics({ handlerFailed: true, lastError: `Handler error in command ${e.data.fn}: ${e.data.error}` });
        } else if (detail === 'sc-runtime-error') {
          updateStagexDiagnostics({ lastError: `Runtime error: ${e.data.error}` });
        }
        return;
      }

      if (e.data?.type === 'sc-ack') {
        const msgId = e.data.msgId;
        if (pendingAcks.current.has(msgId)) {
          clearTimeout(pendingAcks.current.get(msgId)!.timer);
          pendingAcks.current.delete(msgId);
          logDiagnostic(`[ACK] Received ACK for command: ${e.data.fn}`);
        }
        updateStagexDiagnostics({
          ackCount: getStagexDiagnostics().ackCount + 1,
          lastAckReceived: new Date().toLocaleTimeString()
        });
        return;
      }

      if (e.data?.type === 'sc-nack') {
        const msgId = e.data.msgId;
        const cmd = e.data.command || 'unknown';
        const status = e.data.status || 'unknown';
        const handlerName = e.data.handlerName || 'unknown';
        const errorMsg = e.data.error || 'unknown error';

        if (pendingAcks.current.has(msgId)) {
          clearTimeout(pendingAcks.current.get(msgId)!.timer);
          pendingAcks.current.delete(msgId);
          logDiagnostic(`[NACK] Received NACK for command: ${cmd} (status: ${status}, error: ${errorMsg})`);
        }

        const diagnostics = getStagexDiagnostics();
        const missingHandlers = [...(diagnostics.missingHandlers || [])];
        if (status === 'missing' && !missingHandlers.includes(handlerName)) {
          missingHandlers.push(handlerName);
        }

        updateStagexDiagnostics({
          nackCount: diagnostics.nackCount + 1,
          lastNack: cmd,
          lastMissingHandler: status === 'missing' ? handlerName : diagnostics.lastMissingHandler,
          lastFailedHandler: status === 'error' ? handlerName : diagnostics.lastFailedHandler,
          lastError: status === 'error' ? `Handler error in command ${cmd}: ${errorMsg}` : diagnostics.lastError,
          missingHandlers
        });
        return;
      }

      if (e.data?.type === 'sc-dial-state') setFabOpen(!!e.data.open);
      if (e.data?.type === 'sc-scroll-dir') setNavCollapsed(!!e.data.down);
      if (e.data?.type === 'sc-prop-state') setPropPanelOpen(e.data.state === 'open' || e.data.state === 'peek');
      if (e.data?.type === 'sc-live-mode') setLiveMode(!!e.data.on);
      if (e.data?.type === 'sc-overlay-state') setHasOpenOverlay(!!e.data.open);
      if (e.data?.type === 'sc-scene-touch') {
        setSceneTouchTelemetry(prev => {
          const next = [...prev, e.data];
          if (next.length > 5) return next.slice(next.length - 5);
          return next;
        });
      }
      if (e.data?.type === 'sc-scene-info' && e.data.info) {
        setPdfSceneInfo({
          count: e.data.info.count || 1,
          currentIdx: e.data.info.currentIdx || 0,
          names: e.data.info.names || ['Scene 1']
        });
      }
      if (e.data?.type === 'sc-back-bubble') {
        if (isStageExpanded) {
          toggleStageExpanded();
        } else {
          const behavior = useChordStore.getState().settings.swipeBackBehavior || 'exit-to-hub';
          if (behavior === 'exit-to-hub') {
            returnToStudioHub();
          }
        }
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [showDiagnostics, logDiagnostic, setSceneTouchTelemetry]);

  useEffect(() => {
    updateStagexDiagnostics({
      iframeMounted: true,
      iframeSrc: '/stage-core/index.html',
      wrapperListenerRegistered: true,
      currentOrigin: window.location.origin,
      expectedOrigin: window.location.origin
    });
    let cancelled = false;
    void import('@workspace/studio-core').then(({ registerStageIframe }) => {
      if (cancelled) return;
      registerStageIframe(iframeRef.current);
    });
    return () => {
      cancelled = true;
      void import('@workspace/studio-core').then(({ registerStageIframe }) => registerStageIframe(null));
      updateStagexDiagnostics({
        iframeMounted: false,
        wrapperListenerRegistered: false
      });
    };
  }, []);

  useEffect(() => {
    registerDebugProvider({
      id: 'stagex',
      name: 'Stagex Editor',
      getDebugState: () => ({
        activeImplementation: 'Modern Web Adaptation (Android)',
        activeStageCorePanel: 'v3.6.45',
        iframeLoaded: !iframeLoading,
        iframeReady: iframeReady.current,
        bridgeConnected: iframeReady.current && !iframeLoading,
        bridgeMessagesSent: diagTaps.sentMsgs,
        bridgeMessagesReceived: diagTaps.recvMsgs,
        activeTab: curView,
        selectedElement: 'none',
        overlayState: hasOpenOverlay ? 'open' : 'closed',
        scenesTestResult,
        sceneTouchTelemetry,
        diagTaps,
        controlState: {
          Add: { rendered: true, lastError: null },
          Setup: { rendered: true, lastError: null },
          Preferences: { rendered: true, lastError: null },
          Save: { rendered: true, lastError: null },
          Export: { rendered: true, lastError: null },
          Visibility: { rendered: true, lastError: null },
          Rotate: { rendered: true, lastError: null }
        }
      }),
      getActions: () => [
        {
          label: 'Show Stagex Scene Hitboxes',
          action: toggleHitboxDebugAction
        },
        {
          label: 'Test Stagex Scenes Input',
          action: runScenesInputTest
        }
      ]
    });
    return () => {
      unregisterDebugProvider('stagex');
    };
  }, [iframeLoading, curView, hasOpenOverlay, diagTaps, scenesTestResult, sceneTouchTelemetry, runScenesInputTest, toggleHitboxDebugAction]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    injectAccentVars(iframe, accent.from, accent.to);
    injectTheme(iframe, stageVis.theme ?? 'dark');
  }, [accent.from, accent.to, stageVis.theme]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    injectAmoled(iframe, isAmoled);
  }, [isAmoled]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (doc) {
        const ls = doc.getElementById('landscape-overrides');
        if (ls) ls.remove();
      }
    } catch {}
    try {
      iframe.contentWindow?.postMessage({ type: 'sc-landscape', landscape: isLandscape }, '*');
    } catch {}
  }, [isLandscape]);

  useBackHandler('sheet', () => {
    if (pdfSheetOpen) {
      setPdfSheetOpen(false);
      return true;
    }
    if (showDiagnostics) {
      setShowDiagnostics(false);
      return true;
    }
    if (fabOpen) {
      callIframe('toggleSCDial');
      setFabOpen(false);
      return true;
    }
    return false;
  }, [pdfSheetOpen, showDiagnostics, fabOpen, callIframe]);

  useBackHandler('nested', () => {
    if (!iframeReady.current) {
      returnToStudioHub();
      return true;
    }
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: 'sc-back-request' }, '*');
    } catch (e) {
      returnToStudioHub();
    }
    return true;
  }, [returnToStudioHub]);

  const hasWebHeader = !isWebDesktop || (curView === 'Editor' || curView === 'Export' || showBack);
  const collapseHeader = (isLandscape && curView === 'Editor') || liveMode || !hasWebHeader || isStageExpanded;
  const hideBottomNav  = curView === 'Export' || isStageExpanded || fabOpen || propPanelOpen;
  const isLandscapeEditor = isLandscape && curView === 'Editor';

  const navTabs: { view: string; label: string; icon: string }[] = [
    { view: 'Editor', label: tr.stagex.navStage, icon: 'grid_view' },
    { view: 'Setup', label: tr.stagex.navSetup, icon: 'folder_open' },
    { view: 'Preferences', label: tr.stagex.navPreferences, icon: 'tune' },
  ];

  const isTabActive = (view: string) => {
    if (view === 'Editor') return curView === 'Editor' || curView === 'Export';
    if (view === 'Setup') return ['SetupHub','Rider','Setlist','Gear','Members'].includes(curView);
    if (view === 'Preferences') return curView === 'Preferences';
    return false;
  };

  const handleNavTap = useCallback((view: string) => {
    setNavCollapsed(false);
    // Optimistically update curView so the top toolbar swaps immediately —
    // don't wait for the iframe's __onViewChange callback to round-trip,
    // which can race on iframe reloads and leave the wrong toolbar showing.
    if (view === 'Setup') {
      setCurView('SetupHub');
      callIframe('switchView', 'SetupHub');
    } else {
      setCurView(view);
      callIframe('switchView', view);
    }
  }, [callIframe]);

  const handleFabTap = useCallback(() => {
    callIframe('toggleSCDial');
  }, [callIframe]);

  /* ── Glassmorphism pill bg ──────────────────────────────── */
  const stagePillBg = isAmoled
    ? 'rgba(4,4,4,0.88)'
    : isLight
      ? 'rgba(255, 255, 255, 0.40)'
      : 'rgba(26,26,30,0.82)';

  /* ── Pill measurement helpers ───────────────────────────── */
  const measureStageBtn = (idx: number) => {
    const btn = stageBtnRefs.current[idx];
    const nav = stageNavRef.current;
    if (!btn || !nav) return null;
    const nr = nav.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    return { left: br.left - nr.left, right: br.right - nr.left };
  };

  /* Init pill on mount */
  useEffect(() => {
    const idx = navTabs.findIndex(t => isTabActive(t.view));
    const m = measureStageBtn(idx >= 0 ? idx : 0);
    if (m) setStagePill({ left: m.left, right: m.right, ready: true });
    if (stageNavRef.current) {
      setExpandedStageH(stageNavRef.current.offsetHeight);
      setExpandedStageW(stageNavRef.current.offsetWidth);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Animate pill when view changes + always show nav on view change */
  useEffect(() => {
    // Any view transition (including back-button from scrollable sections) resets nav visibility
    setNavCollapsed(false);

    const newIdx = navTabs.findIndex(t => isTabActive(t.view));
    if (newIdx < 0) return;
    const oldIdx = prevTabRef.current;
    if (newIdx === oldIdx) return;
    prevTabRef.current = newIdx;
    const newM = measureStageBtn(newIdx);
    if (!newM) return;
    if (stageStretchRef.current) {
      clearTimeout(stageStretchRef.current);
      stageStretchRef.current = null;
      setStagePill(p => ({ ...p, left: newM.left, right: newM.right }));
      return;
    }
    if (newIdx > oldIdx) {
      setStagePill(p => ({ ...p, right: newM.right }));
      stageStretchRef.current = setTimeout(() => {
        setStagePill(p => ({ ...p, left: newM.left }));
        stageStretchRef.current = null;
      }, 90);
    } else {
      setStagePill(p => ({ ...p, left: newM.left }));
      stageStretchRef.current = setTimeout(() => {
        setStagePill(p => ({ ...p, right: newM.right }));
        stageStretchRef.current = null;
      }, 90);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curView]);

  const renderItemIcon = (item: any) => {
    if (item.isCustom) {
      if (item.imageData) {
        return <img src={item.imageData} style={{ width: '20px', height: '20px', objectFit: 'contain' }} alt="" />;
      }
      return <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.emoji || '🎵'}</span>;
    }
    const svgPath = STAGEX_ICON_MAP[item.icon];
    if (svgPath) {
      const isRaster = svgPath.endsWith('.png') || svgPath.endsWith('.webp');
      const filterStyle = isRaster ? undefined : (isLight ? 'opacity(0.7)' : 'invert(1) opacity(0.7)');
      return (
        <img
          src={svgPath}
          style={{ width: '20px', height: '20px', objectFit: 'contain', filter: filterStyle }}
          alt=""
        />
      );
    }
    return (
      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }}>
        {item.icon}
      </span>
    );
  };

  const renderCard = (item: any) => {
    return (
      <button
        key={item.name}
        onClick={() => handleAddElement(item)}
        className={`btn-smooth ${isLight ? 'hover:bg-black/5' : 'hover:bg-white/5'} text-left`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 4px',
          background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
          border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)',
          borderRadius: '8px',
          cursor: 'pointer',
          height: '68px',
          width: '100%',
          boxSizing: 'border-box',
          transition: 'all 150ms ease',
        }}
      >
        <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {renderItemIcon(item)}
        </div>
        <span style={{
          fontSize: '8px',
          fontWeight: 700,
          color: isLight ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.65)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          textAlign: 'center',
          marginTop: '6px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: '100%',
          padding: '0 4px',
          boxSizing: 'border-box'
        }}>
          {item.name}
        </span>
      </button>
    );
  };

  const renderStageCollapsibleSection = (
    id: string,
    title: string,
    icon: string,
    content: React.ReactNode,
    isAccent = false,
    isGold = false
  ) => {
    const isCollapsed = !expandedCats[id];
    const headerColor = isAccent ? accent.from : isGold ? '#f0b429' : (isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255, 255, 255, 0.4)');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderBottom: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255, 255, 255, 0.04)', paddingBottom: isCollapsed ? 6 : 10 }}>
        <div
          onClick={() => setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }))}
          className={`btn-smooth ${isLight ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255, 255, 255, 0.01)',
            border: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: headerColor }}>
              {icon}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: isCollapsed ? (isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)') : (isLight ? '#000' : '#fff') }}>
              {title}
            </span>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)', transition: 'transform 200ms', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            expand_more
          </span>
        </div>
        {!isCollapsed && (
          <div style={{ padding: '4px 2px 0 2px' }}>
            {content}
          </div>
        )}
      </div>
    );
  };

  if (isWebDesktop) {
    return (
      <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', background: stageBg, position: 'relative' }}>
        <WebAppSectionDock
          app="stage"
          activeSection={isTabActive('Editor') ? 'Editor' : isTabActive('Setup') ? 'Setup' : 'Preferences'}
          onChangeSection={handleNavTap}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden', background: stageBg, position: 'relative' }}>

          {/* Top header/toolbar */}
          <WebToolbar className={`border-b ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-900 bg-[#080808]'} h-12 flex-shrink-0 select-none`}>
            <div className="flex items-center gap-3">
              <span className={`font-extrabold text-[10px] uppercase ${isLight ? 'text-zinc-850' : 'text-white'} tracking-widest`} style={{ letterSpacing: '0.08em' }}>
                Stagex
              </span>
              <div className={`h-4 w-[1px] ${isLight ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
              <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase tracking-widest">
                {curView === 'Editor' ? 'Stage Plot Editor' : curView === 'Export' ? 'Rider Export' : 'Setup & Options'}
              </span>
            </div>

            {curView === 'Editor' && (
              <div className="flex gap-1.5">
                {[
                  { label: tr.stagex.toolMeasure, icon: 'straighten', fn: () => callIframe('scActivateMeasure') },
                  { label: tr.stagex.toolHistory, icon: 'history', fn: () => callIframe('openTimelinePanel') },
                ].map(({ label, icon, fn }) => (
                  <WebButton
                    key={label}
                    onClick={fn}
                    variant="secondary"
                    className="h-8 !px-2.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">{icon}</span>
                    {label}
                  </WebButton>
                ))}
                <WebButton
                  onClick={() => callIframe('openPresetsPanel')}
                  variant="secondary"
                  className="h-8 !px-2.5"
                >
                  <span className="material-symbols-outlined text-[15px]">save</span>
                  Save Preset
                </WebButton>
                <WebButton
                  onClick={() => { setCurView('Export'); callIframe('switchView', 'Export'); }}
                  variant="secondary"
                  className="h-8 !px-2.5"
                >
                  <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
                  Export Rider
                </WebButton>
              </div>
            )}

            {curView === 'Export' && (
              <div className="flex gap-1.5">
                <WebButton
                  onClick={() => { setCurView('Editor'); callIframe('switchView', 'Editor'); }}
                  variant="secondary"
                  className="h-8 !px-2.5"
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                  Editor
                </WebButton>
                <WebButton
                  onClick={() => callIframe('toggleExportOptions')}
                  variant="secondary"
                  className="h-8 !px-2.5"
                >
                  <span className="material-symbols-outlined text-[15px]">tune</span>
                  Sections
                </WebButton>
                <WebButton
                  onClick={openPdfSheet}
                  variant="primary"
                  className="h-8 !px-2.5"
                >
                  <span className="material-symbols-outlined text-[15px]">download</span>
                  Get PDF
                </WebButton>
              </div>
            )}
          </WebToolbar>

          {/* Main workspace area */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              flex: 1,
              margin: '12px',
              border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              overflow: 'hidden',
              position: 'relative',
              background: stageBg,
            }}>
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="Stagex Canvas"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', display: 'block', backgroundColor: 'transparent' }}
                allow="clipboard-write"
              />
              {iframeLoading && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: stageBg }}>
                  <SmartLoading app="stage" />
                </div>
              )}
            </div>

            {curView === 'Editor' && (
              <button
                onClick={() => setIsRightPanelCollapsed(v => !v)}
                title={isRightPanelCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-label={isRightPanelCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: isRightPanelCollapsed ? 0 : 260,
                  transform: 'translateY(-50%)',
                  zIndex: 99,
                  width: 18,
                  height: 64,
                  background: isLight ? 'rgba(240, 240, 242, 0.95)' : 'rgba(20, 20, 24, 0.95)',
                  border: isLight ? '1px solid rgba(0, 0, 0, 0.15)' : '1px solid rgba(255, 255, 255, 0.15)',
                  borderRight: 'none',
                  borderRadius: '8px 0 0 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isLight ? '#27272a' : '#a1a1aa',
                  transition: 'right 250ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 200ms, color 200ms',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  boxShadow: isLight ? '-2px 0 8px rgba(0,0,0,0.06)' : '-2px 0 8px rgba(0,0,0,0.3)',
                }}
                onPointerOver={e => e.currentTarget.style.color = '#3b82f6'}
                onPointerOut={e => e.currentTarget.style.color = isLight ? '#27272a' : '#a1a1aa'}
              >
                {isRightPanelCollapsed ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                )}
              </button>
            )}

            {curView === 'Editor' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{
                  opacity: isRightPanelCollapsed ? 0 : 1,
                  x: isRightPanelCollapsed ? 20 : 0,
                  width: isRightPanelCollapsed ? 0 : 260
                }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  borderLeft: isRightPanelCollapsed ? 'none' : (isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)'),
                  background: isLight ? 'var(--app-surface-low)' : '#080809',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                {/* Scrollable Elements Area */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px 16px var(--content-bottom-pad, 96px) 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}>
                  {/* Title & Search */}
                  <div>
                    <h4 style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
                      Stage Elements
                    </h4>

                    <div style={{ position: 'relative', width: '100%', marginBottom: '4px' }}>
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)' }}>
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Search elements..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          height: '32px',
                          background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                          border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.07)',
                          borderRadius: '6px',
                          paddingLeft: '32px',
                          paddingRight: searchQuery ? '28px' : '10px',
                          fontSize: '11px',
                          color: isLight ? '#000' : '#fff',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Elements List */}
                  {searchQuery ? (
                    <div>
                      <h5 style={{ fontSize: '8.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>
                        Search Results
                      </h5>
                      {(() => {
                        const results = getSearchResults();
                        if (results.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '24px 12px', color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)', fontSize: '11px' }}>
                              No elements found
                            </div>
                          );
                        }
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                            {results.map((item, idx) => (
                              <div key={idx} style={{ width: '100%' }}>
                                {renderCard(item)}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {renderStageCollapsibleSection(
                        'presets',
                        CATEGORY_LABELS.presets,
                        CATEGORY_ICONS.presets,
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button
                            onClick={() => callIframe('openPresetsPanel')}
                            className={`btn-smooth ${isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-200' : 'bg-zinc-900 hover:bg-zinc-850 text-white border-zinc-800 hover:border-zinc-700'} border`}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontSize: '9px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>save</span>
                            Save Preset
                          </button>
                          <button
                            onClick={() => callIframe('scOpenElPresets')}
                            className={`btn-smooth ${isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-200' : 'bg-zinc-900 hover:bg-zinc-850 text-white border-zinc-800 hover:border-zinc-700'} border`}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontSize: '9px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bookmark</span>
                            Manage Presets
                          </button>
                        </div>,
                        false,
                        true
                      )}

                      {renderStageCollapsibleSection(
                        'custom',
                        CATEGORY_LABELS.custom,
                        CATEGORY_ICONS.custom,
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button
                            onClick={() => {
                              try {
                                const win = iframeRef.current?.contentWindow as any;
                                win?.openCustomElementModal?.();
                              } catch {}
                            }}
                            className={`btn-smooth ${isLight ? 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900' : 'hover:bg-zinc-800 text-zinc-350 hover:text-white'}`}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: 'transparent',
                              border: isLight ? '1px dashed rgba(0,0,0,0.15)' : '1px dashed rgba(255,255,255,0.15)',
                              borderRadius: '8px',
                              fontSize: '9px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                            Create Custom
                          </button>

                          {customElements.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '4px' }}>
                              {customElements.map((item, idx) => (
                                <div key={idx} style={{ width: '100%' }}>
                                  {renderCard({ ...item, isCustom: true })}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '9px', color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '12px 6px' }}>
                              No custom elements yet.
                            </div>
                          )}
                        </div>,
                        true
                      )}

                      {Object.keys(STAGEX_LIBRARY).map((catKey) =>
                        renderStageCollapsibleSection(
                          catKey,
                          CATEGORY_LABELS[catKey],
                          CATEGORY_ICONS[catKey],
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                            {STAGEX_LIBRARY[catKey].map((item, idx) => (
                              <div key={idx} style={{ width: '100%' }}>
                                {renderCard(item)}
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* Fixed Bottom Section */}
                <div style={{
                  padding: '16px',
                  borderTop: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)',
                  background: isLight ? 'var(--app-surface-low)' : '#0a0a0c',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  <div>
                    <h4 style={{ fontSize: '8.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
                      View Mode
                    </h4>
                    <button
                      onClick={() => callIframe('toggleGigMode')}
                      className={`btn-smooth border w-full ${
                        liveMode
                          ? (isLight ? 'bg-zinc-900 text-white border-transparent font-extrabold' : 'bg-zinc-100 text-zinc-950 border-transparent font-extrabold')
                          : (isLight ? 'bg-transparent text-zinc-600 hover:text-zinc-900 border-zinc-200 hover:border-zinc-350' : 'bg-transparent text-zinc-400 hover:text-white border-zinc-800 hover:border-zinc-700')
                      }`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                        padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        {liveMode ? 'visibility' : 'visibility_off'}
                      </span>
                      {liveMode ? 'Live Mode Active' : 'Enter Live Mode'}
                    </button>
                  </div>
                  <div style={{ fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.15)' }}>
                    Stagex Module v4.0.0
                  </div>
                </div>
              </motion.div>
            )}
          </div>

        </div>
        {pdfSheetOpen && (
          <>
            <div
              onClick={() => !pdfBusy && setPdfSheetOpen(false)}
              style={{
                position: 'absolute', inset: 0, zIndex: 9998,
                background: 'rgba(0,0,0,0.55)',
                animation: 'pdfSheetFade 180ms ease-out',
              }}
            />
            <div
              style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999,
                background: isLight ? '#ffffff' : '#0c0c0d',
                border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '24px',
                width: '400px',
                boxShadow: isLight ? '0 20px 50px rgba(0,0,0,0.12)' : '0 20px 50px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: 12, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.14em',
                color: isLight ? '#000' : 'white', marginBottom: 18,
              }}>
                {tr.stagex.pdfSheetTitle}
              </div>

              <label style={{
                display: 'block',
                fontFamily: 'Manrope, sans-serif',
                fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.65)',
                marginBottom: 6,
              }}>
                {tr.stagex.pdfSheetName}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
                <input
                  type="text"
                  value={pdfFileName}
                  onChange={(e) => setPdfFileName(e.target.value)}
                  disabled={pdfBusy}
                  maxLength={64}
                  style={{
                    flex: 1,
                    padding: '11px 12px',
                    background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                    border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 10,
                    color: isLight ? '#000' : '#fff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <span style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12, fontWeight: 600,
                  color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.55)',
                  paddingRight: 4,
                }}>.pdf</span>
              </div>

              {pdfSceneInfo.count > 1 && (
                <>
                  <label style={{
                    display: 'block',
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.65)',
                    marginBottom: 6,
                  }}>
                    {tr.stagex.pdfSheetScene}
                  </label>
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18,
                  }}>
                    {([
                      { key: 'current' as const, label: tr.stagex.pdfSheetSceneCurrent },
                      ...pdfSceneInfo.names.slice(0, pdfSceneInfo.count).map((n, i) => ({ key: i, label: n })),
                      { key: 'all' as const, label: tr.stagex.pdfSheetSceneAll },
                    ]).map(({ key, label }) => {
                      const active = pdfSceneChoice === key;
                      return (
                        <button
                          key={String(key)}
                          onClick={() => setPdfSceneChoice(key)}
                          disabled={pdfBusy}
                          style={{
                            padding: '7px 12px',
                            background: active
                              ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                              : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'),
                            color: active ? '#fff' : (isLight ? '#000' : '#fff'),
                            border: `1px solid ${active ? 'transparent' : (isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)')}`,
                            borderRadius: 8,
                            fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            cursor: pdfBusy ? 'wait' : 'pointer',
                            transition: 'background 150ms, color 150ms, border-color 150ms',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <AnimatedActionButton
                  onClick={() => runPdfExport('save')}
                  disabled={pdfBusy || !pdfFileName.trim()}
                  borderRadius={12}
                  trailColor={accent.to}
                  wrapStyle={{ width: '100%' }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', height: 48,
                    background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                    color: '#fff', border: 'none',
                    fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    cursor: pdfBusy ? 'wait' : 'pointer',
                    opacity: pdfBusy || !pdfFileName.trim() ? 0.55 : 1,
                    boxShadow: `0 4px 18px ${accent.from}44`,
                    transition: 'opacity 150ms',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, lineHeight: 1 }}>download</span>
                  {tr.stagex.pdfSheetSave}
                </AnimatedActionButton>

                {canShareFiles && (
                  <button
                    onClick={() => runPdfExport('share')}
                    disabled={pdfBusy || !pdfFileName.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      width: '100%', height: 48,
                      background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
                      color: isLight ? '#000' : '#fff',
                      border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 12,
                      fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      cursor: pdfBusy ? 'wait' : 'pointer',
                      opacity: pdfBusy || !pdfFileName.trim() ? 0.55 : 1,
                      transition: 'opacity 150ms',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, lineHeight: 1 }}>ios_share</span>
                    {tr.stagex.pdfSheetShare}
                  </button>
                )}

                <button
                  onClick={() => setPdfSheetOpen(false)}
                  disabled={pdfBusy}
                  style={{
                    width: '100%', height: 44,
                    background: 'transparent',
                    color: 'rgba(180,185,200,0.7)',
                    border: 'none',
                    fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    cursor: 'pointer',
                    opacity: pdfBusy ? 0.4 : 1,
                  }}
                >
                  {tr.stagex.pdfSheetCancel}
                </button>
              </div>
            </div>
            <style>{`
              @keyframes pdfSheetFade { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100dvh', background: stageBg, transition: 'background 180ms ease' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: (isWebDesktop && isLargeDesktop) ? 'row' : 'column',
          flex: 1,
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        {isWebDesktop && (
          <WebAppSectionDock
            app="stage"
            activeSection={isTabActive('Editor') ? 'Editor' : isTabActive('Setup') ? 'Setup' : 'Preferences'}
            onChangeSection={handleNavTap}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>

      <div style={{
        flexShrink: 0,
        overflow: collapseHeader ? 'hidden' : 'visible',
        height: collapseHeader ? 0 : 'calc(env(safe-area-inset-top) + 68px)',
        // In the Export view we want the header to disappear instantly on
        // scroll-down (no animation). In landscape Editor mode we still
        // animate the collapse for a smooth rotation feel.
        transition: curView === 'Export' ? 'none' : 'height 260ms cubic-bezier(0.4,0,0.2,1)',
      }}>
      <div style={{ height: 'env(safe-area-inset-top)', background: 'transparent', flexShrink: 0 }} />

      <div className="spring-in" style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '24px 24px 4px',
        background: stageHdr,
        transition: 'background 180ms ease',
        gap: showBack ? 8 : 0,
        position: 'relative',
      }}>

        <div style={{
          overflow: 'hidden',
          flexShrink: 0,
          width: showBack ? '46px' : '0px',
          opacity: showBack ? 1 : 0,
          transition: 'width 300ms cubic-bezier(0.34,1.1,0.64,1), opacity 200ms ease',
        }}>
          <button
            onClick={() => {
              // Drive the iframe directly using React's known view, so we don't
              // depend on the iframe's internal state.currentView staying in sync.
              // Optimistically update curView so the toolbar swaps instantly.
              try {
                const win = iframeRef.current?.contentWindow as (Record<string, unknown> & { switchView?: (v: string) => void }) | null;
                const sv = win?.switchView;
                if (typeof sv === 'function') {
                  if (curView === 'Export') { setCurView('Editor'); sv('Editor'); return; }
                  if (['Rider', 'Setlist', 'Gear', 'Members'].includes(curView)) { setCurView('SetupHub'); sv('SetupHub'); return; }
                  setCurView('Editor');
                  sv('Editor');
                  return;
                }
              } catch {}
              callIframe('stageGoBack');
            }}
            className="btn-smooth"
            aria-label="Back"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--app-surface-high)',
              border: '1px solid rgba(128,128,128,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 500ms cubic-bezier(0.4,0,0.2,1)',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: 18 }}>
              arrow_back
            </span>
          </button>
        </div>

        {!isWebDesktop && (
          <AppModeMenuLogo color={isLight ? 'rgba(0,0,0,0.80)' : 'rgba(255,255,255,0.90)'} size={13} />
        )}

        <div style={{ flex: 1 }} />

        {curView === 'Editor' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>

            {(
              [
                // v3.0.56: Auto-arrange removed from top toolbar — its
                // function moved into the iframe vertical sidebar slot
                // that already shows `auto_fix_high`. Live mode (eye)
                // moved out of the top toolbar to a floating button
                // anchored above the blue + (FAB) below.
                { label: tr.stagex.toolMeasure, icon: 'straighten',    fn: () => callIframe('scActivateMeasure')   },
                { label: tr.stagex.toolHistory, icon: 'history',       fn: () => callIframe('openTimelinePanel')   },
              ] as { label: string; icon: string; fn: () => void; testid?: string }[]
            ).map(({ label, icon, fn, testid }) => (
              <button
                key={label}
                onClick={fn}
                onTouchEnd={(e) => { e.preventDefault(); fn(); }}
                title={label}
                aria-label={label}
                data-testid={testid}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32,
                  background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
                  color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.75)',
                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
              </button>
            ))}

            <button
              onClick={() => callIframe('openPresetsPanel')}
              onTouchEnd={(e) => { e.preventDefault(); callIframe('openPresetsPanel'); }}
              title={tr.stagex.toolPresets}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32,
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
                color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.75)',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
                borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>save</span>
            </button>

            <button
              onClick={() => { setCurView('Export'); callIframe('switchView', 'Export'); }}
              onTouchEnd={(e) => { e.preventDefault(); setCurView('Export'); callIframe('switchView', 'Export'); }}
              title={tr.stagex.toolExport}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32,
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
                color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(180,185,200,0.7)',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
                borderRadius: '50%', cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>picture_as_pdf</span>
            </button>

          </div>
        )}

        {curView === 'Export' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              onClick={() => callIframe('toggleExportOptions')}
              onTouchEnd={(e) => { e.preventDefault(); callIframe('toggleExportOptions'); }}
              title="Sections"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32,
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
                color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.75)',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
                borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>tune</span>
            </button>
            <button
              onClick={openPdfSheet}
              onTouchEnd={(e) => { e.preventDefault(); openPdfSheet(); }}
              title="Export PDF"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32,
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
                color: isLight ? '#111' : '#fff',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
                borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'block',
                  width: 16, height: 16,
                  background: 'currentColor',
                  WebkitMask: `url(${import.meta.env.BASE_URL}icons/export-pdf.png) center / contain no-repeat`,
                  mask: `url(${import.meta.env.BASE_URL}icons/export-pdf.png) center / contain no-repeat`,
                }}
              />
            </button>
          </div>
        )}
      </div>
      </div>

      <div
        style={{
          position: 'relative',
          flex: 1,
          opacity: rotationTransition ? 0.15 : 1,
          transform: rotationTransition ? 'scale(0.97)' : 'scale(1)',
          pointerEvents: rotationTransition ? 'none' : 'auto',
          transition: 'opacity 280ms ease-in-out, transform 280ms ease-in-out',
          backgroundColor: stageBg
        }}
      >
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Stagex"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            backgroundColor: stageBg,
            transform: collapseHeader ? 'translateZ(0.01px)' : 'translateZ(0px)'
          }}
          allow="clipboard-write"
        />

        {iframeLoading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: stageBg }}>
            <SmartLoading app="stage" />
          </div>
        )}

        {showDiagnostics && (
          <div style={{
            position: 'absolute', top: 'env(safe-area-inset-top)', left: 8, right: 8,
            background: 'rgba(12,12,14,0.95)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: 12, zIndex: 99999,
            fontFamily: 'monospace', fontSize: 10, color: '#40c057',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            maxHeight: '40vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 8
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
              <span style={{ fontWeight: 800, color: '#fff' }}>STAGEX DIAGNOSTICS</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => {
                    const next = !safeMode;
                    setSafeMode(next);
                    localStorage.setItem('stagex_safe_mode_enabled', next ? 'true' : 'false');
                    logDiagnostic(`[Safe Mode] ${next ? 'ENABLED' : 'DISABLED'}`);
                  }}
                  style={{ padding: '3px 6px', background: safeMode ? '#e63946' : '#2a2a30', color: '#fff', border: 'none', borderRadius: 4, fontSize: 8, cursor: 'pointer' }}
                >
                  {safeMode ? 'Disable Safe Mode' : 'Enable Safe Mode'}
                </button>
                <button
                  onClick={runInteractionTest}
                  disabled={testActive}
                  style={{ padding: '3px 6px', background: testActive ? '#ffb703' : '#3b5bdb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 8, cursor: 'pointer' }}
                >
                  {testActive ? `Cycle ${testCycle} (${testStep})` : 'Run Test'}
                </button>
                <button
                  onClick={() => setDiagTaps({ bottomNav: 0, plus: 0, eye: 0, picker: 0, toolbar: 0, sentMsgs: 0, recvMsgs: 0 })}
                  style={{ padding: '3px 6px', background: '#495057', color: '#fff', border: 'none', borderRadius: 4, fontSize: 8, cursor: 'pointer' }}
                >
                  Reset
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 8 }}>
              <div>Nav: {diagTaps.bottomNav}</div>
              <div>Plus: {diagTaps.plus}</div>
              <div>Eye: {diagTaps.eye}</div>
              <div>Pick: {diagTaps.picker}</div>
              <div>Tool: {diagTaps.toolbar}</div>
              <div>Sent: {diagTaps.sentMsgs}</div>
              <div>Recv: {diagTaps.recvMsgs}</div>
              <div style={{ color: safeMode ? '#ff6b6b' : '#a0a0a5' }}>Safe: {safeMode ? 'ON' : 'OFF'}</div>
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '18vh', overflowY: 'auto', background: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 6 }}>
              {lastDiagLog}
            </pre>
          </div>
        )}

        {/* ── Stage Expand/Rotate Toggle ── */}
        {curView === 'Editor' && (
          <button
            onClick={toggleStageExpanded}
            onTouchEnd={(e) => { e.preventDefault(); toggleStageExpanded(); }}
            aria-label={isStageExpanded ? "Exit Landscape View" : "Enter Landscape View"}
            style={{
              position: 'absolute',
              bottom: isLandscapeEditor ? 124 : 'calc(max(10px, env(safe-area-inset-bottom)) + 76px + 100px + 16px)',
              right: 'calc(max(17px, env(safe-area-inset-right)))',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: isStageExpanded
                ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                : (isLight ? 'rgba(255,255,255,0.82)' : 'rgba(28,28,32,0.80)'),
              border: isStageExpanded ? 'none' : (isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.12)'),
              backdropFilter: isStageExpanded ? 'none' : 'blur(12px)',
              WebkitBackdropFilter: isStageExpanded ? 'none' : 'blur(12px)',
              boxShadow: isStageExpanded
                ? `0 4px 20px ${accent.from}90`
                : '0 4px 16px rgba(0,0,0,0.25)',
              zIndex: 20,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              opacity: (isLandscapeEditor && propPanelOpen || fabOpen) ? 0 : 1,
              pointerEvents: (isLandscapeEditor && propPanelOpen || fabOpen) ? 'none' as const : 'auto' as const,
              visibility: (isLandscapeEditor && propPanelOpen || fabOpen) ? 'hidden' as const : 'visible' as const,
              transition: 'background 300ms ease, box-shadow 300ms ease, opacity 420ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: isStageExpanded ? '#fff' : (isLight ? 'rgba(0,0,0,0.65)' : 'rgba(200,200,220,0.9)'), fontSize: 22, lineHeight: 1 }}>
              screen_rotation
            </span>
          </button>
        )}

        {/* ── Live-mode toggle (eye) — stacked 8px above the FAB ── */}
        {curView === 'Editor' && (
          <button
            id="stagex-eye-button"
            data-testid="stagex-eye-button"
            onClick={() => callIframe('toggleGigMode')}
            onTouchEnd={(e) => { e.preventDefault(); callIframe('toggleGigMode'); }}
            aria-label={liveMode ? tr.stagex.exitLiveMode : tr.stagex.enterLiveMode}
            style={{
              position: 'absolute',
              bottom: isLandscapeEditor ? 72 : 'calc(max(10px, env(safe-area-inset-bottom)) + 76px + 50px + 8px)',
              right: 'calc(max(17px, env(safe-area-inset-right)))',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: liveMode
                ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                : (isLight ? 'rgba(255,255,255,0.82)' : 'rgba(28,28,32,0.80)'),
              border: liveMode ? 'none' : (isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.12)'),
              backdropFilter: liveMode ? 'none' : 'blur(12px)',
              WebkitBackdropFilter: liveMode ? 'none' : 'blur(12px)',
              boxShadow: liveMode
                ? `0 4px 20px ${accent.from}90`
                : '0 4px 16px rgba(0,0,0,0.25)',
              zIndex: 20,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              opacity: (isLandscapeEditor && propPanelOpen || fabOpen) ? 0 : 1,
              pointerEvents: (isLandscapeEditor && propPanelOpen || fabOpen) ? 'none' as const : 'auto' as const,
              visibility: (isLandscapeEditor && propPanelOpen || fabOpen) ? 'hidden' as const : 'visible' as const,
              transition: 'background 300ms ease, box-shadow 300ms ease, opacity 420ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: liveMode ? '#fff' : (isLight ? 'rgba(0,0,0,0.65)' : 'rgba(200,200,220,0.9)'), fontSize: 22, lineHeight: 1 }}>
              {liveMode ? 'visibility' : 'visibility_off'}
            </span>
          </button>
        )}

        {/* ── FAB: add instrument ── */}
        {curView === 'Editor' && (
          <button
            id="stagex-plus-button"
            data-testid="stagex-plus-button"
            onClick={handleFabTap}
            onTouchEnd={(e) => { e.preventDefault(); handleFabTap(); }}
            aria-label={tr.stagex.addInstrument}
            style={{
              position: 'absolute',
              bottom: isLandscapeEditor ? 14 : 'calc(max(10px, env(safe-area-inset-bottom)) + 76px)',
              right: 'calc(max(14px, env(safe-area-inset-right)))',
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              border: 'none',
              zIndex: 20,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              display: 'flex',
              opacity: liveMode ? 0 : (isLandscapeEditor && propPanelOpen) ? 0 : 1,
              pointerEvents: liveMode ? 'none' as const : (isLandscapeEditor && propPanelOpen) ? 'none' as const : 'auto' as const,
              visibility: liveMode ? 'hidden' as const : (isLandscapeEditor && propPanelOpen) ? 'hidden' as const : 'visible' as const,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: fabOpen
                ? `0 6px 32px ${accent.from}99, 0 3px 12px rgba(0,0,0,0.4)`
                : `0 4px 24px ${accent.from}80, 0 2px 8px rgba(0,0,0,0.3)`,
              padding: 0,
              transform: fabOpen ? 'rotate(45deg) scale(1.08)' : 'rotate(0deg) scale(1)',
              transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, opacity 420ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 24, lineHeight: 1, transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>add</span>
          </button>
        )}

        {/* ── Glassmorphism bottom nav — matches Chordex BottomNav ── */}
        <div
          ref={stageNavRef}
          className="glass-nav"
          style={{
            display: isWebDesktop ? 'none' : undefined,
            position: 'absolute',
            bottom: 'max(10px, env(safe-area-inset-bottom))',
            left: '50%',
            transform: `translateX(-50%) translateY(${
              liveMode || hideBottomNav ? 'calc(100% + 32px)' : '0px'
            })`,
            pointerEvents: (liveMode || hideBottomNav || navCollapsed) ? 'none' : 'auto',
            opacity: liveMode ? 0 : 1,
            width: isLandscapeEditor ? '70%' : '90%',
            maxWidth: isLandscapeEditor ? '320px' : '400px',
            height: `${expandedStageH}px`,
            borderRadius: '2rem',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.32)'}`,
            background: stagePillBg,
            boxShadow: isLight
              ? '0 8px 32px rgba(0,0,0,0.14), 0 1.5px 0 rgba(255,255,255,0.80) inset'
              : '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 50,
            overflow: 'hidden',
            clipPath: navCollapsed
              ? `inset(${Math.max(0, expandedStageH - 5)}px ${Math.max(0, Math.floor((expandedStageW - 90) / 2))}px 0 ${Math.max(0, Math.floor((expandedStageW - 90) / 2))}px round 99px)`
              : 'inset(0 0 0 0 round 2rem)',
            willChange: 'clip-path, transform, opacity',
            transition: [
              navCollapsed
                ? 'clip-path 500ms cubic-bezier(0.4,0,0.2,1)'
                : 'clip-path 380ms cubic-bezier(0.16,1,0.3,1)',
              navCollapsed
                ? 'transform 500ms cubic-bezier(0.4,0,0.2,1)'
                : 'transform 380ms cubic-bezier(0.16,1,0.3,1)',
              'background-color 300ms ease',
            ].join(', '),
          }}
        >
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
            padding: isLandscapeEditor ? '3px 6px' : '6px 8px',
            opacity: navCollapsed ? 0 : 1,
            transition: navCollapsed ? 'opacity 100ms ease' : 'opacity 350ms ease 180ms',
            willChange: 'opacity',
          }}>

          {/* Elastic sliding pill */}
          {stagePill.ready && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: isLandscapeEditor ? 2 : 4,
                left: stagePill.left,
                width: stagePill.right - stagePill.left,
                height: isLandscapeEditor ? 'calc(100% - 4px)' : 'calc(100% - 8px)',
                borderRadius: 9999,
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.09)',
                border: isLight ? '1.5px solid rgba(0,0,0,0.14)' : '1.5px solid rgba(255,255,255,0.30)',
                boxShadow: isLight
                  ? 'inset 0 1px 0 rgba(255,255,255,0.90), 0 2px 8px rgba(0,0,0,0.10)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.40), 0 2px 16px rgba(255,255,255,0.06)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                pointerEvents: 'none',
                zIndex: 0,
                opacity: 1,
                transition: 'left 300ms cubic-bezier(0.16,1,0.3,1), width 300ms cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          )}

          {/* Nav buttons */}
          {useMemo(() => {
            return navTabs.map(({ view, label, icon }, i) => {
              const active  = isTabActive(view);
              return (
                <button
                  key={view}
                  ref={el => { stageBtnRefs.current[i] = el; }}
                  onClick={() => handleNavTap(view)}
                  onTouchEnd={(e) => { e.preventDefault(); handleNavTap(view); }}
                  className="stage-nav-btn"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: isLandscapeEditor ? 1 : 4,
                    padding: isLandscapeEditor ? '4px 4px' : '8px 4px',
                    borderRadius: 9999,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: active ? (isLight ? accent.from : '#fff') : (isLight ? 'rgba(0,0,0,0.4)' : 'var(--c-text-secondary, rgba(160,160,180,0.8))'),
                    position: 'relative',
                    zIndex: 1,
                    opacity: 1,
                    WebkitFontSmoothing: 'antialiased',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: isLandscapeEditor ? 16 : 20, lineHeight: 1, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
                  <span style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 700,
                    fontSize: isLandscapeEditor ? '7.5px' : '9.5px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    WebkitFontSmoothing: 'antialiased',
                  }}>
                    {label}
                  </span>
                </button>
              );
            });
          }, [curView, isLandscapeEditor, isLight, accent.from, handleNavTap])}
          </div>
        </div>
      </div>

      {/* ── PDF Export Bottom Sheet ───────────────────────── */}
      {pdfSheetOpen && (
        <>
          <div
            onClick={() => !pdfBusy && setPdfSheetOpen(false)}
            style={{
              position: 'absolute', inset: 0, zIndex: 9998,
              background: 'rgba(0,0,0,0.55)',
              animation: 'pdfSheetFade 180ms ease-out',
            }}
          />
          <div
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 9999,
              background: isLight ? '#ffffff' : (isAmoled ? '#000' : '#161616'),
              borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: '14px 18px 22px',
              boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
              animation: 'pdfSheetSlide 240ms cubic-bezier(.16,1,.3,1)',
            }}
          >
            <div style={{
              width: 38, height: 4, borderRadius: 2,
              background: isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)',
              margin: '0 auto 14px',
            }} />
            <div style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: 11, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              color: accent.from, marginBottom: 14,
            }}>
              {tr.stagex.pdfSheetTitle}
            </div>

            <label style={{
              display: 'block',
              fontFamily: 'Manrope, sans-serif',
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.65)',
              marginBottom: 6,
            }}>
              {tr.stagex.pdfSheetName}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
              <input
                type="text"
                value={pdfFileName}
                onChange={(e) => setPdfFileName(e.target.value)}
                disabled={pdfBusy}
                maxLength={64}
                style={{
                  flex: 1,
                  padding: '11px 12px',
                  background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: 10,
                  color: isLight ? '#111' : '#fff',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 12, fontWeight: 600,
                color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(180,185,200,0.55)',
                paddingRight: 4,
              }}>.pdf</span>
            </div>

            {pdfSceneInfo.count > 1 && (
              <>
                <label style={{
                  display: 'block',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.65)',
                  marginBottom: 6,
                }}>
                  {tr.stagex.pdfSheetScene}
                </label>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18,
                }}>
                  {([
                    { key: 'current' as const, label: tr.stagex.pdfSheetSceneCurrent },
                    ...pdfSceneInfo.names.slice(0, pdfSceneInfo.count).map((n, i) => ({ key: i, label: n })),
                    { key: 'all' as const, label: tr.stagex.pdfSheetSceneAll },
                  ]).map(({ key, label }) => {
                    const active = pdfSceneChoice === key;
                    return (
                      <button
                        key={String(key)}
                        onClick={() => setPdfSceneChoice(key)}
                        disabled={pdfBusy}
                        style={{
                          padding: '7px 12px',
                          background: active
                            ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                            : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'),
                          color: active ? '#fff' : (isLight ? '#111' : 'rgba(220,222,232,0.85)'),
                          border: `1px solid ${active ? 'transparent' : (isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)')}`,
                          borderRadius: 8,
                          fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          cursor: pdfBusy ? 'wait' : 'pointer',
                          transition: 'background 150ms, color 150ms, border-color 150ms',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatedActionButton
                onClick={() => runPdfExport('save')}
                disabled={pdfBusy || !pdfFileName.trim()}
                borderRadius={12}
                trailColor={accent.to}
                wrapStyle={{ width: '100%' }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', height: 48,
                  background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  color: '#fff', border: 'none',
                  fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  cursor: pdfBusy ? 'wait' : 'pointer',
                  opacity: pdfBusy || !pdfFileName.trim() ? 0.55 : 1,
                  boxShadow: `0 4px 18px ${accent.from}44`,
                  transition: 'opacity 150ms',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, lineHeight: 1 }}>download</span>
                {tr.stagex.pdfSheetSave}
              </AnimatedActionButton>

              {canShareFiles && (
                <button
                  onClick={() => runPdfExport('share')}
                  disabled={pdfBusy || !pdfFileName.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', height: 48,
                    background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                    color: isLight ? '#111' : '#fff',
                    border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
                    borderRadius: 12,
                    fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    cursor: pdfBusy ? 'wait' : 'pointer',
                    opacity: pdfBusy || !pdfFileName.trim() ? 0.55 : 1,
                    transition: 'opacity 150ms',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, lineHeight: 1 }}>ios_share</span>
                  {tr.stagex.pdfSheetShare}
                </button>
              )}

              <button
                onClick={() => setPdfSheetOpen(false)}
                disabled={pdfBusy}
                style={{
                  width: '100%', height: 44,
                  background: 'transparent',
                  color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.7)',
                  border: 'none',
                  fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  cursor: 'pointer',
                  opacity: pdfBusy ? 0.4 : 1,
                }}
              >
                {tr.stagex.pdfSheetCancel}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes pdfSheetFade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes pdfSheetSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
            .stage-nav-btn {
              transition: color 130ms ease, transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .stage-nav-btn:active {
              transform: scale(0.91);
            }
          `}</style>
        </>
      )}
        </div>
      </div>
    </div>
  );
}
