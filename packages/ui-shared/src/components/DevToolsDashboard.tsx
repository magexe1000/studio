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
  isNative
} from '@workspace/studio-core';

interface Props {
  accent: { from: string; mid?: string; to: string };
  onBack: () => void;
}

type TabId = 'logs' | 'errors' | 'events' | 'perf' | 'state' | 'nav' | 'network' | 'storage' | 'providers';

export default function DevToolsDashboard({ accent, onBack }: Props) {
  const { settings, updateSettings } = useChordStore();
  const [activeTab, setActiveTab] = useState<TabId>('logs');
  const [versionUpdates, setVersionUpdates] = useState(0);

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
      logs: logs.slice(-50)
    };

    navigator.clipboard.writeText(JSON.stringify(dump, null, 2))
      .then(() => showToast('Diagnostics copied to clipboard!'))
      .catch(() => showToast('Copy failed.'));
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#09090b',
      color: '#f4f4f5',
      fontFamily: 'Manrope, sans-serif'
    }}>
      {/* HEADER */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
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

        <button
          onClick={handleCopyDiagnostics}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            border: 'none',
            color: '#fff',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
          Copy Diagnostics
        </button>
      </div>

      {/* DEV MODE ENABLE SECTION */}
      <div style={{
        padding: '14px 20px',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Enable Developer Mode</span>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
            Allows real-time logging, network sniffing, and inspector tabs.
          </p>
        </div>
        <button
          onClick={() => {
            const next = !settings.developerMode;
            updateSettings({ developerMode: next });
            showToast(`Developer Mode: ${next ? 'ON' : 'OFF'}`);
          }}
          style={{
            padding: '6px 16px',
            borderRadius: '999px',
            background: settings.developerMode ? '#10b981' : '#ef4444',
            border: 'none',
            color: '#fff',
            fontWeight: 800,
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          {settings.developerMode ? 'MODE: ON' : 'MODE: OFF'}
        </button>
      </div>

      {!settings.developerMode ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#ef4444', marginBottom: 16 }}>terminal</span>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Developer Mode is Disabled</h3>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', maxWidth: 280, lineHeight: 1.4, margin: 0 }}>
            Toggle the status above to activate diagnostics tracking, capture logs, and view app-specific states.
          </p>
        </div>
      ) : (
        <>
          {/* TABS CONTAINER */}
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            scrollbarWidth: 'none'
          }}>
            <button style={tabBtnStyle('logs')} onClick={() => setActiveTab('logs')}>Logs ({logs.length})</button>
            <button style={tabBtnStyle('errors')} onClick={() => setActiveTab('errors')}>Errors ({errors.length})</button>
            <button style={tabBtnStyle('events')} onClick={() => setActiveTab('events')}>Events ({events.length})</button>
            <button style={tabBtnStyle('perf')} onClick={() => setActiveTab('perf')}>Performance</button>
            <button style={tabBtnStyle('state')} onClick={() => setActiveTab('state')}>App State</button>
            <button style={tabBtnStyle('nav')} onClick={() => setActiveTab('nav')}>Navigation Stack</button>
            <button style={tabBtnStyle('network')} onClick={() => setActiveTab('network')}>Network ({network.length})</button>
            <button style={tabBtnStyle('storage')} onClick={() => setActiveTab('storage')}>Storage</button>
            <button style={tabBtnStyle('providers')} onClick={() => setActiveTab('providers')}>Module Panels ({activeProviders.length})</button>
          </div>

          {/* TAB CONTENTS */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            
            {/* LOGS TAB */}
            {activeTab === 'logs' && (
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

                <div style={{ background: '#09090b', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', maxHeight: '60vh', overflowY: 'auto', padding: 8 }}>
                  {filteredLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No logs capture matched the filters.</div>
                  ) : (
                    filteredLogs.map((log, i) => {
                      const color = log.level === 'error' ? '#ef4444' : log.level === 'warn' ? '#fbbf24' : '#60a5fa';
                      return (
                        <div key={i} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, fontFamily: 'monospace', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ color: 'rgba(255,255,255,0.3)' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                          <span style={{ color, fontWeight: 800 }}>[{log.level.toUpperCase()}]</span>
                          <span style={{ color: '#a78bfa' }}>[{log.module}]</span>
                          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: log.level === 'error' ? '#fca5a5' : '#e4e4e7' }}>{log.message}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ERRORS TAB */}
            {activeTab === 'errors' && (
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
            )}

            {/* EVENTS TAB */}
            {activeTab === 'events' && (
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

                <div style={{ background: '#09090b', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', maxHeight: '60vh', overflowY: 'auto', padding: 8 }}>
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
            )}

            {/* PERFORMANCE TAB */}
            {activeTab === 'perf' && (
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
            )}

            {/* STATE INSPECTOR */}
            {activeTab === 'state' && (
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
            )}

            {/* NAVIGATION TAB */}
            {activeTab === 'nav' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Navigation Trace & History</span>
                <div style={{ background: '#09090b', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 12, fontSize: 12, fontFamily: 'monospace' }}>
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
            )}

            {/* NETWORK TAB */}
            {activeTab === 'network' && (
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
            )}

            {/* STORAGE TAB */}
            {activeTab === 'storage' && (
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
            )}

            {/* PROVIDERS TAB */}
            {activeTab === 'providers' && (
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
            )}

          </div>
        </>
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
