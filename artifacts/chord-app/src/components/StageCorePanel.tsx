import { useRef, useEffect, useCallback, useState } from 'react';
import { motion } from 'motion/react';
import AnimatedActionButton from './animata/container/animated-border-trail';
import { AppModeMenuLogo } from './AppModeMenuLogo';
import WebAppSectionDock from './WebAppSectionDock';
import { setBackHandler, useBackHandler } from '../lib/backStack';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import translations from '../lib/i18n';
import { useT } from '../lib/useT';
import { useLiquidGlassNav } from '../lib/useLiquidGlassNav';
import { useNavCollapsed, setNavCollapsed } from '../lib/navScroll';
import SmartLoading from './SmartLoading';
import { StagexPanelSkeleton } from './StudioSkeleton';
import { useIsWebDesktop } from '../hooks/useIsWebDesktop';
import { WebToolbar, WebButton } from './WebDesignSystem';
import { Capacitor } from '@capacitor/core';

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

  useEffect(() => {
    if (expandedCats.custom) {
      loadCustomElements();
    }
  }, [expandedCats.custom, loadCustomElements]);

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

  useEffect(() => {
    useChordStore.getState().setLastSession({ stagexView: curView });
  }, [curView]);

  /* ── Glassmorphism bottom nav state ─────────────────────── */
  const stageNavRef    = useRef<HTMLDivElement | null>(null);
  useLiquidGlassNav(stageNavRef as React.RefObject<HTMLElement | null>);
  const stageBtnRefs   = useRef<(HTMLButtonElement | null)[]>([]);
  const prevTabRef     = useRef(0);
  const stageStretchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stagePill, setStagePill] = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const [pressedTab, setPressedTab] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const navCollapsed = useNavCollapsed();
  const [expandedStageH, setExpandedStageH] = useState(52);
  const [expandedStageW, setExpandedStageW] = useState(380);
  const [landscapeNavHidden, setLandscapeNavHidden] = useState(false);
  const [propPanelOpen, setPropPanelOpen] = useState(false);
  const [pdfSheetOpen, setPdfSheetOpen] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  // Scenes feature (v3.0.63+) — picker for which stage plot(s) to include
  const [pdfSceneInfo, setPdfSceneInfo] = useState<{ count: number; currentIdx: number; names: string[] }>({ count: 1, currentIdx: 0, names: ['Scene 1'] });
  const [pdfSceneChoice, setPdfSceneChoice] = useState<'current' | 'all' | number>('current');

  useEffect(() => {
    // Always show the share button when navigator.share exists. Android WebView
    // often returns false from canShare({files}) even when share() actually
    // works; the iframe-side export will attempt the share and fall back to
    // saving the PDF if the share is unsupported or fails.
    setCanShareFiles(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const openPdfSheet = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      const name = doc?.getElementById('exp-project-name')?.textContent?.trim() || 'Stagex_Export';
      setPdfFileName(name);
    } catch {
      setPdfFileName('Stagex_Export');
    }
    // Read scene info from iframe so the picker reflects the project state
    try {
      const win = iframeRef.current?.contentWindow as (Window & { __getSceneInfo?: () => { count: number; currentIdx: number; names: string[] } }) | null;
      const info = win?.__getSceneInfo?.();
      if (info && typeof info.count === 'number' && info.count > 0) {
        setPdfSceneInfo({ count: info.count, currentIdx: info.currentIdx ?? 0, names: info.names || [] });
      } else {
        setPdfSceneInfo({ count: 1, currentIdx: 0, names: ['Scene 1'] });
      }
    } catch {
      setPdfSceneInfo({ count: 1, currentIdx: 0, names: ['Scene 1'] });
    }
    setPdfSceneChoice('current');
    setPdfBusy(false);
    setPdfSheetOpen(true);
  }, []);

  const runPdfExport = useCallback(async (action: 'save' | 'share') => {
    const win = iframeRef.current?.contentWindow as (Window & { exportPDFWithOptions?: (o: { name: string; action: string; scene?: 'current' | 'all' | number }) => Promise<void> }) | null;
    if (!win?.exportPDFWithOptions) return;
    setPdfBusy(true);
    try {
      await win.exportPDFWithOptions({
        name: pdfFileName.trim() || 'Stagex_Export',
        action,
        scene: pdfSceneChoice,
      });
    } finally {
      setPdfBusy(false);
      setPdfSheetOpen(false);
    }
  }, [pdfFileName, pdfSceneChoice]);

  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: landscape) and (max-width: 960px)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape) and (max-width: 960px)');
    const handler = (e: MediaQueryListEvent) => {
      setIsLandscape(e.matches);
      if (!e.matches) setLandscapeNavHidden(false);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

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

  const baseOrigin = (typeof window !== 'undefined' && Capacitor.isNativePlatform()) ? 'https://localhost' : '';
  const iframeSrc = useRef(
    `${baseOrigin}/stage-core/index.html#${isLight ? 'light' : 'dark'},${encodeURIComponent(accent.from)},${encodeURIComponent(accent.to)},${isAmoled ? '1' : '0'}`
  ).current;
  const stageBg   = isAmoled ? (isLight ? '#ffffff' : '#000000') : isLight ? '#f2f1ef' : '#0e0e0e';
  const stageHdr  = isAmoled ? (isLight ? '#ffffff' : '#000000') : isLight ? '#f2f1ef' : '#0e0e0e';

  const showBack = curView === 'Rider' || curView === 'Setlist' || curView === 'Gear' || curView === 'Members' || curView === 'Export';

  const lastCallTime = useRef(0);
  // Functions that are idempotent navigation actions and should never be
  // throttled — spam-tapping Stage/Setup/Preferences must always feel instant.
  const NO_THROTTLE_FNS = new Set(['switchView', 'stageGoBack']);
  const callIframe = useCallback((fn: string, arg?: string) => {
    if (!NO_THROTTLE_FNS.has(fn)) {
      const now = Date.now();
      if (now - lastCallTime.current < 200) return;
      lastCallTime.current = now;
    }
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const win = iframe.contentWindow as Record<string, unknown> | null;
      const f = win?.[fn];
      if (typeof f === 'function') {
        arg !== undefined ? (f as (a: string) => void)(arg) : (f as () => void)();
        return;
      }
    } catch {}
    try {
      iframe.contentWindow?.postMessage({ type: 'sc-call', fn, arg }, window.location.origin);
    } catch {}
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      setIframeLoading(false);
      iframeReady.current = true;
      try { iframe.contentWindow?.postMessage('stage-core-ping', window.location.origin); } catch {}
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
                if(y<30){window.parent.postMessage({type:'sc-scroll-dir',down:false},window.location.origin);ly=y;return;}
                var dy=y-ly;
                if(Math.abs(dy)<6)return;
                window.parent.postMessage({type:'sc-scroll-dir',down:dy>0},window.location.origin);
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

      // Prefer the last-visited view from the session over the user's
      // pinned default — but only when session restore is enabled. If
      // disabled (or neither is set), use the pinned default; the iframe
      // loads its native default ('Editor') if both are unset.
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
    return () => iframe.removeEventListener('load', handleLoad);
  }, [accent.from, accent.to, stageVis.theme, isAmoled, isWebDesktop]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'sc-dial-state') setFabOpen(!!e.data.open);
      if (e.data?.type === 'sc-scroll-dir') setNavCollapsed(!!e.data.down);
      if (e.data?.type === 'sc-prop-state') setPropPanelOpen(e.data.state === 'open' || e.data.state === 'peek');
      if (e.data?.type === 'sc-live-mode') setLiveMode(!!e.data.on);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Register this iframe with the cloud sync engine so it can request
  // snapshots and push restores through postMessage.
  useEffect(() => {
    let cancelled = false;
    void import('../lib/sync').then(({ registerStageIframe }) => {
      if (cancelled) return;
      registerStageIframe(iframeRef.current);
    });
    return () => {
      cancelled = true;
      void import('../lib/sync').then(({ registerStageIframe }) => registerStageIframe(null));
    };
  }, []);

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
      iframe.contentWindow?.postMessage({ type: 'sc-landscape', landscape: isLandscape }, window.location.origin);
    } catch {}
  }, [isLandscape]);

  useBackHandler('sheet', () => {
    if (pdfSheetOpen) {
      setPdfSheetOpen(false);
      return true;
    }
    return false;
  }, [pdfSheetOpen]);

  useEffect(() => {
    const handler = (): boolean => {
      try { return (iframeRef.current?.contentWindow as StageWin)?.stageGoBack?.() ?? false; }
      catch { return false; }
    };
    setBackHandler(handler);
    return () => setBackHandler(null);
  }, []);

  const hasWebHeader = !isWebDesktop || (curView === 'Editor' || curView === 'Export' || showBack);
  const collapseHeader = (isLandscape && curView === 'Editor') || liveMode || !hasWebHeader;
  const hideBottomNav  = curView === 'Export';
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
                  <SmartLoading fallbackSkeleton={<StagexPanelSkeleton />} />
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

      <div style={{ position: 'relative', flex: 1 }}>
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Stagex"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', display: 'block', backgroundColor: stageBg }}
          allow="clipboard-write"
        />

        {iframeLoading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: stageBg }}>
            <SmartLoading fallbackSkeleton={<StagexPanelSkeleton />} />
          </div>
        )}

        {/* ── Live-mode toggle (eye) — stacked 8px above the FAB ── */}
        {curView === 'Editor' && (
          <button
            onClick={() => callIframe('toggleGigMode')}
            onTouchEnd={(e) => { e.preventDefault(); callIframe('toggleGigMode'); }}
            aria-label={liveMode ? tr.stagex.exitLiveMode : tr.stagex.enterLiveMode}
            style={{
              position: 'absolute',
              bottom: (isLandscapeEditor ? 14 : 90) + 50 + 8,
              right: 17,
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
            onClick={handleFabTap}
            onTouchEnd={(e) => { e.preventDefault(); handleFabTap(); }}
            aria-label={tr.stagex.addInstrument}
            style={{
              position: 'absolute',
              bottom: isLandscapeEditor ? 14 : 90,
              right: 14,
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

        {isLandscapeEditor && landscapeNavHidden && (
          <button
            onClick={() => setLandscapeNavHidden(false)}
            aria-label={tr.stagex.showNav}
            title={tr.stagex.showNav}
            style={{
              position: 'absolute',
              bottom: 'max(4px, env(safe-area-inset-bottom))',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 48,
              height: 26,
              borderRadius: '12px 12px 0 0',
              background: stagePillBg,
              border: isLight ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.10)',
              borderBottom: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              zIndex: 10,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(160,160,180,0.8)', lineHeight: 1 }}>expand_less</span>
          </button>
        )}

        {isLandscapeEditor && !landscapeNavHidden && !isWebDesktop && (
          <button
            onClick={() => setLandscapeNavHidden(true)}
            aria-label={tr.stagex.hideNav}
            title={tr.stagex.hideNav}
            style={{
              position: 'absolute',
              bottom: `calc(max(10px, env(safe-area-inset-bottom)) + ${isLandscapeEditor ? 34 : 52}px)`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 48,
              height: 26,
              borderRadius: '12px 12px 0 0',
              background: stagePillBg,
              border: isLight ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.10)',
              borderBottom: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              zIndex: 11,
              transition: 'opacity 300ms ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(160,160,180,0.8)', lineHeight: 1 }}>expand_more</span>
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
              liveMode || hideBottomNav || (isLandscapeEditor && landscapeNavHidden) ? 'calc(100% + 32px)' : '0px'
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
            zIndex: 10,
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
          {navTabs.map(({ view, label, icon }, i) => {
            const active  = isTabActive(view);
            const pressed = pressedTab === view;
            return (
              <button
                key={view}
                ref={el => { stageBtnRefs.current[i] = el; }}
                onPointerDown={() => setPressedTab(view)}
                onPointerUp={() => { setPressedTab(null); handleNavTap(view); }}
                onPointerLeave={() => setPressedTab(null)}
                onPointerCancel={() => setPressedTab(null)}
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
                  transform: pressed ? 'scale(0.91)' : 'scale(1)',
                  transition: 'color 130ms ease, transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)',
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
          })}
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
          `}</style>
        </>
      )}
        </div>
      </div>
    </div>
  );
}
