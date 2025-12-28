import React from 'react';
import './Ecosystem.css';

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
                        <div className="ecosystem__badge">Accès Éducatif</div>
                        <h3 className="ecosystem__card-title">Étudiants & Chercheurs</h3>
                        <p className="ecosystem__card-desc">
                            Nous croyons que le savoir juridique ne doit avoir aucune barrière financière.
                        </p>
                        <ul className="ecosystem__list">
                            <li>✅ Gratuité totale garantie</li>
                            <li>✅ Moteur de recherche complet</li>
                            <li>✅ Accès illimité à la jurisprudence</li>
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
                            <li>💎 Veille & Alertes automatisées</li>
                            <li>💎 Analyse Jurimétrique (Trends)</li>
                            <li>💎 Export dossiers & API</li>
                        </ul>
                        <button className="ecosystem__btn ecosystem__btn--primary">Demander une démo</button>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default Ecosystem;
