import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import './Navbar.css';

function Navbar({ scrolled }: { scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/';
  // If not home, always show "scrolled" style (solid bg, dark text)
  const isScrolled = scrolled || !isHome;

  return (
    <nav className={`navbar ${isScrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__container container">
        <Link to="/" className="navbar__logo">
          LEXENEGAL
        </Link>

        {/* Simple Global Search Icon for Quick Access */}
        <div style={{ marginLeft: 'auto', marginRight: '1rem', cursor: 'pointer' }} onClick={() => navigate('/search')}>
          <Search size={20} color="#111827" />
        </div>

        <div className={`navbar__menu ${menuOpen ? 'navbar__menu--open' : ''}`}>
          <Link to="/" className="navbar__link" onClick={() => setMenuOpen(false)}>Accueil</Link>
          <a href="/#ecosystem" className="navbar__link" onClick={() => setMenuOpen(false)}>Solutions</a>
          <Link to="/search" className="navbar__link" onClick={() => setMenuOpen(false)}>Recherche</Link>
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
