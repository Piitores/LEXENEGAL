import React from 'react';
import './Innovation.css';

function Innovation() {
    const steps = [
        {
            title: 'Collecte',
            desc: 'Centralisation multi-source',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
        },
        {
            title: 'Analyse IA',
            desc: 'Identification NLP',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><rect x="7" y="7" width="10" height="10" rx="1" /></svg>
        },
        {
            title: 'Pseudonymisation',
            desc: 'Masquage irréversible',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 6" /><path d="M5 15.1a7 7 0 0 0 10.9 2" /><path d="M15 15.9l1.4 2.8" /><path d="M12 11.9l.4 2.1" /><path d="M9 12.1l-.8 2.6" /><path d="M11.8 8.1l.6 2.3" /></svg>
        },
        {
            title: 'Validation',
            desc: 'Contrôle Qualité Humain',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
        }
    ];

    return (
        <section id="innovation" className="innovation">
            <div className="container">
                <div className="innovation__header">
                    <h2 className="innovation__title">Moteur d'Anonymisation <span className="text-gradient">Neural</span></h2>
                    <p className="innovation__subtitle">
                        Notre protocole exclusif garantit l'anonymat absolu des justiciables.
                    </p>
                </div>

                <div className="innovation__grid">
                    {steps.map((step, index) => (
                        <div key={index} className="innovation__card glass-panel">
                            <div className="innovation__icon">{step.icon}</div>
                            <h3 className="innovation__step-title">{step.title}</h3>
                            <p className="innovation__step-desc">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default Innovation;
