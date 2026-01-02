import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Scan, Layers, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './SolutionsPage.css';

const SolutionsPage: React.FC = () => {
    const navigate = useNavigate();
    const spineRef = useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    // Spine scroll animation
    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.body.scrollHeight - window.innerHeight;
            const progress = Math.min(scrollTop / docHeight, 1);
            setScrollProgress(progress);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="solutions-page">
            {/* SPINE - Vertical Guide */}
            <div className="spine" ref={spineRef}>
                <div className="spine__line" style={{ height: `${scrollProgress * 100}%` }}></div>
            </div>

            <div className="container">
                <button className="back-btn" onClick={() => navigate('/')}>
                    <ArrowLeft size={16} /> Retour
                </button>

                {/* HERO */}
                <header className="solutions-hero">
                    <span className="solutions-badge">L'Ingénierie</span>
                    <h1>La Mémoire Organisée</h1>
                    <p>Comment nous transformons le chaos documentaire en savoir exploitable.</p>
                </header>

                {/* SECTION 1: LA CAPTURATION */}
                <section className="narrative-section narrative-section--left">
                    <div className="narrative-section__marker">
                        <div className="narrative-section__dot"></div>
                    </div>
                    <div className="narrative-section__content">
                        <div className="narrative-section__icon">
                            <Scan size={40} strokeWidth={1.5} />
                        </div>
                        <h2>La Capturation</h2>
                        <p className="narrative-section__subtitle">Extraction Intelligente</p>
                        <div className="capturation-demo">
                            <div className="capturation-demo__before">
                                <div className="blur-text">ARRÊT N° 04 CS DU 17 SEPTEMBRE 2008 CONTRAT DE TRAVAIL – RUPTURE...</div>
                                <div className="scan-line"></div>
                            </div>
                            <div className="capturation-demo__after">
                                <div className="clear-text">
                                    <strong>Arrêt n° 04</strong><br />
                                    Cour Suprême — 17 sept. 2008
                                </div>
                            </div>
                        </div>
                        <p>Notre IA scanne les bulletins multi-arrêts et isole chaque décision avec une précision chirurgicale.</p>
                    </div>
                </section>

                {/* SECTION 2: L'ARCHITECTURE */}
                <section className="narrative-section narrative-section--right">
                    <div className="narrative-section__marker">
                        <div className="narrative-section__dot"></div>
                    </div>
                    <div className="narrative-section__content">
                        <div className="narrative-section__icon">
                            <Layers size={40} strokeWidth={1.5} />
                        </div>
                        <h2>L'Architecture</h2>
                        <p className="narrative-section__subtitle">Segmentation & Chambres</p>
                        <div className="architecture-demo">
                            <div className="architecture-block architecture-block--faits">
                                <span>FAITS</span>
                                <p>Le demandeur a été licencié...</p>
                            </div>
                            <div className="architecture-block architecture-block--motifs">
                                <span>MOTIFS</span>
                                <p>Attendu que l'article 52...</p>
                            </div>
                            <div className="architecture-block architecture-block--dispositif">
                                <span>DISPOSITIF</span>
                                <p>PAR CES MOTIFS, casse...</p>
                            </div>
                        </div>
                        <p className="architecture-chambre">2ème Chambre Civile et Commerciale</p>
                    </div>
                </section>

                {/* SECTION 3: LA SOUVERAINETÉ */}
                <section className="narrative-section narrative-section--left">
                    <div className="narrative-section__marker">
                        <div className="narrative-section__dot"></div>
                    </div>
                    <div className="narrative-section__content">
                        <div className="narrative-section__icon">
                            <Shield size={40} strokeWidth={1.5} />
                        </div>
                        <h2>La Souveraineté</h2>
                        <p className="narrative-section__subtitle">Pseudonymisation</p>
                        <div className="sovereignty-demo">
                            <div className="sovereignty-before">
                                <span className="redacted">Mamadou Sow</span> c/ <span className="redacted">Aminata Ba</span>
                            </div>
                            <div className="sovereignty-arrow">→</div>
                            <div className="sovereignty-after">
                                <span className="protected">M. S.</span> c/ <span className="protected">A. B.</span>
                            </div>
                        </div>
                        <p>Protection des données conformément aux normes internationales. Les parties sont protégées, la justice reste accessible.</p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default SolutionsPage;
