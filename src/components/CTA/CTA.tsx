
import React from 'react';
import './CTA.css';

function CTA() {
  return (
    <section id="access" className="cta">
      <div className="cta__bg">
        <div className="cta__pattern"></div>
        <div className="cta__glow cta__glow--1"></div>
        <div className="cta__glow cta__glow--2"></div>
      </div>

      <div className="container">
        <div className="cta__card">
          <div className="cta__content">
            <span className="cta__badge">🇸🇳 Projet National</span>
            <h2 className="cta__title">
              Prêt à explorer le<br />
              <span className="cta__title-accent">droit sénégalais</span> ?
            </h2>
            <p className="cta__description">
              Rejoignez des milliers de professionnels, étudiants et citoyens qui utilisent 
              LEXENEGAL pour accéder à l'information juridique. Inscription gratuite et immédiate.
            </p>
            
            <div className="cta__actions">
              <a href="#" className="cta__button cta__button--primary">
                <span>Créer un compte gratuit</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
              <a href="#" className="cta__button cta__button--secondary">
                <span>Demander une démo</span>
              </a>
            </div>

            <div className="cta__trust">
              <div className="cta__trust-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>Données sécurisées</span>
              </div>
              <div className="cta__trust-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                <span>Accès instantané</span>
              </div>
              <div className="cta__trust-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
                <span>100% gratuit</span>
              </div>
            </div>
          </div>

          <div className="cta__visual">
            <div className="cta__mockup">
              <div className="cta__mockup-header">
                <div className="cta__mockup-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className="cta__mockup-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <span>Rechercher un texte de loi...</span>
                </div>
              </div>
              <div className="cta__mockup-content">
                <div className="cta__mockup-result">
                  <div className="cta__mockup-badge">Constitution</div>
                  <div className="cta__mockup-title-fake"></div>
                  <div className="cta__mockup-text-fake"></div>
                  <div className="cta__mockup-text-fake cta__mockup-text-fake--short"></div>
                </div>
                <div className="cta__mockup-result">
                  <div className="cta__mockup-badge cta__mockup-badge--green">Code Civil</div>
                  <div className="cta__mockup-title-fake"></div>
                  <div className="cta__mockup-text-fake"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CTA;
