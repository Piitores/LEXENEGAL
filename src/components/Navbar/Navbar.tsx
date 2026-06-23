import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, BookOpen, Scale, Shield, LogOut, User, Globe2, FileText, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import useAuth from '../../hooks/useAuth';
import LexenegalSymbol from '../LexenegalSymbol/LexenegalSymbol';
import './Navbar.css';

interface DDItem { label: string; to?: string; soon?: boolean; }

// Corpus National = codes + LODA + JO (à venir)
const CORPUS: DDItem[] = [
  { label: 'Codes consolidés', to: '/codes' },
  { label: 'Lois, décrets & arrêtés (LODA)', to: '/codes' },
  { label: 'Journaux officiels', soon: true },
];

// Droit communautaire = sous-rubriques par organisation (OHADA dispo ; UEMOA / UA à venir)
const COMMUNAUTAIRE: DDItem[] = [
  { label: 'OHADA', to: '/search?q=OHADA' },
  { label: 'UEMOA', soon: true },
  { label: 'Union africaine (UA)', soon: true },
];

// Autour de la loi = doctrine + conventions + rapports + fiches
const AUTOUR: DDItem[] = [
  { label: 'Doctrine', to: '/doctrine-fiscale' },
  { label: 'Conventions collectives', soon: true },
  { label: 'Rapports ministériels', soon: true },
  { label: 'Fiches techniques', soon: true },
];

// Composant de niveau module (ne pas définir dans Navbar : éviterait le remontage à chaque rendu).
const NavDropdown: React.FC<{
  id: string;
  label: string;
  icon: React.ReactNode;
  items: DDItem[];
  openDD: string | null;
  setOpenDD: React.Dispatch<React.SetStateAction<string | null>>;
  onNavigate: () => void;
  wide?: boolean;
}> = ({ id, label, icon, items, openDD, setOpenDD, onNavigate, wide }) => (
  <div
    className="nav-dd"
    onMouseEnter={() => setOpenDD(id)}
    onMouseLeave={() => setOpenDD((cur) => (cur === id ? null : cur))}
  >
    <button
      type="button"
      className="navbar__link nav-dd__btn"
      aria-expanded={openDD === id}
      onClick={() => setOpenDD((cur) => (cur === id ? null : id))}
    >
      {icon}
      {label}
      <ChevronDown size={14} className={`nav-dd__chevron ${openDD === id ? 'nav-dd__chevron--open' : ''}`} />
    </button>
    <div className={`nav-dd__panel ${wide ? 'nav-dd__panel--wide' : ''} ${openDD === id ? 'nav-dd__panel--open' : ''}`}>
      {items.map((it) =>
        it.soon ? (
          <span key={it.label} className="nav-dd__item nav-dd__item--soon">
            {it.label}
            <span className="nav-dd__badge">à venir</span>
          </span>
        ) : (
          <Link key={it.label} to={it.to!} className="nav-dd__item" onClick={onNavigate}>
            {it.label}
          </Link>
        )
      )}
    </div>
  </div>
);

function Navbar({ scrolled }: { scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDD, setOpenDD] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/';
  const isScrolled = scrolled || !isHome;

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('signOut error (on force la déconnexion):', e);
    }
    // Rechargement complet → état d'auth garanti propre (évite un état SPA résiduel).
    window.location.assign('/');
  };

  const closeAll = () => { setMenuOpen(false); setOpenDD(null); };

  return (
    <nav className={`navbar ${isScrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__container container">
        <Link to="/" className="navbar__logo" onClick={closeAll}>
          <LexenegalSymbol size={32} />
          <span>LEXENEGAL</span>
        </Link>

        <div className="navbar__search-icon" onClick={() => navigate('/search')}>
          <Search size={20} />
        </div>

        <div className={`navbar__menu ${menuOpen ? 'navbar__menu--open' : ''}`}>
          <Link to="/search" className={`navbar__link ${location.pathname === '/search' ? 'navbar__link--highlight' : ''}`} onClick={closeAll}>
            <Scale size={16} />
            Jurisprudence
          </Link>

          <NavDropdown id="corpus" label="Corpus National" icon={<BookOpen size={16} />} items={CORPUS} openDD={openDD} setOpenDD={setOpenDD} onNavigate={closeAll} />
          <NavDropdown id="ohada" label="Droit communautaire" icon={<Globe2 size={16} />} items={COMMUNAUTAIRE} openDD={openDD} setOpenDD={setOpenDD} onNavigate={closeAll} />
          <NavDropdown id="autour" label="Autour de la loi" icon={<FileText size={16} />} items={AUTOUR} openDD={openDD} setOpenDD={setOpenDD} onNavigate={closeAll} />

          {/* Admin Link - Only visible for admins */}
          {isAdmin && (
            <Link to="/admin" className="navbar__link navbar__link--admin" onClick={closeAll}>
              <Shield size={16} />
              Admin
            </Link>
          )}

          {/* Auth Button */}
          {user ? (
            <div className="navbar__user-menu">
              <Link to="/cabinet" className="navbar__user-name" onClick={closeAll} title="Mon Cabinet">
                <User size={16} />
                {user.email?.split('@')[0]}
              </Link>
              <button className="navbar__logout" onClick={handleLogout} title="Déconnexion">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="navbar__cta" onClick={() => { navigate('/login'); closeAll(); }}>
              Connexion
            </button>
          )}
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
