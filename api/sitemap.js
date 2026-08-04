/*
 * api/sitemap.js — Sitemap DYNAMIQUE, généré à la demande depuis Supabase.
 *
 * Pourquoi : le sitemap était un fichier statique de ~5 Mo versionné dans
 * public/, régénéré à la main (`npm run sitemap`) puis commité. Résultat : à
 * chaque publication de code ou de décision il était périmé jusqu'à ce que
 * quelqu'un y repense. Ici il se construit à la volée, avec un cache CDN de
 * 24 h : on publie, c'est dans le sitemap le lendemain au plus tard, sans
 * commande ni commit.
 *
 * Découpage en index + enfants — obligatoire, pas cosmétique :
 *   1. une réponse de fonction Vercel est plafonnée (~4,5 Mo) et le sitemap
 *      unique dépassait déjà ce seuil ;
 *   2. Search Console rapporte l'indexation PAR sitemap : séparer articles,
 *      décisions et doctrine donne enfin le détail qui manquait au diagnostic.
 *
 * Branché via vercel.json :
 *   /sitemap.xml        -> /api/sitemap?seg=index
 *   /sitemap-:seg.xml   -> /api/sitemap?seg=:seg      (ex. articles, articles-2)
 *
 * ⛔ GARDE-FOU CARDINAL (incident du 2026-07-07 : un HTTP 522 de Supabase avait
 * produit un sitemap tronqué, qui a désindexé le site). Un sitemap partiel est
 * PIRE que pas de sitemap du tout : Google interprète les URL absentes comme
 * retirées. Donc, à la moindre anomalie — requête en échec, page courte, total
 * invraisemblable — on ne sert JAMAIS un XML partiel : on renvoie 503 sans
 * cache. Google conserve alors la version précédente et repassera.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  let url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  let key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (url && key) return { url, key };
  for (const p of [path.join(process.cwd(), '.env'), path.join(__dirname, '..', '.env')]) {
    try {
      const txt = fs.readFileSync(p, 'utf8');
      const g = (k) => (txt.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1] || '';
      url = url || g('VITE_SUPABASE_URL').trim();
      key = key || g('VITE_SUPABASE_ANON_KEY').trim();
      if (url && key) break;
    } catch (e) { /* next */ }
  }
  return { url, key };
}
const { url: SUPABASE_URL, key: SUPABASE_KEY } = loadEnv();
const SITE = 'https://www.lexenegal.sn';

// PostgREST plafonne les réponses à 1000 lignes : c'est la taille de pagination
// imposée côté serveur, pas un choix.
const ROWS_PER_REQUEST = 1000;
// Nombre d'URL par sitemap enfant. Large sous la limite Google (50 000) et sous
// le plafond de réponse Vercel.
const URLS_PER_CHILD = 10000;
// Nombre de requêtes Supabase menées de front (18 requêtes séquentielles pour
// les articles coûteraient ~3,5 s ; par vagues de 6, ~0,6 s).
const CONCURRENCY = 6;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/* ---------- Accès Supabase ---------- */

class SitemapError extends Error {}

async function sbFetch(query, extraHeaders = {}) {
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...extraHeaders };
  // Une seule reprise : la fonction doit rester rapide. En cas d'échec on
  // remonte l'erreur, ce qui déclenche un 503 — jamais un XML incomplet.
  for (let essai = 0; essai < 2; essai++) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers });
      if (r.ok) return r;
    } catch (e) { /* on retente une fois */ }
    if (essai === 0) await new Promise((r) => setTimeout(r, 400));
  }
  throw new SitemapError(`Supabase injoignable : ${query.slice(0, 80)}`);
}

// Nombre total de lignes, via l'en-tête content-range de PostgREST.
async function compter(query) {
  const r = await sbFetch(`${query}&limit=1`, { Prefer: 'count=exact' });
  const total = Number((r.headers.get('content-range') || '').split('/')[1]);
  if (!Number.isFinite(total)) throw new SitemapError(`comptage illisible : ${query.slice(0, 60)}`);
  return total;
}

/*
 * Récupère une tranche [offset, offset+limit) en parallélisant les pages de
 * 1000 lignes. Vérifie que le nombre de lignes obtenu est bien celui attendu :
 * une page courte au milieu signalerait une troncature silencieuse.
 */
async function recuperer(query, offset, limit, attendu) {
  const pages = [];
  for (let d = 0; d < limit; d += ROWS_PER_REQUEST) {
    pages.push({ off: offset + d, lim: Math.min(ROWS_PER_REQUEST, limit - d) });
  }
  const lignes = [];
  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const lot = pages.slice(i, i + CONCURRENCY);
    const res = await Promise.all(lot.map(async (p) => {
      const r = await sbFetch(`${query}&offset=${p.off}&limit=${p.lim}`);
      return r.json();
    }));
    for (const bloc of res) lignes.push(...bloc);
  }
  if (lignes.length !== attendu) {
    throw new SitemapError(`troncature détectée : ${lignes.length} lignes reçues, ${attendu} attendues`);
  }
  return lignes;
}

/* ---------- Construction XML ---------- */

// N'émet un <lastmod> que pour une date valide ET plausible : la base contient
// des dates parasites (1900, epoch) que Search Console rejette.
function lastmod(valeur) {
  if (!valeur) return '';
  const d = new Date(valeur);
  if (isNaN(d.getTime())) return '';
  const an = d.getUTCFullYear();
  if (an < 1950 || an > new Date().getUTCFullYear() + 1) return '';
  return `\n    <lastmod>${d.toISOString().split('T')[0]}</lastmod>`;
}

function urlTag(loc, { date, changefreq, priority } = {}) {
  return `  <url>
    <loc>${esc(SITE + loc)}</loc>${lastmod(date)}${changefreq ? `\n    <changefreq>${changefreq}</changefreq>` : ''}${priority ? `\n    <priority>${priority}</priority>` : ''}
  </url>`;
}

const urlset = (urls) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

/* ---------- Sections ---------- */

const PAGES_STATIQUES = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/jurisprudence', priority: '0.9', changefreq: 'weekly' },
  { url: '/guides', priority: '0.8', changefreq: 'weekly' },
  { url: '/search', priority: '0.9', changefreq: 'daily' },
  { url: '/codes', priority: '0.9', changefreq: 'daily' },
  { url: '/droit-communautaire', priority: '0.8', changefreq: 'weekly' },
  { url: '/doctrine-fiscale', priority: '0.8', changefreq: 'weekly' },
  { url: '/developpeurs', priority: '0.6', changefreq: 'monthly' },
];

// Articles : filtrés par le code parent publié (jointure interne), comme le
// faisait le script historique. Tri stable sur id, sinon la pagination profonde
// peut dupliquer ou perdre des lignes entre deux requêtes.
const Q_ARTICLES = 'articles?select=slug,laws_and_codes!inner(slug,is_active)&laws_and_codes.is_active=eq.true&order=id';
const Q_CODES = 'laws_and_codes?select=slug,updated_at&is_active=eq.true&order=id';
const Q_DECISIONS = 'decisions?select=slug,date_decision&order=id';
const Q_DOCTRINE = 'doctrine?select=slug,date&order=id';
const Q_THEMES = 'seo_themes?select=slug&is_active=eq.true&order=id';
const Q_GUIDES = 'guides?select=slug,published_at&is_active=eq.true&order=id';

const SECTIONS = {
  articles: {
    query: Q_ARTICLES,
    rendu: (lignes) => lignes
      .filter((a) => a.slug && a.laws_and_codes?.slug)
      .map((a) => urlTag(`/code/${a.laws_and_codes.slug}/${a.slug}`, { changefreq: 'monthly', priority: '0.7' })),
  },
  decisions: {
    query: Q_DECISIONS,
    rendu: (lignes) => lignes.filter((d) => d.slug)
      .map((d) => urlTag(`/decision/${d.slug}`, { date: d.date_decision, changefreq: 'yearly', priority: '0.7' })),
  },
  codes: {
    query: Q_CODES,
    rendu: (lignes) => lignes.filter((c) => c.slug)
      .map((c) => urlTag(`/code/${c.slug}`, { date: c.updated_at, changefreq: 'weekly', priority: '0.9' })),
  },
  doctrine: {
    query: Q_DOCTRINE,
    rendu: (lignes) => lignes.filter((d) => d.slug)
      .map((d) => urlTag(`/doctrine-fiscale/${d.slug}`, { date: d.date, changefreq: 'yearly', priority: '0.6' })),
  },
};

// Petite section composite : pages fixes + thèmes + guides.
async function sectionPages() {
  const [nbThemes, nbGuides] = await Promise.all([compter(Q_THEMES), compter(Q_GUIDES)]);
  const [themes, guides] = await Promise.all([
    recuperer(Q_THEMES, 0, nbThemes, nbThemes),
    recuperer(Q_GUIDES, 0, nbGuides, nbGuides),
  ]);
  return [
    ...PAGES_STATIQUES.map((p) => urlTag(p.url, { changefreq: p.changefreq, priority: p.priority })),
    ...themes.filter((t) => t.slug).map((t) => urlTag(`/jurisprudence/theme/${t.slug}`, { changefreq: 'weekly', priority: '0.8' })),
    ...guides.filter((g) => g.slug).map((g) => urlTag(`/guides/${g.slug}`, { date: g.published_at, changefreq: 'monthly', priority: '0.8' })),
  ];
}

/* ---------- Index ---------- */

// Volume plancher : sous ce seuil, la base a forcément mal répondu. Le sitemap
// complet tourne autour de 29 000 URL ; on refuse de publier un index qui
// annoncerait un corpus soudainement amputé.
const TOTAL_MINIMUM = 20000;

async function construireIndex() {
  const [nbArticles, nbDecisions, nbCodes, nbDoctrine] = await Promise.all([
    compter(Q_ARTICLES), compter(Q_DECISIONS), compter(Q_CODES), compter(Q_DOCTRINE),
  ]);
  const total = nbArticles + nbDecisions + nbCodes + nbDoctrine;
  if (total < TOTAL_MINIMUM) {
    throw new SitemapError(`corpus invraisemblable : ${total} URL (< ${TOTAL_MINIMUM})`);
  }

  const enfants = ['pages'];
  for (const [nom, n] of [['codes', nbCodes], ['articles', nbArticles], ['decisions', nbDecisions], ['doctrine', nbDoctrine]]) {
    const parts = Math.max(1, Math.ceil(n / URLS_PER_CHILD));
    for (let i = 1; i <= parts; i++) enfants.push(i === 1 ? nom : `${nom}-${i}`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${enfants.map((e) => `  <sitemap>\n    <loc>${SITE}/sitemap-${e}.xml</loc>\n  </sitemap>`).join('\n')}
</sitemapindex>`;
}

/* ---------- Handler ---------- */

export default async function handler(req, res) {
  const seg = String((req.query && req.query.seg) || 'index');

  try {
    if (seg === 'index') {
      const xml = await construireIndex();
      return servir(res, xml);
    }

    if (seg === 'pages') {
      return servir(res, urlset(await sectionPages()));
    }

    // « articles » -> page 1 ; « articles-3 » -> page 3.
    const m = seg.match(/^([a-z]+)(?:-(\d+))?$/);
    const section = m && SECTIONS[m[1]];
    if (!section) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Sitemap inconnu');
    }
    const page = m[2] ? Number(m[2]) : 1;
    const offset = (page - 1) * URLS_PER_CHILD;

    const total = await compter(section.query);
    if (offset >= total && total > 0) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Sitemap inconnu');
    }
    const attendu = Math.min(URLS_PER_CHILD, total - offset);
    const lignes = await recuperer(section.query, offset, attendu, attendu);
    return servir(res, urlset(section.rendu(lignes)));
  } catch (e) {
    /*
     * ⛔ Aucune tolérance : plutôt rien qu'un sitemap partiel. Le 503 n'est pas
     * mis en cache, Google garde sa version précédente et repasse plus tard.
     */
    res.statusCode = 503;
    res.setHeader('Retry-After', '600');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(`Sitemap momentanement indisponible : ${e instanceof SitemapError ? e.message : 'erreur interne'}`);
  }
}

function servir(res, xml) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  return res.end(xml);
}
