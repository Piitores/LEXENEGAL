/*
 * api/render.js — Rendu SEO côté serveur (Vercel) pour les pages de décision.
 *
 * Pourquoi : la SPA Vite ne renvoie qu'une coquille vide au crawler Google
 * (<div id="app"></div>) → les 13 845 décisions sont invisibles. Cette fonction
 * renvoie un HTML COMPLET (titre + meta + canonical + OG + JSON-LD LegalCase +
 * contenu visible) pour /decision/:slug. L'utilisateur reçoit le même HTML puis
 * la SPA prend le relais (le bundle JS de la coquille est conservé ; React
 * createRoot vide #app et re-rend au montage).
 *
 * Branché via vercel.json : /decision/:slug -> /api/render?slug=:slug
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Config Supabase : process.env d'abord (si défini dans Vercel), sinon repli sur le
// fichier .env versionné (les fonctions Vercel n'héritent pas des variables VITE_* à
// l'exécution). La clé anon est publique par conception (déjà dans le bundle client).
function loadEnv() {
  let url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  let key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (url && key) return { url, key };
  const candidates = [path.join(process.cwd(), '.env'), path.join(__dirname, '..', '.env')];
  for (const p of candidates) {
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
const OG_IMAGE = SITE + '/og-image.svg';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function attr(s) { return esc(s).replace(/\n/g, ' '); }
function formatDateFr(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return ''; }
}

// Texte brut -> paragraphes HTML (léger, suffisant pour le SEO)
export function textToParagraphs(raw) {
  if (!raw) return '';
  let s = String(raw).replace(/\x0c/g, '\n');
  if (/<div class=|class="decision-body"|class="master-composition"/.test(s)) return s; // déjà structuré
  let blocks = s.split(/\n[ \t]*\n+/);
  if (blocks.length < 2) blocks = s.split(/;\s+/).map((b, i, a) => (i < a.length - 1 ? b + ' ;' : b));
  return blocks
    .map((b) => b.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((b) => b.length > 2)
    .map((b) => `<p>${esc(b)}</p>`)
    .join('\n');
}

// Têtes <head> dynamiques (mêmes règles que src/components/SEO/SEO.tsx)
export function buildHead(d, canonical) {
  const ref = d.reference || 'Décision';
  const court = d.chambre || d.juridiction || 'Cour Suprême du Sénégal';
  const dateFr = formatDateFr(d.date_decision);
  const title = `${ref} — ${court} | Lexenegal`;
  const description = d.resume
    ? `${String(d.resume).slice(0, 150)}... | ${d.matiere_principale || 'Jurisprudence'} - ${court}, Sénégal.`
    : `${d.matiere_principale || 'Décision'} du ${dateFr || 'N/D'}. ${court}. Texte intégral certifié - Jurisprudence Sénégal sur Lexenegal.`;
  const keywords = (d.mots_cles && d.mots_cles.length)
    ? `${d.mots_cles.join(', ')}, Jurisprudence Sénégal, ${d.matiere_principale || ''}, ${court}`
    : `Jurisprudence Sénégal, ${court}, Droit sénégalais, Décisions de justice`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'LegalCase',
    name: `${ref} - ${court}`,
    about: d.matiere_principale || 'Jurisprudence sénégalaise',
    abstract: d.resume || `Décision de justice - ${d.matiere_principale || 'Droit'}`,
    datePublished: d.date_decision || undefined,
    inLanguage: 'fr',
    jurisdiction: { '@type': 'AdministrativeArea', name: 'Sénégal' },
    court: { '@type': 'GovernmentOrganization', name: court },
    keywords: (d.mots_cles && d.mots_cles.join(', ')) || d.matiere_principale,
    isPartOf: { '@type': 'WebSite', name: 'Lexenegal', url: SITE },
    url: canonical,
  };
  return `
  <title>${esc(title)}</title>
  <meta name="description" content="${attr(description)}" />
  <meta name="keywords" content="${attr(keywords)}" />
  <link rel="canonical" href="${attr(canonical)}" />
  <meta name="geo.region" content="SN" />
  <meta name="language" content="fr" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${attr(canonical)}" />
  <meta property="og:title" content="${attr(title)}" />
  <meta property="og:description" content="${attr(description)}" />
  <meta property="og:image" content="${attr(OG_IMAGE)}" />
  <meta property="og:locale" content="fr_SN" />
  <meta property="og:site_name" content="Lexenegal" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content="${attr(canonical)}" />
  <meta property="twitter:title" content="${attr(title)}" />
  <meta property="twitter:description" content="${attr(description)}" />
  <meta property="twitter:image" content="${attr(OG_IMAGE)}" />
  <script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

// Instantané de contenu visible (lu par le crawler avant exécution du JS)
export function buildBody(d) {
  const ref = d.reference || 'Décision';
  const court = d.chambre || d.juridiction || '';
  const dateFr = formatDateFr(d.date_decision);
  const h1 = [ref, court].filter(Boolean).join(' — ');
  const meta = [
    d.juridiction && `<li><strong>Juridiction :</strong> ${esc(d.juridiction)}</li>`,
    d.chambre && `<li><strong>Chambre :</strong> ${esc(d.chambre)}</li>`,
    dateFr && `<li><strong>Date :</strong> ${esc(dateFr)}</li>`,
    d.matiere_principale && `<li><strong>Matière :</strong> ${esc(d.matiere_principale)}</li>`,
    d.parties_principales && `<li><strong>Parties :</strong> ${esc(d.parties_principales)}</li>`,
  ].filter(Boolean).join('\n');
  const motscles = (d.mots_cles && d.mots_cles.length)
    ? `<p class="ssr-motscles"><strong>Mots-clés :</strong> ${esc(d.mots_cles.join(', '))}</p>` : '';
  const resume = d.resume ? `<section class="ssr-resume"><h2>Résumé</h2><p>${esc(d.resume)}</p></section>` : '';
  const corps = textToParagraphs(d.texte_brut || d.texte_integral || '');
  return `<div id="ssr-content" class="ssr-prerender">
  <article>
    <h1>${esc(h1)}</h1>
    <ul class="ssr-meta">${meta}</ul>
    ${motscles}
    ${resume}
    <section class="ssr-corps"><h2>Texte intégral</h2>${corps}</section>
  </article>
</div>`;
}

// Injection dans la coquille buildée (conserve les <script>/<link> d'assets)
export function injectIntoShell(shell, headHtml, bodyHtml) {
  let html = shell;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta\s+name="description"[\s\S]*?\/>/i, '');
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/>/gi, '');
  html = html.replace(/<meta\s+property="twitter:[^"]*"[^>]*\/>/gi, '');
  html = html.replace(/<\/head>/i, `${headHtml}\n</head>`);
  html = html.replace(/<div id="app">\s*<\/div>/i, `<div id="app">${bodyHtml}</div>`);
  return html;
}

// Lecture (mémoïsée) de la coquille dist/index.html. Filet de secours : si la lecture
// fichier échoue (includeFiles indisponible), on récupère la coquille via HTTP depuis
// le déploiement lui-même (la route / sert index.html) → robuste au câblage Vercel.
let _shell = null;
async function getShell(req) {
  if (_shell) return _shell;
  const candidates = [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, '..', 'index.html'),
  ];
  for (const p of candidates) {
    try { _shell = fs.readFileSync(p, 'utf8'); return _shell; } catch (e) { /* next */ }
  }
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    if (host) {
      const r = await fetch(`${proto}://${host}/index.html`);
      if (r.ok) {
        const t = await r.text();
        if (t.includes('id="app"')) { _shell = t; return _shell; }
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function fetchDecision(slug) {
  const url = `${SUPABASE_URL}/rest/v1/decisions`
    + `?slug=eq.${encodeURIComponent(slug)}`
    + `&select=reference,slug,date_decision,juridiction,chambre,matiere_principale,parties_principales,resume,mots_cles,texte_brut,texte_integral`
    + `&limit=1`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  const rows = await r.json();
  return rows && rows[0] ? rows[0] : null;
}

export default async function handler(req, res) {
  try {
    const slug = (req.query && req.query.slug) ||
      (req.url || '').replace(/^.*\/decision\//, '').replace(/[?#].*$/, '');
    const shell = await getShell(req);
    if (!slug || !shell) {
      res.statusCode = shell ? 400 : 500;
      return res.end(shell || 'Service indisponible');
    }
    const canonical = `${SITE}/decision/${slug}`;
    let decision = null;
    try { decision = await fetchDecision(slug); } catch (e) { /* dégrade vers la coquille */ }

    if (!decision) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.end(shell);
    }

    const html = injectIntoShell(shell, buildHead(decision, canonical), buildBody(decision));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.statusCode = 200;
    return res.end(html);
  } catch (e) {
    res.statusCode = 500;
    return res.end('Erreur de rendu');
  }
}
