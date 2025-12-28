import React from 'react';
import './SecurityStandards.css';

function SecurityStandards() {
    return (
        <section id="security" className="security">
            <div className="container">
                <div className="security__content">
                    <div className="security__icon-wrapper" style={{ marginBottom: '16px', color: '#004D40' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    </div>
                    <h3 className="security__title">ALIGNÉ SUR LES STANDARDS NATIONAUX</h3>
                    <div className="security__badges">
                        <span className="security__badge">Conformité Loi 2008-12</span>
                        <span className="security__badge">Standard RGPD</span>
                        <span className="security__badge">Sécurité ISO 27001</span>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default SecurityStandards;
