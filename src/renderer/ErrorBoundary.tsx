import React from 'react';
export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null, info: null };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { this.setState({ info }); console.error("ErrorBoundary caught an error", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', backgroundColor: 'white', padding: '20px', height: '100vh', overflow: 'auto' }}>
          <h1>Something went wrong.</h1>
          <pre>{String(this.state.error)}</pre>
          <pre>{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
