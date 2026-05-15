import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import ReportErrorModal from '../ReportError/ReportErrorModal';
import './ErrorBoundary.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isReportModalOpen: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isReportModalOpen: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, isReportModalOpen: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-icon-wrapper">
              <AlertOctagon size={48} className="error-icon" />
            </div>
            <h1 className="error-title">Une erreur inattendue est survenue</h1>
            <p className="error-message">
              Notre système a rencontré un problème lors de l'affichage de cette page.
              Veuillez nous excuser pour la gêne occasionnée.
            </p>
            
            <div className="error-actions">
              <button 
                className="error-btn-primary" 
                onClick={this.handleReset}
              >
                <RotateCcw size={18} />
                Recharger la page
              </button>
              
              <button 
                className="error-btn-secondary" 
                onClick={() => this.setState({ isReportModalOpen: true })}
              >
                Signaler ce bug
              </button>
            </div>
          </div>

          <ReportErrorModal
            isOpen={this.state.isReportModalOpen}
            onClose={() => this.setState({ isReportModalOpen: false })}
            entityType="system"
            url={window.location.href}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
