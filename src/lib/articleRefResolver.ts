/**
 * Résolveur de références d'articles cités (conservateur, "fiabilité d'abord").
 *
 * Transforme une référence textuelle ("ARTICLE 3 AUDCG", "Article L.56 du Code du travail")
 * en lien SEULEMENT si on peut la résoudre avec certitude : code reconnu (index générique
 * dérivé de laws_and_codes + alias d'acronymes) ET article présent en base.
 * Sinon → texte simple. JAMAIS de lien mort. (Charte : renvois conditionnels.)
 *
 * Logique PURE (aucune I/O) → testable unitairement.
 */

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
  /** Slug du texte qui a abrogé celui-ci (ex. code-travail → code-travail-2026). */
  abrogated_by_slug?: string | null;
  publication_date?: string | null;
}

/** Construit l'index générique token→slug à partir des codes (extensible : conventions collectives incluses dès qu'elles sont en base).
 *  À titre égal, le texte EN VIGUEUR l'emporte sur celui qu'il a abrogé : depuis le 23/09/2026, deux textes
 *  s'intitulent « Code du Travail » (1997 abrogé, 2026). La date de la décision fait le reste (cf. codePourDecision). */
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
 * Code visé par une référence citée dans une décision DATÉE. Une décision rendue avant la
 * publication du texte en vigueur cite forcément l'ancien (« art. L.97 CT » dans un arrêt de
 * 2015 = Code du travail de 1997). Après, on garde le texte en vigueur, avec l'ancien en
 * `repli` pour un numéro qui n'existe que dans celui-ci (« L.97 »). Jamais l'inverse : un
 * arrêt ancien ne renvoie pas au texte récent.
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

  // Motif A : "ARTICLE <num> <ACRONYME>" (acronyme tout en majuscules, ≥2 lettres)
  const reAcronym = /\bART(?:ICLE)?\.?\s+(L\.?\s?\d+[\w-]*|\d+[\w-]*)\s+([A-Z]{2,}[A-Z./]*)/g;
  let m: RegExpExecArray | null;
  while ((m = reAcronym.exec(raw)) !== null) {
    refs.push({ articleNumber: m[1].replace(/\s+/g, ''), codeToken: m[2] });
  }

  // Motif B : "Article <num> du <Nom de code>"
  const reNamed = /\bArt(?:icle)?\.?\s+(L\.?\s?\d+[\w-]*|\d+[\w-]*)\s+d[eu]\s+(?:la\s+|l['']\s*)?([^,;.()]+)/gi;
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
