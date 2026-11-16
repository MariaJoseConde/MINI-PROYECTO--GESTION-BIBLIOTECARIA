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
        <div className="card-monday bg-[#ffffff] p-10 text-center space-y-5 my-8 max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#ffd2b3] flex items-center justify-center mx-auto text-[#c2410c]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-[#333333] tracking-tight">
              Se interrumpió la visualización de este módulo
            </h2>
            <p className="text-xs text-[#535768] max-w-md mx-auto">
              {this.state.message}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRecover}
            className="btn-primary-pill inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold cursor-pointer shadow-sm"
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
