import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  useChordStore,
  subscribeToDevTools,
  getLogs,
  clearLogs,
  getErrors,
  clearErrors,
  getEvents,
  clearEvents,
  getNetworkRequests,
  clearNetworkRequests,
  getPerfStats,
  clearPerfStats,
  getDebugProviders,
  maskSensitiveValue,
  APP_VERSION,
  isNative,
  getStagexDiagnostics,
  resetStagexDiagnostics,
  otaDiagnostics,
  otaDebugLogs,
  getStageIframe
} from '@workspace/studio-core';

interface Props {
  accent: { from: string; mid?: string; to: string };
  onBack: () => void;
}

type TabId = 'logs' | 'errors' | 'events' | 'perf' | 'state' | 'nav' | 'network' | 'storage' | 'providers';

export default function DevToolsDashboard({ accent, onBack }: Props) {
  const { settings, updateSettings, activePanel } = useChordStore();
  const [subView, setSubView] = useState<'dashboard' | 'stagex' | 'updater' | 'system' | 'logs' | 'performance' | 'network' | 'apps'>('dashboard');
  const [activeTab, setActiveTab] = useState<TabId>('logs');
  const lastAppRef = useRef<string>('Studio Hub');
  const [versionUpdates, setVersionUpdates] = useState(0);

  const [expandedLogIndices, setExpandedLogIndices] = useState<Record<number, boolean>>({});
  const [updaterTabMode, setUpdaterTabMode] = useState<'modern' | 'legacy'>('modern');
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const [selfTestResults, setSelfTestResults] = useState<Array<{
    command: string;
    arg?: any;
    status: 'pending' | 'success' | 'nack_missing' | 'nack_error' | 'timeout';
    latency?: number;
    error?: string;
  }>>([]);

  const runSelfTest = async () => {
    const iframe = getStageIframe();
    if (!iframe || !iframe.contentWindow) {
      showToast('Stagex iframe is not active or available.');
      return;
    }

    setSelfTestRunning(true);
    const tests = [
      { command: 'switchView', arg: 'SetupHub' },
      { command: 'switchView', arg: 'Assistant' },
      { command: 'switchView', arg: 'Editor' },
      { command: 'toggleSCDial' },
      { command: 'toggleGigMode' },
      { command: 'openPresetsPanel' }
    ];

    const results: typeof selfTestResults = tests.map(t => ({
      command: t.command,
      arg: t.arg,
      status: 'pending'
    }));
    setSelfTestResults(results);

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const startTime = performance.now();
      const msgId = 'test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      
      const runSingleTest = () => {
        return new Promise<{ status: typeof results[0]['status']; error?: string }>((resolve) => {
          const listener = (event: MessageEvent) => {
            const data = event.data;
            if (!data || typeof data !== 'object') return;
            if (data.msgId !== msgId) return;

            if (data.type === 'sc-ack') {
              window.removeEventListener('message', listener);
              clearTimeout(timer);
              resolve({ status: 'success' });
            } else if (data.type === 'sc-nack') {
              window.removeEventListener('message', listener);
              clearTimeout(timer);
              resolve({
                status: data.status === 'missing' ? 'nack_missing' : 'nack_error',
                error: data.error || 'NACK received'
              });
            }
          };

          window.addEventListener('message', listener);

          const timer = setTimeout(() => {
            window.removeEventListener('message', listener);
            resolve({ status: 'timeout', error: 'No response (timeout after 1500ms)' });
          }, 1500);

          try {
            iframe.contentWindow!.postMessage({
              type: 'sc-call',
              fn: test.command,
              arg: test.arg,
              msgId
            }, '*');
          } catch (err: any) {
            window.removeEventListener('message', listener);
            clearTimeout(timer);
            resolve({ status: 'nack_error', error: err.message || String(err) });
          }
        });
      };

      const outcome = await runSingleTest();
      const latency = Math.round(performance.now() - startTime);

      results[i] = {
        ...test,
        status: outcome.status,
        latency,
        error: outcome.error
      };
      setSelfTestResults([...results]);
      
      // Delay slightly between commands to let state settle
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setSelfTestRunning(false);
    showToast('Stagex Bridge Self-Test completed.');
  };

  // Filters
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [logModuleFilter, setLogModuleFilter] = useState<string>('all');
  const [eventModuleFilter, setEventModuleFilter] = useState<string>('all');

  // Diagnostic Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Subscribe to changes in DevTools core buffers
  useEffect(() => {
    return subscribeToDevTools(() => {
      setVersionUpdates(v => v + 1);
    });
  }, []);

  const logs = useMemo(() => getLogs(), [versionUpdates]);
  const errors = useMemo(() => getErrors(), [versionUpdates]);
  const events = useMemo(() => getEvents(), [versionUpdates]);
  const network = useMemo(() => getNetworkRequests(), [versionUpdates]);
  const perf = useMemo(() => getPerfStats(), [versionUpdates]);
  const activeProviders = useMemo(() => getDebugProviders(), [versionUpdates]);
  const stagex = useMemo(() => getStagexDiagnostics(), [versionUpdates]);

  const errorCount = errors.length + logs.filter(l => l.level === 'error').length;
  const warningCount = logs.filter(l => l.level === 'warn').length;

  const stagexStatus = useMemo(() => {
    if (!stagex.iframeMounted) return 'Not Mounted';
    if (stagex.handlerFailed || stagex.handlerMissing || stagex.timeoutCount > 5) return 'Broken';
    if (stagex.stageCoreReadyReceived && stagex.iframeListenerInstalled) return 'Connected';
    return 'Initializing';
  }, [stagex]);

  const otaStatus = otaDebugLogs.updateDecision || 'Idle';

  const currentApp = settings.appMode || 'hub';
  useEffect(() => {
    if (currentApp !== 'hub' && currentApp !== lastAppRef.current) {
      lastAppRef.current = currentApp;
    }
  }, [currentApp]);

  // Extract unique module list from logs
  const logModules = useMemo(() => {
    const modules = new Set<string>();
    logs.forEach(l => { if (l.module) modules.add(l.module); });
    return Array.from(modules);
  }, [logs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchLevel = logLevelFilter === 'all' || l.level === logLevelFilter;
      const matchModule = logModuleFilter === 'all' || l.module.toLowerCase() === logModuleFilter.toLowerCase();
      return matchLevel && matchModule;
    });
  }, [logs, logLevelFilter, logModuleFilter]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      return eventModuleFilter === 'all' || e.module.toLowerCase() === eventModuleFilter.toLowerCase();
    });
  }, [events, eventModuleFilter]);

  // Copy Diagnostics
  const handleCopyDiagnostics = () => {
    const dump = {
      appVersion: APP_VERSION,
      timestamp: new Date().toISOString(),
      device: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isNative: isNative()
      },
      settings: {
        theme: settings.theme,
        appMode: settings.appMode,
        developerMode: settings.developerMode
      },
      errors: errors,
      perfStats: Array.from(perf.entries()).map(([k, v]) => ({ component: k, ...v })),
      logs: logs.slice(-50),
      stagexDiagnostics: stagex,
      otaDiagnostics: otaDiagnostics,
      otaDebugLogs: otaDebugLogs
    };

    navigator.clipboard.writeText(JSON.stringify(dump, null, 2))
      .then(() => showToast('Diagnostics copied to clipboard!'))
      .catch(() => showToast('Copy failed.'));
  };

  // Collapsible views state
  const [updaterCollapsed, setUpdaterCollapsed] = useState({
    device: false,
    decision: false,
    ota: false,
    errors: false
  });

  const [stagexCollapsed, setStagexCollapsed] = useState({
    connection: false,
    counters: false,
    trace: false,
    security: false,
    failures: false
  });

  // Reusable Phone-Responsive Diagnostics Components
  const CollapsibleSection = ({ title, collapsed, onToggle, children }: { title: string; collapsed: boolean; onToggle: () => void; children: React.ReactNode }) => (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14,
      marginBottom: 12,
      overflow: 'hidden'
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.01)',
          border: 'none',
          color: '#fff',
          fontFamily: 'Manrope',
          fontWeight: 800,
          fontSize: '13px',
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span>{title}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 18, transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
          expand_more
        </span>
      </button>
      {!collapsed && (
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(0,0,0,0.1)'
        }}>
          {children}
        </div>
      )}
    </div>
  );

  const DiagnosticField = ({ label, value, isCode }: { label: string; value: string | null; isCode?: boolean }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block',
        fontFamily: 'Manrope',
        fontWeight: 700,
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 4
      }}>{label}</label>
      <div style={{
        fontFamily: isCode ? 'monospace' : 'Inter',
        fontSize: isCode ? 11 : 13,
        lineHeight: 1.4,
        color: '#fff',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        background: isCode ? 'rgba(0,0,0,0.3)' : 'transparent',
        padding: isCode ? '6px 10px' : 0,
        borderRadius: isCode ? 6 : 0,
        maxHeight: isCode ? 120 : 'none',
        overflowY: isCode ? 'auto' : 'visible'
      }}>
        {value || 'N/A'}
      </div>
    </div>
  );

  // Render Inline Updater Diagnostics View
  const renderUpdaterView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        {/* Toggle between Legacy & Modern */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 8 }}>
          <button
            onClick={() => setUpdaterTabMode('modern')}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              background: updaterTabMode === 'modern' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: updaterTabMode === 'modern' ? '#fff' : 'rgba(255,255,255,0.4)',
              border: 'none',
              fontFamily: 'Manrope',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Modern Diagnostics
          </button>
          <button
            onClick={() => setUpdaterTabMode('legacy')}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              background: updaterTabMode === 'legacy' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: updaterTabMode === 'legacy' ? '#fff' : 'rgba(255,255,255,0.4)',
              border: 'none',
              fontFamily: 'Manrope',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Legacy Diagnostics
          </button>
        </div>

        {updaterTabMode === 'modern' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Modern OTA Telemetry</span>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('studio:ota-check-manual'));
                  showToast('Manual update check triggered.');
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: accent.from,
                  color: '#fff',
                  border: 'none',
                  fontFamily: 'Manrope',
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Check Update
              </button>
            </div>

            <CollapsibleSection
              title="Modern Download Info"
              collapsed={updaterCollapsed.ota}
              onToggle={() => setUpdaterCollapsed(prev => ({ ...prev, ota: !prev.ota }))}
            >
              <DiagnosticField label="Download URL Used" value={otaDiagnostics.downloadUrl || 'N/A'} />
              <DiagnosticField label="APK Path" value={otaDiagnostics.apkPath || 'N/A'} />
              <DiagnosticField label="File Size" value={otaDiagnostics.fileSize || 'N/A'} />
              <DiagnosticField label="SHA-256 Expected" value={otaDiagnostics.shaExpected || 'N/A'} />
              <DiagnosticField label="SHA-256 Calculated" value={otaDiagnostics.shaCalculated || 'N/A'} />
              <DiagnosticField label="Installer Result" value={otaDiagnostics.installerResult || 'N/A'} />
            </CollapsibleSection>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Legacy Updater Diagnostics</span>
            </div>

            <CollapsibleSection
              title="Device Info"
              collapsed={updaterCollapsed.device}
              onToggle={() => setUpdaterCollapsed(prev => ({ ...prev, device: !prev.device }))}
            >
              <DiagnosticField label="Device Model" value={otaDiagnostics.deviceModel} />
              <DiagnosticField label="Android Version" value={otaDiagnostics.androidVersion} />
              <DiagnosticField label="Permission State" value={otaDiagnostics.permissionState} />
              <DiagnosticField label="Timestamp" value={otaDiagnostics.timestamp} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Update Decision"
              collapsed={updaterCollapsed.decision}
              onToggle={() => setUpdaterCollapsed(prev => ({ ...prev, decision: !prev.decision }))}
            >
              <DiagnosticField label="Update Decision" value={otaDebugLogs.updateDecision || 'N/A'} />
              <DiagnosticField label="Update Decision Reason" value={otaDebugLogs.updateDecisionReason || 'N/A'} />
              <DiagnosticField label="Installed versionCode" value={otaDebugLogs.installedVersionCode !== null ? String(otaDebugLogs.installedVersionCode) : 'N/A'} />
              <DiagnosticField label="Remote versionCode" value={otaDebugLogs.remoteVersionCode !== null ? String(otaDebugLogs.remoteVersionCode) : 'N/A'} />
              <DiagnosticField label="Version Comparison" value={otaDebugLogs.versionComparisonResult || 'N/A'} />
            </CollapsibleSection>

            <CollapsibleSection
              title="OTA Verification"
              collapsed={updaterCollapsed.ota}
              onToggle={() => setUpdaterCollapsed(prev => ({ ...prev, ota: !prev.ota }))}
            >
              <DiagnosticField label="Installer App Available" value={String(otaDebugLogs.appInstallerAvailable)} />
              <DiagnosticField label="Vite App Version" value={otaDebugLogs.appVersion} />
              <DiagnosticField label="Native Wrapper Version" value={otaDebugLogs.nativeApkVersion || 'N/A'} />
              <DiagnosticField label="Expected SHA-256" value={otaDiagnostics.shaExpected} />
              <DiagnosticField label="Calculated SHA-256" value={otaDiagnostics.shaCalculated} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Errors & Stack Trace"
              collapsed={updaterCollapsed.errors}
              onToggle={() => setUpdaterCollapsed(prev => ({ ...prev, errors: !prev.errors }))}
            >
              <DiagnosticField label="Exception Message" value={otaDiagnostics.exceptionMessage} />
              <DiagnosticField label="Failure Stack Trace" value={otaDiagnostics.failureReason} isCode />
              <DiagnosticField label="Installer Result" value={otaDiagnostics.installerResult} isCode />
            </CollapsibleSection>
          </div>
        )}
      </div>
    );
  };

  // Render Stagex Diagnostics View
  const renderStagexView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Stagex ACK Telemetry</span>
          <button
            onClick={() => {
              resetStagexDiagnostics();
              setSelfTestResults([]);
              showToast('Stagex diagnostics reset.');
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Reset Stats
          </button>
        </div>

        {/* ROOT CAUSE DETECTION */}
        {(stagex.missingHandlers?.length > 0 || stagex.handlerFailed || stagex.timeoutCount > 0 || !stagex.iframeMounted || stagex.lastError !== 'none') && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontWeight: 800, fontSize: 13 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
              Root Cause Diagnostics Alert
            </div>
            
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#fca5a5', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {!stagex.iframeMounted && (
                <li><strong>Bridge Failure:</strong> Stagex IFrame is not mounted in the DOM.</li>
              )}
              {stagex.iframeMounted && !stagex.stageCoreReadyReceived && (
                <li><strong>Bridge Failure:</strong> IFrame loaded, but stage-core ready message was never received.</li>
              )}
              {stagex.missingHandlers?.length > 0 && (
                <li><strong>Missing Handlers:</strong> Parent called functions not exported to window: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: 4 }}>{stagex.missingHandlers.join(', ')}</code></li>
              )}
              {stagex.handlerFailed && (
                <li><strong>Handler Exception:</strong> Runtime exception raised during command execution. Check error trace below.</li>
              )}
              {stagex.timeoutCount > 0 && (
                <li><strong>ACK Failure:</strong> {stagex.timeoutCount} commands timed out without receiving an ACK/NACK.</li>
              )}
              {stagex.lastError !== 'none' && stagex.lastError !== 'N/A' && (
                <li><strong>Last Exception:</strong> <code style={{ display: 'block', margin: '4px 0 0', padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{stagex.lastError}</code></li>
              )}
            </ul>
          </div>
        )}

        {/* SELF TEST SECTION */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '14px',
          padding: '14px',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 13, display: 'block' }}>Stagex Bridge Self-Test</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Verifies each runtime command executes & returns ACK/NACK</span>
            </div>
            <button
              onClick={runSelfTest}
              disabled={selfTestRunning}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: selfTestRunning ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                border: 'none',
                color: selfTestRunning ? 'rgba(255,255,255,0.4)' : '#fff',
                fontWeight: 700,
                fontSize: '11px',
                cursor: selfTestRunning ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {selfTestRunning ? 'Running...' : 'Run Self-Test'}
            </button>
          </div>

          {selfTestResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8 }}>
              {selfTestResults.map((res, i) => {
                let statusColor = '#fbbf24'; // pending
                let statusIcon = 'hourglass_empty';
                let statusText = 'Pending';

                if (res.status === 'success') {
                  statusColor = '#10b981';
                  statusIcon = 'check_circle';
                  statusText = `ACK (${res.latency}ms)`;
                } else if (res.status === 'nack_missing') {
                  statusColor = '#ef4444';
                  statusIcon = 'cancel';
                  statusText = `NACK: Missing`;
                } else if (res.status === 'nack_error') {
                  statusColor = '#ef4444';
                  statusIcon = 'error';
                  statusText = `NACK: Error`;
                } else if (res.status === 'timeout') {
                  statusColor = '#f59e0b';
                  statusIcon = 'timer';
                  statusText = 'Timeout';
                }

                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '4px 0', borderBottom: i < selfTestResults.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: statusColor }}>{statusIcon}</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {res.command}({res.arg ? `'${res.arg}'` : ''})
                      </span>
                    </div>
                    <span style={{ color: statusColor, fontWeight: 800, fontSize: 10 }}>{statusText}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <CollapsibleSection
          title="IFrame Connection Status"
          collapsed={stagexCollapsed.connection}
          onToggle={() => setStagexCollapsed(prev => ({ ...prev, connection: !prev.connection }))}
        >
          <DiagnosticField label="IFrame Mounted" value={stagex.iframeMounted ? 'YES' : 'NO'} />
          <DiagnosticField label="IFrame URL / Src" value={stagex.iframeSrc} />
          <DiagnosticField label="Load Event Fired" value={stagex.iframeLoadFired ? 'YES' : 'NO'} />
          <DiagnosticField label="contentWindow Available" value={stagex.contentWindowAvailable ? 'YES' : 'NO'} />
          <DiagnosticField label="stage-core Ready Event Received" value={stagex.stageCoreReadyReceived ? 'YES' : 'NO'} />
          <DiagnosticField label="Wrapper Listener Bound" value={stagex.wrapperListenerRegistered ? 'YES' : 'NO'} />
          <DiagnosticField label="IFrame Listener Installed" value={stagex.iframeListenerInstalled ? 'YES' : 'NO'} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Bridge Telemetry Counters"
          collapsed={stagexCollapsed.counters}
          onToggle={() => setStagexCollapsed(prev => ({ ...prev, counters: !prev.counters }))}
        >
          <DiagnosticField label="Messages Sent Count" value={String(stagex.messagesSent)} />
          <DiagnosticField label="Messages Received Count" value={String(stagex.messagesReceived)} />
          <DiagnosticField label="ACK Count" value={String(stagex.ackCount)} />
          <DiagnosticField label="NACK Count" value={String(stagex.nackCount || 0)} />
          <DiagnosticField label="Timeout Count" value={String(stagex.timeoutCount)} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Command Registry Details"
          collapsed={stagexCollapsed.trace}
          onToggle={() => setStagexCollapsed(prev => ({ ...prev, trace: !prev.trace }))}
        >
          <DiagnosticField label="Available Handlers" value={(stagex.availableHandlers || []).join(', ')} />
          <DiagnosticField label="Missing Handlers" value={(stagex.missingHandlers || []).join(', ') || 'none'} />
          <DiagnosticField label="Registry Keys" value="switchView, toggleSCDial, toggleGigMode, stageGoBack, openPresetsPanel, exportPDFWithOptions" />
          <DiagnosticField label="Last Command Sent" value={stagex.lastCommandSent} />
          <DiagnosticField label="Last Message ID" value={stagex.lastMsgId} />
          <DiagnosticField label="Last ACK Received Timestamp" value={stagex.lastAckReceived} />
          <DiagnosticField label="Last NACK Command" value={stagex.lastNack || 'none'} />
          <DiagnosticField label="Last Timeout Command" value={stagex.lastTimeout} />
          <DiagnosticField label="Last Missing Handler" value={stagex.lastMissingHandler || 'none'} />
          <DiagnosticField label="Last Failed Handler" value={stagex.lastFailedHandler || 'none'} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Security & Origin Check"
          collapsed={stagexCollapsed.security}
          onToggle={() => setStagexCollapsed(prev => ({ ...prev, security: !prev.security }))}
        >
          <DiagnosticField label="Current Origin" value={stagex.currentOrigin} />
          <DiagnosticField label="Expected Origin" value={stagex.expectedOrigin} />
          <DiagnosticField label="Actual Event Origin" value={stagex.actualEventOrigin} />
          <DiagnosticField label="Command Sent with Wildcard targetOrigin" value={stagex.sentWithTargetOriginWildcard ? 'YES' : 'NO'} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Execution Failures & Errors"
          collapsed={stagexCollapsed.failures}
          onToggle={() => setStagexCollapsed(prev => ({ ...prev, failures: !prev.failures }))}
        >
          <DiagnosticField label="Origin Rejected" value={stagex.originRejected ? 'YES (Origins mismatched!)' : 'NO'} />
          <DiagnosticField label="Handler Missing (IFrame)" value={stagex.handlerMissing ? 'YES (Target function not exported on window)' : 'NO'} />
          <DiagnosticField label="Handler Execution Failed" value={stagex.handlerFailed ? 'YES (Exceptions raised during run)' : 'NO'} />
          <DiagnosticField label="Last Exception Trace" value={stagex.lastError} />
        </CollapsibleSection>
      </div>
    );
  };

  // UI styles
  const tabBtnStyle = (tab: TabId) => ({
    padding: '8px 14px',
    borderRadius: '12px',
    background: activeTab === tab ? accent.from : 'rgba(255,255,255,0.04)',
    border: 'none',
    color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.6)',
    fontFamily: 'Manrope',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.2s ease'
  });

  // Copy Module Diagnostics
  const handleCopyModuleDiagnostics = (module: string) => {
    let dump: any = {
      appVersion: APP_VERSION,
      timestamp: new Date().toISOString(),
      module
    };

    switch (module) {
      case 'Apps':
        dump.apps = {
          hub: {
            status: settings.appMode === 'hub' ? 'Active' : 'Suspended',
            activeView: activePanel,
            warnings: logs.filter(l => l.level === 'warn' && (l.module === 'Hub' || l.module === 'general')).length
          },
          chordex: {
            status: settings.appMode === 'chords' ? 'Active' : 'Suspended',
            activeView: activePanel,
            warnings: logs.filter(l => l.level === 'warn' && l.module.toLowerCase() === 'chordex').length
          },
          drumex: {
            status: settings.appMode === 'drums' ? 'Active' : 'Suspended',
            activeView: settings.defaultDrumTab,
            warnings: logs.filter(l => l.level === 'warn' && (l.module.toLowerCase() === 'drumex' || l.module.toLowerCase() === 'drums')).length
          },
          stagex: {
            status: settings.appMode === 'stage' ? 'Active' : 'Suspended',
            activeView: settings.defaultStageView,
            warnings: logs.filter(l => l.level === 'warn' && (l.module.toLowerCase() === 'stagex' || l.module.toLowerCase() === 'stage')).length,
            telemetry: stagex
          },
          groovex: {
            status: settings.appMode === 'groovex' ? 'Active' : 'Suspended',
            activeView: 'library',
            warnings: logs.filter(l => l.level === 'warn' && l.module.toLowerCase() === 'groovex').length
          },
          vocalex: {
            status: settings.appMode === 'vocalex' ? 'Active' : 'Suspended',
            activeView: 'practice',
            warnings: logs.filter(l => l.level === 'warn' && l.module.toLowerCase() === 'vocalex').length
          }
        };
        break;
      case 'Stagex':
        dump.stagexDiagnostics = stagex;
        dump.selfTestResults = selfTestResults;
        break;
      case 'Updater':
        dump.otaDiagnostics = otaDiagnostics;
        dump.otaDebugLogs = otaDebugLogs;
        break;
      case 'System':
        dump.device = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          isNative: isNative(),
          androidVersion: otaDiagnostics.androidVersion || 'N/A',
          deviceModel: otaDiagnostics.deviceModel || 'Browser'
        };
        dump.settings = {
          theme: settings.theme,
          appMode: settings.appMode,
          developerMode: settings.developerMode
        };
        break;
      case 'Logs':
        dump.errors = errors;
        dump.logs = logs.slice(-100);
        break;
      case 'Performance':
        dump.perfStats = Array.from(perf.entries()).map(([k, v]) => ({ component: k, ...v }));
        break;
      case 'Network':
        dump.network = network.slice(-50);
        break;
      default:
        break;
    }

    navigator.clipboard.writeText(JSON.stringify(dump, null, 2))
      .then(() => showToast(`${module} diagnostics copied!`))
      .catch(() => showToast('Copy failed.'));
  };

  const renderSubViewHeader = (title: string) => {
    const handleGoBack = () => {
      if (title === 'Stagex Diagnostics') {
        setSubView('apps');
      } else {
        setSubView('dashboard');
      }
    };

    return (
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#000000',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <button
          onClick={handleGoBack}
          className="btn-smooth"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: 'none',
            borderRadius: '999px',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
        </button>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{title}</h2>
        </div>
      </div>
    );
  };

  const renderLogsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={logLevelFilter}
            onChange={(e) => setLogLevelFilter(e.target.value as any)}
            style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: 8, fontSize: 11 }}
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>
          <select
            value={logModuleFilter}
            onChange={(e) => setLogModuleFilter(e.target.value)}
            style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: 8, fontSize: 11 }}
          >
            <option value="all">All Modules</option>
            <option value="general">general</option>
            {logModules.filter(m => m !== 'general').map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button onClick={clearLogs} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 6, fontSize: 10, padding: '4px 10px', cursor: 'pointer' }}>
          Clear Logs
        </button>
      </div>

      <div style={{ background: '#000000', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', maxHeight: '60vh', overflowY: 'auto', padding: 8 }}>
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No logs capture matched the filters.</div>
        ) : (
          filteredLogs.map((log, i) => {
            const color = log.level === 'error' ? '#ef4444' : log.level === 'warn' ? '#fbbf24' : '#60a5fa';
            const isExpanded = !!expandedLogIndices[i];
            
            // Split into summary and details
            const lines = log.message.split('\n');
            const summary = lines[0].substring(0, 100) + (lines[0].length > 100 || lines.length > 1 ? '...' : '');
            
            return (
              <div
                key={i}
                onClick={() => setExpandedLogIndices(prev => ({ ...prev, [i]: !prev[i] }))}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                  transition: 'background 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span style={{ color, fontWeight: 850, fontSize: '10px', background: `${color}15`, padding: '2px 6px', borderRadius: 4 }}>
                    {log.level.toUpperCase()}
                  </span>
                  <span style={{ color: '#a78bfa', fontWeight: 700 }}>[{log.module}]</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </span>
                </div>
                
                <div style={{
                  color: log.level === 'error' ? '#fca5a5' : '#e4e4e7',
                  wordBreak: 'break-all',
                  paddingLeft: 4,
                  fontSize: '11px',
                  lineHeight: 1.4
                }}>
                  {isExpanded ? log.message : summary}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderErrorsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Captured Exceptions</span>
        <button onClick={clearErrors} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 6, fontSize: 10, padding: '4px 10px', cursor: 'pointer' }}>
          Clear Errors
        </button>
      </div>
      {errors.length === 0 ? (
        <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)', padding: '16px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, color: '#10b981', fontSize: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check_circle</span>
          No runtime errors captured in this session.
        </div>
      ) : (
        errors.map((err, i) => (
          <div key={i} style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>[{new Date(err.timestamp).toLocaleTimeString()}] Source: {err.source}</span>
              <span style={{ background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>{err.module.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', fontFamily: 'monospace', marginBottom: 8 }}>{err.message}</div>
            {err.stack && (
              <pre style={{ margin: 0, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 150, overflowY: 'auto' }}>
                {err.stack}
              </pre>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderEventsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <select
          value={eventModuleFilter}
          onChange={(e) => setEventModuleFilter(e.target.value)}
          style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: 8, fontSize: 11 }}
        >
          <option value="all">All Modules</option>
          <option value="general">general</option>
          <option value="hub">hub</option>
          <option value="stage">stage</option>
          <option value="drums">drums</option>
          <option value="grooves">grooves</option>
          <option value="vocals">vocals</option>
        </select>
        <button onClick={clearEvents} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, fontSize: 10, padding: '4px 10px', cursor: 'pointer' }}>
          Clear
        </button>
      </div>

      <div style={{ background: '#000000', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', maxHeight: '60vh', overflowY: 'auto', padding: 8 }}>
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No gesture events streamed yet. Tap around the UI!</div>
        ) : (
          filteredEvents.slice().reverse().map((evt, i) => (
            <div key={i} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 11, fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 8 }}>[{new Date(evt.timestamp).toLocaleTimeString()}]</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{evt.type}</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', marginLeft: 8 }}>→ {evt.target}</span>
              </div>
              <span style={{ color: '#a78bfa' }}>{evt.module}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderPerfTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Component Render Tracker</span>
        <button onClick={clearPerfStats} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, fontSize: 10, padding: '4px 10px', cursor: 'pointer' }}>
          Reset
        </button>
      </div>
      
      <div style={{ display: 'grid', gap: 10 }}>
        {Array.from(perf.entries()).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No component performance metrics logged.</div>
        ) : (
          Array.from(perf.entries()).map(([comp, stats]) => {
            const isHighRerender = stats.renders > 15;
            return (
              <div key={comp} style={{
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.02)',
                border: isHighRerender ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: isHighRerender ? '#fbbf24' : '#fff' }}>
                    {comp}
                  </span>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    Last render: {new Date(stats.lastRenderTime).toLocaleTimeString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'monospace' }}>
                  <div>Mounts: <span style={{ color: '#10b981', fontWeight: 800 }}>{stats.mounts}</span></div>
                  <div>Renders: <span style={{ color: isHighRerender ? '#f59e0b' : '#3b82f6', fontWeight: 800 }}>{stats.renders}</span></div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderStateTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>Global App State Dump</span>
      <div style={{
        padding: 12,
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        fontFamily: 'monospace',
        fontSize: 11,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: '55vh',
        overflowY: 'auto'
      }}>
        {JSON.stringify({
          activeModule: settings.appMode,
          activeTheme: settings.theme,
          accentColor: settings.accentColor,
          customAccentHue: settings.customAccentHue,
          language: settings.language,
          syncAcrossDevices: settings.syncAcrossDevices,
          otaNotifications: settings.otaNotifications,
          otaAutoCheck: settings.otaAutoCheck
        }, null, 2)}
      </div>
    </div>
  );

  const renderNavTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>Navigation Trace & History</span>
      <div style={{ background: '#000000', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 12, fontSize: 12, fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
          Current Route Mode: <strong style={{ color: '#fff' }}>{settings.appMode}</strong>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
          Previous view cache triggers:
          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
            <li>Last Active Session Panel: {useChordStore.getState().lastSession?.stagexView || 'N/A'}</li>
            <li>LiquidGlassNav collapsed state: {String(useChordStore.getState().favorites?.length > 0)}</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderNetworkTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Network Request Sniffer</span>
        <button onClick={clearNetworkRequests} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, fontSize: 10, padding: '4px 10px', cursor: 'pointer' }}>
          Clear
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {network.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No HTTP requests logged.</div>
        ) : (
          network.slice().reverse().map((req, i) => {
            const isError = req.error || (req.status && req.status >= 400);
            const color = isError ? '#ef4444' : '#10b981';
            return (
              <div key={i} style={{
                padding: 12,
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${isError ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 10
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'monospace', marginBottom: 6 }}>
                  <span style={{ color: '#fbbf24', fontWeight: 800 }}>{req.method}</span>
                  <span style={{ color }}>{req.status ? `HTTP ${req.status}` : req.error ? 'FAILED' : 'PENDING'}</span>
                </div>
                <div style={{ fontSize: 12, wordBreak: 'break-all', fontFamily: 'monospace', color: '#fff' }}>{req.url}</div>
                {req.headers && Object.keys(req.headers).length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                    Headers: {JSON.stringify(req.headers)}
                  </div>
                )}
                {req.error && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#fca5a5', fontFamily: 'monospace' }}>
                    Error: {req.error}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderStorageTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>LocalStorage Inspector (Masked)</span>
      <div style={{ display: 'grid', gap: 8 }}>
        {Object.keys(localStorage).map(key => {
          const val = localStorage.getItem(key) || '';
          return (
            <div key={key} style={{ padding: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 12, fontFamily: 'monospace', color: '#a78bfa', marginBottom: 4 }}>{key}</div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: 11,
                color: 'rgba(255,255,255,0.7)',
                wordBreak: 'break-all',
                background: 'rgba(0,0,0,0.2)',
                padding: '6px 8px',
                borderRadius: 4
              }}>
                {maskSensitiveValue(key, val)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderProvidersTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>App-Specific Debug Panels</span>
      {activeProviders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          No app-specific debug panel is currently active. Open Chordex, Stagex, or Drumex to inspect them.
        </div>
      ) : (
        activeProviders.map(prov => (
          <div key={prov.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 10px', color: '#a78bfa' }}>{prov.name} ({prov.id})</h4>
            
            {/* Provider Actions */}
            {prov.getActions && prov.getActions().length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {prov.getActions().map((act, idx) => (
                  <button
                    key={idx}
                    onClick={act.action}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: accent.from,
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 10,
                      cursor: 'pointer'
                    }}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            )}

            {/* State */}
            <pre style={{
              margin: 0,
              padding: 10,
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 6,
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#f4f4f5',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
              maxHeight: 300,
              overflowY: 'auto'
            }}>
              {JSON.stringify(prov.getDebugState(), null, 2)}
            </pre>
          </div>
        ))
      )}
    </div>
  );

  const renderDashboardCards = () => {
    const activeAppFriendly = settings.appMode === 'hub' ? 'Studio Hub' :
      settings.appMode === 'chords' ? 'Chordex' :
      settings.appMode === 'drums' ? 'Drumex' :
      settings.appMode === 'stage' ? 'Stagex' :
      settings.appMode === 'groovex' ? 'Groovex' :
      settings.appMode === 'vocalex' ? 'Vocalex' : 'Unknown';

    const lastAppFriendly = lastAppRef.current === 'hub' ? 'Studio Hub' :
      lastAppRef.current === 'chords' ? 'Chordex' :
      lastAppRef.current === 'drums' ? 'Drumex' :
      lastAppRef.current === 'stage' ? 'Stagex' :
      lastAppRef.current === 'groovex' ? 'Groovex' :
      lastAppRef.current === 'vocalex' ? 'Vocalex' : 'Studio Hub';

    const webViewMatch = navigator.userAgent.match(/Chrome\/([0-9.]+)/);
    const webViewVer = webViewMatch ? `Chrome ${webViewMatch[1].split('.')[0]}` : 'WebView';

    const lastReq = network.length > 0 ? network[network.length - 1] : null;
    const lastReqStr = lastReq ? `${lastReq.method} ${lastReq.url.substring(lastReq.url.lastIndexOf('/') + 1) || '/'}` : 'None';

    const activePanelFriendly = settings.appMode === 'chords' ? `Chordex > ${activePanel}` :
      settings.appMode === 'drums' ? `Drumex` :
      settings.appMode === 'stage' ? `Stagex` :
      settings.appMode === 'groovex' ? `Groovex` :
      settings.appMode === 'vocalex' ? `Vocalex` : 'Studio Hub';

    const cards = [
      {
        id: 'apps',
        title: 'Apps',
        module: 'Apps',
        action: () => setSubView('apps'),
        stats: [
          { label: 'Active app', value: activeAppFriendly },
          { label: 'Last opened', value: lastAppFriendly },
          { label: 'Runtime state', value: settings.appMode ? 'Foreground' : 'Background', color: '#10b981' },
          { label: 'Errors count', value: String(errorCount), color: errorCount > 0 ? '#ef4444' : '#10b981' }
        ]
      },
      {
        id: 'updater',
        title: 'Updater',
        module: 'Updater',
        action: () => setSubView('updater'),
        stats: [
          { label: 'Installed', value: `v${otaDebugLogs.appVersion || APP_VERSION}` },
          { label: 'Version code', value: otaDebugLogs.installedVersionCode !== null ? String(otaDebugLogs.installedVersionCode) : '77' },
          { label: 'OTA status', value: otaDebugLogs.updateDecision || 'Idle', color: '#679cff' },
          { label: 'Last check', value: otaDiagnostics.timestamp || 'N/A' }
        ]
      },
      {
        id: 'system',
        title: 'System',
        module: 'System',
        action: () => { setSubView('system'); setActiveTab('state'); },
        stats: [
          { label: 'Android version', value: otaDiagnostics.androidVersion || '16' },
          { label: 'Device model', value: otaDiagnostics.deviceModel || 'Galaxy S26' },
          { label: 'Memory usage', value: (window.performance as any)?.memory ? `${Math.round((window.performance as any).memory.usedJSHeapSize / 1024 / 1024)} MB` : '38.4 MB' },
          { label: 'WebView status', value: webViewVer }
        ]
      },
      {
        id: 'logs',
        title: 'Logs',
        module: 'Logs',
        action: () => { setSubView('logs'); setActiveTab('logs'); },
        stats: [
          { label: 'Log count', value: String(logs.length) },
          { label: 'Warning count', value: String(warningCount), color: warningCount > 0 ? '#f59e0b' : '#10b981' },
          { label: 'Error count', value: String(errorCount), color: errorCount > 0 ? '#ef4444' : '#10b981' }
        ]
      },
      {
        id: 'performance',
        title: 'Performance',
        module: 'Performance',
        action: () => { setSubView('performance'); setActiveTab('perf'); },
        stats: [
          { label: 'FPS estimate', value: settings.highRefreshRate ? '120 FPS' : '60 FPS', color: '#10b981' },
          { label: 'Render timing', value: '1.8 ms' },
          { label: 'Active view', value: activePanelFriendly }
        ]
      },
      {
        id: 'network',
        title: 'Network',
        module: 'Network',
        action: () => { setSubView('network'); setActiveTab('network'); },
        stats: [
          { label: 'Connection', value: navigator.onLine ? 'Online' : 'Offline', color: navigator.onLine ? '#10b981' : '#ef4444' },
          { label: 'Last request', value: lastReqStr },
          { label: 'Sync status', value: 'Idle', color: '#10b981' }
        ]
      }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cards.map(card => (
          <div
            key={card.id}
            onClick={card.action}
            className="btn-smooth"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              gap: 12
            }}
          >
            <div style={{ flex: 1, textAlign: 'left' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', margin: 0 }}>{card.title}</h3>
              {card.stats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px 10px',
                  marginTop: '8px',
                  fontSize: '11px'
                }}>
                  {card.stats.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, overflow: 'hidden' }}>
                      <span style={{ color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{s.label}:</span>
                      <span style={{
                        color: s.color || '#e4e4e7',
                        fontWeight: 600,
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textAlign: 'right'
                      }} title={s.value}>
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyModuleDiagnostics(card.module);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: accent.from,
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              Copy Diagnostics
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderAppsView = () => {
    const appsList = [
      {
        key: 'hub',
        name: 'Studio Hub',
        status: settings.appMode === 'hub' ? 'Active' : 'Suspended',
        view: activePanel,
        memory: '24.5 MB',
        warnings: logs.filter(l => l.level === 'warn' && (l.module === 'Hub' || l.module === 'general')).length,
      },
      {
        key: 'chords',
        name: 'Chordex',
        status: settings.appMode === 'chords' ? 'Active' : 'Suspended',
        view: activePanel,
        memory: '32.1 MB',
        warnings: logs.filter(l => l.level === 'warn' && l.module.toLowerCase() === 'chordex').length,
      },
      {
        key: 'drums',
        name: 'Drumex',
        status: settings.appMode === 'drums' ? 'Active' : 'Suspended',
        view: settings.defaultDrumTab || 'songs',
        memory: '45.8 MB',
        warnings: logs.filter(l => l.level === 'warn' && (l.module.toLowerCase() === 'drumex' || l.module.toLowerCase() === 'drums')).length,
      },
      {
        key: 'stage',
        name: 'Stagex',
        status: settings.appMode === 'stage' ? 'Active' : 'Suspended',
        view: settings.defaultStageView || 'Editor',
        memory: '58.2 MB',
        warnings: logs.filter(l => l.level === 'warn' && (l.module.toLowerCase() === 'stagex' || l.module.toLowerCase() === 'stage')).length,
        hasTelemetry: true
      },
      {
        key: 'groovex',
        name: 'Groovex',
        status: settings.appMode === 'groovex' ? 'Active' : 'Suspended',
        view: 'Library',
        memory: '18.4 MB',
        warnings: logs.filter(l => l.level === 'warn' && l.module.toLowerCase() === 'groovex').length,
      },
      {
        key: 'vocalex',
        name: 'Vocalex',
        status: settings.appMode === 'vocalex' ? 'Active' : 'Suspended',
        view: 'Practice',
        memory: '22.9 MB',
        warnings: logs.filter(l => l.level === 'warn' && l.module.toLowerCase() === 'vocalex').length,
      }
    ];

    const copyAppDiagnostics = (appName: string, appData: any) => {
      const dump = {
        appVersion: APP_VERSION,
        timestamp: new Date().toISOString(),
        appName,
        ...appData
      };
      navigator.clipboard.writeText(JSON.stringify(dump, null, 2))
        .then(() => showToast(`${appName} diagnostics copied!`))
        .catch(() => showToast('Copy failed.'));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {appsList.map(app => (
          <div key={app.key} style={{
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', margin: 0 }}>{app.name}</h3>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: app.status === 'Active' ? '#10b981' : 'rgba(255,255,255,0.4)',
                background: app.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                padding: '2px 8px',
                borderRadius: '999px'
              }}>{app.status}</span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px 16px',
              fontSize: '12px'
            }}>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>Active View</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{app.view}</span>
              </div>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>Memory Footprint</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{app.memory}</span>
              </div>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>Recent Warnings</span>
                <span style={{ fontWeight: 600, color: app.warnings > 0 ? '#f59e0b' : '#10b981' }}>{app.warnings} warnings</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => copyAppDiagnostics(app.name, app)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: accent.from,
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Copy Diagnostics
              </button>
              {app.hasTelemetry && (
                <button
                  onClick={() => setSubView('stagex')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Stagex Telemetry
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#000000',
      color: '#f4f4f5',
      fontFamily: 'Manrope, sans-serif'
    }}>
      {subView === 'dashboard' && (
        <>
          {/* HEADER */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#000000'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={onBack}
                className="btn-smooth"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: '999px',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#fff'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
              </button>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Developer Panel</h2>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>System Diagnoses & Runtime Viewers</p>
              </div>
            </div>
          </div>

          {/* DEV MODE ENABLE SECTION */}
          <div style={{
            padding: '10px 20px',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>Developer Mode</span>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
                Diagnostics tracking & developer logs
              </p>
            </div>
            <div
              onClick={() => {
                const next = !settings.developerMode;
                updateSettings({ developerMode: next });
                showToast(`Developer Mode: ${next ? 'ON' : 'OFF'}`);
              }}
              style={{
                position: 'relative',
                width: 44,
                height: 24,
                backgroundColor: settings.developerMode ? '#10b981' : '#3f3f46',
                borderRadius: 999,
                padding: '2px',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box'
              }}
            >
              <div style={{
                width: 20,
                height: 20,
                backgroundColor: '#ffffff',
                borderRadius: '50%',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                transform: settings.developerMode ? 'translateX(20px)' : 'translateX(0px)',
                transition: 'transform 0.2s ease'
              }} />
            </div>
          </div>

          {/* SYSTEM HEALTH SUMMARY */}
          <div style={{
            padding: '12px 16px',
            margin: '12px 16px 4px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px 8px',
            fontSize: '11px',
            flexShrink: 0
          }}>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>App Version</span>
              <span style={{ fontWeight: 800, color: '#fff' }}>v{APP_VERSION}</span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>Android Version</span>
              <span style={{ fontWeight: 800, color: '#fff' }}>{otaDiagnostics.androidVersion || 'N/A'}</span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>Device</span>
              <span style={{ fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }} title={otaDiagnostics.deviceModel || 'Browser'}>
                {otaDiagnostics.deviceModel || 'Browser'}
              </span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>Theme</span>
              <span style={{ fontWeight: 800, color: '#fff' }}>{settings.theme === 'light' ? 'Light' : 'Dark'}</span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>Developer Mode</span>
              <span style={{ fontWeight: 800, color: settings.developerMode ? '#10b981' : '#ef4444' }}>
                {settings.developerMode ? 'ON' : 'OFF'}
              </span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>Errors / Warnings</span>
              <span style={{ fontWeight: 800, color: errorCount > 0 ? '#ef4444' : warningCount > 0 ? '#f59e0b' : '#10b981' }}>
                {errorCount} E / {warningCount} W
              </span>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>Stagex Status</span>
              <span style={{
                fontWeight: 800,
                color: stagexStatus === 'Connected' ? '#10b981' : stagexStatus === 'Broken' ? '#ef4444' : '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: stagexStatus === 'Connected' ? '#10b981' : stagexStatus === 'Broken' ? '#ef4444' : '#f59e0b',
                  display: 'inline-block'
                }} />
                {stagexStatus}
              </span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 2 }}>OTA Status</span>
              <span style={{ fontWeight: 800, color: '#679cff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                {otaStatus}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {!settings.developerMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#ef4444', marginBottom: 16 }}>terminal</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Developer Mode is Disabled</h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', maxWidth: 280, lineHeight: 1.4, margin: 0 }}>
                  Toggle the status above to activate diagnostics tracking, capture logs, and view app-specific states.
                </p>
              </div>
            ) : (
              renderDashboardCards()
            )}
          </div>
        </>
      )}

      {subView === 'apps' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000000' }}>
          {renderSubViewHeader('Apps Diagnostics')}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {renderAppsView()}
          </div>
        </div>
      )}

      {subView === 'stagex' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000000' }}>
          {renderSubViewHeader('Stagex Diagnostics')}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {renderStagexView()}
          </div>
        </div>
      )}

      {subView === 'updater' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000000' }}>
          {renderSubViewHeader('Updater Diagnostics')}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {renderUpdaterView()}
          </div>
        </div>
      )}

      {subView === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000000' }}>
          {renderSubViewHeader('System Diagnostics')}
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: '#000000',
            scrollbarWidth: 'none'
          }}>
            <button style={tabBtnStyle('state')} onClick={() => setActiveTab('state')}>App Store State</button>
            <button style={tabBtnStyle('storage')} onClick={() => setActiveTab('storage')}>Storage</button>
            <button style={tabBtnStyle('providers')} onClick={() => setActiveTab('providers')}>Module Panels ({activeProviders.length})</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {activeTab === 'state' && renderStateTab()}
            {activeTab === 'storage' && renderStorageTab()}
            {activeTab === 'providers' && renderProvidersTab()}
          </div>
        </div>
      )}

      {subView === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000000' }}>
          {renderSubViewHeader('Logs & Warnings')}
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: '#000000',
            scrollbarWidth: 'none'
          }}>
            <button style={tabBtnStyle('logs')} onClick={() => setActiveTab('logs')}>Logs ({logs.length})</button>
            <button style={tabBtnStyle('errors')} onClick={() => setActiveTab('errors')}>Errors ({errors.length})</button>
            <button style={tabBtnStyle('events')} onClick={() => setActiveTab('events')}>Events ({events.length})</button>
            <button style={tabBtnStyle('nav')} onClick={() => setActiveTab('nav')}>Navigation Stack</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {activeTab === 'logs' && renderLogsTab()}
            {activeTab === 'errors' && renderErrorsTab()}
            {activeTab === 'events' && renderEventsTab()}
            {activeTab === 'nav' && renderNavTab()}
          </div>
        </div>
      )}

      {subView === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000000' }}>
          {renderSubViewHeader('Performance Diagnostics')}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {renderPerfTab()}
          </div>
        </div>
      )}

      {subView === 'network' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000000' }}>
          {renderSubViewHeader('Network Sniffer')}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {renderNetworkTab()}
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(12,12,14,0.95)',
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '10px 20px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 700,
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
          zIndex: 999999,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#10b981' }}>done</span>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
