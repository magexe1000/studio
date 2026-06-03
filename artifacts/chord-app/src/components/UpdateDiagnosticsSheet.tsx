import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { otaDiagnostics, otaDebugLogs } from '../lib/otaUpdate';
import { useBackHandler } from '../lib/backStack';

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

  const handleCopyLogs = () => {
    const diagnosticText = [
      '=== STUDIO UPDATE DIAGNOSTICS ===',
      `Failure Timestamp: ${otaDiagnostics.timestamp || 'N/A'}`,
      `Device Model/Manufacturer: ${otaDiagnostics.deviceModel || 'N/A'}`,
      `Android Version: ${otaDiagnostics.androidVersion || 'N/A'}`,
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
      `OTA Version (Capgo): ${otaDebugLogs.currentOtaVersion || 'N/A'}`,
      `Fetched version.json: ${otaDebugLogs.fetchedVersionJson || 'N/A'}`,
      `Fetched app-release.json: ${otaDebugLogs.fetchedAppReleaseJson || 'N/A'}`,
      `Comparison Result: ${otaDebugLogs.compareResult !== null ? otaDebugLogs.compareResult : 'N/A'}`,
      `Update Type: ${otaDebugLogs.updateType || 'N/A'}`,
      `Final Decision: ${otaDebugLogs.finalDecision || 'N/A'}`,
      `Download Status: ${otaDebugLogs.downloadStatus || 'N/A'}`,
      `SHA Verification Status: ${otaDebugLogs.shaVerification || 'N/A'}`,
      `File Details: ${otaDebugLogs.fileDetails || 'N/A'}`,
      `Install Error / Log: ${otaDebugLogs.installError || 'N/A'}`,
      `Installer Launch Status: ${otaDebugLogs.installerLaunchStatus || 'N/A'}`,
      `Last Exception Stack Trace:`,
      otaDebugLogs.lastExceptionStackTrace || 'N/A'
    ].join('\n');

    navigator.clipboard.writeText(diagnosticText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block',
        fontFamily: 'Manrope',
        fontWeight: 700,
        fontSize: 11,
        color: 'var(--c-text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 4
      }}>{label}</label>
      <div style={{
        fontFamily: isCode ? 'monospace' : 'Inter',
        fontSize: isCode ? 11 : 13.5,
        lineHeight: 1.45,
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
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 12 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Device Model" value={otaDiagnostics.deviceModel} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Android Version" value={otaDiagnostics.androidVersion} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 12 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Permission State" value={otaDiagnostics.permissionState} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="Timestamp" value={otaDiagnostics.timestamp} />
            </div>
          </div>

          <DiagnosticField label="Exception Message" value={otaDiagnostics.exceptionMessage} />
          
          <DiagnosticField label="Failure Reason & Stack Trace" value={otaDiagnostics.failureReason} isCode />

          <DiagnosticField label="Download URL" value={otaDiagnostics.downloadUrl} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 12 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="APK Path" value={otaDiagnostics.apkPath} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="File Size" value={otaDiagnostics.fileSize} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 12 }}>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="SHA-256 Expected" value={otaDiagnostics.shaExpected} />
            </div>
            <div style={{ minWidth: 120, flex: 1 }}>
              <DiagnosticField label="SHA-256 Calculated" value={otaDiagnostics.shaCalculated} />
            </div>
          </div>

          <DiagnosticField label="Installer intent result (Native Logs)" value={otaDiagnostics.installerResult} isCode />
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
