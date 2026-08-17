import React, { useEffect, useLayoutEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import BotBlocker from './components/BotBlocker/BotBlocker';
import Home from './pages/Home/Home';
import SearchPage from './pages/Search/SearchPage';
import DecisionPage from './pages/Decision/DecisionPage';
import ThemePage from './pages/Jurisprudence/ThemePage';
import JurisprudencePage from './pages/Jurisprudence/JurisprudencePage';
import GuidesPage from './pages/Guides/GuidesPage';
import DeveloppeursPage from './pages/Developpeurs/DeveloppeursPage';
import GuideDetailPage from './pages/Guides/GuideDetailPage';
import AuthPage from './pages/Auth/AuthPage';
import AuthCallback from './pages/Auth/AuthCallback';
import CabinetPage from './pages/Cabinet/CabinetPage';
import AccountSettingsPage from './pages/Cabinet/AccountSettingsPage';
import CodesListPage from './pages/Codes/CodesListPage';
import CodePage from './pages/Code/CodePage';
import ArticlePage from './pages/Code/ArticlePage';
import ConventionsListPage from './pages/Conventions/ConventionsListPage';
import DoctrinePage from './pages/Doctrine/DoctrinePage';
import DoctrineDetailPage from './pages/Doctrine/DoctrineDetailPage';
import CommunautairePage from './pages/Communautaire/CommunautairePage';
import AccessRequestPage from './pages/AccessRequest/AccessRequestPage';
import AdminPage from './pages/Admin/AdminPage';
import NotFoundPage from './pages/Error/NotFoundPage';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { useBlockSelectAll } from './hooks/useBlockSelectAll';
import AmbientEffects from './components/AmbientEffects/AmbientEffects';
import AccountNudge from './components/AccountNudge/AccountNudge';
import InstallPrompt from './components/Pwa/InstallPrompt';
import UpdateBanner from './components/Pwa/UpdateBanner';
import { recordOrigin } from './lib/authRedirect';
import './App.css';

// Gère le défilement à la navigation :
// - navigation "avant" (PUSH/REPLACE, clic sur un lien) → on remonte en haut
// - navigation "retour/avance" (POP, bouton Retour) → on restaure la position où l'on était
// La position de chaque entrée d'historique est mémorisée par clé (sessionStorage).
const ScrollManager = () => {
  const location = useLocation();
  const navType = useNavigationType(); // 'PUSH' | 'REPLACE' | 'POP'

  // Désactive la restauration de défilement NATIVE du navigateur : sur une appli qui
  // charge son contenu de façon asynchrone, elle restaure une position avant que le
  // contenu soit prêt → atterrissage au footer au rafraîchissement. On laisse ce
  // ScrollManager piloter le défilement.
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  // Retient la page d'origine (hors écrans d'auth) pour y revenir après connexion.
  useEffect(() => {
    recordOrigin(location.pathname + location.search);
  }, [location.pathname, location.search]);

  // Mémorise en continu la position de défilement de l'entrée d'historique courante
  useEffect(() => {
    const key = `scrollpos:${location.key}`;
    const onScroll = () => {
      try { sessionStorage.setItem(key, String(window.scrollY)); } catch { /* quota */ }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.key]);

  // Applique la position au changement d'entrée d'historique
  useLayoutEffect(() => {
    if (navType === 'POP') {
      const saved = sessionStorage.getItem(`scrollpos:${location.key}`);
      const y = saved ? parseInt(saved, 10) : 0;
      const target = isNaN(y) ? 0 : y;
      if (target === 0) { window.scrollTo(0, 0); return; }
      // Les listes/pages rechargent leurs données de façon asynchrone : on retente la
      // restauration tant que la hauteur de page n'a pas atteint la cible (max ~1,2 s).
      let tries = 0;
      const restore = () => {
        window.scrollTo(0, target);
        tries++;
        if (Math.abs(window.scrollY - target) > 4 && tries < 12) {
          setTimeout(restore, 100);
        }
      };
      requestAnimationFrame(restore);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.key, navType]);

  return null;
};

function App() {
  const [scrolled, setScrolled] = useState(false);

  // Dissuasion des copies sauvages : Ctrl/Cmd+A neutralisé hors champs de saisie.
  useBlockSelectAll();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Retire le splash anti-FOUC une fois l'app React montée (le design est prêt).
  useEffect(() => {
    const splash = document.getElementById('app-splash');
    if (!splash) return;
    splash.classList.add('is-hidden');
    const t = setTimeout(() => splash.remove(), 450);
    return () => clearTimeout(t);
  }, []);

  return (
    <HelmetProvider>
      <Router>
        <BotBlocker>
          <ScrollManager />
          {/* ⛔ Pas de <SEO /> global ici. Sans prop « url » il déclarait l'accueil
              comme canonical sur TOUTES les routes, en conflit avec le canonical
              auto-référent du rendu serveur (api/render.js) → Google ignorait les
              deux et classait les pages en « Duplicate without user-selected
              canonical ». Chaque page porte désormais son propre <SEO url=... > ;
              tant qu'aucune page n'en monte, l'en-tête du rendu serveur (déjà
              correct et spécifique à l'URL) fait autorité. */}
          <div className="app">
            <AmbientEffects />
            <Navbar scrolled={scrolled} />
            <ErrorBoundary>
              <Routes>
                {/* Landing Page Unique */}
              <Route path="/" element={<Home />} />

              {/* Jurisprudence : /jurisprudence = pilier (hub), /search = résultats de recherche */}
              <Route path="/jurisprudence" element={<JurisprudencePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/decision/:slug" element={<DecisionPage />} />
              <Route path="/jurisprudence/theme/:slug" element={<ThemePage />} />

              {/* Codes & Lois - Pilier */}
              <Route path="/codes" element={<CodesListPage />} />
              <Route path="/code/:slug" element={<CodePage />} />
              <Route path="/code/:codeSlug/:articleSlug" element={<ArticlePage />} />
              {/* Conventions collectives (menu « Autour de la loi ») - réutilise le lecteur
                  générique ; les routes /code restent un fallback valide pour tout slug. */}
              <Route path="/conventions-collectives" element={<ConventionsListPage />} />
              <Route path="/convention/:slug" element={<CodePage />} />
              <Route path="/convention/:codeSlug/:articleSlug" element={<ArticlePage />} />
              <Route path="/doctrine-fiscale" element={<DoctrinePage />} />
              <Route path="/doctrine-fiscale/:slug" element={<DoctrineDetailPage />} />
              <Route path="/droit-communautaire" element={<CommunautairePage />} />
              <Route path="/guides" element={<GuidesPage />} />
              <Route path="/guides/:slug" element={<GuideDetailPage />} />
              <Route path="/developpeurs" element={<DeveloppeursPage />} />

              {/* Espace Pro */}
              <Route path="/login" element={<AuthPage />} />
              <Route path="/signup" element={<AuthPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/cabinet" element={<CabinetPage />} />
              <Route path="/cabinet/parametres" element={<AccountSettingsPage />} />
              <Route path="/solliciter-acces" element={<AccessRequestPage />} />

              {/* Admin Command Center */}
              <Route path="/admin" element={<AdminPage />} />

              {/* 404 Catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
          <Footer />
          <AccountNudge />
          <InstallPrompt />
          <UpdateBanner />
        </div>
        </BotBlocker>
      </Router>
    </HelmetProvider>
  );
}

export default App;
