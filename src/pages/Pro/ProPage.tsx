import React from 'react';
import { ArrowLeft, Printer, Search, BarChart3, Bell, FileText, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ProPage.css';

const ProPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="pro-page">
            <div className="container">
                <button className="back-btn" onClick={() => navigate('/')}>
                    <ArrowLeft size={16} /> Retour
                </button>

                {/* HERO */}
                <header className="pro-hero">
                    <span className="pro-badge">L'Arsenal</span>
                    <h1>L'Arsenal du Praticien</h1>
                    <p>Les outils qui transforment l'information en avantage stratégique.</p>
                </header>

                {/* BENTO GRID */}
                <div className="bento-grid">
                    {/* LARGE BLOCK - PDF Master Edition */}
                    <div className="bento-card bento-card--large">
                        <div className="bento-card__icon">
                            <Printer size={32} strokeWidth={1.5} />
                        </div>
                        <h3>PDF Master Edition</h3>
                        <p>Décisions formatées pour l'impression professionnelle, avec composition intégrale, structure claire et filigrane certifié Lexenegal.</p>
                        <div className="bento-card__preview">
                            <div className="pdf-preview">
                                <div className="pdf-preview__header">
                                    <span>LEXENEGAL</span>
                                    <span>Édition Certifiée</span>
                                </div>
                                <div className="pdf-preview__title">Arrêt n° 04</div>
                                <div className="pdf-preview__lines">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MEDIUM BLOCK - Recherche Fulgurante */}
                    <div className="bento-card bento-card--medium">
                        <div className="bento-card__icon">
                            <Search size={28} strokeWidth={1.5} />
                        </div>
                        <h3>Recherche Fulgurante</h3>
                        <p>Accès instantané à l'ensemble du corpus. Filtres par chambre, matière, date.</p>
                        <div className="search-demo">
                            <div className="search-demo__bar">
                                <span>abus de confiance...</span>
                            </div>
                            <div className="search-demo__result">52 décisions</div>
                        </div>
                    </div>

                    {/* MEDIUM BLOCK - Jurimétrie */}
                    <div className="bento-card bento-card--medium">
                        <div className="bento-card__icon bento-card__icon--gold">
                            <BarChart3 size={28} strokeWidth={1.5} />
                        </div>
                        <h3>Jurimétrie</h3>
                        <p>Analysez les tendances par chambre, matière et période. Anticipez l'aléa judiciaire.</p>
                        <div className="chart-demo">
                            <div className="chart-bar" style={{ height: '40%' }}></div>
                            <div className="chart-bar" style={{ height: '60%' }}></div>
                            <div className="chart-bar" style={{ height: '80%' }}></div>
                            <div className="chart-bar chart-bar--highlight" style={{ height: '100%' }}></div>
                            <div className="chart-bar" style={{ height: '70%' }}></div>
                        </div>
                    </div>

                    {/* SMALL BLOCK - Veille */}
                    <div className="bento-card bento-card--small">
                        <div className="bento-card__icon">
                            <Bell size={24} strokeWidth={1.5} />
                        </div>
                        <h3>Veille Automatisée</h3>
                        <p>Alertes personnalisées sur vos thématiques.</p>
                    </div>

                    {/* SMALL BLOCK - Export */}
                    <div className="bento-card bento-card--small">
                        <div className="bento-card__icon">
                            <FileText size={24} strokeWidth={1.5} />
                        </div>
                        <h3>Export Dossiers</h3>
                        <p>Dossiers de jurisprudence en PDF.</p>
                    </div>

                    {/* SMALL BLOCK - API */}
                    <div className="bento-card bento-card--small">
                        <div className="bento-card__icon">
                            <Lock size={24} strokeWidth={1.5} />
                        </div>
                        <h3>API Sécurisée</h3>
                        <p>Intégration dans vos outils internes.</p>
                    </div>
                </div>

                {/* CTA */}
                <div className="pro-cta">
                    <button className="pro-cta-btn">
                        <span>Solliciter un Accès Privilégié</span>
                    </button>
                    <p className="pro-cta-note">Réponse sous 24h</p>
                </div>
            </div>
        </div>
    );
};

export default ProPage;
