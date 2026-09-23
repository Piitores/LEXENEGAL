
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/global.css';
import './styles/print.css';

/*
 * Contenu serveur (api/render.js) : au lieu de le laisser détruire par React au
 * montage (createRoot vide #app), on le déplace dans #ssr-keep, juste après #app,
 * et on retire le splash. Le lecteur (et la métrique LCP) voit donc le texte dès
 * le HTML reçu ; App.tsx retire #ssr-keep quand la page React a fini de charger.
 * L'accueil garde le splash : sa version serveur est trop sommaire pour être montrée.
 */
const container = document.getElementById('app');
const ssr = document.getElementById('ssr-content');
if (container && ssr && window.location.pathname !== '/') {
  const keep = document.createElement('div');
  keep.id = 'ssr-keep';
  keep.appendChild(ssr);
  container.after(keep);
  document.body.classList.add('ssr-live');
  document.getElementById('app-splash')?.remove();
}
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
