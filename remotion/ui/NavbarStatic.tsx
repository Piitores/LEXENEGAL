import React from 'react';
import { staticFile } from 'remotion';
import { Search, BookOpen, Scale, Globe2, FileText, ChevronDown } from 'lucide-react';
// Réplique statique de la navbar : markup et classes identiques à
// src/components/Navbar/Navbar.tsx (le vrai composant importe Supabase/auth).
import '../../src/components/Navbar/Navbar.css';

const NavbarStatic: React.FC = () => (
  <nav className="navbar navbar--scrolled" style={{ position: 'absolute' }}>
    <div className="navbar__container container">
      <a className="navbar__logo">
        <img src={staticFile('icon-512.png')} alt="" className="navbar__logo-img" />
        <span>LEXENEGAL</span>
      </a>
      <div className="navbar__search-icon">
        <Search size={20} />
      </div>
      <div className="navbar__menu">
        <a className="navbar__link">
          <Scale size={16} />
          Jurisprudence
        </a>
        {(
          [
            ['Corpus National', <BookOpen size={16} key="i" />],
            ['Droit communautaire', <Globe2 size={16} key="i" />],
            ['Autour de la loi', <FileText size={16} key="i" />],
          ] as const
        ).map(([label, icon]) => (
          <div className="nav-dd" key={label}>
            <button type="button" className="navbar__link nav-dd__btn">
              {icon}
              {label}
              <ChevronDown size={14} className="nav-dd__chevron" />
            </button>
          </div>
        ))}
        <button className="navbar__cta">Connexion</button>
      </div>
    </div>
  </nav>
);

export default NavbarStatic;
