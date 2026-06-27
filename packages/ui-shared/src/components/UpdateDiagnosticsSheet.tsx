import { useChordStore, ACCENT_COLORS, otaDiagnostics, otaDebugLogs, useBackHandler, isNative, APP_VERSION } from '@workspace/studio-core';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  onClose: () => void;
};

const SWIPE_DISMISS_PX = 110;
const SWIPE_DISMISS_VELOCITY = 0.55;

export interface DiagnosticEntry {
  category: 'Performance' | 'Updater' | 'Downloads' | 'Installation' | 'Version Manager' | 'Android' | 'Storage' | 'Network' | 'Firebase' | 'GitHub' | 'PackageInstaller';
  timestamp: string;
  severity: 'Info' | 'Warning' | 'Error';
  subsystem: string;
  summary: string;
  technicalExplanation: string;
  humanExplanation: string;
  suggestedSolution: string;
  stack?: string;
}

export function getStructuredDiagnostics(developerMode: boolean): DiagnosticEntry[] {
  const list: DiagnosticEntry[] = [];
  const nowStr = new Date().toISOString();

  // 1. PERFORMANCE CATEGORY
  const boot = (typeof window !== 'undefined' ? (window as any).__bootTimings : null) || { introStart: 0, hubVisible: 0 };
  const natBoot = (typeof window !== 'undefined' ? (window as any).__nativeBootTimings : null) || { processStart: 0, onCreate: 0, webViewInit: 0 };
  
  const toSec = (ms: number) => ms > 0 ? `${(ms / 1000).toFixed(2)}s` : 'N/A';

  // JS Initialization
  const jsInitMs = (natBoot.webViewInit && natBoot.onCreate) ? (natBoot.webViewInit - natBoot.onCreate) : 0;
  list.push({
    category: 'Performance',
    timestamp: nowStr,
    severity: 'Info',
    subsystem: 'JS Engine',
    summary: 'JavaScript engine initialization time',
    technicalExplanation: `JS bundle load & execution: ${jsInitMs}ms.`,
    humanExplanation: 'The time taken for the app\'s JavaScript code to load and run.',
    suggestedSolution: 'Keep JS bundle sizes small and avoid heavy startup execution.'
  });

  // Native Initialization
  const nativeInitMs = (natBoot.onCreate && natBoot.processStart) ? (natBoot.onCreate - natBoot.processStart) : 0;
  list.push({
    category: 'Performance',
    timestamp: nowStr,
    severity: 'Info',
    subsystem: 'Android Native',
    summary: 'Native application bootstrap time',
    technicalExplanation: `Process launch to onCreate: ${nativeInitMs}ms.`,
    humanExplanation: 'The time taken by the Android operating system to initialize the app process.',
    suggestedSolution: 'Optimize native application onCreate and plugin registration.'
  });

  // First Frame
  list.push({
    category: 'Performance',
    timestamp: nowStr,
    severity: 'Info',
    subsystem: 'Renderer',
    summary: 'Time to first frame (planets intro)',
    technicalExplanation: `First paint frame timing: ${toSec(boot.introStart)}.`,
    humanExplanation: 'How quickly the application renders its first visual pixel (the planets intro).',
    suggestedSolution: 'Keep CSS and HTML footprint minimal before first mount.'
  });

  // First Interaction / Hub Visible
  list.push({
    category: 'Performance',
    timestamp: nowStr,
    severity: 'Info',
    subsystem: 'Application Hub',
    summary: 'Time to first interaction (Hub visible)',
    technicalExplanation: `Hub visibility latency: ${toSec(boot.hubVisible)}.`,
    humanExplanation: 'The total time from launch until the user can interact with the app Hub.',
    suggestedSolution: 'Settle animations smoothly and defer non-critical assets.'
  });

  // Heavy profiling (only if Developer Mode is enabled)
  if (developerMode) {
    // Memory
    let memText = 'N/A';
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      memText = `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB / ${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB`;
    }
    list.push({
      category: 'Performance',
      timestamp: nowStr,
      severity: 'Info',
      subsystem: 'Memory Profile',
      summary: 'Heap memory usage profiling',
      technicalExplanation: `JS Heap: ${memText}.`,
      humanExplanation: 'Current memory footprint used by the app\'s Javascript runtime.',
      suggestedSolution: 'Perform garbage collection checks and profiling if leaks occur.'
    });

    // Dropped frames / Freezes
    const freezes = (typeof window !== 'undefined' ? (window as any).__startupAnimationFreezes : null) || [];
    const frozenCount = freezes.length;
    list.push({
      category: 'Performance',
      timestamp: nowStr,
      severity: frozenCount > 0 ? 'Warning' : 'Info',
      subsystem: 'Frame Scheduler',
      summary: 'Startup animation dropped frames detection',
      technicalExplanation: `Detected ${frozenCount} frame lag points (>50ms). Details: ${JSON.stringify(freezes)}`,
      humanExplanation: 'Number of frames skipped during the planets animation.',
      suggestedSolution: 'Ensure main thread is not blocked by heavy React mounting tasks.',
      stack: Error().stack
    });
  }

  // 2. UPDATER CATEGORY
  list.push({
    category: 'Updater',
    timestamp: otaDiagnostics.timestamp || nowStr,
    severity: otaDiagnostics.exceptionMessage ? 'Error' : 'Info',
    subsystem: 'Update Manager',
    summary: 'Update engine status',
    technicalExplanation: `Current state: ${otaDebugLogs.updateDecisionReason || 'idle'}.`,
    humanExplanation: 'The status of the background update checker engine.',
    suggestedSolution: 'Verify internet connection and server status if updates fail.'
  });

  // 3. DOWNLOADS CATEGORY
  list.push({
    category: 'Downloads',
    timestamp: nowStr,
    severity: 'Info',
    subsystem: 'Network Fetcher',
    summary: 'APK size and path configuration',
    technicalExplanation: `File size: ${otaDiagnostics.fileSize || 'N/A'}. Path: ${otaDiagnostics.apkPath || 'N/A'}.`,
    humanExplanation: 'Information about the downloaded installation package details.',
    suggestedSolution: 'Ensure local storage has enough space to hold the package.'
  });

  // 4. INSTALLATION CATEGORY
  list.push({
    category: 'Installation',
    timestamp: nowStr,
    severity: otaDebugLogs.eligibilityReason ? 'Error' : 'Info',
    subsystem: 'Verify Manager',
    summary: 'Signature and packageName verification status',
    technicalExplanation: `Package: ${otaDebugLogs.downloadedPackageName || 'N/A'}. Signature Match: ${otaDebugLogs.eligibilitySigningMatch !== null ? otaDebugLogs.eligibilitySigningMatch : 'N/A'}.`,
    humanExplanation: 'Results of the pre-installation security checks.',
    suggestedSolution: 'Uninstall any conflicting builds if signature mismatches are reported.'
  });

  // 5. VERSION MANAGER CATEGORY
  list.push({
    category: 'Version Manager',
    timestamp: nowStr,
    severity: 'Info',
    subsystem: 'Version Comparer',
    summary: 'Version comparison check',
    technicalExplanation: `Installed: ${APP_VERSION} (code ${otaDebugLogs.installedVersionCode || '131'}). Target: ${otaDebugLogs.remoteVersionCode || 'N/A'}.`,
    humanExplanation: 'How the installed version compares to the target version.',
    suggestedSolution: 'Ensure the versionCode is newer for successful installation.'
  });

  // 6. ANDROID CATEGORY
  list.push({
    category: 'Android',
    timestamp: nowStr,
    severity: 'Info',
    subsystem: 'Device OS',
    summary: 'Android system details',
    technicalExplanation: `Model: ${otaDiagnostics.deviceModel || 'N/A'}. OS Version: Android ${otaDiagnostics.androidVersion || 'N/A'}.`,
    humanExplanation: 'Basic hardware and operating system details reported by the device.',
    suggestedSolution: 'Check for any Android system updates.'
  });

  // 7. STORAGE CATEGORY
  list.push({
    category: 'Storage',
    timestamp: nowStr,
    severity: 'Info',
    subsystem: 'Filesystem',
    summary: 'Device storage space details',
    technicalExplanation: `Available: ${otaDiagnostics.storageAvailable || 'N/A'}.`,
    humanExplanation: 'Remaining disk space available for downloading and installing updates.',
    suggestedSolution: 'Free up storage if space falls below 150MB.'
  });

  // 8. NETWORK CATEGORY
  list.push({
    category: 'Network',
    timestamp: nowStr,
    severity: otaDiagnostics.networkState === 'disconnected' ? 'Warning' : 'Info',
    subsystem: 'Connectivity',
    summary: 'Device network state details',
    technicalExplanation: `State: ${otaDiagnostics.networkState || 'N/A'}.`,
    humanExplanation: 'Status of the device\'s internet connection.',
    suggestedSolution: 'Connect to Wi-Fi or enable cellular data.'
  });

  // 9. FIREBASE CATEGORY
  list.push({
    category: 'Firebase',
    timestamp: nowStr,
    severity: otaDebugLogs.fetchedAppReleaseJson ? 'Info' : 'Warning',
    subsystem: 'Hosting Metadata',
    summary: 'Firebase release metadata fetch status',
    technicalExplanation: `version.json status: ${otaDebugLogs.fetchedVersionJson ? 'SUCCESS' : 'FAILED'}.`,
    humanExplanation: 'Connection state with the secondary update metadata server.',
    suggestedSolution: 'Verify Firebase hosting deployment is active.'
  });

  // 10. GITHUB CATEGORY
  list.push({
    category: 'GitHub',
    timestamp: nowStr,
    severity: 'Info',
    subsystem: 'Releases API',
    summary: 'GitHub releases source status',
    technicalExplanation: `Download URL: ${otaDiagnostics.downloadUrl || 'N/A'}.`,
    humanExplanation: 'Status of the primary release storage hosted on GitHub.',
    suggestedSolution: 'Check if the repository releases are public and accessible.'
  });

  // 11. PACKAGEINSTALLER CATEGORY
  list.push({
    category: 'PackageInstaller',
    timestamp: nowStr,
    severity: otaDiagnostics.statusCode && otaDiagnostics.statusCode > 1 ? 'Error' : 'Info',
    subsystem: 'Android PackageInstaller',
    summary: 'Android system installer response log',
    technicalExplanation: `Status: ${otaDiagnostics.statusCode || 'N/A'}. Detail: ${otaDiagnostics.installerResult || 'N/A'}.`,
    humanExplanation: 'The response returned by the Android system package installer.',
    suggestedSolution: 'Check settings permissions and clear conflicting packages.'
  });

  return list;
}

export default function UpdateDiagnosticsSheet({ open, onClose }: Props) {
  const { settings } = useChordStore();
  const accentKey = settings.perApp?.hub?.accentColor ?? settings.accentColor ?? 'blue';
  const accent = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartT = useRef<number>(0);
  const dragOffset = useRef<number>(0);

  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const [copied, setCopied] = useState(false);
  const [nativeLogs, setNativeLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedEntryIdx, setExpandedEntryIdx] = useState<number | null>(null);

  const categories = ['All', 'Performance', 'Updater', 'Downloads', 'Installation', 'Version Manager', 'Android', 'Storage', 'Network', 'Firebase', 'GitHub', 'PackageInstaller'];

  const diagnosticsList = getStructuredDiagnostics(settings.developerMode ?? false);

  const filteredEntries = diagnosticsList.filter(entry => {
    const matchesCategory = selectedCategory === 'All' || entry.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      entry.subsystem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.technicalExplanation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.humanExplanation.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setDrag(0);
      setCopied(false);
      return;
    }
    if (mounted) {
      setClosing(true);
      const id = window.setTimeout(() => {
        setMounted(false);
        setClosing(false);
        setDrag(0);
      }, 300);
      return () => window.clearTimeout(id);
    }
    return;
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  // Load native log history if in Developer Mode
  useEffect(() => {
    if (open && settings.developerMode) {
      void (async () => {
        try {
          const { AppInstaller } = await import('@workspace/studio-core');
          const result = await AppInstaller.getInstallerLogHistory();
          if (result && result.logs) {
            setNativeLogs(JSON.parse(result.logs));
          }
        } catch (e) {
          console.warn('[OTA] Failed to fetch native installer logs:', e);
        }
      })();
    }
  }, [open, settings.developerMode]);

  useBackHandler('sheet', () => {
    if (open) {
      onClose();
      return true;
    }
    return false;
  }, [open, onClose]);

  if (!mounted) return null;

  const beginDrag = (clientY: number) => {
    if (scrollRef.current && scrollRef.current.scrollTop > 0) return;
    dragStartY.current = clientY;
    dragStartT.current = performance.now();
    dragOffset.current = 0;
  };

  const moveDrag = (clientY: number) => {
    if (dragStartY.current === null) return;
    const delta = Math.max(0, clientY - dragStartY.current);
    dragOffset.current = delta;
    setDrag(delta);
  };

  const endDrag = () => {
    if (dragStartY.current === null) return;
    const dt = Math.max(1, performance.now() - dragStartT.current);
    const v = dragOffset.current / dt;
    dragStartY.current = null;
    if (dragOffset.current > SWIPE_DISMISS_PX || v > SWIPE_DISMISS_VELOCITY) {
      onClose();
    } else {
      setDrag(0);
    }
  };

  const getDiagnosticsText = () => {
    return [
      '=== STUDIO UPDATE DIAGNOSTICS ===',
      `Failure Timestamp: ${otaDiagnostics.timestamp || 'N/A'}`,
      `Device Model/Manufacturer: ${otaDiagnostics.deviceModel || 'N/A'}`,
      `Android Version: ${otaDiagnostics.androidVersion || 'N/A'}`,
      `Architecture: ${otaDiagnostics.architecture || 'N/A'}`,
      `Device Locale: ${otaDiagnostics.deviceLocale || 'N/A'}`,
      `Storage Available: ${otaDiagnostics.storageAvailable || 'N/A'}`,
      `Network State: ${otaDiagnostics.networkState || 'N/A'}`,
      `Permission State: ${otaDiagnostics.permissionState || 'N/A'}`,
      `Exception Message: ${otaDiagnostics.exceptionMessage || 'N/A'}`,
      `Failure Reason & Stack Trace:`,
      otaDiagnostics.failureReason || 'N/A',
      `Download URL Used: ${otaDiagnostics.downloadUrl || 'N/A'}`,
      `APK Path: ${otaDiagnostics.apkPath || 'N/A'}`,
      `File Size: ${otaDiagnostics.fileSize || 'N/A'}`,
      `SHA-256 Expected: ${otaDiagnostics.shaExpected || 'N/A'}`,
      `SHA-256 Calculated: ${otaDiagnostics.shaCalculated || 'N/A'}`,
      `Installer Result: ${otaDiagnostics.installerResult || 'N/A'}`,
      '',
      '=== COMPREHENSIVE DEBUG LOGS ===',
      `App Version (APP_VERSION): ${otaDebugLogs.appVersion}`,
      `APK Version (Wrapper): ${otaDebugLogs.nativeApkVersion || 'N/A'}`,
      ...(otaDebugLogs.nativePlatformDetected && otaDebugLogs.nativeApkVersion && otaDebugLogs.nativeApkVersion !== 'N/A' && otaDebugLogs.appVersion !== otaDebugLogs.nativeApkVersion ? ['VERSION_MISMATCH_DETECTED'] : []),
      `Update System: APK only`,
      `OTA System: disabled`,
      `AppInstaller Available: ${otaDebugLogs.appInstallerAvailable}`,
      `downloadApk Available: ${otaDebugLogs.downloadApkAvailable}`,
      `verifyApkSha256 Available: ${otaDebugLogs.verifyApkSha256Available}`,
      `installApk Available: ${otaDebugLogs.installApkAvailable}`,
      `openInstallPermissionSettings Available: ${otaDebugLogs.openInstallPermissionSettingsAvailable}`,
      `Registered Capacitor Plugins: ${otaDebugLogs.registeredPlugins}`,
      `Plugin Method Check: ${otaDebugLogs.pluginMethodCheck}`,
      `Fetched version.json: ${otaDebugLogs.fetchedVersionJson || 'N/A'}`,
      `Fetched app-release.json: ${otaDebugLogs.fetchedAppReleaseJson || 'N/A'}`,
      `Update Type: ${otaDebugLogs.updateType || 'N/A'}`,
      `Update Decision: ${otaDebugLogs.updateDecision || 'N/A'}`,
      `Update Decision Reason: ${otaDebugLogs.updateDecisionReason || 'N/A'}`,
      `Remote versionCode: ${otaDebugLogs.remoteVersionCode !== null ? otaDebugLogs.remoteVersionCode : 'N/A'}`,
      `Version comparison result: ${otaDebugLogs.versionComparisonResult || 'N/A'}`,
      `Native platform detected: ${otaDebugLogs.nativePlatformDetected !== null ? otaDebugLogs.nativePlatformDetected : 'N/A'}`,
      `Platform detected: ${otaDebugLogs.platformDetected || 'N/A'}`,
      `APK metadata valid: ${otaDebugLogs.apkMetadataValid !== null ? otaDebugLogs.apkMetadataValid : 'N/A'}`,
      `APK URL present: ${otaDebugLogs.apkUrlPresent !== null ? otaDebugLogs.apkUrlPresent : 'N/A'}`,
      `APK SHA present: ${otaDebugLogs.apkShaPresent !== null ? otaDebugLogs.apkShaPresent : 'N/A'}`,
      `skipped/dismissed state: ${otaDebugLogs.skippedDismissedState || 'N/A'}`,
      `release channel: ${otaDebugLogs.releaseChannel || 'N/A'}`,
      `rollout eligibility: ${otaDebugLogs.rolloutEligibility || 'N/A'}`,
      `Download Status: ${otaDebugLogs.downloadStatus || 'N/A'}`,
      `SHA Verification Status: ${otaDebugLogs.shaVerification || 'N/A'}`,
      `File Details: ${otaDebugLogs.fileDetails || 'N/A'}`,
      `Install Error / Log: ${otaDebugLogs.installError || 'N/A'}`,
      `Installer Launch Status: ${otaDebugLogs.installerLaunchStatus || 'N/A'}`,
      `Last Exception Stack Trace:`,
      otaDebugLogs.lastExceptionStackTrace || 'N/A',
      '',
      '=== ELIGIBILITY DETAILS ===',
      `Installed package: ${otaDebugLogs.installedPackageName || 'N/A'}`,
      `Installed versionName: ${otaDebugLogs.installedVersionName || 'N/A'}`,
      `Installed versionCode: ${otaDebugLogs.installedVersionCode || 'N/A'}`,
      `Installed signing SHA-256: ${otaDebugLogs.installedSigningSha256 || 'N/A'}`,
      `Installed debuggable: ${otaDebugLogs.installedDebuggable !== null ? otaDebugLogs.installedDebuggable : 'N/A'}`,
      '',
      `Downloaded package: ${otaDebugLogs.downloadedPackageName || 'N/A'}`,
      `Downloaded versionName: ${otaDebugLogs.downloadedVersionName || 'N/A'}`,
      `Downloaded versionCode: ${otaDebugLogs.downloadedVersionCode || 'N/A'}`,
      `Downloaded signing SHA-256: ${otaDebugLogs.downloadedSigningSha256 || 'N/A'}`,
      `Downloaded debuggable: ${otaDebugLogs.downloadedDebuggable !== null ? otaDebugLogs.downloadedDebuggable : 'N/A'}`,
      `Downloaded isValidApk: ${otaDebugLogs.downloadedIsValidApk !== null ? otaDebugLogs.downloadedIsValidApk : 'N/A'}`,
      `Downloaded isUniversalApk: ${otaDebugLogs.downloadedIsUniversalApk !== null ? otaDebugLogs.downloadedIsUniversalApk : 'N/A'}`,
      `Downloaded size: ${otaDebugLogs.downloadedApkSize || 'N/A'}`,
      '',
      `Eligibility package match: ${otaDebugLogs.eligibilityPackageNameMatch !== null ? otaDebugLogs.eligibilityPackageNameMatch : 'N/A'}`,
      `Eligibility signing match: ${otaDebugLogs.eligibilitySigningMatch !== null ? otaDebugLogs.eligibilitySigningMatch : 'N/A'}`,
      `Eligibility versionCode higher: ${otaDebugLogs.eligibilityVersionCodeHigher !== null ? otaDebugLogs.eligibilityVersionCodeHigher : 'N/A'}`,
      `Eligibility release build: ${otaDebugLogs.eligibilityReleaseBuild !== null ? otaDebugLogs.eligibilityReleaseBuild : 'N/A'}`,
      `Eligibility valid APK: ${otaDebugLogs.eligibilityValidApk !== null ? otaDebugLogs.eligibilityValidApk : 'N/A'}`,
      `Eligibility final install: ${otaDebugLogs.eligibilityFinalInstall || 'N/A'}`,
      `Eligibility reason: ${otaDebugLogs.eligibilityReason || 'N/A'}`,
      '',
      `=== HISTORICAL CALLBACK LOGS ===`,
      JSON.stringify(nativeLogs, null, 2)
    ].join('\n');
  };

  const handleCopyLogs = () => {
    const text = getDiagnosticsText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShareLogs = async () => {
    const text = getDiagnosticsText();
    try {
      if (isNative()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: 'Studio Update Diagnostics',
          text: text,
          dialogTitle: 'Share Update Diagnostics'
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'Studio Update Diagnostics',
          text: text
        });
      } else {
        handleCopyLogs();
        alert('Sharing not supported on this device. Diagnostics copied to clipboard!');
      }
    } catch (err) {
      console.error('Failed to share diagnostics:', err);
    }
  };

  const handleExportLogs = () => {
    const text = getDiagnosticsText();
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `studio-update-diagnostics-${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      alert('Diagnostics exported to downloads directory!');
    } catch (err) {
      console.error('Failed to export diagnostics:', err);
    }
  };

  const handleRetryUpdate = async () => {
    onClose();
    try {
      const { downloadUpdate } = await import('@workspace/studio-core');
      await downloadUpdate('Diagnostics Retry');
    } catch (err) {
      console.error('[OTA] Retry failed:', err);
    }
  };

  const handleClearHistoryLogs = async () => {
    if (window.confirm('Clear all local native PackageInstaller logs?')) {
      try {
        const { AppInstaller } = await import('@workspace/studio-core');
        await AppInstaller.clearInstallerLogHistory();
        setNativeLogs([]);
        alert('Logs cleared!');
      } catch (err) {
        console.error('Failed to clear logs:', err);
      }
    }
  };

  const getExplanation = () => {
    const code = otaDiagnostics.statusCode;
    const text = otaDiagnostics.statusText || '';
    const failureReason = otaDiagnostics.failureReason || '';
    const exceptionMessage = otaDiagnostics.exceptionMessage || '';

    if (code === 5 || failureReason.includes('signature_mismatch') || text.includes('Signature mismatch') || otaDebugLogs.eligibilityReason === 'signature_mismatch') {
      return {
        title: 'Signing Signature Mismatch',
        desc: 'The downloaded update package was signed with a different certificate key than the installed app. To safeguard your data, Android blocks updating in-place. You must manually back up your data, uninstall Studio, and install the new APK.',
        color: '#f87171',
        bg: 'rgba(248, 113, 113, 0.08)',
        border: 'rgba(248, 113, 113, 0.25)',
        icon: 'security_update_warning'
      };
    }
    if (code === 7 || text.includes('versionCode_low') || failureReason.includes('versionCode_low') || otaDebugLogs.eligibilityReason === 'versionCode_low') {
      return {
        title: 'Version Downgrade Blocked',
        desc: 'Android does not support installing an older version over a newer one. If you want to downgrade, you must first uninstall the current version of the application.',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.08)',
        border: 'rgba(251, 191, 36, 0.25)',
        icon: 'published_with_changes'
      };
    }
    if (code === 3 || text.includes('cancelled') || text.includes('canceled')) {
      return {
        title: 'Installation Cancelled',
        desc: 'The update installation was cancelled by the user. You can retry the update whenever you are ready.',
        color: '#60a5fa',
        bg: 'rgba(96, 165, 250, 0.08)',
        border: 'rgba(96, 165, 250, 0.25)',
        icon: 'cancel'
      };
    }
    if (code === 6 || text.includes('storage') || failureReason.includes('storage')) {
      return {
        title: 'Out of Storage Space',
        desc: 'The installation failed due to insufficient storage space. Please clean up files on your device and try again.',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.08)',
        border: 'rgba(251, 191, 36, 0.25)',
        icon: 'disc_full'
      };
    }
    if (text.includes('corrupted') || text.includes('hash') || failureReason.includes('hash')) {
      return {
        title: 'Corrupted Package File',
        desc: 'The downloaded update package failed security checksum verification. It might have been corrupted during transmission. Retrying should fix this.',
        color: '#f87171',
        bg: 'rgba(248, 113, 113, 0.08)',
        border: 'rgba(248, 113, 113, 0.25)',
        icon: 'running_with_errors'
      };
    }
    return {
      title: 'Update Installation Failed',
      desc: exceptionMessage || 'An unexpected Android system error occurred during package installation.',
      color: '#f87171',
      bg: 'rgba(248, 113, 113, 0.08)',
      border: 'rgba(248, 113, 113, 0.25)',
      icon: 'error'
    };
  };

  const getValidationPhases = () => {
    const code = otaDiagnostics.statusCode;
    const failureReason = otaDiagnostics.failureReason || '';
    const text = otaDiagnostics.statusText || '';
    const eligibilityReason = otaDebugLogs.eligibilityReason || '';
    const shaExpected = otaDiagnostics.shaExpected || '';
    const shaCalculated = otaDiagnostics.shaCalculated || '';
    const downloadedPackage = otaDebugLogs.downloadedPackageName || '';
    const downloadedSigning = otaDebugLogs.downloadedSigningSha256 || '';

    // 1. Release Validation
    let releaseStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    let releaseReason = 'Release version and structure are correct.';
    if (eligibilityReason === 'versionCode_low' || code === 7) {
      releaseStatus = 'FAIL';
      releaseReason = 'Version downgrade is blocked.';
    } else if (otaDebugLogs.nativeApkVersion && otaDebugLogs.appVersion !== otaDebugLogs.nativeApkVersion) {
      releaseStatus = 'WARNING';
      releaseReason = 'Wrapper/App version mismatch detected.';
    }

    // 2. Certificate Validation
    let certStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    let certReason = 'Certificate matches expected production signature.';
    const prodCert = '900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206';
    if (downloadedSigning && downloadedSigning !== prodCert) {
      certStatus = 'FAIL';
      certReason = 'Downloaded certificate signature mismatch.';
    } else if (eligibilityReason === 'signature_mismatch' || code === 5) {
      certStatus = 'FAIL';
      certReason = 'Signature mismatch with current installation.';
    }

    // 3. APK Validation
    let apkStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    let apkReason = 'APK package structure is valid.';
    if (otaDebugLogs.downloadedIsValidApk === false || otaDebugLogs.eligibilityValidApk === false) {
      apkStatus = 'FAIL';
      apkReason = 'Downloaded file is not a valid Android APK.';
    } else if (otaDebugLogs.downloadedDebuggable === true) {
      apkStatus = 'WARNING';
      apkReason = 'Downloaded APK is debuggable.';
    }

    // 4. SHA Validation
    let shaStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    let shaReason = 'SHA-256 hash matches metadata.';
    if (shaExpected && shaCalculated && shaExpected !== shaCalculated) {
      shaStatus = 'FAIL';
      shaReason = 'APK checksum validation failed (corrupted download).';
    } else if (otaDebugLogs.shaVerification === 'failed') {
      shaStatus = 'FAIL';
      shaReason = 'SHA-256 verification failed.';
    }

    // 5. Package Validation
    let pkgStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    let pkgReason = 'Package name matches com.chordex.app.';
    if (downloadedPackage && downloadedPackage !== 'com.chordex.app') {
      pkgStatus = 'FAIL';
      pkgReason = `Wrong package: ${downloadedPackage}`;
    }

    // 6. Firebase Validation
    let fbStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    let fbReason = 'Firebase metadata checks passed.';
    if (!otaDebugLogs.fetchedAppReleaseJson) {
      fbStatus = 'WARNING';
      fbReason = 'Could not fetch app-release.json.';
    }

    // 7. GitHub Validation
    let ghStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    let ghReason = 'GitHub Release asset is reachable.';
    if (otaDiagnostics.downloadUrl && !otaDiagnostics.downloadUrl.includes('github.com')) {
      ghStatus = 'WARNING';
      ghReason = 'Non-GitHub download path detected.';
    }

    // 8. PackageInstaller Validation
    let piStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    let piReason = 'PackageInstaller completed successfully.';
    if (typeof code === 'number' && code > 1 && code !== 3) {
      piStatus = 'FAIL';
      piReason = `Installer failed with code ${code}: ${text}`;
    } else if (code === 3) {
      piStatus = 'WARNING';
      piReason = 'Installation cancelled by user.';
    }

    return [
      { name: 'Release Validation', status: releaseStatus, desc: releaseReason },
      { name: 'Certificate Validation', status: certStatus, desc: certReason },
      { name: 'APK Validation', status: apkStatus, desc: apkReason },
      { name: 'SHA Validation', status: shaStatus, desc: shaReason },
      { name: 'Package Validation', status: pkgStatus, desc: pkgReason },
      { name: 'Firebase Validation', status: fbStatus, desc: fbReason },
      { name: 'GitHub Validation', status: ghStatus, desc: ghReason },
      { name: 'PackageInstaller Validation', status: piStatus, desc: piReason },
    ];
  };

  const exp = getExplanation();

  const overlayOpacity = closing ? 0 : Math.max(0, 1 - drag / 380);

  const sheetTransform = closing
    ? 'translateY(100%)'
    : drag > 0
      ? `translateY(${drag}px)`
      : 'translateY(0)';

  const sheetTransition = drag > 0
    ? 'none'
    : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)';

  const DiagnosticField = ({ label, value, isCode }: { label: string; value: string | null; isCode?: boolean }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block',
        fontFamily: 'Manrope',
        fontWeight: 700,
        fontSize: 10.5,
        color: 'var(--c-text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 3
      }}>{label}</label>
      <div style={{
        fontFamily: isCode ? 'monospace' : 'Inter',
        fontSize: isCode ? 10.5 : 13,
        lineHeight: 1.4,
        color: 'var(--c-text-primary)',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        background: isCode ? 'rgba(128,128,128,0.06)' : 'transparent',
        padding: isCode ? '8px 12px' : 0,
        borderRadius: isCode ? 6 : 0,
        maxHeight: isCode ? 160 : 'none',
        overflowY: isCode ? 'auto' : 'visible'
      }}>
        {value || 'N/A'}
      </div>
    </div>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Update Diagnostics"
      style={{
        position: 'fixed', inset: 0, zIndex: 9800,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          opacity: overlayOpacity,
          transition: 'opacity 280ms ease',
        }}
      />

      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => beginDrag(e.touches[0].clientY)}
        onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
        onMouseDown={(e) => { if (e.button === 0) beginDrag(e.clientY); }}
        onMouseMove={(e) => { if (dragStartY.current !== null) moveDrag(e.clientY); }}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          maxHeight: '86vh',
          background: 'var(--app-surface)',
          borderRadius: '22px 22px 0 0',
          boxShadow: '0 -16px 48px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: sheetTransform,
          transition: sheetTransition,
          animation: closing
            ? undefined
            : drag > 0 ? undefined : 'diag-sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          touchAction: 'pan-y',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 6px', flexShrink: 0 }}>
          <div style={{
            width: 36, height: 3.5, borderRadius: 999,
            background: 'rgba(160,160,160,0.35)',
          }} />
        </div>

        <div style={{
          padding: '10px 22px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontFamily: 'Manrope', fontWeight: 800, fontSize: 20,
              letterSpacing: '-0.02em',
              color: 'var(--c-text-primary)',
            }}>
              Update Diagnostics
            </span>
            <span style={{
              fontFamily: 'Inter', fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 999,
              background: 'rgba(248,113,113,0.15)',
              color: '#f87171',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              Failure Log
            </span>
          </div>
          
          <button
            onClick={handleCopyLogs}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: copied ? '#22c55e' : `${accent.from}22`,
              color: copied ? 'white' : accent.from,
              border: 'none',
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'background 200ms ease, color 200ms ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? 'Copied!' : 'Copy Logs'}
          </button>
        </div>

        <div style={{
          height: 1,
          background: 'rgba(128,128,128,0.16)',
          flexShrink: 0,
        }} />

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Human Readable Explanation Card */}
          <div style={{
            background: exp.bg,
            border: `1px solid ${exp.border}`,
            borderRadius: 14,
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start'
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 24,
              color: exp.color,
              marginTop: 2
            }}>
              {exp.icon}
            </span>
            <div style={{ flex: 1 }}>
              <h3 style={{
                margin: 0,
                fontFamily: 'Manrope',
                fontWeight: 800,
                fontSize: 15,
                color: exp.color,
                marginBottom: 6
              }}>
                {exp.title}
              </h3>
              <p style={{
                margin: 0,
                fontFamily: 'Inter',
                fontSize: 12.5,
                lineHeight: 1.45,
                color: 'var(--c-text-secondary)'
              }}>
                {exp.desc}
              </p>
            </div>
          </div>

          {otaDebugLogs.nativePlatformDetected && otaDebugLogs.nativeApkVersion && otaDebugLogs.nativeApkVersion !== 'N/A' && otaDebugLogs.appVersion !== otaDebugLogs.nativeApkVersion && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#ef4444',
              fontWeight: 800,
              fontSize: 13,
              fontFamily: 'Manrope',
              textAlign: 'center',
              marginBottom: 16,
              letterSpacing: '0.04em'
            }}>
              VERSION_MISMATCH_DETECTED
            </div>
          )}

          {/* Search and Category Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(128,128,128,0.06)',
              border: '1px solid rgba(128,128,128,0.12)',
              borderRadius: 10,
              padding: '6px 12px',
              gap: 8
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-muted)' }}>search</span>
              <input
                type="text"
                placeholder="Search diagnostics..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--c-text-primary)',
                  fontSize: 13,
                  width: '100%',
                  fontFamily: 'inherit'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--c-text-muted)', cursor: 'pointer', display: 'flex' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              )}
            </div>

            {/* Horizontal scrollable categories */}
            <div className="no-scrollbar" style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 2,
              WebkitOverflowScrolling: 'touch'
            }}>
              {categories.map(cat => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setExpandedEntryIdx(null);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      background: active ? accent.from : 'rgba(128,128,128,0.06)',
                      color: active ? 'white' : 'var(--c-text-secondary)',
                      border: active ? 'none' : '1px solid rgba(128,128,128,0.1)',
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'Manrope',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 150ms ease'
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Diagnostic Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {filteredEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--c-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                No diagnostic entries match your filters.
              </div>
            ) : (
              filteredEntries.map((entry, idx) => {
                const expanded = expandedEntryIdx === idx;
                const severityColors = {
                  Info: { text: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                  Warning: { text: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
                  Error: { text: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
                }[entry.severity];

                return (
                  <div
                    key={idx}
                    onClick={() => setExpandedEntryIdx(expanded ? null : idx)}
                    style={{
                      background: 'rgba(128,128,128,0.03)',
                      border: expanded ? `1px solid ${accent.from}` : '1px solid rgba(128,128,128,0.08)',
                      borderRadius: 14,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'all 200ms ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', color: accent.from, letterSpacing: '0.04em' }}>
                          {entry.category} • {entry.subsystem}
                        </span>
                        <strong style={{ fontSize: 13, color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 700 }}>
                          {entry.summary}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          color: severityColors.text,
                          background: severityColors.bg
                        }}>
                          {entry.severity}
                        </span>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--c-text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
                          expand_more
                        </span>
                      </div>
                    </div>

                    {expanded && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        marginTop: 6,
                        borderTop: '1px solid rgba(128,128,128,0.08)',
                        paddingTop: 12,
                        fontSize: 12,
                        lineHeight: 1.45
                      }}>
                        {/* Human explanation */}
                        <div>
                          <label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-text-muted)', marginBottom: 2 }}>Explanation</label>
                          <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>{entry.humanExplanation}</p>
                        </div>
                        
                        {/* Technical explanation */}
                        <div>
                          <label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-text-muted)', marginBottom: 2 }}>Technical Details</label>
                          <code style={{ display: 'block', padding: '6px 10px', background: 'rgba(128,128,128,0.06)', borderRadius: 6, fontFamily: 'monospace', color: 'var(--c-text-primary)', overflowX: 'auto', whiteSpace: 'pre' }}>
                            {entry.technicalExplanation}
                          </code>
                        </div>

                        {/* Suggested solution */}
                        <div>
                          <label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-text-muted)', marginBottom: 2 }}>Suggested Solution</label>
                          <p style={{ margin: 0, color: '#22c55e', fontWeight: 600 }}>{entry.suggestedSolution}</p>
                        </div>

                        {/* Stack info (Developer mode only) */}
                        {settings.developerMode && entry.stack && (
                          <div>
                            <label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-text-muted)', marginBottom: 2 }}>Stack Information</label>
                            <pre style={{ margin: 0, padding: 8, background: 'rgba(239,68,68,0.04)', color: '#f87171', fontSize: 9.5, borderRadius: 6, fontFamily: 'monospace', overflowX: 'auto', maxHeight: 120 }}>
                              {entry.stack}
                            </pre>
                          </div>
                        )}

                        <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)', textAlign: 'right' }}>
                          Logged: {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Section: Developer Mode Collapsible */}
          {settings.developerMode && (
            <div style={{ marginTop: 24 }}>
              <div style={{
                fontFamily: 'Manrope',
                fontWeight: 800,
                fontSize: 11,
                color: 'var(--c-text-primary)',
                marginBottom: 12,
                borderBottom: '1px solid rgba(128,128,128,0.16)',
                paddingBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Developer Console</span>
                <button
                  onClick={handleClearHistoryLogs}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    fontFamily: 'Manrope',
                    fontWeight: 700,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  Clear History Logs
                </button>
              </div>

              <DiagnosticField label="Installed Certificate Signature Hash" value={otaDebugLogs.installedSigningSha256} isCode />
              <DiagnosticField label="Downloaded Certificate Signature Hash" value={otaDebugLogs.downloadedSigningSha256} isCode />
              <DiagnosticField label="Expected Certificate Signature Hash" value="900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206" isCode />
              <DiagnosticField label="Release Channel" value={otaDebugLogs.releaseChannel} />
              <DiagnosticField label="Internal Decision Reason" value={otaDebugLogs.updateDecisionReason} />

              <label style={{
                display: 'block',
                fontFamily: 'Manrope',
                fontWeight: 700,
                fontSize: 10.5,
                color: 'var(--c-text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 4
              }}>PackageInstaller Session History (Last 20 Runs)</label>
              
              <div style={{
                background: 'rgba(128,128,128,0.06)',
                borderRadius: 8,
                padding: '12px 14px',
                fontFamily: 'monospace',
                fontSize: 11,
                maxHeight: 220,
                overflowY: 'auto',
                color: 'var(--c-text-secondary)',
                lineHeight: 1.55
              }}>
                {nativeLogs.length === 0 ? (
                  <div style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>No native package installer history logged.</div>
                ) : (
                  nativeLogs.map((log, index) => (
                    <div key={index} style={{ marginBottom: 12, borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: 8 }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--c-text-primary)' }}>
                        [#{nativeLogs.length - index}] {log.stage || 'Log'} ({typeof log.elapsedTimeMs === 'number' ? `${(log.elapsedTimeMs / 1000).toFixed(2)}s` : '0.00s'} elapsed)
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--c-text-muted)', marginTop: 2 }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        Status Code: <span style={{ color: log.status === 0 ? '#22c55e' : (log.status === -1 ? '#fbbf24' : '#f87171'), fontWeight: 'bold' }}>{log.status}</span>
                      </div>
                      {log.packageName && <div>Package: {log.packageName}</div>}
                      {log.explanation && <div style={{ color: 'var(--c-text-primary)', marginTop: 4, fontWeight: 500 }}>{log.explanation}</div>}
                      {log.message && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 10, color: 'var(--c-text-muted)', marginTop: 2 }}>Detail: {log.message}</div>}
                      {log.exceptionStack && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 9, color: '#f87171', background: 'rgba(239,68,68,0.04)', padding: 6, borderRadius: 4, marginTop: 4, fontFamily: 'monospace', maxHeight: 100, overflowY: 'auto' }}>Stack: {log.exceptionStack}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Premium Action Row Footer */}
        <div style={{
          padding: '16px 22px',
          borderTop: '1px solid rgba(128,128,128,0.16)',
          display: 'flex',
          gap: 10,
          flexShrink: 0,
          background: 'var(--app-surface)'
        }}>
          <button
            onClick={handleRetryUpdate}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 10,
              background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              color: 'white',
              border: 'none',
              fontFamily: 'Manrope',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            Retry Update
          </button>

          <button
            onClick={handleShareLogs}
            style={{
              padding: '12px',
              borderRadius: 10,
              background: 'rgba(128,128,128,0.08)',
              color: 'var(--c-text-primary)',
              border: '1px solid rgba(128,128,128,0.12)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Share Diagnostics"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>share</span>
          </button>

          <button
            onClick={handleExportLogs}
            style={{
              padding: '12px',
              borderRadius: 10,
              background: 'rgba(128,128,128,0.08)',
              color: 'var(--c-text-primary)',
              border: '1px solid rgba(128,128,128,0.12)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Export Diagnostics"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(128,128,128,0.08)',
              color: 'var(--c-text-primary)',
              border: 'none',
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
      </div>

      <style>{`
        @keyframes diag-sheet-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
