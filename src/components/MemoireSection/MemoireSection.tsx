import React, { useEffect, useState, useRef } from 'react';
import { Scan, Layers, Shield } from 'lucide-react';
import './MemoireSection.css';

const MemoireSection: React.FC = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.2 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <section ref={sectionRef} id="memoire" className={`memoire-section ${isVisible ? 'visible' : ''}`}>
            {/* Spine - Vertical Guide */}
            <div className="memoire__spine">
                <div className="memoire__spine-line"></div>
            </div>

            <div className="memoire__container">
                {/* Header */}
                <header className="memoire__header">
                    <span className="memoire__badge">L'Ingénierie</span>
                    <h2 className="memoire__title">La Mémoire Organisée</h2>
                    <p className="memoire__subtitle">Comment nous transformons le chaos documentaire en savoir exploitable.</p>
                </header>

                {/* Section 1: La Capturation */}
                <div className="memoire__block memoire__block--left">
                    <div className="memoire__marker">
                        <div className="memoire__dot"></div>
                    </div>
                    <div className="memoire__content">
                        <div className="memoire__icon">
                            <Scan size={40} strokeWidth={1.5} />
                        </div>
                        <h3>La Capturation</h3>
                        <span className="memoire__label">Extraction Intelligente</span>

                        <div className="memoire__demo memoire__demo--capturation">
                            <div className="demo-before">
                                <div className="blur-text">ARRÊT N° 04 CS DU 17 SEPTEMBRE 2008 CONTRAT DE TRAVAIL – RUPTURE...</div>
                                <div className="scan-line"></div>
                            </div>
                            <div className="demo-after">
                                <div className="clear-text">
                                    <strong>Arrêt n° 04</strong><br />
                                    Cour Suprême — 17 sept. 2008
                                </div>
                            </div>
                        </div>

                        <p>Notre IA scanne les bulletins multi-arrêts et isole chaque décision avec une précision chirurgicale.</p>
                    </div>
                </div>

                {/* Section 2: L'Architecture */}
                <div className="memoire__block memoire__block--right">
                    <div className="memoire__marker">
                        <div className="memoire__dot"></div>
                    </div>
                    <div className="memoire__content">
                        <div className="memoire__icon">
                            <Layers size={40} strokeWidth={1.5} />
                        </div>
                        <h3>L'Architecture</h3>
                        <span className="memoire__label">Segmentation & Chambres</span>

                        <div className="memoire__demo memoire__demo--architecture">
                            <div className="arch-block arch-block--faits">
                                <span>FAITS</span>
                                <p>Le demandeur a été licencié...</p>
                            </div>
                            <div className="arch-block arch-block--motifs">
                                <span>MOTIFS</span>
                                <p>Attendu que l'article 52...</p>
                            </div>
                            <div className="arch-block arch-block--dispositif">
                                <span>DISPOSITIF</span>
                                <p>PAR CES MOTIFS, casse...</p>
                            </div>
                        </div>

                        <p className="chambre-label">2ème Chambre Civile et Commerciale</p>
                    </div>
                </div>

                {/* Section 3: La Souveraineté */}
                <div className="memoire__block memoire__block--left">
                    <div className="memoire__marker">
                        <div className="memoire__dot"></div>
                    </div>
                    <div className="memoire__content">
                        <div className="memoire__icon">
                            <Shield size={40} strokeWidth={1.5} />
                        </div>
                        <h3>La Souveraineté</h3>
                        <span className="memoire__label">Pseudonymisation</span>

                        <div className="memoire__demo memoire__demo--sovereignty">
                            <div className="sov-before">
                                <span className="redacted">Mamadou Sow</span> c/ <span className="redacted">Aminata Ba</span>
                            </div>
                            <div className="sov-arrow">→</div>
                            <div className="sov-after">
                                <span className="protected">M. S.</span> c/ <span className="protected">A. B.</span>
                            </div>
                        </div>

                        <p>Protection des données conformément aux normes internationales. Les parties sont protégées, la justice reste accessible.</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MemoireSection;
