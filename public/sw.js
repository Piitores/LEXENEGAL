/*
 * Service worker LEXENEGAL — écrit à la main, volontairement.
 *
 * ⚠️ CONTRAINTE STRUCTURANTE : les pages de contenu ne sont PAS servies par la SPA.
 * `vercel.json` réécrit /, /codes, /code/*, /decision/*, /jurisprudence*, /guides*,
 * /doctrine-fiscale/* vers la fonction de rendu serveur `api/render.js`, et ce POUR
 * TOUS LES VISITEURS (aucune détection de robot). C'est ce qui rend le site indexable.
 *
 * Conséquence : le réflexe habituel des PWA — precacher index.html et le servir en
 * `navigateFallback` sur toutes les navigations — RENVERRAIT LA COQUILLE SPA VIDE à la
 * place du HTML rendu par le serveur. On perdrait le contenu serveur et le bénéfice SEO.
 * D'où la règle n°1 ci-dessous : les navigations passent par le réseau d'abord, et le
 * cache n'intervient QUE si le réseau a échoué.
 *
 * Stratégies :
 *   - navigations (documents HTML) → réseau d'abord, cache de secours, puis /offline.html
 *   - /assets/* (noms hashés par Vite, donc immuables) → cache d'abord
 *   - images et polices → cache servi immédiatement, rafraîchi en arrière-plan
 *   - tout le reste (API, Supabase, analytics, sitemap) → jamais intercepté
 */

const VERSION = 'v1';
const SHELL_CACHE = `lex-shell-${VERSION}`;   // ressources statiques de base
const ASSET_CACHE = `lex-assets-${VERSION}`;  // bundles JS/CSS hashés
const PAGE_CACHE = `lex-pages-${VERSION}`;    // documents HTML déjà visités
const FONT_CACHE = `lex-fonts-${VERSION}`;    // Google Fonts
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, PAGE_CACHE, FONT_CACHE];

/* Nombre maximum de pages conservées hors-ligne (téléphones à faible stockage). */
const MAX_PAGES = 60;

/* Délai au-delà duquel on renonce au réseau et on sert le cache (réseau mobile lent). */
const NETWORK_TIMEOUT_MS = 8000;

/* Ressources indispensables au mode hors-ligne, mises en cache à l'installation. */
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
];

/*
 * Préfixes JAMAIS interceptés. Chacun a une raison précise :
 *   /api/       → rendu serveur et sitemap : doivent toujours être frais et dynamiques
 *   /sitemap    → sitemap dynamique (⛔ ne jamais figer, cf. règle projet)
 *   /robots.txt → doit refléter l'état serveur
 */
const BYPASS_PATH_PREFIXES = ['/api/', '/sitemap', '/robots.txt'];

/*
 * Routes dont le HTML ne doit JAMAIS être mis en cache : contenu propre à
 * l'utilisateur connecté, ou résultats de recherche par nature volatils.
 */
const PRIVATE_PATH_PREFIXES = [
  '/login',
  '/signup',
  '/auth',
  '/cabinet',
  '/admin',
  '/solliciter-acces',
  '/search',
];

/*
 * Hôtes tiers jamais interceptés.
 *   supabase.co → l'authentification s'appuie sur les Web Locks et sur des jetons
 *                 à durée de vie courte : un service worker qui s'interpose peut
 *                 provoquer un écran de chargement infini. Les données doivent en
 *                 outre rester fraîches (droit en vigueur).
 *   analytics   → mesure : doit refléter le réel, jamais être rejouée depuis un cache.
 */
const BYPASS_HOST_PATTERNS = [
  /\.supabase\.co$/i,
  /\.supabase\.in$/i,
  /^www\.googletagmanager\.com$/i,
  /^www\.google-analytics\.com$/i,
  /^region1\.google-analytics\.com$/i,
  /^analytics\.google\.com$/i,
];

const FONT_HOST_PATTERNS = [
  /^fonts\.googleapis\.com$/i,
  /^fonts\.gstatic\.com$/i,
];

/* ------------------------------------------------------------------ */
/* Installation / activation                                           */
/* ------------------------------------------------------------------ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // `Promise.allSettled` : une ressource absente ne doit pas faire échouer
      // l'installation entière du service worker.
      .then((cache) =>
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
      )
  );
  // Le nouveau service worker attend `SKIP_WAITING` (déclenché par l'utilisateur
  // depuis le bandeau de mise à jour) : on ne remplace jamais l'ancien sous les
  // pieds d'un utilisateur en train de lire.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('lex-') && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ------------------------------------------------------------------ */
/* Aides                                                               */
/* ------------------------------------------------------------------ */

function isBypassed(url) {
  if (BYPASS_HOST_PATTERNS.some((re) => re.test(url.hostname))) return true;
  if (url.origin !== self.location.origin) {
    // Hors de notre origine, on ne garde que les polices Google.
    return !FONT_HOST_PATTERNS.some((re) => re.test(url.hostname));
  }
  return BYPASS_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

function isPrivatePath(pathname) {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`)
  );
}

/* Purge FIFO : garde le cache de pages sous MAX_PAGES entrées. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

/* Course entre le réseau et un délai maximal : au-delà, on rend la main. */
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/* ------------------------------------------------------------------ */
/* Stratégies                                                          */
/* ------------------------------------------------------------------ */

/*
 * Navigations : réseau d'abord — impératif pour continuer à servir le HTML rendu
 * par `api/render.js`. Le cache n'est qu'un filet hors-ligne.
 */
async function handleNavigation(event) {
  const url = new URL(event.request.url);
  const cacheable = !isPrivatePath(url.pathname);

  try {
    const preloaded = event.preloadResponse ? await event.preloadResponse : null;
    const response = preloaded || (await fetchWithTimeout(event.request, NETWORK_TIMEOUT_MS));

    if (cacheable && response && response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(
        caches
          .open(PAGE_CACHE)
          .then((cache) => cache.put(event.request, copy))
          .then(() => trimCache(PAGE_CACHE, MAX_PAGES))
      );
    }
    return response;
  } catch (error) {
    if (cacheable) {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
    }
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    return new Response('Hors connexion', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/* Assets hashés par Vite : le nom change à chaque build, le cache d'abord est sûr. */
async function handleAsset(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

/* Images et polices : on sert le cache tout de suite, on rafraîchit derrière. */
async function handleStaleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

/* ------------------------------------------------------------------ */
/* Routage                                                             */
/* ------------------------------------------------------------------ */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // On ne s'occupe jamais des écritures ni des requêtes non-GET.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isBypassed(url)) return; // API, Supabase, analytics, sitemap : intacts.

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (FONT_HOST_PATTERNS.some((re) => re.test(url.hostname))) {
    event.respondWith(handleStaleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(handleAsset(request, ASSET_CACHE));
    return;
  }

  if (/\.(png|jpg|jpeg|svg|webp|gif|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(handleStaleWhileRevalidate(request, SHELL_CACHE));
  }
});
