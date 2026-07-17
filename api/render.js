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
  const heading = [d.juridiction, ref, d.chambre].filter(Boolean).join(' — ');
  const title = `${heading} | Lexenegal`;
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
    <h1>${esc([d.juridiction, ref, d.chambre].filter(Boolean).join(' — '))}</h1>
    <ul class="ssr-meta">${meta}</ul>
    ${motscles}${resume}
    <section class="ssr-corps"><h2>Texte intégral</h2>${corps}</section>
    ${cites}
  </article>`);
}

/* ---------- CODE (loi entière) ---------- */
/*
 * Règle SEO générique et FIDÈLE au type de texte (catégorie laws_and_codes) —
 * voir docs/SEO-RENDU-SSR.md. À conserver pour tous les futurs déploiements.
 *  - « version consolidée » : RÉSERVÉ aux codes (category='code'). Un décret,
 *    arrêté, loi ou Acte uniforme est un texte unique → seulement « texte intégral ».
 *  - Juridiction : Sénégal pour code/loi/decret/arrete ; OHADA pour les Actes
 *    uniformes (communautaire, 17 États) → JAMAIS « du Sénégal » sur l'OHADA.
 *  - « du Sénégal » accolé au nom : uniquement pour les codes au nom générique
 *    (« Code X »), pas quand le nom porte déjà sa référence (« Loi n° … »).
 */
function codeSeoMeta(law) {
  const baseName = law.short_title || law.title;
  const cat = String(law.category || 'code').toLowerCase();
  const isCode = cat === 'code';
  const isOhada = cat === 'ohada';
  const descriptor = isCode ? 'texte intégral et version consolidée' : 'texte intégral';
  const geo = (isCode && !/sénégal|senegal|constitution|loi\s*n[°o]/i.test(baseName)) ? ' du Sénégal' : '';
  const jurisdiction = isOhada ? 'OHADA' : 'Sénégal';
  const jurAdjective = isOhada ? 'droit OHADA' : 'droit sénégalais';
  return { baseName, cat, isCode, isOhada, descriptor, geo, jurisdiction, jurAdjective };
}

export function buildCodeHead(law, nArticles, canonical) {
  const m = codeSeoMeta(law);
  const refTxt = law.reference ? ` (${law.reference})` : '';
  const artTxt = nArticles ? `, ${nArticles} articles` : '';
  const title = `${m.baseName}${m.geo} — ${m.descriptor} | Lexenegal`;
  const tail = m.isOhada ? ' — droit uniforme OHADA.' : ' — la mémoire juridique du Sénégal.';
  const description = `${m.baseName}${m.geo}${refTxt} : ${m.descriptor}${artTxt}. `
    + `Consultation gratuite, article par article, avec la jurisprudence et les textes liés, sur Lexenegal${tail}`;
  const nameHasJur = new RegExp(m.jurisdiction, 'i').test(m.baseName);
  const keywords = [
    m.baseName,
    nameHasJur ? null : `${m.baseName} ${m.jurisdiction}`,
    `${m.baseName} texte intégral`,
    m.isCode ? `${m.baseName} version consolidée` : null,
    law.reference, m.jurAdjective, m.isOhada ? 'OHADA' : 'législation Sénégal', 'Lexenegal',
  ].filter(Boolean).join(', ');
  const schema = {
    '@context': 'https://schema.org', '@type': 'Legislation', name: law.title,
    ...(law.reference ? { legislationIdentifier: law.reference } : {}),
    ...(law.publication_date ? { datePublished: law.publication_date } : {}),
    legislationJurisdiction: { '@type': m.isOhada ? 'Organization' : 'AdministrativeArea', name: m.jurisdiction },
    inLanguage: 'fr', isPartOf: { '@type': 'WebSite', name: 'Lexenegal', url: SITE }, url: canonical,
  };
  return headBlock({ title, description, keywords, canonical, ogType: 'website', schema });
}
function abrogationBanner(law) {
  if (!law || !law.abrogation_note) return '';
  const link = law.abrogated_by_slug
    ? ` <a href="/code/${esc(law.abrogated_by_slug)}">Voir le texte en vigueur →</a>` : '';
  return `<div class="ssr-abrogation" style="background:#fef2f2;border:1px solid #fca5a5;border-left:4px solid #dc2626;color:#991b1b;padding:0.85rem 1.1rem;border-radius:8px;margin:0 0 1.25rem;">⛔ ${esc(law.abrogation_note)}${link}</div>`;
}

export function buildCodeBody(law, articles) {
  const m = codeSeoMeta(law);
  const links = (articles || []).map((a) => {
    const label = a.num || a.num_court || (a.article_number != null ? `Article ${a.article_number}` : a.slug);
    return `<li><a href="/code/${esc(law.slug)}/${esc(a.slug)}">${esc(label)}</a></li>`;
  }).join('\n');
  const n = articles && articles.length ? articles.length : 0;
  // Chapô SEO : référence + date de publication (données vérifiées en base)
  const refLine = [
    law.reference ? esc(law.reference) : '',
    law.publication_date ? `publié le ${esc(formatDateFr(law.publication_date))}` : '',
  ].filter(Boolean).join(' — ');
  const descriptorCap = m.descriptor.charAt(0).toUpperCase() + m.descriptor.slice(1);
  const intro = `<p class="ssr-code-intro">${esc(m.baseName)}${refLine ? ` — ${refLine}` : ''}. `
    + `${descriptorCap}${n ? `, ${n} articles` : ''}, consultable gratuitement article par article, `
    + `avec la jurisprudence et les textes liés.</p>`;
  // Bloc de présentation éditorial (contenu de confiance, rédigé/vérifié) si renseigné
  const presentation = law.description
    ? `<section class="ssr-presentation">${law.description}</section>`
    : '';
  return wrapContent(`<article>
    ${abrogationBanner(law)}
    <h1>${esc(m.baseName)}${esc(m.geo)} — ${esc(m.descriptor)}</h1>
    ${intro}
    ${presentation}
    <nav class="ssr-toc" aria-label="Articles"><h2>Articles · ${esc(m.baseName)}</h2><ul>${links}</ul></nav>
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
    ${abrogationBanner(law)}
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

/* ---------- ACCUEIL & INDEX DES CODES ---------- */
export function buildHomeHead(canonical) {
  const title = 'Lexenegal — Codes, lois et jurisprudence du Sénégal en texte intégral';
  const description = 'Lexenegal, la mémoire juridique du Sénégal : codes, lois, décrets, arrêtés et décisions de justice en texte intégral et version consolidée. Recherche et consultation gratuites.';
  const keywords = 'droit sénégalais, codes Sénégal, lois Sénégal, jurisprudence Sénégal, Code pénal Sénégal, Constitution du Sénégal, législation Sénégal, Lexenegal';
  const schema = {
    '@context': 'https://schema.org', '@type': 'WebSite', name: 'Lexenegal', url: SITE, inLanguage: 'fr', description,
    potentialAction: { '@type': 'SearchAction', target: `${SITE}/search?q={query}`, 'query-input': 'required name=query' },
  };
  return headBlock({ title, description, keywords, canonical, ogType: 'website', schema });
}
export function buildHomeBody(codes) {
  const items = (codes || []).map((c) => `<li><a href="/code/${esc(c.slug)}">${esc(c.short_title || c.title)}</a></li>`).join('\n');
  const nav = items ? `<nav class="ssr-home-codes" aria-label="Codes"><h2>Codes et textes en consultation</h2><ul>${items}</ul></nav>` : '';
  return wrapContent(`<article>
    <h1>Lexenegal — la mémoire juridique du Sénégal</h1>
    <p>Consultez gratuitement les <strong>codes, lois, décrets et arrêtés</strong> ainsi que la <strong>jurisprudence du Sénégal</strong> en texte intégral et version consolidée : Code pénal, Code de procédure pénale, Constitution du Sénégal, Code du travail, Code général des impôts, Actes uniformes OHADA, et les décisions de la Cour suprême, de la CCJA et du Conseil constitutionnel.</p>
    <p><a href="/codes">Tous les codes et textes</a> · <a href="/search">Rechercher dans la base</a></p>
    ${nav}
  </article>`);
}
const CAT_LABELS = { code: 'Codes', loi: 'Lois', decret: 'Décrets', arrete: 'Arrêtés', ohada: 'Actes uniformes OHADA' };
export function buildCodesHead(canonical) {
  const title = 'Tous les codes et textes juridiques du Sénégal | Lexenegal';
  const description = 'Liste complète des codes, lois, décrets, arrêtés et Actes uniformes OHADA consultables en texte intégral sur Lexenegal — la mémoire juridique du Sénégal.';
  const keywords = 'codes Sénégal, textes juridiques Sénégal, lois Sénégal, décrets Sénégal, OHADA, droit sénégalais, Lexenegal';
  const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: canonical, inLanguage: 'fr' };
  return headBlock({ title, description, keywords, canonical, ogType: 'website', schema });
}
export function buildCodesBody(texts) {
  const order = ['code', 'loi', 'decret', 'arrete', 'ohada'];
  const groups = {};
  (texts || []).forEach((t) => { const k = String(t.category || 'code').toLowerCase(); (groups[k] = groups[k] || []).push(t); });
  const sections = order.filter((k) => groups[k] && groups[k].length).map((k) => {
    const items = groups[k].map((c) => `<li><a href="/code/${esc(c.slug)}">${esc(c.short_title || c.title)}</a></li>`).join('\n');
    return `<section><h2>${esc(CAT_LABELS[k] || k)}</h2><ul>${items}</ul></section>`;
  }).join('\n');
  // catégories hors liste connue (au cas où), placées en fin
  const extra = Object.keys(groups).filter((k) => !order.includes(k)).map((k) => {
    const items = groups[k].map((c) => `<li><a href="/code/${esc(c.slug)}">${esc(c.short_title || c.title)}</a></li>`).join('\n');
    return `<section><h2>${esc(k)}</h2><ul>${items}</ul></section>`;
  }).join('\n');
  return wrapContent(`<article>
    <h1>Tous les codes et textes juridiques du Sénégal</h1>
    <p>Codes, lois, décrets, arrêtés et Actes uniformes OHADA consultables en texte intégral et version consolidée sur Lexenegal.</p>
    ${sections}${extra}
  </article>`);
}

/* ---------- DOCTRINE FISCALE (teaser public, corps gaté) ---------- */
/*
 * SSR RÉSERVÉ AU TEASER : objet, référence, service, date, destinataire, signataire.
 * `content_raw` n'est JAMAIS servi côté serveur public (anti-cloaking + anti-scraping) ;
 * le corps reste chargé côté client pour un membre connecté (gate DB Phase 1).
 */
export function buildDoctrineHead(d, canonical) {
  const objet = (d.objet || '').trim();
  const ref = (d.reference_complete || (d.numero ? `Lettre n° ${d.numero}` : 'Doctrine fiscale')).trim();
  const dateFr = formatDateFr(d.date);
  const service = d.service_emetteur || 'DGID';
  const titleCore = objet ? `${objet} — ${ref}` : ref;
  const title = `${titleCore} | Doctrine fiscale | Lexenegal`;
  const description = `Doctrine fiscale de la DGID (Sénégal) : ${ref}. `
    + `${objet ? `Objet : ${objet}. ` : ''}${service}${dateFr ? ` — ${dateFr}` : ''}. `
    + `Référence et objet en accès libre ; texte intégral réservé aux membres sur Lexenegal.`;
  const keywords = [
    objet || null, ref, 'doctrine fiscale Sénégal', 'DGID', 'circulaire fiscale',
    'note DGID', 'droit fiscal sénégalais', 'Lexenegal',
  ].filter(Boolean).join(', ');
  const schema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: titleCore, about: objet || 'Doctrine fiscale',
    ...(d.date ? { datePublished: d.date } : {}),
    inLanguage: 'fr',
    author: { '@type': 'GovernmentOrganization', name: 'Direction générale des Impôts et des Domaines (DGID)' },
    publisher: { '@type': 'Organization', name: 'Lexenegal', url: SITE },
    isPartOf: { '@type': 'CollectionPage', name: 'Doctrine fiscale', url: `${SITE}/doctrine-fiscale` },
    url: canonical,
  };
  return headBlock({ title, description, keywords, canonical, ogType: 'article', schema });
}
export function buildDoctrineBody(d) {
  const objet = (d.objet || '').trim();
  const ref = d.reference_complete || (d.numero ? `Lettre n° ${d.numero}` : 'Doctrine fiscale');
  const dateFr = formatDateFr(d.date);
  const meta = [
    ref && `<li><strong>Référence :</strong> ${esc(ref)}</li>`,
    d.service_emetteur && `<li><strong>Service émetteur :</strong> ${esc(d.service_emetteur)}</li>`,
    dateFr && `<li><strong>Date :</strong> ${esc(dateFr)}</li>`,
    d.destinataire && `<li><strong>Destinataire :</strong> ${esc(d.destinataire)}</li>`,
    d.signataire && `<li><strong>Signataire :</strong> ${esc(d.signataire)}</li>`,
  ].filter(Boolean).join('\n');
  // content_raw VOLONTAIREMENT absent : teaser uniquement côté serveur public.
  return wrapContent(`<article>
    <nav class="ssr-bc" aria-label="Fil d'Ariane"><a href="/doctrine-fiscale">Doctrine fiscale</a> › ${esc(ref)}</nav>
    <h1>${esc(objet || ref)}</h1>
    <ul class="ssr-meta">${meta}</ul>
    <section class="ssr-doctrine-gate">
      <p>Document de doctrine fiscale de la <strong>DGID</strong> (Sénégal). L'objet et les références ci-dessus sont en accès libre.</p>
      <p>Le <strong>texte intégral</strong> de cette lettre est réservé aux membres. <a href="/signup">Créez un compte gratuit</a> pour le consulter, ou parcourez l'ensemble de la <a href="/doctrine-fiscale">doctrine fiscale</a>.</p>
    </section>
  </article>`);
}

/* ---------- PAGE-THÈME de jurisprudence ---------- */
/*
 * /jurisprudence/theme/:slug — hub thématique généré depuis la base (table
 * seo_themes + RPC get_theme_page) : chapô rédigé, décisions récentes avec
 * résumés, articles de codes les plus cités, FAQ. Chantier
 * Strategie-SEO-Contenu-Topical (pages-thèmes). Données 100 % issues du corpus.
 */
export function buildThemeHead(data, canonical) {
  const t = data.theme;
  const total = data.total || 0;
  const title = `${t.label} au Sénégal : jurisprudence (${total} décisions) | Lexenegal`;
  const description = `${stripHtml(t.chapo).slice(0, 145)}… ${total} décisions de justice sénégalaises et OHADA sur « ${t.label} », avec les articles de codes cités.`;
  const keywords = [
    `${t.label} Sénégal`, `${t.label} jurisprudence`, `${t.label} droit sénégalais`,
    'jurisprudence Sénégal', 'Lexenegal',
  ].join(', ');
  const schemas = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: t.h1, description: stripHtml(t.chapo), inLanguage: 'fr', url: canonical,
    about: t.label,
    isPartOf: { '@type': 'WebSite', name: 'Lexenegal', url: SITE },
  }];
  const faq = Array.isArray(t.faq) ? t.faq.filter((f) => f && f.q && f.a) : [];
  if (faq.length) {
    schemas.push({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question', name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  return headBlock({ title, description, keywords, canonical, ogType: 'website', schema: schemas });
}
export function buildThemeBody(data) {
  const t = data.theme;
  const total = data.total || 0;
  const jurisTxt = (data.juridictions || [])
    .slice(0, 6).map((j) => `${j.juridiction} (${j.n})`).join(', ');
  const decs = (data.decisions || []).map((d) => {
    const meta = [d.juridiction, d.chambre, formatDateFr(d.date_decision)].filter(Boolean).join(' — ');
    const snippet = stripHtml(d.resume || '');
    return `<li class="ssr-theme-dec">
      <a href="/decision/${esc(d.slug)}"><strong>${esc(d.reference || 'Décision')}</strong></a>
      ${meta ? `<span class="ssr-theme-dec-meta"> — ${esc(meta)}</span>` : ''}
      ${snippet ? `<p>${esc(snippet)}</p>` : ''}
    </li>`;
  }).join('\n');
  const arts = (data.articles || []).map((a) =>
    `<li><a href="/code/${esc(a.code_slug)}/${esc(a.article_slug)}">${esc(a.article_label)} — ${esc(a.code_title)}</a> <span class="ssr-theme-art-n">(cité par ${a.n} décision${a.n > 1 ? 's' : ''})</span></li>`
  ).join('\n');
  const faq = Array.isArray(t.faq) ? t.faq.filter((f) => f && f.q && f.a) : [];
  const faqHtml = faq.length
    ? `<section class="ssr-theme-faq"><h2>Questions fréquentes — ${esc(t.label)}</h2>
       ${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n')}</section>`
    : '';
  return wrapContent(`<article>
    <nav class="ssr-bc" aria-label="Fil d'Ariane"><a href="/jurisprudence">Jurisprudence</a> › ${esc(t.label)}</nav>
    <h1>${esc(t.h1)}</h1>
    <p class="ssr-theme-chapo">${esc(t.chapo)}</p>
    <p class="ssr-theme-stats"><strong>${total} décisions</strong> sur ce thème dans la base${jurisTxt ? ` : ${esc(jurisTxt)}.` : '.'}</p>
    ${arts ? `<section class="ssr-theme-arts"><h2>Articles de codes les plus cités</h2><ul>${arts}</ul></section>` : ''}
    <section class="ssr-theme-decs"><h2>Décisions récentes — ${esc(t.label)}</h2><ul>${decs}</ul></section>
    ${faqHtml}
    <p class="ssr-theme-more"><a href="/search?q=${encodeURIComponent(t.label)}">Rechercher « ${esc(t.label)} » dans toute la base →</a></p>
  </article>`);
}

/* ---------- GUIDES PRATIQUES (/guides et /guides/:slug) ---------- */
/*
 * Guides éditoriaux (table guides, contenu rédigé/vérifié par nous → HTML de
 * confiance injecté tel quel). Chaque guide = réponse directe + H2 questions +
 * FAQ (JSON-LD Article + FAQPage) + liens vers pages-thèmes et codes.
 */
export function buildGuideHead(gd, canonical) {
  const title = `${gd.title} | Lexenegal`;
  const description = gd.description || '';
  const schemas = [{
    '@context': 'https://schema.org', '@type': 'Article',
    headline: gd.title, description, inLanguage: 'fr', url: canonical,
    ...(gd.published_at ? { datePublished: gd.published_at } : {}),
    ...(gd.updated_at ? { dateModified: gd.updated_at } : {}),
    author: { '@type': 'Organization', name: 'Lexenegal', url: SITE },
    publisher: { '@type': 'Organization', name: 'Lexenegal', url: SITE },
    isPartOf: { '@type': 'CollectionPage', name: 'Guides pratiques', url: `${SITE}/guides` },
  }];
  const faq = Array.isArray(gd.faq) ? gd.faq.filter((f) => f && f.q && f.a) : [];
  if (faq.length) {
    schemas.push({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question', name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  const keywords = `${gd.title}, droit sénégalais, guide juridique Sénégal, Lexenegal`;
  return headBlock({ title, description, keywords, canonical, ogType: 'article', schema: schemas });
}
export function buildGuideBody(gd) {
  const faq = Array.isArray(gd.faq) ? gd.faq.filter((f) => f && f.q && f.a) : [];
  const faqHtml = faq.length
    ? `<section class="ssr-guide-faq"><h2>Questions fréquentes</h2>
       ${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n')}</section>`
    : '';
  const themeLink = gd.theme_slug
    ? `<p class="ssr-guide-theme"><a href="/jurisprudence/theme/${esc(gd.theme_slug)}">Voir la jurisprudence liée à ce guide →</a></p>`
    : '';
  const dateFr = formatDateFr(gd.published_at);
  return wrapContent(`<article>
    <nav class="ssr-bc" aria-label="Fil d'Ariane"><a href="/guides">Guides pratiques</a> › ${esc(gd.title)}</nav>
    <h1>${esc(gd.h1 || gd.title)}</h1>
    ${dateFr ? `<p class="ssr-guide-date">Publié le ${esc(dateFr)} — Lexenegal, la mémoire juridique du Sénégal.</p>` : ''}
    <div class="ssr-guide-body">${gd.content_html || ''}</div>
    ${faqHtml}
    ${themeLink}
  </article>`);
}
export function buildGuidesHead(canonical) {
  const title = 'Guides pratiques du droit sénégalais | Lexenegal';
  const description = 'Guides clairs et vérifiés sur le droit sénégalais : licenciement, succession, divorce, recouvrement de créances… avec la jurisprudence et les textes liés.';
  const schema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Guides pratiques du droit sénégalais', description, inLanguage: 'fr', url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Lexenegal', url: SITE },
  };
  return headBlock({ title, description, keywords: 'guide juridique Sénégal, droit sénégalais pratique, Lexenegal', canonical, ogType: 'website', schema });
}
export function buildGuidesBody(guides) {
  const items = (guides || []).map((gd) =>
    `<li><a href="/guides/${esc(gd.slug)}">${esc(gd.title)}</a>${gd.description ? `<p>${esc(gd.description)}</p>` : ''}</li>`
  ).join('\n');
  return wrapContent(`<article>
    <h1>Guides pratiques du droit sénégalais</h1>
    <p>Des réponses claires, appuyées sur les <a href="/codes">codes et lois du Sénégal</a> et la <a href="/jurisprudence">jurisprudence</a>, aux questions juridiques les plus fréquentes.</p>
    <ul class="ssr-guides-list">${items}</ul>
  </article>`);
}

/* ---------- HUB JURISPRUDENCE (/jurisprudence) ---------- */
/*
 * Page pilier distincte de /search (qui reste la page de RÉSULTATS de recherche) :
 * porte d'entrée SEO de la jurisprudence — matières + thèmes (pages seo_themes).
 */
export function buildJurisprudenceHead(canonical) {
  const title = 'Jurisprudence du Sénégal — décisions de justice en texte intégral | Lexenegal';
  const description = 'Toute la jurisprudence du Sénégal et de l’OHADA : Cour suprême, Cour de cassation, CCJA, Conseil constitutionnel, cours d’appel. Décisions en texte intégral, classées par matière et par thème.';
  const keywords = 'jurisprudence Sénégal, décisions de justice Sénégal, Cour suprême Sénégal, CCJA, arrêts Sénégal, droit sénégalais, Lexenegal';
  const schema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Jurisprudence du Sénégal', description, inLanguage: 'fr', url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Lexenegal', url: SITE },
  };
  return headBlock({ title, description, keywords, canonical, ogType: 'website', schema });
}
export function buildJurisprudenceBody(themes) {
  const list = themes || [];
  const matieres = list.filter((t) => t.matiere);
  const sujets = list.filter((t) => !t.matiere);
  const li = (t) => `<li><a href="/jurisprudence/theme/${esc(t.slug)}">${esc(t.label)}</a>${t.cached_total ? ` <span class="ssr-theme-art-n">(${t.cached_total} décisions)</span>` : ''}</li>`;
  return wrapContent(`<article>
    <h1>Jurisprudence du Sénégal et de l'OHADA</h1>
    <p>Consultez les <strong>décisions de justice du Sénégal</strong> en texte intégral : Cour suprême, Cour de cassation, Conseil constitutionnel, cours d'appel et tribunaux, ainsi que la <strong>Cour commune de justice et d'arbitrage (CCJA)</strong> de l'OHADA. Chaque décision est reliée aux articles de codes qu'elle cite.</p>
    <p><a href="/search">Rechercher une décision, un mot-clé ou une référence →</a></p>
    ${matieres.length ? `<section><h2>Jurisprudence par matière</h2><ul>${matieres.map(li).join('\n')}</ul></section>` : ''}
    ${sujets.length ? `<section><h2>Jurisprudence par thème</h2><ul>${sujets.map(li).join('\n')}</ul></section>` : ''}
  </article>`);
}

/* ---------- Accès Supabase REST ---------- */
async function sb(pathq) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathq}`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  return r.json();
}
async function sbRpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`supabase rpc ${r.status}`);
  return r.json();
}
const one = (rows) => (rows && rows[0]) ? rows[0] : null;
async function fetchHomeCodes() {
  try { return await sb(`laws_and_codes?is_active=eq.true&category=eq.code&select=slug,title,short_title&order=title&limit=60`); }
  catch (e) { return []; }
}
async function fetchAllTexts() {
  try { return await sb(`laws_and_codes?is_active=eq.true&select=slug,title,short_title,category&order=category,title&limit=300`); }
  catch (e) { return []; }
}
async function fetchDecision(slug) {
  return one(await sb(`decisions?slug=eq.${encodeURIComponent(slug)}&select=id,reference,slug,date_decision,juridiction,chambre,matiere_principale,parties_principales,resume,mots_cles,texte_brut,texte_integral&limit=1`));
}
async function fetchCitedArticles(decisionId) {
  try {
    return await sb(`decision_article_links?decision_id=eq.${decisionId}&select=article:articles(slug,num,num_court,article_number,code:laws_and_codes(slug,title))&limit=40`);
  } catch (e) { return []; }
}
async function fetchDoctrine(slug) {
  // Teaser uniquement : content_raw EXCLU du select serveur public.
  return one(await sb(`doctrine?slug=eq.${encodeURIComponent(slug)}&select=id,slug,numero,annee,date,service_emetteur,reference_complete,objet,destinataire,signataire&limit=1`));
}
// Anciens slugs doctrine (numériques + doublons -occ retirés) → nouveau slug SEO.
// Alimente le 301 permanent : aucune URL indexée ne casse après la refonte des slugs.
async function fetchDoctrineRedirect(oldSlug) {
  return one(await sb(`doctrine_slug_redirects?old_slug=eq.${encodeURIComponent(oldSlug)}&select=new_slug&limit=1`));
}
async function fetchGuide(slug) {
  return one(await sb(`guides?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=slug,title,h1,description,content_html,faq,theme_slug,published_at,updated_at&limit=1`));
}
async function fetchGuidesIndex() {
  try { return await sb(`guides?is_active=eq.true&select=slug,title,description,published_at&order=published_at.desc&limit=200`); }
  catch (e) { return []; }
}
async function fetchThemesIndex() {
  try { return await sb(`seo_themes?is_active=eq.true&select=slug,label,matiere,cached_total&order=cached_total.desc&limit=200`); }
  catch (e) { return []; }
}
async function fetchThemePage(slug) {
  // RPC unique : thème + total + juridictions + 40 décisions + 12 articles cités.
  const data = await sbRpc('get_theme_page', { p_slug: slug });
  return (data && data.theme) ? data : null;
}
async function fetchLaw(slug) {
  return one(await sb(`laws_and_codes?slug=eq.${encodeURIComponent(slug)}&select=id,title,short_title,category,slug,reference,publication_date,description,abrogation_note,abrogated_by_slug&limit=1`));
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
    // Contenu RETIRÉ volontairement (décision masquée is_active=false, ex. OHADA hors
    // périmètre) : 410 Gone + noindex → désindexation propre, sans 404 ni faux 200.
    const serveGone = () => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      res.statusCode = 410;
      return res.end(shell.replace(/<\/head>/i, '<meta name="robots" content="noindex, follow" />\n</head>'));
    };
    // 301 permanent : transfère le SEO de l'ancienne URL vers la nouvelle (refonte slugs).
    const serve301 = (location) => {
      res.statusCode = 301;
      res.setHeader('Location', location);
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      return res.end();
    };
    // Erreur passagère (Supabase indisponible) : 503 SANS noindex ni cache, pour que
    // Google réessaie plus tard au lieu de désindexer une page valide sur un incident.
    const serve503 = () => {
      res.statusCode = 503;
      res.setHeader('Retry-After', '300');
      res.setHeader('Cache-Control', 'no-store');
      return res.end('Service momentanément indisponible');
    };

    if (type === 'home') {
      const codes = await fetchHomeCodes();
      return serveHtml(buildHomeHead(`${SITE}/`), buildHomeBody(codes));
    }

    if (type === 'codes') {
      const texts = await fetchAllTexts();
      return serveHtml(buildCodesHead(`${SITE}/codes`), buildCodesBody(texts));
    }

    if (type === 'doctrine') {
      const slug = q.slug;
      if (!slug) return serveShell();
      let d = null;
      try { d = await fetchDoctrine(slug); } catch (e) { return serve503(); }
      if (!d) {
        // Slug inconnu : peut-être un ancien slug → 301 vers le nouveau avant de renoncer.
        let redir = null;
        try { redir = await fetchDoctrineRedirect(slug); } catch (e) { /* */ }
        if (redir && redir.new_slug && redir.new_slug !== slug) {
          return serve301(`${SITE}/doctrine-fiscale/${encodeURIComponent(redir.new_slug)}`);
        }
        return serveShell(60, true);
      }
      const canonical = `${SITE}/doctrine-fiscale/${slug}`;
      return serveHtml(buildDoctrineHead(d, canonical), buildDoctrineBody(d));
    }

    if (type === 'guides') {
      const guides = await fetchGuidesIndex();
      return serveHtml(buildGuidesHead(`${SITE}/guides`), buildGuidesBody(guides));
    }

    if (type === 'guide') {
      const slug = q.slug;
      if (!slug) return serveShell();
      let gd = null;
      try { gd = await fetchGuide(slug); } catch (e) { return serve503(); }
      if (!gd) return serveShell(60, true);
      const canonical = `${SITE}/guides/${slug}`;
      return serveHtml(buildGuideHead(gd, canonical), buildGuideBody(gd));
    }

    if (type === 'jurisprudence') {
      const themes = await fetchThemesIndex();
      return serveHtml(buildJurisprudenceHead(`${SITE}/jurisprudence`), buildJurisprudenceBody(themes));
    }

    if (type === 'theme') {
      const slug = q.slug;
      if (!slug) return serveShell();
      let data = null;
      try { data = await fetchThemePage(slug); } catch (e) { return serve503(); }
      if (!data) return serveShell(60, true);
      const canonical = `${SITE}/jurisprudence/theme/${slug}`;
      return serveHtml(buildThemeHead(data, canonical), buildThemeBody(data));
    }

    if (type === 'code') {
      const slug = q.slug;
      if (!slug) return serveShell();
      let law = null;
      try { law = await fetchLaw(slug); } catch (e) { return serve503(); }
      if (!law) return serveShell(60, true);
      let articles = [];
      try { articles = await fetchCodeArticles(law.id); } catch (e) { /* */ }
      const canonical = `${SITE}/code/${slug}`;
      return serveHtml(buildCodeHead(law, articles.length, canonical), buildCodeBody(law, articles));
    }

    if (type === 'article') {
      const codeSlug = q.code, artSlug = q.slug;
      if (!codeSlug || !artSlug) return serveShell();
      // Anciens slugs avec espaces (ex. « article-307 bis ») : 301 vers la forme tiretée.
      if (/\s/.test(artSlug)) {
        return serve301(`${SITE}/code/${encodeURIComponent(codeSlug)}/${encodeURIComponent(artSlug.replace(/\s+/g, '-'))}`);
      }
      let law = null;
      try { law = await fetchLaw(codeSlug); } catch (e) { return serve503(); }
      if (!law) return serveShell(60, true);
      let art = null;
      try { art = await fetchArticle(law.id, artSlug); } catch (e) { return serve503(); }
      if (!art) {
        // Ancien schéma d'URL où le slug d'article était préfixé par le slug du texte
        // (« X/X-art-8 ») : 301 vers le slug court si celui-ci existe en base.
        if (artSlug.startsWith(`${codeSlug}-`)) {
          const short = artSlug.slice(codeSlug.length + 1);
          let alt = null;
          try { alt = await fetchArticle(law.id, short); } catch (e) { /* */ }
          if (alt) return serve301(`${SITE}/code/${encodeURIComponent(codeSlug)}/${encodeURIComponent(short)}`);
        }
        return serveShell(60, true);
      }
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
    try { decision = await fetchDecision(slug); } catch (e) { return serve503(); }
    if (!decision) {
      // Décision masquée (existe mais is_active=false) → 410 Gone ; sinon coquille noindex.
      let gone = false;
      try { gone = (await sbRpc('rpc_decision_gone', { p_slug: slug })) === true; } catch (e) { /* */ }
      if (gone) return serveGone();
      return serveShell(60, true);
    }
    const cited = decision.id ? await fetchCitedArticles(decision.id) : [];
    const canonical = `${SITE}/decision/${slug}`;
    return serveHtml(buildDecisionHead(decision, canonical), buildDecisionBody(decision, cited));
  } catch (e) {
    res.statusCode = 500;
    return res.end('Erreur de rendu');
  }
}
