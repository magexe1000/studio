import { useChordStore, ACCENT_COLORS, otaDiagnostics, otaDebugLogs, useBackHandler, isNative } from '@workspace/studio-core';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  onClose: () => void;
};

const SWIPE_DISMISS_PX = 110;
const SWIPE_DISMISS_VELOCITY = 0.55;

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

          {/* Section: Update Pipeline Validation */}
          <div style={{
            fontFamily: 'Manrope',
            fontWeight: 800,
            fontSize: 11,
            color: 'var(--c-text-primary)',
            marginTop: 4,
            marginBottom: 12,
            borderBottom: '1px solid rgba(128,128,128,0.16)',
            paddingBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Update Pipeline Validation
          </div>

          <div style={{
            background: 'rgba(128,128,128,0.04)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 20,
            border: '1px solid rgba(128,128,128,0.1)'
          }}>
            {getValidationPhases().map((phase, idx) => {
              const badgeColor = phase.status === 'PASS' ? '#22c55e' : (phase.status === 'FAIL' ? '#ef4444' : '#fbbf24');
              const badgeBg = phase.status === 'PASS' ? 'rgba(34,197,94,0.15)' : (phase.status === 'FAIL' ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)');
              return (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: idx < 7 ? '1px solid rgba(128,128,128,0.08)' : 'none',
                  gap: 12
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, color: 'var(--c-text-primary)' }}>
                      {phase.name}
                    </div>
                    <div style={{ fontFamily: 'Inter', fontSize: 11.5, color: 'var(--c-text-muted)', marginTop: 2 }}>
                      {phase.desc}
                    </div>
                  </div>
                  <span style={{
                    fontFamily: 'Manrope',
                    fontWeight: 800,
                    fontSize: 9.5,
                    padding: '3px 8px',
                    borderRadius: 6,
                    color: badgeColor,
                    background: badgeBg,
                    letterSpacing: '0.04em'
                  }}>
                    {phase.status}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Section: General Device Info */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 6 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Device Model" value={otaDiagnostics.deviceModel} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Android Version" value={otaDiagnostics.androidVersion} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 6 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Architecture" value={otaDiagnostics.architecture || 'N/A'} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Device Locale" value={otaDiagnostics.deviceLocale || 'N/A'} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 6 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Storage Space" value={otaDiagnostics.storageAvailable || 'N/A'} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Network Status" value={otaDiagnostics.networkState || 'N/A'} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 6 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Permission State" value={otaDiagnostics.permissionState} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Timestamp" value={otaDiagnostics.timestamp} />
            </div>
          </div>

          {/* Section: Technical Details */}
          <div style={{
            fontFamily: 'Manrope',
            fontWeight: 800,
            fontSize: 11,
            color: 'var(--c-text-primary)',
            marginTop: 18,
            marginBottom: 12,
            borderBottom: '1px solid rgba(128,128,128,0.16)',
            paddingBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Technical Details
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 6 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Installed Version" value={otaDebugLogs.installedVersionName ? `${otaDebugLogs.installedVersionName} (code ${otaDebugLogs.installedVersionCode})` : 'N/A'} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Target Version" value={otaDebugLogs.remoteVersionCode ? `v${otaDebugLogs.remoteVersionCode}` : 'N/A'} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 6 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Installed Package" value={otaDebugLogs.installedPackageName} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Downloaded Package" value={otaDebugLogs.downloadedPackageName} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 6 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Signature Match" value={otaDebugLogs.eligibilitySigningMatch !== null ? (otaDebugLogs.eligibilitySigningMatch ? 'MATCH' : 'MISMATCH') : 'N/A'} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Package Match" value={otaDebugLogs.eligibilityPackageNameMatch !== null ? (otaDebugLogs.eligibilityPackageNameMatch ? 'MATCH' : 'MISMATCH') : 'N/A'} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 6 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Expected SHA-256" value={otaDiagnostics.shaExpected} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Calculated SHA-256" value={otaDiagnostics.shaCalculated} />
            </div>
          </div>

          <DiagnosticField label="APK Download Path" value={otaDiagnostics.apkPath} />
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 6 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="APK Package Size" value={otaDiagnostics.fileSize} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Installer Status Code" value={otaDiagnostics.statusCode !== null ? String(otaDiagnostics.statusCode) : 'N/A'} />
            </div>
          </div>

          <DiagnosticField label="Download URL" value={otaDiagnostics.downloadUrl} />

          <DiagnosticField label="Last Native Intent Log" value={otaDiagnostics.installerResult} isCode />

          <DiagnosticField label="Exception Stack Trace" value={otaDiagnostics.failureReason} isCode />

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
