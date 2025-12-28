import React from 'react';
import './Hero.css';

function Hero() {
  const suggestions = ['Code pénal', 'Droit du travail', 'Conseil constitutionnel'];

  return (
    <section id="hero" className="hero">
      <div className="hero__bg-abstract"></div>

      <div className="hero__container container">
        <div className="hero__content animate-fade-up">
          <h1 className="hero__title">
            L'Éveil du <span className="text-gradient">Droit</span>
          </h1>
          <p className="hero__subtitle">
            Accédez à l'intégralité de la jurisprudence et de la législation sénégalaise.
            <br />
            Une recherche puissante, une information fiable.
          </p>

          <div className="hero__search-wrapper glass-panel">
            <div className="hero__search-bar">
              <span className="hero__search-icon">🔍</span>
              <input
                type="text"
                placeholder="Rechercher une décision, un décret, une loi..."
                className="hero__search-input"
              />
              <button className="hero__search-btn">Rechercher</button>
            </div>
            <div className="hero__suggestions">
              <span className="hero__suggestions-label">Tendances :</span>
              {suggestions.map((tag, i) => (
                <button key={i} className="hero__suggestion-tag">
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
