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
  getStageIframe,
  getNavigationEntries,
  clearNavigationEntries,
  NavigationEntry,
  updaterSimulation,
  triggerSimulatedStatus,
  addJsLog,
  jsLogs,
  nativeLogs,
  stateTimeline,
  activityLifecycleTimeline,
  simulateStatusCallback,
  globalOtaState,
  resetOtaUpdateState,
  checkForUpdate,
  downloadUpdate,
  applyUpdate,
  deleteLocalApk,
  transitionHistory,
  rejectedTransitions,
  AppInstaller
} from '@workspace/studio-core';

interface Props {
  accent: { from: string; mid?: string; to: string };
  onBack: () => void;
}

type TabId = 'logs' | 'errors' | 'events' | 'perf' | 'state' | 'nav' | 'network' | 'storage' | 'providers';

interface WarningItem {
  id: string;
  timestamp: number;
  module: string;
  severity: string;
  title: string;
  message: string;
  source: string;
  duplicateCount: number;
}

interface WarningsInspectorProps {
  logs: any[];
  showToast: (msg: string) => void;
  moduleFilter?: string[];
  appKey?: string;
}

const WarningsInspector = ({ logs, showToast, moduleFilter, appKey }: WarningsInspectorProps) => {
  const [showWarnings, setShowWarnings] = useState(false);

  const appWarnings = useMemo(() => {
    return logs.filter(l => {
      if (l.level !== 'warn') return false;
      const mod = l.module.toLowerCase();
      
      if (appKey) {
        if (appKey === 'chords') return mod === 'chordex';
        if (appKey === 'drums') return mod === 'drumex' || mod === 'drums';
        if (appKey === 'stage') return mod === 'stagex' || mod === 'stage';
        if (appKey === 'groovex') return mod === 'groovex';
        if (appKey === 'vocalex') return mod === 'vocalex';
        if (appKey === 'hub') {
          return !['chordex', 'drumex', 'drums', 'stagex', 'stage', 'groovex', 'vocalex', 'network', 'firestore', 'sync'].includes(mod);
        }
        return false;
      }

      if (moduleFilter) {
        return moduleFilter.some(m => m.toLowerCase() === mod);
      }

      return true;
    });
  }, [logs, moduleFilter, appKey]);

  const groupedWarnings = useMemo<WarningItem[]>(() => {
    const groups: WarningItem[] = [];

    appWarnings.forEach(w => {
      const existing = groups.find(g => g.message === w.message && g.module === w.module);
      if (existing) {
        existing.duplicateCount += 1;
        if (w.timestamp > existing.timestamp) {
          existing.timestamp = w.timestamp;
        }
      } else {
        const title = w.message.split('\n')[0].substring(0, 80);
        groups.push({
          id: w.id || Math.random().toString(36).substring(2, 9),
          timestamp: w.timestamp,
          module: w.module,
          severity: w.level || 'warn',
          title,
          message: w.message,
          source: w.source || 'unknown',
          duplicateCount: 1
        });
      }
    });

    return groups;
  }, [appWarnings]);

  if (appWarnings.length === 0) {
    if (appKey === 'hub') {
      return (
        <div style={{
          marginTop: 12,
          background: 'rgba(16, 185, 129, 0.03)',
          border: '1px solid rgba(16, 185, 129, 0.15)',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 18 }}>check_circle</span>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>
            No warnings
          </span>
        </div>
      );
    }
    return null;
  }

  const handleCopyWarning = (w: WarningItem) => {
    navigator.clipboard.writeText(`[${w.module}] [${w.source}] ${w.message}`)
      .then(() => showToast('Warning copied!'))
      .catch(() => showToast('Copy failed.'));
  };

  const handleCopyAll = () => {
    const text = appWarnings.map(w => `[${new Date(w.timestamp).toISOString()}] [${w.module}] [${w.level.toUpperCase()}] [${w.source || 'unknown'}] ${w.message}`).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => showToast('All warnings copied!'))
      .catch(() => showToast('Copy failed.'));
  };

  return (
    <div style={{
      marginTop: 12,
      background: 'rgba(245, 158, 11, 0.03)',
      border: '1px solid rgba(245, 158, 11, 0.15)',
      borderRadius: '12px',
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: 18 }}>warning</span>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#f59e0b' }}>
            {appWarnings.length} Warnings Detected
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowWarnings(!showWarnings);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowWarnings(!showWarnings);
          }}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            color: '#f59e0b',
            fontWeight: 700,
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          {showWarnings ? 'Hide Warnings' : 'View Warnings'}
        </button>
      </div>

      {showWarnings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyAll();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCopyAll();
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Copy All Warnings
            </button>
          </div>
          
          <div style={{
            maxHeight: 200,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            paddingRight: 4
          }}>
            {groupedWarnings.map((w, idx) => (
              <div key={w.id || idx} style={{
                padding: '8px 10px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.04)',
                fontSize: '11px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      color: '#f59e0b',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '9px'
                    }}>{w.severity.toUpperCase()}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                      Module: {w.module}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
                      Source: {w.source}
                    </span>
                    {w.duplicateCount > 1 && (
                      <span style={{
                        background: 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '9px'
                      }}>
                        ×{w.duplicateCount}
                      </span>
                    )}
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px' }}>
                    {new Date(w.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                <div style={{
                  color: '#f59e0b',
                  fontWeight: 700,
                  fontSize: '11.5px',
                  marginTop: 2
                }}>
                  {w.title}
                </div>

                <div style={{
                  color: '#fff',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.3,
                  fontFamily: 'monospace',
                  marginTop: 2
                }}>
                  {w.message}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyWarning(w);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyWarning(w);
                    }}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '9px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Copy Warning
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function DevToolsDashboard({ accent, onBack }: Props) {
  const { settings, updateSettings, activePanel } = useChordStore();
  const [subView, setSubView] = useState<'dashboard' | 'stagex' | 'updater' | 'system' | 'logs' | 'performance' | 'network' | 'apps'>('dashboard');
  const [activeTab, setActiveTab] = useState<TabId>('logs');
  const lastAppRef = useRef<string>('Livex Hub');
  const [versionUpdates, setVersionUpdates] = useState(0);

  const [expandedLogIndices, setExpandedLogIndices] = useState<Record<number, boolean>>({});
  const [updaterTabMode, setUpdaterTabMode] = useState<'laboratory' | 'diagnostics'>('laboratory');

  const [diagExceptionCollapsed, setDiagExceptionCollapsed] = useState(true);
  const [stateHistoryCollapsed, setStateHistoryCollapsed] = useState(true);
  const [buttonStates, setButtonStates] = useState<Record<string, 'idle' | 'running' | 'success' | 'failure'>>({});
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const [nativeInstallerDetails, setNativeInstallerDetails] = useState<any>(null);
  const [nativeDeviceInfo, setNativeDeviceInfo] = useState<any>(null);
  const [localApkDetails, setLocalApkDetails] = useState<any>(null);
  const [nativeLogsList, setNativeLogsList] = useState<any[]>([]);
  const [simUpdateCount, setSimUpdateCount] = useState(0);
  const triggerSimRender = () => setSimUpdateCount(prev => prev + 1);

  useEffect(() => {
    if (updaterTabMode === 'laboratory') {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simUpdateCount, updaterTabMode]);

  useEffect(() => {
    if (subView !== 'updater') return;

    let active = true;

    const refreshData = async () => {
      try {
        if (isNative() && typeof AppInstaller !== 'undefined') {
          // 1. Get Device Info
          const dev = await AppInstaller.getDeviceInfo();
          if (active) setNativeDeviceInfo(dev);

          // 2. Get PackageInstaller Details
          if (typeof AppInstaller.getExtendedDiagnostics === 'function') {
            const det = await AppInstaller.getExtendedDiagnostics();
            if (active) setNativeInstallerDetails(det);
          } else if (typeof (AppInstaller as any).getPackageInstallerDetails === 'function') {
            const det = await (AppInstaller as any).getPackageInstallerDetails();
            if (active) setNativeInstallerDetails(det);
          }

          // 3. Get Installer Log History
          if (typeof AppInstaller.getInstallerLogHistory === 'function') {
            const historyRes = await AppInstaller.getInstallerLogHistory();
            if (active && historyRes && historyRes.logs) {
              try {
                const parsedLogs = JSON.parse(historyRes.logs);
                setNativeLogsList(Array.isArray(parsedLogs) ? parsedLogs : []);
              } catch (e) {
                console.warn('Failed to parse installer log history:', e);
              }
            }
          }

          // 4. Get File details for downloaded APK if exists
          const path = localStorage.getItem('studio:downloadedApkPath');
          if (path) {
            try {
              if (typeof AppInstaller.inspectApk === 'function') {
                const apkDet = await AppInstaller.inspectApk({ filePath: path });
                if (active) setLocalApkDetails(apkDet);
              }
            } catch (err) {
              console.warn('Failed to inspect APK:', err);
            }
          } else {
            if (active) setLocalApkDetails(null);
          }
        }
      } catch (err) {
        console.warn('Failed to refresh updater diagnostics:', err);
      }
    };

    refreshData();
    const timer = setInterval(refreshData, 2000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [subView]);

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

  // Render Inline Updater Diagnostics & Laboratory View
  const renderUpdaterView = () => {
    const handleCopyText = (text: string, label: string) => {
      navigator.clipboard.writeText(text)
        .then(() => showToast(`${label} copied to clipboard!`))
        .catch(() => showToast('Copy failed.'));
    };

    const executeLabAction = async (actionId: string, actionName: string, fn: () => Promise<any>) => {
      setButtonStates(prev => ({ ...prev, [actionId]: 'running' }));
      addJsLog(`[Action Started] ${actionName}`);
      triggerSimRender();
      const start = Date.now();
      try {
        const res = await fn();
        const duration = Date.now() - start;
        setButtonStates(prev => ({ ...prev, [actionId]: 'success' }));
        addJsLog(`[Action Success] ${actionName} completed in ${duration}ms. Result: ${typeof res === 'object' ? JSON.stringify(res) : String(res || 'OK')}`);
        triggerSimRender();
        showToast(`${actionName} Succeeded`);
        setTimeout(() => {
          setButtonStates(prev => ({ ...prev, [actionId]: 'idle' }));
          triggerSimRender();
        }, 2000);
      } catch (err: any) {
        const duration = Date.now() - start;
        setButtonStates(prev => ({ ...prev, [actionId]: 'failure' }));
        addJsLog(`[Action Failure] ${actionName} failed after ${duration}ms. Error: ${err?.message || err}`);
        triggerSimRender();
        showToast(`${actionName} Failed: ${err?.message || err}`);
        setTimeout(() => {
          setButtonStates(prev => ({ ...prev, [actionId]: 'idle' }));
          triggerSimRender();
        }, 3000);
      }
    };

    const renderLabButton = (label: string, actionId: string, onClick: () => Promise<any> | any, variant: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary' = 'secondary', disabled = false) => {
      const state = buttonStates[actionId] || 'idle';
      
      let bg = 'rgba(255, 255, 255, 0.05)';
      let border = '1px solid rgba(255, 255, 255, 0.08)';
      let color = 'rgba(255, 255, 255, 0.85)';
      let icon = '';
      
      if (state === 'running') {
        bg = 'rgba(59, 130, 246, 0.2)';
        border = '1px solid #3b82f6';
        color = '#60a5fa';
        icon = 'sync';
      } else if (state === 'success') {
        bg = 'rgba(16, 185, 129, 0.2)';
        border = '1px solid #10b981';
        color = '#34d399';
        icon = 'check_circle';
      } else if (state === 'failure') {
        bg = 'rgba(239, 68, 68, 0.2)';
        border = '1px solid #ef4444';
        color = '#f87171';
        icon = 'error';
      } else {
        if (variant === 'primary') {
          bg = 'rgba(59, 130, 246, 0.12)';
          border = '1px solid rgba(59, 130, 246, 0.25)';
          color = '#93c5fd';
        } else if (variant === 'success') {
          bg = 'rgba(16, 185, 129, 0.12)';
          border = '1px solid rgba(16, 185, 129, 0.25)';
          color = '#6ee7b7';
        } else if (variant === 'warning') {
          bg = 'rgba(245, 158, 11, 0.12)';
          border = '1px solid rgba(245, 158, 11, 0.25)';
          color = '#fde047';
        } else if (variant === 'danger') {
          bg = 'rgba(239, 68, 68, 0.12)';
          border = '1px solid rgba(239, 68, 68, 0.25)';
          color = '#fca5a5';
        } else if (variant === 'info') {
          bg = 'rgba(6, 182, 212, 0.12)';
          border = '1px solid rgba(6, 182, 212, 0.25)';
          color = '#67e8f9';
        }
      }

      return (
        <button
          key={actionId}
          disabled={disabled || state === 'running'}
          onClick={() => {
            const result = onClick();
            if (result && typeof result.then === 'function') {
              executeLabAction(actionId, label, () => result);
            } else {
              executeLabAction(actionId, label, async () => result);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 10px',
            borderRadius: 8,
            background: bg,
            border: border,
            color: color,
            fontWeight: 700,
            fontFamily: 'Manrope',
            fontSize: '11px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            opacity: disabled ? 0.4 : 1,
            minHeight: '36px',
          }}
        >
          {icon && (
            <span 
              className="material-symbols-outlined" 
              style={{ 
                fontSize: 14, 
                animation: icon === 'sync' ? 'spin 1s linear infinite' : 'none',
                display: 'inline-block'
              }}
            >
              {icon}
            </span>
          )}
          {label}
        </button>
      );
    };

    const unifiedTimeline = getUnifiedTimeline();

    function getUnifiedTimeline() {
      const list: Array<{ time: number; type: 'js' | 'native' | 'state'; text: string; details?: string }> = [];
      
      jsLogs.forEach(log => {
        list.push({ time: log.timestamp, type: 'js', text: log.message });
      });

      nativeLogsList.forEach(log => {
        const time = log.timestamp || Date.now();
        list.push({
          time,
          type: 'native',
          text: log.stage || 'Native Step',
          details: `${log.message || ''} ${log.explanation || ''}`
        });
      });

      stateTimeline.forEach(t => {
        list.push({
          time: t.timestamp,
          type: 'state',
          text: `State Transition: ${t.state}`,
          details: `Reason: ${t.reason}`
        });
      });

      list.sort((a, b) => a.time - b.time);
      return list;
    }

    const exportTimelineMarkdown = () => {
      let md = `# Unified Chronological Timeline\n\n| Type | Timestamp | Event / Details |\n|---|---|---|\n`;
      unifiedTimeline.forEach(e => {
        const timeStr = new Date(e.time).toLocaleTimeString();
        md += `| **${e.type.toUpperCase()}** | ${timeStr} | ${e.text} ${e.details ? `(${e.details})` : ''} |\n`;
      });
      handleCopyText(md, 'Timeline Markdown');
    };

    const exportCompleteTimelineJSON = () => {
      handleCopyText(JSON.stringify(unifiedTimeline, null, 2), 'Unified Timeline JSON');
    };

    const exportCompleteTimelineText = () => {
      let txt = `=== UNIFIED CHRONOLOGICAL TIMELINE ===\n`;
      unifiedTimeline.forEach(e => {
        const timeStr = new Date(e.time).toLocaleTimeString();
        txt += `[${timeStr}] [${e.type.toUpperCase()}] ${e.text} ${e.details ? ` - ${e.details}` : ''}\n`;
      });
      handleCopyText(txt, 'Timeline Plain Text');
    };

    const exportEngineeringReport = async () => {
      const diag = getAutoDiagnostics();
      const devInfo = nativeDeviceInfo || {};
      let report = `# UPDATER ENGINEERING REPORT\n`;
      report += `Generated: ${new Date().toLocaleString()}\n`;
      report += `Current Version: ${APP_VERSION}\n\n`;
      
      report += `## Diagnostic Summary\n`;
      if (diag) {
        report += `* **Failed Stage:** ${diag.failedStage}\n`;
        report += `* **Error/Reason:** ${diag.reason}\n`;
        report += `* **Suggested Root Cause:** ${diag.suggestedCause}\n`;
        report += `* **Suggested Fix:** ${diag.suggestedFix}\n\n`;
      } else {
        report += `No active errors detected. All systems nominal.\n\n`;
      }

      report += `## Device & Context Telemetry\n`;
      report += `* **SDK Version:** ${devInfo.sdkInt || 'N/A'}\n`;
      report += `* **Manufacturer/Model:** ${devInfo.manufacturer || 'N/A'} ${devInfo.model || 'N/A'}\n`;
      report += `* **Locale:** ${devInfo.deviceLocale || 'N/A'}\n`;
      report += `* **Storage State:** ${devInfo.storageAvailable || 'N/A'}\n`;
      report += `* **Unknown Sources Allowed:** ${devInfo.canRequestPackageInstalls ? 'YES' : 'NO'}\n`;
      report += `* **Installer Package:** ${devInfo.installerPackage || 'Unknown'}\n\n`;

      report += `## PackageInstaller Session Metrics\n`;
      report += `* **Active Session ID:** ${nativeInstallerDetails?.sessionId ?? -1}\n`;
      report += `* **Session State:** ${nativeInstallerDetails?.sessionState || 'None'}\n`;
      report += `* **Last Native Code:** ${nativeInstallerDetails?.lastStatusCode ?? -999}\n`;
      report += `* **Last Native Message:** ${nativeInstallerDetails?.lastStatusMessage || 'N/A'}\n\n`;

      report += `## State Transition History\n`;
      transitionHistory.forEach(t => {
        report += `* ${new Date(t.timestamp).toLocaleTimeString()}: ${t.from} -> ${t.to} (${t.reason}) [Duration: ${t.durationMs}ms] ${t.invalid ? '(INVALID)' : ''}\n`;
      });
      
      report += `\n=== END OF REPORT ===`;
      handleCopyText(report, 'Complete Engineering Report');
    };

    const diag = getAutoDiagnostics();

    function getAutoDiagnostics() {
      const err = globalOtaState.error || otaDebugLogs.installError;
      const status = nativeInstallerDetails?.lastStatusCode ?? -999;
      
      if (!err && status === -999) return null;

      let failedStage = 'Unknown';
      let reason = err || 'An error occurred during update processing.';
      let suggestedCause = 'Underlying native session failed to commit or start confirmation activity.';
      let suggestedFix = 'Please reset the state completely, check internet connectivity, and ensure unknown sources permission is granted.';

      const errStr = String(err).toLowerCase();
      
      if (errStr.includes('download') || (globalOtaState.updateState as string) === 'download_failed') {
        failedStage = 'Downloading';
        reason = err || 'Download failed or timed out.';
        suggestedCause = 'Network connectivity issues, unresolvable download server URL, or file system storage access denied.';
        suggestedFix = 'Ensure your internet connection is active, try clean cache, or select custom backup APK mirror.';
      } else if (errStr.includes('sha') || (globalOtaState.updateState as string) === 'sha_failed') {
        failedStage = 'Verification (SHA-256)';
        reason = err || 'SHA-256 checksum validation failed.';
        suggestedCause = 'The downloaded APK does not match the expected SHA-256 hash. The download might be corrupted or incomplete.';
        suggestedFix = 'Retry the download, or toggle Force SHA Failure off. Check if CDN caches old versions.';
      } else if (errStr.includes('eligibility') || (globalOtaState.updateState as string) === 'eligibility_failed') {
        failedStage = 'Pre-install Eligibility Verification';
        reason = err || 'The system declared the package ineligible.';
        suggestedCause = otaDebugLogs.eligibilityReason === 'signature_mismatch'
          ? 'Signature mismatch: The downloaded APK is signed with a different key than the installed app.'
          : otaDebugLogs.eligibilityReason === 'versionCode_low'
          ? 'Version downgrade: The remote versionCode is lower than the local one.'
          : 'Incompatible platform, architecture ABI mismatch, or corrupted APK package parsing error.';
        suggestedFix = otaDebugLogs.eligibilityReason === 'signature_mismatch'
          ? 'A full clean reinstall is required (uninstall current app manually first to avoid signature conflict).'
          : 'Enable downgrade options inside simulator, or perform a clean manual install.';
      } else if (status !== -999) {
        failedStage = 'Native PackageInstaller Handoff';
        if (status === 3) {
          reason = 'User Cancelled (STATUS_FAILURE_ABORTED)';
          suggestedCause = 'User clicked "Cancel" on the system install confirmation screen.';
          suggestedFix = 'Rerun the update trigger and click "Update" instead of "Cancel".';
        } else if (status === 5) {
          reason = 'Signature Conflict (STATUS_FAILURE_CONFLICT)';
          suggestedCause = 'System blocked package installation because the new APK signature does not match the previously installed signature.';
          suggestedFix = 'Manually uninstall the app, then retry to perform a clean install.';
        } else if (status === 7) {
          reason = 'Downgrade Blocked (STATUS_FAILURE_INCOMPATIBLE)';
          suggestedCause = 'The system blocks installing an APK with a lower versionCode than the current app.';
          suggestedFix = 'Ensure the new update version has a higher versionCode, or perform a manual clean install.';
        } else if (status === 6) {
          reason = 'Storage Full (STATUS_FAILURE_STORAGE)';
          suggestedCause = 'The device has insufficient available flash storage memory to install the APK package.';
          suggestedFix = 'Free up space in the device storage and retry.';
        } else if (status === 2) {
          reason = 'Blocked by System Policy (STATUS_FAILURE_BLOCKED)';
          suggestedCause = 'System security settings or administrator policies block unknown sources installations.';
          suggestedFix = 'Open Android unknown app sources settings and explicitly grant install permissions to Studio.';
        } else {
          reason = `PackageInstaller code ${status}: ${nativeInstallerDetails?.lastStatusMessage || 'Unknown error'}`;
          suggestedCause = 'The PackageInstaller subsystem returned a system exception during commit execution.';
          suggestedFix = 'Re-try the installation or inspect native device logs via ADB/Diagnostics.';
        }
      }

      return {
        failedStage,
        reason,
        exceptionStack: otaDebugLogs.lastExceptionStackTrace || 'None',
        suggestedCause,
        suggestedFix
      };
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 8 }}>
          <button
            onClick={() => setUpdaterTabMode('laboratory')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 6,
              background: updaterTabMode === 'laboratory' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: updaterTabMode === 'laboratory' ? '#fff' : 'rgba(255,255,255,0.4)',
              border: 'none',
              fontFamily: 'Manrope',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Updater Laboratory
          </button>
          <button
            onClick={() => setUpdaterTabMode('diagnostics')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 6,
              background: updaterTabMode === 'diagnostics' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: updaterTabMode === 'diagnostics' ? '#fff' : 'rgba(255,255,255,0.4)',
              border: 'none',
              fontFamily: 'Manrope',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Diagnostics Dashboard
          </button>
        </div>

        {/* 0. AUTO-DIAGNOSTICS FAILURE DETECTED */}
        {diag && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontWeight: 800, fontSize: 13 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>emergency</span>
              Auto-Diagnostics Failure Detected
            </div>
            <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.4 }}>
              <div style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.1)', paddingBottom: 4, marginBottom: 4 }}>
                <strong>Failed Stage:</strong> <span style={{ color: '#ef4444' }}>{diag.failedStage}</span>
              </div>
              <div style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.1)', paddingBottom: 4, marginBottom: 4 }}>
                <strong>Reason:</strong> {diag.reason}
              </div>
              <div style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.1)', paddingBottom: 4, marginBottom: 4 }}>
                <strong>Suggested Cause:</strong> <span style={{ color: '#fbcfe8' }}>{diag.suggestedCause}</span>
              </div>
              <div>
                <strong>Suggested Fix:</strong> <span style={{ color: '#6ee7b7', fontWeight: 700 }}>{diag.suggestedFix}</span>
              </div>
            </div>
            {diag.exceptionStack && diag.exceptionStack !== 'None' && (
              <CollapsibleSection title="Show Exception Stack" collapsed={diagExceptionCollapsed} onToggle={() => setDiagExceptionCollapsed(!diagExceptionCollapsed)}>
                <pre style={{ fontSize: 9, color: '#fca5a5', background: 'rgba(0,0,0,0.4)', padding: 6, borderRadius: 6, overflowX: 'auto', margin: 0 }}>
                  {diag.exceptionStack}
                </pre>
              </CollapsibleSection>
            )}
          </div>
        )}

        {updaterTabMode === 'laboratory' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>

            {/* SECTION 1: Real Production Actions */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_circle</span>
                Production Pipeline Execution
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.45 }}>
                Run the actual production pipelines. These use real native functions, perform file operations, verify signatures, and trigger the system installer.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {renderLabButton('Trigger Download', 'download', async () => {
                  await downloadUpdate('Updater Lab');
                }, 'success')}
                {renderLabButton('Trigger Install', 'install', async () => {
                  await applyUpdate('Updater Lab');
                }, 'primary')}
                {renderLabButton('Run Production Flow', 'prodFlow', async () => {
                  const checkRes = await checkForUpdate(true);
                  if (checkRes.updateAvailable) {
                    await downloadUpdate('Prod Flow');
                    await applyUpdate('Prod Flow');
                  } else {
                    showToast('No update available to install.');
                  }
                }, 'success')}
                {renderLabButton('Run Full Pipeline', 'fullPipeline', async () => {
                  await checkForUpdate(true);
                  await downloadUpdate('Full Pipeline');
                  await applyUpdate('Full Pipeline');
                }, 'primary')}
              </div>
            </div>

            {/* SECTION 2: Update Simulation Controls */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#a855f7', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>science</span>
                Update State Simulation
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.45 }}>
                Force metadata outcomes on check. Clicking these sets the mock variables and executes `checkForUpdate` immediately to shift the state machine.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {renderLabButton('Force Update Available', 'forceAvail', async () => {
                  updaterSimulation.forceUpdateAvailable = true;
                  updaterSimulation.forceNoUpdate = false;
                  updaterSimulation.forceDowngrade = false;
                  await checkForUpdate(true);
                }, 'info')}
                {renderLabButton('Force No Update', 'forceNoUpdate', async () => {
                  updaterSimulation.forceUpdateAvailable = false;
                  updaterSimulation.forceNoUpdate = true;
                  updaterSimulation.forceDowngrade = false;
                  await checkForUpdate(true);
                }, 'info')}
                {renderLabButton('Force Downgrade (v3.7.10)', 'forceDown', async () => {
                  updaterSimulation.forceUpdateAvailable = false;
                  updaterSimulation.forceNoUpdate = false;
                  updaterSimulation.forceDowngrade = true;
                  await checkForUpdate(true);
                }, 'info')}
                {renderLabButton('Force Metadata Failure', 'forceMetaFail', async () => {
                  updaterSimulation.forceMetadataFailure = true;
                  await checkForUpdate(true);
                }, 'danger')}
                {renderLabButton('Force Mandatory', 'forceMandatory', async () => {
                  updaterSimulation.forceMandatoryUpdate = true;
                  updaterSimulation.forceOptionalUpdate = false;
                  await checkForUpdate(true);
                }, 'secondary')}
                {renderLabButton('Force Optional', 'forceOptional', async () => {
                  updaterSimulation.forceOptionalUpdate = true;
                  updaterSimulation.forceMandatoryUpdate = false;
                  await checkForUpdate(true);
                }, 'secondary')}
                {renderLabButton('Force APK Update', 'forceApk', async () => {
                  updaterSimulation.forceApkUpdate = true;
                  updaterSimulation.forceOtaUpdate = false;
                  await checkForUpdate(true);
                }, 'secondary')}
                {renderLabButton('Force OTA Update', 'forceOta', async () => {
                  updaterSimulation.forceOtaUpdate = true;
                  updaterSimulation.forceApkUpdate = false;
                  await checkForUpdate(true);
                }, 'secondary')}
              </div>
            </div>

            {/* SECTION 3: Failure & Recovery Injections */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bug_report</span>
                Failure & Recovery Injections
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.45 }}>
                Simulate failure states during download, verification, or recovery to test self-healing paths in the real updater pipeline.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {renderLabButton('Inject Download Failure', 'injectDownFail', () => {
                  updaterSimulation.forceDownloadFailure = true;
                  updaterSimulation.forceDownloadTimeout = false;
                }, 'danger')}
                {renderLabButton('Inject Connection Timeout', 'injectTimeout', () => {
                  updaterSimulation.forceDownloadTimeout = true;
                  updaterSimulation.forceDownloadFailure = false;
                }, 'danger')}
                {renderLabButton('Inject SHA Failure', 'injectShaFail', () => {
                  updaterSimulation.forceShaFailure = true;
                }, 'danger')}
                {renderLabButton('Inject Signature Conflict', 'injectSigConflict', () => {
                  updaterSimulation.forceSignatureMismatch = true;
                }, 'danger')}
                {renderLabButton('Inject Invalid APK', 'injectInvalidApk', () => {
                  updaterSimulation.forceInvalidApk = true;
                }, 'danger')}
                {renderLabButton('Force Recovery Mode', 'forceRecovery', async () => {
                  updaterSimulation.forceRecoveryMode = true;
                  await checkForUpdate(true);
                }, 'warning')}
                {renderLabButton('Force Valid Cached APK', 'forceCached', () => {
                  updaterSimulation.forceCachedApk = true;
                }, 'warning')}
                {renderLabButton('Force Resume Mode', 'forceResume', () => {
                  updaterSimulation.forceResumeDownload = true;
                }, 'warning')}
                {renderLabButton('Clear All Simulations', 'clearSims', async () => {
                  updaterSimulation.forceUpdateAvailable = false;
                  updaterSimulation.forceNoUpdate = false;
                  updaterSimulation.forceDowngrade = false;
                  updaterSimulation.forceMandatoryUpdate = false;
                  updaterSimulation.forceOptionalUpdate = false;
                  updaterSimulation.forceApkUpdate = false;
                  updaterSimulation.forceOtaUpdate = false;
                  updaterSimulation.forceMetadataFailure = false;
                  updaterSimulation.forceShaFailure = false;
                  updaterSimulation.forceSignatureMismatch = false;
                  updaterSimulation.forceInvalidApk = false;
                  updaterSimulation.forceDownloadFailure = false;
                  updaterSimulation.forceDownloadTimeout = false;
                  updaterSimulation.forceRecoveryMode = false;
                  updaterSimulation.forceCachedApk = false;
                  updaterSimulation.forceResumeDownload = false;
                  updaterSimulation.forceInstallSuccess = false;
                  updaterSimulation.forceInstallFailure = false;
                  updaterSimulation.forceUserCancel = false;
                  updaterSimulation.forcePendingUserAction = false;
                  await checkForUpdate(true);
                }, 'primary')}
              </div>
            </div>

            {/* SECTION 4: PackageInstaller Native Mocking */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#f97316', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>terminal</span>
                PackageInstaller Native Mocks
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.45 }}>
                Simulate native PackageInstaller callbacks sent from Android OS to JS during the session install flow.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {renderLabButton('Force Pending User', 'mockPending', () => {
                  updaterSimulation.forceInstallSuccess = false;
                  updaterSimulation.forceInstallFailure = false;
                  updaterSimulation.forceUserCancel = false;
                  updaterSimulation.forcePendingUserAction = true;
                  triggerSimulatedStatus(-1, 'STATUS_PENDING_USER_ACTION');
                }, 'warning')}
                {renderLabButton('Force Success (0)', 'mockSuccess', () => {
                  updaterSimulation.forceInstallSuccess = true;
                  updaterSimulation.forceInstallFailure = false;
                  updaterSimulation.forceUserCancel = false;
                  updaterSimulation.forcePendingUserAction = false;
                  triggerSimulatedStatus(0, 'STATUS_SUCCESS');
                }, 'success')}
                {renderLabButton('Force Fail (1)', 'mockFail', () => {
                  updaterSimulation.forceInstallSuccess = false;
                  updaterSimulation.forceInstallFailure = true;
                  updaterSimulation.forceUserCancel = false;
                  updaterSimulation.forcePendingUserAction = false;
                  triggerSimulatedStatus(1, 'STATUS_FAILURE');
                }, 'danger')}
                {renderLabButton('Force Cancel (3)', 'mockCancel', () => {
                  updaterSimulation.forceInstallSuccess = false;
                  updaterSimulation.forceInstallFailure = false;
                  updaterSimulation.forceUserCancel = true;
                  updaterSimulation.forcePendingUserAction = false;
                  triggerSimulatedStatus(3, 'STATUS_FAILURE_ABORTED');
                }, 'danger')}
              </div>
            </div>

            {/* SECTION 5: Advanced Engineering Tools */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>build</span>
                Advanced Engineering Tools
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {renderLabButton('Replay Last Install', 'replayInstall', async () => {
                  const lastPath = localStorage.getItem('studio:downloadedApkPath') || '';
                  if (!lastPath) throw new Error('No downloaded APK path found in storage.');
                  await applyUpdate('Replay Last Installation');
                }, 'info')}
                {renderLabButton('Replay Last Failure', 'replayFail', () => {
                  const err = otaDebugLogs.installError || localStorage.getItem('studio:lastError') || 'No recorded failures';
                  addJsLog(`[Replay Failure] Last error: ${err}`);
                }, 'info')}
                {renderLabButton('Open Cached APK', 'openApk', async () => {
                  const lastPath = localStorage.getItem('studio:downloadedApkPath') || '';
                  if (!lastPath) throw new Error('No downloaded APK path found.');
                  if (isNative()) {
                    const { Share } = await import('@capacitor/share');
                    await Share.share({ title: 'Cached APK', url: lastPath.startsWith('file://') ? lastPath : `file://${lastPath}` });
                  } else {
                    addJsLog(`[Open Cached APK] Mock browser path: ${lastPath}`);
                  }
                }, 'info')}
                {renderLabButton('Inspect Downloaded APK', 'inspectApk', async () => {
                  const lastPath = localStorage.getItem('studio:downloadedApkPath') || '';
                  if (!lastPath) throw new Error('No downloaded APK path found.');
                  if (isNative()) {
                    const details = await AppInstaller.inspectApk({ filePath: lastPath });
                    addJsLog(`[Inspect APK] Result: ${JSON.stringify(details)}`);
                    setLocalApkDetails(details);
                  } else {
                    addJsLog('[Inspect APK] Mock environment: verified valid com.chordex.app APK.');
                  }
                }, 'info')}
                {renderLabButton('Verify SHA Again', 'verifyShaAgain', async () => {
                  const lastPath = localStorage.getItem('studio:downloadedApkPath') || '';
                  if (!lastPath) throw new Error('No downloaded APK path found.');
                  if (isNative()) {
                    const expected = globalOtaState.apkSha256 || 'unknown';
                    const result = await AppInstaller.verifyApkSha256({ filePath: lastPath, expectedHash: expected });
                    addJsLog(`[Verify SHA] Expected: ${expected}. Matches: ${result.matches}`);
                  } else {
                    addJsLog('[Verify SHA] Mock environment: SHA matches expected hash.');
                  }
                }, 'info')}
                {renderLabButton('Re-run Eligibility', 'runEligAgain', async () => {
                  const lastPath = localStorage.getItem('studio:downloadedApkPath') || '';
                  if (!lastPath) throw new Error('No downloaded APK path found.');
                  if (isNative()) {
                    const { runEligibilityCheck } = await import('@workspace/studio-core');
                    const ok = await runEligibilityCheck(lastPath, false);
                    addJsLog(`[Re-run Eligibility] Result: ${ok}`);
                  } else {
                    addJsLog('[Re-run Eligibility] Mock environment: Eligibility Passed.');
                  }
                }, 'info')}
                {renderLabButton('Launch Install Intent', 'launchIntent', async () => {
                  const lastPath = localStorage.getItem('studio:downloadedApkPath') || '';
                  if (!lastPath) throw new Error('No downloaded APK path found.');
                  if (isNative()) {
                    await AppInstaller.installApkDirect({ filePath: lastPath });
                  } else {
                    addJsLog('[Launch Install Intent] Mock intent launch.');
                  }
                }, 'info')}
                {renderLabButton('Restart Session', 'restartSession', async () => {
                  await AppInstaller.clearInstallerLogHistory();
                  resetOtaUpdateState();
                  addJsLog('[Restart Session] Active installer sessions and JS states reset.');
                }, 'info')}
              </div>
            </div>

            {/* SECTION 6: Clipboard Exporters */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#ec4899', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>content_copy</span>
                Clipboard Exporters
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {renderLabButton('Export Native Logs', 'expNatLogs', async () => {
                  let txt = '=== NATIVE LOGS ===\n';
                  nativeLogs.forEach(log => {
                    txt += `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}\n`;
                  });
                  await handleCopyText(txt, 'Native Logs');
                }, 'secondary')}
                {renderLabButton('Export JS Logs', 'expJsLogs', async () => {
                  let txt = '=== JS LOGS ===\n';
                  jsLogs.forEach(log => {
                    txt += `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}\n`;
                  });
                  await handleCopyText(txt, 'JS Logs');
                }, 'secondary')}
                {renderLabButton('Export Timeline', 'expTimeline', async () => {
                  let txt = `=== UNIFIED TIMELINE ===\n`;
                  unifiedTimeline.forEach(e => {
                    const timeStr = new Date(e.time).toLocaleTimeString();
                    txt += `[${timeStr}] [${e.type.toUpperCase()}] ${e.text} ${e.details ? ` - ${e.details}` : ''}\n`;
                  });
                  await handleCopyText(txt, 'Timeline');
                }, 'secondary')}
                {renderLabButton('Export Diagnostics', 'expDiag', async () => {
                  await handleCopyText(JSON.stringify(otaDiagnostics, null, 2), 'Diagnostics');
                }, 'secondary')}
                {renderLabButton('Copy Engineering Report', 'expReport', async () => {
                  await exportEngineeringReport();
                }, 'secondary')}
                {renderLabButton('Copy PackageInstaller Events', 'expPkgInst', async () => {
                  let txt = '=== PACKAGE INSTALLER EVENTS ===\n';
                  nativeLogsList.forEach(log => {
                    txt += `[${log.stage}] Status: ${log.status} - Message: ${log.message}\n`;
                  });
                  await handleCopyText(txt, 'PackageInstaller Events');
                }, 'secondary')}
                {renderLabButton('Copy Activity Lifecycle', 'expLifecycle', async () => {
                  let txt = '=== ACTIVITY LIFECYCLE TIMELINE ===\n';
                  activityLifecycleTimeline.forEach(a => {
                    txt += `[${new Date(a.timestamp).toLocaleTimeString()}] Stage: ${a.stage}\n`;
                  });
                  await handleCopyText(txt, 'Activity Lifecycle');
                }, 'secondary')}
                {renderLabButton('Copy State Machine', 'expStateMach', async () => {
                  let txt = '=== STATE MACHINE TRANSITIONS ===\n';
                  transitionHistory.forEach(t => {
                    txt += `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.from} -> ${t.to} (${t.reason})\n`;
                  });
                  await handleCopyText(txt, 'State Machine Transitions');
                }, 'secondary')}
                {renderLabButton('Copy Current Metadata', 'expMeta', async () => {
                  await handleCopyText(JSON.stringify(globalOtaState, null, 2), 'Current Metadata');
                }, 'secondary')}
                {renderLabButton('Copy APK Metadata', 'expApkMeta', async () => {
                  await handleCopyText(JSON.stringify(localApkDetails || {}, null, 2), 'APK Metadata');
                }, 'secondary')}
                {renderLabButton('Copy Device Information', 'expDeviceInfo', async () => {
                  await handleCopyText(JSON.stringify(nativeDeviceInfo || {}, null, 2), 'Device Information');
                }, 'secondary')}
                {renderLabButton('Copy Full Timeline', 'expFullTimeline', async () => {
                  let txt = `=== FULL UNIFIED TIMELINE ===\n`;
                  unifiedTimeline.forEach(e => {
                    const timeStr = new Date(e.time).toLocaleTimeString();
                    txt += `[${timeStr}] [${e.type.toUpperCase()}] ${e.text} ${e.details ? ` - ${e.details}` : ''}\n`;
                  });
                  await handleCopyText(txt, 'Full Timeline');
                }, 'secondary')}
              </div>
            </div>

            {/* SECTION 7: Live Execution Console */}
            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
                  Live Execution Console
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => {
                      jsLogs.length = 0;
                      nativeLogsList.length = 0;
                      stateTimeline.length = 0;
                      triggerSimRender();
                      showToast('Console cleared.');
                    }}
                    style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      let txt = `=== LIVE CONSOLE LOGS ===\n`;
                      getUnifiedTimeline().forEach(e => {
                        const timeStr = new Date(e.time).toLocaleTimeString();
                        txt += `[${timeStr}] [${e.type.toUpperCase()}] ${e.text} ${e.details ? ` - ${e.details}` : ''}\n`;
                      });
                      navigator.clipboard.writeText(txt).then(() => showToast('Logs copied!'));
                    }}
                    style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Copy Logs
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 }}>
                {unifiedTimeline.length === 0 ? (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', padding: '10px 0' }}>
                    Console idle. Execute an action to begin stream.
                  </div>
                ) : (
                  unifiedTimeline.map((e, idx) => {
                    const timeStr = new Date(e.time).toLocaleTimeString();
                    let color = '#34d399'; // js
                    if (e.type === 'native') color = '#fbbf24';
                    if (e.type === 'state') color = '#60a5fa';
                    return (
                      <div key={idx} style={{ fontFamily: 'monospace', fontSize: 9.5, borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: 2, textAlign: 'left', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>[{timeStr}]</span>{' '}
                        <span style={{ color, fontWeight: 700 }}>[{e.type.toUpperCase()}]</span>{' '}
                        <span style={{ color: '#fff' }}>{e.text}</span>
                        {e.details && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>({e.details})</span>}
                      </div>
                    );
                  })
                )}
                <div ref={consoleEndRef} />
              </div>
            </div>

            {/* Section 8: Reset controls */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>restart_alt</span>
                Reset & Diagnostics Clears
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                <button
                  onClick={() => {
                    resetOtaUpdateState();
                    showToast('State machine reset to IDLE.');
                  }}
                  style={{ padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  Reset State Machine
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('studio:consecutiveFailures');
                    localStorage.removeItem('studio:recoveryMode');
                    showToast('Recovery variables cleared.');
                  }}
                  style={{ padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  Clear Recovery Flags
                </button>
                <button
                  onClick={async () => {
                    const ver = globalOtaState.remoteVersion || '3.7.99';
                    await deleteLocalApk(ver);
                    showToast('Deleted cached update APKs.');
                  }}
                  style={{ padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  Delete Cached APK
                </button>
                <button
                  onClick={async () => {
                    const ver = globalOtaState.remoteVersion || '3.7.99';
                    resetOtaUpdateState();
                    await deleteLocalApk(ver);
                    localStorage.removeItem('studio:consecutiveFailures');
                    localStorage.removeItem('studio:recoveryMode');
                    localStorage.removeItem('studio:downloadedApkPath');
                    jsLogs.length = 0;
                    nativeLogsList.length = 0;
                    stateTimeline.length = 0;
                    transitionHistory.length = 0;
                    rejectedTransitions.length = 0;
                    showToast('Updater completely reset.');
                  }}
                  style={{ padding: '8px', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  Reset Completely
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 1. Real-time Telemetry */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#a855f7', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>monitoring</span>
                Real-time Telemetry
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <DiagnosticField label="App Version" value={APP_VERSION} />
                <DiagnosticField label="Wrapper Version" value={otaDebugLogs.nativeApkVersion || 'N/A'} />
                <DiagnosticField label="Available Version" value={globalOtaState.remoteVersion || 'N/A'} />
                <DiagnosticField label="Wrapper versionCode" value={otaDebugLogs.installedVersionCode !== null ? String(otaDebugLogs.installedVersionCode) : 'N/A'} />
                <DiagnosticField label="Package Name" value={otaDebugLogs.installedPackageName || 'com.chordex.app'} />
                <DiagnosticField label="Build Type" value={otaDebugLogs.installedDebuggable ? 'Debug (Debuggable)' : 'Production (Signed)'} />
                <DiagnosticField label="Current JS State" value={globalOtaState.updateState} />
                <DiagnosticField label="Download Progress" value={`${Math.round(globalOtaState.progress * 100)}%`} />
                <DiagnosticField label="SHA-256 Expected" value={globalOtaState.apkSha256 || 'N/A'} />
                <DiagnosticField label="SHA-256 Calculated" value={otaDebugLogs.shaVerification || 'N/A'} />
                <DiagnosticField label="Eligibility Result" value={otaDebugLogs.apkEligibilityResult || 'N/A'} />
              </div>
            </div>

            {/* 2. PackageInstaller Monitor */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#eab308', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>view_carousel</span>
                PackageInstaller Monitor
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                <DiagnosticField label="Active Session ID" value={nativeInstallerDetails?.sessionId !== undefined && nativeInstallerDetails.sessionId !== -1 ? String(nativeInstallerDetails.sessionId) : 'None'} />
                <DiagnosticField label="Session Stage" value={nativeInstallerDetails?.sessionState || 'None'} />
                <DiagnosticField label="PendingIntent Created" value={nativeInstallerDetails?.pendingIntentCreated ? 'YES' : 'NO'} />
                <DiagnosticField label="IntentSender Created" value={nativeInstallerDetails?.intentSenderCreated ? 'YES' : 'NO'} />
                <DiagnosticField label="Intent Fired" value={nativeInstallerDetails?.intentFired ? 'YES' : 'NO'} />
                <DiagnosticField label="Confirmation Intent Recv" value={nativeInstallerDetails?.confirmationIntentReceived ? 'YES' : 'NO'} />
                <DiagnosticField label="Confirmation Intent Active" value={nativeInstallerDetails?.confirmationIntentStarted ? 'YES' : 'NO'} />
                <DiagnosticField label="Last Received Status" value={nativeInstallerDetails?.lastStatusCode !== undefined && nativeInstallerDetails.lastStatusCode !== -999 ? String(nativeInstallerDetails.lastStatusCode) : 'None'} />
                <DiagnosticField label="Last Received Message" value={nativeInstallerDetails?.lastStatusMessage || 'N/A'} />
                <DiagnosticField label="Last Callback Timestamp" value={nativeInstallerDetails?.lastStatusTimestamp ? new Date(nativeInstallerDetails.lastStatusTimestamp).toLocaleTimeString() : 'N/A'} />
                <DiagnosticField label="Pending Confirmation Intent" value={nativeInstallerDetails?.pendingConfirmIntentExists ? 'EXISTS' : 'NONE'} />
                <DiagnosticField label="Active Sessions Count" value={nativeInstallerDetails?.activeSessionsCount !== undefined ? String(nativeInstallerDetails.activeSessionsCount) : 'N/A'} />
                <DiagnosticField label="Has Install Permission" value={nativeInstallerDetails?.hasInstallPermission ? 'YES' : 'NO'} />
                <DiagnosticField label="Installation Active (Prefs)" value={nativeInstallerDetails?.installationActive ? 'YES' : 'NO'} />
              </div>
            </div>

            {/* 3. State Machine Viewer */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_tree</span>
                State Machine Viewer
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                <DiagnosticField label="Current State" value={globalOtaState.updateState} />
                <DiagnosticField label="Rejected Transitions" value={String(rejectedTransitions.length)} />
              </div>
              <CollapsibleSection title={`Show State History (${transitionHistory.length})`} collapsed={stateHistoryCollapsed} onToggle={() => setStateHistoryCollapsed(!stateHistoryCollapsed)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto', background: 'rgba(0,0,0,0.15)', padding: 8, borderRadius: 8 }}>
                  {transitionHistory.length === 0 ? (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>No state transitions recorded.</div>
                  ) : (
                    transitionHistory.slice().reverse().map((t, idx) => (
                      <div key={idx} style={{ fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 4 }}>
                        <span style={{ color: '#60a5fa' }}>[{new Date(t.timestamp).toLocaleTimeString()}]</span>{' '}
                        <strong>{t.from}</strong> &rarr; <strong style={{ color: t.invalid ? '#f87171' : '#34d399' }}>{t.to}</strong>
                        {t.durationMs > 0 && <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>({t.durationMs}ms)</span>}
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 1 }}>Reason: {t.reason}</div>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleSection>
            </div>

            {/* 4. Device & Context Information */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>device_unknown</span>
                Device Context
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <DiagnosticField label="Android OS" value={nativeDeviceInfo?.androidVersion || 'N/A'} />
                <DiagnosticField label="SDK Level" value={nativeDeviceInfo?.sdkInt !== undefined ? String(nativeDeviceInfo.sdkInt) : 'N/A'} />
                <DiagnosticField label="Model / Brand" value={`${nativeDeviceInfo?.manufacturer || ''} ${nativeDeviceInfo?.model || ''}`} />
                <DiagnosticField label="ABI Architecture" value={nativeDeviceInfo?.architecture || 'N/A'} />
                <DiagnosticField label="Storage Space" value={nativeDeviceInfo?.storageAvailable || 'N/A'} />
                <DiagnosticField label="System Memory" value={nativeDeviceInfo?.ram || 'N/A'} />
                <DiagnosticField label="Battery Level" value={nativeDeviceInfo?.battery || 'N/A'} />
                <DiagnosticField label="Network Status" value={nativeDeviceInfo?.networkState || 'N/A'} />
                <DiagnosticField label="Device Time" value={nativeDeviceInfo?.time || 'N/A'} />
                <DiagnosticField label="Installation Source" value={nativeDeviceInfo?.installerPackage || 'N/A'} />
                <DiagnosticField label="Install Permission Granted" value={nativeDeviceInfo?.canRequestPackageInstalls ? 'YES' : 'NO'} />
              </div>
            </div>

            {/* 5. File Diagnostics */}
            {localApkDetails && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>drafts</span>
                  Downloaded APK Information
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <DiagnosticField label="Package Name" value={localApkDetails.packageName || 'N/A'} />
                  <DiagnosticField label="Version Name" value={localApkDetails.versionName || 'N/A'} />
                  <DiagnosticField label="Version Code" value={localApkDetails.versionCode ? String(localApkDetails.versionCode) : 'N/A'} />
                  <DiagnosticField label="Universal APK" value={localApkDetails.isUniversalApk ? 'YES' : 'NO'} />
                  <DiagnosticField label="Min / Target SDK" value={`${localApkDetails.minSdk || 'N/A'} / ${localApkDetails.targetSdk || 'N/A'}`} />
                  <DiagnosticField label="Valid Package Header" value={localApkDetails.isValidApk ? 'YES' : 'NO'} />
                  <DiagnosticField label="Sign Certificate SHA" value={localApkDetails.signingSha256 ? `${localApkDetails.signingSha256.substring(0, 16)}...` : 'N/A'} />
                </div>
              </div>
            )}

            {/* 6. Chronological Unified Timeline */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>view_headline</span>
                Chronological Event Timeline
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', background: 'rgba(0,0,0,0.25)', padding: 8, borderRadius: 8, fontFamily: 'monospace', fontSize: 10 }}>
                {unifiedTimeline.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'sans-serif' }}>No execution timeline recorded.</div>
                ) : (
                  unifiedTimeline.map((e, idx) => {
                    const timeStr = new Date(e.time).toLocaleTimeString();
                    const color = e.type === 'js' ? '#34d399' : e.type === 'state' ? '#60a5fa' : '#f59e0b';
                    return (
                      <div key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: 4 }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>[{timeStr}]</span>{' '}
                        <span style={{ color, fontWeight: 700 }}>[{e.type.toUpperCase()}]</span>{' '}
                        <span style={{ color: '#fff' }}>{e.text}</span>
                        {e.details && <div style={{ color: 'rgba(255,255,255,0.4)', paddingLeft: 12, fontSize: 9 }}>{e.details}</div>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 7. Export Controls */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>ios_share</span>
                Export Engineering Report
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                <button
                  onClick={exportEngineeringReport}
                  style={{ padding: '8px', borderRadius: 8, background: '#f59e0b', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  Copy Report (.md)
                </button>
                <button
                  onClick={exportTimelineMarkdown}
                  style={{ padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  Copy Timeline (.md)
                </button>
                <button
                  onClick={exportCompleteTimelineJSON}
                  style={{ padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  Copy Timeline (.json)
                </button>
                <button
                  onClick={exportCompleteTimelineText}
                  style={{ padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  Copy Timeline (.txt)
                </button>
              </div>
            </div>
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

  // WarningsInspector moved to file-level

  const renderSubViewHeader = (title: string) => {
    const handleGoBack = () => {
      if (title === 'Stagex Diagnostics') {
        setSubView('apps');
      } else {
        setSubView('dashboard');
      }
    };

    const moduleName = title === 'Apps Diagnostics' ? 'Apps' :
                       title === 'Stagex Diagnostics' ? 'Stagex' :
                       title === 'Updater Diagnostics' ? 'Updater' :
                       title === 'System Diagnostics' ? 'System' :
                       title === 'Logs & Warnings' ? 'Logs' :
                       title === 'Performance Diagnostics' ? 'Performance' :
                       title === 'Network Sniffer' ? 'Network' : '';

    return (
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#000000',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>{title}</span>
        </div>

        {moduleName && (
          <button
            onClick={() => handleCopyModuleDiagnostics(moduleName)}
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
        )}
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

  const renderNavTab = () => {
    const navEntries = getNavigationEntries();
    let diag = (window as any).__navigationDiagnostics;
    if (!diag) {
      try {
        const stored = localStorage.getItem('studio_black_screen_diagnostics');
        if (stored) {
          diag = JSON.parse(stored);
          (window as any).__navigationDiagnostics = diag;
        }
      } catch (_) {}
    }
    diag = diag || {
      returnAttempts: 0,
      failedReturns: 0,
      blackScreenDetections: 0,
      lastBlocker: 'none',
      history: []
    };

    const handleCapture = () => {
      const statePayload = (window as any).__captureBlackScreenState?.();
      if (statePayload) {
        diag.lastPayload = statePayload;
        showToast('Black screen state captured!');
        try {
          localStorage.setItem('studio_black_screen_diagnostics', JSON.stringify(diag));
        } catch (_) {}
      } else {
        showToast('Capture failed: capture function not registered.');
      }
    };

    const handleCopy = () => {
      const payload = {
        navigationDiagnostics: {
          returnAttempts: diag.returnAttempts,
          failedReturns: diag.failedReturns,
          blackScreenDetections: diag.blackScreenDetections,
          lastBlocker: diag.lastBlocker,
          chordex: (window as any).__chordexDiagnostics || null
        },
        capturedPayload: diag.lastPayload || (window as any).__captureBlackScreenState?.() || null
      };

      navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
        .then(() => showToast('Diagnostics copied to clipboard!'))
        .catch(() => showToast('Copy failed. Please copy manually.'));
    };
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Navigation Trace & Lifecycle Diagnostics</span>
          <button 
            onClick={() => {
              clearNavigationEntries();
              showToast('Navigation logs cleared!');
            }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              borderRadius: 6,
              fontSize: 10,
              padding: '4px 10px',
              cursor: 'pointer'
            }}
          >
            Clear logs
          </button>
        </div>

        <div style={{ background: '#181820', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>Black Screen Diagnostics</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, fontSize: 11 }}>
            <div>Return Attempts: <strong>{diag.returnAttempts}</strong></div>
            <div>Failed Returns: <strong>{diag.failedReturns}</strong></div>
            <div>Detections: <strong>{diag.blackScreenDetections}</strong></div>
            <div style={{ gridColumn: 'span 2' }}>
              Topmost Blocker: <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{diag.lastBlocker}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleCapture}
              style={{
                flex: 1,
                background: '#3b82f6',
                border: 'none',
                color: '#fff',
                borderRadius: 6,
                fontSize: 11,
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Capture Black Screen State
            </button>
            <button
              onClick={handleCopy}
              style={{
                flex: 1,
                background: '#10b981',
                border: 'none',
                color: '#fff',
                borderRadius: 6,
                fontSize: 11,
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Copy Black Screen Diagnostics
            </button>
          </div>
        </div>

        <div style={{ background: '#000000', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 12, fontSize: 12, fontFamily: 'monospace' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
            Current Route Mode: <strong style={{ color: '#fff' }}>{settings.appMode}</strong>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 8 }}>
            Previous view cache triggers:
            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              <li>Last Active Session Panel: {useChordStore.getState().lastSession?.stagexView || 'N/A'}</li>
              <li>LiquidGlassNav collapsed state: {String(useChordStore.getState().favorites?.length > 0)}</li>
            </ul>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxHeight: '400px',
          overflowY: 'auto',
          paddingRight: 4
        }}>
          {navEntries.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', padding: '20px 0' }}>
              No navigation events logged yet.
            </div>
          ) : (
            navEntries.slice().reverse().map(entry => {
              const timeStr = new Date(entry.timestamp).toLocaleTimeString() + '.' + String(entry.timestamp % 1000).padStart(3, '0');
              
              const tags: React.ReactNode[] = [];
              if (entry.transitionStart) tags.push(<span key="start" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>START</span>);
              if (entry.transitionComplete) tags.push(<span key="complete" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>COMPLETE</span>);
              if (entry.hubMounted) tags.push(<span key="hub" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>HUB MOUNTED</span>);
              if (entry.subappUnmounted) tags.push(<span key="unmount" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>SUBAPP UNMOUNTED</span>);
              if (entry.fallbackRendered) tags.push(<span key="fallback" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>FALLBACK SHOWN</span>);

              return (
                <div key={entry.id} style={{
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10,
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{timeStr}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {tags}
                      <span style={{
                        background: entry.transitionLockState ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: entry.transitionLockState ? '#ef4444' : '#10b981',
                        padding: '1px 5px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700
                      }}>
                        {entry.transitionLockState ? 'LOCKED' : 'UNLOCKED'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff' }}>
                      Flow: <strong style={{ color: '#3b82f6' }}>{entry.fromApp || 'none'}</strong> &rarr; <strong style={{ color: '#10b981' }}>{entry.toApp || 'none'}</strong>
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Active: <strong style={{ color: '#fff' }}>{entry.activeAppAfterTransition}</strong>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderNetworkTab = () => {
    const missingAssets = network.reduce((acc, req) => {
      if (req.status === 404) {
        let pathOnly = req.url;
        try {
          const urlObj = new URL(req.url);
          pathOnly = urlObj.pathname;
        } catch {
          const queryIdx = req.url.indexOf('?');
          pathOnly = queryIdx >= 0 ? req.url.substring(0, queryIdx) : req.url;
        }

        let module = 'general';
        const lowerPath = pathOnly.toLowerCase();
        if (lowerPath.includes('drums/')) {
          module = 'drumex';
        } else if (lowerPath.includes('stage-core/') || lowerPath.includes('stagex/')) {
          module = 'stagex';
        } else if (lowerPath.includes('chordex/')) {
          module = 'chordex';
        } else if (lowerPath.includes('groovex/')) {
          module = 'groovex';
        } else if (lowerPath.includes('vocalex/')) {
          module = 'vocalex';
        }

        let suggestedCause = 'Asset missing from local build assets.';
        if (lowerPath.includes('drums/')) {
          suggestedCause = 'Drums asset ignored by aapt packaging rule or missing from public/drums.';
        } else if (lowerPath.endsWith('.map')) {
          suggestedCause = 'Source maps excluded in production build.';
        }

        const existing = acc.find(a => a.path === pathOnly);
        if (existing) {
          existing.count++;
          if (req.timestamp < existing.firstSeen) existing.firstSeen = req.timestamp;
          if (req.timestamp > existing.lastSeen) existing.lastSeen = req.timestamp;
        } else {
          acc.push({
            path: pathOnly,
            count: 1,
            firstSeen: req.timestamp,
            lastSeen: req.timestamp,
            module,
            suggestedCause
          });
        }
      }
      return acc;
    }, [] as Array<{
      path: string;
      count: number;
      firstSeen: number;
      lastSeen: number;
      module: string;
      suggestedCause: string;
    }>);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Network Request Sniffer</span>
          <button onClick={clearNetworkRequests} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, fontSize: 10, padding: '4px 10px', cursor: 'pointer' }}>
            Clear
          </button>
        </div>

        {missingAssets.length > 0 && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: 18 }}>error</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#ef4444' }}>
                Missing Assets ({missingAssets.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
              {missingAssets.map((asset, idx) => (
                <div key={idx} style={{
                  padding: '8px 10px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '9px'
                      }}>404</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                        Module: {asset.module}
                      </span>
                      {asset.count > 1 && (
                        <span style={{
                          background: 'rgba(255,255,255,0.1)',
                          color: '#fff',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '9px'
                        }}>
                          ×{asset.count}
                        </span>
                      )}
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px' }}>
                      Seen: {new Date(asset.lastSeen).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ color: '#fff', wordBreak: 'break-all', fontFamily: 'monospace', fontWeight: 600 }}>
                    {asset.path}
                  </div>
                  <div style={{ color: '#ef4444', opacity: 0.9, fontSize: '10px' }}>
                    <strong>Cause:</strong> {asset.suggestedCause}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px' }}>
                    First seen: {new Date(asset.firstSeen).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <span style={{ color }}>{req.status ? `HTTP ${req.status} ${req.statusText || ''}`.trim() : req.error ? 'FAILED' : 'PENDING'}</span>
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
  };

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
    const cards = [
      {
        id: 'apps',
        title: 'Apps',
        description: 'View diagnostics and runtime status for Livex applications.',
        action: () => setSubView('apps')
      },
      {
        id: 'updater',
        title: 'Updater',
        description: 'Inspect update, OTA and APK diagnostics.',
        action: () => setSubView('updater')
      },
      {
        id: 'system',
        title: 'System',
        description: 'View device, runtime and environment information.',
        action: () => { setSubView('system'); setActiveTab('state'); }
      },
      {
        id: 'logs',
        title: 'Logs',
        description: 'View runtime logs, warnings and errors.',
        action: () => { setSubView('logs'); setActiveTab('logs'); }
      },
      {
        id: 'performance',
        title: 'Performance',
        description: 'Inspect memory, rendering and performance metrics.',
        action: () => { setSubView('performance'); setActiveTab('perf'); }
      },
      {
        id: 'network',
        title: 'Network',
        description: 'Inspect connectivity and request diagnostics.',
        action: () => { setSubView('network'); setActiveTab('network'); }
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
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0', lineHeight: '1.4' }}>
                {card.description}
              </p>
            </div>
            
            <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 20 }}>
              chevron_right
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderAppsView = () => {
    const getAppWarningsCount = (appKey: string) => {
      return logs.filter(l => {
        if (l.level !== 'warn') return false;
        const mod = l.module.toLowerCase();
        if (appKey === 'chords') return mod === 'chordex';
        if (appKey === 'drums') return mod === 'drumex' || mod === 'drums';
        if (appKey === 'stage') return mod === 'stagex' || mod === 'stage';
        if (appKey === 'groovex') return mod === 'groovex';
        if (appKey === 'vocalex') return mod === 'vocalex';
        if (appKey === 'hub') {
          return !['chordex', 'drumex', 'drums', 'stagex', 'stage', 'groovex', 'vocalex'].includes(mod);
        }
        return false;
      }).length;
    };

    const appsList = [
      {
        key: 'hub',
        name: 'Livex Hub',
        status: settings.appMode === 'hub' ? 'Active' : 'Suspended',
        view: activePanel,
        memory: '24.5 MB',
        warnings: getAppWarningsCount('hub'),
      },
      {
        key: 'chords',
        name: 'Chordex',
        status: settings.appMode === 'chords' ? 'Active' : 'Suspended',
        view: activePanel,
        memory: '32.1 MB',
        warnings: getAppWarningsCount('chords'),
      },
      {
        key: 'drums',
        name: 'Drumex',
        status: settings.appMode === 'drums' ? 'Active' : 'Suspended',
        view: settings.defaultDrumTab || 'songs',
        memory: '45.8 MB',
        warnings: getAppWarningsCount('drums'),
      },
      {
        key: 'stage',
        name: 'Stagex',
        status: settings.appMode === 'stage' ? 'Active' : 'Suspended',
        view: settings.defaultStageView || 'Editor',
        memory: '58.2 MB',
        warnings: getAppWarningsCount('stage'),
        hasTelemetry: true
      },
      {
        key: 'groovex',
        name: 'Groovex',
        status: settings.appMode === 'groovex' ? 'Active' : 'Suspended',
        view: 'Library',
        memory: '18.4 MB',
        warnings: getAppWarningsCount('groovex'),
      },
      {
        key: 'vocalex',
        name: 'Vocalex',
        status: settings.appMode === 'vocalex' ? 'Active' : 'Suspended',
        view: 'Practice',
        memory: '22.9 MB',
        warnings: getAppWarningsCount('vocalex'),
      }
    ];

    const copyAppDiagnostics = (appName: string, appData: any) => {
      const dump = {
        appVersion: APP_VERSION,
        timestamp: new Date().toISOString(),
        appName,
        key: appData.key,
        status: appData.status,
        view: appData.view,
        memory: appData.memory,
        warnings: appData.warnings
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
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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

            <WarningsInspector logs={logs} showToast={showToast} appKey={app.key} />
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
      fontFamily: 'Manrope, sans-serif',
      overflowX: 'hidden'
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
            margin: '16px 20px 4px',
            padding: '16px 18px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', margin: 0 }}>Developer Mode</h3>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0', lineHeight: '1.4' }}>
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
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
            <WarningsInspector logs={logs} showToast={showToast} moduleFilter={['system', 'general']} />
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
            <WarningsInspector logs={logs} showToast={showToast} />
          </div>
        </div>
      )}

      {subView === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000000' }}>
          {renderSubViewHeader('Performance Diagnostics')}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {renderPerfTab()}
            <WarningsInspector logs={logs} showToast={showToast} moduleFilter={['performance', 'perf']} />
          </div>
        </div>
      )}

      {subView === 'network' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000000' }}>
          {renderSubViewHeader('Network Sniffer')}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {renderNetworkTab()}
            <WarningsInspector logs={logs} showToast={showToast} moduleFilter={['network', 'sync']} />
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
