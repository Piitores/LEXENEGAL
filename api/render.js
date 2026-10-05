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
// Mise en forme de la version serveur, un bloc par type de page, placé dans le <head> de ce seul type.
import { styleSsr } from './_ssr/styles.js';

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

/*
 * Textes retirés par la fusion des codes 2026 (décision du propriétaire du 02/10/2026 : un seul Code
 * du travail, un seul Code de la sécurité sociale). Le 301 vient de ce relais, et SEULEMENT quand la
 * ligne du texte a disparu de la base (après la migration de données) : le handler va alors en UN seul
 * saut jusqu'à la cible finale, chemin et paramètres conservés. Tant que la ligne existe, rien ne change.
 * ⛔ Pas de règle statique dans vercel.json (relecture du 02/10/2026) : elle ne dépend pas de la base.
 * Déployée avant la migration, alors que code-travail-2026 est le texte en vigueur, elle renverrait le
 * code 2026 vers le code de 1997 (dont le bandeau « Voir le texte en vigueur » le redirigerait : boucle)
 * et ses 792 articles vers des adresses vides. urlsApi.test.ts verrouille cette absence.
 */
export const TEXTES_RETIRES = {
  'code-travail-2026': 'code-travail',
  'code-securite-sociale-2026': 'code-securite-sociale-senegal',
};
// Paramètres posés par les réécritures de vercel.json : jamais recopiés dans une redirection.
const CLES_REECRITURE = ['type', 'slug', 'code', 'ccn', 'codeSlug', 'articleSlug', 'segment'];
/*
 * Requête d'origine à reporter sur une redirection (« ?node=…&date=… »), sans les paramètres internes
 * des réécritures. Vercel fusionne ceux-ci avec ceux de l'adresse demandée dans req.query, Y COMPRIS
 * les noms des segments de la règle source (« /code/:codeSlug/:articleSlug » ajoute codeSlug et
 * articleSlug) : constaté en production le 02/10/2026, /code/code-travail-2026/art-2 redirigeait vers
 * /code/code-travail/art-2?codeSlug=code-travail-2026&articleSlug=art-2. Toute nouvelle réécriture
 * vers /api/render ajoute ici ses noms de segments (vercel.json).
 */
export function requeteConservee(query, exclues = CLES_REECRITURE) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (exclues.includes(k)) continue;
    for (const x of Array.isArray(v) ? v : [v]) if (x != null) params.append(k, String(x));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function attr(s) { return esc(s).replace(/\n/g, ' '); }
function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

/*
 * Texte suivi d'un article pour la DESCRIPTION : l'intitulé PONCTUÉ, puis le corps. Copie de
 * `texteAvecIntitule` (src/lib/intituleArticle.ts), que cette fonction Vercel ne peut pas
 * importer ; `src/lib/__tests__/seoArticleApi.test.ts` vérifie la parité. Sans le point, la
 * description servie à Google lisait « Champ d'application Le présent Code s'applique… ».
 * Trois classes d'intitulé en base, toujours le premier paragraphe du contenu.
 */
const CLASSES_INTITULE = ['intitule-article', 'article-intitule', 'article-rubrique'];
export function texteSeoArticle(html) {
  const source = String(html || '');
  const m = /^\s*<p\s+class="([^"]*)"\s*>([\s\S]*?)<\/p>/.exec(source);
  const estIntitule = !!m && m[1].split(/\s+/).some((c) => CLASSES_INTITULE.includes(c));
  const propre = (x) => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const texte = propre(estIntitule ? source.slice(m[0].length) : source);
  const titre = estIntitule ? propre(m[2]) : '';
  if (!titre) return texte;
  return `${titre}${/[.:;!?…]$/.test(titre) ? '' : '.'} ${texte}`.trim();
}
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

/*
 * Texte d'une décision mis en forme : COPIE de `decisionTextToHtml` (src/utils/decisionTextFormatter.ts),
 * que cette fonction Vercel ne peut pas importer. Le serveur produit ainsi le MÊME balisage que la page
 * React (bloc Composition, en-tête République, visas, sections, dispositif), que le CSS de #ssr-keep
 * (api/_ssr/styles.js, bloc « decision ») met en forme comme DecisionPage.css : à l'arrivée de React, le
 * texte ne change ni de police, ni de marges, ni de coupures. Avant le 05/10/2026, le serveur le
 * découpait en paragraphes nus (textToParagraphs) : autre mise en page, « le rendu saute ».
 * ⚠️ Toute modification du formateur React se reporte ici (mêmes expressions, même ordre).
 */
function compositionDecisionSsr(text) {
  const m = text.match(/COMPOSITION\s+DE\s+LA\s+JURIDICTION\s*\n+([\s\S]*?)(?=\n*(?:RÉPUBLIQUE|ARRÊT|AU\s+NOM|La\s+Cour|Le\s+Tribunal|$))/i);
  if (!m) return { html: '', reste: text };
  const reste = text.replace(m[0], '').trim();
  const motif = /(Président|Rapporteur|Avocat\s+[gG]énéral|Greffier|Conseillers?)\s*\n*:\s*\n*([\s\S]*?)(?=\n*(?:Président|Rapporteur|Avocat|Greffier|Conseillers?|$))/gi;
  const roles = [];
  let r;
  while ((r = motif.exec(m[1])) !== null) {
    const nom = r[2].trim().replace(/\n+/g, ', ').replace(/,\s*$/, '');
    if (nom) roles.push([r[1].trim(), nom]);
  }
  if (!roles.length) return { html: '', reste: text };
  const items = roles.map(([role, nom]) => `<div class="composition-item"><span class="composition-role">${esc(role)}</span>`
    + `<span class="composition-sep">:</span><span class="composition-name">${esc(nom)}</span></div>`).join('\n');
  return { html: `<div class="master-composition">\n<h3 class="composition-title">COMPOSITION DE LA JURIDICTION</h3>\n${items}\n</div>`, reste };
}
function enTeteRepubliqueSsr(text) {
  const m = text.match(/\n*(RÉPUBLIQUE\s+DU\s+SÉNÉGAL)\s*\n+(Un\s+Peuple\s*-\s*Un\s+But\s*-\s*Une\s+Foi)\s*\n*/i);
  if (!m) return { html: '', reste: text };
  return {
    html: `\n<div class="decision-header">\n<h2 class="republique">${esc(m[1])}</h2>\n<p class="devise">${esc(m[2])}</p>\n</div>\n`,
    reste: text.replace(m[0], '\n\n').trim(),
  };
}
function paragrapheDecisionSsr(segment) {
  const t = segment.trim();
  if (/^Vu\s+/i.test(t)) return `<p class="visa"><em>${esc(t)}</em></p>`;
  if (/^Considérant\s+/i.test(t) || /^Attendu\s+(que|qu')/i.test(t)) return `<p>${esc(t)}</p>`;
  if (/^(EN LA FORME|AU FOND|SUR LE FOND|SUR LA COMP[EÉ]TENCE|SUR L'EXCEPTION|MOTIFS|DISCUSSION|FAITS ET PROC[EÉ]DURE)/i.test(t) && t.length < 100) {
    return `<h3 class="section-intermediate">${esc(t)}</h3>`;
  }
  if (/^(PAR\s+CES\s+MOTIFS|D[EÉ]CIDE|ARR[EÊ]TE|DIT\s+ET\s+JUGE|STATUANT)/i.test(t)) return `<blockquote class="dispositif"><p>${esc(t)}</p></blockquote>`;
  return `<p>${esc(t)}</p>`;
}
export function texteDecisionEnHtml(texte) {
  if (!texte) return '';
  let text = String(texte).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  let html = '';
  const compo = compositionDecisionSsr(text);
  if (compo.html) { html += compo.html + '\n'; text = compo.reste; }
  const entete = enTeteRepubliqueSsr(text);
  if (entete.html) { html += entete.html + '\n'; text = entete.reste; }
  const segments = text.includes('\n\n')
    ? text.split(/\n\n+/)
    : text.split(/;\s*/).map((s, i, a) => (i < a.length - 1 ? `${s.trim()} ;` : s.trim()));
  const corps = segments.map((s) => s.trim()).filter((s) => s.length >= 3).map(paragrapheDecisionSsr).join('\n');
  return `${html}<div class="decision-body">\n${corps}\n</div>`;
}
/*
 * Corps servi : la MÊME source que la page React (texteDecisionAffiche, ci-dessous : jamais texte_brut
 * quand texte_integral est structuré, car seul ce dernier est pseudonymisé). Déjà balisé (HTML de la
 * base) : tel quel, comme la page React ; texte brut : mis en forme comme React (texteDecisionEnHtml).
 */
function corpsDecisionSsr(d) {
  const source = texteDecisionAffiche(d);
  if (!source) return '';
  const s = String(source);
  return /<div class=|class="decision-body"|class="master-composition"/.test(s) ? s : texteDecisionEnHtml(s);
}
/*
 * Texte d'une décision : la MÊME source que la page (getDecisionHtml, src/utils/decisionTextFormatter.ts).
 * ⛔ Jamais texte_brut quand texte_integral est structuré : la pseudonymisation (charte Juricaf du
 * 22/06/2026, voie médiane) a été appliquée à texte_integral, PAS à texte_brut, qui garde l'en-tête
 * d'origine (noms des parties, naissance, domicile, téléphone). Jusqu'au 05/10/2026 ce rendu servait
 * texte_brut en priorité : ces données partaient dans le HTML lu par Google alors que la page affichait
 * les initiales. texte_brut n'est retenu que là où la page le retient (identique à texte_integral).
 */
function texteDecisionAffiche(d) {
  const i = d.texte_integral || '';
  if (/class="master-composition"|class="decision-body"|<div class=/.test(i)) return i;
  if (i.includes('COMPOSITION DE LA JURIDICTION')) return i;
  return d.texte_brut || i;
}
function wrapContent(inner) { return `<div id="ssr-content" class="ssr-prerender">${inner}</div>`; }

/*
 * ---------- COPIES PARTAGÉES par les gabarits serveur (une seule copie de chaque) ----------
 * Cette fonction Vercel ne peut pas importer src/ : les libellés de l'arbre (formatNodeLabel), la règle
 * des préambules (isPreambule) et les icônes lucide-react sont recopiés ICI, une fois, et servent aux pages
 * article, texte, décision, jurisprudence, guides, doctrine et /codes. Parité vérifiée par
 * src/lib/__tests__/codeTreeApi.test.ts et articleArbreApi.test.ts.
 */
// Icônes : tracés lucide-react 0.562 recopiés, décoratifs (aria-hidden).
const ICONES_SSR = {
  Scale: '<path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/>',
  BookMarked: '<path d="M10 2v8l3-3 3 3V2"/><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  ArrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  BookOpen: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  Calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  FileText: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  Building: '<path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M12 6h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/><path d="M8 6h.01"/><path d="M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/><rect x="4" y="2" width="16" height="20" rx="2"/>',
  Lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  Search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  Briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  Gavel: '<path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3l8.384-8.381"/><path d="m16 16 6-6"/><path d="m21.5 10.5-8-8"/><path d="m8 8 6-6"/><path d="m8.5 7.5 8 8"/>',
  Scroll: '<path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  Landmark: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
  Radio: '<path d="M16.247 7.761a6 6 0 0 1 0 8.478"/><path d="M19.075 4.933a10 10 0 0 1 0 14.134"/><path d="M4.925 19.067a10 10 0 0 1 0-14.134"/><path d="M7.753 16.239a6 6 0 0 1 0-8.478"/><circle cx="12" cy="12" r="2"/>',
  Map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  Pickaxe: '<path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999"/><path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024"/><path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069"/><path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z"/>',
  Leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  Car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  Sprout: '<path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"/><path d="M5 21h14"/>',
  FolderOpen: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  ChevronRight: '<path d="m9 18 6-6-6-6"/>',
  ExternalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  CircleHelp: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  Tags: '<path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z"/><path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193"/><circle cx="10.5" cy="6.5" r=".5" fill="currentColor"/>',
};
function iconeSsr(nom, taille, trait = 2, classe = '') {
  return `<svg${classe ? ` class="${classe}"` : ''} aria-hidden="true" focusable="false" width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round">${ICONES_SSR[nom] || ICONES_SSR.FolderOpen}</svg>`;
}

// Copie de isPreambule (src/lib/codeTree.ts) : mêmes préambules en tête de page que React.
const RE_PREAMBULE_SSR = /^\s*(?:articles?\s+|art\.\s*)?pr[ée]ambule\s*$/i;
export function estPreambuleSsr(a) {
  return !!a && ((!!a.tags && typeof a.tags.includes === 'function' && a.tags.includes('preambule'))
    || RE_PREAMBULE_SSR.test(a.num || '') || RE_PREAMBULE_SSR.test(a.num_court || ''));
}

// COPIE de NODE_KIND et formatNodeLabel (src/lib/codeTree.ts) : libellés de l'arbre et de
// l'emplacement dans le texte, au caractère près (« Titre V », « Chapitre premier », « Point A »).
const NODE_KIND_SSR = {
  partie: 'Partie', livre: 'Livre', titre: 'Titre', chapitre: 'Chapitre',
  section: 'Section', 'sous-section': 'Sous-section', paragraphe: 'Paragraphe', division: '',
  'point-lettre': 'Point',
  sous_section: 'Sous-section', 'sous-chapitre': 'Sous-chapitre', 'sous-paragraphe': 'Sous-paragraphe',
  annexe: 'Annexe', preambule: 'Préambule', promulgation: 'Promulgation',
};
// Lecture d'une table par une clé venue de la base (ou de l'adresse) : jamais une clé héritée de
// Object.prototype (« constructor », « __proto__ » rendaient une fonction ou un objet).
const lireCle = (table, cle) => (Object.hasOwn(table, cle) ? table[cle] : undefined);
// Texte littéral dans une expression régulière (un type de nœud « chapitre( » faisait tomber la page en 500).
const echapperRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contientMotSsr = (texte, mot) => new RegExp(`(^|[^a-z0-9])${echapperRe(deburrSsr(mot))}($|[^a-z0-9])`).test(deburrSsr(texte));
const TYPE_WORDS_SSR = 'titre|chapitre|sous-section|section|paragraphe|partie|livre|division';
const MOTS_NUMERO_SSR = `${TYPE_WORDS_SSR}|sous-paragraphe|sous-chapitre|§`;
const ORDINALS_SSR = {
  premier: '1', premiere: '1', deuxieme: '2', second: '2', seconde: '2',
  troisieme: '3', quatrieme: '4', cinquieme: '5', sixieme: '6', septieme: '7',
  huitieme: '8', neuvieme: '9', dixieme: '10', onzieme: '11', douzieme: '12',
  treizieme: '13', quatorzieme: '14', quinzieme: '15', seizieme: '16',
  dixseptieme: '17', dixhuitieme: '18', dixneuvieme: '19', vingtieme: '20',
};
// Séparateurs tolérés après un numéro de niveau (tirets longs écrits en échappement).
const SEP_NIVEAU = ')\\].:°\u2014\u2013-';
const deburrSsr = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const titleWordSsr = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
function romanToIntSsr(s) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const u = s.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(u)) return 0;
  let total = 0;
  for (let i = 0; i < u.length; i++) {
    const cur = map[u[i]], next = map[u[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}
function numToArabicOrNullSsr(token) {
  const t = (token || '').trim();
  const suf = t.match(/\b(bis|ter|quater|quinquies)\b/i);
  const suffix = suf ? ' ' + suf[1].toLowerCase() : '';
  const core = t.replace(/\b(bis|ter|quater|quinquies)\b/ig, '').trim();
  if (/^[0-9]+$/.test(core)) return core + suffix;
  const ordinal = lireCle(ORDINALS_SSR, deburrSsr(core));
  if (ordinal) return ordinal + suffix;
  const r = romanToIntSsr(core);
  if (r > 0) return String(r) + suffix;
  return null;
}
// COPIE de lireNumero (src/lib/codeTree.ts) : colonne numero ramenée au seul numéro (« TITRE IV » -> « IV »).
function lireNumeroSsr(numero) {
  let t = String(numero || '').trim();
  let mot = null;
  const p = t.match(new RegExp(`^(${MOTS_NUMERO_SSR})(?![A-Za-zÀ-ÿ])\\s*(.*)$`, 'i'));
  if (p) { mot = p[1]; t = p[2].trim(); }
  else {
    const s = t.match(new RegExp(`^(\\S+)\\s+(${TYPE_WORDS_SSR})$`, 'i'));
    if (s && numToArabicOrNullSsr(s[1])) { mot = s[2]; t = s[1]; }
  }
  const q = t.match(/^(\S+?(?:\s+(?:bis|ter|quater|quinquies))?)\s*[)\].:°\u2014\u2013-]+\s+(.+)$/i)
    || t.match(/^(\S+?(?:\s+(?:bis|ter|quater|quinquies))?)\s+(?!(?:bis|ter|quater|quinquies)$)(.+)$/i);
  if (q && (numToArabicOrNullSsr(q[1]) || /^[A-Za-z]$/.test(q[1]))) return { num: q[1], mot, reste: q[2].trim() };
  return { num: t.replace(/\s*[.:\u2014\u2013-]+$/, ''), mot, reste: '' };
}
export function formatNodeLabelSsr(n) {
  let kind = lireCle(NODE_KIND_SSR, n.type) ?? n.type;
  let label = (n.intitule || n.name || '').trim();
  const lu = lireNumeroSsr(n.numero || '');
  let num = lu.num;
  if (lu.mot) kind = lireCle(NODE_KIND_SSR, deburrSsr(lu.mot)) ?? kind;
  if (!label && lu.reste) label = lu.reste;
  let stripped = false;
  const mType = label.match(new RegExp(`^\\s*(${TYPE_WORDS_SSR})\\s+(\\S+?)(\\s+(?:bis|ter|quater))?\\s*[${SEP_NIVEAU}]+\\s*(.*)$`, 'i'))
    || label.match(new RegExp(`^\\s*(${TYPE_WORDS_SSR})\\s+(\\S+?)(\\s+(?:bis|ter|quater))?\\s+(.*)$`, 'i'));
  if (mType && numToArabicOrNullSsr((mType[2] + (mType[3] || '')).trim())) {
    kind = lireCle(NODE_KIND_SSR, deburrSsr(mType[1])) ?? titleWordSsr(mType[1]);
    if (!num || !numToArabicOrNullSsr(num)) num = (mType[2] + (mType[3] || '')).trim();
    label = (mType[4] || '').trim();
    stripped = true;
  }
  if (!stripped) {
    const mOrd = label.match(/^\s*([A-Za-zÀ-ÿ]+)\s*(.*)$/);
    if (mOrd && lireCle(ORDINALS_SSR, deburrSsr(mOrd[1]))) {
      if (!num || !numToArabicOrNullSsr(num)) num = mOrd[1];
      let rest = (mOrd[2] || '').trim();
      const mt = rest.match(new RegExp(`^(${TYPE_WORDS_SSR})\\b\\s*[${SEP_NIVEAU}]*\\s*(.*)$`, 'i'));
      if (mt) { kind = lireCle(NODE_KIND_SSR, deburrSsr(mt[1])) ?? titleWordSsr(mt[1]); rest = (mt[2] || '').trim(); }
      label = rest.replace(/^[\s.:\u2014\u2013-]+/, '');
    }
  }
  if (!stripped) {
    const m4 = label.match(new RegExp(`^\\s*(?:(${TYPE_WORDS_SSR})\\s*[.:°)\\]-]*\\s*)?([A-Za-zÀ-ÿ0-9]+)?\\s*$`, 'i'));
    if (m4) {
      const jeton = (m4[2] || '').trim();
      const estNum = !!jeton && (!!numToArabicOrNullSsr(jeton) || /^[A-Za-z]$/.test(jeton));
      const memeQueNum = !!jeton && !!num && deburrSsr(jeton) === deburrSsr(num);
      if ((m4[1] && (estNum || !jeton)) || (memeQueNum && estNum)) {
        if (m4[1]) kind = lireCle(NODE_KIND_SSR, deburrSsr(m4[1])) ?? titleWordSsr(m4[1]);
        if (jeton && (!num || !numToArabicOrNullSsr(num))) num = jeton;
        label = '';
      }
    }
  }
  const arab = numToArabicOrNullSsr(num);
  const lettre = /^[A-Za-z]$/.test(num);
  const libre = !!num && num === lu.num && deburrSsr(num) !== deburrSsr(label);
  let badge = '';
  if (arab || lettre || libre) badge = kind ? `${kind} ${num}` : num;
  else if (kind) {
    const hasKind = contientMotSsr(label, kind) || /\bPARTIE\b/i.test(label);
    badge = hasKind ? '' : kind;
  }
  return { badge, label };
}

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
/*
 * Entrées du bloc « Textes et articles cités » d'une décision : [{ href, label }], href null = pas de lien.
 *
 * Lien ordinaire (anciens_numeros vide, seul cas avant la migration des données) : libellé et adresse
 * inchangés. Lien REPORTÉ par la fusion des codes 2026 (decision_article_links.anciens_numeros =
 * {L.56.}) : la décision citait l'ancien numéro, la page le dit (« Article L.56 du Code du Travail de
 * 1997, repris à l'article 137 ») et le lien ouvre l'article dans la version en vigueur à la date de la
 * décision (?ancien=L56&date=…), décision du propriétaire du 02/10/2026. Une entrée par ancien numéro,
 * dédoublonnée sur l'adresse et le libellé.
 * bascules : { [code_id]: { bascule, depuis } } lus dans article_concordance (en_vigueur_jusqu_au,
 * numerotation_depuis). Décision antérieure à la numérotation d'origine : le numéro vise un code plus
 * ancien, non transposable (contrat §4), donc pas de lien.
 */
export function entreesArticlesCites(cited, dateDecision, bascules) {
  const out = [];
  const vus = new Set();
  const ajoute = (href, label) => {
    const cle = `${href || ''}|${label}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    out.push({ href, label });
  };
  const jour = String(dateDecision || '').slice(0, 10);
  const date = estDateValide(jour) ? jour : null;
  for (const c of cited || []) {
    const a = c && c.article;
    if (!a || !a.code || !a.code.slug || !a.slug) continue;
    const label = a.num || a.num_court || (a.article_number != null ? `Article ${a.article_number}` : 'Article');
    const base = urlArticle(a.code.slug, a.slug);
    const anciens = (Array.isArray(c.anciens_numeros) ? c.anciens_numeros : [])
      .filter((n) => typeof n === 'string' && n.trim() && normAncien(n));
    if (!anciens.length) { ajoute(base, `${label} - ${a.code.title ?? ''}`); continue; }
    const info = (bascules && a.code.id && bascules[a.code.id]) || null;
    const depuis = info && estDateValide(info.depuis) ? info.depuis : null;
    const bascule = info && estDateValide(info.bascule) ? info.bascule : null;
    const deCode = deTexte(String(a.code.title || '').trim());
    const devenu = libelleSeoArticle(a);
    for (const n of anciens) {
      const num = numeroAncienAffiche(n);
      if (date && depuis && date < depuis) { ajoute(null, `Article ${num} ${deCode}`); continue; }
      const libelle = `Article ${num} ${deCode}${depuis ? ` de ${depuis.slice(0, 4)}` : ''}, repris à l'${devenu.charAt(0).toLowerCase()}${devenu.slice(1)}`;
      let href = base;
      if (bascule && !date) href = `${base}?ancien=${encodeURIComponent(normAncien(n))}`;
      else if (bascule && date < bascule) href = `${base}?ancien=${encodeURIComponent(normAncien(n))}&date=${date}`;
      ajoute(href, libelle);
    }
  }
  return out;
}
/*
 * Page décision servie : même gabarit que la page React prête (src/pages/Decision/DecisionPage.tsx), pour
 * que la bascule serveur -> React soit quasi invisible (décision du propriétaire du 05/10/2026, option A).
 * Fil d'Ariane, grille 3 colonnes, carte centrale (pastille, titre, date, synthèse, texte intégral) ; les
 * boutons d'action React (retour, favoris, PDF, impression…) sont des EMPLACEMENTS vides de même taille
 * (aria-hidden, sans texte). Mise en forme : api/_ssr/styles.js, bloc « decision ».
 * Tout le texte servi auparavant reste dans la page : la fiche (juridiction, chambre, date, matière,
 * parties) et les mots-clés changent seulement de place. ⚠️ Gabarit à garder synchrone avec DecisionPage.tsx.
 */
// Emplacements des actions (DecisionActions + 5 ActionButton) : favoris | dossier, PDF, imprimer, copier, annotations, signaler.
const outilsDecisionSsr = (cls) => `<div class="ssr-dc-outils ${cls}" aria-hidden="true"><div class="ssr-dc-rang"><span class="ssr-dc-btn"></span><span class="ssr-dc-btn ssr-dc-dossier"></span></div>`
  + '<span class="ssr-dc-btn ssr-dc-pdf"></span><span class="ssr-dc-btn"></span><span class="ssr-dc-btn"></span><span class="ssr-dc-btn"></span><span class="ssr-dc-btn"></span></div>';
export function buildDecisionBody(d, cited, related, bascules) {
  const ref = d.reference || 'Décision';
  const dateFr = formatDateFr(d.date_decision);
  const meta = [
    d.juridiction && `<li><strong>Juridiction :</strong> ${esc(d.juridiction)}</li>`,
    d.chambre && `<li><strong>Chambre :</strong> ${esc(d.chambre)}</li>`,
    dateFr && `<li><strong>Date :</strong> ${esc(dateFr)}</li>`,
    d.matiere_principale && `<li><strong>Matière :</strong> ${esc(d.matiere_principale)}</li>`,
    d.parties_principales && `<li><strong>Parties :</strong> ${esc(d.parties_principales)}</li>`,
  ].filter(Boolean).join('\n');
  // Pastilles de la synthèse : la matière (pleine) puis les mots-clés, comme la page React.
  const motscles = Array.isArray(d.mots_cles) ? d.mots_cles.filter((m) => m != null && String(m).trim()) : [];
  const pastilles = [
    d.matiere_principale && `<li class="ssr-dc-matiere">${esc(d.matiere_principale)}</li>`,
    ...motscles.map((m) => `<li>${esc(m)}</li>`),
  ].filter(Boolean).join('');
  const tags = pastilles
    ? `<ul class="ssr-dc-tags" aria-label="${motscles.length ? 'Matière et mots-clés' : 'Matière'}">${pastilles}</ul>`
    : '<div class="ssr-dc-tags"></div>';
  const resume = d.resume ? `<p class="ssr-dc-resume">${esc(stripHtml(d.resume))}</p>` : '';
  // « Références légales » : la liste brute articles_loi_cites, comme la page React (liens résolus côté client).
  const lois = Array.isArray(d.articles_loi_cites) ? d.articles_loi_cites.filter((a) => a != null && String(a).trim()) : [];
  const refs = lois.length
    ? `<div class="ssr-dc-refs"><p class="ssr-dc-refs-titre">${iconeSsr('Scale', 12)}Références Légales</p><ul>${lois
        .map((a) => `<li><span aria-hidden="true">§</span>${esc(a)}</li>`).join('')}</ul></div>`
    : '';
  const corps = corpsDecisionSsr(d);
  const cites = (cited && cited.length)
    ? `<section class="ssr-cited"><h2>Textes et articles cités</h2><ul>${entreesArticlesCites(cited, d.date_decision, bascules)
        .map((e) => (e.href ? `<li><a href="${esc(e.href)}">${esc(e.label)}</a></li>` : `<li>${esc(e.label)}</li>`))
        .join('')}</ul></section>`
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
  return wrapContent(`<div class="ssr-decision">
<nav class="ssr-dc-bc" aria-label="Fil d'Ariane"><ol><li><a href="/">Lexenegal</a></li><li><a href="/jurisprudence">Jurisprudence</a></li><li><a href="/decision/${esc(d.slug || '')}">${esc(ref)}</a></li></ol></nav>
<div class="ssr-dc-grille">
<div class="ssr-dc-gauche" aria-hidden="true"><div class="ssr-dc-collant"><span class="ssr-dc-retour"></span><span class="ssr-dc-saut"></span><span class="ssr-dc-saut"></span></div></div>
<article class="ssr-dc-main">
<div class="ssr-dc-badge">${iconeSsr('Scale', 14)}Source Certifiée : Lexenegal.sn</div>
<h1 class="ssr-dc-titre">${esc([d.juridiction, ref, d.chambre].filter(Boolean).join(' - '))}</h1>
<p class="ssr-dc-date">${esc(dateFr || 'Date N/D')}</p>
${outilsDecisionSsr('ssr-dc-outils-m')}
<section class="ssr-dc-synthese" id="ssr-synthese"><h2 class="ssr-dc-synthese-titre">${iconeSsr('BookOpen', 14)}Synthèse Juridique</h2>${tags}${resume}${refs}</section>
<section class="ssr-dc-corps" id="ssr-texte"><h2 class="ssr-dc-corps-titre">Texte intégral</h2><div class="legal-content-wrapper"><div class="legal-content"><div>${corps}</div></div></div></section>
<ul class="ssr-meta">${meta}</ul>
${cites}${liees}
</article>
<div class="ssr-dc-droite" aria-hidden="true"><div class="ssr-dc-collant">${outilsDecisionSsr('ssr-dc-outils-d')}</div></div>
</div>
</div>`);
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

/*
 * ---------- Page d'un texte : version serveur HABILLÉE COMME LA PAGE REACT PRÊTE ----------
 * Décision du propriétaire (05/10/2026, option A) : à l'ouverture, on voyait 1 à 2 s une mise en page
 * (version serveur) puis une autre (page React) : « le rendu saute ». La version serveur reprend donc
 * la géométrie de src/pages/Code/CodePage.tsx (colonne de sommaire à gauche sur ordinateur, bouton
 * « Sommaire » sur téléphone, présentation, division ouverte par défaut) ; la bascule vers React ne
 * change plus que des polices et le contenu des zones en squelette.
 *  - Rendu À L'IDENTIQUE de React : présentation (TextPresentation.tsx), préambules repliés, fil, titre
 *    et compteur de la division ouverte, ses premières cartes d'articles (ArticleCard) ou son message
 *    « division vide ». Lectures en parallèle des articles : aucun temps de réponse ajouté.
 *  - Libellés de l'arbre (colonne « Sommaire ») et éléments interactifs (recherche, boutons, onglets) :
 *    EMPLACEMENTS vides de même taille (aria-hidden, sans texte), aux nombres de lignes de l'arbre.
 *  - Le contenu de référencement d'avant (h1, chapô, sommaire de tous les articles, textes liés) reste
 *    entier et visible, PREMIER dans le DOM ; le CSS (api/_ssr/styles.js, bloc « code ») l'affiche après la
 *    division ouverte, sous le premier écran.
 * ⚠️ DOUBLE RENDU : toute retouche de CodePage.tsx, TextPresentation.tsx ou de leurs CSS (marges,
 * tailles, ordre des blocs) se reporte ici et dans le bloc « code » de api/_ssr/styles.js.
 */
// Copie de CATEGORY_LABELS (src/components/TextPresentation/TextPresentation.tsx).
const NATURES_TEXTE = {
  code: 'Code', loi: 'Loi', decret: 'Décret', arrete: 'Arrêté', circulaire: 'Circulaire',
  ohada: 'Acte uniforme OHADA', uemoa: 'Texte UEMOA', cima: 'Texte CIMA (assurances)',
  convention: 'Convention collective', jors: 'Journal officiel',
};
const texteAbrogeSsr = (law) => !!(law && (law.abrogated_by_slug || law.abrogation_note));

// Bloc « Présentation » : même logique et même texte que TextPresentation.tsx.
export function presentationTexteSsr(law, nbArticles) {
  const nature = NATURES_TEXTE[law.category] || 'Texte juridique';
  const date = law.publication_date ? formatDateFr(law.publication_date) : '';
  const dateOk = date && date !== 'Invalid Date';
  const description = law.description && String(law.description).trim() ? law.description : '';
  const annee = law.publication_date ? String(new Date(law.publication_date).getUTCFullYear()) : null;
  const refPorteAnnee = !!(annee && law.reference && String(law.reference).includes(annee));
  const jo = joReferenceSsr(law);
  const pastille = (t) => `<span class="ssr-tp__chip">${esc(t)}</span>`;
  const meta = `<span class="ssr-tp__nature">${esc(nature)}</span>`
    + (law.reference && description ? pastille(law.reference) : '')
    + (!jo && dateOk && !refPorteAnnee ? pastille(`Publié le ${date}`) : '')
    + (jo ? pastille(`Publié au ${jo}`) : '')
    + (nbArticles > 0 ? pastille(`${nbArticles.toLocaleString('fr-FR')} articles`) : '');
  const corps = description
    ? `<h2 class="ssr-tp__label">Présentation</h2><div class="ssr-tp__body">${description}</div>`
    : `<p class="ssr-tp__fallback">${esc(law.short_title || law.title)} - texte intégral consolidé, à jour et structuré `
      + `article par article, dans le corpus du droit sénégalais sur Lexenegal.${law.reference ? ` Texte institué par : ${esc(law.reference)}.` : ''}</p>`;
  return `<section class="ssr-tp" aria-label="Présentation du texte"><div class="ssr-tp__meta">${meta}</div>${corps}</section>`;
}

// Préambule(s) en tête de page, repliés : carte ArticleCard de CodePage.tsx (le bouton « Copier » est un emplacement).
function preambulesSsr(law, articles) {
  const pre = (articles || []).filter(estPreambuleSsr);
  if (!pre.length) return '';
  const carte = (a) => {
    const abroge = a.status === 'abrogé' || a.is_active === false || texteAbrogeSsr(law);
    const numero = a.num_court || a.num || `Art. ${a.article_number}`;
    return `<div class="ssr-pa__card${abroge ? ' is-abroge' : ''}"><div class="ssr-pa__head"><span class="ssr-pa__left">${iconeSsr('ChevronRight', 15, 2, 'ssr-pa__chev')}`
      + `<span class="ssr-pa__num">${esc(numero)}</span>${abroge ? '<span class="ssr-pa__abroge">Abrogé</span>' : ''}</span>`
      + `<i class="ssr-pa__copy" aria-hidden="true"></i></div></div>`;
  };
  return `<div class="ssr-pa">${pre.map(carte).join('')}</div>`;
}

// Bandeau d'abrogation du texte entier, tel que CodePage.tsx l'affiche (.law-abrogation-banner).
function bandeauAbrogationTexteSsr(law) {
  if (!law || !law.abrogation_note) return '';
  const lien = law.abrogated_by_slug ? ` <a href="${esc(urlTexte(law.abrogated_by_slug))}">Voir le texte en vigueur →</a>` : '';
  return `<div class="ssr-code__abroge" role="note"><span aria-hidden="true">⛔</span><span>${esc(law.abrogation_note)}${lien}</span></div>`;
}


/*
 * Forme de la division que React ouvre par défaut (tree[0] de buildTreeFromNodes, src/lib/codeTree.ts),
 * pour que les emplacements aient la géométrie de la page prête : porte-t-elle des articles (bouton
 * « Imprimer » et cartes, sinon message « Sélectionnez une sous-section ») ; combien de divisions
 * racines, de pastilles d'articles et de sous-divisions dans la colonne « Sommaire », et son pied
 * (articles, chapitres). Du plan, seuls id, parent_id et type sont lus (fetchPlanLeger) ; le libellé de
 * la première racine vient de fetchPremiereRacine, celui d'une partie « legacy » du premier article.
 * Mêmes règles que React : préambules hors division, articles sans division (« Autres dispositions »)
 * en tête s'ils précèdent tous les autres. plan null (illisible) : cas le plus courant (division avec
 * articles, 81 % des textes au 05/10/2026). Plan vide : arbre « legacy » (buildTreeLegacy).
 */
export function divisionParDefautSsr(articles, plan, racine = null, premierArticle = null) {
  const arts = articles || [];
  const horsPreambule = (a) => !estPreambuleSsr(a);
  // liste : articles de la division dans l'ordre de lecture, préambules exclus (cartes de la page React).
  // noeud : la division (pour son libellé), null si inconnue ; enfants null : nombre de sous-divisions inconnu.
  const parDefaut = { articles: true, liste: null, noeud: null, racines: null, puces: null, enfants: null, chapitres: null };
  if (!plan) return parDefaut;
  if (!plan.length) {
    // buildTreeLegacy : une partie par part_title (« Dispositions » à défaut), des titres par title_name. Les 63
    // textes sans plan au 05/10/2026 ont tous une seule partie et aucun titre : une division racine qui porte
    // tous les articles, sans sous-division ni chapitre.
    const liste = arts.filter(horsPreambule);
    const partie = premierArticle && premierArticle.id === (arts[0] && arts[0].id) ? (premierArticle.part_title || 'Dispositions') : null;
    return {
      ...parDefaut, articles: liste.length > 0, liste, racines: 1, puces: arts, enfants: 0, chapitres: 0,
      noeud: partie ? { type: 'partie', numero: null, intitule: partie, name: partie } : null,
    };
  }
  const ids = new Set(plan.map((n) => n.id));
  const enfants = new Map();
  const racines = [];
  for (const n of plan) {
    if (n.parent_id && ids.has(n.parent_id)) {
      if (!enfants.has(n.parent_id)) enfants.set(n.parent_id, []);
      enfants.get(n.parent_id).push(n.id);
    } else racines.push(n.id);
  }
  const rattache = (a) => !!a.node_id && ids.has(a.node_id);
  // Articles triés par display_order puis id (fetchCodeArticles) : le rang dans la liste vaut l'ordre de lecture.
  const iOrphelins = [], iRattaches = [];
  arts.forEach((a, i) => { if (rattache(a)) iRattaches.push(i); else if (horsPreambule(a)) iOrphelins.push(i); });
  const nbRacines = racines.length + (iOrphelins.length ? 1 : 0);
  // Pied de colonne de CodePage.tsx : nœuds « chapitre » (ou « chapter ») de tout l'arbre.
  const chapitres = plan.filter((n) => n.type === 'chapitre' || n.type === 'chapter').length;
  if (iOrphelins.length && iRattaches.length && iOrphelins[iOrphelins.length - 1] < iRattaches[0]) {
    const liste = iOrphelins.map((i) => arts[i]);
    const noeud = { type: 'division', numero: null, intitule: 'Autres dispositions', name: 'Autres dispositions' };
    return { articles: true, liste, noeud, racines: nbRacines, puces: liste, enfants: 0, chapitres };
  }
  const premier = racines[0];
  if (premier == null) {
    const liste = iOrphelins.map((i) => arts[i]);
    return { ...parDefaut, articles: liste.length > 0, liste, racines: nbRacines, chapitres };
  }
  // Libellé : lu à part (fetchPremiereRacine), retenu seulement s'il s'agit bien de cette racine.
  const noeud = racine && racine.id === premier ? { ...racine, name: racine.label } : null;
  const sousArbre = new Set([premier]);
  for (const id of sousArbre) for (const e of enfants.get(id) || []) sousArbre.add(e);
  const liste = arts.filter((a) => rattache(a) && sousArbre.has(a.node_id) && horsPreambule(a));
  return {
    articles: liste.length > 0,
    liste,
    noeud,
    racines: nbRacines,
    puces: arts.filter((a) => a.node_id === premier),
    enfants: (enfants.get(premier) || []).length,
    chapitres,
  };
}

// Colonne « Sommaire » (ordinateur) : en-tête réel ; recherche, boutons et arbre en emplacements, aux
// nombres de lignes de l'arbre React (division racine active dépliée : pastilles puis sous-divisions).
function colonneSommaireSsr(law, forme, nbArticles) {
  const racines = forme.racines == null ? 15 : Math.min(forme.racines, 20);
  // Largeur d'une pastille d'article ≈ celle de son libellé (articleLabel) en Inter 11,52 px : lettres
  // étroites, larges, capitales ou courantes, plus 18 px de marges et de bordure.
  const largeur = (a) => Math.round(Math.min(240, 18 + [...articleLabelSeo(a)].reduce((t, c) => t
    + (/[ilIjtfr.,'’ 1]/.test(c) ? 3.6 : /[mwMW]/.test(c) ? 9.6 : /[A-ZÀ-Ý]/.test(c) ? 7.6 : 6.3), 0)));
  const puces = forme.puces == null
    ? '<i style="width:98px"></i><i style="width:63px"></i><i style="width:63px"></i>'
    : forme.puces.slice(0, 30).map((a) => `<i style="width:${largeur(a)}px"></i>`).join('');
  const enfants = '<i class="ssr-st__row ssr-st__row--sub"></i>'.repeat(Math.min(forme.enfants || 0, 10));
  return `<aside class="ssr-st" aria-hidden="true"><div class="ssr-st__in">`
    + `<div class="ssr-st__head"><div class="ssr-st__sur">Code sénégalais</div><div class="ssr-st__title">${esc(law.title)}</div></div>`
    + `<i class="ssr-st__search"></i><span class="ssr-st__ctl"><i></i><i></i></span>`
    + `<span class="ssr-st__tree"><i class="ssr-st__row is-active"></i>${puces ? `<span class="ssr-st__chips">${puces}</span>` : ''}${enfants}`
    + `${'<i class="ssr-st__row"></i>'.repeat(Math.max(racines - 1, 0))}</span>`
    // Pied (compteurs réels) seulement quand l'arbre est connu : sinon sa place est inconnue.
    + (forme.chapitres == null ? '' : `<span class="ssr-st__foot"><span><b>${nbArticles}</b><small>Articles</small></span>`
      + `<span><b>${forme.chapitres}</b><small>Chapitres</small></span></span>`)
    + `</div></aside>`;
}

// Plafond des cartes rendues ici : de quoi couvrir le premier écran, sans alourdir la page.
const CARTES_SSR = 4, CARTES_SSR_CARACTERES = 24000;

/*
 * Cartes d'articles de la division ouverte, telles que ArticleCard (CodePage.tsx) les affiche à son
 * premier rendu : numéro, date de la dernière modification, contenu (content_html brut : les renvois en
 * liens n'arrivent qu'ensuite, côté React), mots-clés, lien « Voir l'article complet ». Seuls les premiers
 * articles lus par fetchPremiersArticles peuvent être rendus ; on s'arrête au premier absent, et au premier
 * article écarté du sommaire d'un code fusionné (exclus : jamais de lien serveur vers une adresse redirigée).
 */
function cartesArticlesSsr(law, liste, contenus, exclus) {
  if (!liste || !contenus) return '';
  const cartes = [];
  let caracteres = 0;
  for (const a of liste) {
    const c = contenus.get(a.id);
    if (!c || !c.content_html || exclus.has(a.id) || cartes.length >= CARTES_SSR || caracteres > CARTES_SSR_CARACTERES) break;
    caracteres += c.content_html.length;
    const abroge = c.status === 'abrogé' || a.is_active === false || texteAbrogeSsr(law);
    const numero = a.num_court || a.num || `Art. ${a.article_number}`;
    const modifs = Array.isArray(c.modifications) && c.modifications.length ? c.modifications[c.modifications.length - 1] : '';
    const mots = Array.isArray(c.tags) && c.tags.length
      ? `<div class="ssr-ac__tags">${c.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : '';
    cartes.push(`<article class="ssr-ac${abroge ? ' is-abroge' : ''}"><div class="ssr-ac__head">`
      + `<span class="ssr-ac__left"><span class="ssr-ac__num">${esc(numero)}</span>${abroge ? '<span class="ssr-pa__abroge">Abrogé</span>' : ''}</span>`
      + `<span class="ssr-ac__right">${modifs ? `<span class="ssr-ac__date">${esc(modifs)}</span>` : ''}<i class="ssr-ac__copy" aria-hidden="true"></i></span></div>`
      + `<div class="ssr-ac__body"><div>${c.content_html}</div></div>${mots}`
      + `<a class="ssr-ac__lien" href="${esc(urlArticle(law.slug, a.slug))}">${iconeSsr('ExternalLink', 13)}Voir l'article complet</a></article>`);
  }
  return cartes.length ? `<div class="ssr-acs">${cartes.join('')}</div>` : '';
}

// Division ouverte par défaut (fil, en-tête, onglets, articles, division suivante) : emplacements, sauf la
// pastille statique « Version en vigueur », les premières cartes d'articles et le message de division vide.
function divisionSsr(law, forme, contenus, exclus) {
  const pastille = texteAbrogeSsr(law) ? '' : '<span class="ssr-dv__pill">Version en vigueur</span>';
  const articles = forme.articles
    ? (cartesArticlesSsr(law, forme.liste, contenus, exclus)
      || `<div class="ssr-dv__carte" aria-hidden="true"><span class="ssr-dv__carte-tete"><i></i><i></i></span><i></i><i></i><i class="ssr-dv__carte-lien"></i></div>`)
    : `<div class="ssr-dv__vide">${iconeSsr('FileText', 40)}<p>Sélectionnez une sous-section pour consulter les articles.</p></div>`;
  // Fil, titre et compteur de la division (CodePage.tsx) quand son libellé est connu, emplacements sinon.
  const f = forme.noeud ? formatNodeLabelSsr(forme.noeud) : null;
  const fil = f ? `<span class="ssr-dv__crumb">${esc(f.badge && f.label ? `${f.badge} - ${f.label}` : (f.badge || f.label))}</span>` : '<i aria-hidden="true"></i>';
  const titre = f
    ? `<h2 class="ssr-dv__titre">${f.badge ? `<span class="ssr-dv__badge">${esc(f.badge)}</span>` : ''}${esc(f.label)}</h2>`
    : '<span class="ssr-dv__h2" aria-hidden="true"><i></i><i></i></span>';
  const n = forme.liste ? forme.liste.length : null;
  const compteur = f && n != null && forme.enfants != null
    ? `<div class="ssr-dv__compte">${n} article${n > 1 ? 's' : ''}${forme.enfants > 0 ? ` · ${forme.enfants} sous-section${forme.enfants > 1 ? 's' : ''}` : ''}</div>`
    : '<i class="ssr-dv__meta" aria-hidden="true"></i>';
  return `<div class="ssr-dv__report" aria-hidden="true"><i></i></div>`
    + `<div class="ssr-dv__bc">${fil}${pastille}</div>`
    + `<div class="ssr-dv__head">${titre}${compteur}`
    + `${forme.articles ? '<i class="ssr-dv__print" aria-hidden="true"></i>' : ''}</div>`
    // Onglets « Articles (n) » et, s'il y a des sous-divisions, « Structure (n) » : emplacements.
    + `<div class="ssr-dv__tabs" aria-hidden="true"><i></i>${forme.enfants > 0 ? '<i></i>' : ''}</div>`
    + articles
    + `<div class="ssr-dv__nav" aria-hidden="true"><i></i></div>`;
}

/*
 * fusion (contexteFusion, null tant que la concordance du code est vide) : les anciens articles non
 * repris (rôle « identite ») sortent du sommaire du code en vigueur et forment une liste à part, en fin
 * de page ; le compteur ne retient que les articles en vigueur (fusion des codes 2026, 02/10/2026).
 */
export function buildCodeBody(law, articles, related, fusion = null, plan = null, contenus = null, racine = null) {
  const m = codeSeoMeta(law);
  const anciens = fusion && fusion.anciens && fusion.anciens.size ? fusion.anciens : null;
  // Code fusionné : un article désactivé n'est pas listé (cf. articleDuSommaire). Hors fusion : tous.
  const listes = fusion ? (articles || []).filter((a) => articleDuSommaire(fusion, a)) : (articles || []);
  const enVigueur = anciens ? listes.filter((a) => !anciens.has(a.id)) : listes;
  const nonRepris = anciens ? listes.filter((a) => anciens.has(a.id)) : [];
  const lienToc = (a) => {
    const label = a.num || a.num_court || (a.article_number != null ? `Article ${a.article_number}` : a.slug);
    return `<li><a href="${esc(urlArticle(law.slug, a.slug))}">${esc(label)}</a></li>`;
  };
  const links = enVigueur.map(lienToc).join('\n');
  const n = enVigueur.length;
  const titreAnciens = nonRepris.length ? titreAnciensArticles(fusion, nonRepris) : '';
  const tocAnciens = nonRepris.length
    ? `\n    <nav class="ssr-toc" aria-label="${attr(titreAnciens)}"><h2>${esc(titreAnciens)} (${nonRepris.length})</h2><ul>${nonRepris.map(lienToc).join('\n')}</ul></nav>`
    : '';
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
  // Présentation (description éditoriale de confiance, si renseignée) : carte de TextPresentation.tsx.
  // Compteur de la carte = tous les articles lus, comme React (totalArticles) ; le chapô garde n.
  // h1, chapô, sommaire et textes liés restent premiers dans le DOM ; le CSS les place sous la division.
  const forme = divisionParDefautSsr(articles, plan, racine, contenus && contenus.size ? contenus.values().next().value : null);
  // Articles écartés du sommaire (code fusionné) : aucune carte serveur ne doit y mener.
  const horsSommaire = new Set(fusion ? (articles || []).filter((a) => !articleDuSommaire(fusion, a)).map((a) => a.id) : []);
  return wrapContent(`<div class="ssr-code">
  ${colonneSommaireSsr(law, forme, (articles || []).length)}
  <article class="ssr-code__main">
    <h1>${esc(m.baseName)}${esc(m.geo)} - ${esc(m.descriptor)}</h1>
    ${intro}
    <i class="ssr-code__toggle" aria-hidden="true"></i>
    ${bandeauAbrogationTexteSsr(law)}
    ${preambulesSsr(law, articles)}
    ${presentationTexteSsr(law, (articles || []).length)}
    ${divisionSsr(law, forme, contenus, horsSommaire)}
    <nav class="ssr-toc" aria-label="Articles"><h2>Articles · ${esc(m.baseName)}</h2><ul>${links}</ul></nav>${tocAnciens}
    ${buildRelatedBlock(related)}
  </article>
</div>`);
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
/*
 * ancien (facultatif, fusion des codes 2026) : { libelle, annee } d'un ancien article NON REPRIS
 * (articleAncien). Son titre porte l'année du code d'origine et la mention « (abrogé) », jamais
 * « du Sénégal » : sans cela l'ancien article 13 de 1973 et l'article 13 en vigueur auraient le même
 * titre dans Google (« Article 13 du Code de la Sécurité sociale de 1973 (abrogé) »). Sans ce
 * paramètre, la règle est celle de src/lib/seoArticle.ts, à l'identique.
 */
export function intituleSeoArticle(a, t, ancien) {
  const nom = nomCourtTexte(t);
  const prep = PREPOSITIONS_SEO[premierMotSeo(nom)];
  if (ancien) {
    const suite = `${nom}${ancien.annee ? ` de ${ancien.annee}` : ''} (abrogé)`;
    if (!prep) return `${ancien.libelle} - ${suite}`;
    return prep.endsWith("'") ? `${ancien.libelle} ${prep}${suite}` : `${ancien.libelle} ${prep} ${suite}`;
  }
  const geo = t.category === 'code' && premierMotSeo(nom) === 'code' && !/s[ée]n[ée]gal|\(/i.test(nom) ? ' du Sénégal' : '';
  const lib = libelleSeoArticle(a);
  if (!prep) return `${lib} - ${nom}${geo}`;
  return prep.endsWith("'") ? `${lib} ${prep}${nom}${geo}` : `${lib} ${prep} ${nom}${geo}`;
}
export function titreSeoArticle(a, t, ancien) { return `${intituleSeoArticle(a, t, ancien)} | Lexenegal`; }
export function descriptionSeoArticle(a, t, texte, ancien) {
  const intitule = intituleSeoArticle(a, t, ancien);
  const extrait = String(texte || '').replace(/\s+/g, ' ').trim();
  if (!extrait) {
    const i = intitule.charAt(0).toLowerCase() + intitule.slice(1);
    // Un article abrogé n'est pas « en vigueur ».
    if (ancien) return `Texte intégral de l’${i}, avec la jurisprudence qui le cite.`;
    return `Texte intégral et en vigueur de l’${i}, avec la jurisprudence qui le cite.`;
  }
  const d = `${intitule} : ${extrait}`;
  if (d.length <= 160) return d;
  const coupe = d.slice(0, 159);
  return `${coupe.slice(0, coupe.lastIndexOf(' ')).replace(/[\s,;:]+$/, '')}…`;
}
/*
 * fa (facultatif) : résultat de fusionArticle pour un code fusionné en 2026. Ajoute l'état juridique
 * (legislationLegalForce : en vigueur, ou abrogé pour un ancien article non repris), le titre marqué
 * « (abrogé) » et les anciens numéros repris dans les mots-clés. Sans lui, en-tête inchangé.
 */
export function buildArticleHead(law, art, canonical, plain, fa = null) {
  const numLabel = libelleSeoArticle(art);
  const ancien = (fa && fa.ancien) || undefined;
  const title = titreSeoArticle(art, law, ancien);
  const description = descriptionSeoArticle(art, law, plain, ancien);
  const schema = {
    '@context': 'https://schema.org', '@type': 'Legislation', name: `${numLabel} - ${law.title}`,
    legislationIdentifier: String(art.article_number != null ? art.article_number : numLabel),
    inLanguage: 'fr',
    isPartOf: { '@type': 'Legislation', name: law.title, url: `${SITE}${urlTexte(law.slug)}` },
    legislationJurisdiction: { '@type': 'AdministrativeArea', name: 'Sénégal' }, url: canonical,
    ...(fa ? { legislationLegalForce: ancien ? 'https://schema.org/NotInForce' : 'https://schema.org/InForce' } : {}),
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
  const motsCles = fa && fa.motsCles ? `, ${fa.motsCles}` : '';
  return headBlock({ title, description, keywords: `${numLabel}, ${law.title}, Droit sénégalais, Lexenegal${motsCles}`, canonical, ogType: 'article', schema: [schema, filAriane] });
}
/*
 * Place de l'article dans le plan du code (livre / titre / chapitre / section…) : 96,5 % des articles
 * portent un node_id, seule donnée de contexte disponible à grande échelle. Rendue en TEXTE (bloc
 * « emplacement dans le texte » et arbre de la page article, cf. buildArticleBody), volontairement pas
 * en liens : la seule URL de chapitre qui existe est /code/:slug?node=… (/ccn/… pour une convention),
 * doublon de la page du code (rapport « Duplicate without user-selected canonical » de Search
 * Console). Seuls les articles (pastilles de l'arbre, précédent, suivant) sont des liens : ce sont de
 * vraies URL canoniques.
 */
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

/* ---------- FUSION DES CODES 2026 : versions datées, concordance, anciens articles ---------- */
/*
 * Décisions du propriétaire du 02/10/2026 : un seul Code du travail et un seul Code de la sécurité
 * sociale. L'ancien texte (1997, resp. 1973) devient la VERSION ANTÉRIEURE des articles 2026, rattachée
 * par sujet (table article_concordance), jamais par numéro. Contrat commun au site, au rendu serveur et
 * au MCP : lexenegal-extraction/recette/work/_fusion-codes-2026/CONTRAT-IMPLEMENTATION.md.
 *
 * ⛔ Tant que la concordance d'un code est VIDE, rien de ce bloc ne s'applique à ses pages
 * (contexteFusion renvoie null) : le rendu reste celui d'avant la fusion, à l'octet près.
 */

/*
 * Choix de la version affichée et libellés des versions : COPIE de src/lib/versionsArticle.ts (même
 * règle, mêmes noms, mêmes signatures ; contrat de la fusion §1 et §3), que cette fonction Vercel ne
 * peut pas importer. src/lib/__tests__/versionsApi.test.ts vérifie que les deux copies répondent pareil
 * et qu'elles suivent les cas du contrat : toute modification se reporte des deux côtés.
 */

// Copie fidèle de la fonction SQL fn_norm_article : « ART. » ou « ARTICLE » de tête retiré, MAJUSCULES,
// seuls [A-Z0-9-] restent (les accents tombent), puis les formes de « premier » valent « 1 ».
// 'L.56.' donne 'L56', 'L76 bis' donne 'L76BIS', 'premier' donne '1'.
const PREMIER_NORM = new Set(['PREMIER', 'PREMIRE', 'PREMIERE', '1ER', '1ERE', 'IER']);
export function normAncien(numero) {
  const x = String(numero ?? '')
    .replace(/^\s*ART(ICLE)?\.?\s*/i, '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  return PREMIER_NORM.has(x) ? '1' : x;
}
// Numéro ancien tel qu'on l'affiche : sans point final (« L.56. » s'affiche « L.56 »).
export function numeroAncienAffiche(numero) {
  return String(numero ?? '').trim().replace(/\.+$/, '').trim();
}
// Date réelle au format AAAA-MM-JJ (« 2015-02-30 » est refusée). Seule forme acceptée pour ?date=.
export function estDateValide(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, j] = s.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}
const jourDe = (s) => String(s ?? '').slice(0, 10);
// Jour précédent : une version qui expire le 3 septembre était en vigueur jusqu'au 2.
function veille(iso) {
  if (!estDateValide(jourDe(iso))) return '';
  const [a, m, j] = jourDe(iso).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j - 1)).toISOString().slice(0, 10);
}
const JOUR_MS = 86400000;
const ecartEnJours = (de, a) => Math.abs(Date.parse(a) - Date.parse(de)) / JOUR_MS;

// Chaîne d'une version : normAncien(ancien_numero), et pour une version sans ancien numéro, le numéro
// de l'article lui-même. Plusieurs prédécesseurs peuvent être en vigueur sur le même intervalle
// (art. 3 ← L.2, L.3, L.6…) : chacun a sa chaîne.
export function cleChaine(v, articleNumber) {
  return normAncien(v.ancien_numero ?? articleNumber ?? '');
}
// Tris STABLES sur la date d'effet (à date égale, l'ordre reçu est gardé).
const anciennesDabord = (vs) => [...vs].sort((x, y) => {
  const a = jourDe(x.effective_date);
  const b = jourDe(y.effective_date);
  return a < b ? -1 : a > b ? 1 : 0;
});
const recentesDabord = (vs) => [...vs].sort((x, y) => {
  const a = jourDe(x.effective_date);
  const b = jourDe(y.effective_date);
  return a > b ? -1 : a < b ? 1 : 0;
});
// Version courante : la plus récente des is_current, sinon la plus récente (règle d'avant la fusion).
export function versionCourante(versions) {
  const triees = recentesDabord(versions || []);
  return triees.find((v) => v.is_current) ?? triees[0] ?? null;
}
// Fin d'une version (exclue) : expiration_date, à défaut la date d'effet de la version suivante de la
// même chaîne, à défaut null (sans fin). Tolère les expirations manquantes des anciennes versions.
export function finVersion(v, versions, articleNumber) {
  if (v.expiration_date) return jourDe(v.expiration_date);
  const cle = cleChaine(v, articleNumber);
  const debut = jourDe(v.effective_date);
  let suivante = null;
  for (const w of versions) {
    if (w === v || cleChaine(w, articleNumber) !== cle) continue;
    const d = jourDe(w.effective_date);
    if (d > debut && (suivante === null || d < suivante)) suivante = d;
  }
  return suivante;
}
const enVigueurLe = (v, date, versions, articleNumber) => {
  const fin = finVersion(v, versions, articleNumber);
  return jourDe(v.effective_date) <= date && (fin === null || date < fin);
};
// Version d'UNE chaîne pour une date : celle qui la couvre, sinon la plus proche (horsPeriode).
function versionDeLaChaine(chaine, date, versions, articleNumber) {
  const triees = anciennesDabord(chaine);
  const couvrantes = triees.filter((v) => enVigueurLe(v, date, versions, articleNumber));
  if (couvrantes.length) return { version: couvrantes[couvrantes.length - 1], horsPeriode: null, ecart: 0 };
  const premiere = triees[0];
  if (date < jourDe(premiere.effective_date)) {
    return { version: premiere, horsPeriode: 'avant', ecart: ecartEnJours(date, jourDe(premiere.effective_date)) };
  }
  // Au-delà de la dernière version (ou dans un trou de la chaîne) : la dernière entrée en vigueur avant la date.
  const precedentes = triees.filter((v) => jourDe(v.effective_date) <= date);
  const version = precedentes[precedentes.length - 1];
  const fin = finVersion(version, versions, articleNumber) ?? date;
  return { version, horsPeriode: 'apres', ecart: ecartEnJours(fin, date) };
}
// Ordre de sortie : dates d'effet, puis ancien numéro en ordre naturel (L.2 avant L.36).
function ordonner(vs) {
  return [...vs].sort((a, b) => {
    const da = jourDe(a.effective_date);
    const db = jourDe(b.effective_date);
    if (da !== db) return da < db ? -1 : 1;
    return numeroAncienAffiche(a.ancien_numero).localeCompare(numeroAncienAffiche(b.ancien_numero), 'fr', { numeric: true });
  });
}
/*
 * Versions à afficher pour des paramètres d'adresse { date, ancien } (contrat §3) :
 * 1. sans date ni ancien : la version courante (comportement d'avant la fusion) ;
 * 2. fin d'une version : cf. finVersion ;
 * 3. avec ancien : la chaîne de cet ancien numéro ; avec date, la version qui la couvre (sinon la
 *    première, horsPeriode 'avant', ou la dernière, 'apres') ; sans date, la dernière de la chaîne ;
 *    chaîne vide (paramètre faux) : cas 1, sans bandeau ;
 * 4. avec date seule : les versions en vigueur à cette date, une par chaîne ; si aucune, la plus proche
 *    (horsPeriode) ; si la seule retenue est la courante : cas 1.
 * Sortie : { versions (ordre des dates d'effet puis des anciens numéros), estActuelle, horsPeriode }.
 */
export function choisirVersions(versions, params, articleNumber) {
  // Copies « même numéro » (lien_ancien = 'numero', 02/10/2026) : comparateur seulement, jamais
  // retenues comme version en vigueur à une date (copie de src/lib/versionsArticle.ts).
  const toutes = (versions || []).filter((v) => v.lien_ancien !== 'numero');
  const courante = versionCourante(toutes);
  const actuelle = { versions: courante ? [courante] : [], estActuelle: true, horsPeriode: null };
  if (!courante) return actuelle;
  const date = estDateValide(params && params.date) ? params.date : null;
  const ancien = normAncien(params && params.ancien);
  const resultat = (choisies, horsPeriode) => {
    if (!choisies.length || (choisies.length === 1 && choisies[0].id === courante.id)) return actuelle;
    return { versions: ordonner(choisies), estActuelle: false, horsPeriode };
  };
  if (ancien) {
    const chaine = toutes.filter((v) => cleChaine(v, articleNumber) === ancien);
    if (!chaine.length) return actuelle;
    if (!date) return resultat([anciennesDabord(chaine)[chaine.length - 1]], null);
    const c = versionDeLaChaine(chaine, date, toutes, articleNumber);
    return resultat([c.version], c.horsPeriode);
  }
  if (date) {
    const chaines = new Map();
    for (const v of toutes) {
      const cle = cleChaine(v, articleNumber);
      chaines.set(cle, [...(chaines.get(cle) || []), v]);
    }
    const enVigueur = [];
    for (const chaine of chaines.values()) {
      const couvrantes = anciennesDabord(chaine).filter((v) => enVigueurLe(v, date, toutes, articleNumber));
      if (couvrantes.length) enVigueur.push(couvrantes[couvrantes.length - 1]);
    }
    if (enVigueur.length) return resultat(enVigueur, null);
    // Aucune version en vigueur à cette date : la plus proche, chaîne par chaîne.
    const candidats = [...chaines.values()].map((ch) => versionDeLaChaine(ch, date, toutes, articleNumber));
    const ecartMin = Math.min(...candidats.map((c) => c.ecart));
    const proches = candidats.filter((c) => c.ecart === ecartMin);
    return resultat(proches.map((c) => c.version), proches[0].horsPeriode);
  }
  return actuelle;
}

// « a », « a et b », « a, b et c ».
export function listeFr(items) {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}
// Anciens numéros affichés des versions retenues, sans doublon (« L.56 »).
export function anciensNumerosAffiches(versions) {
  const vus = [];
  for (const v of versions) {
    const n = numeroAncienAffiche(v.ancien_numero);
    if (n && !vus.includes(n)) vus.push(n);
  }
  return vus;
}
// « l'ancien article L.56 », « les anciens articles L.2 et L.3 » (vide si aucun).
export function mentionAnciens(numeros) {
  if (!numeros.length) return '';
  return numeros.length === 1 ? `l'ancien article ${numeros[0]}` : `les anciens articles ${listeFr(numeros)}`;
}
/*
 * Texte du bandeau d'une version qui n'est pas la courante (contrat §3, même texte que le site ; la
 * suite « - voir la version actuelle » est un lien posé par la page). null si la version est la courante.
 * « Version en vigueur le 4 mars 2015 (ancien article L.56) » ;
 * « Rédaction de l'ancien article L.56, en vigueur jusqu'au 2 septembre 2026 » (sans date) ;
 * « Version la plus ancienne disponible, en vigueur à partir du 1er décembre 1997 (ancien article L.56) ».
 */
export function libelleBandeauVersion(choix, params, versions, articleNumber) {
  if (choix.estActuelle || !choix.versions.length) return null;
  const numeros = anciensNumerosAffiches(choix.versions);
  const anciens = mentionAnciens(numeros);
  const parenthese = !numeros.length ? ''
    : numeros.length === 1 ? ` (ancien article ${numeros[0]})` : ` (anciens articles ${listeFr(numeros)})`;
  const premiere = choix.versions[0];
  const derniere = choix.versions[choix.versions.length - 1];
  const date = estDateValide(params && params.date) ? params.date : null;
  if (choix.horsPeriode === 'avant') {
    return `Version la plus ancienne disponible, en vigueur à partir du ${dateLongue(premiere.effective_date)}${parenthese}`;
  }
  if (date && choix.horsPeriode === null) return `Version en vigueur le ${dateLongue(date)}${parenthese}`;
  // Sans date, ou date au-delà de la dernière version de la chaîne.
  const fin = finVersion(derniere, versions, articleNumber);
  const jusquAu = fin ? `, en vigueur jusqu'au ${dateLongue(veille(fin))}` : '';
  if (anciens) {
    const de = anciens.startsWith('les ') ? `des ${anciens.slice(4)}` : `de ${anciens}`;
    return `Rédaction ${de}${jusquAu}`;
  }
  return `Version antérieure${jusquAu}`;
}
// Titre de la section d'une version quand plusieurs prédécesseurs s'affichent ensemble.
export function titreSectionVersion(v, libelleArticle) {
  const n = numeroAncienAffiche(v.ancien_numero);
  return n ? `Ancien article ${n}` : libelleArticle;
}
/*
 * Bandeau d'un ancien article NON REPRIS par le code refondu (concordance « identite »), construit à
 * partir de la référence du texte, jamais du champ notes (qui porte des remarques éditoriales
 * internes). « Article non repris par la loi n° 2026-18 du 3 septembre 2026 ; il reste consultable
 * dans sa rédaction antérieure. »
 */
export function libelleNonRepris(reference) {
  const ref = String(reference || '').trim();
  const suite = ' ; il reste consultable dans sa rédaction antérieure.';
  if (!ref) return `Article non repris par le texte en vigueur${suite}`;
  const m = ref.match(/^(loi|d[ée]cret|ordonnance)\b/i);
  if (!m) return `Article non repris par le texte en vigueur (${ref})${suite}`;
  const nature = m[1].toLowerCase();
  const article = nature === 'loi' ? 'la ' : nature === 'ordonnance' ? "l'" : 'le ';
  return `Article non repris par ${article}${nature}${ref.slice(m[1].length)}${suite}`;
}

/*
 * Paramètres ?ancien= et ?date= d'une page d'article. Un paramètre présent mais invalide (date
 * impossible, numéro non normalisé, paramètre répété) rend valide=false : le handler renvoie alors un
 * 301 vers l'adresse canonique, ce qui limite les variantes en cache et ferme la porte aux paramètres
 * fabriqués par les robots.
 */
export function lireParametresVersion(q) {
  const date = q && q.date !== undefined ? q.date : null;
  const ancien = q && q.ancien !== undefined ? q.ancien : null;
  if (date === null && ancien === null) return { present: false, valide: true, date: null, ancien: null };
  const valide = (date === null || estDateValide(date))
    && (ancien === null || (typeof ancien === 'string' && ancien !== '' && normAncien(ancien) === ancien));
  return { present: true, valide, date: valide ? date : null, ancien: valide ? ancien : null };
}

/*
 * Contexte de fusion d'un code, à partir de ses lignes de concordance (article_concordance). null si
 * le code n'en a pas : toutes les fonctions qui suivent se taisent alors.
 * anciens = ids des anciens articles NON REPRIS (rôle identite), restés dans le code comme abrogés ;
 * bascule = fin de l'ancienne numérotation (en_vigueur_jusqu_au, exclusive) ;
 * annee = année de la numérotation d'origine (numerotation_depuis : 1997 Travail, 1973 Sécurité sociale).
 */
export function contexteFusion(lignes) {
  const rows = (lignes || []).filter((l) => l && l.article_id && l.role);
  if (!rows.length) return null;
  const jours = (champ) => rows.map((l) => jourDe(l[champ])).filter(estDateValide).sort();
  const bascules = jours('en_vigueur_jusqu_au');
  const depuis = jours('numerotation_depuis');
  return {
    lignes: rows,
    anciens: new Set(rows.filter((l) => l.role === 'identite').map((l) => l.article_id)),
    bascule: bascules.length ? bascules[bascules.length - 1] : null,
    depuis: depuis.length ? depuis[0] : null,
    annee: depuis.length ? depuis[0].slice(0, 4) : null,
  };
}
const normLigne = (l) => l.ancien_norm || normAncien(l.ancien_numero);
const cleNumero = (n) => {
  const m = String(n ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : (normAncien(n) === '1' ? 1 : 0);
};
const ordreNumeros = (a, b) => cleNumero(a) - cleNumero(b) || String(a).localeCompare(String(b), 'fr', { numeric: true });
/*
 * Ancien slug d'un article repris ou éclaté (« article-l56 ») : cible = ligne « principal » de la
 * concordance, adresse ?ancien=<NORM> (contrat §2). Un ancien article non repris (identite) existe
 * toujours : jamais de redirection pour lui.
 */
export function cibleAncienSlug(fusion, slug) {
  if (!fusion || !slug) return null;
  const l = fusion.lignes.find((x) => x.role === 'principal' && x.ancien_slug === slug && x.article && x.article.slug);
  return l ? { slug: l.article.slug, ancien: normLigne(l) } : null;
}
// Anciens articles dont l'article 2026 reprend le sujet : [{ numero, norm, partiel }], partiel = ancien
// article éclaté entre plusieurs articles (statut 'eclate').
export function predecesseurs(fusion, articleId) {
  if (!fusion || !articleId) return [];
  const vus = new Set();
  const out = [];
  for (const l of fusion.lignes) {
    if (l.article_id !== articleId || (l.role !== 'principal' && l.role !== 'secondaire')) continue;
    const norm = normLigne(l);
    if (!norm || vus.has(norm)) continue;
    vus.add(norm);
    out.push({ numero: numeroAncienAffiche(l.ancien_numero), norm, partiel: l.statut === 'eclate' });
  }
  return out.sort((a, b) => ordreNumeros(a.numero, b.numero));
}
// Autres articles qui reprennent le même ancien article (principal d'abord, puis par numéro).
export function autresSuccesseurs(fusion, norm, articleId) {
  if (!fusion || !norm) return [];
  const vus = new Set();
  return fusion.lignes
    .filter((l) => normLigne(l) === norm && l.article_id !== articleId
      && (l.role === 'principal' || l.role === 'secondaire') && l.article && l.article.slug)
    .sort((a, b) => (a.role === 'principal' ? 0 : 1) - (b.role === 'principal' ? 0 : 1)
      || ordreNumeros(a.article.article_number, b.article.article_number))
    .filter((l) => !vus.has(l.article_id) && vus.add(l.article_id));
}
/*
 * Ancien article non repris : { libelle, annee }. L'année vient du num (« Article 13 (Code de 1973) »)
 * ou, à défaut, de la numérotation d'origine de la concordance ; rien n'est inventé.
 */
const MENTION_ANCIEN = /\s*\(Code de (\d{4})\)\s*$/;
export function articleAncien(art, fusion) {
  if (!fusion || !art || !fusion.anciens.has(art.id)) return null;
  const num = String(art.num || '').trim();
  const m = MENTION_ANCIEN.exec(num);
  return {
    libelle: libelleSeoArticle(m ? { ...art, num: num.slice(0, m.index) } : art),
    annee: m ? m[1] : fusion.annee,
  };
}
/*
 * Filet du code fusionné (relecture du 02/10/2026) : un article DÉSACTIVÉ (is_active = false) n'est ni
 * listé au sommaire, ni compté, ni chaîné en précédent/suivant, comme dans le sitemap (is_active=eq.true).
 * La migration SUPPRIME les anciens articles repris (contrat §1) ; si elle les désactivait à la place,
 * ces ~274 articles de 1997 (display_order 1..297) se mêleraient au code 2026 (10..4640) et chaque
 * lien ouvrirait un 301. Hors fusion (concordance vide), tout article est listé : rendu d'avant.
 */
export function articleDuSommaire(fusion, a) {
  return !fusion || !a || a.is_active !== false;
}
// Compteur du titre et du chapô d'un code : les articles en vigueur seulement (hors fusion : tous).
export function nombreArticlesEnVigueur(articles, fusion) {
  const liste = articles || [];
  return fusion ? liste.filter((a) => articleDuSommaire(fusion, a) && !fusion.anciens.has(a.id)).length : liste.length;
}
/*
 * Filtre PostgREST du précédent/suivant d'un article de code fusionné : la lecture suivie reste dans le
 * même ensemble (code en vigueur, ou anciens articles non repris) et ne passe jamais par un article
 * désactivé (cf. articleDuSommaire). Chaîne vide hors fusion : requêtes d'avant, inchangées.
 */
export function filtreVoisinsFusion(fusion, artId) {
  if (!fusion) return '';
  const anciens = [...fusion.anciens];
  const ensemble = anciens.length ? `&id=${fusion.anciens.has(artId) ? 'in' : 'not.in'}.(${anciens.join(',')})` : '';
  return `${ensemble}&is_active=eq.true`;
}
// Titre de la liste à part du sommaire : « Articles du Code de 1997 non repris » (contrat §1).
export function titreAnciensArticles(fusion, articles) {
  const m = (articles || []).map((a) => MENTION_ANCIEN.exec(String(a.num || '').trim())).find(Boolean);
  const annee = m ? m[1] : fusion && fusion.annee;
  return annee ? `Articles du Code de ${annee} non repris` : 'Anciens articles non repris';
}
// « du Code du Travail », « de la Loi… » : préposition du nom d'un texte (mêmes règles que les titres).
function deTexte(nom) {
  const prep = PREPOSITIONS_SEO[premierMotSeo(nom)];
  if (!prep) return `- ${nom}`;
  return prep.endsWith("'") ? `${prep}${nom}` : `${prep} ${nom}`;
}
// « Le texte de l'ancien article L.56 est aussi repris à l'article 138. » (contrat §3), liens datés.
// Seulement pour une version reprise d'un ancien article (ancien_numero renseigné) : à la Sécurité
// sociale, les anciens numéros (« 137 ») recouvrent les nouveaux.
function aussiRepris(fusion, law, art, v, params) {
  if (v.ancien_numero == null) return '';
  const brut = v.ancien_numero;
  const norm = normAncien(brut);
  const autres = autresSuccesseurs(fusion, norm, art.id);
  if (!norm || !autres.length) return '';
  const suffixe = `?ancien=${encodeURIComponent(norm)}${params && params.date ? `&date=${params.date}` : ''}`;
  const liens = autres.map((l) => {
    const n = libelleSeoArticle(l.article).replace(/^Article\s+/i, '');
    return { href: `${urlArticle(law.slug, l.article.slug)}${suffixe}`, n };
  });
  const ou = liens.length === 1
    ? `à l'<a href="${esc(liens[0].href)}">article ${esc(liens[0].n)}</a>`
    : `aux articles ${listeFr(liens.map((l) => `<a href="${esc(l.href)}">${esc(l.n)}</a>`))}`;
  return `<p class="ssr-version-aussi">Le texte de l'ancien article ${esc(numeroAncienAffiche(brut))} est aussi repris ${ou}.</p>`;
}
const STYLE_BANDEAU_VERSION = 'background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #d97706;color:#78350f;padding:0.85rem 1.1rem;border-radius:8px;margin:0 0 1.25rem;';
const STYLE_BANDEAU_ABROGE = 'background:#fef2f2;border:1px solid #fca5a5;border-left:4px solid #dc2626;color:#991b1b;padding:0.85rem 1.1rem;border-radius:8px;margin:0 0 1.25rem;';
/*
 * Éléments propres à une page d'article d'un code fusionné : { ancien, h1, avantTitre, apresTitre,
 * contenu, motsCles }, ou null hors fusion (rendu inchangé).
 *  - ancien article non repris : bandeau construit à partir des DONNÉES (référence du code, même texte
 *    que le site), jamais du champ notes, qui porte des remarques éditoriales internes ; H1 marqué
 *    « (abrogé) » ;
 *  - version antérieure retenue (choix de choisirVersions) : bandeau « voir la version actuelle » en tête,
 *    texte de la version (une section par prédécesseur s'il y en a plusieurs) ;
 *  - article 2026 qui reprend d'anciens articles : « Correspond aux anciens articles L.56 et L.57 du
 *    Code du Travail de 1997 », pour que les recherches sur l'ancien numéro trouvent la page.
 */
export function fusionArticle({ fusion, law, art, choix = null, params = null, versions = null }) {
  if (!fusion || !law || !art) return null;
  const adresse = urlArticle(law.slug, art.slug);
  const nom = nomCourtTexte(law);
  const ancien = articleAncien(art, fusion);
  let avantTitre = '';
  let contenu = null;
  if (ancien) {
    avantTitre += `<div class="ssr-abrogation" role="note" style="${STYLE_BANDEAU_ABROGE}">⛔ ${esc(libelleNonRepris(law.reference))}</div>`;
  }
  if (choix && !choix.estActuelle && choix.versions && choix.versions.length) {
    const texte = libelleBandeauVersion(choix, params, versions || choix.versions, art.article_number);
    avantTitre += `<div class="ssr-version" role="note" style="${STYLE_BANDEAU_VERSION}">${esc(texte)} - <a href="${esc(adresse)}">voir la version actuelle</a></div>`;
    if (choix.versions.length === 1) {
      avantTitre += aussiRepris(fusion, law, art, choix.versions[0], params);
      contenu = choix.versions[0].content || '';
    } else {
      // Plusieurs prédécesseurs en vigueur à la date : une section par version, titrée « Ancien article L.x ».
      contenu = choix.versions.map((v) => `<section class="ssr-version-section"><h2>${esc(titreSectionVersion(v, libelleSeoArticle(art)))}</h2>`
        + `${aussiRepris(fusion, law, art, v, params)}${v.content || ''}</section>`).join('\n');
    }
  }
  const preds = ancien ? [] : predecesseurs(fusion, art.id);
  let apresTitre = '';
  if (preds.length) {
    const liens = preds.map((p) => `<a href="${esc(`${adresse}?ancien=${encodeURIComponent(p.norm)}`)}">${esc(p.numero)}</a>${p.partiel ? ' (en partie)' : ''}`);
    const quoi = preds.length === 1 ? `à l'ancien article ${liens[0]}` : `aux anciens articles ${listeFr(liens)}`;
    apresTitre = `\n    <p class="ssr-correspondance">Correspond ${quoi} ${esc(deTexte(nom))}${fusion.annee ? ` de ${esc(fusion.annee)}` : ''}.</p>`;
  }
  const motsCles = preds.slice(0, 6).map((p) => `article ${p.numero} ${nom}${fusion.annee ? ` ${fusion.annee}` : ''}`).join(', ');
  const h1 = ancien ? `${ancien.libelle}${ancien.annee ? ` du Code de ${ancien.annee}` : ''} (abrogé)` : null;
  return { ancien, h1, avantTitre, apresTitre, contenu, motsCles };
}

/* ---------- PAGE D'ARTICLE : version serveur habillée comme la page React prête ---------- */
/*
 * Décision du propriétaire du 05/10/2026 (option A) : la version serveur d'un article porte la mise
 * en page de src/pages/Code/ArticlePage.tsx une fois chargée (colonne de l'arbre, fil d'Ariane,
 * emplacement dans le texte, encadré du texte, cartes des décisions), pour que la bascule vers React
 * ne se voie presque plus. Le texte reste affiché tout de suite.
 *  - Contenu : tout ce que portait la version serveur reste dans la page (h1, texte, correspondance
 *    avec les anciens articles, décisions, précédent / suivant), en texte et en liens visibles.
 *  - Boutons de la page React (Sommaire, Imprimer, Comparer, Signaler, Retour) : EMPLACEMENTS vides
 *    de même taille, aria-hidden, sans texte.
 *  - Mise en forme : api/_ssr/styles.js, bloc « article » (polices locales recalées, index.html).
 * ⚠️ DOUBLE RENDU : une modification de la structure d'ArticlePage.tsx, de CodeNavTree.tsx ou de
 * src/lib/codeTree.ts (arbre, libellés) se reporte ici ET dans ce bloc CSS.
 */


// COPIE de buildTreeFromNodes / buildTreeLegacy / countArticles / segmentsNoeud (src/lib/codeTree.ts) :
// l'arbre de la colonne de gauche, construit comme celui de CodeNavTree.
const noeudVide = (id, name, type, intitule = name) => ({ id, name, type, numero: null, intitule, note: null, articles: [], children: [] });
export function arbreDuTexteSsr(noeuds, arts) {
  const racine = [];
  if (noeuds && noeuds.length) {
    const map = new Map();
    for (const nd of noeuds) {
      map.set(nd.id, { id: nd.id, name: nd.label, type: nd.type, numero: nd.numero, intitule: nd.intitule, note: nd.note ?? null, articles: [], children: [] });
    }
    for (const nd of noeuds) {
      const h = map.get(nd.id);
      if (nd.parent_id && map.has(nd.parent_id)) map.get(nd.parent_id).children.push(h);
      else racine.push(h);
    }
    const orphelins = [];
    for (const a of arts) {
      if (a.node_id && map.has(a.node_id)) map.get(a.node_id).articles.push(a);
      else if (!estPreambuleSsr(a)) orphelins.push(a);
    }
    if (orphelins.length) {
      orphelins.sort((x, y) => x.display_order - y.display_order);
      const noeud = { ...noeudVide('__sans-division', 'Autres dispositions', 'division'), articles: orphelins };
      const rangs = arts.filter((a) => a.node_id && map.has(a.node_id)).map((a) => a.display_order);
      const avantTout = rangs.length > 0 && orphelins[orphelins.length - 1].display_order < Math.min(...rangs);
      if (avantTout) racine.unshift(noeud); else racine.push(noeud);
    }
    return racine;
  }
  for (const a of arts) {
    const nomPartie = a.part_title || 'Dispositions';
    let partie = racine.find((n) => n.name === nomPartie);
    if (!partie) { partie = noeudVide(nomPartie, nomPartie, 'partie'); racine.push(partie); }
    if (a.title_name) {
      let titre = partie.children.find((n) => n.name === a.title_name);
      if (!titre) { titre = noeudVide(a.title_name, a.title_name, 'titre'); partie.children.push(titre); }
      if (a.chapter_name) {
        let chap = titre.children.find((n) => n.name === a.chapter_name);
        if (!chap) { chap = noeudVide(a.chapter_name, a.chapter_name, 'chapitre'); titre.children.push(chap); }
        chap.articles.push(a);
      } else titre.articles.push(a);
    } else partie.articles.push(a);
  }
  return racine;
}
const compterSsr = (n) => n.children.reduce((c, ch) => c + compterSsr(ch), n.articles.length);
function premierRangSsr(n) {
  if (n._rang !== undefined) return n._rang;
  let r = Infinity;
  for (const a of n.articles) if (a.display_order < r) r = a.display_order;
  for (const ch of n.children) { const c = premierRangSsr(ch); if (c < r) r = c; }
  n._rang = r;
  return r;
}
function segmentsSsr(n) {
  const segs = [];
  const pousser = (kind, x) => {
    const der = segs[segs.length - 1];
    if (der && der.kind === kind) der.items.push(x); else segs.push({ kind, items: [x] });
  };
  let i = 0;
  let cle = -Infinity;
  for (const ch of n.children) {
    const r = premierRangSsr(ch);
    if (r !== Infinity) cle = r;
    while (i < n.articles.length && n.articles[i].display_order < cle) pousser('articles', n.articles[i++]);
    pousser('divisions', ch);
  }
  while (i < n.articles.length) pousser('articles', n.articles[i++]);
  return segs;
}
function cheminArbreSsr(cible, noeuds, chemin = []) {
  for (const n of noeuds) {
    const suite = [...chemin, n];
    if (n.id === cible) return suite;
    const trouve = cheminArbreSsr(cible, n.children, suite);
    if (trouve) return trouve;
  }
  return null;
}
// Colonne de gauche (CodeNavTree), état initial de la page article : chemin de l'article déplié,
// son nœud actif, sa pastille active. Le nombre d'articles passe par data-n (affiché en CSS) : il
// ne s'ajoute pas au texte de la page.
export function arbreHtmlSsr(law, art, noeuds, arts) {
  const racine = arbreDuTexteSsr(noeuds, arts || []);
  if (!racine.length) return '';
  const actif = art.node_id ?? null;
  const ouverts = new Set(actif ? (cheminArbreSsr(actif, racine) || []).map((n) => n.id) : []);
  let max = 0;
  const parcourir = (ns) => ns.forEach((n) => { const c = compterSsr(n); if (c > max) max = c; parcourir(n.children); });
  parcourir(racine);
  max = max || 1;
  const pastille = (a) => {
    const cls = `ssr-tchip${a.slug === art.slug ? ' is-active' : ''}${(a.status === 'abrogé' || a.is_active === false) ? ' is-abroge' : ''}`;
    return `<a class="${cls}" href="${esc(urlArticle(law.slug, a.slug))}">${esc(articleLabelSeo(a))}</a>`;
  };
  const noeud = (n) => {
    const ouvert = ouverts.has(n.id);
    const tog = (n.children.length || n.articles.length) ? (ouvert ? ' is-open' : '') : ' is-ph';
    const { badge, label } = formatNodeLabelSsr(n);
    const nb = compterSsr(n);
    let h = `<div class="ssr-tn"><div class="ssr-th${actif != null && n.id === actif ? ' is-active' : ''}"><span class="ssr-tt${tog}"></span>`
      + `<span class="ssr-tl"><span class="ssr-ty">${esc(badge || NODE_KIND_SSR[n.type] || n.type)}</span> <span class="ssr-tm">${esc(label)}</span>`
      + `${n.note ? '<span class="ssr-tnota" aria-hidden="true"></span>' : ''}</span><span class="ssr-tc" data-n="${nb}"></span></div>`
      + `<div class="ssr-td"><i style="width:${(nb / max) * 100}%"></i></div>`;
    if (ouvert) {
      for (const seg of segmentsSsr(n)) {
        h += seg.kind === 'divisions'
          ? `<div class="ssr-tch">${seg.items.map(noeud).join('')}</div>`
          : `<div class="ssr-tas">${seg.items.map(pastille).join(' ')}</div>`;
      }
    }
    return `${h}</div>`;
  };
  return `<div class="ssr-troot">${racine.map(noeud).join('')}</div>`;
}

// COPIE de libellePeriode (src/lib/versionsArticle.ts) : « En vigueur du 1er décembre 1997 au 2 septembre
// 2026 », ou « En vigueur depuis le … » pour une version sans fin.
export function libellePeriodeSsr(v, versions, articleNumber) {
  const fin = finVersion(v, versions, articleNumber);
  return fin
    ? `En vigueur du ${dateLongue(v.effective_date)} au ${dateLongue(veille(fin))}`
    : `En vigueur depuis le ${dateLongue(v.effective_date)}`;
}
// Ligne de version sous le titre, comme ArticlePage.tsx : version actuelle sans fin, « En vigueur depuis
// le 3 septembre 2026 » (date à la façon du navigateur, sans « 1er ») ; version actuelle qui a une fin,
// ou version datée retenue (choix), sa période. Article sans version : date de publication du texte.
// null (date illisible) : emplacement vide de même hauteur.
export function ligneVersionSsr(versions, law, art, choix = null) {
  const liste = versions && versions.length ? versions : null;
  if (choix && !choix.estActuelle && choix.versions && choix.versions.length) {
    const v = choix.versions[0];
    if (!estDateValide(jourDe(v.effective_date))) return null;
    return { texte: libellePeriodeSsr(v, liste || choix.versions, art.article_number), note: choix.versions.length === 1 ? (v.version_note || '') : '' };
  }
  const v = liste ? versionCourante(liste)
    : (law && law.publication_date ? { effective_date: law.publication_date, expiration_date: null, version_note: null } : null);
  if (!v || !estDateValide(jourDe(v.effective_date))) return null;
  if (v.expiration_date) return { texte: libellePeriodeSsr(v, liste || [v], art.article_number), note: v.version_note || '' };
  const date = formatDateFr(v.effective_date);
  if (!date || date === 'Invalid Date') return null;
  return { texte: `En vigueur depuis le ${date}`, note: v.version_note || '' };
}

const jourMoisAn = (d) => {
  try { return new Date(d).toLocaleDateString('fr-FR', { timeZone: 'UTC' }); } catch (e) { return ''; }
};

/*
 * fa (facultatif) : résultat de fusionArticle (code fusionné en 2026). Sans lui, aucun élément de la
 * fusion n'apparaît dans la page.
 * habillage (facultatif) : { arbre: HTML de la colonne de gauche, version: ligneVersionSsr(…), bascule et
 * depuis : dates de la fusion, pour les cartes des décisions }.
 * Absent ou vide : colonne et ligne de version en emplacements gris de même taille.
 */
export function buildArticleBody(law, art, contentHtml, citing, chemin, voisins, fa = null, habillage = null) {
  const numLabel = art.num || art.num_court || (art.article_number != null ? `Article ${art.article_number}` : 'Article');
  const hab = habillage || {};
  const CHEVRON = '<span class="ssr-chev" aria-hidden="true"></span>';
  const racineListe = estConvention(law.slug)
    ? { nom: 'Conventions collectives', url: '/conventions-collectives' }
    : { nom: 'Codes', url: '/codes' };
  const filHtml = `<nav class="ssr-bc" aria-label="Fil d'Ariane"><a href="${racineListe.url}">${racineListe.nom}</a>${CHEVRON}`
    + `<a href="${esc(urlTexte(law.slug))}">${esc(law.title)}</a>${CHEVRON}<span class="ssr-bc-cur">${esc(numLabel)}</span></nav>`;

  // Emplacement dans le texte (Titre › Chapitre › …), mêmes libellés que la page React.
  const niveaux = (chemin || []).map((n) => {
    const { badge, label } = formatNodeLabelSsr({ ...n, name: n.label });
    return `<span class="ssr-ah-row">${badge ? `<span class="ssr-ah-badge ssr-ah-badge--${esc(n.type)}">${esc(badge)}</span> ` : ''}<span class="ssr-ah-label">${esc(label)}</span></span>`;
  }).join('');
  const emplacementHtml = niveaux ? `<div class="ssr-ah" aria-label="Emplacement dans le texte">${niveaux}</div>` : '';

  // Bandeau d'un article abrogé hors fusion (ArticlePage.tsx) ; l'ancien article non repris a le sien (fa).
  const abroge = art.status === 'abrogé' || art.is_active === false;
  const bandeauArticle = abroge && !(fa && fa.ancien)
    ? `<div class="ssr-abrogation" role="note">⛔ ${esc(art.notes || 'Cet article a été abrogé.')}</div>` : '';
  // Marque « ! » d'une nota (sans son texte) ; jamais sur un ancien article de 1997 (notes internes).
  const nota = art.notes && !abroge && !(fa && fa.ancien) ? '<span class="ssr-nota" aria-hidden="true"></span>' : '';
  const v = hab.version;
  const versionHtml = v
    ? `<p class="ssr-ver">${esc(v.texte)}${v.note ? `<span class="ssr-ver-note"> · ${esc(v.note)}</span>` : ''}</p>`
    : '<p class="ssr-ver ssr-ver--vide" aria-hidden="true"></p>';

  // Code fusionné : une décision antérieure à la bascule citait un ancien numéro (lien reporté) ; on le
  // dit et on mène au texte alors en vigueur, comme ArticlePage.tsx (sauf avant la numérotation d'origine).
  const bascule = hab.bascule || null;
  const citingHtml = `<section class="ssr-citing"><h2>Décisions citant cet article</h2>${(citing && citing.length)
    ? `<ul>${citing.map((c) => {
        const d = c.decision; if (!d || !d.slug) return '';
        const jour = jourDe(d.date_decision);
        const propre = normAncien(art.article_number);
        const anciensCites = (c.anciens_numeros || []).filter((n) => normAncien(n) && normAncien(n) !== propre);
        const anciens = anciensCites.map(numeroAncienAffiche).filter(Boolean);
        const avantBascule = anciens.length > 0 && !!jour && !!bascule && jour < bascule;
        const meta = [d.chambre, d.date_decision ? jourMoisAn(d.date_decision) : ''].filter(Boolean).join(' · ')
          + (avantBascule ? ` · cite ${mentionAnciens(anciens)}` : '');
        const extrait = c.citation_text ? `<span class="ssr-cc-x">"...${esc(c.citation_text)}..."</span>` : '';
        const alors = avantBascule && estDateValide(jour) && !(hab.depuis && jour < hab.depuis)
          ? `<li class="ssr-cc-v"><a href="${esc(`${urlArticle(law.slug, art.slug)}?${anciensCites.length === 1 ? `ancien=${encodeURIComponent(normAncien(anciensCites[0]))}&` : ''}date=${jour}`)}">Texte alors en vigueur (${esc(anciens.length > 1 ? `anciens articles ${listeFr(anciens)}` : `ancien article ${anciens[0]}`)}, ${esc(jourMoisAn(d.date_decision))})</a></li>`
          : '';
        return `<li class="ssr-cc"><a href="/decision/${esc(d.slug)}">${esc(d.reference || 'Décision')}</a>${meta ? ` <span class="ssr-cc-m">${esc(meta)}</span>` : ''}${extrait}</li>${alors}`;
      }).filter(Boolean).join('')}</ul>`
    : '<div class="ssr-cc-vide" aria-hidden="true"></div>'}</section>`;

  // Précédent / suivant : chaîne les articles entre eux (sinon la page est un cul-de-sac). Le
  // bouton « Retour » de la page React n'a pas d'équivalent ici : emplacement vide.
  const lien = (a, sens) => (a && a.slug)
    ? `<a class="ssr-nav-${sens}" href="${esc(urlArticle(law.slug, a.slug))}" rel="${sens}">${esc(a.num || a.num_court || (a.article_number != null ? `Article ${a.article_number}` : 'Article'))}</a>`
    : `<span class="ssr-nav-${sens} ssr-nav--vide" aria-hidden="true"></span>`;
  const liens = `${lien(voisins && voisins.prec, 'prev')}<span class="ssr-nav-retour" aria-hidden="true"></span>${lien(voisins && voisins.suiv, 'next')}`;
  const navHtml = (voisins && ((voisins.prec && voisins.prec.slug) || (voisins.suiv && voisins.suiv.slug)))
    ? `<nav class="ssr-artnav" aria-label="Article précédent et suivant">${liens}</nav>`
    : `<div class="ssr-artnav" aria-hidden="true">${liens}</div>`;

  // contentHtml = HTML déjà généré par notre pipeline (de confiance) -> injecté tel quel
  return wrapContent(`<article class="ssr-article"><div class="ssr-a-layout"><div class="ssr-a-main">
    <span class="ssr-a-somm" aria-hidden="true"></span>
    ${filHtml}
    ${abrogationBanner(law)}${bandeauArticle}${fa ? fa.avantTitre : ''}
    <header class="ssr-a-head">${emplacementHtml}
    <h1>${esc((fa && fa.h1) || numLabel)}${nota}</h1>
    ${versionHtml}</header>
    <div class="ssr-act" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="ssr-a-box${abroge ? ' is-abroge' : ''}"><div class="ssr-article-body">${contentHtml || `<p>Texte de l'article non disponible.</p>`}</div></div>
    ${citingHtml}${fa ? fa.apresTitre : ''}
    ${navHtml}
  </div>
  ${hab.arbre
    ? `<nav class="ssr-a-tree" aria-label="Sommaire du texte">${hab.arbre}</nav>`
    : '<div class="ssr-a-tree ssr-a-tree--vide" aria-hidden="true"></div>'}
  </div></article>`);
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
/*
 * /codes : premier écran = réplique de CodesListPage (héros « Corpus National », onglets en emplacements
 * vides, grille des branches avec leurs codes). Les codes rattachés à une branche sont listés dans la
 * grille (mêmes liens qu'avant) ; le titre h1, le chapô et les autres catégories suivent sous la grille.
 * `branches` absent (requête en échec) : pas de grille, tous les codes restent dans l'index comme avant.
 */
const COULEUR_SSR = /^#[0-9a-fA-F]{3,8}$/;
export function buildCodesBody(texts, branches = [], comptes = null) {
  const order = ['code', 'loi', 'decret', 'arrete', 'ohada'];
  const groups = {};
  (texts || []).forEach((t) => { const k = String(t.category || 'code').toLowerCase(); (groups[k] = groups[k] || []).push(t); });
  const lien = (c) => `<li><a href="${esc(urlTexte(c.slug))}">${esc(c.short_title || c.title)}</a></li>`;
  const grille = (branches || []).filter((b) => b && b.slug && b.slug !== 'autres');
  const dansGrille = new Set();
  const cartes = grille.map((b) => {
    const siens = (groups.code || []).filter((c) => c.branche_slug === b.slug);
    siens.forEach((c) => dansGrille.add(c));
    const couleur = COULEUR_SSR.test(String(b.color || '')) ? b.color : '#047857';
    const liens = siens.map((c) => {
      const n = comptes && comptes[c.slug] != null
        ? `<span class="ssr-codes-n">${esc(comptes[c.slug])} art.</span>`
        : '<span class="ssr-codes-n" aria-hidden="true"></span>';
      return `<li><a href="${esc(urlTexte(c.slug))}"><span>${esc(c.short_title || c.title)}</span>${n}</a></li>`;
    }).join('\n');
    return `<section class="ssr-codes-carte${siens.length ? '' : ' ssr-codes-carte--bientot'}" style="--c:${couleur}">
      <div class="ssr-codes-carte-tete"><span class="ssr-codes-icone">${iconeSsr(b.icon, 28, 1.5)}</span><div><h2>${esc(b.label)}</h2>${b.description ? `<p>${esc(b.description)}</p>` : ''}</div></div>
      ${siens.length ? `<ul>${liens}</ul>` : '<p class="ssr-codes-bientot"><span>Prochainement</span></p>'}
    </section>`;
  }).join('\n');
  const sections = order.filter((k) => groups[k] && groups[k].length).map((k) => {
    const restants = groups[k].filter((c) => !dansGrille.has(c));
    if (!restants.length) return '';
    return `<section><h2>${esc(CAT_LABELS[k] || k)}</h2><ul>${restants.map(lien).join('\n')}</ul></section>`;
  }).join('\n');
  // catégories hors liste connue (au cas où), placées en fin
  const extra = Object.keys(groups).filter((k) => !order.includes(k)).map((k) => {
    return `<section><h2>${esc(k)}</h2><ul>${groups[k].map(lien).join('\n')}</ul></section>`;
  }).join('\n');
  return wrapContent(`<div class="ssr-codes ssr-ed">
    <header class="ssr-codes-hero"><div class="ssr-codes-hero-c">
      <div class="ssr-codes-embleme">${iconeSsr('Scale', 48, 1)}</div>
      <p class="ssr-codes-titre">Corpus National</p>
      <p class="ssr-codes-chapo">L'intégralité des textes de loi du Sénégal, structurés, versionnés et accessibles.</p>
      <div class="ssr-codes-recherche" aria-hidden="true">${iconeSsr('Search', 20)}</div>
    </div></header>
    <div class="ssr-codes-contenu"><div class="ssr-codes-c">
      ${cartes ? `<div class="ssr-codes-onglets" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="ssr-codes-sous-titre">le droit en vigueur - codes consolidés, à jour</p>
      <div class="ssr-codes-grille">${cartes}</div>` : ''}
      <article class="ssr-codes-index">
        <h1>Tous les codes et textes juridiques du Sénégal</h1>
        <p>Codes, lois, décrets, arrêtés et Actes uniformes OHADA consultables en texte intégral et version consolidée sur Lexenegal.</p>
        ${sections}${extra}
      </article>
    </div></div>
  </div>`);
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
  const dateFr = formatDateFr(d.date) === 'Invalid Date' ? '' : formatDateFr(d.date);
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
  // Premier écran = réplique de DoctrineDetailPage : retour, carte (surtitre, titre, méta à icônes),
  // articles visés, emplacements des deux boutons d'action, extrait, gate. Les libellés « Référence »,
  // « Service émetteur », « Date » de l'ancienne liste restent présents dans la fiche en pied de carte.
  const enTete = [
    `<li>${iconeSsr('Calendar', 15)}${esc(dateDoctrineSsr(d.date, d.reference_complete))}</li>`,
    `<li>${iconeSsr('FileText', 15)}${esc(ref)}</li>`,
    `<li>${iconeSsr('Building', 15)}${esc(d.service_emetteur || 'DGID')}</li>`,
    d.destinataire && `<li><strong>Destinataire :</strong>&nbsp;${esc(d.destinataire)}</li>`,
    d.signataire && `<li><strong>Signataire :</strong>&nbsp;${esc(d.signataire)}</li>`,
  ].filter(Boolean).join('\n');
  return wrapContent(`<div class="ssr-doctrine ssr-ed"><div class="ssr-doctrine-c">
    <nav class="ssr-doctrine-retour" aria-label="Fil d'Ariane"><a href="/doctrine-fiscale">${iconeSsr('ArrowLeft', 18)}Toute la doctrine fiscale</a></nav>
    <article class="ssr-doctrine-carte">
      <header class="ssr-doctrine-tete">
        <p class="ssr-doctrine-surtitre">${iconeSsr('BookOpen', 14)}Doctrine fiscale · DGID</p>
        <h1>${esc(objet || ref)}</h1>
        <ul class="ssr-meta">${enTete}</ul>
      </header>
      ${arts.length ? `<section class="ssr-doctrine-articles"><h2>Articles concernés</h2><ul>${arts.map((a) => `<li><a href="${attr(a.url)}">${esc(a.intitule)}</a></li>`).join('')}</ul></section>` : ''}
      <div class="ssr-doctrine-actions" aria-hidden="true"><span></span><span></span></div>
      <div class="ssr-doctrine-corps">
        ${extrait.length ? `<section class="ssr-doctrine-extrait"><h2>Extrait de la lettre</h2>${extrait.map((p) => `<p>${esc(p)}</p>`).join('')}<p>[…]</p></section>` : ''}
        <section class="ssr-doctrine-gate">
          <span class="ssr-doctrine-cadenas">${iconeSsr('Lock', 28)}</span>
          <p>Document de doctrine fiscale de la <strong>DGID</strong> (Sénégal). L'objet, les références et l'extrait ci-dessus sont en accès libre.</p>
          <p>Le <strong>texte intégral</strong> de cette lettre, avec la réponse de l'administration, est réservé aux membres. <a href="/signup">Créez un compte gratuit</a> pour le consulter, ou parcourez l'ensemble de la <a href="/doctrine-fiscale">doctrine fiscale</a>.</p>
        </section>
        <ul class="ssr-doctrine-fiche">${meta}</ul>
      </div>
    </article>
  </div></div>`);
}
/* Date affichée en tête de lettre : même règle que formatDoctrineDate (src/lib/doctrineDate.ts) - champ
 * `date`, sinon la date lue dans la référence (« … du 18 septembre 2009 »), sinon « Date inconnue ». */
const MOIS_DOCTRINE = { janvier: 0, fevrier: 1, 'février': 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, aout: 7, 'août': 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, 'décembre': 11 };
export function dateDoctrineSsr(dateStr, ref) {
  const direct = formatDateFr(dateStr);
  if (direct && direct !== 'Invalid Date') return direct;
  const m = String(ref || '').match(/\b(?:le|du)\s+(\d[\s\dA-Za-zÀ-ÿ]{3,40})/i);
  const mm = m && m[1].replace(/\s+/g, '').match(/^(\d{1,2})([A-Za-zÀ-ÿ]+?)(\d{4})/);
  const mois = mm ? MOIS_DOCTRINE[mm[2].toLowerCase()] : null;
  if (mois == null) return 'Date inconnue';
  return formatDateFr(new Date(Date.UTC(Number(mm[3]), mois, Number(mm[1]))).toISOString()) || 'Date inconnue';
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

/*
 * Corps serveur de la page-thème. Balisage CALQUÉ sur ThemePage.tsx (mêmes blocs, même ordre) et
 * habillé par le bloc « theme » de api/_ssr/styles.js : la version serveur et la page React prête se
 * superposent, la bascule ne se voit plus. Seule différence voulue : la FAQ reste dépliée (question +
 * réponse visibles, pour le référencement) là où React la replie dans des <details>.
 */
export function buildThemeBody(data) {
  const t = data.theme;
  const total = data.total || 0;
  const jurisTxt = (data.juridictions || [])
    .slice(0, 6).map((j) => `${j.juridiction} (${j.n})`).join(', ');
  const decs = (data.decisions || []).map((d) => {
    const meta = [d.juridiction, d.chambre, formatDateFr(d.date_decision)].filter(Boolean).join(' - ');
    const snippet = stripHtml(d.resume || '');
    return `<li class="ssr-theme-dec"><a href="/decision/${esc(d.slug)}"><strong>${esc(d.reference || 'Décision')}</strong></a>${meta ? `<span class="ssr-theme-dec-meta">${esc(meta)}</span>` : ''}${snippet ? `<p>${esc(snippet)}</p>` : ''}</li>`;
  }).join('\n');
  const arts = (data.articles || []).map((a) =>
    `<li><a href="${esc(urlArticle(a.code_slug, a.article_slug))}">${esc(a.article_label)} - ${esc(a.code_title)}</a> <span class="ssr-theme-art-n">cité par ${a.n} décision${a.n > 1 ? 's' : ''}</span></li>`
  ).join('\n');
  const faq = Array.isArray(t.faq) ? t.faq.filter((f) => f && f.q && f.a) : [];
  const faqHtml = faq.length
    ? `<section class="ssr-theme-faq"><h2>${iconeSsr('CircleHelp', 18)} Questions fréquentes - ${esc(t.label)}</h2>
       ${faq.map((f) => `<div class="ssr-theme-q"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('\n')}</section>`
    : '';
  return wrapContent(`<div class="ssr-theme"><article>
    <nav class="ssr-bc" aria-label="Fil d'Ariane"><a href="/jurisprudence">Jurisprudence</a> <span>›</span> ${esc(t.label)}</nav>
    <header>
      <span class="ssr-theme-eyebrow">${iconeSsr('Scale', 14)} Thème de jurisprudence</span>
      <h1>${esc(t.h1)}</h1>
      <p class="ssr-theme-chapo">${esc(t.chapo)}</p>
      <p class="ssr-theme-stats"><strong>${total} décisions</strong> sur ce thème dans la base${jurisTxt ? ` : ${esc(jurisTxt)}.` : '.'}</p>
    </header>
    ${arts ? `<section class="ssr-theme-arts"><h2>${iconeSsr('BookOpen', 18)} Articles de codes les plus cités</h2><ul>${arts}</ul></section>` : ''}
    <section class="ssr-theme-decs"><h2>${iconeSsr('FileText', 18)} Décisions récentes - ${esc(t.label)}</h2><ul>${decs}</ul></section>
    ${faqHtml}
    <p class="ssr-theme-more"><a href="/search?q=${encodeURIComponent(t.label)}">Rechercher « ${esc(t.label)} » dans toute la base →</a></p>
  </article></div>`);
}

/* ---------- GUIDES PRATIQUES (/guides et /guides/:slug) ---------- */
/*
 * Pages éditoriales (guides, guide, doctrine, codes) : la version serveur reproduit le PREMIER ÉCRAN
 * de la page React prête (mêmes blocs, mêmes positions), pour que la bascule serveur -> React ne se
 * voie pas. Mise en forme : api/_ssr/styles.js (blocs guides, guide, doctrine, codes). Icônes :
 * iconeSsr (copies partagées) ; les boutons et champs de la page
 * React sont des emplacements vides de même taille, jamais du faux texte.
 * ⚠️ Double rendu : toute retouche de GuidesPage / GuideDetailPage / DoctrineDetailPage /
 * CodesListPage (textes fixes, ordre des blocs, tailles) se reporte ici ET dans api/_ssr/styles.js.
 */
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
  // FAQ : mêmes boîtes que les <details> de GuideDetailPage, réponses VISIBLES (contenu de référencement).
  const faqHtml = faq.length
    ? `<section class="ssr-guide-faq"><h2>Questions fréquentes</h2>
       ${faq.map((f) => `<div class="ssr-guide-qr"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('\n')}</section>`
    : '';
  const themeLink = gd.theme_slug
    ? `<p class="ssr-guide-theme"><a href="/jurisprudence/theme/${esc(gd.theme_slug)}">${iconeSsr('Scale', 16)}Voir la jurisprudence liée à ce guide →</a></p>`
    : '';
  const dateFr = formatDateFr(gd.published_at);
  // Premier écran = réplique de GuideDetailPage (fil d'Ariane, titre, date, corps). La devise
  // « la mémoire juridique du Sénégal », absente de l'en-tête React, est reportée en fin d'article.
  return wrapContent(`<div class="ssr-guide ssr-ed"><article class="ssr-guide-c">
    <nav class="ssr-bc" aria-label="Fil d'Ariane"><a href="/guides">Guides pratiques</a> <span>›</span> ${esc(gd.title)}</nav>
    <h1>${esc(gd.h1 || gd.title)}</h1>
    ${dateFr ? `<p class="ssr-guide-date">Publié le ${esc(dateFr)} - Lexenegal</p>` : ''}
    <div class="ssr-guide-body">${gd.content_html || ''}</div>
    ${faqHtml}
    ${themeLink}
    <p class="ssr-guide-devise">Lexenegal, la mémoire juridique du Sénégal.</p>
  </article></div>`);
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
  // Premier écran = réplique de GuidesPage (surtitre, titre, chapô, cartes). Chapô : mot pour mot celui
  // de la page React, les deux liens internes conservés.
  return wrapContent(`<div class="ssr-guides ssr-ed"><article class="ssr-guides-c">
    <header>
      <p class="ssr-guides-surtitre">${iconeSsr('BookMarked', 14)}Guides pratiques</p>
      <h1>Guides pratiques du droit sénégalais</h1>
      <p class="ssr-guides-chapo">Des réponses claires, appuyées sur les <a href="/codes">codes, les lois</a> et la <a href="/jurisprudence">jurisprudence du Sénégal</a>, aux questions juridiques les plus fréquentes.</p>
    </header>
    <ul class="ssr-guides-list">${items}</ul>
  </article></div>`);
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
/*
 * Balisage CALQUÉ sur JurisprudencePage.tsx et habillé par le bloc « jurisprudence » de
 * api/_ssr/styles.js. Le formulaire de recherche (purement interactif) est un EMPLACEMENT vide de même
 * taille (aria-hidden, sans texte) ; le lien texte vers /search est conservé, en bas de page.
 */
export function buildJurisprudenceBody(themes) {
  const list = themes || [];
  const matieres = list.filter((t) => t.matiere);
  const sujets = list.filter((t) => !t.matiere);
  const li = (t) => `<li><a href="/jurisprudence/theme/${esc(t.slug)}">${esc(t.label)}</a>${t.cached_total ? ` <span class="ssr-theme-art-n">${t.cached_total} décisions</span>` : ''}</li>`;
  return wrapContent(`<div class="ssr-jurisprudence"><article>
    <header>
      <span class="ssr-juris-eyebrow">${iconeSsr('Scale', 14)} Jurisprudence</span>
      <h1>Jurisprudence du Sénégal et de l'OHADA</h1>
      <p class="ssr-juris-intro">Consultez les <strong>décisions de justice du Sénégal</strong> en texte intégral : Cour suprême, Cour de cassation, Conseil constitutionnel, cours d'appel et tribunaux, ainsi que la <strong>Cour commune de justice et d'arbitrage (CCJA)</strong> de l'OHADA. Chaque décision est reliée aux articles de codes qu'elle cite.</p>
      <div class="ssr-juris-search" aria-hidden="true">${iconeSsr('Search', 18)}<span class="ssr-juris-field"></span><span class="ssr-juris-btn"></span></div>
    </header>
    ${matieres.length ? `<section class="ssr-juris-section"><h2>${iconeSsr('Landmark', 18)} Jurisprudence par matière</h2><ul class="ssr-juris-grid ssr-juris-grid--matieres">${matieres.map(li).join('\n')}</ul></section>` : ''}
    ${sujets.length ? `<section class="ssr-juris-section"><h2>${iconeSsr('Tags', 18)} Jurisprudence par thème</h2><ul class="ssr-juris-grid">${sujets.map(li).join('\n')}</ul></section>` : ''}
    <p class="ssr-juris-more"><a href="/search">Rechercher une décision, un mot-clé ou une référence →</a></p>
  </article></div>`);
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
  try { return await sb(`laws_and_codes?is_active=eq.true&select=slug,title,short_title,category,branche_slug&order=category,title&limit=300`); }
  catch (e) { return []; }
}
// Grille des branches de /codes (14 lignes) et nombre d'articles par code : mêmes données que
// CodesListPage, demandées EN PARALLÈLE de fetchAllTexts. Échec = page servie sans grille / sans nombres.
async function fetchBranches() {
  try { return await sb(`branches?select=slug,label,icon,color,description,ordre&order=ordre&limit=100`); }
  catch (e) { return []; }
}
async function fetchComptesCodes() {
  try {
    const rows = await sb(`laws_and_codes?is_active=eq.true&category=eq.code&select=slug,articles:articles(count)&limit=300`);
    return Object.fromEntries((rows || []).map((r) => [r.slug, (r.articles && r.articles[0] && r.articles[0].count) || 0]));
  } catch (e) { return null; }
}
async function fetchDecision(slug) {
  return one(await sb(`decisions?slug=eq.${encodeURIComponent(slug)}&select=id,reference,slug,date_decision,juridiction,chambre,matiere_principale,parties_principales,resume,mots_cles,articles_loi_cites,texte_brut,texte_integral,decisions_similaires&limit=1`));
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
/*
 * anciens_numeros (fusion des codes 2026) : numéros cités par la décision quand le lien a été reporté
 * sur l'article 2026 qui en a repris le sujet. Si la lecture enrichie échoue (colonne absente d'un
 * environnement), on retombe sur la lecture d'avant : le bloc reste servi.
 */
async function fetchCitedArticles(decisionId) {
  try {
    return await sb(`decision_article_links?decision_id=eq.${decisionId}&select=anciens_numeros,article:articles(slug,num,num_court,article_number,code:laws_and_codes(id,slug,title))&limit=40`);
  } catch (e) { /* lecture d'avant ci-dessous */ }
  try {
    return await sb(`decision_article_links?decision_id=eq.${decisionId}&select=article:articles(slug,num,num_court,article_number,code:laws_and_codes(slug,title))&limit=40`);
  } catch (e) { return []; }
}
/*
 * Bascule de numérotation des codes visés par des liens reportés : { [code_id]: { bascule, depuis } }.
 * Aucune requête tant qu'aucun lien ne porte d'ancien numéro (avant la migration des données).
 * En cas d'échec : pas d'entrée, le lien vise alors l'article sans paramètre (jamais de lien mort).
 */
async function fetchBascules(cited) {
  const ids = [...new Set((cited || [])
    .filter((c) => c && Array.isArray(c.anciens_numeros) && c.anciens_numeros.length)
    .map((c) => c.article && c.article.code && c.article.code.id).filter(Boolean))];
  const out = {};
  await Promise.all(ids.map(async (id) => {
    try {
      const l = one(await sb(`article_concordance?code_id=eq.${encodeURIComponent(id)}&select=en_vigueur_jusqu_au,numerotation_depuis&order=en_vigueur_jusqu_au.desc&limit=1`));
      if (l) out[id] = { bascule: String(l.en_vigueur_jusqu_au || '').slice(0, 10), depuis: String(l.numerotation_depuis || '').slice(0, 10) };
    } catch (e) { /* pas de date : lien sans paramètre */ }
  }));
  return out;
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
    // id et is_active : servent, dans un code fusionné (2026) seulement, à écarter du sommaire les
    // anciens articles non repris (liste à part) et les articles désactivés (articleDuSommaire).
    // node_id : forme de la division que la page React ouvre par défaut (divisionParDefautSsr).
    const page = await sb(`articles?code_id=eq.${codeId}&select=id,num,num_court,article_number,slug,is_active,node_id&order=display_order,id&offset=${offset}&limit=${PAGE_POSTGREST}`);
    lignes.push(...page);
    if (page.length < PAGE_POSTGREST) return lignes;
  }
}
// Plan du texte réduit à sa forme (id, parent_id, type, dans l'ordre de CodePage.tsx) : sert seulement à la
// géométrie de la version serveur (divisionParDefautSsr). Lu en parallèle des articles. null si illisible
// ou s'il atteint le plafond de PostgREST (plan peut-être tronqué) : la page prend alors la forme courante.
async function fetchPlanLeger(codeId) {
  try {
    const plan = await sb(`structure_nodes?code_id=eq.${codeId}&select=id,parent_id,type&order=position,id&limit=${PAGE_POSTGREST}`);
    return Array.isArray(plan) && plan.length < PAGE_POSTGREST ? plan : null;
  } catch (e) { return null; }
}
// Contenu des tout premiers articles (ordre de lecture) : les cartes de la division ouverte au premier
// écran (cartesArticlesSsr). Lu en parallèle des articles ; Map vide si illisible.
async function fetchPremiersArticles(codeId) {
  try {
    const rows = await sb(`articles?code_id=eq.${codeId}&select=id,content_html,modifications,status,tags,part_title&order=display_order,id&limit=${CARTES_SSR + 2}`);
    return new Map((rows || []).map((r) => [r.id, r]));
  } catch (e) { return new Map(); }
}
// Libellé de la première division racine (ordre de CodePage.tsx) : fil et titre de la division ouverte par
// défaut. Lu en parallèle ; null si illisible.
async function fetchPremiereRacine(codeId) {
  try {
    return one(await sb(`structure_nodes?code_id=eq.${codeId}&parent_id=is.null&select=id,type,numero,intitule,label&order=position,id&limit=1`));
  } catch (e) { return null; }
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
  return one(await sb(`articles?code_id=eq.${codeId}&slug=eq.${encodeURIComponent(artSlug)}&select=id,num,num_court,article_number,slug,content_html,node_id,display_order,is_active,status,notes&limit=1`));
}
// Plan du code (structure_nodes) : sert à situer l'article dans sa hiérarchie et à dessiner l'arbre
// de la colonne de gauche (même ordre que la page React : position). Chargé en une requête puis
// parcouru en mémoire : un code compte quelques centaines de nœuds tout au plus (340 au plus haut).
async function fetchStructureNodes(codeId) {
  try {
    return await sb(`structure_nodes?code_id=eq.${codeId}&select=id,parent_id,type,numero,intitule,label,note,position&order=position&limit=5000`);
  } catch (e) { return []; }
}
// Article précédent et suivant, selon l'ordre d'affichage du code (display_order, puis id pour
// départager les articles de même rang : sans ce départage, ils étaient sautés).
// filtre (code fusionné en 2026, cf. filtreVoisinsFusion) : « &id=not.in.(…) » ou « &id=in.(…) » sur
// les anciens articles non repris, plus « &is_active=eq.true », pour que la lecture suivie du code en
// vigueur ne passe jamais par un article abrogé ou désactivé (et inversement). Vide hors fusion :
// requêtes inchangées.
async function fetchVoisins(codeId, ordre, artId, filtre = '') {
  if (ordre == null) return { prec: null, suiv: null };
  const champs = 'slug,num,num_court,article_number';
  try {
    const [prec, suiv] = await Promise.all([
      sb(`articles?code_id=eq.${codeId}&or=(display_order.lt.${ordre},and(display_order.eq.${ordre},id.lt.${artId}))${filtre}&select=${champs}&order=display_order.desc,id.desc&limit=1`),
      sb(`articles?code_id=eq.${codeId}&or=(display_order.gt.${ordre},and(display_order.eq.${ordre},id.gt.${artId}))${filtre}&select=${champs}&order=display_order.asc,id.asc&limit=1`),
    ]);
    return { prec: one(prec), suiv: one(suiv) };
  } catch (e) { return { prec: null, suiv: null }; }
}
/*
 * Concordance d'un code fusionné (article_concordance, lecture publique), paginée avec un ordre total
 * (clé primaire) : PostgREST plafonne en silence à 1 000 lignes. Ne lève jamais d'erreur : sans
 * concordance lisible, le code est rendu comme avant la fusion. transitoire = erreur réseau ou 5xx
 * (la page est alors gardée peu de temps au CDN) ; une 4xx (table absente) est durable.
 */
async function fetchConcordance(codeId) {
  const lignes = [];
  try {
    for (let offset = 0; ; offset += PAGE_POSTGREST) {
      const page = await sb(`article_concordance?code_id=eq.${codeId}&select=ancien_numero,ancien_norm,ancien_slug,article_id,role,statut,en_vigueur_jusqu_au,numerotation_depuis,article:articles(slug,article_number,num)&order=ancien_norm,article_id&offset=${offset}&limit=${PAGE_POSTGREST}`);
      lignes.push(...page);
      if (page.length < PAGE_POSTGREST) return { lignes, transitoire: false };
    }
  } catch (e) {
    // Jamais de concordance partielle : elle classerait mal des articles.
    const m = /supabase (\d+)/.exec(String(e && e.message));
    return { lignes: [], transitoire: !m || Number(m[1]) >= 500 };
  }
}
// Toutes les versions d'un article (choix d'une version datée).
async function fetchVersions(artId) {
  return sb(`article_versions?article_id=eq.${artId}&select=id,content,effective_date,expiration_date,is_current,ancien_numero,version_note,lien_ancien&order=effective_date.desc,id&limit=${PAGE_POSTGREST}`);
}
/*
 * Articles du texte pour l'arbre de la colonne de gauche (page article) : colonnes LÉGÈRES, sans
 * contenu (≈ 95 Ko pour les 487 articles du Code du travail), paginées avec un ordre total comme
 * chargerArticlesDuCode. avecChampsPlats : un texte sans structure_nodes construit son arbre sur
 * part_title / title_name / chapter_name. Échec : [] (la colonne reste un emplacement gris).
 */
async function fetchArticlesArbre(codeId, avecChampsPlats) {
  const colonnes = `slug,node_id,display_order,num,num_court,article_number,status,is_active,tags${avecChampsPlats ? ',part_title,title_name,chapter_name' : ''}`;
  const page = (offset) => sb(`articles?code_id=eq.${codeId}&select=${colonnes}&order=display_order,id&offset=${offset}&limit=${PAGE_POSTGREST}`);
  try {
    // Deux premières pages EN PARALLÈLE : un seul texte dépasse 1 000 articles (AUSCGIE, 1 104), qui
    // payait sinon un aller-retour de plus (+ 120 ms mesurés) ; pour les autres, la seconde revient vide.
    const [premiere, seconde] = await Promise.all([page(0), page(PAGE_POSTGREST)]);
    const lignes = [...premiere];
    if (premiere.length < PAGE_POSTGREST) return lignes;
    lignes.push(...seconde);
    for (let offset = 2 * PAGE_POSTGREST, derniere = seconde; derniere.length === PAGE_POSTGREST; offset += PAGE_POSTGREST) {
      derniere = await page(offset);
      lignes.push(...derniere);
    }
    return lignes;
  } catch (e) { return []; }
}
// Versions d'un article SANS leur contenu : ligne « En vigueur depuis le … » de la page article.
async function fetchVersionsLegeres(artId) {
  try {
    return await sb(`article_versions?article_id=eq.${artId}&select=id,effective_date,expiration_date,is_current,version_note,ancien_numero&order=effective_date.desc,id&limit=${PAGE_POSTGREST}`);
  } catch (e) { return []; }
}
async function fetchCurrentVersion(artId) {
  try {
    const rows = await sb(`article_versions?article_id=eq.${artId}&select=content,is_current&order=effective_date.desc&limit=5`);
    return (rows.find((v) => v.is_current) || rows[0] || {}).content || '';
  } catch (e) { return ''; }
}
/*
 * parDate (code fusionné en 2026) : les 20 décisions servies sont les plus RÉCENTES. Après le report des
 * liens, l'article 137 cumule toutes les décisions de l'ancien L.56 : sans ordre, les 20 retenues
 * seraient arbitraires. Si le tri sur la ressource liée échoue, lecture d'avant puis tri en mémoire.
 */
async function fetchCitingDecisions(artId, parDate = false) {
  const base = `decision_article_links?article_id=eq.${artId}&select=citation_text,decision:decisions(reference,slug,date_decision,chambre)`;
  if (parDate) {
    // anciens_numeros : « cite l'ancien article L.32 » et « Texte alors en vigueur » sous chaque décision
    // antérieure à la bascule, comme la page React (sa lecture triée porte la même colonne).
    try { return await sb(`${base.replace('select=citation_text,', 'select=citation_text,anciens_numeros,')}&order=decision(date_decision).desc.nullslast,id&limit=20`); } catch (e) { /* repli ci-dessous */ }
  }
  try {
    const rows = await sb(`${base}&limit=20`);
    if (!parDate) return rows;
    const jour = (c) => String((c && c.decision && c.decision.date_decision) || '');
    return [...rows].sort((a, b) => jour(b).localeCompare(jour(a)));
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
    /*
     * Contenu INTROUVABLE (slug inexistant, texte masqué) : 404, même coquille, même noindex.
     * Avant le 03/10/2026, la coquille partait en 200 (« soft 404 ») : une redirection oubliée restait
     * invisible (aucune 404 dans les journaux, Search Console la rangeait en « Soft 404 »). Le lecteur
     * voit toujours la page « non trouvé » de l'application. ⚠️ À n'appeler QUE sur une absence
     * certaine : toute lecture en échec (base, redirections, concordance) répond 503, jamais 404,
     * sinon une page valide sortirait de l'index sur une panne passagère.
     */
    const serveIntrouvable = () => {
      res.statusCode = 404;
      return serveShell(60, true);
    };
    // cache : durée plus courte quand la concordance n'a pas pu être lue (erreur passagère), pour
    // qu'une page rendue sans elle ne reste pas 24 h au CDN.
    const serveHtml = (headHtml, bodyHtml, cache = 'public, s-maxage=86400, stale-while-revalidate=604800') => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', cache);
      res.statusCode = 200;
      return res.end(injectIntoShell(shell, headHtml, bodyHtml));
    };
    const CACHE_COURT = 'public, s-maxage=300';
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
    /*
     * 301 de la fusion des codes 2026 (anciens slugs d'articles, textes retirés, paramètres de version
     * invalides). Gardé une heure seulement, au navigateur comme au CDN, pendant les premières semaines :
     * un 301 sans max-age est conservé sans limite par le navigateur, et une erreur de concordance
     * corrigée en base resterait figée chez le lecteur.
     */
    const serve301Fusion = (location) => {
      res.statusCode = 301;
      res.setHeader('Location', location);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      return res.end();
    };
    /*
     * Texte retiré par la fusion (TEXTES_RETIRES) et absent de la base : un seul saut jusqu'à la cible
     * finale, chemin et paramètres conservés. Un ancien slug d'article sous le texte retiré va
     * directement à l'article qui l'a repris. Texte cible introuvable : coquille noindex comme avant.
     */
    const redirigerTexteRetire = async (ancienTexte, artSlug) => {
      const nouveau = TEXTES_RETIRES[ancienTexte];
      let cibleLaw = null;
      try { cibleLaw = await fetchLaw(nouveau); } catch (e) { return serve503(); }
      if (!cibleLaw) return serveIntrouvable();
      const reste = requeteConservee(q);
      if (!artSlug) return serve301Fusion(`${SITE}${urlTexte(nouveau)}${reste}`);
      let artCible = null;
      let concCible = null;
      try {
        [artCible, concCible] = await Promise.all([fetchArticle(cibleLaw.id, artSlug), fetchConcordance(cibleLaw.id)]);
      } catch (e) { return serve503(); }
      if (!artCible) {
        const c = cibleAncienSlug(contexteFusion(concCible.lignes), artSlug);
        if (c) return serve301Fusion(`${SITE}${urlArticle(nouveau, c.slug)}?ancien=${encodeURIComponent(c.ancien)}`);
      }
      return serve301Fusion(`${SITE}${urlTexte(nouveau)}/${encodeURIComponent(artSlug)}${reste}`);
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
      const [texts, branches, comptes] = await Promise.all([fetchAllTexts(), fetchBranches(), fetchComptesCodes()]);
      return serveHtml(buildCodesHead(`${SITE}/codes`) + styleSsr('codes'), buildCodesBody(texts, branches, comptes));
    }

    if (type === 'doctrine') {
      const slug = q.slug;
      if (!slug) return serveShell();
      let d = null;
      try { d = await fetchDoctrine(slug); } catch (e) { return serve503(); }
      if (!d) {
        // Slug inconnu : peut-être un ancien slug → 301 vers le nouveau avant de renoncer.
        let redir = null;
        try { redir = await fetchDoctrineRedirect(slug); } catch (e) { return serve503(); }
        if (redir && redir.new_slug && redir.new_slug !== slug) {
          return serve301(`${SITE}/doctrine-fiscale/${encodeURIComponent(redir.new_slug)}`);
        }
        return serveIntrouvable();
      }
      const canonical = `${SITE}/doctrine-fiscale/${slug}`;
      let arts = [];
      try { arts = articlesDeDoctrine(await fetchDoctrineArticles(d.id)); } catch (e) { /* bonus : la page reste servie */ }
      return serveHtml(buildDoctrineHead(d, canonical, arts) + styleSsr('doctrine'), buildDoctrineBody(d, arts));
    }

    if (type === 'guides') {
      const guides = await fetchGuidesIndex();
      return serveHtml(buildGuidesHead(`${SITE}/guides`) + styleSsr('guides'), buildGuidesBody(guides));
    }

    if (type === 'guide') {
      const slug = q.slug;
      if (!slug) return serveShell();
      let gd = null;
      try { gd = await fetchGuide(slug); } catch (e) { return serve503(); }
      if (!gd) return serveIntrouvable();
      const canonical = `${SITE}/guides/${slug}`;
      return serveHtml(buildGuideHead(gd, canonical) + styleSsr('guide'), buildGuideBody(gd));
    }

    if (type === 'jurisprudence') {
      const themes = await fetchThemesIndex();
      return serveHtml(buildJurisprudenceHead(`${SITE}/jurisprudence`) + styleSsr('jurisprudence'), buildJurisprudenceBody(themes));
    }

    if (type === 'theme') {
      const slug = q.slug;
      if (!slug) return serveShell();
      let data = null;
      try { data = await fetchThemePage(slug); } catch (e) { return serve503(); }
      if (!data) return serveIntrouvable();
      const canonical = `${SITE}/jurisprudence/theme/${slug}`;
      return serveHtml(buildThemeHead(data, canonical) + styleSsr('theme'), buildThemeBody(data));
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
      if (!law) {
        if (TEXTES_RETIRES[slug]) return redirigerTexteRetire(slug, null);
        return serveIntrouvable();
      }
      // Plan léger, premiers contenus et première division lancés AVANT les articles, en parallèle : aucun
      // temps d'attente ajouté (ces trois lectures ne lèvent jamais).
      const planP = fetchPlanLeger(law.id), contenusP = fetchPremiersArticles(law.id), racineP = fetchPremiereRacine(law.id);
      let articles = [];
      try { articles = await fetchCodeArticles(law.id); } catch (e) { /* */ }
      const [related, conc, plan, contenus, racine] = await Promise.all([
        fetchRelatedTexts(law.id), fetchConcordance(law.id), planP, contenusP, racineP]);
      const canonical = `${SITE}${urlTexte(slug)}`;
      // Code fusionné en 2026 : le compteur ne retient que les articles en vigueur.
      const fusion = contexteFusion(conc.lignes);
      return serveHtml(buildCodeHead(law, nombreArticlesEnVigueur(articles, fusion), canonical) + styleSsr('code'), buildCodeBody(law, articles, related, fusion, plan, contenus, racine),
        conc.transitoire ? CACHE_COURT : undefined);
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
      if (!law) {
        if (TEXTES_RETIRES[codeSlug]) return redirigerTexteRetire(codeSlug, artSlug);
        return serveIntrouvable();
      }
      let art = null;
      let conc = null;
      try {
        [art, conc] = await Promise.all([fetchArticle(law.id, artSlug), fetchConcordance(law.id)]);
      } catch (e) { return serve503(); }
      // Code fusionné en 2026 (concordance non vide), sinon null : tout ce qui suit est alors inchangé.
      const fusion = contexteFusion(conc.lignes);
      // Ancien article repris seulement DÉSACTIVÉ au lieu d'être supprimé (la RLS des articles laisse tout
      // lire) : il ne doit pas être servi comme du droit en vigueur, il redirige comme s'il avait disparu.
      // Le sommaire et le précédent/suivant l'écartent aussi (articleDuSommaire, filtreVoisinsFusion).
      if (art && fusion && art.is_active === false && cibleAncienSlug(fusion, artSlug)) art = null;
      if (!art) {
        // Ancien slug d'un article repris ou éclaté (« article-l56 ») : 301 en un seul saut vers
        // l'article qui en a repris le sujet (ligne « principal »), ?ancien=L56, la date reportée si
        // elle est valide (contrat §2).
        const versReprise = (c) => serve301Fusion(`${SITE}${urlArticle(codeSlug, c.slug)}?ancien=${encodeURIComponent(c.ancien)}${estDateValide(q.date) ? `&date=${q.date}` : ''}`);
        const reprise = cibleAncienSlug(fusion, artSlug);
        if (reprise) return versReprise(reprise);
        // Ancien schéma d'URL où le slug d'article était préfixé par le slug du texte
        // (« X/X-art-8 ») : 301 vers le slug court si celui-ci existe en base.
        if (artSlug.startsWith(`${codeSlug}-`)) {
          const short = artSlug.slice(codeSlug.length + 1);
          // Code fusionné (relecture du 02/10/2026) : le slug court d'un ancien article repris
          // (/code/code-travail/code-travail-article-l56 → article-l56) n'existe plus en base. La
          // concordance donne directement l'article qui l'a repris, en un seul saut ; sans ce relais,
          // une adresse qui fonctionne aujourd'hui deviendrait une page vide.
          const repriseCourte = cibleAncienSlug(fusion, short);
          if (repriseCourte) return versReprise(repriseCourte);
          let alt = null;
          try { alt = await fetchArticle(law.id, short); } catch (e) { return serve503(); }
          if (alt) return serve301(adresseArticle(short));
        }
        // Concordance illisible (panne) : l'adresse est peut-être un ancien slug à rediriger. 503
        // (Google réessaiera), jamais 404.
        if (conc && conc.transitoire) return serve503();
        return serveIntrouvable();
      }
      const canonical = `${SITE}${urlArticle(codeSlug, artSlug)}`;
      /*
       * Version datée (?ancien=L56&date=2015-03-04), codes fusionnés seulement : la version en vigueur
       * à la date d'une décision, visible de tous, canonical inchangé (contrat §2 et §3). Paramètres
       * invalides ou version courante retenue : 301 vers l'adresse canonique. Versions illisibles
       * (réseau) : coquille de courte durée, l'application choisira elle-même la version.
       */
      const params = fusion ? lireParametresVersion(q) : null;
      let versions = null;
      let choix = null;
      if (params && params.present) {
        if (!params.valide) return serve301Fusion(canonical);
        try { versions = await fetchVersions(art.id); } catch (e) { return serveShell(60); }
        choix = choisirVersions(versions, params, art.article_number);
        if (choix.estActuelle) return serve301Fusion(canonical);
      }
      // Précédent et suivant restent dans le même ensemble (code en vigueur, ou anciens articles non
      // repris) et sautent les articles désactivés ; hors fusion, filtre vide.
      const filtreVoisins = filtreVoisinsFusion(fusion, art.id);
      // Tout en parallèle : le contexte enrichi ne doit pas rallonger le rendu.
      // Les trois requêtes ajoutées échouent en silence (contexte = bonus), le
      // texte de l'article reste servi quoi qu'il arrive.
      // Arbre de la colonne de gauche et ligne de version (habillage de la page, cf. buildArticleBody) :
      // deux lectures légères de plus, dans le même lot parallèle.
      const [content, citing, noeuds, voisins, articlesArbre, versionsLegeres] = await Promise.all([
        art.content_html ? Promise.resolve(art.content_html)
          : (versions ? Promise.resolve((versionCourante(versions) || {}).content || '') : fetchCurrentVersion(art.id)),
        // Les plus récentes d'abord pour tous les textes : mêmes premières cartes que la page React.
        fetchCitingDecisions(art.id, true),
        fetchStructureNodes(law.id),
        fetchVoisins(law.id, art.display_order, art.id, filtreVoisins),
        fetchArticlesArbre(law.id, !art.node_id),
        versions ? Promise.resolve(versions) : fetchVersionsLegeres(art.id),
      ]);
      const chemin = cheminDansLePlan(art.node_id, noeuds);
      const fa = fusionArticle({ fusion, law, art, choix, params, versions });
      // Le titre et la description restent ceux de la version actuelle (adresse canonique) ; le corps
      // montre la version retenue.
      const affiche = fa && fa.contenu != null ? fa.contenu : content;
      const habillage = {
        // Code fusionné : un article désactivé reste hors de l'arbre, comme du sommaire (articleDuSommaire).
        arbre: articlesArbre.length ? arbreHtmlSsr(law, art, noeuds, articlesArbre.filter((a) => articleDuSommaire(fusion, a))) : '',
        version: ligneVersionSsr(versionsLegeres, law, art, choix),
        // Bascule de numérotation (code fusionné) : cartes des décisions antérieures.
        bascule: fusion ? (fusion.bascule || jourDe((versionCourante(versionsLegeres || []) || {}).effective_date) || null) : null,
        depuis: fusion ? fusion.depuis : null,
      };
      return serveHtml(buildArticleHead(law, art, canonical, texteSeoArticle(content), fa) + styleSsr('article'),
        buildArticleBody(law, art, affiche, citing, chemin, voisins, fa, habillage),
        conc.transitoire ? CACHE_COURT : undefined);
    }

    // decision (défaut)
    const slug = q.slug || (req.url || '').replace(/^.*\/decision\//, '').replace(/[?#].*$/, '');
    if (!slug) return serveShell();
    let decision = null;
    try { decision = await fetchDecision(slug); } catch (e) { return serve503(); }
    if (!decision) {
      // Décision fusionnée lors d'un dédoublonnage : 301 vers la décision gardée.
      let redir = null;
      try { redir = await fetchDecisionRedirect(slug); } catch (e) { return serve503(); }
      if (redir && redir.new_slug && redir.new_slug !== slug) {
        return serve301(`${SITE}/decision/${encodeURIComponent(redir.new_slug)}`);
      }
      // Décision masquée (existe mais is_active=false) → 410 Gone ; sinon coquille noindex.
      let gone = false;
      try { gone = (await sbRpc('rpc_decision_gone', { p_slug: slug })) === true; } catch (e) { return serve503(); }
      if (gone) return serveGone();
      return serveIntrouvable();
    }
    const [cited, related] = await Promise.all([
      decision.id ? fetchCitedArticles(decision.id) : [],
      fetchRelatedDecisions(decision),
    ]);
    // Liens reportés par la fusion des codes 2026 : bascule de numérotation de leur code (aucune
    // requête tant qu'aucun lien ne porte d'ancien numéro).
    const bascules = await fetchBascules(cited);
    const canonical = `${SITE}/decision/${slug}`;
    return serveHtml(buildDecisionHead(decision, canonical) + styleSsr('decision'), buildDecisionBody(decision, cited, related, bascules));
  } catch (e) {
    res.statusCode = 500;
    return res.end('Erreur de rendu');
  }
}
