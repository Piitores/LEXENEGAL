import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import Home from './pages/Home/Home';
import SearchPage from './pages/Search/SearchPage';
import DecisionPage from './pages/Decision/DecisionPage';
import SolutionsPage from './pages/Solutions/SolutionsPage';
import ProPage from './pages/Pro/ProPage';
import AuthPage from './pages/Auth/AuthPage';
import AuthCallback from './pages/Auth/AuthCallback';
import CabinetPage from './pages/Cabinet/CabinetPage';
import CodePage from './pages/Code/CodePage';
import ArticlePage from './pages/Code/ArticlePage';
import SEO from './components/SEO/SEO';
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
        <ScrollToTop />
        <SEO />
        <div className="app">
          <Navbar scrolled={scrolled} />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/decision/:slug" element={<DecisionPage />} />
            <Route path="/solutions" element={<SolutionsPage />} />
            <Route path="/espace-professionnel" element={<ProPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/cabinet" element={<CabinetPage />} />
            <Route path="/code/:slug" element={<CodePage />} />
            <Route path="/code/:codeSlug/:articleSlug" element={<ArticlePage />} />
          </Routes>
          <Footer />
        </div>
      </Router>
    </HelmetProvider>
  );
}

export default App;

