import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Search, AlertCircle } from 'lucide-react';
import ReportErrorModal from '../../components/ReportError/ReportErrorModal';
import './NotFoundPage.css';

const NotFoundPage: React.FC = () => {
    const navigate = useNavigate();
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    return (
        <div className="not-found-container">
            <div className="not-found-content">
                <div className="not-found-code">404</div>
                <h1 className="not-found-title">Page non trouvée</h1>
                
                <p className="not-found-message">
                    Le document ou la page que vous cherchez n'existe pas ou a été déplacé.
                    Si vous avez cliqué sur un lien pour arriver ici, il se peut qu'il soit cassé.
                </p>

                <div className="not-found-actions">
                    <button 
                        className="nf-btn-primary" 
                        onClick={() => navigate('/')}
                    >
                        <Home size={18} />
                        Retour à l'accueil
                    </button>
                    
                    <button 
                        className="nf-btn-secondary" 
                        onClick={() => navigate('/search')}
                    >
                        <Search size={18} />
                        Rechercher un texte
                    </button>
                </div>

                <div className="not-found-report">
                    <button 
                        className="nf-report-link"
                        onClick={() => setIsReportModalOpen(true)}
                    >
                        <AlertCircle size={16} />
                        Signaler ce lien cassé
                    </button>
                </div>
            </div>

            <ReportErrorModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                entityType="404"
                url={window.location.href}
            />
        </div>
    );
};

export default NotFoundPage;
