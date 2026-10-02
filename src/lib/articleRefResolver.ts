/**
 * Résolveur de références d'articles cités (conservateur, "fiabilité d'abord").
 *
 * Transforme une référence textuelle ("ARTICLE 3 AUDCG", "Article L.56 du Code du travail")
 * en lien SEULEMENT si on peut la résoudre avec certitude : code reconnu (index générique
 * dérivé de laws_and_codes + alias d'acronymes) ET article présent en base.
 * Sinon → texte simple. JAMAIS de lien mort. (Charte : renvois conditionnels.)
 *
 * Codes refondus (fusion des codes 2026, décisions du propriétaire du 02/10/2026) : l'ancienne
 * numérotation (« L.56 » du Code du travail de 1997, « article 65 » du CSS de 1973) passe par la
 * concordance PAR SUJET (article_concordance), jamais par le numéro : cf. resoudreRenvoi.
 *
 * Logique PURE (aucune I/O) → testable unitairement.
 */
import { CODES_REFONDUS } from './routeTexte';
import { estDateValide, jourDe, normAncien, veille } from './versionsArticle';

export interface ResolvedArticle {
  id: string;
  slug: string;
  article_number: string;
  code_slug: string;
  code_name: string;
}

export interface CodeRef {
  codeToken: string;     // acronyme ("AUDCG") ou nom de code ("Code du travail")
  articleNumber: string; // "3", "L.56"
}

export type CitedResolution =
  | { kind: 'link'; article: ResolvedArticle; label: string }
  | { kind: 'text'; label: string };

/** Un alias de code (acronyme → slug). SOURCE UNIQUE = vue DB `code_aliases`
 *  (elle-même dérivée de la table `ref_code`). Plus aucun dictionnaire codé en dur ici :
 *  les appelants chargent les alias depuis la base et les passent à buildCodeIndex. */
export interface CodeAlias { alias: string; code_slug: string; }

/** Normalise un token de code : majuscules, sans accents, alphanumérique only. */
export function normalizeToken(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Normalise un numéro d'article pour comparaison ("Article L. 56" → "L.56", " 3 " → "3"). */
export function normalizeArticleNumber(s: string): string {
  return (s || '')
    .toUpperCase()
    .replace(/^ART(?:ICLE)?\.?/, '')
    .replace(/[\s.]+/g, ''); // insensible aux espaces ET aux points ("L. 69" = "L69" = "L.69")
}

/** Index { numéro normalisé → article } d'articles reçus dans l'ordre de lecture du texte
 *  (display_order, puis id). À numéro égal, le PREMIER lu l'emporte : au Code pénal, les
 *  articles premier à 8 existent deux fois, dans le corps du code (rangs 10 à 80) et dans
 *  l'annexe III sur la cryptologie (rangs 60000 et plus). « Article 5 du code pénal » doit
 *  mener au corps du code, jamais à l'annexe. */
export function indexerParNumero<T extends { article_number: string }>(articles: T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const art of articles) {
    const k = normalizeArticleNumber(art.article_number);
    if (!index.has(k)) index.set(k, art);
  }
  return index;
}

export interface LawRef {
  slug: string;
  title?: string | null;
  short_title?: string | null;
  /** Slug du texte qui a abrogé celui-ci (ex. arrêté général n° 5254 de 1954 → décret 2021-1469). */
  abrogated_by_slug?: string | null;
  publication_date?: string | null;
}

/** Construit l'index générique token→slug à partir des codes (extensible : conventions collectives incluses dès qu'elles sont en base).
 *  À titre égal, le texte EN VIGUEUR l'emporte sur celui qu'il a abrogé ; la date de la décision fait le
 *  reste (cf. codePourDecision). (Du 23/09 au 02/10/2026, deux textes s'intitulaient « Code du Travail » ;
 *  depuis la fusion des codes 2026, il n'y en a plus qu'un, mais la règle vaut pour tout texte remplacé.) */
export function buildCodeIndex(
  laws: LawRef[],
  aliases: CodeAlias[] = [],
): Map<string, string> {
  const idx = new Map<string, string>();
  // alias d'acronymes - SOURCE UNIQUE = vue DB `code_aliases` (dérivée de ref_code), passés par l'appelant
  for (const a of aliases) {
    if (a?.alias && a?.code_slug) idx.set(normalizeToken(a.alias), a.code_slug);
  }
  // tokens dérivés des titres / short_title : textes en vigueur d'abord, puis textes abrogés
  const enVigueurDabord = [...laws.filter((l) => !l?.abrogated_by_slug), ...laws.filter((l) => !!l?.abrogated_by_slug)];
  for (const law of enVigueurDabord) {
    if (!law?.slug) continue;
    for (const name of [law.short_title, law.title]) {
      const t = normalizeToken(name || '');
      if (t.length >= 4 && !idx.has(t)) idx.set(t, law.slug);
    }
  }
  return idx;
}

/** Texte en vigueur → texte qu'il a abrogé, et date de publication du texte en vigueur. */
export interface Succession { predecesseur: string; depuis: string | null }

export function buildSuccessions(laws: LawRef[]): Map<string, Succession> {
  const pub = new Map(laws.map((l) => [l.slug, l.publication_date ?? null]));
  const out = new Map<string, Succession>();
  for (const l of laws) {
    if (l?.slug && l.abrogated_by_slug) {
      out.set(l.abrogated_by_slug, { predecesseur: l.slug, depuis: pub.get(l.abrogated_by_slug) ?? null });
    }
  }
  return out;
}

/**
 * Code visé par une référence citée dans une décision DATÉE, pour un texte remplacé par un AUTRE
 * texte (laws_and_codes.abrogated_by_slug : arrêté général n° 5254 de 1954 → décret 2021-1469,
 * arrêté 6508, décret 89-1329). Une décision rendue avant la publication du texte en vigueur cite
 * forcément l'ancien (une décision de 2015 sur le travail des femmes enceintes = arrêté de 1954).
 * Après, on garde le texte en vigueur, avec l'ancien en `repli` pour un numéro qui n'existe que
 * dans celui-ci. Jamais l'inverse : un arrêt ancien ne renvoie pas au texte récent.
 * Les codes refondus en 2026 (Code du travail, Code de la sécurité sociale) ne passent plus par
 * ici mais par leur concordance (resoudreRenvoi) : un seul texte, deux numérotations.
 */
export function codePourDecision(
  codeSlug: string,
  dateDecision: string | null | undefined,
  successions: Map<string, Succession>,
): { code: string; repli?: string } {
  const s = successions.get(codeSlug);
  if (!s) return { code: codeSlug };
  // Date inconnue (décision ou texte en vigueur) : prudence, le texte ancien, que cite l'immense
  // majorité du fonds.
  if (!dateDecision || !s.depuis || dateDecision < s.depuis) return { code: s.predecesseur };
  return { code: codeSlug, repli: s.predecesseur };
}

/** Mots-vides FR à ne jamais prendre pour un acronyme de code. */
const STOPWORDS = new Set(['DU', 'DE', 'DES', 'LA', 'LE', 'LES', 'ET', 'EN', 'AUX', 'SUR', 'PAR', 'UN', 'UNE']);

/** Extrait les références (code + article) d'une chaîne. Conservateur : 2 motifs nets. */
export function parseCitedString(raw: string): CodeRef[] {
  const refs: CodeRef[] = [];
  if (!raw) return refs;

  // Numéro cité, suffixe compris (fusion des codes 2026, 02/10/2026) : « L.76 bis » était lu L.76, et
  // « BIS » pris pour le sigle du code ; relié par la concordance, cela menait au successeur d'un
  // AUTRE article. (« L.29-1 » est déjà capturé en entier par [\w-]*.)
  const SUFFIXE = '(?:\\s+(?:bis|ter|quater|BIS|TER|QUATER|Bis|Ter|Quater)\\b)?';

  // Motif A : "ARTICLE <num> <ACRONYME>" (acronyme tout en majuscules, ≥2 lettres)
  const reAcronym = new RegExp(`\\bART(?:ICLE)?\\.?\\s+((?:L\\.?\\s?\\d+[\\w-]*|\\d+[\\w-]*)${SUFFIXE})\\s+([A-Z]{2,}[A-Z./]*)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = reAcronym.exec(raw)) !== null) {
    refs.push({ articleNumber: m[1].replace(/\s+/g, ''), codeToken: m[2] });
  }

  // Motif B : "Article <num> du <Nom de code>"
  const reNamed = new RegExp(`\\bArt(?:icle)?\\.?\\s+((?:L\\.?\\s?\\d+[\\w-]*|\\d+[\\w-]*)${SUFFIXE})\\s+d[eu]\\s+(?:la\\s+|l['']\\s*)?([^,;.()]+)`, 'gi');
  while ((m = reNamed.exec(raw)) !== null) {
    refs.push({ articleNumber: m[1].replace(/\s+/g, ''), codeToken: m[2].trim() });
  }

  // Anti mots-vides : un acronyme ne peut pas être « DU », « DE »… (évite les faux positifs)
  return refs.filter((r) => !STOPWORDS.has(normalizeToken(r.codeToken)));
}

/**
 * Résout UNE chaîne citée. Lien seulement si EXACTEMENT une référence est extraite ET
 * résolue (code connu + article présent). Sinon → texte. (Sécurité : multi-réfs = texte.)
 */
export function resolveCitedString(
  raw: string,
  codeIndex: Map<string, string>,
  lookup: (codeSlug: string, articleNumber: string) => ResolvedArticle | null,
): CitedResolution {
  const refs = parseCitedString(raw);
  if (refs.length !== 1) return { kind: 'text', label: raw };

  const ref = refs[0];
  const codeSlug = codeIndex.get(normalizeToken(ref.codeToken));
  if (!codeSlug) return { kind: 'text', label: raw };

  const article = lookup(codeSlug, ref.articleNumber);
  if (!article) return { kind: 'text', label: raw };

  return { kind: 'link', article, label: raw };
}

// ---------------------------------------------------------------------------
// Codes refondus : concordance ancien numéro → article actuel (fusion des codes 2026)
// ---------------------------------------------------------------------------

/** Ligne de article_concordance (lecture publique). */
export interface LigneConcordance {
  ancien_numero: string;
  /** fn_norm_article(ancien_numero) : 'L56', '65', '1'. */
  ancien_norm: string;
  ancien_slug: string;
  /** principal = cible des liens ; secondaire = reprend une partie ; identite = ancien article non repris. */
  role: string;
  statut: string;
  /** Bascule : dernier jour (exclu) de l'ancienne numérotation (2026-09-03). */
  en_vigueur_jusqu_au: string | null;
  /** Début de l'ancienne numérotation (1997-12-01 Travail ; 1973-07-31 Sécu). Avant : autre code. */
  numerotation_depuis: string | null;
  article_id: string;
  article?: { id: string; slug: string; article_number: string; num?: string | null } | null;
}

/** Index des renvois d'UN code : numérotation actuelle, et ancienne (concordance) s'il est refondu. */
export interface IndexRenvoi<T> {
  /** Numéro normalisé (normalizeArticleNumber) → article ; sans les anciens articles « identite ». */
  actuel: Map<string, T>;
  /** Ancien numéro (normAncien) → cible principal, à défaut identite. Vide : code sans concordance. */
  ancien: Map<string, T>;
  bascule: string | null;
  numerotationDepuis: string | null;
}

/** Renvoi résolu : l'article cible et les paramètres de version de son adresse (?ancien=&date=). */
export interface RenvoiResolu<T> {
  article: T;
  query: { ancien?: string; date?: string };
}

const ROLES_CIBLES = ['principal', 'identite'];

/**
 * Index des renvois d'un code à partir de ses articles (dans l'ordre de lecture) et de sa
 * concordance. `lignes` :
 * - [] ou absent : code sans concordance, index actuel seul (comportement d'avant la fusion) ;
 * - null : concordance ILLISIBLE (réseau, table absente). Pour un code refondu, aucun lien plutôt
 *   qu'un lien faux (le CSS de 1973 et celui de 2026 partagent 182 numéros) ; ailleurs, inchangé.
 */
export function construireIndexRenvoi<T extends { id: string; article_number: string }>(
  articles: T[],
  lignes: LigneConcordance[] | null | undefined,
  codeSlug?: string,
): IndexRenvoi<T> {
  const vide: IndexRenvoi<T> = { actuel: new Map(), ancien: new Map(), bascule: null, numerotationDepuis: null };
  if (lignes === null && codeSlug && CODES_REFONDUS.has(codeSlug)) return vide;
  const valides = (lignes || []).filter(
    (l) => l && l.article_id && l.ancien_norm && estDateValide(jourDe(l.en_vigueur_jusqu_au)),
  );
  if (!valides.length) return { ...vide, actuel: indexerParNumero(articles) };

  const parId = new Map(articles.map((a) => [a.id, a]));
  const identites = new Set(valides.filter((l) => l.role === 'identite').map((l) => l.article_id));
  const ancien = new Map<string, T>();
  for (const role of ROLES_CIBLES) {
    for (const l of valides) {
      if (l.role !== role || ancien.has(l.ancien_norm)) continue;
      const cible = parId.get(l.article_id);
      if (cible) ancien.set(l.ancien_norm, cible);
    }
  }
  const bascules = valides.map((l) => jourDe(l.en_vigueur_jusqu_au)).sort();
  const debuts = valides.map((l) => jourDe(l.numerotation_depuis)).filter((d) => estDateValide(d)).sort();
  return {
    actuel: indexerParNumero(articles.filter((a) => !identites.has(a.id))),
    ancien,
    bascule: bascules[bascules.length - 1] ?? null,
    numerotationDepuis: debuts[0] ?? null,
  };
}

/**
 * Cible d'une citation « article <numero> » d'un code, à la date de la citation (date de la
 * décision, ou date du texte qui contient la citation). Contrat de la fusion, §4 :
 * - code sans concordance : index actuel, comme avant la fusion ;
 * - date antérieure au début de l'ancienne numérotation : PAS de lien (le numéro vise un code plus
 *   ancien, non transposable : un arrêt de 1972 qui cite l'article 201 du Code du travail de 1961) ;
 * - date antérieure à la bascule, ou date inconnue ET numéro préfixé « L. » : index ANCIEN seul
 *   (clé normAncien, et 'L' + clé pour un numéro nu), adresse ?ancien=<NORM>[&date=<date>] ;
 * - sinon : index ACTUEL (numérotation 2026) ; un numéro « L. » introuvable y passe par l'ancien.
 * null = pas de lien (jamais de lien faux).
 */
export function resoudreRenvoi<T>(
  ref: { numero: string; date?: string | null },
  idx: IndexRenvoi<T> | null | undefined,
): RenvoiResolu<T> | null {
  if (!idx) return null;
  const numero = ref.numero || '';
  const actuel = (): RenvoiResolu<T> | null => {
    const a = idx.actuel.get(normalizeArticleNumber(numero));
    return a ? { article: a, query: {} } : null;
  };
  if (!idx.ancien.size || !idx.bascule) return actuel();

  const jour = jourDe(ref.date);
  const date = estDateValide(jour) ? jour : null;
  if (date && idx.numerotationDepuis && date < idx.numerotationDepuis) return null;

  const cle = normAncien(numero);
  const prefixeL = /^L\d/.test(cle);
  const ancien = (): RenvoiResolu<T> | null => {
    const cles = /^\d/.test(cle) ? [cle, `L${cle}`] : [cle];
    for (const k of cles) {
      const a = k ? idx.ancien.get(k) : undefined;
      if (a) return { article: a, query: date ? { ancien: k, date } : { ancien: k } };
    }
    return null;
  };

  if ((date && date < idx.bascule) || (!date && prefixeL)) return ancien();
  return actuel() ?? (prefixeL ? ancien() : null);
}

// ---------------------------------------------------------------------------
// Page d'un code refondu : date des renvois de chaque article affiché
// ---------------------------------------------------------------------------

/**
 * Anciens articles NON REPRIS d'un code refondu (lignes « identite ») → date à laquelle dater leurs
 * renvois : la veille de la bascule (2026-09-02), dernier jour où leur texte était en vigueur, dans
 * l'ancienne numérotation. Map vide : aucun (code sans concordance, ou concordance vide avant la
 * migration). null : concordance ILLISIBLE, on ne sait pas quels articles sont concernés.
 */
export function datesNonRepris(lignes: LigneConcordance[] | null | undefined): Map<string, string> | null {
  if (lignes === null) return null;
  const out = new Map<string, string>();
  for (const l of lignes || []) {
    const fin = jourDe(l?.en_vigueur_jusqu_au);
    if (l?.role === 'identite' && l.article_id && estDateValide(fin)) out.set(l.article_id, veille(fin));
  }
  return out;
}

/** Date de citation d'une carte de la page d'un code, et droit de relier ses renvois aux codes refondus. */
export interface CitationCarte {
  date: string | null;
  /** false : aucun lien vers un code refondu depuis cette carte (on ne sait pas dater ses renvois). */
  renvoisRefondus: boolean;
}

/**
 * Date des renvois d'un article affiché sur la page d'un code (fusion des codes 2026, 02/10/2026).
 * Par défaut, la date de publication du texte affiché (contrat, §4). Mais un ancien article NON
 * REPRIS reste dans le code de 2026 (publication 2026-09-03) alors que son texte est rédigé dans
 * l'ANCIENNE numérotation : daté de 2026, son « article 143 du code de la sécurité sociale » (Annexe
 * II de l'ancien CSS : le barème des cotisations, repris à l'art. 74) passait par l'index actuel et
 * menait à l'art. 143 de 2026, qui traite d'un autre sujet. Il est donc daté de la veille de la
 * bascule (cf. datesNonRepris). Concordance illisible (null) : un article abrogé d'un code refondu
 * peut être un ancien article non repris, et une date vide ne suffirait pas (un numéro nu du CSS
 * irait à l'index actuel) : pas de lien vers les codes refondus depuis cette carte.
 */
export function dateCitationCarte(
  art: { id: string; status?: string | null; is_active?: boolean | null },
  publicationDate: string | null | undefined,
  nonRepris: Map<string, string> | null,
): CitationCarte {
  const parDefaut = publicationDate ?? null;
  if (nonRepris === null) {
    const abroge = art.status === 'abrogé' || art.is_active === false;
    return { date: parDefaut, renvoisRefondus: !abroge };
  }
  return { date: nonRepris.get(art.id) ?? parDefaut, renvoisRefondus: true };
}
