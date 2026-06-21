import { rewrite } from '@vercel/functions';

/*
 * L'accueil « / » est servi par le fichier statique dist/index.html AVANT les
 * rewrites de vercel.json (le filesystem est prioritaire sur les rewrites).
 * Le Routing Middleware, lui, s'exécute AVANT le filesystem : on réécrit donc
 * « / » vers la fonction de rendu SSR (api/render.js) pour servir une page
 * d'accueil indexable au lieu de la coquille SPA vide.
 *
 * Scopé à « / » uniquement via matcher → aucun impact sur les autres routes.
 */
export const config = { matcher: '/' };

export default function middleware(request) {
  return rewrite(new URL('/api/render?type=home', request.url));
}
