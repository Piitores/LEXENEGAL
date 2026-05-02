import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import BotBlocker from './components/BotBlocker/BotBlocker';
import Home from './pages/Home/Home';
import SearchPage from './pages/Search/SearchPage';
import DecisionPage from './pages/Decision/DecisionPage';
import AuthPage from './pages/Auth/AuthPage';
import AuthCallback from './pages/Auth/AuthCallback';
import CabinetPage from './pages/Cabinet/CabinetPage';
import CodesListPage from './pages/Codes/CodesListPage';
import CodePage from './pages/Code/CodePage';
import ArticlePage from './pages/Code/ArticlePage';
import AdminPage from './pages/Admin/AdminPage';
import SEO from './components/SEO/SEO';
import AmbientEffects from './components/AmbientEffects/AmbientEffects';
import './App.css';

// ScrollToTop component to reset scroll on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

function App() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <HelmetProvider>
      <Router>
        <BotBlocker>
          <ScrollToTop />
          <SEO />
          <div className="app">
            <AmbientEffects />
            <Navbar scrolled={scrolled} />
            <Routes>
              {/* Landing Page Unique */}
              <Route path="/" element={<Home />} />

              {/* Jurisprudence */}
              <Route path="/search" element={<SearchPage />} />
              <Route path="/decision/:slug" element={<DecisionPage />} />

              {/* Codes & Lois - Pilier */}
              <Route path="/codes" element={<CodesListPage />} />
              <Route path="/code/:slug" element={<CodePage />} />
              <Route path="/code/:codeSlug/:articleSlug" element={<ArticlePage />} />

              {/* Espace Pro */}
              <Route path="/login" element={<AuthPage />} />
              <Route path="/signup" element={<AuthPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/cabinet" element={<CabinetPage />} />

              {/* Admin Command Center */}
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
            <Footer />
          </div>
        </BotBlocker>
      </Router>
    </HelmetProvider>
  );
}

export default App;
