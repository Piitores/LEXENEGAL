
import React, { useState } from 'react';
import './Navbar.css';

interface NavbarProps {
  scrolled?: boolean;
}
function Navbar({ scrolled }: { scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__container container">
        <a href="#" className="navbar__logo">
          LEXENEGAL
        </a>

        <div className={`navbar__menu ${menuOpen ? 'navbar__menu--open' : ''}`}>
          <a href="#hero" className="navbar__link" onClick={() => setMenuOpen(false)}>Accueil</a>
          <a href="#ecosystem" className="navbar__link" onClick={() => setMenuOpen(false)}>Solutions</a>
          <a href="#innovation" className="navbar__link" onClick={() => setMenuOpen(false)}>Innovation</a>
          <a href="#trust" className="navbar__link" onClick={() => setMenuOpen(false)}>À propos</a>
          <button className="navbar__cta">Espace Professionnel</button>
        </div>

        <button
          className="navbar__toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className="navbar__toggle-bar"></span>
          <span className="navbar__toggle-bar"></span>
          <span className="navbar__toggle-bar"></span>
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
