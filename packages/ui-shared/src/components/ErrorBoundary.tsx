import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useChordStore } from '@workspace/studio-core';

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
        recovered: false
      };

      try {
        const logsStr = localStorage.getItem('studio_rootapp_error_boundary_log') || '[]';
        let logs: any[] = JSON.parse(logsStr);
        logs.push(logEntry);
        localStorage.setItem('studio_rootapp_error_boundary_log', JSON.stringify(logs.slice(-50)));
      } catch (_) {}

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
                  marginTop: 8,
                  padding: '8px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8,
                  color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif'
                }}
              >
                Copy RootApp Error Log
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
