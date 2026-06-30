import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useChordStore, globalOtaState } from '@workspace/studio-core';

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const CHAR_MAP: Record<string, number> = {};
for (let i = 0; i < CHARS.length; i++) {
  CHAR_MAP[CHARS[i]] = i;
}

const KNOWN_SYMBOLS: Record<string, string> = {
  'cee': 'BottomNav (packages/ui-android/src/components/BottomNav.tsx)',
  'qoe': 'SubAppWrapper (apps/studio-android/src/App.tsx)',
  'BottomNav': 'BottomNav (packages/ui-android/src/components/BottomNav.tsx)',
  'SubAppWrapper': 'SubAppWrapper (apps/studio-android/src/App.tsx)'
};

function parseReactErrorCode(message: string): { code: string | null; url: string | null } {
  const match = /Minified React error #(\d+)/i.exec(message);
  if (match) {
    const code = match[1];
    return {
      code,
      url: `https://react.dev/errors/${code}`
    };
  }
  return { code: null, url: null };
}

let cachedSourceMap: any = null;
let cachedSourceMapUrl = '';

async function fetchSourceMap(jsUrl: string): Promise<any> {
  const mapUrl = jsUrl + '.map';
  if (cachedSourceMapUrl === mapUrl && cachedSourceMap) {
    return cachedSourceMap;
  }
  try {
    const res = await fetch(mapUrl, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    const sm = await res.json();
    cachedSourceMapUrl = mapUrl;
    cachedSourceMap = sm;
    return sm;
  } catch (_) {
    return null;
  }
}

function decodeVlq(str: string): number[] {
  const results: number[] = [];
  let i = 0;
  while (i < str.length) {
    let value = 0;
    let shift = 0;
    let hasContinuation = true;
    while (hasContinuation) {
      if (i >= str.length) break;
      const char = str[i++];
      const digit = CHAR_MAP[char];
      if (digit === undefined) break;
      hasContinuation = (digit & 32) !== 0;
      value += (digit & 31) << shift;
      shift += 5;
    }
    const shouldNegate = (value & 1) !== 0;
    value >>>= 1;
    if (shouldNegate) {
      value = -value;
    }
    results.push(value);
  }
  return results;
}

function findSourceMapMapping(smap: any, line1idx: number, col1idx: number) {
  const sources = smap.sources || [];
  const names = smap.names || [];
  const mappings = smap.mappings || "";
  
  const lines = mappings.split(";");
  const line0idx = line1idx - 1;
  const col0idx = col1idx - 1;
  
  if (line0idx >= lines.length) return null;
  
  const lineMappings = lines[line0idx];
  const segments = lineMappings.split(",");
  
  let sourceFileIdx = 0;
  let sourceLine = 0;
  let sourceCol = 0;
  let nameIdx = 0;
  let genCol = 0;
  
  let bestMatch: any = null;
  
  for (const segment of segments) {
    if (!segment) continue;
    const values = decodeVlq(segment);
    if (values.length < 1) continue;
    
    genCol += values[0];
    
    if (values.length >= 4) {
      sourceFileIdx += values[1];
      sourceLine += values[2];
      sourceCol += values[3];
    }
    
    if (values.length === 5) {
      nameIdx += values[4];
    }
    
    if (genCol <= col0idx) {
      bestMatch = {
        sourceFile: sources[sourceFileIdx] || 'unknown',
        sourceLine: sourceLine + 1,
        sourceCol: sourceCol + 1,
        name: values.length === 5 ? names[nameIdx] : null
      };
    } else {
      break;
    }
  }
  return bestMatch;
}

interface StackFrame {
  name: string;
  url: string;
  line: number;
  col: number;
}

function parseStackLine(lineStr: string): StackFrame | null {
  const matchWithParentheses = /at\s+([^\s(]+)\s+\(([^)]+):(\d+):(\d+)\)/.exec(lineStr);
  if (matchWithParentheses) {
    return {
      name: matchWithParentheses[1],
      url: matchWithParentheses[2],
      line: parseInt(matchWithParentheses[3], 10),
      col: parseInt(matchWithParentheses[4], 10)
    };
  }
  const matchWithoutParentheses = /at\s+([^\s]+):(\d+):(\d+)/.exec(lineStr);
  if (matchWithoutParentheses) {
    return {
      name: '',
      url: matchWithoutParentheses[1],
      line: parseInt(matchWithoutParentheses[2], 10),
      col: parseInt(matchWithoutParentheses[3], 10)
    };
  }
  return null;
}

async function symbolicateStack(stack: string): Promise<string> {
  const lines = stack.split("\n");
  const resultLines: string[] = [];
  
  for (const line of lines) {
    const frame = parseStackLine(line);
    if (!frame) {
      resultLines.push(line);
      continue;
    }
    
    let symbolicatedName = frame.name;
    const known = KNOWN_SYMBOLS[frame.name];
    if (known) {
      symbolicatedName = known;
    }
    
    if (frame.url.endsWith(".js")) {
      const sm = await fetchSourceMap(frame.url);
      if (sm) {
        const mapping = findSourceMapMapping(sm, frame.line, frame.col);
        if (mapping) {
          symbolicatedName = mapping.name || symbolicatedName;
          resultLines.push(`    at ${symbolicatedName} (${mapping.sourceFile}:${mapping.sourceLine}:${mapping.sourceCol}) [mapped from ${frame.url}:${frame.line}:${frame.col}]`);
          continue;
        }
      }
    }
    
    resultLines.push(line);
  }
  
  return resultLines.join("\n");
}

export function decodeReactError(code: string): { message: string; cause: string; fix: string } | null {
  if (code === '300') {
    return {
      message: "Rendered fewer hooks than expected. This occurs when the order of Hook calls changes between renders (e.g. conditional early return before a Hook).",
      cause: "React's internal hook counter detected that fewer hooks were called during the current render compared to the previous render. This usually happens when a hook is placed after a conditional early return statement, or inside an 'if' block that became false.",
      fix: "Ensure all hooks (useState, useEffect, useMemo, useCallback, etc.) are called unconditionally at the very top level of your component, before any conditional logic or early returns."
    };
  }
  if (code === '310') {
    return {
      message: "Rendered more hooks than during the previous render. This occurs when the order of Hook calls changes between renders.",
      cause: "React's internal hook counter detected that more hooks were called during the current render compared to the previous render. This typically happens when a hook is placed inside a conditional block or a loop that was skipped in a previous render but executed in the current one.",
      fix: "Ensure all hooks (useState, useEffect, useMemo, useCallback, etc.) are called unconditionally at the very top level of your component. Never call hooks inside loops, conditions, or nested functions."
    };
  }
  return null;
}

function safeStringify(obj: any, maxDepth = 3): string {
  const seen = new WeakSet();
  function serializer(key: string, value: any, depth = 0): any {
    if (depth > maxDepth) return '[Max Depth Reached]';
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
      const newObj: any = Array.isArray(value) ? [] : {};
      for (const k in value) {
        try {
          newObj[k] = serializer(k, value[k], depth + 1);
        } catch (_) {
          newObj[k] = '[Unreadable]';
        }
      }
      seen.delete(value);
      return newObj;
    }
    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }
    return value;
  }
  try {
    return JSON.stringify(serializer('', obj), null, 2);
  } catch (_) {
    return '[Serialization Failed]';
  }
}

function parseComponentFrame(frameStr: string) {
  const match = /in\s+([^\s(]+)\s+\(at\s+([^)]+?):(\d+)(?::(\d+))?\)/.exec(frameStr);
  if (match) {
    return {
      componentName: match[1],
      filePath: match[2],
      line: parseInt(match[3], 10),
      column: match[4] ? parseInt(match[4], 10) : null
    };
  }
  return null;
}

function extractFiberDiagnostics(boundaryFiber: any, componentStack: string) {
  if (!boundaryFiber) return null;

  const topComponentMatch = /in\s+([^\s(]+)/.exec(componentStack);
  const topComponentName = topComponentMatch ? topComponentMatch[1] : null;

  let matchedFiber: any = null;

  function traverse(fiber: any) {
    if (!fiber || matchedFiber) return;

    let name = '';
    if (typeof fiber.type === 'function') {
      name = fiber.type.name || fiber.type.displayName || '';
    } else if (fiber.type && typeof fiber.type === 'object') {
      name = fiber.type.displayName || fiber.type.name || '';
    }

    if (name && topComponentName && name === topComponentName) {
      matchedFiber = fiber;
      return;
    }

    let child = fiber.child;
    while (child) {
      traverse(child);
      child = child.sibling;
    }
  }

  traverse(boundaryFiber);

  if (!matchedFiber) {
    function findFirstComponent(fiber: any): any {
      if (!fiber) return null;
      if (typeof fiber.type === 'function' || (fiber.type && typeof fiber.type === 'object')) {
        return fiber;
      }
      let child = fiber.child;
      while (child) {
        const found = findFirstComponent(child);
        if (found) return found;
        child = child.sibling;
      }
      return null;
    }
    matchedFiber = findFirstComponent(boundaryFiber);
  }

  if (!matchedFiber) return null;

  const props = matchedFiber.memoizedProps;
  const rawState = matchedFiber.memoizedState;

  const hooks: any[] = [];
  let isFunctional = false;
  
  if (rawState && typeof rawState === 'object' && 'memoizedState' in rawState) {
    isFunctional = true;
    let currentHook = rawState;
    let index = 0;
    while (currentHook) {
      let hookType = 'unknown';
      let deps: any = null;
      let val: any = currentHook.memoizedState;

      if (Array.isArray(val) && val.length === 2 && Array.isArray(val[1])) {
        deps = val[1];
        val = val[0];
        hookType = 'useMemo / useCallback';
      } else if (val && typeof val === 'object' && 'create' in val && 'deps' in val) {
        deps = val.deps;
        val = '[Effect Function]';
        hookType = 'useEffect / useLayoutEffect';
      } else {
        hookType = 'useState / useReducer / useRef';
      }

      hooks.push({
        index,
        type: hookType,
        value: val,
        dependencies: deps
      });
      currentHook = currentHook.next;
      index++;
    }
  }

  return {
    componentName: topComponentName || matchedFiber.type?.name || 'Unknown',
    props,
    state: isFunctional ? null : rawState,
    hooks: hooks.length > 0 ? hooks : null
  };
}

async function generateSymbolicatedReport(logEntry: any): Promise<string> {
  const errorInfo = parseReactErrorCode(logEntry.message);
  
  let symbolicatedStack = logEntry.stack;
  try {
    symbolicatedStack = await symbolicateStack(logEntry.stack);
  } catch (_) {}

  let symbolicatedComponentStack = logEntry.componentStack;
  try {
    symbolicatedComponentStack = await symbolicateStack(logEntry.componentStack);
  } catch (_) {}

  let exactComponent = 'Unknown';
  let exactFile = 'Unknown';
  let exactLine = 'Unknown';
  let exactColumn = 'Unknown';

  if (symbolicatedComponentStack) {
    const lines = symbolicatedComponentStack.split('\n');
    for (const line of lines) {
      const parsedFrame = parseComponentFrame(line);
      if (parsedFrame) {
        exactComponent = parsedFrame.componentName;
        exactFile = parsedFrame.filePath;
        exactLine = String(parsedFrame.line);
        exactColumn = parsedFrame.column ? String(parsedFrame.column) : 'N/A';
        break;
      }
    }
  }

  const decoded = decodeReactError(errorInfo.code || '');
  let decodedSection = '';
  if (decoded) {
    decodedSection = `
=== DECODED REACT ERROR EXPLANATION ===
Message: ${decoded.message}
Potential Cause: ${decoded.cause}
Recommended Fix: ${decoded.fix}
=======================================`;
  }

  let propsStr = 'N/A';
  let stateStr = 'N/A';
  let hooksStr = 'N/A';

  if (logEntry.fiberDiagnostics) {
    const fd = logEntry.fiberDiagnostics;
    if (fd.props) propsStr = safeStringify(fd.props);
    if (fd.state) stateStr = safeStringify(fd.state);
    if (fd.hooks) {
      hooksStr = fd.hooks.map((h: any) => {
        let hStr = `  Hook #${h.index} (${h.type}):\n    Value: ${safeStringify(h.value, 1).replace(/\\n/g, '\n    ')}`;
        if (h.dependencies) {
          hStr += `\n    Dependencies: ${safeStringify(h.dependencies, 1).replace(/\\n/g, '\n    ')}`;
        }
        return hStr;
      }).join('\n\n');
    }
  }

  return `=== SYMBOLICATED REACT ERROR REPORT ===
Timestamp: ${new Date(logEntry.timestamp).toISOString()}
App Mode: ${logEntry.appMode}
Active Sub-App: ${logEntry.activeSubApp}
Stable Key: ${logEntry.stableKey}
Checkpoint Stage: ${logEntry.checkpointStage}
Return In Progress: ${logEntry.returnInProgress}
Watchdog Running: ${logEntry.watchdogRunning}
Last Navigation Action: ${logEntry.lastNavigationAction}
Last OTA Transition: ${logEntry.lastOtaTransition || 'N/A'}
Current Updater State: ${logEntry.currentUpdaterState || 'N/A'}

=== EXPLICIT DIAGNOSTIC DETAILS ===
Exact Component: ${exactComponent}
Exact TSX File: ${exactFile}
Exact Line: ${exactLine}
Exact Column: ${exactColumn}
===================================${decodedSection}

=== COMPONENT FIBER CONTEXT ===
Props:
${propsStr}

State:
${stateStr}

Hooks Stack:
${hooksStr}
================================

React Error Code: ${errorInfo.code || 'N/A'}
React Error URL: ${errorInfo.url || 'N/A'}

Original Message: ${logEntry.message}
Original Name: ${logEntry.name}

Symbolicated Stack Trace:
${symbolicatedStack}

Component Stack:
${symbolicatedComponentStack}
========================================`;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  suppressed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private recoveryTimer: any = null;
  private errorTimestamp: number = 0;

  public override state: State = {
    hasError: false,
    error: null,
    suppressed: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, suppressed: false };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.errorTimestamp = Date.now();

    // Log safe diagnostics to console
    console.error(`Uncaught error inside boundary [${this.props.moduleName || 'Global'}]:`, {
      message: error?.message,
      name: error?.name,
      componentStack: errorInfo?.componentStack?.slice(0, 1000)
    });

    // Reset transition active lock on error
    if (typeof window !== 'undefined') {
      (window as any).studioTransitionActive = false;
    }

    if (this.props.moduleName === 'RootApp') {
      // Gather telemetry info
      let appMode = 'unknown';
      let activeSubApp = 'unknown';
      let stableKey = 'unknown';
      let transitionActiveVal = false;
      let hubRenderKeyVal = 0;
      let lastNavigationAction = 'none';

      try {
        const storeState = useChordStore.getState();
        appMode = storeState.settings?.appMode || 'hub';
      } catch (_) {}

      if (typeof window !== 'undefined') {
        activeSubApp = (window as any).__lastActiveSubApp || 'none';
        stableKey = (window as any).__lastStableKey || 'none';
        transitionActiveVal = (window as any).studioTransitionActive || false;
        hubRenderKeyVal = (window as any).__lastHubRenderKey || 0;
      }

      try {
        const historyStr = localStorage.getItem('studio_navigation_history') || '[]';
        const history = JSON.parse(historyStr);
        if (history.length > 0) {
          lastNavigationAction = JSON.stringify(history[history.length - 1]);
        }
      } catch (_) {}

      let checkpointStage = 'none';
      if (typeof window !== 'undefined') {
        checkpointStage = (window as any).__lastCheckpointStage || 'none';
      }

      const returnInProgress = localStorage.getItem('studio_navigation_in_progress') === 'true' || transitionActiveVal;
      const watchdogRunning = (window as any).__watchdogRunning || false;

      // Determine if error was caught during a return/watchdog recovery sequence and Developer Mode is off
      let isDevMode = false;
      try {
        isDevMode = useChordStore.getState().settings.developerMode || false;
      } catch (_) {}

      const shouldSuppress = returnInProgress && !isDevMode;

      const hostFiber = (this as any)._reactInternals || (this as any)._reactInternalFiber;
      const fiberDiag = extractFiberDiagnostics(hostFiber, errorInfo?.componentStack || '');

      let currentUpdaterState = 'unknown';
      try {
        currentUpdaterState = globalOtaState.updateState;
      } catch (_) {}

      let lastOtaTransition = 'none';
      if (typeof window !== 'undefined') {
        lastOtaTransition = (window as any).__lastOtaTransition || 'none';
      }

      const logEntry = {
        timestamp: this.errorTimestamp,
        message: error?.message || '',
        name: error?.name || '',
        stack: error?.stack || '',
        componentStack: errorInfo?.componentStack || '',
        appMode,
        activeSubApp,
        stableKey,
        transitionActive: transitionActiveVal,
        hubRenderKey: hubRenderKeyVal,
        lastNavigationAction,
        checkpointStage,
        returnInProgress,
        watchdogRunning,
        suppressed: shouldSuppress,
        recovered: false,
        currentUpdaterState,
        lastOtaTransition,
        fiberDiagnostics: fiberDiag
      };

      try {
        const logsStr = localStorage.getItem('studio_rootapp_error_boundary_log') || '[]';
        let logs: any[] = JSON.parse(logsStr);
        logs.push(logEntry);
        localStorage.setItem('studio_rootapp_error_boundary_log', JSON.stringify(logs.slice(-50)));
      } catch (_) {}

      // Run symbolication report in background
      generateSymbolicatedReport(logEntry).then(report => {
        try {
          localStorage.setItem('studio_rootapp_last_symbolicated_report', report);
        } catch (_) {}
      }).catch(err => {
        console.error('Failed to generate symbolicated report:', err);
      });

      let totalErrors = 0;
      try {
        totalErrors = parseInt(localStorage.getItem('studio_rootapp_error_boundary_count') || '0', 10);
      } catch (_) {}
      totalErrors++;
      localStorage.setItem('studio_rootapp_error_boundary_count', String(totalErrors));

      if (shouldSuppress) {
        this.setState({ suppressed: true });
        localStorage.setItem('studio_rootapp_last_error_suppressed', 'true');

        // Start 600ms watchdog timer to reveal error if recovery fails
        if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
        this.recoveryTimer = setTimeout(() => {
          this.setState({ suppressed: false });
          localStorage.setItem('studio_rootapp_last_error_suppressed', 'false');

          try {
            const errorLogStr = localStorage.getItem('studio_rootapp_error_boundary_log') || '[]';
            const errorLog = JSON.parse(errorLogStr);
            if (errorLog.length > 0) {
              errorLog[errorLog.length - 1].recoveryTimeout = true;
              errorLog[errorLog.length - 1].suppressed = false;
              localStorage.setItem('studio_rootapp_error_boundary_log', JSON.stringify(errorLog));
            }
          } catch (_) {}
        }, 600);
      } else {
        this.setState({ suppressed: false });
        localStorage.setItem('studio_rootapp_last_error_suppressed', 'false');
      }
    }
  }

  public override componentWillUnmount() {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }
    
    if (this.props.moduleName === 'RootApp' && this.state.hasError && this.state.suppressed) {
      // It recovered successfully before the 600ms timeout!
      const duration = Date.now() - this.errorTimestamp;
      localStorage.setItem('studio_rootapp_last_error_duration', String(duration));
      localStorage.setItem('studio_rootapp_last_error_suppressed', 'true');
      
      console.warn(`[ErrorBoundary] RootApp error recovered successfully in ${duration}ms! Logging as RECOVERABLE_ROOTAPP_ERROR_DURING_RETURN.`);
      
      try {
        // Update the last error boundary log to indicate it was suppressed and recovered
        const errorLogStr = localStorage.getItem('studio_rootapp_error_boundary_log') || '[]';
        const errorLog = JSON.parse(errorLogStr);
        if (errorLog.length > 0) {
          errorLog[errorLog.length - 1].suppressed = true;
          errorLog[errorLog.length - 1].duration = duration;
          errorLog[errorLog.length - 1].recovered = true;
          errorLog[errorLog.length - 1].type = 'RECOVERABLE_ROOTAPP_ERROR_DURING_RETURN';
          
          localStorage.setItem('studio_rootapp_error_boundary_log', JSON.stringify(errorLog));
          localStorage.setItem('studio_rootapp_last_recoverable_error', JSON.stringify(errorLog[errorLog.length - 1]));
        }
      } catch (_) {}
    }
  }

  private handleReturnToHub = () => {
    // Reset transition active lock
    if (typeof window !== 'undefined') {
      (window as any).studioTransitionActive = false;
    }
    // Try to safely return to Hub using the global function
    if (typeof (window as any).returnToStudioHub === 'function') {
      try {
        (window as any).returnToStudioHub();
        this.setState({ hasError: false, error: null, suppressed: false });
      } catch (err) {
        console.error("Failed to call returnToStudioHub:", err);
      }
    } else {
      // Fallback: dispatch custom event
      window.dispatchEvent(new CustomEvent('studio-hub-return'));
      this.setState({ hasError: false, error: null, suppressed: false });
    }
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (this.props.moduleName === 'RootApp' && this.state.suppressed) {
        // Neutral dark transition layout to prevent visual flash
        return (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: '#121214',
            zIndex: 999999
          }} />
        );
      }

      const mod = this.props.moduleName || 'Module';
      const isRootApp = this.props.moduleName === 'RootApp';

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', width: '100%', background: '#121214', color: '#eaeaea', padding: 24, textAlign: 'center',
          fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#f03e3e', marginBottom: 16 }}>warning</span>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Something went wrong</h3>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: '#a0a0a5', maxWidth: 360, lineHeight: 1.5 }}>
            An unexpected error occurred in the {mod} module. Try restarting the module or return to the Studio Hub.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => this.setState({ hasError: false, error: null, suppressed: false })}
                style={{
                  padding: '10px 20px', background: '#3b5bdb', border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif'
                }}
              >
                Retry Loading
              </button>
              <button
                onClick={this.handleReturnToHub}
                style={{
                  padding: '10px 20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                  color: '#eaeaea', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif'
                }}
              >
                Return to Hub
              </button>
            </div>
            
            {isRootApp && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => {
                    try {
                      const logs = localStorage.getItem('studio_rootapp_error_boundary_log') || '[]';
                      navigator.clipboard.writeText(logs);
                      alert('RootApp error log copied!');
                    } catch (_) {
                      alert('Failed to copy');
                    }
                  }}
                  style={{
                    padding: '8px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 8,
                    color: '#eaeaea', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif'
                  }}
                >
                  Copy RootApp Error Log
                </button>
                <button
                  onClick={() => {
                    try {
                      const report = localStorage.getItem('studio_rootapp_last_symbolicated_report') || 'No symbolicated report found';
                      navigator.clipboard.writeText(report);
                      alert('Symbolicated React Error Report copied!');
                    } catch (_) {
                      alert('Failed to copy');
                    }
                  }}
                  style={{
                    padding: '8px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8,
                    color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif'
                  }}
                >
                  COPY SYMBOLICATED REACT ERROR REPORT
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
