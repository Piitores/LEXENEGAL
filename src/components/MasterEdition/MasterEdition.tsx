import React from 'react';
import './MasterEdition.css';

const MasterEdition: React.FC = () => {
    return (
        <section className="master-edition">
            <div className="container">
                <div className="master-edition__header">
                    <span className="master-edition__badge">Valeur Ajoutée</span>
                    <h2 className="master-edition__title">
                        La différence <span className="text-gradient">Lexenegal</span>
                    </h2>
                    <p className="master-edition__subtitle">
                        Nos décisions ne sont pas de simples copies. Elles sont restructurées, enrichies et certifiées.
                    </p>
                </div>

                <div className="master-edition__comparison">
                    {/* RAW DOCUMENT */}
                    <div className="master-edition__card master-edition__card--raw">
                        <div className="master-edition__card-header">
                            <span className="master-edition__label master-edition__label--raw">Document Brut</span>
                        </div>
                        <div className="master-edition__card-body">
                            <p style={{ fontSize: '11px', lineHeight: '1.4', color: '#6B7280', fontFamily: 'Courier, monospace' }}>
                                ARRÊT N° 04 CS DU 17 SEPTEMBRE 2008 CONTRAT DE TRAVAIL – RUPTURE – MODIFICATION SUBSTANTIELLE DES CONDITIONS DE TRAVAIL – REFUS DU SALARIÉ – IMPUTABILITÉ DE LA RUPTURE A L'EMPLOYEUR... Méconnaît les articles 122 du Code de Procédure Civile et L.52 du Code du Travail ainsi que le principe du double degré de juridiction, la Cour d'appel qui estime irrecevable l'appel au motif qu'il n'a pas été expressément formé contre toutes les parties au procès alors d'une part...
                            </p>
                        </div>
                    </div>

                    {/* LEXENEGAL EDITION */}
                    <div className="master-edition__card master-edition__card--premium">
                        <div className="master-edition__card-header">
                            <span className="master-edition__label master-edition__label--premium">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                                Édition Lexenegal
                            </span>
                        </div>
                        <div className="master-edition__card-body">
                            <div className="master-edition__composition">
                                <p><strong>PRÉSIDENT :</strong> Ibrahima Guèye</p>
                                <p><strong>CONSEILLERS :</strong> Moustapha Touré, Aminata Diallo</p>
                                <p><strong>RAPPORTEUR :</strong> Moustapha Touré</p>
                            </div>
                            <h4 className="master-edition__chambre">2ème Chambre Civile et Commerciale</h4>
                            <div className="master-edition__matiere">
                                <span className="master-edition__tag">CONTRAT DE TRAVAIL</span>
                                <span className="master-edition__tag">RUPTURE</span>
                            </div>
                            <p className="master-edition__resume">
                                Méconnaît les articles 122 du Code de Procédure Civile et L.52 du Code du Travail ainsi que le principe du double degré de juridiction...
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MasterEdition;
