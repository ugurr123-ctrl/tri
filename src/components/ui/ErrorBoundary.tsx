import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected interface error occurred.',
    };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Error details remain local; no external telemetry is transmitted.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-md mx-auto mt-10 rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] text-center">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Something went wrong
          </h2>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            {this.state.errorMessage}
          </p>
          <div className="mt-4 flex justify-center">
            <Button
              variant="primary"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
            >
              Reload interface
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
