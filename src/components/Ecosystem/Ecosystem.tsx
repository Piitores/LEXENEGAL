import React from 'react';
import './Ecosystem.css';

// Minimalist SVG Icons
const CheckIcon = () => (
    <svg className="eco-icon eco-icon--check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

const DiamondIcon = () => (
    <svg className="eco-icon eco-icon--diamond" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#AA8C2C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="12" y="2" width="14" height="14" rx="2" transform="rotate(45 12 2)"></rect>
    </svg>
);

function Ecosystem() {
    return (
        <section id="ecosystem" className="ecosystem">
            <div className="container">
                <div className="ecosystem__header">
                    <h2 className="ecosystem__title">L'Écosystème <span className="text-gradient">LEXENEGAL</span></h2>
                    <p className="ecosystem__subtitle">Une double approche pour démocratiser le droit.</p>
                </div>

                <div className="ecosystem__grid">
                    {/* Card Étudiant */}
                    <div className="ecosystem__card ecosystem__card--citizen glass-panel">
                        <div className="ecosystem__badge ecosystem__badge--educatif">Accès Éducatif</div>
                        <h3 className="ecosystem__card-title">Étudiants & Chercheurs</h3>
                        <p className="ecosystem__card-desc">
                            Nous croyons que le savoir juridique ne doit avoir aucune barrière financière.
                        </p>
                        <ul className="ecosystem__list">
                            <li><CheckIcon /> Gratuité totale garantie</li>
                            <li><CheckIcon /> Moteur de recherche complet</li>
                            <li><CheckIcon /> Accès illimité à la jurisprudence</li>
                        </ul>
                        <button className="ecosystem__btn ecosystem__btn--outline">S'inscrire (Gratuit)</button>
                    </div>

                    {/* Card Pro */}
                    <div className="ecosystem__card ecosystem__card--pro glass-panel">
                        <div className="ecosystem__badge ecosystem__badge--premium">Espace Professionnel</div>
                        <h3 className="ecosystem__card-title">Avocats & Juristes</h3>
                        <p className="ecosystem__card-desc">
                            Une suite d'outils d'excellence pour maîtriser l'aléa judiciaire.
                        </p>
                        <ul className="ecosystem__list">
                            <li><DiamondIcon /> Veille & Alertes automatisées</li>
                            <li><DiamondIcon /> Analyse Jurimétrique (Trends)</li>
                            <li><DiamondIcon /> Export dossiers & API</li>
                        </ul>
                        <button className="ecosystem__btn ecosystem__btn--primary">Demander une démo</button>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default Ecosystem;

