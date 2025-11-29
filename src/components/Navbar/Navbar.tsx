
import React, { useState } from 'react';
import './Navbar.css';

interface NavbarProps {
  scrolled?: boolean;
}

function Navbar({ scrolled }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Accueil', href: '#' },
    { label: 'Jurisprudence', href: '#jurisprudence' },
    { label: 'Législation', href: '#legislation' },
    { label: 'À propos', href: '#about' },
  ];

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__container container">
        <a href="#" className="navbar__logo">
          LEXENEGAL
        </a>

        <div className={`navbar__menu ${menuOpen ? 'navbar__menu--open' : ''}`}>
          <ul className="navbar__links">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="navbar__link"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a href="#login" className="navbar__cta" onClick={() => setMenuOpen(false)}>
            Connexion
          </a>
        </div>

        <button
          className={`navbar__toggle ${menuOpen ? 'navbar__toggle--active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
