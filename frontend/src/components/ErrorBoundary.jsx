import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Robust React Error Boundary.
 * Catches JavaScript errors anywhere in the child component tree,
 * logs the error, and displays a resilient fallback UI instead of crashing the whole tree.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled rendering error:', error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error, this.handleReset)
          : this.props.fallback;
      }

      return (
        <div 
          className="error-boundary-card animate-fade-in"
          style={{
            padding: '24px',
            margin: '16px 0',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '10px',
            textAlign: 'center',
            color: '#f87171'
          }}
          role="alert"
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '12px' }}>
            <AlertCircle size={22} color="#ef4444" />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fca5a5', marginBottom: '6px' }}>
            {this.props.title || 'Widget Encountered an Error'}
          </h3>
          <p style={{ fontSize: '12px', color: '#888', maxWidth: '440px', margin: '0 auto 16px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred in this section.'}
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={this.handleReset}
            style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
          >
            <RefreshCw size={12} />
            <span>Reload Component</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
