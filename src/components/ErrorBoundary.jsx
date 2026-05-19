// ErrorBoundary.jsx — catches React errors so app doesn't break
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding:20, color:'#fff', background:'#020617', minHeight:'100vh' }}>
          <h2 style={{ color:'#DC0000', marginBottom:12 }}>❌ Error</h2>
          <p style={{ fontSize:13, marginBottom:8 }}>{String(this.state.error?.message || this.state.error)}</p>
          <pre style={{ background:'#1e293b', padding:10, borderRadius:6, fontSize:11, overflow:'auto', color:'#fbbf24' }}>
            {String(this.state.error?.stack || '').slice(0, 800)}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{ background:'#DC0000', color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, marginTop:12, fontWeight:700, cursor:'pointer' }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
