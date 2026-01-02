import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import './Hero.css';

function Hero() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();
  const suggestions = ['Abus de confiance', 'Contrat de travail', 'Cassation'];

  const handleSearch = () => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    } else {
      navigate('/search');
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
            La <span className="text-gradient">référence</span> numérique<br />
            du droit sénégalais.
          </h1>
          <p className="hero__subtitle">
            LEXENEGAL n'est pas un outil. C'est la mémoire juridique organisée du Sénégal.
          </p>

          <div className={`hero__search-wrapper glass-panel ${isFocused ? 'hero__search-wrapper--focus' : ''}`}>
            <div className="hero__search-bar">
              <Search className="hero__search-icon-svg" size={20} />
              <input
                type="text"
                placeholder="Rechercher une décision, un mot-clé..."
                className="hero__search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
              <button className="hero__search-btn" onClick={handleSearch}>Rechercher</button>
            </div>
            <div className="hero__suggestions">
              <span className="hero__suggestions-label">Suggestions :</span>
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

