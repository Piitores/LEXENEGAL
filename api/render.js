/*
 * api/render.js — Rendu SEO côté serveur (Vercel) pour les pages dynamiques.
 *
 * Pourquoi : la SPA Vite ne renvoie qu'une coquille vide au crawler Google
 * (<div id="app"></div>) → décisions/codes/articles invisibles. Cette fonction
 * renvoie un HTML COMPLET (titre + meta + canonical + OG + JSON-LD + contenu
 * visible) ; la SPA prend ensuite le relais (React createRoot vide #app au montage).
 *
 * Branché via vercel.json :
 *   /decision/:slug              -> /api/render?type=decision&slug=:slug
 *   /code/:slug                  -> /api/render?type=code&slug=:slug
 *   /code/:codeSlug/:articleSlug -> /api/render?type=article&code=:codeSlug&slug=:articleSlug
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Config Supabase : process.env d'abord, sinon repli sur le .env versionné (les
// fonctions Vercel n'héritent pas des variables VITE_* à l'exécution). Clé anon publique.
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
function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function formatDateFr(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch (e) { return ''; }
}
function ldjson(obj) { return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`; }
function headBlock({ title, description, keywords, canonical, ogType, schema }) {
  return `
  <title>${esc(title)}</title>
  <meta name="description" content="${attr(description)}" />
  ${keywords ? `<meta name="keywords" content="${attr(keywords)}" />` : ''}
  <link rel="canonical" href="${attr(canonical)}" />
  <meta name="geo.region" content="SN" />
  <meta name="language" content="fr" />
  <meta property="og:type" content="${ogType || 'article'}" />
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
  ${ldjson(schema)}`;
}

function textToParagraphs(raw) {
  if (!raw) return '';
  let s = String(raw).replace(/\x0c/g, '\n');
  if (/<div class=|class="decision-body"|class="master-composition"/.test(s)) return s;
  let blocks = s.split(/\n[ \t]*\n+/);
  if (blocks.length < 2) blocks = s.split(/;\s+/).map((b, i, a) => (i < a.length - 1 ? b + ' ;' : b));
  return blocks.map((b) => b.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((b) => b.length > 2).map((b) => `<p>${esc(b)}</p>`).join('\n');
}
function wrapContent(inner) { return `<div id="ssr-content" class="ssr-prerender">${inner}</div>`; }

/* ---------- DÉCISION ---------- */
export function buildDecisionHead(d, canonical) {
  const ref = d.reference || 'Décision';
  const court = d.chambre || d.juridiction || 'Cour Suprême du Sénégal';
  const dateFr = formatDateFr(d.date_decision);
  const title = `${ref} — ${court} | Lexenegal`;
  const description = d.resume
    ? `${stripHtml(d.resume).slice(0, 150)}... | ${d.matiere_principale || 'Jurisprudence'} - ${court}, Sénégal.`
    : `${d.matiere_principale || 'Décision'} du ${dateFr || 'N/D'}. ${court}. Texte intégral certifié - Jurisprudence Sénégal sur Lexenegal.`;
  const keywords = (d.mots_cles && d.mots_cles.length)
    ? `${d.mots_cles.join(', ')}, Jurisprudence Sénégal, ${d.matiere_principale || ''}, ${court}`
    : `Jurisprudence Sénégal, ${court}, Droit sénégalais, Décisions de justice`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'LegalCase', name: `${ref} - ${court}`,
    about: d.matiere_principale || 'Jurisprudence sénégalaise',
    abstract: stripHtml(d.resume) || `Décision de justice - ${d.matiere_principale || 'Droit'}`,
    datePublished: d.date_decision || undefined, inLanguage: 'fr',
    jurisdiction: { '@type': 'AdministrativeArea', name: 'Sénégal' },
    court: { '@type': 'GovernmentOrganization', name: court },
    keywords: (d.mots_cles && d.mots_cles.join(', ')) || d.matiere_principale,
    isPartOf: { '@type': 'WebSite', name: 'Lexenegal', url: SITE }, url: canonical,
  };
  return headBlock({ title, description, keywords, canonical, ogType: 'article', schema });
}
export function buildDecisionBody(d, cited) {
  const ref = d.reference || 'Décision';
  const court = d.chambre || d.juridiction || '';
  const dateFr = formatDateFr(d.date_decision);
  const meta = [
    d.juridiction && `<li><strong>Juridiction :</strong> ${esc(d.juridiction)}</li>`,
    d.chambre && `<li><strong>Chambre :</strong> ${esc(d.chambre)}</li>`,
    dateFr && `<li><strong>Date :</strong> ${esc(dateFr)}</li>`,
    d.matiere_principale && `<li><strong>Matière :</strong> ${esc(d.matiere_principale)}</li>`,
    d.parties_principales && `<li><strong>Parties :</strong> ${esc(d.parties_principales)}</li>`,
  ].filter(Boolean).join('\n');
  const motscles = (d.mots_cles && d.mots_cles.length)
    ? `<p class="ssr-motscles"><strong>Mots-clés :</strong> ${esc(d.mots_cles.join(', '))}</p>` : '';
  const resume = d.resume ? `<section class="ssr-resume"><h2>Résumé</h2><p>${esc(stripHtml(d.resume))}</p></section>` : '';
  const corps = textToParagraphs(d.texte_brut || d.texte_integral || '');
  const cites = (cited && cited.length)
    ? `<section class="ssr-cited"><h2>Textes et articles cités</h2><ul>${cited.map((c) => {
        const a = c.article; if (!a || !a.code || !a.code.slug || !a.slug) return '';
        const label = a.num || a.num_court || (a.article_number != null ? `Article ${a.article_number}` : 'Article');
        return `<li><a href="/code/${esc(a.code.slug)}/${esc(a.slug)}">${esc(label)} — ${esc(a.code.title)}</a></li>`;
      }).filter(Boolean).join('')}</ul></section>`
    : '';
  return wrapContent(`<article>
    <h1>${esc([ref, court].filter(Boolean).join(' — '))}</h1>
    <ul class="ssr-meta">${meta}</ul>
    ${motscles}${resume}
    <section class="ssr-corps"><h2>Texte intégral</h2>${corps}</section>
    ${cites}
  </article>`);
}

/* ---------- CODE (loi entière) ---------- */
export function buildCodeHead(law, nArticles, canonical) {
  const title = `${law.title} | Lexenegal`;
  const description = `${law.title} — texte intégral consolidé${nArticles ? ` (${nArticles} articles)` : ''}. Droit sénégalais : consultez chaque article sur Lexenegal.`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'Legislation', name: law.title,
    legislationJurisdiction: { '@type': 'AdministrativeArea', name: 'Sénégal' },
    inLanguage: 'fr', isPartOf: { '@type': 'WebSite', name: 'Lexenegal', url: SITE }, url: canonical,
  };
  return headBlock({ title, description, keywords: `${law.title}, Droit sénégalais, texte intégral, Lexenegal`, canonical, ogType: 'website', schema });
}
export function buildCodeBody(law, articles) {
  const links = (articles || []).map((a) => {
    const label = a.num || a.num_court || (a.article_number != null ? `Article ${a.article_number}` : a.slug);
    return `<li><a href="/code/${esc(law.slug)}/${esc(a.slug)}">${esc(label)}</a></li>`;
  }).join('\n');
  return wrapContent(`<article>
    <h1>${esc(law.title)}</h1>
    <p>Texte intégral consolidé${articles && articles.length ? ` — ${articles.length} articles` : ''}. Cliquez sur un article pour en consulter le texte.</p>
    <nav class="ssr-toc" aria-label="Articles"><h2>Articles</h2><ul>${links}</ul></nav>
  </article>`);
}

/* ---------- ARTICLE de loi ---------- */
export function buildArticleHead(law, art, canonical, plain) {
  const numLabel = art.num || art.num_court || (art.article_number != null ? `Article ${art.article_number}` : 'Article');
  const title = `${numLabel} — ${law.title} | Lexenegal`;
  const description = plain
    ? `${plain.slice(0, 155)}…`
    : `Texte intégral de l'${numLabel.toLowerCase()} du ${law.title}. Droit sénégalais consolidé sur Lexenegal.`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'Legislation', name: `${numLabel} — ${law.title}`,
    legislationIdentifier: String(art.article_number != null ? art.article_number : numLabel),
    inLanguage: 'fr',
    isPartOf: { '@type': 'Legislation', name: law.title, url: `${SITE}/code/${law.slug}` },
    legislationJurisdiction: { '@type': 'AdministrativeArea', name: 'Sénégal' }, url: canonical,
  };
  return headBlock({ title, description, keywords: `${numLabel}, ${law.title}, Droit sénégalais, Lexenegal`, canonical, ogType: 'article', schema });
}
export function buildArticleBody(law, art, contentHtml, citing) {
  const numLabel = art.num || art.num_court || (art.article_number != null ? `Article ${art.article_number}` : 'Article');
  const citingHtml = (citing && citing.length)
    ? `<section class="ssr-citing"><h2>Décisions citant cet article</h2><ul>${citing.map((c) => {
        const d = c.decision; if (!d || !d.slug) return '';
        return `<li><a href="/decision/${esc(d.slug)}">${esc(d.reference || 'Décision')}</a>${d.chambre ? ` — ${esc(d.chambre)}` : ''}${d.date_decision ? ` (${esc(formatDateFr(d.date_decision))})` : ''}</li>`;
      }).filter(Boolean).join('')}</ul></section>`
    : '';
  // contentHtml = HTML déjà généré par notre pipeline (de confiance) -> injecté tel quel
  return wrapContent(`<article>
    <nav class="ssr-bc" aria-label="Fil d'Ariane"><a href="/code/${esc(law.slug)}">${esc(law.title)}</a> › ${esc(numLabel)}</nav>
    <h1>${esc(numLabel)}</h1>
    <div class="ssr-article-body">${contentHtml || `<p>Texte de l'article non disponible.</p>`}</div>
    ${citingHtml}
  </article>`);
}

/* ---------- Coquille dist/index.html (file + filet HTTP) ---------- */
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
      if (r.ok) { const t = await r.text(); if (t.includes('id="app"')) { _shell = t; return _shell; } }
    }
  } catch (e) { /* ignore */ }
  return null;
}
function injectIntoShell(shell, headHtml, bodyHtml) {
  let html = shell;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta\s+name="description"[\s\S]*?\/>/i, '');
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/>/gi, '');
  html = html.replace(/<meta\s+property="twitter:[^"]*"[^>]*\/>/gi, '');
  html = html.replace(/<\/head>/i, `${headHtml}\n</head>`);
  html = html.replace(/<div id="app">\s*<\/div>/i, `<div id="app">${bodyHtml}</div>`);
  return html;
}

/* ---------- Accès Supabase REST ---------- */
async function sb(pathq) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathq}`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  return r.json();
}
const one = (rows) => (rows && rows[0]) ? rows[0] : null;
async function fetchDecision(slug) {
  return one(await sb(`decisions?slug=eq.${encodeURIComponent(slug)}&select=id,reference,slug,date_decision,juridiction,chambre,matiere_principale,parties_principales,resume,mots_cles,texte_brut,texte_integral&limit=1`));
}
async function fetchCitedArticles(decisionId) {
  try {
    return await sb(`decision_article_links?decision_id=eq.${decisionId}&select=article:articles(slug,num,num_court,article_number,code:laws_and_codes(slug,title))&limit=40`);
  } catch (e) { return []; }
}
async function fetchLaw(slug) {
  return one(await sb(`laws_and_codes?slug=eq.${encodeURIComponent(slug)}&select=id,title,category,slug&limit=1`));
}
async function fetchCodeArticles(codeId) {
  return sb(`articles?code_id=eq.${codeId}&select=num,num_court,article_number,slug&order=display_order&limit=3000`);
}
async function fetchArticle(codeId, artSlug) {
  return one(await sb(`articles?code_id=eq.${codeId}&slug=eq.${encodeURIComponent(artSlug)}&select=id,num,num_court,article_number,slug,content_html&limit=1`));
}
async function fetchCurrentVersion(artId) {
  try {
    const rows = await sb(`article_versions?article_id=eq.${artId}&select=content,is_current&order=effective_date.desc&limit=5`);
    return (rows.find((v) => v.is_current) || rows[0] || {}).content || '';
  } catch (e) { return ''; }
}
async function fetchCitingDecisions(artId) {
  try {
    return await sb(`decision_article_links?article_id=eq.${artId}&select=citation_text,decision:decisions(reference,slug,date_decision,chambre)&limit=20`);
  } catch (e) { return []; }
}

/* ---------- Handler ---------- */
export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const type = q.type || 'decision';
    const shell = await getShell(req);
    if (!shell) { res.statusCode = 500; return res.end('Service indisponible'); }
    const serveShell = (maxAge = 60, noindex = false) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', `public, s-maxage=${maxAge}`);
      // Contenu introuvable (slug inexistant OU décision/code masqué via is_active) :
      // on sert la coquille SPA avec un noindex propre pour une désindexation rapide,
      // sans bloquer le suivi des liens internes.
      const out = noindex
        ? shell.replace(/<\/head>/i, '<meta name="robots" content="noindex, follow" />\n</head>')
        : shell;
      return res.end(out);
    };
    const serveHtml = (headHtml, bodyHtml) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.statusCode = 200;
      return res.end(injectIntoShell(shell, headHtml, bodyHtml));
    };

    if (type === 'code') {
      const slug = q.slug;
      if (!slug) return serveShell();
      let law = null;
      try { law = await fetchLaw(slug); } catch (e) { /* */ }
      if (!law) return serveShell(60, true);
      let articles = [];
      try { articles = await fetchCodeArticles(law.id); } catch (e) { /* */ }
      const canonical = `${SITE}/code/${slug}`;
      return serveHtml(buildCodeHead(law, articles.length, canonical), buildCodeBody(law, articles));
    }

    if (type === 'article') {
      const codeSlug = q.code, artSlug = q.slug;
      if (!codeSlug || !artSlug) return serveShell();
      let law = null;
      try { law = await fetchLaw(codeSlug); } catch (e) { /* */ }
      if (!law) return serveShell(60, true);
      let art = null;
      try { art = await fetchArticle(law.id, artSlug); } catch (e) { /* */ }
      if (!art) return serveShell(60, true);
      const [content, citing] = await Promise.all([
        art.content_html ? Promise.resolve(art.content_html) : fetchCurrentVersion(art.id),
        fetchCitingDecisions(art.id),
      ]);
      const canonical = `${SITE}/code/${codeSlug}/${artSlug}`;
      return serveHtml(buildArticleHead(law, art, canonical, stripHtml(content)), buildArticleBody(law, art, content, citing));
    }

    // decision (défaut)
    const slug = q.slug || (req.url || '').replace(/^.*\/decision\//, '').replace(/[?#].*$/, '');
    if (!slug) return serveShell();
    let decision = null;
    try { decision = await fetchDecision(slug); } catch (e) { /* */ }
    if (!decision) return serveShell(60, true);
    const cited = decision.id ? await fetchCitedArticles(decision.id) : [];
    const canonical = `${SITE}/decision/${slug}`;
    return serveHtml(buildDecisionHead(decision, canonical), buildDecisionBody(decision, cited));
  } catch (e) {
    res.statusCode = 500;
    return res.end('Erreur de rendu');
  }
}
