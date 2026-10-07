import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import ReportErrorModal from '../ReportError/ReportErrorModal';
import ChargementInterrompu from '../ChargementInterrompu/ChargementInterrompu';
import { affichageErreur } from '../../lib/erreurChargement';
import './ErrorBoundary.css';

interface Props {
  children?: ReactNode;
  /**
   * Clé de l'adresse courante (location.key) : quand elle change, l'erreur est oubliée et la nouvelle
   * page s'affiche. Sans elle, une erreur restait affichée sur toutes les pages jusqu'au rechargement.
   */
  cleNavigation?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isReportModalOpen: boolean;
}

/*
 * ⛔ Jamais de page d'erreur à la place d'un texte disponible (Soft 404, diagnostic Search Console du
 * 07/10/2026) : version serveur encore affichée, ou morceau de code introuvable (ancien déploiement),
 * on monte « Chargement interrompu », que lib/versionServeur.ts GARDE. Règle : lib/erreurChargement.ts.
 */
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

  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.cleNavigation !== this.props.cleNavigation) {
      this.setState({ hasError: false, error: null, isReportModalOpen: false });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const versionServeurAffichee = typeof document !== 'undefined' && !!document.getElementById('ssr-keep');
      if (affichageErreur(this.state.error, versionServeurAffichee) === 'interrompu') {
        // « Réessayer » recharge la page : seul moyen d'obtenir les fichiers de la version en ligne.
        return <ChargementInterrompu pleineHauteur onReessayer={this.handleReset} />;
      }
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
