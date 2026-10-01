/*
 * api/render.js - Rendu SEO côté serveur (Vercel) pour les pages dynamiques.
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
 *   /ccn/:segment                -> /api/render?type=code&ccn=:segment
 *   /ccn/:segment/:articleSlug   -> /api/render?type=article&ccn=:segment&slug=:articleSlug
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

/*
 * Adresses publiques des textes et des articles.
 * ⛔ COPIE À L'IDENTIQUE de src/lib/urls.ts (règle unique, décision du propriétaire du
 * 27/09/2026 : conventions collectives sous /ccn/<segment>, « ccn-banques » → /ccn/banques,
 * « ccni-2019 » → /ccn/ccni-2019 ; le reste sous /code/<slug>). Une fonction Vercel en .js ne
 * peut pas importer le module TypeScript : toute modification de la règle se reporte ici, dans
 * api/sitemap.js et dans lexenegal-mcp/src/links.ts. Le test src/lib/__tests__/urlsApi.test.ts
 * vérifie que les copies répondent comme l'original.
 */
export function estConvention(slug) {
  return /^ccni?-/.test(slug ?? '');
}
export function segmentConvention(slug) {
  return slug.startsWith('ccn-') ? slug.slice(4) : slug;
}
export function slugDepuisSegmentCcn(segment) {
  return /^ccni?-/.test(segment) ? segment : `ccn-${segment}`;
}
export function urlTexte(slug) {
  return estConvention(slug) ? `/ccn/${segmentConvention(slug)}` : `/code/${slug}`;
}
export function urlArticle(codeSlug, articleSlug) {
  return `${urlTexte(codeSlug)}/${articleSlug}`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function attr(s) { return esc(s).replace(/\n/g, ' '); }
function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function formatDateFr(d) {
  if (!d) return '';
  // timeZone UTC : une date ISO sans heure est minuit UTC ; sans cela, un serveur à l'ouest de Greenwich afficherait la veille.
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  catch (e) { return ''; }
}
/* Mention de publication au Journal officiel (laws_and_codes.jo_numero / jo_date / jo_page), remplie
 * seulement pour des références vérifiées sur pièce. Complète ou rien. Même règle que src/lib/joReference.ts. */
function joReferenceSsr(law) {
  if (!law || !law.jo_numero || !law.jo_date) return '';
  const date = (formatDateFr(law.jo_date) || '').replace(/^1 /, '1er ');
  if (!date || date === 'Invalid Date') return '';
  return `Journal officiel n° ${law.jo_numero} du ${date}${law.jo_page ? `, p. ${law.jo_page}` : ''}`;
}
function ldjson(obj) { return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`; }
/*
 * data-rh="true" : marque de propriété de react-helmet-async.
 *
 * Helmet ne supprime que les balises portant cet attribut avant d'insérer les
 * siennes. Sans lui, le <link rel="canonical"> du rendu serveur SURVIVAIT et
 * celui de Helmet s'ajoutait à côté : deux canonical dans le DOM final, que
 * Google ignore tous les deux (« Duplicate without user-selected canonical »).
 * En marquant les balises que <SEO> réémet, Helmet les REMPLACE proprement.
 *
 * ⚠️ Volontairement PAS appliqué au JSON-LD : le schéma du serveur est
 * spécifique à la page (Legislation / LegalCase) et vaut mieux que le schéma
 * générique du composant React — on le laisse hors du périmètre de Helmet.
 */
const RH = 'data-rh="true"';
function headBlock({ title, description, keywords, canonical, ogType, schema }) {
  return `
  <title ${RH}>${esc(title)}</title>
  <meta ${RH} name="description" content="${attr(description)}" />
  ${keywords ? `<meta ${RH} name="keywords" content="${attr(keywords)}" />` : ''}
  <link ${RH} rel="canonical" href="${attr(canonical)}" />
  <meta ${RH} name="geo.region" content="SN" />
  <meta ${RH} name="language" content="fr" />
  <meta ${RH} property="og:type" content="${ogType || 'article'}" />
  <meta ${RH} property="og:url" content="${attr(canonical)}" />
  <meta ${RH} property="og:title" content="${attr(title)}" />
  <meta ${RH} property="og:description" content="${attr(description)}" />
  <meta ${RH} property="og:image" content="${attr(OG_IMAGE)}" />
  <meta ${RH} property="og:locale" content="fr_SN" />
  <meta ${RH} property="og:site_name" content="Lexenegal" />
  <meta ${RH} property="twitter:card" content="summary_large_image" />
  <meta ${RH} property="twitter:url" content="${attr(canonical)}" />
  <meta ${RH} property="twitter:title" content="${attr(title)}" />
  <meta ${RH} property="twitter:description" content="${attr(description)}" />
  <meta ${RH} property="twitter:image" content="${attr(OG_IMAGE)}" />
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
  const heading = [d.juridiction, ref, d.chambre].filter(Boolean).join(' - ');
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
  /*
   * BreadcrumbList SERVEUR (Accueil > Jurisprudence > reference).
   *
   * Le fil d'Ariane de la page decision n'existait qu'en microdonnees, posees
   * par React APRES le rendu : Google ne le voyait qu'au second passage, d'ou
   * des rapports « Missing field item » instables. Il est desormais dans le
   * HTML servi, comme sur les pages article. Les trois maillons ont une URL
   * reelle : c'est l'exigence de Google pour « item ».
   *
   * ⚠️ Doit rester IDENTIQUE aux microdonnees de src/pages/Decision/DecisionPage.tsx
   * (memes libelles, memes URLs, meme nombre de niveaux) : les deux balisages
   * cohabitent dans le DOM final.
   */
  const filAriane = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Lexenegal', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Jurisprudence', item: `${SITE}/jurisprudence` },
      { '@type': 'ListItem', position: 3, name: ref, item: canonical },
    ],
  };
  return headBlock({ title, description, keywords, canonical, ogType: 'article', schema: [schema, filAriane] });
}
export function buildDecisionBody(d, cited, related) {
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
        return `<li><a href="${esc(urlArticle(a.code.slug, a.slug))}">${esc(label)} - ${esc(a.code.title)}</a></li>`;
      }).filter(Boolean).join('')}</ul></section>`
    : '';
  // Décisions liées (decisions_similaires, deux sens) : cibles actives seulement.
  const liees = (related && related.length)
    ? `<section class="ssr-related"><h2>Décisions liées</h2><ul>${related.map((r) => {
        if (!r || !r.slug) return '';
        const label = [r.juridiction, r.reference, r.chambre].filter(Boolean).join(' - ') || 'Décision';
        const dt = formatDateFr(r.date_decision);
        return `<li><a href="/decision/${esc(r.slug)}">${esc(label)}</a>${dt ? ` (${esc(dt)})` : ''}</li>`;
      }).filter(Boolean).join('')}</ul></section>`
    : '';
  return wrapContent(`<article>
    <h1>${esc([d.juridiction, ref, d.chambre].filter(Boolean).join(' - '))}</h1>
    <ul class="ssr-meta">${meta}</ul>
    ${motscles}${resume}
    <section class="ssr-corps"><h2>Texte intégral</h2>${corps}</section>
    ${cites}${liees}
  </article>`);
}

/* ---------- CODE (loi entière) ---------- */
/*
 * Règle SEO générique et FIDÈLE au type de texte (catégorie laws_and_codes) -
 * voir docs/SEO-RENDU-SSR.md. À conserver pour tous les futurs déploiements.
 *  - « version consolidée » : RÉSERVÉ aux codes (category='code'). Un décret,
 *    arrêté, loi ou Acte uniforme est un texte unique → seulement « texte intégral ».
 *  - Juridiction : Sénégal pour code/loi/decret/arrete ; OHADA pour les Actes
 *    uniformes (communautaire, 17 États) → JAMAIS « du Sénégal » sur l'OHADA.
 *  - « du Sénégal » accolé au nom : uniquement pour les codes au nom générique
 *    (« Code X »), pas quand le nom porte déjà sa référence (« Loi n° … »).
 */
function codeSeoMeta(law) {
  // Nom court réduit à un sigle (« CGI ») : on cherche aussi le nom en toutes lettres
  // (« code général des impôts sénégal ») → « Code Général des Impôts (CGI) ».
  const court = String(law.short_title || '').trim();
  const baseName = court && /^[A-Z0-9]{2,8}$/.test(court) && law.title
    ? `${String(law.title).trim()} (${court})`
    : (court || law.title);
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
  const title = `${m.baseName}${m.geo} - ${m.descriptor} | Lexenegal`;
  const tail = m.isOhada ? ' - droit uniforme OHADA.' : ' - la mémoire juridique du Sénégal.';
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
    ...(joReferenceSsr(law)
      ? { datePublished: law.jo_date, ...(law.publication_date ? { legislationDate: law.publication_date } : {}) }
      : (law.publication_date ? { datePublished: law.publication_date } : {})),
    legislationJurisdiction: { '@type': m.isOhada ? 'Organization' : 'AdministrativeArea', name: m.jurisdiction },
    inLanguage: 'fr', isPartOf: { '@type': 'WebSite', name: 'Lexenegal', url: SITE }, url: canonical,
  };
  return headBlock({ title, description, keywords, canonical, ogType: 'website', schema });
}
function abrogationBanner(law) {
  if (!law || !law.abrogation_note) return '';
  const link = law.abrogated_by_slug
    ? ` <a href="${esc(urlTexte(law.abrogated_by_slug))}">Voir le texte en vigueur →</a>` : '';
  return `<div class="ssr-abrogation" style="background:#fef2f2;border:1px solid #fca5a5;border-left:4px solid #dc2626;color:#991b1b;padding:0.85rem 1.1rem;border-radius:8px;margin:0 0 1.25rem;">⛔ ${esc(law.abrogation_note)}${link}</div>`;
}

// Bloc SSR « Textes & codes liés » — mêmes classes que le composant client
// (RelatedTexts.tsx) pour que le CSS s'applique et que l'hydratation soit cohérente.
function buildRelatedBlock(related) {
  if (!related || !related.length) return '';
  const CAT = { code: 'Code', loi: 'Loi', decret: 'Décret', arrete: 'Arrêté', circulaire: 'Circulaire',
    ohada: 'OHADA', uemoa: 'UEMOA', cima: 'CIMA', convention_collective: 'Convention', jors: 'JO' };
  const card = (i) => `<a href="${esc(urlTexte(i.slug))}" class="related-card">`
    + `<span class="related-card__badge">${esc(CAT[i.category] || 'Texte')}</span>`
    + `<span class="related-card__title">${esc(i.short_title || i.title)}</span></a>`;
  const grp = (title, items) => (items.length
    ? `<div class="related-group"><h3 class="related-group__title">${title}</h3><div class="related-grid">${items.map(card).join('')}</div></div>`
    : '');
  const codes = related.filter((i) => i.category === 'code');
  const textes = related.filter((i) => i.category !== 'code');
  return `<section class="related-texts" aria-label="Textes et codes liés">`
    + `<h2 class="related-texts__label">Textes &amp; codes liés</h2>`
    + `${grp('Codes liés', codes)}${grp('Textes liés', textes)}</section>`;
}

export function buildCodeBody(law, articles, related) {
  const m = codeSeoMeta(law);
  const links = (articles || []).map((a) => {
    const label = a.num || a.num_court || (a.article_number != null ? `Article ${a.article_number}` : a.slug);
    return `<li><a href="${esc(urlArticle(law.slug, a.slug))}">${esc(label)}</a></li>`;
  }).join('\n');
  const n = articles && articles.length ? articles.length : 0;
  // Chapô SEO : référence + date de publication (données vérifiées en base)
  const jo = joReferenceSsr(law);
  const refLine = [
    law.reference ? esc(law.reference) : '',
    jo ? `publié au ${esc(jo)}` : (law.publication_date ? `publié le ${esc(formatDateFr(law.publication_date))}` : ''),
  ].filter(Boolean).join(' - ');
  const descriptorCap = m.descriptor.charAt(0).toUpperCase() + m.descriptor.slice(1);
  const intro = `<p class="ssr-code-intro">${esc(m.baseName)}${refLine ? ` - ${refLine}` : ''}. `
    + `${descriptorCap}${n ? `, ${n} articles` : ''}, consultable gratuitement article par article, `
    + `avec la jurisprudence et les textes liés.</p>`;
  // Bloc de présentation éditorial (contenu de confiance, rédigé/vérifié) si renseigné
  const presentation = law.description
    ? `<section class="ssr-presentation">${law.description}</section>`
    : '';
  return wrapContent(`<article>
    ${abrogationBanner(law)}
    <h1>${esc(m.baseName)}${esc(m.geo)} - ${esc(m.descriptor)}</h1>
    ${intro}
    ${presentation}
    <nav class="ssr-toc" aria-label="Articles"><h2>Articles · ${esc(m.baseName)}</h2><ul>${links}</ul></nav>
    ${buildRelatedBlock(related)}
  </article>`);
}

/* ---------- ARTICLE de loi ---------- */
// Premier maillon du fil d'Ariane d'un article : la liste dont le texte fait partie.
// Doit rester identique au fil d'Ariane de src/pages/Code/ArticlePage.tsx.
function racineFilAriane(slug) {
  return estConvention(slug)
    ? { nom: 'Conventions collectives', url: '/conventions-collectives' }
    : { nom: 'Codes et textes', url: '/codes' };
}
/*
 * Titre et description d'un article, calqués sur la recherche (« article 363 du code pénal sénégalais »).
 * COPIE de src/lib/seoArticle.ts (+ articleLabel de src/lib/articleLabel.ts) : une fonction Vercel ne peut pas
 * importer un module TypeScript. src/lib/__tests__/seoArticleApi.test.ts vérifie que les deux copies concordent.
 */
export function articleLabelSeo(a) {
  if (!a) return '';
  const an = String(a.article_number ?? '').trim();
  if (/^pr[ée]ambule/i.test(an)) return 'Préambule';
  if (/^rapport de pr[ée]sentation/i.test(an)) return 'Rapport de présentation';
  if (/^(expos[ée] des motifs|visas?)/i.test(an)) return a.num || a.num_court || an;
  if (a.num) return a.num;
  if (!an) return a.num_court || '';
  if (/^(article|art\.)/i.test(an)) return an;
  return `Article ${an}`;
}
const sansAccentsSeo = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const PREPOSITIONS_SEO = {
  code: 'du', decret: 'du', traite: 'du', reglement: 'du', statut: 'du', protocole: 'du',
  constitution: 'de la', loi: 'de la', convention: 'de la', charte: 'de la', directive: 'de la',
  circulaire: 'de la', decision: 'de la', deliberation: 'de la', resolution: 'de la',
  acte: "de l'", arrete: "de l'", ordonnance: "de l'", accord: "de l'", instruction: "de l'", avenant: "de l'",
};
const MINUSCULES_SEO = {
  loi: 'loi', decret: 'décret', arrete: 'arrêté', ordonnance: 'ordonnance', decision: 'décision',
  circulaire: 'circulaire', instruction: 'instruction', deliberation: 'délibération', resolution: 'résolution',
};
const OBJET_SEO = /\s+(?:portant|fixant|relatif|relative|modifiant|instituant|abrogeant|complétant|completant|déterminant|determinant|organisant|créant|creant|autorisant|concernant|sur|réglementant|reglementant|définissant|definissant|approuvant|prévoyant|prevoyant|ratifiant|abrogeant)\b/i;
const premierMotSeo = (nom) => sansAccentsSeo((nom.match(/^[A-Za-zÀ-ÿ]+/) || [''])[0]).toLowerCase();
export function nomCourtTexte(t) {
  const court = String(t.short_title || '').trim();
  let nom = String(court && !/^[A-Z0-9]{2,8}$/.test(court) ? court : (t.title || court || '')).trim();
  nom = nom.replace(/\s+/g, ' ').replace(/[.\s]+$/, '');
  const mot = premierMotSeo(nom);
  if (MINUSCULES_SEO[mot]) {
    nom = MINUSCULES_SEO[mot] + nom.slice(nom.match(/^[A-Za-zÀ-ÿ]+/)[0].length);
    nom = nom.replace(/\bN\s*[°o]\s*/g, 'n° ').replace(/\bn\s*°\s*/g, 'n° ');
    const m = nom.match(OBJET_SEO);
    if (nom.length > 55 && m && m.index > 8) nom = nom.slice(0, m.index).trim();
  }
  return nom;
}
export function libelleSeoArticle(a) {
  let l = articleLabelSeo(a).trim().replace(/\.$/, '');
  if (l && !/^(article|art\.|pr[ée]ambule|rapport|visa|expos[ée]|annexe|titre|chapitre)/i.test(l)) l = `Article ${l}`;
  return l || 'Article';
}
export function intituleSeoArticle(a, t) {
  const nom = nomCourtTexte(t);
  const prep = PREPOSITIONS_SEO[premierMotSeo(nom)];
  const geo = t.category === 'code' && premierMotSeo(nom) === 'code' && !/s[ée]n[ée]gal|\(/i.test(nom) ? ' du Sénégal' : '';
  const lib = libelleSeoArticle(a);
  if (!prep) return `${lib} - ${nom}${geo}`;
  return prep.endsWith("'") ? `${lib} ${prep}${nom}${geo}` : `${lib} ${prep} ${nom}${geo}`;
}
export function titreSeoArticle(a, t) { return `${intituleSeoArticle(a, t)} | Lexenegal`; }
export function descriptionSeoArticle(a, t, texte) {
  const intitule = intituleSeoArticle(a, t);
  const extrait = String(texte || '').replace(/\s+/g, ' ').trim();
  if (!extrait) {
    const i = intitule.charAt(0).toLowerCase() + intitule.slice(1);
    return `Texte intégral et en vigueur de l’${i}, avec la jurisprudence qui le cite.`;
  }
  const d = `${intitule} : ${extrait}`;
  if (d.length <= 160) return d;
  const coupe = d.slice(0, 159);
  return `${coupe.slice(0, coupe.lastIndexOf(' ')).replace(/[\s,;:]+$/, '')}…`;
}
export function buildArticleHead(law, art, canonical, plain) {
  const numLabel = libelleSeoArticle(art);
  const title = titreSeoArticle(art, law);
  const description = descriptionSeoArticle(art, law, plain);
  const schema = {
    '@context': 'https://schema.org', '@type': 'Legislation', name: `${numLabel} - ${law.title}`,
    legislationIdentifier: String(art.article_number != null ? art.article_number : numLabel),
    inLanguage: 'fr',
    isPartOf: { '@type': 'Legislation', name: law.title, url: `${SITE}${urlTexte(law.slug)}` },
    legislationJurisdiction: { '@type': 'AdministrativeArea', name: 'Sénégal' }, url: canonical,
  };
  /*
   * BreadcrumbList : trois niveaux seulement (Codes › Code › Article). Les
   * niveaux du plan sont volontairement exclus car Google exige une URL « item »
   * pour tout maillon intermédiaire, et un chapitre n'a pas d'URL propre.
   * Pour une convention collective, le premier maillon est la liste des conventions.
   */
  const racine = racineFilAriane(law.slug);
  const filAriane = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: racine.nom, item: `${SITE}${racine.url}` },
      { '@type': 'ListItem', position: 2, name: law.title, item: `${SITE}${urlTexte(law.slug)}` },
      { '@type': 'ListItem', position: 3, name: numLabel, item: canonical },
    ],
  };
  return headBlock({ title, description, keywords: `${numLabel}, ${law.title}, Droit sénégalais, Lexenegal`, canonical, ogType: 'article', schema: [schema, filAriane] });
}
/*
 * Place de l'article dans le plan du code (livre / titre / chapitre / section…).
 *
 * 96,5 % des articles portent un node_id : c'est la seule donnée de contexte
 * disponible à grande échelle, et elle n'était pas exploitée dans la page servie
 * au crawler — qui ne montrait que « Code › Article N ».
 *
 * Rendu en TEXTE, volontairement pas en liens : la seule URL de chapitre qui
 * existe est /code/:slug?node=… (/ccn/… pour une convention), or ces URL sont des doublons de la page du
 * code (elles figurent telles quelles dans le rapport « Duplicate without
 * user-selected canonical » de Search Console). Y pousser 17 000 liens
 * aggraverait le problème qu'on vient de corriger. Seuls « précédent » et
 * « suivant » sont cliquables : ce sont de vraies URL canoniques.
 */
const MOTS_NIVEAU = {
  partie: 'Partie', livre: 'Livre', titre: 'Titre', chapitre: 'Chapitre',
  section: 'Section', sous_section: 'Sous-section', 'sous-section': 'Sous-section',
  paragraphe: 'Paragraphe', annexe: 'Annexe',
};
// Ordinaux susceptibles d'ouvrir un intitulé dont le mot de niveau a été perdu
// à l'extraction (ex. « DEUXIEME EFFETS DES OBLIGATIONS » pour un livre).
const ORDINAUX = /^(PREMIER|PREMIERE|PREMIÈRE|SECOND|SECONDE|DEUXIEME|DEUXIÈME|TROISIEME|TROISIÈME|QUATRIEME|QUATRIÈME|CINQUIEME|CINQUIÈME|SIXIEME|SIXIÈME|SEPTIEME|SEPTIÈME|HUITIEME|HUITIÈME|NEUVIEME|NEUVIÈME|DIXIEME|DIXIÈME)\b\s*(.*)$/i;

function libelleNiveau(n) {
  const mot = MOTS_NIVEAU[n.type] || (n.type ? n.type.charAt(0).toUpperCase() + n.type.slice(1) : '');
  const num = (n.numero || '').trim();
  const intitule = (n.intitule || n.label || '').trim();
  if (num) return `${mot} ${num}${intitule ? ` - ${intitule}` : ''}`;
  if (!intitule) return mot;
  /*
   * Sans numéro : l'intitulé se suffit en général à lui-même (« PREMIERE
   * PARTIE », « PRELIMINAIRE »). Seule exception, l'intitulé qui commence par
   * un ordinal SANS porter son mot de niveau — séquelle d'extraction. On
   * réinsère alors le mot, sinon le fil d'Ariane affiche « DEUXIEME EFFETS DES
   * OBLIGATIONS » au lieu de « Livre DEUXIEME — EFFETS DES OBLIGATIONS ».
   */
  const m = intitule.match(ORDINAUX);
  if (m && mot && !new RegExp(`\\b${mot}\\b`, 'i').test(intitule) && m[2]) {
    return `${mot} ${m[1]} - ${m[2].replace(/^[\s.:—–-]+/, '')}`;
  }
  return intitule;
}
// Remonte la chaîne des parents jusqu'à la racine, puis remet dans l'ordre de lecture.
export function cheminDansLePlan(nodeId, noeuds) {
  if (!nodeId || !noeuds || !noeuds.length) return [];
  const parId = new Map(noeuds.map((n) => [n.id, n]));
  const chemin = [];
  let courant = parId.get(nodeId);
  // Garde-fou : une donnée cyclique ne doit pas boucler à l'infini côté serveur.
  const vus = new Set();
  while (courant && !vus.has(courant.id) && chemin.length < 12) {
    vus.add(courant.id);
    chemin.push(courant);
    courant = courant.parent_id ? parId.get(courant.parent_id) : null;
  }
  return chemin.reverse();
}

export function buildArticleBody(law, art, contentHtml, citing, chemin, voisins) {
  const numLabel = art.num || art.num_court || (art.article_number != null ? `Article ${art.article_number}` : 'Article');
  const citingHtml = (citing && citing.length)
    ? `<section class="ssr-citing"><h2>Décisions citant cet article</h2><ul>${citing.map((c) => {
        const d = c.decision; if (!d || !d.slug) return '';
        return `<li><a href="/decision/${esc(d.slug)}">${esc(d.reference || 'Décision')}</a>${d.chambre ? ` - ${esc(d.chambre)}` : ''}${d.date_decision ? ` (${esc(formatDateFr(d.date_decision))})` : ''}</li>`;
      }).filter(Boolean).join('')}</ul></section>`
    : '';
  // Niveaux du plan intercalés dans le fil d'Ariane (texte, cf. commentaire ci-dessus).
  const cheminHtml = (chemin || [])
    .map((n) => ` › <span class="ssr-bc-niveau">${esc(libelleNiveau(n))}</span>`).join('');

  // Précédent / suivant : chaîne les articles entre eux. Sans ça la page est un
  // cul-de-sac, atteignable seulement depuis la liste de la page du code.
  const lien = (a, sens, fleche) => (a && a.slug)
    ? `<a href="${esc(urlArticle(law.slug, a.slug))}" rel="${sens}">${esc(fleche === 'g' ? '← ' : '')}${esc(a.num || a.num_court || (a.article_number != null ? `Article ${a.article_number}` : 'Article'))}${esc(fleche === 'd' ? ' →' : '')}</a>`
    : '';
  const prec = lien(voisins && voisins.prec, 'prev', 'g');
  const suiv = lien(voisins && voisins.suiv, 'next', 'd');
  const navHtml = (prec || suiv)
    ? `<nav class="ssr-artnav" aria-label="Article précédent et suivant">${prec}${prec && suiv ? ' · ' : ''}${suiv}</nav>`
    : '';

  // contentHtml = HTML déjà généré par notre pipeline (de confiance) -> injecté tel quel
  return wrapContent(`<article>
    <nav class="ssr-bc" aria-label="Fil d'Ariane"><a href="${esc(urlTexte(law.slug))}">${esc(law.title)}</a>${cheminHtml} › ${esc(numLabel)}</nav>
    ${abrogationBanner(law)}
    <h1>${esc(numLabel)}</h1>
    <div class="ssr-article-body">${contentHtml || `<p>Texte de l'article non disponible.</p>`}</div>
    ${citingHtml}
    ${navHtml}
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
  const title = 'Lexenegal - Codes, lois et jurisprudence du Sénégal en texte intégral';
  const description = 'Lexenegal, la mémoire juridique du Sénégal : codes, lois, décrets, arrêtés et décisions de justice en texte intégral et version consolidée. Recherche et consultation gratuites.';
  const keywords = 'droit sénégalais, codes Sénégal, lois Sénégal, jurisprudence Sénégal, Code pénal Sénégal, Constitution du Sénégal, législation Sénégal, Lexenegal';
  const schema = {
    '@context': 'https://schema.org', '@type': 'WebSite', name: 'Lexenegal', url: SITE, inLanguage: 'fr', description,
    potentialAction: { '@type': 'SearchAction', target: `${SITE}/search?q={query}`, 'query-input': 'required name=query' },
  };
  return headBlock({ title, description, keywords, canonical, ogType: 'website', schema });
}
export function buildHomeBody(codes) {
  const items = (codes || []).map((c) => `<li><a href="${esc(urlTexte(c.slug))}">${esc(c.short_title || c.title)}</a></li>`).join('\n');
  const nav = items ? `<nav class="ssr-home-codes" aria-label="Codes"><h2>Codes et textes en consultation</h2><ul>${items}</ul></nav>` : '';
  return wrapContent(`<article>
    <h1>Lexenegal - la mémoire juridique du Sénégal</h1>
    <p>Consultez gratuitement les <strong>codes, lois, décrets et arrêtés</strong> ainsi que la <strong>jurisprudence du Sénégal</strong> en texte intégral et version consolidée : Code pénal, Code de procédure pénale, Constitution du Sénégal, Code du travail, Code général des impôts, Actes uniformes OHADA, et les décisions de la Cour suprême, de la CCJA et du Conseil constitutionnel.</p>
    <p><a href="/codes">Tous les codes et textes</a> · <a href="/search">Rechercher dans la base</a></p>
    ${nav}
  </article>`);
}
const CAT_LABELS = { code: 'Codes', loi: 'Lois', decret: 'Décrets', arrete: 'Arrêtés', ohada: 'Actes uniformes OHADA' };
export function buildCodesHead(canonical) {
  const title = 'Tous les codes et textes juridiques du Sénégal | Lexenegal';
  const description = 'Liste complète des codes, lois, décrets, arrêtés et Actes uniformes OHADA consultables en texte intégral sur Lexenegal - la mémoire juridique du Sénégal.';
  const keywords = 'codes Sénégal, textes juridiques Sénégal, lois Sénégal, décrets Sénégal, OHADA, droit sénégalais, Lexenegal';
  const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: canonical, inLanguage: 'fr' };
  return headBlock({ title, description, keywords, canonical, ogType: 'website', schema });
}
export function buildCodesBody(texts) {
  const order = ['code', 'loi', 'decret', 'arrete', 'ohada'];
  const groups = {};
  (texts || []).forEach((t) => { const k = String(t.category || 'code').toLowerCase(); (groups[k] = groups[k] || []).push(t); });
  const sections = order.filter((k) => groups[k] && groups[k].length).map((k) => {
    const items = groups[k].map((c) => `<li><a href="${esc(urlTexte(c.slug))}">${esc(c.short_title || c.title)}</a></li>`).join('\n');
    return `<section><h2>${esc(CAT_LABELS[k] || k)}</h2><ul>${items}</ul></section>`;
  }).join('\n');
  // catégories hors liste connue (au cas où), placées en fin
  const extra = Object.keys(groups).filter((k) => !order.includes(k)).map((k) => {
    const items = groups[k].map((c) => `<li><a href="${esc(urlTexte(c.slug))}">${esc(c.short_title || c.title)}</a></li>`).join('\n');
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
/*
 * Doctrine : titre, description et articles liés (métadonnées publiques ; le texte intégral reste réservé).
 * COPIE de src/lib/seoDoctrine.ts ; src/lib/__tests__/seoDoctrineApi.test.ts vérifie la concordance.
 */
const MOIS_SEO = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function dateLongue(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const j = parseInt(m[3], 10);
  return `${j === 1 ? '1er' : j} ${MOIS_SEO[parseInt(m[2], 10) - 1]} ${m[1]}`;
}
function nomCodeDoctrine(law) {
  const court = String(law.short_title || '').trim();
  return /^[A-Z0-9]{2,8}$/.test(court) ? court : nomCourtTexte(law);
}
export function articlesDeDoctrine(liens) {
  const vus = new Set();
  const out = [];
  for (const l of liens || []) {
    const a = l.articles; const law = a && a.laws_and_codes;
    if (!a || !law || !a.slug || !law.slug || a.is_active === false) continue;
    const url = `/code/${law.slug}/${a.slug}`;
    if (vus.has(url)) continue;
    vus.add(url);
    out.push({ url, numero: libelleSeoArticle(a).replace(/^Article\s+/i, ''), intitule: intituleSeoArticle(a, law),
      sigle: nomCodeDoctrine(law), codeSlug: law.slug, ordre: a.display_order ?? 0 });
  }
  return out.sort((x, y) => (x.codeSlug === y.codeSlug ? x.ordre - y.ordre : x.codeSlug < y.codeSlug ? -1 : 1));
}
function articlesEnClair(arts) {
  if (!arts.length) return '';
  const duCode = arts.filter((a) => a.codeSlug === arts[0].codeSlug);
  const n = duCode.map((a) => a.numero);
  const prep = /^code|^[A-Z0-9]{2,8}$/i.test(duCode[0].sigle) && !/^(loi|constitution|convention)/i.test(duCode[0].sigle) ? 'du' : 'de';
  const fin = `${prep} ${duCode[0].sigle}`;
  if (n.length === 1) return `article ${n[0]} ${fin}`;
  if (n.length === 2) return `articles ${n[0]} et ${n[1]} ${fin}`;
  if (n.length === 3) return `articles ${n[0]}, ${n[1]} et ${n[2]} ${fin}`;
  return `articles ${n.slice(0, 3).join(', ')} et autres ${fin}`;
}
function objetPropre(d) {
  const o = String(d.objet || '').replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
  return o ? o.charAt(0).toUpperCase() + o.slice(1) : 'Doctrine fiscale';
}
function referenceCourte(d) {
  const date = dateLongue(d.date);
  if (d.numero) return `n° ${d.numero}${date ? ` du ${date}` : ''}`;
  return d.reference_complete || date;
}
export function titreSeoDoctrine(d, arts) {
  const quoi = articlesEnClair(arts);
  const ref = `DGID ${referenceCourte(d)}`.trim();
  return quoi ? `${objetPropre(d)} : ${quoi} - ${ref} | Lexenegal` : `${objetPropre(d)} - ${ref} | Doctrine fiscale | Lexenegal`;
}
export function descriptionSeoDoctrine(d, arts) {
  const objet = String(d.objet || '').replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
  const quoi = articlesEnClair(arts);
  const porte = quoi ? ` Porte sur ${quoi.startsWith('articles') ? 'les' : 'l’'}${quoi.startsWith('articles') ? ' ' : ''}${quoi}.` : '';
  return `Doctrine fiscale de la DGID (Sénégal), ${referenceCourte(d)}${objet ? ` : ${objet}` : ''}.${porte} Texte intégral réservé aux membres de Lexenegal.`;
}
export function buildDoctrineHead(d, canonical, arts = []) {
  const objet = (d.objet || '').trim();
  const ref = (d.reference_complete || (d.numero ? `Lettre n° ${d.numero}` : 'Doctrine fiscale')).trim();
  const titleCore = objet ? `${objet} - ${ref}` : ref;
  const title = titreSeoDoctrine(d, arts);
  const description = descriptionSeoDoctrine(d, arts);
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
export function buildDoctrineBody(d, arts = []) {
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
  // content_raw VOLONTAIREMENT absent : teaser + extrait public (colonne doctrine.extrait = exposé de la
  // demande, jamais la réponse ; calculée en base par public.doctrine_extrait).
  const extrait = (d.extrait || '').split('\n').map((p) => p.trim()).filter(Boolean);
  return wrapContent(`<article>
    <nav class="ssr-bc" aria-label="Fil d'Ariane"><a href="/doctrine-fiscale">Doctrine fiscale</a> › ${esc(ref)}</nav>
    <h1>${esc(objet || ref)}</h1>
    <ul class="ssr-meta">${meta}</ul>
    ${arts.length ? `<section class="ssr-doctrine-articles"><h2>Articles concernés</h2><ul>${arts.map((a) => `<li><a href="${attr(a.url)}">${esc(a.intitule)}</a></li>`).join('')}</ul></section>` : ''}
    ${extrait.length ? `<section class="ssr-doctrine-extrait"><h2>Extrait de la lettre</h2>${extrait.map((p) => `<p>${esc(p)}</p>`).join('')}<p>[…]</p></section>` : ''}
    <section class="ssr-doctrine-gate">
      <p>Document de doctrine fiscale de la <strong>DGID</strong> (Sénégal). L'objet, les références et l'extrait ci-dessus sont en accès libre.</p>
      <p>Le <strong>texte intégral</strong> de cette lettre, avec la réponse de l'administration, est réservé aux membres. <a href="/signup">Créez un compte gratuit</a> pour le consulter, ou parcourez l'ensemble de la <a href="/doctrine-fiscale">doctrine fiscale</a>.</p>
    </section>
  </article>`);
}

/* ---------- PAGE-THÈME de jurisprudence ---------- */
/*
 * /jurisprudence/theme/:slug - hub thématique généré depuis la base (table
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
    const meta = [d.juridiction, d.chambre, formatDateFr(d.date_decision)].filter(Boolean).join(' - ');
    const snippet = stripHtml(d.resume || '');
    return `<li class="ssr-theme-dec">
      <a href="/decision/${esc(d.slug)}"><strong>${esc(d.reference || 'Décision')}</strong></a>
      ${meta ? `<span class="ssr-theme-dec-meta"> - ${esc(meta)}</span>` : ''}
      ${snippet ? `<p>${esc(snippet)}</p>` : ''}
    </li>`;
  }).join('\n');
  const arts = (data.articles || []).map((a) =>
    `<li><a href="${esc(urlArticle(a.code_slug, a.article_slug))}">${esc(a.article_label)} - ${esc(a.code_title)}</a> <span class="ssr-theme-art-n">(cité par ${a.n} décision${a.n > 1 ? 's' : ''})</span></li>`
  ).join('\n');
  const faq = Array.isArray(t.faq) ? t.faq.filter((f) => f && f.q && f.a) : [];
  const faqHtml = faq.length
    ? `<section class="ssr-theme-faq"><h2>Questions fréquentes - ${esc(t.label)}</h2>
       ${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n')}</section>`
    : '';
  return wrapContent(`<article>
    <nav class="ssr-bc" aria-label="Fil d'Ariane"><a href="/jurisprudence">Jurisprudence</a> › ${esc(t.label)}</nav>
    <h1>${esc(t.h1)}</h1>
    <p class="ssr-theme-chapo">${esc(t.chapo)}</p>
    <p class="ssr-theme-stats"><strong>${total} décisions</strong> sur ce thème dans la base${jurisTxt ? ` : ${esc(jurisTxt)}.` : '.'}</p>
    ${arts ? `<section class="ssr-theme-arts"><h2>Articles de codes les plus cités</h2><ul>${arts}</ul></section>` : ''}
    <section class="ssr-theme-decs"><h2>Décisions récentes - ${esc(t.label)}</h2><ul>${decs}</ul></section>
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
    ${dateFr ? `<p class="ssr-guide-date">Publié le ${esc(dateFr)} - Lexenegal, la mémoire juridique du Sénégal.</p>` : ''}
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
 * porte d'entrée SEO de la jurisprudence - matières + thèmes (pages seo_themes).
 */
export function buildJurisprudenceHead(canonical) {
  const title = 'Jurisprudence du Sénégal - décisions de justice en texte intégral | Lexenegal';
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
  return one(await sb(`decisions?slug=eq.${encodeURIComponent(slug)}&select=id,reference,slug,date_decision,juridiction,chambre,matiere_principale,parties_principales,resume,mots_cles,texte_brut,texte_integral,decisions_similaires&limit=1`));
}
// Décisions liées dans les deux sens du champ decisions_similaires (actives seulement : jamais de lien mort).
async function fetchRelatedDecisions(d) {
  const cols = 'slug,reference,juridiction,chambre,date_decision';
  const sortants = Array.from(new Set((Array.isArray(d.decisions_similaires) ? d.decisions_similaires : [])
    .filter((s) => typeof s === 'string' && s && s !== d.slug)));
  try {
    const [out, inc] = await Promise.all([
      sortants.length
        ? sb(`decisions?slug=in.(${sortants.map((s) => encodeURIComponent(`"${s}"`)).join(',')})&is_active=eq.true&select=${cols}`)
        : Promise.resolve([]),
      sb(`decisions?decisions_similaires=cs.${encodeURIComponent(`{"${d.slug}"}`)}&is_active=eq.true&select=${cols}&limit=30`),
    ]);
    const seen = new Set([d.slug]);
    return [...(out || []), ...(inc || [])]
      .filter((r) => r && r.slug && !seen.has(r.slug) && seen.add(r.slug))
      .sort((a, b) => String(b.date_decision || '').localeCompare(String(a.date_decision || '')));
  } catch (e) { return []; }
}
async function fetchCitedArticles(decisionId) {
  try {
    return await sb(`decision_article_links?decision_id=eq.${decisionId}&select=article:articles(slug,num,num_court,article_number,code:laws_and_codes(slug,title))&limit=40`);
  } catch (e) { return []; }
}
async function fetchDoctrine(slug) {
  // Teaser uniquement : content_raw EXCLU du select serveur public.
  return one(await sb(`doctrine?slug=eq.${encodeURIComponent(slug)}&select=id,slug,numero,annee,date,service_emetteur,reference_complete,objet,destinataire,signataire,extrait&limit=1`));
}
// Articles du code visés par une lettre de doctrine (table en lecture publique).
async function fetchDoctrineArticles(doctrineId) {
  return sb(`article_doctrine_links?doctrine_id=eq.${encodeURIComponent(doctrineId)}&select=articles(slug,num,num_court,article_number,display_order,is_active,laws_and_codes(slug,title,short_title,category))&limit=60`);
}
// Anciens slugs doctrine (numériques + doublons -occ retirés) → nouveau slug SEO.
// Alimente le 301 permanent : aucune URL indexée ne casse après la refonte des slugs.
async function fetchDoctrineRedirect(oldSlug) {
  return one(await sb(`doctrine_slug_redirects?old_slug=eq.${encodeURIComponent(oldSlug)}&select=new_slug&limit=1`));
}
// Anciennes URLs de décisions fusionnées (dédoublonnage sommaire/intégrale) → décision gardée.
async function fetchDecisionRedirect(oldSlug) {
  return one(await sb(`decision_slug_redirects?old_slug=eq.${encodeURIComponent(oldSlug)}&select=new_slug&limit=1`));
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
  return one(await sb(`laws_and_codes?slug=eq.${encodeURIComponent(slug)}&select=id,title,short_title,category,slug,reference,publication_date,description,abrogation_note,abrogated_by_slug,jo_numero,jo_date,jo_page&limit=1`));
}
/*
 * Liste des articles d'un texte, PAGINÉE : PostgREST plafonne chaque réponse à 1 000 lignes en
 * silence (l'ancien « limit=3000 » n'y changeait rien : l'AUSCGIE, 1 104 articles, perdait ses
 * 104 derniers). Ordre total display_order puis id, sinon deux pages peuvent sauter ou doubler
 * des articles de même rang.
 */
const PAGE_POSTGREST = 1000;
async function fetchCodeArticles(codeId) {
  const lignes = [];
  for (let offset = 0; ; offset += PAGE_POSTGREST) {
    const page = await sb(`articles?code_id=eq.${codeId}&select=num,num_court,article_number,slug&order=display_order,id&offset=${offset}&limit=${PAGE_POSTGREST}`);
    lignes.push(...page);
    if (page.length < PAGE_POSTGREST) return lignes;
  }
}
// Textes & codes liés (legal_edge relation lie_a, bidirectionnel) pour le SSR/SEO.
async function fetchRelatedTexts(codeId) {
  try {
    const edges = await sb(`legal_edge?relation=eq.lie_a&or=(src_id.eq.${codeId},dst_id.eq.${codeId})&select=src_id,dst_id`);
    const others = [...new Set((edges || []).flatMap((e) => [e.src_id, e.dst_id]).filter((id) => id && id !== codeId))];
    if (!others.length) return [];
    return await sb(`laws_and_codes?id=in.(${others.join(',')})&is_active=eq.true&select=slug,title,short_title,category`);
  } catch (e) { return []; }
}
async function fetchArticle(codeId, artSlug) {
  return one(await sb(`articles?code_id=eq.${codeId}&slug=eq.${encodeURIComponent(artSlug)}&select=id,num,num_court,article_number,slug,content_html,node_id,display_order&limit=1`));
}
// Plan du code (structure_nodes) : sert à situer l'article dans sa hiérarchie.
// Chargé en une requête puis parcouru en mémoire — un code compte quelques
// centaines de nœuds tout au plus.
async function fetchStructureNodes(codeId) {
  try {
    return await sb(`structure_nodes?code_id=eq.${codeId}&select=id,parent_id,type,numero,intitule,label&limit=5000`);
  } catch (e) { return []; }
}
// Article précédent et suivant, selon l'ordre d'affichage du code (display_order, puis id pour
// départager les articles de même rang : sans ce départage, ils étaient sautés).
async function fetchVoisins(codeId, ordre, artId) {
  if (ordre == null) return { prec: null, suiv: null };
  const champs = 'slug,num,num_court,article_number';
  try {
    const [prec, suiv] = await Promise.all([
      sb(`articles?code_id=eq.${codeId}&or=(display_order.lt.${ordre},and(display_order.eq.${ordre},id.lt.${artId}))&select=${champs}&order=display_order.desc,id.desc&limit=1`),
      sb(`articles?code_id=eq.${codeId}&or=(display_order.gt.${ordre},and(display_order.eq.${ordre},id.gt.${artId}))&select=${champs}&order=display_order.asc,id.asc&limit=1`),
    ]);
    return { prec: one(prec), suiv: one(suiv) };
  } catch (e) { return { prec: null, suiv: null }; }
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

/*
 * Texte visé par une page de texte ou d'article, d'après le paramètre posé par la réécriture de
 * vercel.json : ccn= pour /ccn/:segment…, slug= (type code) ou code= (type article) pour /code/….
 * Une réécriture ne pose jamais les deux. Or Vercel transmet aussi la requête d'origine :
 * /code/code-penal?ccn=banques arrive avec slug ET ccn, et /ccn/banques?slug=code-penal aussi.
 * Servir l'un ou l'autre, c'est afficher un texte sous l'adresse d'un autre (et le mettre en cache
 * au CDN). Requête ambiguë ou incomplète → null : l'appelant sert la coquille, l'application
 * lit l'adresse réelle. Sinon { slug en base, chemin du texte tel que reçu }.
 */
export function texteDeLaRequete(ccn, slugTexte) {
  const present = (v) => v != null && v !== '';
  if (present(ccn) && present(slugTexte)) return null;
  if (present(ccn)) return typeof ccn === 'string' ? { slug: slugDepuisSegmentCcn(ccn), recue: `/ccn/${ccn}` } : null;
  if (present(slugTexte)) return typeof slugTexte === 'string' ? { slug: slugTexte, recue: `/code/${slugTexte}` } : null;
  return null;
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
      let arts = [];
      try { arts = articlesDeDoctrine(await fetchDoctrineArticles(d.id)); } catch (e) { /* bonus : la page reste servie */ }
      return serveHtml(buildDoctrineHead(d, canonical, arts), buildDoctrineBody(d, arts));
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
      // /ccn/:segment (convention collective) ou /code/:slug : même page, slug en base retrouvé.
      const cible = texteDeLaRequete(q.ccn, q.slug);
      if (!cible) return serveShell();
      const { slug, recue } = cible;
      // Une seule adresse publique par texte : une ancienne forme (/code/ccn-…, /ccn/ccn-…),
      // normalement déjà redirigée par vercel.json, ne doit jamais servir une page en 200.
      if (recue !== urlTexte(slug)) return serve301(`${SITE}${urlTexte(slug)}`);
      let law = null;
      try { law = await fetchLaw(slug); } catch (e) { return serve503(); }
      if (!law) return serveShell(60, true);
      let articles = [];
      try { articles = await fetchCodeArticles(law.id); } catch (e) { /* */ }
      const related = await fetchRelatedTexts(law.id);
      const canonical = `${SITE}${urlTexte(slug)}`;
      return serveHtml(buildCodeHead(law, articles.length, canonical), buildCodeBody(law, articles, related));
    }

    if (type === 'article') {
      // /ccn/:segment/:article (convention collective) ou /code/:code/:article.
      const cible = texteDeLaRequete(q.ccn, q.code), artSlug = q.slug;
      if (!cible || !artSlug) return serveShell();
      const { slug: codeSlug, recue } = cible;
      // Adresse publique d'un article, segments encodés (le slug d'article peut porter un espace).
      const adresseArticle = (art) => `${SITE}${urlTexte(codeSlug)}/${encodeURIComponent(art)}`;
      // Anciens slugs avec espaces (ex. « article-307 bis ») : 301 vers la forme tiretée.
      if (/\s/.test(artSlug)) {
        return serve301(adresseArticle(artSlug.replace(/\s+/g, '-')));
      }
      // Ancienne forme d'adresse du texte (/code/ccn-…, /ccn/ccn-…) : 301 vers la forme publique.
      if (recue !== urlTexte(codeSlug)) return serve301(adresseArticle(artSlug));
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
          if (alt) return serve301(adresseArticle(short));
        }
        return serveShell(60, true);
      }
      // Tout en parallèle : le contexte enrichi ne doit pas rallonger le rendu.
      // Les trois requêtes ajoutées échouent en silence (contexte = bonus), le
      // texte de l'article reste servi quoi qu'il arrive.
      const [content, citing, noeuds, voisins] = await Promise.all([
        art.content_html ? Promise.resolve(art.content_html) : fetchCurrentVersion(art.id),
        fetchCitingDecisions(art.id),
        art.node_id ? fetchStructureNodes(law.id) : Promise.resolve([]),
        fetchVoisins(law.id, art.display_order, art.id),
      ]);
      const chemin = cheminDansLePlan(art.node_id, noeuds);
      const canonical = `${SITE}${urlArticle(codeSlug, artSlug)}`;
      return serveHtml(buildArticleHead(law, art, canonical, stripHtml(content)), buildArticleBody(law, art, content, citing, chemin, voisins));
    }

    // decision (défaut)
    const slug = q.slug || (req.url || '').replace(/^.*\/decision\//, '').replace(/[?#].*$/, '');
    if (!slug) return serveShell();
    let decision = null;
    try { decision = await fetchDecision(slug); } catch (e) { return serve503(); }
    if (!decision) {
      // Décision fusionnée lors d'un dédoublonnage : 301 vers la décision gardée.
      let redir = null;
      try { redir = await fetchDecisionRedirect(slug); } catch (e) { /* */ }
      if (redir && redir.new_slug && redir.new_slug !== slug) {
        return serve301(`${SITE}/decision/${encodeURIComponent(redir.new_slug)}`);
      }
      // Décision masquée (existe mais is_active=false) → 410 Gone ; sinon coquille noindex.
      let gone = false;
      try { gone = (await sbRpc('rpc_decision_gone', { p_slug: slug })) === true; } catch (e) { /* */ }
      if (gone) return serveGone();
      return serveShell(60, true);
    }
    const [cited, related] = await Promise.all([
      decision.id ? fetchCitedArticles(decision.id) : [],
      fetchRelatedDecisions(decision),
    ]);
    const canonical = `${SITE}/decision/${slug}`;
    return serveHtml(buildDecisionHead(decision, canonical), buildDecisionBody(decision, cited, related));
  } catch (e) {
    res.statusCode = 500;
    return res.end('Erreur de rendu');
  }
}
