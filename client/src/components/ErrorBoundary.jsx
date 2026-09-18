import React from 'react';

/** Last-resort boundary: a render crash shows a friendly card, never a blank page. */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Voltix] Render crash:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: 'center', border: '1px solid rgba(255,255,255,.12)', borderRadius: 16, padding: 40, background: 'rgba(255,255,255,.04)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛠️</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 6 }}>
              The interface hit an unexpected error and was reset.
            </p>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 20, fontFamily: 'monospace', wordBreak: 'break-word' }}>
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ cursor: 'pointer', border: 0, borderRadius: 10, padding: '10px 22px', fontWeight: 700, color: '#fff', background: 'linear-gradient(90deg,#6366f1,#06b6d4)' }}
            >
              Reload Voltix
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
