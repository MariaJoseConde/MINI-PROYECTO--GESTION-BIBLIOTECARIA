import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Error inesperado al renderizar la vista.',
    };
  }

  handleRecover = () => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-[#E7E2D8] bg-[#FFFFFF] p-8 text-center space-y-4 my-6">
          <AlertTriangle className="w-10 h-10 text-[#B45309] mx-auto" />
          <div className="space-y-1">
            <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
              Se interrumpió la visualización de este módulo
            </h2>
            <p className="text-xs text-[#57534E] max-w-md mx-auto">
              {this.state.message}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRecover}
            className="inline-flex items-center gap-2 rounded-md bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#172554] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Volver a la vista principal
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
