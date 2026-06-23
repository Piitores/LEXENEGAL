import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, BookOpen, Scale, Shield, LogOut, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import useAuth from '../../hooks/useAuth';
import LexenegalSymbol from '../LexenegalSymbol/LexenegalSymbol';
import './Navbar.css';

function Navbar({ scrolled }: { scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/';
  const isScrolled = scrolled || !isHome;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className={`navbar ${isScrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__container container">
        <Link to="/" className="navbar__logo">
          <LexenegalSymbol size={32} />
          <span>LEXENEGAL</span>
        </Link>

        <div className="navbar__search-icon" onClick={() => navigate('/search')}>
          <Search size={20} />
        </div>

        <div className={`navbar__menu ${menuOpen ? 'navbar__menu--open' : ''}`}>
          <Link to="/search" className={`navbar__link ${location.pathname === '/search' ? 'navbar__link--highlight' : ''}`} onClick={() => setMenuOpen(false)}>
            <Scale size={16} />
            Jurisprudence
          </Link>
          <Link to="/codes" className={`navbar__link ${location.pathname === '/codes' ? 'navbar__link--highlight' : ''}`} onClick={() => setMenuOpen(false)}>
            <BookOpen size={16} />
            Corpus National
          </Link>
          {/* Admin Link - Only visible for admins */}
          {isAdmin && (
            <Link to="/admin" className="navbar__link navbar__link--admin" onClick={() => setMenuOpen(false)}>
              <Shield size={16} />
              Admin
            </Link>
          )}

          {/* Auth Button */}
          {user ? (
            <div className="navbar__user-menu">
              <Link to="/cabinet" className="navbar__user-name" onClick={() => setMenuOpen(false)} title="Mon Cabinet">
                <User size={16} />
                {user.email?.split('@')[0]}
              </Link>
              <button className="navbar__logout" onClick={handleLogout} title="Déconnexion">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="navbar__cta" onClick={() => {
              navigate('/login');
              setMenuOpen(false);
            }}>
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


