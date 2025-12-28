import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Hero.css';

function Hero() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const suggestions = ['Code pénal', 'Droit du travail', 'Conseil constitutionnel'];

  const handleSearch = () => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="hero__search-btn" onClick={handleSearch}>Rechercher</button>
            </div>
            <div className="hero__suggestions">
              <span className="hero__suggestions-label">Tendances :</span>
              {suggestions.map((tag, i) => (
                <button
                  key={i}
                  className="hero__suggestion-tag"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)}
                >
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
