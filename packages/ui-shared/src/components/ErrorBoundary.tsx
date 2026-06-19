import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log safe diagnostics
    console.error(`Uncaught error inside boundary [${this.props.moduleName || 'Global'}]:`, {
      message: error?.message,
      name: error?.name,
      componentStack: errorInfo?.componentStack?.slice(0, 1000) // limit stack length for logs
    });
    // Reset transition active lock on error
    if (typeof window !== 'undefined') {
      (window as any).studioTransitionActive = false;
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
        this.setState({ hasError: false, error: null });
      } catch (err) {
        console.error("Failed to call returnToStudioHub:", err);
      }
    } else {
      // Fallback: dispatch custom event
      window.dispatchEvent(new CustomEvent('studio-hub-return'));
      this.setState({ hasError: false, error: null });
    }
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const mod = this.props.moduleName || 'Module';
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
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
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
        </div>
      );
    }

    return this.props.children;
  }
}
