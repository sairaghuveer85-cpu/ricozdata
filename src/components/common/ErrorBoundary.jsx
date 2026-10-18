import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import Button from './Button';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div role="alert" className="ui-error-state my-6 flex flex-col items-center justify-center rounded-xl border p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            {this.props.title || 'Something went wrong in this section'}
          </h3>
          <p className="mb-4 max-w-md break-words text-xs leading-relaxed text-rose-600 dark:text-rose-400">
            {this.state.error?.message || 'An unexpected runtime error occurred.'}
          </p>
          <Button size="sm" variant="secondary" icon={RotateCcw} onClick={this.handleRetry}>
            Reload Section
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
