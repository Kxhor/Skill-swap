import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="glass-panel p-8 rounded-xl max-w-md w-full flex flex-col items-center fast-transition gpu-accelerate">
            <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-text mb-2">Something went wrong</h1>
            <p className="text-text-muted mb-6">
              An unexpected error occurred in the application. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors w-full"
            >
              Refresh Page
            </button>
            {import.meta.env.MODE === 'development' && this.state.error && (
              <div className="mt-6 p-4 bg-surface-alt rounded-lg text-left w-full overflow-x-auto text-xs text-text-muted">
                <code>{this.state.error.toString()}</code>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
