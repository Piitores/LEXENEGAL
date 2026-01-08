import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, BookOpen, Briefcase, Scale, Shield, LogOut, User } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import LexenegalSymbol from '../LexenegalSymbol/LexenegalSymbol';
import './Navbar.css';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

function Navbar({ scrolled }: { scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/';
  const isScrolled = scrolled || !isHome;

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);

    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      setIsAdmin(profile?.role === 'admin');
    } else {
      setIsAdmin(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
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
          <Link to="/search" className="navbar__link" onClick={() => setMenuOpen(false)}>
            <Scale size={16} />
            Jurisprudence
          </Link>
          <Link to="/codes" className="navbar__link navbar__link--highlight" onClick={() => setMenuOpen(false)}>
            <BookOpen size={16} />
            Corpus National
          </Link>
          <Link to="/cabinet" className="navbar__link" onClick={() => setMenuOpen(false)}>
            <Briefcase size={16} />
            Mon Cabinet
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
              <span className="navbar__user-name">
                <User size={16} />
                {user.email?.split('@')[0]}
              </span>
              <button className="navbar__logout" onClick={handleLogout}>
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


